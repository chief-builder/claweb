/**
 * MCP 2025-06-18 Compliance Tests: Structured Output
 *
 * Tests for the structured output feature introduced in MCP 2025-06-18.
 * All tools should return structuredContent alongside text content.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPClient } from '../../src/client/index.js';

describe('MCP 2025-06-18 Compliance: Structured Output', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = new MCPClient();
    await client.connect('node', ['dist/server/index.js']);
  });

  afterAll(async () => {
    await client.disconnect();
  });

  describe('Tool Output Schema', () => {
    it('should include outputSchema in tool definitions', async () => {
      const tools = await client.listTools();

      for (const tool of tools) {
        expect(tool).toHaveProperty('outputSchema');
        expect(tool.outputSchema).toBeTruthy();
        expect(tool.outputSchema).toHaveProperty('type');
      }
    });

    it('should have valid JSON Schema for outputSchema', async () => {
      const tools = await client.listTools();

      for (const tool of tools) {
        const schema = tool.outputSchema;

        // Valid JSON Schema must have type
        expect(schema.type).toBeDefined();

        // If object type, should have properties
        if (schema.type === 'object') {
          expect(schema).toHaveProperty('properties');
        }
      }
    });
  });

  describe('Calculator Structured Output', () => {
    it('should return structuredContent with all required fields', async () => {
      const result = await client.callTool('calculator', {
        operation: 'add',
        a: 10,
        b: 5,
      });

      expect(result).toHaveProperty('structuredContent');
      expect(result.structuredContent).toMatchObject({
        operation: 'add',
        a: 10,
        b: 5,
        result: 15,
      });
      expect(result.structuredContent).toHaveProperty('expression');
      expect(result.structuredContent).toHaveProperty('timestamp');
    });

    it('should have matching text and structured content', async () => {
      const result = await client.callTool('calculator', {
        operation: 'multiply',
        a: 7,
        b: 6,
      });

      const textContent = JSON.parse(result.content[0].text);

      expect(textContent.result).toBe(result.structuredContent.result);
      expect(textContent.operation).toBe(result.structuredContent.operation);
      expect(textContent.a).toBe(result.structuredContent.a);
      expect(textContent.b).toBe(result.structuredContent.b);
    });
  });

  describe('Echo Structured Output', () => {
    it('should return structuredContent with message metadata', async () => {
      const message = 'Test message for structured output';
      const result = await client.callTool('echo', { message });

      expect(result).toHaveProperty('structuredContent');
      expect(result.structuredContent).toMatchObject({
        message,
        length: message.length,
      });
      expect(result.structuredContent).toHaveProperty('timestamp');
    });
  });

  describe('Current Time Structured Output', () => {
    it('should return structuredContent with time fields', async () => {
      const result = await client.callTool('get_current_time', {});

      expect(result).toHaveProperty('structuredContent');
      expect(result.structuredContent).toHaveProperty('timestamp');
      expect(result.structuredContent).toHaveProperty('timezone');
      expect(result.structuredContent).toHaveProperty('formatted');
      expect(result.structuredContent).toHaveProperty('unix');
      expect(result.structuredContent).toHaveProperty('iso8601');
    });

    it('should have numeric unix timestamp', async () => {
      const result = await client.callTool('get_current_time', {});

      expect(typeof result.structuredContent.unix).toBe('number');
      expect(result.structuredContent.unix).toBeGreaterThan(0);
    });
  });

  describe('Get Server Logs Structured Output', () => {
    it('should return structuredContent with log metadata', async () => {
      const result = await client.callTool('get_server_logs', {
        logType: 'access',
        lines: 50,
      });

      expect(result).toHaveProperty('structuredContent');
      expect(result.structuredContent).toMatchObject({
        logType: 'access',
        lines: 50,
      });
      expect(result.structuredContent).toHaveProperty('resourceUri');
      expect(result.structuredContent).toHaveProperty('timestamp');
    });
  });

  describe('Resource Content Links', () => {
    it('should include resource content type in get_server_logs', async () => {
      const result = await client.callTool('get_server_logs', {
        logType: 'error',
      });

      // Should have multiple content types including resource
      const resourceContent = result.content.find((c) => c.type === 'resource');
      expect(resourceContent).toBeDefined();

      if (resourceContent && resourceContent.type === 'resource') {
        expect(resourceContent.resource).toHaveProperty('uri');
        expect(resourceContent.resource).toHaveProperty('mimeType');
      }
    });
  });

  describe('Type Safety', () => {
    it('should return correct types in structuredContent', async () => {
      const result = await client.callTool('calculator', {
        operation: 'divide',
        a: 10,
        b: 4,
      });

      const sc = result.structuredContent;

      expect(typeof sc.operation).toBe('string');
      expect(typeof sc.a).toBe('number');
      expect(typeof sc.b).toBe('number');
      expect(typeof sc.result).toBe('number');
      expect(typeof sc.expression).toBe('string');
      expect(typeof sc.timestamp).toBe('string');
    });
  });
});
