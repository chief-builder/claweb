/**
 * Example: MCP Server as OAuth 2.0 Resource Server
 *
 * This server:
 * - Serves MCP resources (tools, prompts, etc.)
 * - Validates access tokens from the authorization server
 * - Enforces scopes and resource indicators
 *
 * It does NOT issue tokens.
 */

import { HttpResourceServerTransport } from '../../src/transport/http/resource-server-transport.js';
import { TransportType } from '../../src/transport/base.js';
import { protectResource } from '../../src/auth/resource-server/middleware.js';

async function main() {
  console.log('Starting MCP Resource Server...\n');

  // Create MCP resource server
  const transport = new HttpResourceServerTransport(
    '2025-06-18',
    {
      enabled: true,
      authorizationServer: 'http://localhost:4000', // Points to auth server
    }
  );

  await transport.initialize({
    type: TransportType.HTTP,
    host: 'localhost',
    port: 3000,
    cors: true,
  });

  // Get Express app to add protected MCP endpoints
  const app = transport.getApp();

  // Protected MCP endpoint example - Tools API
  app.get(
    '/mcp/tools',
    protectResource({
      requiredScopes: ['mcp.tools.read'],
      requiredResource: 'mcp://tools',
    }),
    (req, res) => {
      res.json({
        tools: [
          {
            name: 'calculator',
            description: 'Perform calculations',
            inputSchema: {
              type: 'object',
              properties: {
                expression: { type: 'string' },
              },
            },
          },
        ],
      });
    }
  );

  // Protected MCP endpoint example - Execute Tool
  app.post(
    '/mcp/tools/execute',
    protectResource({
      requiredScopes: ['mcp.tools.execute'],
      requiredResource: 'mcp://tools',
    }),
    (req, res) => {
      const { tool, parameters } = req.body;
      res.json({
        tool,
        result: 'Tool executed successfully',
      });
    }
  );

  console.log('\n📋 MCP Resource Server Endpoints:');
  console.log('  Health: http://localhost:3000/health');
  console.log('  Protocol: http://localhost:3000/protocol');
  console.log('  Tools (protected): http://localhost:3000/mcp/tools');
  console.log('  Execute (protected): http://localhost:3000/mcp/tools/execute');
  console.log('');
  console.log('💡 This server validates tokens from: http://localhost:4000');
  console.log('💡 It does NOT issue tokens');
  console.log('');
  console.log('Try (without token - will fail):');
  console.log('  curl http://localhost:3000/mcp/tools');
  console.log('');
  console.log('Try (with token - will succeed):');
  console.log('  curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/mcp/tools');
  console.log('');

  // Keep running
  process.on('SIGINT', async () => {
    console.log('\nShutting down resource server...');
    await transport.close();
    process.exit(0);
  });
}

main().catch(console.error);
