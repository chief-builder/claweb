/**
 * MCP Protocol Version Compliance Tests
 *
 * Tests for protocol version handling and negotiation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPClient } from '../../src/client/index.js';

describe('MCP Protocol Version Compliance', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = new MCPClient();
    await client.connect('node', ['dist/server/index.js']);
  });

  afterAll(async () => {
    await client.disconnect();
  });

  describe('Server Version', () => {
    it('should report correct protocol version in config', async () => {
      const result = await client.readResource('config://server');
      const content = result.contents[0];
      const configText = 'text' in content ? content.text : '{}';
      const config = JSON.parse(configText);

      expect(config.server.protocolVersion).toBe('2025-06-18');
    });

    it('should report correct server version', async () => {
      const result = await client.readResource('config://server');
      const content = result.contents[0];
      const configText = 'text' in content ? content.text : '{}';
      const config = JSON.parse(configText);

      expect(config.server.version).toBe('2.0.0');
    });
  });

  describe('Feature Flags', () => {
    it('should report structured output support', async () => {
      const result = await client.readResource('config://server');
      const content = result.contents[0];
      const configText = 'text' in content ? content.text : '{}';
      const config = JSON.parse(configText);

      expect(config.features.structuredOutput).toBe(true);
    });

    it('should report resource links support', async () => {
      const result = await client.readResource('config://server');
      const content = result.contents[0];
      const configText = 'text' in content ? content.text : '{}';
      const config = JSON.parse(configText);

      expect(config.features.resourceLinks).toBe(true);
    });

    it('should report metadata support', async () => {
      const result = await client.readResource('config://server');
      const content = result.contents[0];
      const configText = 'text' in content ? content.text : '{}';
      const config = JSON.parse(configText);

      expect(config.features.metadata).toBe(true);
    });
  });

  describe('Capabilities', () => {
    it('should report tools capability', async () => {
      const result = await client.readResource('config://server');
      const content = result.contents[0];
      const configText = 'text' in content ? content.text : '{}';
      const config = JSON.parse(configText);

      expect(config.capabilities.tools).toBe(true);
    });

    it('should report resources capability', async () => {
      const result = await client.readResource('config://server');
      const content = result.contents[0];
      const configText = 'text' in content ? content.text : '{}';
      const config = JSON.parse(configText);

      expect(config.capabilities.resources).toBe(true);
    });

    it('should report prompts capability', async () => {
      const result = await client.readResource('config://server');
      const content = result.contents[0];
      const configText = 'text' in content ? content.text : '{}';
      const config = JSON.parse(configText);

      expect(config.capabilities.prompts).toBe(true);
    });
  });

  describe('Tool Count', () => {
    it('should expose expected number of tools', async () => {
      const tools = await client.listTools();

      // MCP reference server has 4 tools
      expect(tools.length).toBe(4);
    });

    it('should expose all core tools', async () => {
      const tools = await client.listTools();
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain('calculator');
      expect(toolNames).toContain('echo');
      expect(toolNames).toContain('get_current_time');
      expect(toolNames).toContain('get_server_logs');
    });
  });

  describe('Resource Count', () => {
    it('should expose expected number of resources', async () => {
      const resources = await client.listResources();

      // MCP reference server has 2 resources
      expect(resources.length).toBe(2);
    });

    it('should expose all core resources', async () => {
      const resources = await client.listResources();
      const uris = resources.map((r) => r.uri);

      expect(uris).toContain('config://server');
      expect(uris).toContain('status://server');
    });
  });
});
