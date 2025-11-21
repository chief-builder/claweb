/**
 * Test Fixtures
 *
 * Provides standardized test data for consistent testing across
 * different agent types and scenarios.
 */

export interface QueryFixture {
  input: string;
  expectedTool?: string;
  expectedTools?: string[];
  expectedResult?: RegExp | string | number;
  category: 'arithmetic' | 'temporal' | 'echo' | 'status' | 'config' | 'multi-tool' | 'ambiguous';
  description: string;
}

export interface CalculatorFixture {
  operation: 'add' | 'subtract' | 'multiply' | 'divide';
  a: number;
  b: number;
  expectedResult: number;
  description: string;
}

export interface ErrorFixture {
  input: Record<string, unknown>;
  expectedError: string | RegExp;
  description: string;
}

/**
 * Query fixtures for agent testing
 */
export const QueryFixtures: Record<string, QueryFixture[]> = {
  arithmetic: [
    {
      input: 'What is 10 plus 5?',
      expectedTool: 'calculator',
      expectedResult: /15/,
      category: 'arithmetic',
      description: 'Simple addition',
    },
    {
      input: 'Calculate 100 divided by 4',
      expectedTool: 'calculator',
      expectedResult: /25/,
      category: 'arithmetic',
      description: 'Simple division',
    },
    {
      input: 'What is 7 times 8?',
      expectedTool: 'calculator',
      expectedResult: /56/,
      category: 'arithmetic',
      description: 'Simple multiplication',
    },
    {
      input: 'Subtract 15 from 42',
      expectedTool: 'calculator',
      expectedResult: /27/,
      category: 'arithmetic',
      description: 'Simple subtraction',
    },
    {
      input: 'Calculate 15 plus 25, then multiply by 2',
      expectedTools: ['calculator', 'calculator'],
      expectedResult: /80/,
      category: 'arithmetic',
      description: 'Multi-step calculation',
    },
  ],

  temporal: [
    {
      input: 'What time is it?',
      expectedTool: 'get_current_time',
      category: 'temporal',
      description: 'Simple time query',
    },
    {
      input: 'What is the current time?',
      expectedTool: 'get_current_time',
      category: 'temporal',
      description: 'Current time query',
    },
    {
      input: 'Tell me the time in New York',
      expectedTool: 'get_current_time',
      category: 'temporal',
      description: 'Time with timezone',
    },
  ],

  echo: [
    {
      input: 'Echo hello world',
      expectedTool: 'echo',
      expectedResult: /hello world/i,
      category: 'echo',
      description: 'Simple echo',
    },
    {
      input: 'Please echo back: "Testing 123"',
      expectedTool: 'echo',
      expectedResult: /Testing 123/,
      category: 'echo',
      description: 'Quoted echo',
    },
  ],

  status: [
    {
      input: 'What is the server status?',
      expectedTool: 'read_resource',
      category: 'status',
      description: 'Server status query',
    },
    {
      input: 'Show me the server status',
      expectedTool: 'read_resource',
      category: 'status',
      description: 'Status display request',
    },
  ],

  config: [
    {
      input: 'Show me the server configuration',
      expectedTool: 'read_resource',
      category: 'config',
      description: 'Config query',
    },
  ],

  multiTool: [
    {
      input: 'Calculate 50 plus 30 and tell me what time it is',
      expectedTools: ['calculator', 'get_current_time'],
      expectedResult: /80/,
      category: 'multi-tool',
      description: 'Calculator and time',
    },
    {
      input: 'What is 100 divided by 4, and show me the server status',
      expectedTools: ['calculator', 'read_resource'],
      expectedResult: /25/,
      category: 'multi-tool',
      description: 'Calculator and status',
    },
  ],

  ambiguous: [
    {
      input: 'Add the time to 5',
      category: 'ambiguous',
      description: 'Ambiguous request - time and number',
    },
    {
      input: 'Echo the calculation',
      category: 'ambiguous',
      description: 'Ambiguous request - which tool?',
    },
  ],
};

/**
 * Calculator tool fixtures for deterministic testing
 */
