/**
 * Complete OAuth Flow Integration Test
 *
 * This script tests the entire OAuth 2.0 flow by:
 * 1. Starting an authorization server
 * 2. Starting a resource server (which fetches JWKS from auth server)
 * 3. Running a client that obtains tokens and accesses protected resources
 */

import { AuthorizationServer } from '../../src/auth/authorization-server/server.js';
import { HttpResourceServerTransport } from '../../src/transport/http/resource-server-transport.js';
import { TransportType } from '../../src/transport/base.js';
import { OAuthClient } from '../../src/auth/client/oauth-client.js';
import { protectResource } from '../../src/auth/resource-server/middleware.js';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Complete OAuth 2.0 Flow Integration Test');
  console.log('═══════════════════════════════════════════════════════\n');

  // Step 1: Start Authorization Server
  console.log('Step 1: Starting Authorization Server...');
  const authServer = new AuthorizationServer({
    host: 'localhost',
    port: 4000,
    issuer: 'http://localhost:4000',
    cors: true,
  });

  await authServer.start();
  console.log('✓ Authorization Server running on http://localhost:4000\n');

  // Wait a bit for server to be ready
  await sleep(500);

  // Step 2: Start Resource Server (will fetch JWKS from auth server)
  console.log('Step 2: Starting Resource Server...');
  console.log('  (Resource server will fetch public keys from auth server)\n');

  const resourceServer = new HttpResourceServerTransport('2025-06-18', {
    enabled: true,
    authorizationServer: 'http://localhost:4000',
  });

  await resourceServer.initialize({
    type: TransportType.HTTP,
    host: 'localhost',
    port: 3000,
    cors: true,
  });

  // Add protected endpoints
  const app = resourceServer.getApp();

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
            description: 'Perform mathematical calculations',
            inputSchema: {
              type: 'object',
              properties: {
                expression: { type: 'string', description: 'Math expression to evaluate' },
              },
              required: ['expression'],
            },
          },
          {
            name: 'weather',
            description: 'Get weather information',
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string', description: 'City name or coordinates' },
              },
              required: ['location'],
            },
          },
        ],
      });
    }
  );

  console.log('✓ Resource Server running on http://localhost:3000\n');

  // Wait for resource server to be ready
  await sleep(500);

  // Step 3: Register OAuth Client
  console.log('Step 3: Registering OAuth Client...');
  const registerResponse = await fetch('http://localhost:4000/oauth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Integration Test Client',
      client_type: 'confidential',
      redirect_uris: ['http://localhost:8080/callback'],
      grant_types: ['client_credentials', 'authorization_code', 'refresh_token'],
      scope: 'mcp.tools.read mcp.tools.execute',
    }),
  });

  if (!registerResponse.ok) {
    throw new Error(`Client registration failed: ${registerResponse.statusText}`);
  }

  const clientInfo = await registerResponse.json() as any;
  console.log('✓ Client registered');
  console.log('  Client ID:', clientInfo.client_id);
  console.log('  Client Type:', clientInfo.client_type);
  console.log('  Scopes:', clientInfo.scope);
  console.log('');

  // Step 4: Create OAuth Client
  console.log('Step 4: Creating OAuth Client instance...');
  const client = new OAuthClient({
    clientId: clientInfo.client_id,
    clientSecret: clientInfo.client_secret,
    authorizationServer: 'http://localhost:4000',
    scopes: ['mcp.tools.read', 'mcp.tools.execute'],
    resources: ['mcp://tools'],
  });
  console.log('✓ OAuth Client created\n');

  // Step 5: Obtain Access Token
  console.log('Step 5: Obtaining access token (client credentials)...');
  const tokens = await client.getClientCredentialsToken('mcp.tools.read', 'mcp://tools');

  console.log('✓ Access token obtained');
  console.log('  Token Type:', tokens.token_type);
  console.log('  Expires In:', tokens.expires_in, 'seconds');
  console.log('  Scopes:', tokens.scope);
  console.log('  Resources:', tokens.resource);
  console.log('  Token Preview:', tokens.access_token.substring(0, 60) + '...');

  // Decode token to show payload
  const tokenParts = tokens.access_token.split('.');
  if (tokenParts.length === 3) {
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    console.log('  Token Payload:');
    console.log('    Issuer:', payload.iss);
    console.log('    Subject:', payload.sub);
    console.log('    Client ID:', payload.client_id);
    console.log('    Scopes:', payload.scope);
    console.log('    Resources:', payload.resource);
    console.log('    Issued At:', new Date(payload.iat * 1000).toISOString());
    console.log('    Expires At:', new Date(payload.exp * 1000).toISOString());
    console.log('    JWT ID:', payload.jti);
  }
  console.log('');

  // Step 6: Access Protected Resource
  console.log('Step 6: Accessing protected MCP resource...');
  const response = await client.fetch('http://localhost:3000/mcp/tools');

  if (!response.ok) {
    const error = await response.json() as any;
    console.error('✗ Failed to access resource!');
    console.error('  Status:', response.status, response.statusText);
    console.error('  Error:', error);
    console.error('');
    console.error('This indicates the resource server could not validate the token.');
    console.error('Check that JWKS fetching is working correctly.');
    throw new Error('Resource access failed');
  }

  const tools = await response.json() as any;
  console.log('✓ Successfully accessed protected resource!');
  console.log('  Endpoint: GET /mcp/tools');
  console.log('  Response:');
  console.log(JSON.stringify(tools, null, 4));
  console.log('');

  // Step 7: Verify token validation
  console.log('Step 7: Verifying token introspection...');
  const introspectResponse = await fetch('http://localhost:4000/oauth/introspect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens.access_token}`,
    },
    body: JSON.stringify({
      token: tokens.access_token,
    }),
  });

  if (introspectResponse.ok) {
    const introspection = await introspectResponse.json() as any;
    console.log('✓ Token introspection successful');
    console.log('  Active:', introspection.active);
    console.log('  Client ID:', introspection.client_id);
    console.log('  Scopes:', introspection.scope);
    console.log('  Token Type:', introspection.token_type);
  }
  console.log('');

  // Success!
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ Complete OAuth Flow Test PASSED');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('Summary:');
  console.log('  ✓ Authorization Server issued tokens');
  console.log('  ✓ Resource Server fetched JWKS and validated tokens');
  console.log('  ✓ Client obtained tokens and accessed protected resources');
  console.log('  ✓ All three OAuth roles working correctly!');
  console.log('');

  // Cleanup
  console.log('Cleaning up...');
  await resourceServer.close();
  await authServer.stop();
  console.log('✓ Servers stopped');
  console.log('');

  process.exit(0);
}

main().catch(async (error) => {
  console.error('\n✗ Test Failed!');
  console.error('Error:', error.message);
  console.error('');
  process.exit(1);
});
