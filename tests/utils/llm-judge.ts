/**
 * LLM-as-Judge Implementation
 *
 * Uses Claude to evaluate agent responses for semantic quality,
 * helpfulness, and correctness when deterministic testing is not possible.
 */

import Anthropic from '@anthropic-ai/sdk';

export interface EvaluationCriteria {
  name: string;
  description: string;
  weight?: number; // Default 1.0
}

export interface EvaluationConfig {
  query: string;
  response: string;
  criteria: string[] | EvaluationCriteria[];
  threshold?: number; // Default 0.7 (70% must pass)
  context?: string; // Additional context for the judge
}

export interface CriterionResult {
  criterion: string;
  score: number; // 0.0 - 1.0
  reasoning: string;
  passed: boolean;
}

export interface EvaluationResult {
  overallScore: number;
  passed: boolean;
  criteriaResults: CriterionResult[];
  summary: string;
}

export class LLMJudge {
  private anthropic: Anthropic;
  private model: string;

  constructor(apiKey?: string, model: string = 'claude-3-haiku-20240307') {
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.model = model;
  }

  /**
   * Evaluate an agent response against specified criteria
   */
  async evaluate(config: EvaluationConfig): Promise<EvaluationResult> {
    const threshold = config.threshold ?? 0.7;

    // Normalize criteria to strings
    const criteriaStrings = config.criteria.map((c) =>
      typeof c === 'string' ? c : `${c.name}: ${c.description}`
    );

    const prompt = this.buildEvaluationPrompt(config, criteriaStrings);

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from LLM judge');
      }

      return this.parseEvaluationResponse(content.text, criteriaStrings, threshold);
    } catch (error) {
      // Return a failed evaluation if API call fails
      return {
        overallScore: 0,
        passed: false,
        criteriaResults: criteriaStrings.map((c) => ({
          criterion: c,
          score: 0,
          reasoning: `Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          passed: false,
        })),
        summary: `Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private buildEvaluationPrompt(config: EvaluationConfig, criteria: string[]): string {
    const contextSection = config.context
      ? `\nAdditional Context: ${config.context}\n`
      : '';

    return `You are an expert evaluator assessing an AI agent's response quality.

User Query: "${config.query}"
${contextSection}
Agent Response: "${config.response}"

Evaluate the response against each of the following criteria. For each criterion, provide:
1. A score from 0.0 to 1.0 (where 0 = completely fails, 0.5 = partially meets, 1.0 = fully meets)
2. A brief reasoning explaining the score

Criteria to evaluate:
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Respond in valid JSON format only:
{
  "criteria_results": [
    {
      "criterion": "criterion text",
      "score": 0.0-1.0,
      "reasoning": "explanation"
    }
  ],
  "overall_score": 0.0-1.0,
  "summary": "brief overall assessment"
}`;
  }

  private parseEvaluationResponse(
    responseText: string,
    criteria: string[],
    threshold: number
  ): EvaluationResult {
    try {
      // Extract JSON from response (handle potential markdown code blocks)
      let jsonText = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonText);

      const criteriaResults: CriterionResult[] = (parsed.criteria_results || []).map(
        (r: any, index: number) => ({
          criterion: r.criterion || criteria[index] || `Criterion ${index + 1}`,
          score: Math.max(0, Math.min(1, parseFloat(r.score) || 0)),
          reasoning: r.reasoning || 'No reasoning provided',
          passed: (parseFloat(r.score) || 0) >= threshold,
        })
      );

      const overallScore = parsed.overall_score ??
        (criteriaResults.length > 0
          ? criteriaResults.reduce((sum, r) => sum + r.score, 0) / criteriaResults.length
          : 0);

      return {
        overallScore,
        passed: overallScore >= threshold,
        criteriaResults,
        summary: parsed.summary || 'No summary provided',
      };
    } catch (error) {
      // If parsing fails, attempt a simpler extraction
      return {
        overallScore: 0,
        passed: false,
        criteriaResults: criteria.map((c) => ({
          criterion: c,
          score: 0,
          reasoning: 'Failed to parse evaluation response',
          passed: false,
        })),
        summary: `Failed to parse response: ${responseText.substring(0, 100)}...`,
      };
    }
  }

  /**
   * Quick evaluation with simple pass/fail criteria
   */
  async quickEvaluate(
    query: string,
    response: string,
    mustContain: string[],
    mustNotContain: string[] = []
  ): Promise<{ passed: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    let passed = true;

    for (const term of mustContain) {
      if (!response.toLowerCase().includes(term.toLowerCase())) {
        passed = false;
        reasons.push(`Missing expected content: "${term}"`);
      }
    }

    for (const term of mustNotContain) {
      if (response.toLowerCase().includes(term.toLowerCase())) {
        passed = false;
        reasons.push(`Contains unexpected content: "${term}"`);
      }
    }

    return { passed, reasons };
  }

  /**
   * Evaluate response coherence using LLM
   */
  async evaluateCoherence(response: string): Promise<{ score: number; reasoning: string }> {
    const result = await this.evaluate({
      query: 'Evaluate this response for coherence',
      response,
      criteria: [
        'The response is logically structured',
        'The response flows naturally from one point to the next',
        'The response does not contradict itself',
      ],
    });

    return {
      score: result.overallScore,
      reasoning: result.summary,
    };
  }

  /**
   * Evaluate if response correctly answers a math question
   */
  async evaluateMathAnswer(
    query: string,
    response: string,
    expectedAnswer: number
  ): Promise<{ passed: boolean; reasoning: string }> {
    // First try deterministic check
    if (response.includes(expectedAnswer.toString())) {
      return { passed: true, reasoning: `Response contains expected answer: ${expectedAnswer}` };
    }

    // Fall back to LLM evaluation for more nuanced checking
    const result = await this.evaluate({
      query,
      response,
      criteria: [
        `The response contains or clearly states the answer ${expectedAnswer}`,
        'The response demonstrates the calculation was performed correctly',
      ],
      context: `The expected numerical answer is ${expectedAnswer}`,
    });

    return {
      passed: result.passed,
      reasoning: result.summary,
    };
  }
}

/**
 * Static convenience methods for common evaluations
 */
export const Judge = {
  /**
   * Create a new judge instance
   */
  create(apiKey?: string): LLMJudge {
    return new LLMJudge(apiKey);
  },

  /**
   * Check if API key is available for LLM-as-Judge
   */
  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  },
};
