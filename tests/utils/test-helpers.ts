/**
 * Test Helpers
 *
 * Common utilities and helpers for testing MCP agents and servers.
 */

import { MCPClient } from '../../src/client/index.js';
import { SimpleAgent } from '../../src/agent/simple-agent.js';

/**
 * Environment detection
 */
export const TestEnv = {
  hasApiKey: (): boolean => !!process.env.ANTHROPIC_API_KEY,
  isLiveMode: (): boolean => process.env.LIVE_LLM === 'true',
  isCI: (): boolean => process.env.CI === 'true',
  getApiKey: (): string | undefined => process.env.ANTHROPIC_API_KEY,
};

/**
 * Server configuration for tests
 */
export const TestServerConfig = {
  command: 'node',
  args: ['dist/server/index.js'],
  httpPort: 3200,
  oauthPort: 3201,
};

/**
 * Create a connected MCP client for testing
 */
export async function createTestClient(): Promise<MCPClient> {
  const client = new MCPClient();
  await client.connect(TestServerConfig.command, TestServerConfig.args);
  return client;
}

/**
 * Create and initialize a simple agent for testing
 */
export async function createTestSimpleAgent(): Promise<SimpleAgent> {
  const agent = new SimpleAgent();
  await agent.initialize(TestServerConfig.command, TestServerConfig.args);
  return agent;
}

/**
 * Retry helper for flaky operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delay?: number; backoff?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 100, backoff = 2 } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        await sleep(delay * Math.pow(backoff, attempt - 1));
      }
    }
  }

  throw lastError;
}

/**
 * Sleep helper
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Timeout wrapper for async operations
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Assert that a value matches a pattern (string, regex, or number)
 */
export function assertMatches(
  actual: string,
  expected: string | RegExp | number
): boolean {
  if (typeof expected === 'number') {
    return actual.includes(expected.toString());
  }
  if (expected instanceof RegExp) {
    return expected.test(actual);
  }
  return actual.includes(expected);
}

/**
 * Parse JSON safely with fallback
 */
export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/**
 * Extract numbers from a string
 */
export function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d+\.?\d*/g);
  return matches ? matches.map(Number) : [];
}

/**
 * Wait for condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Capture console output during a test
 */
export function captureConsole(): {
  getLogs: () => string[];
  getErrors: () => string[];
  restore: () => void;
} {
  const logs: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };

  return {
    getLogs: () => logs,
    getErrors: () => errors,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
    },
  };
}

/**
 * Generate a unique test ID
 */
export function generateTestId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Assert tool was called with specific parameters
 */
export interface ToolCallAssertion {
  name: string;
  params?: Record<string, unknown>;
}

export function assertToolCalls(
  actual: Array<{ name: string; input: Record<string, unknown> }>,
  expected: ToolCallAssertion[]
): void {
  if (actual.length !== expected.length) {
    throw new Error(
      `Expected ${expected.length} tool calls, got ${actual.length}. ` +
      `Actual: ${actual.map(t => t.name).join(', ')}`
    );
  }

  for (let i = 0; i < expected.length; i++) {
    if (actual[i].name !== expected[i].name) {
      throw new Error(
        `Expected tool ${expected[i].name} at position ${i}, got ${actual[i].name}`
      );
    }

    if (expected[i].params) {
      for (const [key, value] of Object.entries(expected[i].params!)) {
        if (actual[i].input[key] !== value) {
          throw new Error(
            `Expected ${expected[i].name}.${key} = ${value}, got ${actual[i].input[key]}`
          );
        }
      }
    }
  }
}

/**
 * Create acceptance band checker
 */
export function createAcceptanceBand(options: {
  minScore?: number;
  maxFailures?: number;
  totalRuns?: number;
}) {
  const { minScore = 0.7, maxFailures = 1, totalRuns = 3 } = options;
  const results: boolean[] = [];

  return {
    record(passed: boolean) {
      results.push(passed);
    },
    isPassing(): boolean {
      if (results.length === 0) return false;
      const passCount = results.filter(Boolean).length;
      const failCount = results.length - passCount;
      const score = passCount / results.length;
      return score >= minScore && failCount <= maxFailures;
    },
    getScore(): number {
      if (results.length === 0) return 0;
      return results.filter(Boolean).length / results.length;
    },
    getSummary(): string {
      const passCount = results.filter(Boolean).length;
      return `${passCount}/${results.length} passed (${(this.getScore() * 100).toFixed(1)}%)`;
    },
  };
}
