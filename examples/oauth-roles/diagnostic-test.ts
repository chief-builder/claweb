/**
 * Diagnostic test to verify tsx is loading the correct code
 */

import { AuthorizationServer } from '../../src/auth/authorization-server/server.js';

console.log('=== TSX Code Loading Diagnostic ===\n');

// Create a test server to verify the code is loaded
const server = new AuthorizationServer({
  host: 'localhost',
  port: 4001,
  issuer: 'http://localhost:4001',
  interactiveConsent: true,
});

console.log('✓ Authorization Server instance created');
console.log('  Config interactiveConsent:', (server as any).config.interactiveConsent);
console.log('  Config auth0:', !!(server as any).config.auth0);
console.log('');

// Start the server briefly
try {
  await server.start();
  console.log('✓ Server started on port 4001');
  console.log('');
  console.log('Now testing if debug logs appear...');
  console.log('Making a test request to /oauth/authorize...\n');

  // Make a test request
  const response = await fetch(
    'http://localhost:4001/oauth/authorize?response_type=code&client_id=test&redirect_uri=http://localhost/callback',
    { redirect: 'manual' }
  );

  console.log('\nResponse status:', response.status);
  console.log('');
  console.log('Check above for the debug marker:');
  console.log('  [OAuth] ===== AUTHORIZATION ENDPOINT CALLED (VERSION 2024-01-19) =====');
  console.log('');
  console.log('If you see it, tsx is loading the new code.');
  console.log('If you don\'t see it, tsx has a persistent cache issue.');

  await server.stop();
  console.log('\n✓ Server stopped');
  process.exit(0);
} catch (error) {
  console.error('✗ Error:', error);
  await server.stop();
  process.exit(1);
}
