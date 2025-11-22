/**
 * MCP 2025-06-18 Compliance Tests: Tool Titles
 *
 * Tests for the tool title feature introduced in MCP 2025-06-18.
 * All tools should have display-friendly titles.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPClient } from '../../src/client/index.js';

describe('MCP 2025-06-18 Compliance: Tool Titles', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = new MCPClient();
    await client.connect('node', ['dist/server/index.js']);
  });

  afterAll(async () => {
    await client.disconnect();
  });

  describe('Title Field Presence', () => {
    it('should include title field in all tool definitions', async () => {
      const tools = await client.listTools();

      for (const tool of tools) {
        expect(tool).toHaveProperty('title');
        expect(tool.title).toBeTruthy();
        expect(typeof tool.title).toBe('string');
      }
    });

    it('should have non-empty titles', async () => {
      const tools = await client.listTools();

      for (const tool of tools) {
        expect(tool.title.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('Title Content', () => {
    it('should have human-readable calculator title', async () => {
      const tools = await client.listTools();
      const calculator = tools.find((t) => t.name === 'calculator');

      expect(calculator).toBeDefined();
      expect(calculator?.title).toBe('Calculator');
    });

    it('should have human-readable echo title', async () => {
      const tools = await client.listTools();
      const echo = tools.find((t) => t.name === 'echo');

      expect(echo).toBeDefined();
      expect(echo?.title).toBeTruthy();
    });

    it('should have human-readable time title', async () => {
      const tools = await client.listTools();
      const time = tools.find((t) => t.name === 'get_current_time');

      expect(time).toBeDefined();
      expect(time?.title).toBeTruthy();
    });

    it('should have human-readable logs title', async () => {
      const tools = await client.listTools();
      const logs = tools.find((t) => t.name === 'get_server_logs');

      expect(logs).toBeDefined();
      expect(logs?.title).toBeTruthy();
    });
  });

  describe('Title vs Name Distinction', () => {
    it('should have title different from name (formatted)', async () => {
      const tools = await client.listTools();

      for (const tool of tools) {
        // Title should be display-friendly (capitalized, spaces instead of underscores)
        // Name should be machine-friendly (lowercase, underscores)
        if (tool.name.includes('_')) {
          // If name has underscores, title should not
          expect(tool.title).not.toContain('_');
        }
      }
    });

    it('should have properly capitalized titles', async () => {
      const tools = await client.listTools();

      for (const tool of tools) {
        // First character should be uppercase
        expect(tool.title[0]).toBe(tool.title[0].toUpperCase());
      }
    });
  });

  describe('Tool Discovery Format', () => {
    it('should return complete tool metadata', async () => {
      const tools = await client.listTools();

      expect(tools.length).toBe(4);

      for (const tool of tools) {
        // Required fields per MCP 2025-06-18
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('title');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('outputSchema');
      }
    });
  });
});
