/**
 * Example: OAuth 2.0 Authorization Server
 *
 * This server is responsible for:
 * - Issuing access tokens
 * - Client registration
 * - Token introspection
 * - JWKS distribution
 *
 * It does NOT serve MCP resources.
 */

import { AuthorizationServer } from '../../src/auth/authorization-server/server.js';

async function main() {
  console.log('Starting OAuth 2.0 Authorization Server...\n');

  // Create authorization server
  const authServer = new AuthorizationServer({
    host: 'localhost',
    port: 4000,
    issuer: 'http://localhost:4000',
    cors: true,
  });

  await authServer.start();

  const info = authServer.getInfo();
  console.log('\n📋 Authorization Server Endpoints:');
  console.log('  Discovery:', info.endpoints.discovery);
  console.log('  JWKS:', info.endpoints.jwks);
  console.log('  Authorize:', info.endpoints.authorize);
  console.log('  Token:', info.endpoints.token);
  console.log('  Register:', info.endpoints.register);
  console.log('  Introspect:', info.endpoints.introspect);
  console.log('  Resources:', info.endpoints.resources);
  console.log('');
  console.log('💡 This server issues tokens for use at MCP Resource Servers');
  console.log('💡 It does NOT serve MCP resources');
  console.log('');
  console.log('Try:');
  console.log('  curl http://localhost:4000/.well-known/oauth-authorization-server');
  console.log('  curl http://localhost:4000/oauth/jwks');
  console.log('');

  // Keep running
  process.on('SIGINT', async () => {
    console.log('\nShutting down authorization server...');
    await authServer.stop();
    process.exit(0);
  });
}

main().catch(console.error);
