/**
 * OAuth Edge Cases and Error Handling Test
 *
 * Verifies that the OAuth implementation properly handles:
 * - Invalid tokens
 * - Missing authentication
 * - Insufficient scopes
 * - Invalid resource indicators
 */

import { AuthorizationServer } from '../../src/auth/authorization-server/server.js';
import { HttpResourceServerTransport } from '../../src/transport/http/resource-server-transport.js';
import { TransportType } from '../../src/transport/base.js';
import { protectResource } from '../../src/auth/resource-server/middleware.js';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('OAuth Edge Cases & Error Handling Test');
  console.log('═══════════════════════════════════════════════════════\n');

  // Start servers
  const authServer = new AuthorizationServer({
    host: 'localhost',
    port: 4000,
    issuer: 'http://localhost:4000',
    cors: true,
  });

  await authServer.start();
  await sleep(500);

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

  const app = resourceServer.getApp();
  app.get(
    '/mcp/tools',
    protectResource({
      requiredScopes: ['mcp.tools.read'],
      requiredResource: 'mcp://tools',
    }),
    (req, res) => {
      res.json({ tools: ['calculator'] });
    }
  );

  await sleep(500);

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Missing Authorization header
  console.log('Test 1: Access without token (should fail with 401)...');
  try {
    const response = await fetch('http://localhost:3000/mcp/tools');
    if (response.status === 401) {
      const error = await response.json() as any;
      console.log('✓ Correctly rejected (401)');
      console.log('  Error:', error.error);
      console.log('  Description:', error.error_description);
      passedTests++;
    } else {
      console.log('✗ Expected 401, got:', response.status);
      failedTests++;
    }
  } catch (e) {
    console.log('✗ Request failed:', (e as Error).message);
    failedTests++;
  }
  console.log('');

  // Test 2: Invalid token format
  console.log('Test 2: Invalid token format (should fail with 401)...');
  try {
    const response = await fetch('http://localhost:3000/mcp/tools', {
      headers: { 'Authorization': 'Bearer not-a-valid-jwt' },
    });
    if (response.status === 401) {
      const error = await response.json() as any;
      console.log('✓ Correctly rejected invalid token');
      console.log('  Error:', error.error);
      console.log('  Description:', error.error_description);
      passedTests++;
    } else {
      console.log('✗ Expected 401, got:', response.status);
      failedTests++;
    }
  } catch (e) {
    console.log('✗ Request failed:', (e as Error).message);
    failedTests++;
  }
  console.log('');

  // Test 3: Get valid token, then test with correct scopes
  console.log('Test 3: Valid token with correct scopes (should succeed)...');
  try {
    // Register client
    const clientResponse = await fetch('http://localhost:4000/oauth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Edge Test Client',
        client_type: 'confidential',
        grant_types: ['client_credentials'],
        scope: 'mcp.tools.read',
      }),
    });
    const clientInfo = await clientResponse.json() as any;

    // Get token
    const tokenResponse = await fetch('http://localhost:4000/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientInfo.client_id,
        client_secret: clientInfo.client_secret,
        scope: 'mcp.tools.read',
        resource: 'mcp://tools',
      }),
    });
    const tokens = await tokenResponse.json() as any;

    // Access resource
    const response = await fetch('http://localhost:3000/mcp/tools', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✓ Successfully accessed resource');
      console.log('  Data:', JSON.stringify(data));
      passedTests++;
    } else {
      console.log('✗ Expected 200, got:', response.status);
      const error = await response.json();
      console.log('  Error:', error);
      failedTests++;
    }
  } catch (e) {
    console.log('✗ Test failed:', (e as Error).message);
    failedTests++;
  }
  console.log('');

  // Test 4: Token with wrong scope
  console.log('Test 4: Token with insufficient scope (should fail with 403)...');
  try {
    // Register client with different scope
    const clientResponse = await fetch('http://localhost:4000/oauth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Wrong Scope Client',
        client_type: 'confidential',
        grant_types: ['client_credentials'],
        scope: 'mcp.resources.read', // Wrong scope!
      }),
    });
    const clientInfo = await clientResponse.json() as any;

    // Get token with wrong scope
    const tokenResponse = await fetch('http://localhost:4000/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientInfo.client_id,
        client_secret: clientInfo.client_secret,
        scope: 'mcp.resources.read', // Wrong scope!
        resource: 'mcp://tools',
      }),
    });
    const tokens = await tokenResponse.json() as any;

    // Try to access resource (should fail)
    const response = await fetch('http://localhost:3000/mcp/tools', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });

    if (response.status === 403) {
      const error = await response.json() as any;
      console.log('✓ Correctly rejected insufficient scope');
      console.log('  Error:', error.error);
      console.log('  Description:', error.error_description);
      passedTests++;
    } else {
      console.log('✗ Expected 403, got:', response.status);
      failedTests++;
    }
  } catch (e) {
    console.log('✗ Test failed:', (e as Error).message);
    failedTests++;
  }
  console.log('');

  // Test 5: Token with wrong resource
  console.log('Test 5: Token with wrong resource indicator (should fail with 403)...');
  try {
    // Register client
    const clientResponse = await fetch('http://localhost:4000/oauth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Wrong Resource Client',
        client_type: 'confidential',
        grant_types: ['client_credentials'],
        scope: 'mcp.tools.read',
      }),
    });
    const clientInfo = await clientResponse.json() as any;

    // Get token for wrong resource
    const tokenResponse = await fetch('http://localhost:4000/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientInfo.client_id,
        client_secret: clientInfo.client_secret,
        scope: 'mcp.tools.read',
        resource: 'mcp://admin', // Wrong resource!
      }),
    });
    const tokens = await tokenResponse.json() as any;

    // Try to access resource (should fail)
    const response = await fetch('http://localhost:3000/mcp/tools', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });

    if (response.status === 403) {
      const error = await response.json() as any;
      console.log('✓ Correctly rejected wrong resource');
      console.log('  Error:', error.error);
      console.log('  Description:', error.error_description);
      passedTests++;
    } else {
      console.log('✗ Expected 403, got:', response.status);
      failedTests++;
    }
  } catch (e) {
    console.log('✗ Test failed:', (e as Error).message);
    failedTests++;
  }
  console.log('');

  // Cleanup
  await resourceServer.close();
  await authServer.stop();

  // Results
  console.log('═══════════════════════════════════════════════════════');
  if (failedTests === 0) {
    console.log('✅ All Edge Case Tests Passed!');
  } else {
    console.log('⚠️  Some Tests Failed');
  }
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Passed: ${passedTests}/5`);
  console.log(`  Failed: ${failedTests}/5`);
  console.log('');

  console.log('Error Handling Summary:');
  console.log('  ✓ Missing authentication → 401 Unauthorized');
  console.log('  ✓ Invalid token format → 401 Unauthorized');
  console.log('  ✓ Valid credentials → 200 OK');
  console.log('  ✓ Insufficient scope → 403 Forbidden');
  console.log('  ✓ Wrong resource → 403 Forbidden');
  console.log('');

  process.exit(failedTests > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('\n✗ Test suite failed:', error.message);
  process.exit(1);
});
