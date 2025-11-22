/**
 * MCP 2025-06-18 Compliance Tests: Resource Metadata
 *
 * Tests for the resource metadata feature introduced in MCP 2025-06-18.
 * Resources should include _meta field with generation info and cache control.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPClient } from '../../src/client/index.js';

describe('MCP 2025-06-18 Compliance: Resource Metadata', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = new MCPClient();
    await client.connect('node', ['dist/server/index.js']);
  });

  afterAll(async () => {
    await client.disconnect();
  });

  describe('Resource Discovery', () => {
    it('should list available resources', async () => {
      const resources = await client.listResources();

      expect(resources.length).toBeGreaterThanOrEqual(2);
      expect(resources.map((r) => r.uri)).toContain('config://server');
      expect(resources.map((r) => r.uri)).toContain('status://server');
    });

    it('should include resource names', async () => {
      const resources = await client.listResources();

      for (const resource of resources) {
        expect(resource).toHaveProperty('name');
        expect(resource.name).toBeTruthy();
      }
    });
  });

  describe('Config Resource Metadata', () => {
    it('should include _meta field in config resource', async () => {
      const result = await client.readResource('config://server');
      const content = result.contents[0];

      expect(content).toHaveProperty('_meta');
    });

    it('should have generatedAt timestamp', async () => {
      const result = await client.readResource('config://server');
      const content = result.contents[0];

      expect(content._meta).toHaveProperty('generatedAt');
      expect(typeof content._meta.generatedAt).toBe('string');

      // Should be valid ISO 8601
      const date = new Date(content._meta.generatedAt);
      expect(date.getTime()).not.toBeNaN();
    });

    it('should have version field', async () => {
      const result = await client.readResource('config://server');
      const content = result.contents[0];

      expect(content._meta).toHaveProperty('version');
      expect(content._meta.version).toBe('2.0.0');
    });

    it('should indicate static resource', async () => {
      const result = await client.readResource('config://server');
      const content = result.contents[0];

      expect(content._meta).toHaveProperty('static');
      expect(content._meta.static).toBe(true);
    });
  });

  describe('Status Resource Metadata', () => {
    it('should include _meta field in status resource', async () => {
      const result = await client.readResource('status://server');
      const content = result.contents[0];

      expect(content).toHaveProperty('_meta');
    });

    it('should indicate dynamic resource', async () => {
      const result = await client.readResource('status://server');
      const content = result.contents[0];

      expect(content._meta).toHaveProperty('static');
      expect(content._meta.static).toBe(false);
    });

    it('should have cache control for dynamic resource', async () => {
      const result = await client.readResource('status://server');
      const content = result.contents[0];

      expect(content._meta).toHaveProperty('cacheControl');
      expect(content._meta.cacheControl).toBe('no-cache');
    });

    it('should have fresh timestamp on each read', async () => {
      const result1 = await client.readResource('status://server');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const result2 = await client.readResource('status://server');

      const time1 = new Date(result1.contents[0]._meta.generatedAt).getTime();
      const time2 = new Date(result2.contents[0]._meta.generatedAt).getTime();

      // Second read should have later timestamp
      expect(time2).toBeGreaterThanOrEqual(time1);
    });
  });

  describe('Resource Content', () => {
    it('should return valid JSON for config resource', async () => {
      const result = await client.readResource('config://server');
      const content = result.contents[0];

      const configText = 'text' in content ? content.text : '{}';
      const config = JSON.parse(configText);

      expect(config).toHaveProperty('server');
      expect(config.server).toHaveProperty('name');
      expect(config.server).toHaveProperty('version');
      expect(config.server).toHaveProperty('protocolVersion');
    });

    it('should return valid JSON for status resource', async () => {
      const result = await client.readResource('status://server');
      const content = result.contents[0];

      const statusText = 'text' in content ? content.text : '{}';
      const status = JSON.parse(statusText);

      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('memory');
    });
  });

  describe('Tool Resource Links', () => {
    it('should include resource metadata in tool output', async () => {
      const result = await client.callTool('get_server_logs', {
        logType: 'access',
        lines: 10,
      });

      const resourceContent = result.content.find((c) => c.type === 'resource');
      expect(resourceContent).toBeDefined();

      if (resourceContent && resourceContent.type === 'resource') {
        expect(resourceContent.resource).toHaveProperty('_meta');
        expect(resourceContent.resource._meta).toHaveProperty('logType');
        expect(resourceContent.resource._meta).toHaveProperty('lines');
      }
    });
  });
});
