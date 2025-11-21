/**
 * Unit Tests: Current Time Tool
 *
 * Tests for the get_current_time tool.
 * Note: Time-based tests require special handling for determinism.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPClient } from '../../../src/client/index.js';

describe('Current Time Tool - Unit Tests', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = new MCPClient();
    await client.connect('node', ['dist/server/index.js']);
  });

  afterAll(async () => {
    await client.disconnect();
  });

  describe('Basic Functionality', () => {
    it('should return current time with default timezone', async () => {
      const beforeCall = Date.now();
      const result = await client.callTool('get_current_time', {});
      const afterCall = Date.now();

      const data = JSON.parse(result.content[0].text);

      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('timezone');
      expect(data).toHaveProperty('formatted');
      expect(data).toHaveProperty('unix');

      // Unix timestamp should be within the test execution window
      expect(data.unix).toBeGreaterThanOrEqual(Math.floor(beforeCall / 1000));
      expect(data.unix).toBeLessThanOrEqual(Math.ceil(afterCall / 1000));
    });

    it('should handle America/New_York timezone', async () => {
      const result = await client.callTool('get_current_time', {
        timezone: 'America/New_York',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.timezone).toBe('America/New_York');
    });

    it('should handle Europe/London timezone', async () => {
      const result = await client.callTool('get_current_time', {
        timezone: 'Europe/London',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.timezone).toBe('Europe/London');
    });

    it('should handle Asia/Tokyo timezone', async () => {
      const result = await client.callTool('get_current_time', {
        timezone: 'Asia/Tokyo',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.timezone).toBe('Asia/Tokyo');
    });
  });

  describe('Output Format', () => {
    it('should return valid ISO 8601 timestamp', async () => {
      const result = await client.callTool('get_current_time', {});
      const data = JSON.parse(result.content[0].text);

      // ISO 8601 format validation
      expect(data.iso8601).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should return numeric unix timestamp', async () => {
      const result = await client.callTool('get_current_time', {});
      const data = JSON.parse(result.content[0].text);

      expect(typeof data.unix).toBe('number');
      expect(data.unix).toBeGreaterThan(0);
    });
  });

  describe('Structured Output (MCP 2025-06-18)', () => {
    it('should return structuredContent with all time fields', async () => {
      const result = await client.callTool('get_current_time', {});

      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent).toHaveProperty('timestamp');
      expect(result.structuredContent).toHaveProperty('timezone');
      expect(result.structuredContent).toHaveProperty('formatted');
      expect(result.structuredContent).toHaveProperty('unix');
      expect(result.structuredContent).toHaveProperty('iso8601');
    });

    it('should have consistent text and structured output', async () => {
      const result = await client.callTool('get_current_time', {});

      const textData = JSON.parse(result.content[0].text);
      expect(textData.unix).toBe(result.structuredContent.unix);
      expect(textData.timezone).toBe(result.structuredContent.timezone);
    });
  });
});
