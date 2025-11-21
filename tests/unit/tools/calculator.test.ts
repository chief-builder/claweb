/**
 * Unit Tests: Calculator Tool
 *
 * Deterministic tests for the calculator tool logic.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPClient } from '../../../src/client/index.js';
import { CalculatorFixtures, ErrorFixtures } from '../../utils/fixtures.js';

describe('Calculator Tool - Unit Tests', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = new MCPClient();
    await client.connect('node', ['dist/server/index.js']);
  });

  afterAll(async () => {
    await client.disconnect();
  });

  describe('Basic Operations', () => {
    it.each(CalculatorFixtures.filter((f) => f.operation === 'add'))(
      'should add: $a + $b = $expectedResult ($description)',
      async ({ operation, a, b, expectedResult }) => {
        const result = await client.callTool('calculator', { operation, a, b });
        const data = JSON.parse(result.content[0].text);
        expect(data.result).toBe(expectedResult);
      }
    );

    it.each(CalculatorFixtures.filter((f) => f.operation === 'subtract'))(
      'should subtract: $a - $b = $expectedResult ($description)',
      async ({ operation, a, b, expectedResult }) => {
        const result = await client.callTool('calculator', { operation, a, b });
        const data = JSON.parse(result.content[0].text);
        expect(data.result).toBe(expectedResult);
      }
    );

    it.each(CalculatorFixtures.filter((f) => f.operation === 'multiply'))(
      'should multiply: $a × $b = $expectedResult ($description)',
      async ({ operation, a, b, expectedResult }) => {
        const result = await client.callTool('calculator', { operation, a, b });
        const data = JSON.parse(result.content[0].text);
        expect(data.result).toBe(expectedResult);
      }
    );

    it.each(CalculatorFixtures.filter((f) => f.operation === 'divide'))(
      'should divide: $a ÷ $b = $expectedResult ($description)',
      async ({ operation, a, b, expectedResult }) => {
        const result = await client.callTool('calculator', { operation, a, b });
        const data = JSON.parse(result.content[0].text);
        expect(data.result).toBe(expectedResult);
      }
    );
  });

  describe('Edge Cases', () => {
    it('should handle very large numbers', async () => {
      const result = await client.callTool('calculator', {
        operation: 'multiply',
        a: 999999,
        b: 999999,
      });
      const data = JSON.parse(result.content[0].text);
      expect(data.result).toBe(999998000001);
    });

    it('should handle negative numbers', async () => {
      const result = await client.callTool('calculator', {
        operation: 'add',
        a: -100,
        b: -50,
      });
      const data = JSON.parse(result.content[0].text);
      expect(data.result).toBe(-150);
    });

    it('should handle decimal precision', async () => {
      const result = await client.callTool('calculator', {
        operation: 'divide',
        a: 1,
        b: 3,
      });
      const data = JSON.parse(result.content[0].text);
      expect(data.result).toBeCloseTo(0.333333, 5);
    });
  });

  describe('Error Handling', () => {
    it('should return error for division by zero', async () => {
      const result = await client.callTool('calculator', {
        operation: 'divide',
        a: 10,
        b: 0,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/division by zero/i);
    });
  });

  describe('Structured Output (MCP 2025-06-18)', () => {
    it('should return structuredContent with all required fields', async () => {
      const result = await client.callTool('calculator', {
        operation: 'add',
        a: 10,
        b: 5,
      });

      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent).toMatchObject({
        operation: 'add',
        a: 10,
        b: 5,
        result: 15,
        expression: '10 + 5 = 15',
      });
      expect(result.structuredContent).toHaveProperty('timestamp');
    });

    it('should have consistent text and structured output', async () => {
      const result = await client.callTool('calculator', {
        operation: 'multiply',
        a: 7,
        b: 8,
      });

      const textData = JSON.parse(result.content[0].text);
      expect(textData.result).toBe(result.structuredContent.result);
      expect(textData.operation).toBe(result.structuredContent.operation);
    });
  });
});
