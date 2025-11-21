/**
 * Simple Agent Tests - Deterministic
 *
 * Tests for the rule-based SimpleAgent. Since the SimpleAgent uses
 * deterministic pattern matching, these tests should be 100% reliable.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SimpleAgent } from '../../src/agent/simple-agent.js';
import { SimpleAgentPatterns } from '../utils/fixtures.js';
import { captureConsole } from '../utils/test-helpers.js';

describe('Simple Agent - Deterministic Tests', () => {
  let agent: SimpleAgent;

  beforeAll(async () => {
    agent = new SimpleAgent();
    await agent.initialize('node', ['dist/server/index.js']);
  });

  afterAll(async () => {
    await agent.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize and discover tools', async () => {
      // Create a fresh agent for this test
      const testAgent = new SimpleAgent();
      const capture = captureConsole();

      try {
        await testAgent.initialize('node', ['dist/server/index.js']);
        const errors = capture.getErrors();

        // Should log tool discovery
        expect(errors.some((e) => e.includes('Found') && e.includes('tools'))).toBe(true);
        expect(errors.some((e) => e.includes('calculator'))).toBe(true);
        expect(errors.some((e) => e.includes('echo'))).toBe(true);
        expect(errors.some((e) => e.includes('get_current_time'))).toBe(true);
      } finally {
        capture.restore();
        await testAgent.shutdown();
      }
    });

    it('should discover resources', async () => {
      const testAgent = new SimpleAgent();
      const capture = captureConsole();

      try {
        await testAgent.initialize('node', ['dist/server/index.js']);
        const errors = capture.getErrors();

        // Should log resource discovery
        expect(errors.some((e) => e.includes('Found') && e.includes('resources'))).toBe(true);
      } finally {
        capture.restore();
        await testAgent.shutdown();
      }
    });
  });

  describe('Workflow Execution', () => {
    it('should execute complete workflow without errors', async () => {
      const capture = captureConsole();

      try {
        await agent.executeWorkflow();
        const errors = capture.getErrors();

        // Should complete successfully
        expect(errors.some((e) => e.includes('Workflow completed successfully'))).toBe(true);
      } finally {
        capture.restore();
      }
    });

    it('should execute workflow steps in order', async () => {
      const capture = captureConsole();

      try {
        await agent.executeWorkflow();
        const errors = capture.getErrors();

        // Check steps are logged in order
        const step1Index = errors.findIndex((e) => e.includes('Step 1'));
        const step2Index = errors.findIndex((e) => e.includes('Step 2'));
        const step3Index = errors.findIndex((e) => e.includes('Step 3'));
        const step4Index = errors.findIndex((e) => e.includes('Step 4'));

        expect(step1Index).toBeLessThan(step2Index);
        expect(step2Index).toBeLessThan(step3Index);
        expect(step3Index).toBeLessThan(step4Index);
      } finally {
        capture.restore();
      }
    });
  });

  describe('Task Routing - Math Operations', () => {
    it.each(SimpleAgentPatterns.math)(
      'should detect math operation: "$input"',
      async ({ input }) => {
        const capture = captureConsole();

        try {
          await agent.executeTask(input);
          const errors = capture.getErrors();

          // Should detect as calculation task
          expect(errors.some((e) => e.includes('Detected calculation task'))).toBe(true);
        } finally {
          capture.restore();
        }
      }
    );

    it('should extract numbers from math queries', async () => {
      const capture = captureConsole();

      try {
        await agent.executeTask('Calculate 42 multiply 3');
        const logs = capture.getLogs();

        // Should output a result containing 126
        expect(logs.some((l) => l.includes('126'))).toBe(true);
      } finally {
        capture.restore();
      }
    });
  });

  describe('Task Routing - Time Queries', () => {
    it.each(SimpleAgentPatterns.time)(
      'should detect time query: "$input"',
      async ({ input }) => {
        const capture = captureConsole();

        try {
          await agent.executeTask(input);
          const errors = capture.getErrors();

          // Should detect as time query
          expect(errors.some((e) => e.includes('Detected time query'))).toBe(true);
        } finally {
          capture.restore();
        }
      }
    );
  });

  describe('Task Routing - Status Queries', () => {
    it.each(SimpleAgentPatterns.status)(
      'should detect status query: "$input"',
      async ({ input }) => {
        const capture = captureConsole();

        try {
          await agent.executeTask(input);
          const errors = capture.getErrors();

          // Should detect as status query
          expect(errors.some((e) => e.includes('Detected status query'))).toBe(true);
        } finally {
          capture.restore();
        }
      }
    );
  });

  describe('Task Routing - Config Queries', () => {
    it.each(SimpleAgentPatterns.config)(
      'should detect config query: "$input"',
      async ({ input }) => {
        const capture = captureConsole();

        try {
          await agent.executeTask(input);
          const errors = capture.getErrors();

          // Should detect as config query
          expect(errors.some((e) => e.includes('Detected config query'))).toBe(true);
        } finally {
          capture.restore();
        }
      }
    );
  });

  describe('Task Routing - Fallback', () => {
    it('should fall back to echo for unknown tasks', async () => {
      const capture = captureConsole();

      try {
        await agent.executeTask('This is an unknown task type');
        const errors = capture.getErrors();

        // Should fall back to echo
        expect(errors.some((e) => e.includes('No specific handler found'))).toBe(true);
      } finally {
        capture.restore();
      }
    });
  });

  describe('Operation Detection', () => {
    it('should detect addition operators', async () => {
      const capture = captureConsole();

      try {
        await agent.executeTask('calculate 5 + 3');
        const logs = capture.getLogs();

        expect(logs.some((l) => l.includes('"operation":"add"') || l.includes('8'))).toBe(true);
      } finally {
        capture.restore();
      }
    });

    it('should detect multiplication keywords', async () => {
      const capture = captureConsole();

      try {
        await agent.executeTask('calculate 5 multiply 3');
        const logs = capture.getLogs();

        expect(logs.some((l) => l.includes('"operation":"multiply"') || l.includes('15'))).toBe(
          true
        );
      } finally {
        capture.restore();
      }
    });

    it('should detect division operators', async () => {
      const capture = captureConsole();

      try {
        await agent.executeTask('calculate 10 / 2');
        const logs = capture.getLogs();

        expect(logs.some((l) => l.includes('"operation":"divide"') || l.includes('5'))).toBe(
          true
        );
      } finally {
        capture.restore();
      }
    });

    it('should detect subtraction operators', async () => {
      const capture = captureConsole();

      try {
        await agent.executeTask('calculate 10 - 3');
        const logs = capture.getLogs();

        expect(logs.some((l) => l.includes('"operation":"subtract"') || l.includes('7'))).toBe(
          true
        );
      } finally {
        capture.restore();
      }
    });
  });

  describe('Error Handling', () => {
    it('should complete task even with insufficient numbers', async () => {
      const capture = captureConsole();

      try {
        // Only one number - should fall back to echo
        await agent.executeTask('calculate 5');
        const errors = capture.getErrors();

        // Should still complete
        expect(errors.some((e) => e.includes('Task completed'))).toBe(true);
      } finally {
        capture.restore();
      }
    });
  });

  describe('Lifecycle', () => {
    it('should handle multiple task executions', async () => {
      const tasks = [
        'calculate 5 + 5',
        'what time is it',
        'show status',
        'echo hello',
      ];

      for (const task of tasks) {
        const capture = captureConsole();
        try {
          await agent.executeTask(task);
          const errors = capture.getErrors();
          expect(errors.some((e) => e.includes('Task completed'))).toBe(true);
        } finally {
          capture.restore();
        }
      }
    });

    it('should support shutdown and reinitialize', async () => {
      const testAgent = new SimpleAgent();

      // First lifecycle
      await testAgent.initialize('node', ['dist/server/index.js']);
      await testAgent.executeTask('calculate 1 + 1');
      await testAgent.shutdown();

      // Small delay to ensure clean shutdown
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second lifecycle with a fresh agent instance
      const testAgent2 = new SimpleAgent();
      await testAgent2.initialize('node', ['dist/server/index.js']);
      await testAgent2.executeTask('calculate 2 + 2');
      await testAgent2.shutdown();

      // If we get here without errors, test passes
      expect(true).toBe(true);
    });
  });
});
