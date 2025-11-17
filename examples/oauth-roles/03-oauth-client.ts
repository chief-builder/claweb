/**
 * Example: MCP Client with OAuth 2.0
 *
 * This client:
 * - Obtains access tokens from the authorization server
 * - Uses tokens to access protected MCP resources
 * - Handles token refresh
 *
 * It does NOT serve resources or issue tokens.
 */

import { OAuthClient } from '../../src/auth/client/oauth-client.js';

async function main() {
  console.log('MCP OAuth Client Example\n');

  // Step 1: Register a client (normally done once)
  console.log('Step 1: Registering client with authorization server...');
  const registerResponse = await fetch('http://localhost:4000/oauth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Example MCP Client',
      client_type: 'confidential',
      redirect_uris: ['http://localhost:8080/callback'],
      grant_types: ['authorization_code', 'client_credentials', 'refresh_token'],
      scope: 'mcp.tools.read mcp.tools.execute',
    }),
  });

  const clientInfo = await registerResponse.json();
  console.log('✓ Client registered:', clientInfo.client_id);
  console.log('');

  // Step 2: Create OAuth client
  const client = new OAuthClient({
    clientId: clientInfo.client_id,
    clientSecret: clientInfo.client_secret,
    authorizationServer: 'http://localhost:4000',
    redirectUri: 'http://localhost:8080/callback',
    scopes: ['mcp.tools.read', 'mcp.tools.execute'],
    resources: ['mcp://tools'],
  });

  // Step 3: Discover authorization server
  console.log('Step 2: Discovering authorization server...');
  const discovery = await client.discover();
  console.log('✓ Authorization server:', discovery.issuer);
  console.log('✓ Supports grant types:', discovery.grant_types_supported);
  console.log('✓ Supports PKCE:', discovery.code_challenge_methods_supported);
  console.log('✓ Supports RFC 8707:', discovery.resource_indicators_supported);
  console.log('');

  // Step 4: Get token using client credentials (server-to-server)
  console.log('Step 3: Obtaining access token (client credentials grant)...');
  const tokens = await client.getClientCredentialsToken(
    'mcp.tools.read',
    'mcp://tools'
  );
  console.log('✓ Access token obtained');
  console.log('  Token type:', tokens.token_type);
  console.log('  Expires in:', tokens.expires_in, 'seconds');
  console.log('  Scopes:', tokens.scope);
  console.log('  Resources:', tokens.resource);
  console.log('  Access token (preview):', tokens.access_token.substring(0, 50) + '...');

  // Decode JWT to show payload (for demonstration)
  try {
    const parts = tokens.access_token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      console.log('  Token payload:', JSON.stringify(payload, null, 4));
    }
  } catch (e) {
    // Ignore decode errors
  }
  console.log('');

  // Step 5: Access protected MCP resource
  console.log('Step 4: Accessing protected MCP resource...');
  const response = await client.fetch('http://localhost:3000/mcp/tools');

  if (response.ok) {
    const tools = await response.json();
    console.log('✓ Successfully accessed /mcp/tools');
    console.log('  Tools:', JSON.stringify(tools, null, 2));
  } else {
    console.log('✗ Failed to access resource:', response.statusText);
    const error = await response.json();
    console.log('  Error:', error);
  }
  console.log('');

  // Step 6: Authorization Code Flow example (for user interaction)
  console.log('═══════════════════════════════════════════════════════');
  console.log('Authorization Code Flow Example (for web/mobile apps):');
  console.log('═══════════════════════════════════════════════════════');
  const authUrl = client.generateAuthorizationUrl({
    scope: 'mcp.tools.read mcp.tools.execute',
    resource: 'mcp://tools',
  });
  console.log('');
  console.log('1. Direct user to authorization URL:');
  console.log('   ', authUrl.url);
  console.log('');
  console.log('2. User authorizes and is redirected back with code');
  console.log('');
  console.log('3. Exchange code for tokens:');
  console.log('   const tokens = await client.exchangeAuthorizationCode(code, authUrl.pkce);');
  console.log('');
  console.log('4. Use tokens to access resources:');
  console.log('   const response = await client.fetch("http://localhost:3000/mcp/tools");');
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  console.log('✓ Example completed successfully');
  console.log('');
  console.log('Summary:');
  console.log('  • Authorization Server issues tokens: http://localhost:4000');
  console.log('  • Resource Server validates tokens: http://localhost:3000');
  console.log('  • Client obtains and uses tokens');
}

main().catch((error) => {
  console.error('\n✗ Error:', error.message);
  console.error('');
  console.error('Make sure both servers are running:');
  console.error('  1. Authorization Server: npm run example:oauth:auth-server');
  console.error('  2. Resource Server: npm run example:oauth:resource-server');
  process.exit(1);
});
