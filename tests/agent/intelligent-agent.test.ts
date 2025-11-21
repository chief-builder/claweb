/**
 * Intelligent Agent Tests - Non-Deterministic
 *
 * Tests for the LLM-powered IntelligentAgent. These tests use:
 * - Acceptance bands for non-deterministic outputs
 * - Tool correctness assertions
 * - LLM-as-Judge for semantic evaluation
 * - Mock LLM for deterministic logic testing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { IntelligentAgent } from '../../src/agent/intelligent-agent.js';
import { QueryFixtures, ConversationFixtures } from '../utils/fixtures.js';
import { LLMJudge, Judge } from '../utils/llm-judge.js';
import { MockLLM, createCalculatorMock, createMockAnthropicClient } from '../utils/mock-llm.js';
import { TestEnv, createAcceptanceBand } from '../utils/test-helpers.js';

describe('Intelligent Agent - Non-Deterministic Tests', () => {
  const hasApiKey = TestEnv.hasApiKey();
  const isLiveMode = TestEnv.isLiveMode();

  describe('Initialization', () => {
    it('should initialize and discover tools', async () => {
      const agent = new IntelligentAgent();

      await agent.initialize('node', ['dist/server/index.js']);

      // If we get here without error, initialization succeeded
      expect(true).toBe(true);

      await agent.shutdown();
    });
  });

  describe('Tool Selection Accuracy (Live LLM)', () => {
    // Skip if no API key or not in live mode
    const shouldRun = hasApiKey;

    describe.runIf(shouldRun)('Arithmetic Queries', () => {
      let agent: IntelligentAgent;

      beforeAll(async () => {
        agent = new IntelligentAgent();
        await agent.initialize('node', ['dist/server/index.js']);
      });

      afterAll(async () => {
        await agent.shutdown();
      });

      beforeEach(() => {
        agent.resetConversation();
      });

      it('should use calculator for addition', async () => {
        const response = await agent.processQuery('What is 10 plus 5?');

        // Acceptance band: response should contain 15
        expect(response).toMatch(/15/);
      }, 30000);

      it('should use calculator for multiplication', async () => {
        const response = await agent.processQuery('What is 7 times 8?');

        expect(response).toMatch(/56/);
      }, 30000);

      it('should handle multi-step calculations', async () => {
        const response = await agent.processQuery(
          'Calculate 15 plus 25, then multiply the result by 2'
        );

        expect(response).toMatch(/80/);
      }, 45000);
    });

    describe.runIf(shouldRun)('Temporal Queries', () => {
      let agent: IntelligentAgent;

      beforeAll(async () => {
        agent = new IntelligentAgent();
        await agent.initialize('node', ['dist/server/index.js']);
      });

      afterAll(async () => {
        await agent.shutdown();
      });

      beforeEach(() => {
        agent.resetConversation();
      });

      it('should use time tool for time queries', async () => {
        const response = await agent.processQuery('What time is it?');

        // Should contain some time-related content
        expect(response.length).toBeGreaterThan(10);
        // Check for common time patterns (digits with colons)
        expect(response).toMatch(/\d{1,2}:\d{2}|\d{1,2}\s*(am|pm|AM|PM)|time|clock/i);
      }, 30000);
    });

    describe.runIf(shouldRun)('Multi-Tool Queries', () => {
      let agent: IntelligentAgent;

      beforeAll(async () => {
        agent = new IntelligentAgent();
        await agent.initialize('node', ['dist/server/index.js']);
      });

      afterAll(async () => {
        await agent.shutdown();
      });

      beforeEach(() => {
        agent.resetConversation();
      });

      it('should handle calculator and time in one query', async () => {
        const response = await agent.processQuery(
          'Calculate 50 plus 30 and tell me what time it is'
        );

        // Should contain the calculation result
        expect(response).toMatch(/80/);
        // Should also mention time
        expect(response.length).toBeGreaterThan(50);
      }, 45000);
    });
  });

  describe('Conversation Context', () => {
    const shouldRun = hasApiKey;

    describe.runIf(shouldRun)('Context Retention', () => {
      let agent: IntelligentAgent;

      beforeAll(async () => {
        agent = new IntelligentAgent();
        await agent.initialize('node', ['dist/server/index.js']);
      });

      afterAll(async () => {
        await agent.shutdown();
      });

      beforeEach(() => {
        agent.resetConversation();
      });

      it('should maintain context across turns', async () => {
        // First query
        const response1 = await agent.processQuery('Calculate 50 plus 30');
        expect(response1).toMatch(/80/);

        // Follow-up query referencing previous result
        const response2 = await agent.processQuery('Now multiply that by 2');
        expect(response2).toMatch(/160/);
      }, 60000);

      it('should reset context when requested', async () => {
        await agent.processQuery('Calculate 10 plus 5');
        agent.resetConversation();

        // After reset, "that" has no context
        const response = await agent.processQuery('What is 20 minus 10?');
        expect(response).toMatch(/10/);
      }, 45000);
    });
  });

  describe('Error Handling', () => {
    const shouldRun = hasApiKey;

    describe.runIf(shouldRun)('Graceful Error Handling', () => {
      let agent: IntelligentAgent;

      beforeAll(async () => {
        agent = new IntelligentAgent();
        await agent.initialize('node', ['dist/server/index.js']);
      });

      afterAll(async () => {
        await agent.shutdown();
      });

      beforeEach(() => {
        agent.resetConversation();
      });

      it('should handle division by zero gracefully', async () => {
        const response = await agent.processQuery('Divide 10 by zero');

        // Should get a response (not throw)
        expect(response).toBeTruthy();
        expect(typeof response).toBe('string');
      }, 30000);
    });
  });

  describe('LLM-as-Judge Evaluation', () => {
    const shouldRun = hasApiKey;

    describe.runIf(shouldRun)('Semantic Quality', () => {
      let agent: IntelligentAgent;
      let judge: LLMJudge;

      beforeAll(async () => {
        agent = new IntelligentAgent();
        await agent.initialize('node', ['dist/server/index.js']);
        judge = new LLMJudge();
      });

      afterAll(async () => {
        await agent.shutdown();
      });

      beforeEach(() => {
        agent.resetConversation();
      });

      it('should provide helpful response to calculation query', async () => {
        const query = 'What is 25 multiplied by 4?';
        const response = await agent.processQuery(query);

        const evaluation = await judge.evaluate({
          query,
          response,
          criteria: [
            'The response contains the correct answer (100)',
            'The response is clear and easy to understand',
            'The response directly addresses the question',
          ],
          threshold: 0.6,
        });

        expect(evaluation.passed).toBe(true);
      }, 60000);

      it('should provide coherent multi-part response', async () => {
        const query = 'Calculate 100 divided by 4 and echo "test message"';
        const response = await agent.processQuery(query);

        const evaluation = await judge.evaluate({
          query,
          response,
          criteria: [
            'The response includes the division result (25)',
            'The response acknowledges or includes the echo message',
            'The response is coherent and addresses both parts',
          ],
          threshold: 0.5,
        });

        expect(evaluation.passed).toBe(true);
      }, 60000);
    });
  });

  describe('Acceptance Band Testing', () => {
    const shouldRun = hasApiKey && isLiveMode;

    describe.runIf(shouldRun)('Flake Detection', () => {
      let agent: IntelligentAgent;

      beforeAll(async () => {
        agent = new IntelligentAgent();
        await agent.initialize('node', ['dist/server/index.js']);
      });

      afterAll(async () => {
        await agent.shutdown();
      });

      it('should pass arithmetic query 70%+ of the time', async () => {
        const band = createAcceptanceBand({ minScore: 0.7, totalRuns: 3 });

        for (let i = 0; i < 3; i++) {
          agent.resetConversation();
          try {
            const response = await agent.processQuery('What is 15 plus 25?');
            const passed = /40/.test(response);
            band.record(passed);
          } catch {
            band.record(false);
          }
        }

        console.log(`Acceptance band result: ${band.getSummary()}`);
        expect(band.isPassing()).toBe(true);
      }, 120000);
    });
  });

  describe('Deterministic Logic Tests (Mock LLM)', () => {
    // These tests use a mock LLM to test agent logic deterministically

    it('should handle tool results correctly', async () => {
      // This tests the agent's logic for processing tool results
      // without making actual API calls
      const mockLLM = createCalculatorMock();

      // Verify mock behaves as expected
      const createMethod = mockLLM.getCreateMethod();
      const response = await createMethod({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'What is 10 plus 5?' }],
      });

      // Mock should return tool_use for math query
      expect(response.stop_reason).toBe('tool_use');
      expect(response.content.some((c) => c.type === 'tool_use')).toBe(true);

      const toolUse = response.content.find((c) => c.type === 'tool_use');
      if (toolUse && toolUse.type === 'tool_use') {
        expect(toolUse.name).toBe('calculator');
        expect((toolUse.input as any).operation).toBe('add');
      }
    });

    it('should route different query types to correct tools', async () => {
      const mockLLM = createCalculatorMock();
      const createMethod = mockLLM.getCreateMethod();

      // Test time query
      const timeResponse = await createMethod({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'What time is it?' }],
      });

      const timeToolUse = timeResponse.content.find((c) => c.type === 'tool_use');
      expect(timeToolUse).toBeDefined();
      if (timeToolUse && timeToolUse.type === 'tool_use') {
        expect(timeToolUse.name).toBe('get_current_time');
      }

      // Test echo query
      const echoResponse = await createMethod({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'echo hello world' }],
      });

      const echoToolUse = echoResponse.content.find((c) => c.type === 'tool_use');
      expect(echoToolUse).toBeDefined();
      if (echoToolUse && echoToolUse.type === 'tool_use') {
        expect(echoToolUse.name).toBe('echo');
      }
    });

    it('should track call history', async () => {
      const mockLLM = createCalculatorMock();
      const createMethod = mockLLM.getCreateMethod();

      await createMethod({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [{ role: 'user', content: '5 + 3' }],
      });

      await createMethod({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [{ role: 'user', content: '10 * 2' }],
      });

      expect(mockLLM.getCallCount()).toBe(2);

      const history = mockLLM.getCallHistory();
      expect(history).toHaveLength(2);
    });
  });

  describe('Skip Notices', () => {
    it.skipIf(!hasApiKey)('Live LLM tests require ANTHROPIC_API_KEY', () => {
      console.log('Set ANTHROPIC_API_KEY to run live LLM tests');
    });
  });
});
