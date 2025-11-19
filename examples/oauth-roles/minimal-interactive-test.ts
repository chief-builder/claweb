/**
 * Minimal Interactive Test - Exactly mimics test-interactive-flow.ts
 * but with detailed logging to diagnose the issue
 */

import { AuthorizationServer } from '../../src/auth/authorization-server/server.js';
import { OAuthClient } from '../../src/auth/client/oauth-client.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('\n=== Minimal Interactive Test ===\n');

  // Step 1: Create server exactly like test-interactive-flow.ts
  console.log('Creating Authorization Server...');
  const authServer = new AuthorizationServer({
    host: 'localhost',
    port: 4000,
    issuer: 'http://localhost:4000',
    cors: true,
    staticFilesPath: path.join(__dirname, 'static'),
    interactiveConsent: true, // THIS SHOULD TRIGGER CONSENT PAGE
  });

  console.log('  interactiveConsent:', (authServer as any).config.interactiveConsent);
  console.log('  auth0Bridge:', (authServer as any).auth0Bridge);

  await authServer.start();
  console.log('✓ Server started\n');

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Step 2: Register a client
  console.log('Registering OAuth client...');
  const registerResponse = await fetch('http://localhost:4000/oauth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Test Client',
      redirect_uris: ['http://localhost:8080/callback'],
      grant_types: ['authorization_code'],
      scope: 'mcp.tools.read',
    }),
  });

  const clientData = await registerResponse.json();
  console.log('✓ Client registered:', clientData.client_id.substring(0, 20) + '...\n');

  // Step 3: Create OAuth client
  console.log('Creating OAuth client...');
  const client = new OAuthClient({
    clientId: clientData.client_id,
    authorizationServer: 'http://localhost:4000',
  });

  const authUrl = await client.getAuthorizationUrl({
    redirectUri: 'http://localhost:8080/callback',
    scope: 'mcp.tools.read',
    state: 'test_state',
  });

  console.log('✓ Authorization URL generated');
  console.log('  URL:', authUrl);
  console.log('');

  // Step 4: Make request to /oauth/authorize
  console.log('Making request to /oauth/authorize...');
  console.log('  This should trigger the debug logs if tsx is loading new code');
  console.log('');

  const authResponse = await fetch(authUrl, {
    redirect: 'manual', // Don't follow redirects
  });

  console.log('Response received:');
  console.log('  Status:', authResponse.status);
  console.log('  Location:', authResponse.headers.get('location'));
  console.log('');

  const location = authResponse.headers.get('location');
  if (location?.includes('/static/consent.html')) {
    console.log('✅ SUCCESS: Redirected to consent page!');
    console.log('   Interactive consent is working correctly');
  } else if (location?.includes('callback?code=')) {
    console.log('❌ FAILURE: Auto-approved instead of showing consent');
    console.log('   This means interactiveConsent is not being respected');
    console.log('');
    console.log('   Check above for debug logs:');
    console.log('   - Should see: [AuthServer] GET /oauth/authorize');
    console.log('   - Should see: [OAuth] ===== AUTHORIZATION ENDPOINT CALLED (VERSION 2024-01-19) =====');
    console.log('   - Should see: [OAuth] config.interactiveConsent: true');
    console.log('   - Should see: [OAuth] Interactive consent enabled, redirecting to consent page');
  } else {
    console.log('❓ UNEXPECTED: Got different redirect:', location);
  }

  console.log('');
  await authServer.stop();
  console.log('✓ Server stopped\n');
}

main().catch(console.error);