export const CalculatorFixtures: CalculatorFixture[] = [
  { operation: 'add', a: 10, b: 5, expectedResult: 15, description: 'Basic addition' },
  { operation: 'add', a: 0, b: 0, expectedResult: 0, description: 'Zero addition' },
  { operation: 'add', a: -5, b: 10, expectedResult: 5, description: 'Negative addition' },
  { operation: 'add', a: 1.5, b: 2.5, expectedResult: 4, description: 'Decimal addition' },

  { operation: 'subtract', a: 10, b: 5, expectedResult: 5, description: 'Basic subtraction' },
  { operation: 'subtract', a: 5, b: 10, expectedResult: -5, description: 'Negative result' },
  { operation: 'subtract', a: 0, b: 0, expectedResult: 0, description: 'Zero subtraction' },

  { operation: 'multiply', a: 10, b: 5, expectedResult: 50, description: 'Basic multiplication' },
  { operation: 'multiply', a: 0, b: 100, expectedResult: 0, description: 'Zero multiplication' },
  { operation: 'multiply', a: -5, b: 3, expectedResult: -15, description: 'Negative multiplication' },

  { operation: 'divide', a: 10, b: 5, expectedResult: 2, description: 'Basic division' },
  { operation: 'divide', a: 100, b: 4, expectedResult: 25, description: 'Even division' },
  { operation: 'divide', a: 7, b: 2, expectedResult: 3.5, description: 'Decimal result' },
];

/**
 * Error case fixtures
 */
export const ErrorFixtures: Record<string, ErrorFixture[]> = {
  calculator: [
    {
      input: { operation: 'divide', a: 10, b: 0 },
      expectedError: /division by zero/i,
      description: 'Division by zero',
    },
    {
      input: { operation: 'invalid', a: 10, b: 5 },
      expectedError: /invalid|unknown/i,
      description: 'Invalid operation',
    },
  ],
};

/**
 * Simple agent pattern matching fixtures
 * Note: The simple agent requires specific keywords like "calculate" or "math"
 * for math detection, "time" or "clock" for time queries, "status" for status, "config" for config
 */
export const SimpleAgentPatterns = {
  math: [
    // These patterns include "calculate" or "math" which the simple agent detects
    { input: 'calculate 5 * 3', expectedOperation: 'multiply' },
    { input: 'calculate 10 + 20', expectedOperation: 'add' },
    { input: 'math 15 - 7', expectedOperation: 'subtract' },
    { input: 'calculate 100 / 4', expectedOperation: 'divide' },
    { input: 'calculate multiply 6 by 7', expectedOperation: 'multiply' },
  ],
  time: [
    { input: 'what time is it', shouldMatchTime: true },
    { input: 'current time', shouldMatchTime: true },
    { input: 'tell me the clock', shouldMatchTime: true },
  ],
  status: [
    { input: 'server status', shouldMatchStatus: true },
    { input: 'show status', shouldMatchStatus: true },
  ],
  config: [
    { input: 'show config', shouldMatchConfig: true },
    { input: 'configuration', shouldMatchConfig: true },
  ],
};

/**
 * Context retention test fixtures
 */
export const ConversationFixtures = [
  {
    name: 'Simple follow-up',
    turns: [
      { query: 'Calculate 50 plus 30', expectedResult: /80/ },
      { query: 'Now multiply that by 2', expectedResult: /160/ },
    ],
  },
  {
    name: 'Multi-step calculation',
    turns: [
      { query: 'What is 100 divided by 4?', expectedResult: /25/ },
      { query: 'Add 15 to that', expectedResult: /40/ },
      { query: 'What was the first result?', expectedResult: /25/ },
    ],
  },
];

/**
 * Get all fixtures for a category
 */
export function getFixturesByCategory(category: string): QueryFixture[] {
  const allFixtures = Object.values(QueryFixtures).flat();
  return allFixtures.filter((f) => f.category === category);
}

/**
 * Get random fixture from category
 */
export function getRandomFixture(category?: string): QueryFixture {
  const fixtures = category
    ? getFixturesByCategory(category)
    : Object.values(QueryFixtures).flat();
  return fixtures[Math.floor(Math.random() * fixtures.length)];
}
