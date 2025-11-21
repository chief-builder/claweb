/**
 * Unit Tests: Echo Tool
 *
 * Deterministic tests for the echo tool.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPClient } from '../../../src/client/index.js';

describe('Echo Tool - Unit Tests', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = new MCPClient();
    await client.connect('node', ['dist/server/index.js']);
  });

  afterAll(async () => {
    await client.disconnect();
  });

  describe('Basic Functionality', () => {
    it('should echo back a simple message', async () => {
      const message = 'Hello, World!';
      const result = await client.callTool('echo', { message });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe(message);
    });

    it('should echo back an empty message', async () => {
      const result = await client.callTool('echo', { message: '' });

      expect(result.content[0].text).toBe('');
    });

    it('should handle special characters', async () => {
      const message = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
      const result = await client.callTool('echo', { message });

      expect(result.content[0].text).toBe(message);
    });

    it('should handle unicode characters', async () => {
      const message = '你好世界 🌍 مرحبا';
      const result = await client.callTool('echo', { message });

      expect(result.content[0].text).toBe(message);
    });

    it('should handle newlines and whitespace', async () => {
      const message = 'Line 1\nLine 2\n\tTabbed';
      const result = await client.callTool('echo', { message });

      expect(result.content[0].text).toBe(message);
    });

    it('should handle very long messages', async () => {
      const message = 'A'.repeat(10000);
      const result = await client.callTool('echo', { message });

      expect(result.content[0].text).toBe(message);
    });
  });

  describe('Structured Output (MCP 2025-06-18)', () => {
    it('should return structuredContent with message and metadata', async () => {
      const message = 'Test message';
      const result = await client.callTool('echo', { message });

      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent).toMatchObject({
        message,
        length: message.length,
      });
      expect(result.structuredContent).toHaveProperty('timestamp');
    });

    it('should calculate correct length for unicode', async () => {
      const message = '你好'; // 2 characters
      const result = await client.callTool('echo', { message });

      expect(result.structuredContent.length).toBe(2);
    });
  });
});
