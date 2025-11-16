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

      expect(tools).toHaveLength(4);
      expect(tools.map((t) => t.name)).toContain('calculator');
      expect(tools.map((t) => t.name)).toContain('echo');
      expect(tools.map((t) => t.name)).toContain('get_current_time');
      expect(tools.map((t) => t.name)).toContain('get_server_logs');
    });

    it('should include display names (title) for all tools', async () => {
      const tools = await client.listTools();

      // MCP 2025-06-18: All tools should have title field
      tools.forEach((tool) => {
        expect(tool).toHaveProperty('title');
        expect(tool.title).toBeTruthy();
      });

      // Verify specific titles
      const calculator = tools.find((t) => t.name === 'calculator');
      console.log(`      → Tool titles: ${tools.map(t => `"${t.title}"`).join(', ')}`);
      expect(calculator?.title).toBe('Calculator');
    });

    it('should include output schemas for all tools', async () => {
      const tools = await client.listTools();

      // MCP 2025-06-18: All tools should have outputSchema field
      tools.forEach((tool) => {
        expect(tool).toHaveProperty('outputSchema');
        expect(tool.outputSchema).toBeTruthy();
        expect(tool.outputSchema).toHaveProperty('type');
      });
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
      console.log(`      → Result: ${data.a} + ${data.b} = ${data.result}`);
      expect(data.result).toBe(15);
    });

    it('should return structured output (MCP 2025-06-18)', async () => {
      const result = await client.callTool('calculator', {
        operation: 'add',
        a: 10,
        b: 5,
      });

      // MCP 2025-06-18: Verify structuredContent field
      expect(result).toHaveProperty('structuredContent');
      expect(result.structuredContent).toBeTruthy();

      const structured = result.structuredContent;
      console.log(`      → Structured output: ${structured.expression}`);
      expect(structured).toHaveProperty('operation', 'add');
      expect(structured).toHaveProperty('a', 10);
      expect(structured).toHaveProperty('b', 5);
      expect(structured).toHaveProperty('result', 15);
      expect(structured).toHaveProperty('expression', '10 + 5 = 15');
      expect(structured).toHaveProperty('timestamp');
    });

    it('should subtract two numbers', async () => {
      const result = await client.callTool('calculator', {
        operation: 'subtract',
        a: 10,
        b: 5,
      });

      const data = JSON.parse(result.content[0].text);
      console.log(`      → Result: ${data.a} - ${data.b} = ${data.result}`);
      expect(data.result).toBe(5);
    });

    it('should multiply two numbers', async () => {
      const result = await client.callTool('calculator', {
        operation: 'multiply',
        a: 10,
        b: 5,
      });

      const data = JSON.parse(result.content[0].text);
      console.log(`      → Result: ${data.a} × ${data.b} = ${data.result}`);
      expect(data.result).toBe(50);
    });

    it('should divide two numbers', async () => {
      const result = await client.callTool('calculator', {
        operation: 'divide',
        a: 10,
        b: 5,
      });

      const data = JSON.parse(result.content[0].text);
      console.log(`      → Result: ${data.a} ÷ ${data.b} = ${data.result}`);
      expect(data.result).toBe(2);
    });

    it('should handle division by zero', async () => {
      const result = await client.callTool('calculator', {
        operation: 'divide',
        a: 10,
        b: 0,
      });

      console.log(`      → Error handled: ${result.content[0].text}`);
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

      console.log(`      → Echoed: "${result.content[0].text}"`);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe(testMessage);
    });

    it('should return structured output with metadata', async () => {
      const testMessage = 'Hello, MCP 2025-06-18!';
      const result = await client.callTool('echo', {
        message: testMessage,
      });

      // MCP 2025-06-18: Verify structuredContent
      expect(result.structuredContent).toBeTruthy();
      console.log(`      → Structured: message="${result.structuredContent.message}", length=${result.structuredContent.length}`);
      expect(result.structuredContent).toHaveProperty('message', testMessage);
      expect(result.structuredContent).toHaveProperty('length', testMessage.length);
      expect(result.structuredContent).toHaveProperty('timestamp');
    });
  });

  describe('Current Time Tool', () => {
    it('should return current time', async () => {
      const result = await client.callTool('get_current_time', {});

      expect(result.content).toHaveLength(1);
      const data = JSON.parse(result.content[0].text);
      console.log(`      → Current time: ${data.timestamp} (${data.timezone})`);
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('timezone');
      expect(data).toHaveProperty('unix');
    });

    it('should handle custom timezone', async () => {
      const result = await client.callTool('get_current_time', {
        timezone: 'America/New_York',
      });

      const data = JSON.parse(result.content[0].text);
      console.log(`      → Time in ${data.timezone}: ${data.formatted}`);
      expect(data.timezone).toBe('America/New_York');
    });

    it('should return structured output with all time fields', async () => {
      const result = await client.callTool('get_current_time', {});

      // MCP 2025-06-18: Verify structuredContent
      expect(result.structuredContent).toBeTruthy();
      console.log(`      → Structured time fields: ${Object.keys(result.structuredContent).join(', ')}`);
      expect(result.structuredContent).toHaveProperty('timestamp');
      expect(result.structuredContent).toHaveProperty('timezone');
      expect(result.structuredContent).toHaveProperty('formatted');
      expect(result.structuredContent).toHaveProperty('unix');
      expect(result.structuredContent).toHaveProperty('iso8601');
    });
  });

  describe('Get Server Logs Tool', () => {
    it('should return logs with resource links (MCP 2025-06-18)', async () => {
      const result = await client.callTool('get_server_logs', {
        logType: 'access',
        lines: 100,
      });

      // Should have both text and resource content
      expect(result.content.length).toBeGreaterThanOrEqual(1);

      // Find the resource content
      const resourceContent = result.content.find((c) => c.type === 'resource');
      expect(resourceContent).toBeTruthy();

      // MCP 2025-06-18: Verify resource link structure
      if (resourceContent && resourceContent.type === 'resource') {
        console.log(`      → Resource URI: ${resourceContent.resource.uri}`);
        console.log(`      → Resource metadata: logType=${resourceContent.resource._meta.logType}, lines=${resourceContent.resource._meta.lines}`);
        expect(resourceContent.resource).toBeTruthy();
        expect(resourceContent.resource).toHaveProperty('uri');
        expect(resourceContent.resource.uri).toContain('file:///var/log/mcp-server/access.log');
        expect(resourceContent.resource).toHaveProperty('mimeType', 'text/plain');

        // Verify metadata on resource
        expect(resourceContent.resource).toHaveProperty('_meta');
        expect(resourceContent.resource._meta).toHaveProperty('logType', 'access');
        expect(resourceContent.resource._meta).toHaveProperty('lines', 100);
      }
    });

    it('should support different log types', async () => {
      const result = await client.callTool('get_server_logs', {
        logType: 'error',
      });

      const resourceContent = result.content.find((c) => c.type === 'resource');
      if (resourceContent && resourceContent.type === 'resource') {
        console.log(`      → Log type: ${resourceContent.resource._meta.logType}, URI: ${resourceContent.resource.uri}`);
        expect(resourceContent.resource.uri).toContain('file:///var/log/mcp-server/error.log');
      }
    });

    it('should return structured content with metadata', async () => {
      const result = await client.callTool('get_server_logs', {
        logType: 'access',
        lines: 50,
      });

      // MCP 2025-06-18: Verify structuredContent
      expect(result.structuredContent).toBeTruthy();
      expect(result.structuredContent).toHaveProperty('logType', 'access');
      expect(result.structuredContent).toHaveProperty('lines', 50);
      expect(result.structuredContent).toHaveProperty('resourceUri');
      expect(result.structuredContent).toHaveProperty('timestamp');
    });
  });

  describe('Resource Discovery', () => {
    it('should list all available resources', async () => {
      const resources = await client.listResources();

      console.log(`      → Found ${resources.length} resources: ${resources.map(r => r.name).join(', ')}`);
      expect(resources).toHaveLength(2);
      expect(resources.map((r) => r.uri)).toContain('config://server');
      expect(resources.map((r) => r.uri)).toContain('status://server');
    });
  });

  describe('Resource Reading', () => {
    it('should read server config resource', async () => {
      const result = await client.readResource('config://server');

      expect(result.contents).toHaveLength(1);
      const contentItem = result.contents[0];

      // Type guard to access text property
      const configText = 'text' in contentItem ? contentItem.text : '{}';
      const config = JSON.parse(configText);

      console.log(`      → Server: ${config.server.name} v${config.server.version} (MCP ${config.server.protocolVersion})`);
      console.log(`      → Features: structuredOutput=${config.features.structuredOutput}, resourceLinks=${config.features.resourceLinks}, metadata=${config.features.metadata}`);
      expect(config.server.name).toBe('mcp-reference-server');
      expect(config.server.version).toBe('2.0.0');
      expect(config.server.protocolVersion).toBe('2025-06-18');
      expect(config.capabilities.tools).toBe(true);
      expect(config.features.structuredOutput).toBe(true);
      expect(config.features.resourceLinks).toBe(true);
      expect(config.features.metadata).toBe(true);
    });

    it('should read server config with metadata (MCP 2025-06-18)', async () => {
      const result = await client.readResource('config://server');

      const contentItem = result.contents[0];

      // MCP 2025-06-18: Verify _meta field
      expect(contentItem).toHaveProperty('_meta');
      if ('_meta' in contentItem) {
        console.log(`      → Config metadata: version=${contentItem._meta.version}, static=${contentItem._meta.static}`);
        expect(contentItem._meta).toHaveProperty('generatedAt');
        expect(contentItem._meta).toHaveProperty('version', '2.0.0');
        expect(contentItem._meta).toHaveProperty('static', true);
      }
    });

    it('should read server status resource', async () => {
      const result = await client.readResource('status://server');

      expect(result.contents).toHaveLength(1);
      const contentItem = result.contents[0];

      const statusText = 'text' in contentItem ? contentItem.text : '{}';
      const status = JSON.parse(statusText);

      console.log(`      → Status: ${status.status}, Uptime: ${status.uptime.formatted}`);
      console.log(`      → Memory: ${Math.round(status.memory.heapUsed / 1024 / 1024)}MB used / ${Math.round(status.memory.heapTotal / 1024 / 1024)}MB total`);
      expect(status.status).toBe('running');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('memory');
    });

    it('should read server status with metadata', async () => {
      const result = await client.readResource('status://server');

      const contentItem = result.contents[0];

      // MCP 2025-06-18: Verify _meta field
      expect(contentItem).toHaveProperty('_meta');
      if ('_meta' in contentItem) {
        expect(contentItem._meta).toHaveProperty('generatedAt');
        expect(contentItem._meta).toHaveProperty('version', '2.0.0');
        expect(contentItem._meta).toHaveProperty('static', false);
        expect(contentItem._meta).toHaveProperty('cacheControl', 'no-cache');
      }
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
