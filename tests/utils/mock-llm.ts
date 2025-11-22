/**
 * Mock LLM for Deterministic Testing
 *
 * Provides a mock implementation of the Anthropic API for testing
 * agent logic without actual API calls.
 */

import type Anthropic from '@anthropic-ai/sdk';

export interface MockResponse {
  content: Anthropic.ContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens';
}

export interface MockToolCall {
  name: string;
  input: Record<string, unknown>;
}

/**
 * Create a mock text response
 */
export function createTextResponse(text: string): MockResponse {
  return {
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
  };
}

/**
 * Create a mock tool use response
 */
export function createToolUseResponse(
  toolCalls: MockToolCall[],
  includeText?: string
): MockResponse {
  const content: Anthropic.ContentBlock[] = [];

  if (includeText) {
    content.push({ type: 'text', text: includeText });
  }

  toolCalls.forEach((call, index) => {
    content.push({
      type: 'tool_use',
      id: `mock_tool_${index}_${Date.now()}`,
      name: call.name,
      input: call.input,
    } as Anthropic.ToolUseBlock);
  });

  return {
    content,
    stop_reason: 'tool_use',
  };
}

/**
 * Pattern-based response matcher
 */
export interface ResponsePattern {
  pattern: RegExp;
  response: MockResponse | ((match: RegExpMatchArray) => MockResponse);
}

/**
 * Mock LLM class that returns predefined responses based on patterns
 */
export class MockLLM {
  private patterns: ResponsePattern[] = [];
  private defaultResponse: MockResponse;
  private callHistory: Array<{
    messages: Anthropic.MessageParam[];
    response: MockResponse;
    timestamp: number;
  }> = [];

  constructor() {
    this.defaultResponse = createTextResponse('I cannot process this request.');
  }

  /**
   * Add a pattern-based response
   */
  addPattern(pattern: RegExp, response: MockResponse | ((match: RegExpMatchArray) => MockResponse)) {
    this.patterns.push({ pattern, response });
  }

  /**
   * Set the default response when no pattern matches
   */
  setDefaultResponse(response: MockResponse) {
    this.defaultResponse = response;
  }

  /**
   * Get the mock create method for messages
   */
  getCreateMethod(): (params: Anthropic.MessageCreateParams) => Promise<Anthropic.Message> {
    return async (params: Anthropic.MessageCreateParams): Promise<Anthropic.Message> => {
      // Extract the last user message
      const lastMessage = params.messages[params.messages.length - 1];
      let queryText = '';

      if (typeof lastMessage.content === 'string') {
        queryText = lastMessage.content;
      } else if (Array.isArray(lastMessage.content)) {
        const textBlock = lastMessage.content.find((b) =>
          (b as any).type === 'text' || typeof b === 'string'
        );
        if (textBlock) {
          queryText = typeof textBlock === 'string' ? textBlock : (textBlock as any).text || '';
        }
      }

      // Find matching pattern
      let response = this.defaultResponse;
      for (const { pattern, response: patternResponse } of this.patterns) {
        const match = queryText.match(pattern);
        if (match) {
          response = typeof patternResponse === 'function'
            ? patternResponse(match)
            : patternResponse;
          break;
        }
      }

      // Record the call
      this.callHistory.push({
        messages: params.messages as Anthropic.MessageParam[],
        response,
        timestamp: Date.now(),
      });

      // Return mock Anthropic.Message
      return {
        id: `mock_msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: response.content,
        model: params.model,
        stop_reason: response.stop_reason,
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      } as Anthropic.Message;
    };
  }

  /**
   * Get call history
   */
  getCallHistory() {
    return [...this.callHistory];
  }

  /**
   * Clear call history
   */
  clearHistory() {
    this.callHistory = [];
  }

  /**
   * Get number of calls made
   */
  getCallCount() {
    return this.callHistory.length;
  }
}

/**
 * Pre-configured mock for calculator operations
 */
export function createCalculatorMock(): MockLLM {
  const mock = new MockLLM();

  // Pattern: addition
  mock.addPattern(/(\d+)\s*(?:\+|plus|add)\s*(\d+)/i, (match) => {
    const a = parseInt(match[1]);
    const b = parseInt(match[2]);
    return createToolUseResponse([
      { name: 'calculator', input: { operation: 'add', a, b } },
    ]);
  });

  // Pattern: subtraction
  mock.addPattern(/(\d+)\s*(?:-|minus|subtract)\s*(\d+)/i, (match) => {
    const a = parseInt(match[1]);
    const b = parseInt(match[2]);
    return createToolUseResponse([
      { name: 'calculator', input: { operation: 'subtract', a, b } },
    ]);
  });

  // Pattern: multiplication
  mock.addPattern(/(\d+)\s*(?:\*|×|times|multiply)\s*(\d+)/i, (match) => {
    const a = parseInt(match[1]);
    const b = parseInt(match[2]);
    return createToolUseResponse([
      { name: 'calculator', input: { operation: 'multiply', a, b } },
    ]);
  });

  // Pattern: division
  mock.addPattern(/(\d+)\s*(?:\/|÷|divided by)\s*(\d+)/i, (match) => {
    const a = parseInt(match[1]);
    const b = parseInt(match[2]);
    return createToolUseResponse([
      { name: 'calculator', input: { operation: 'divide', a, b } },
    ]);
  });

  // Pattern: time queries
  mock.addPattern(/(?:what|current|tell me the)\s*time/i, () => {
    return createToolUseResponse([
      { name: 'get_current_time', input: {} },
    ]);
  });

  // Pattern: echo
  mock.addPattern(/echo\s+(.+)/i, (match) => {
    return createToolUseResponse([
      { name: 'echo', input: { message: match[1] } },
    ]);
  });

  // Pattern: status
  mock.addPattern(/(?:server\s+)?status/i, () => {
    return createToolUseResponse([
      { name: 'read_resource', input: { uri: 'status://server' } },
    ]);
  });

  // Pattern: config
  mock.addPattern(/(?:server\s+)?config(?:uration)?/i, () => {
    return createToolUseResponse([
      { name: 'read_resource', input: { uri: 'config://server' } },
    ]);
  });

  return mock;
}

/**
 * Create a mock Anthropic client with the given MockLLM
 */
export function createMockAnthropicClient(mockLLM: MockLLM): { messages: { create: ReturnType<MockLLM['getCreateMethod']> } } {
  return {
    messages: {
      create: mockLLM.getCreateMethod(),
    },
  };
}
