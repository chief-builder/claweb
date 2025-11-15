/**
 * Integration tests for MCP Reference Implementation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPClient } from '../src/client/index.js';
import { SimpleAgent } from '../src/agent/simple-agent.js';

describe('MCP Integration Tests', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = new MCPClient();
    await client.connect('node', ['dist/server/index.js']);
  });

  afterAll(async () => {
    await client.disconnect();
  });

  describe('Tool Discovery', () => {
    it('should list all available tools', async () => {
      const tools = await client.listTools();

      expect(tools).toHaveLength(3);
      expect(tools.map((t) => t.name)).toContain('calculator');
      expect(tools.map((t) => t.name)).toContain('echo');
      expect(tools.map((t) => t.name)).toContain('get_current_time');
    });
  });

  describe('Calculator Tool', () => {
    it('should add two numbers', async () => {
      const result = await client.callTool('calculator', {
        operation: 'add',
        a: 10,
        b: 5,
      });

      expect(result.content).toHaveLength(1);
      const data = JSON.parse(result.content[0].text);
      expect(data.result).toBe(15);
    });

    it('should subtract two numbers', async () => {
      const result = await client.callTool('calculator', {
        operation: 'subtract',
        a: 10,
        b: 5,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.result).toBe(5);
    });

    it('should multiply two numbers', async () => {
      const result = await client.callTool('calculator', {
        operation: 'multiply',
        a: 10,
        b: 5,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.result).toBe(50);
    });

    it('should divide two numbers', async () => {
      const result = await client.callTool('calculator', {
        operation: 'divide',
        a: 10,
        b: 5,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.result).toBe(2);
    });

    it('should handle division by zero', async () => {
      const result = await client.callTool('calculator', {
        operation: 'divide',
        a: 10,
        b: 0,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Division by zero');
    });
  });

  describe('Echo Tool', () => {
    it('should echo back the message', async () => {
      const testMessage = 'Hello, MCP!';
      const result = await client.callTool('echo', {
        message: testMessage,
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe(testMessage);
    });
  });

  describe('Current Time Tool', () => {
    it('should return current time', async () => {
      const result = await client.callTool('get_current_time', {});

      expect(result.content).toHaveLength(1);
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('timezone');
      expect(data).toHaveProperty('unix');
    });

    it('should handle custom timezone', async () => {
      const result = await client.callTool('get_current_time', {
        timezone: 'America/New_York',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.timezone).toBe('America/New_York');
    });
  });

  describe('Resource Discovery', () => {
    it('should list all available resources', async () => {
      const resources = await client.listResources();

      expect(resources).toHaveLength(2);
      expect(resources.map((r) => r.uri)).toContain('config://server');
      expect(resources.map((r) => r.uri)).toContain('status://server');
    });
  });

  describe('Resource Reading', () => {
    it('should read server config resource', async () => {
      const result = await client.readResource('config://server');

      expect(result.contents).toHaveLength(1);
      const config = JSON.parse(result.contents[0].text || '{}');
      expect(config.server.name).toBe('mcp-reference-server');
      expect(config.capabilities.tools).toBe(true);
    });

    it('should read server status resource', async () => {
      const result = await client.readResource('status://server');

      expect(result.contents).toHaveLength(1);
      const status = JSON.parse(result.contents[0].text || '{}');
      expect(status.status).toBe('running');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('memory');
    });
  });
});

describe('Agent Integration', () => {
  it('should initialize and execute workflow', async () => {
    const agent = new SimpleAgent();

    await agent.initialize('node', ['dist/server/index.js']);
    await agent.executeWorkflow();
    await agent.shutdown();

    // If we get here without errors, the test passes
    expect(true).toBe(true);
  });
});
