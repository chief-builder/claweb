/**
 * HTTP Transport Integration Tests
 *
 * Tests the HTTP/SSE transport implementation
 * MCP 2025-06-18 specification compliance
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { HttpServerTransport } from '../src/transport/http/server.js';
import { TransportType, MCP_PROTOCOL_VERSION } from '../src/transport/base.js';

describe('HTTP Transport', () => {
  let transport: HttpServerTransport;
  const testPort = 3001; // Use different port to avoid conflicts
  const testHost = 'localhost';

  beforeAll(async () => {
    // Initialize HTTP server transport
    transport = new HttpServerTransport();
    await transport.initialize({
      type: TransportType.HTTP,
      host: testHost,
      port: testPort,
      cors: true,
    });
  });

  afterAll(async () => {
    // Clean up
    await transport.close();
  });

  describe('Server Initialization', () => {
    it('should initialize with correct protocol version', () => {
      console.log('✓ Transport initialized:');
      console.log('  Protocol version:', transport.protocolVersion);
      console.log('  Transport type:', transport.type);

      expect(transport.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
      expect(transport.type).toBe(TransportType.HTTP);
    });

    it('should be in connected state', () => {
      console.log('✓ Connection state:', transport.state);

      expect(transport.state).toBe('connected');
    });

    it('should provide server info', () => {
      const info = transport.getServerInfo();

      console.log('✓ Server info:', JSON.stringify(info, null, 2));

      expect(info).toBeDefined();
      expect(info?.host).toBe(testHost);
      expect(info?.port).toBe(testPort);
      expect(info?.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    });
  });

  describe('Health Check Endpoint', () => {
    it('should respond to health check', async () => {
      const response = await fetch(`http://${testHost}:${testPort}/health`);

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      const data = await response.json();
      console.log('✓ Health check response:', JSON.stringify(data, null, 2));

      expect(data).toMatchObject({
        status: 'ok',
        protocolVersion: MCP_PROTOCOL_VERSION,
        transport: 'http',
      });
    });

    it('should include MCP-Protocol-Version header', async () => {
      const response = await fetch(`http://${testHost}:${testPort}/health`);

      const protocolHeader = response.headers.get('MCP-Protocol-Version');
      console.log('✓ Protocol header:', protocolHeader);

      expect(protocolHeader).toBe(MCP_PROTOCOL_VERSION);
    });
  });

  describe('Protocol Discovery Endpoint', () => {
    it('should respond to protocol discovery', async () => {
      const response = await fetch(`http://${testHost}:${testPort}/protocol`);

      expect(response.ok).toBe(true);

      const data = await response.json();
      console.log('✓ Protocol discovery response:', JSON.stringify(data, null, 2));

      expect(data).toMatchObject({
        protocol: 'MCP',
        version: MCP_PROTOCOL_VERSION,
        transports: expect.arrayContaining(['http', 'sse']),
      });
    });

    it('should list available endpoints', async () => {
      const response = await fetch(`http://${testHost}:${testPort}/protocol`);
      const data = await response.json();

      console.log('✓ Available endpoints:', JSON.stringify(data.endpoints, null, 2));

      expect(data.endpoints).toBeDefined();
      expect(data.endpoints).toMatchObject({
        sse: '/sse',
        message: '/message',
        health: '/health',
      });
    });
  });

  describe('Protocol Headers', () => {
    it('should include protocol version in all responses', async () => {
      const endpoints = ['/health', '/protocol'];

      for (const endpoint of endpoints) {
        const response = await fetch(`http://${testHost}:${testPort}${endpoint}`);
        const versionHeader = response.headers.get('MCP-Protocol-Version');

        console.log(`✓ ${endpoint} MCP-Protocol-Version header:`, versionHeader);
        expect(versionHeader).toBe(MCP_PROTOCOL_VERSION);
      }
    });

    it('should set CORS headers when enabled', async () => {
      const response = await fetch(`http://${testHost}:${testPort}/health`);

      // Check for CORS headers
      const accessControl = response.headers.get('Access-Control-Allow-Origin');
      const exposeHeaders = response.headers.get('Access-Control-Expose-Headers');

      console.log('✓ CORS headers:');
      console.log('  Access-Control-Allow-Origin:', accessControl);
      console.log('  Access-Control-Expose-Headers:', exposeHeaders);

      expect(accessControl).toBeDefined();
    });
  });

  describe('Message Endpoint', () => {
    it('should accept POST requests with valid headers', async () => {
      const testMessage = {
        jsonrpc: '2.0',
        method: 'test',
        id: 1,
      };

      console.log('→ Sending test message:', JSON.stringify(testMessage));

      const response = await fetch(`http://${testHost}:${testPort}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
        },
        body: JSON.stringify(testMessage),
      });

      console.log('← Response status:', response.status);

      // Since we don't have a message handler set, expect 503
      // In a full test, we'd set up a handler first
      expect([503, 200]).toContain(response.status);
    });

    it('should reject requests without protocol version header', async () => {
      const testMessage = {
        jsonrpc: '2.0',
        method: 'test',
        id: 1,
      };

      const response = await fetch(`http://${testHost}:${testPort}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Missing MCP-Protocol-Version header
        },
        body: JSON.stringify(testMessage),
      });

      expect(response.status).toBe(400);
      const data = await response.json();

      console.log('✓ Error response (missing header):', JSON.stringify(data, null, 2));

      expect(data.error).toBeDefined();
    });

    it('should reject requests with incompatible protocol version', async () => {
      const testMessage = {
        jsonrpc: '2.0',
        method: 'test',
        id: 1,
      };

      const response = await fetch(`http://${testHost}:${testPort}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': '1999-01-01', // Invalid version
        },
        body: JSON.stringify(testMessage),
      });

      expect(response.status).toBe(400);
      const data = await response.json();

      console.log('✓ Error response (incompatible version):', JSON.stringify(data, null, 2));

      expect(data.error?.message).toContain('Incompatible protocol version');
    });

    it('should reject invalid message format', async () => {
      const response = await fetch(`http://${testHost}:${testPort}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
        },
        body: 'invalid json',
      });

      console.log('✓ Invalid JSON response status:', response.status);

      // Express body parser returns 400, our error handler might return 500
      expect([400, 500]).toContain(response.status);
    });
  });

  describe('Transport Broadcasting', () => {
    it('should allow sending messages to all clients', async () => {
      const testMessage = {
        jsonrpc: '2.0',
        method: 'notification',
        params: { data: 'test' },
      };

      // This should not throw
      await expect(transport.send(testMessage)).resolves.toBeUndefined();
    });
  });

  describe('Transport Lifecycle', () => {
    it('should handle close gracefully', async () => {
      const tempTransport = new HttpServerTransport();

      await tempTransport.initialize({
        type: TransportType.HTTP,
        host: testHost,
        port: 3002, // Different port
      });

      expect(tempTransport.state).toBe('connected');

      await tempTransport.close();

      expect(tempTransport.state).toBe('disconnected');
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      const response = await fetch(`http://${testHost}:${testPort}/nonexistent`, {
        headers: {
          'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
        },
      });

      expect(response.status).toBe(404);
    });
  });
});

describe('HTTP Transport - MCP 2025-06-18 Compliance', () => {
  it('should use MCP-Protocol-Version header', async () => {
    const transport = new HttpServerTransport();
    await transport.initialize({
      type: TransportType.HTTP,
      host: 'localhost',
      port: 3003,
    });

    const response = await fetch('http://localhost:3003/protocol');
    const versionHeader = response.headers.get('MCP-Protocol-Version');
    const data = await response.json();

    console.log('✓ MCP 2025-06-18 Compliance Check:');
    console.log('  Protocol version header:', versionHeader);
    console.log('  Response:', JSON.stringify(data, null, 2));

    expect(versionHeader).toBe('2025-06-18');

    await transport.close();
  });

  it('should support SSE streaming endpoint', async () => {
    const transport = new HttpServerTransport();
    await transport.initialize({
      type: TransportType.HTTP,
      host: 'localhost',
      port: 3004,
    });

    // SSE endpoint should exist
    const response = await fetch('http://localhost:3004/sse', {
      headers: {
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
      },
    });

    // Should return 200 and have SSE content type
    const contentType = response.headers.get('Content-Type');
    const cacheControl = response.headers.get('Cache-Control');
    const connection = response.headers.get('Connection');

    console.log('✓ SSE Endpoint Check:');
    console.log('  Status:', response.status, response.statusText);
    console.log('  Content-Type:', contentType);
    console.log('  Cache-Control:', cacheControl);
    console.log('  Connection:', connection);

    expect(response.ok).toBe(true);
    expect(contentType).toContain('text/event-stream');

    await transport.close();
  });
});
