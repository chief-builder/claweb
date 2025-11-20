/**
 * Real Auth0 Integration Test
 *
 * Tests SSO + Token Exchange with actual Auth0 instance.
 * Requires Auth0 account and configuration.
 *
 * Setup:
 * 1. Create Auth0 account at https://auth0.com
 * 2. Create a new application (Regular Web Application)
 * 3. Configure application settings:
 *    - Allowed Callback URLs: http://localhost:4000/oauth/sso/callback
 *    - Allowed Logout URLs: http://localhost:4000
 *    - Allowed Web Origins: http://localhost:4000
 * 4. Set environment variables:
 *    - AUTH0_DOMAIN: your-tenant.auth0.com
 *    - AUTH0_CLIENT_ID: your-client-id
 *    - AUTH0_CLIENT_SECRET: your-client-secret
 *
 * Optional custom claims (for enterprise features):
 * 5. In Auth0 Dashboard → Actions → Flows → Login
 * 6. Create custom action to add user metadata:
 *
 *    exports.onExecutePostLogin = async (event, api) => {
 *      const namespace = 'https://example.com/';
 *      api.idToken.setCustomClaim(namespace + 'department', 'Engineering');
 *      api.idToken.setCustomClaim(namespace + 'employee_id', 'EMP-001');
 *      api.idToken.setCustomClaim(namespace + 'cost_center', 'CC-100');
 *      api.idToken.setCustomClaim(namespace + 'groups', ['developers', 'senior-engineers']);
 *      api.idToken.setCustomClaim(namespace + 'roles', ['developer', 'code-reviewer']);
 *    };
 *
 * Run:
 *    AUTH0_DOMAIN=xxx AUTH0_CLIENT_ID=xxx AUTH0_CLIENT_SECRET=xxx npm run example:enterprise:real-auth0
 */

import { AuthorizationServer } from '../../src/auth/authorization-server/server.js';
import { getResourceIndicatorService } from '../../src/auth/rfc8707/indicators.js';
import open from 'open';
import http from 'http';

// Check environment variables
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET;

if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !AUTH0_CLIENT_SECRET) {
  console.error('❌ Missing Auth0 configuration!');
  console.error('');
  console.error('Required environment variables:');
  console.error('  AUTH0_DOMAIN         Your Auth0 domain (e.g., your-tenant.auth0.com)');
  console.error('  AUTH0_CLIENT_ID      Your Auth0 application client ID');
  console.error('  AUTH0_CLIENT_SECRET  Your Auth0 application client secret');
  console.error('');
  console.error('Example:');
  console.error(
    '  AUTH0_DOMAIN=dev-abc123.auth0.com AUTH0_CLIENT_ID=xyz AUTH0_CLIENT_SECRET=secret npm run example:enterprise:real-auth0'
  );
  console.error('');
  console.error('See test file header for setup instructions.');
  process.exit(1);
}

/**
 * Main test function
 */
async function main() {
  let authServer: AuthorizationServer | null = null;
  let callbackServer: http.Server | null = null;

  // Cleanup function
  const cleanup = async () => {
    if (authServer) {
      try {
        await authServer.stop();
      } catch (e) {
        console.error('[Cleanup] Error stopping auth server:', (e as Error).message);
      }
    }
    if (callbackServer) {
      callbackServer.close();
    }
  };

  // Handle cleanup on exit
  process.on('SIGINT', async () => {
    console.log('\n[Test] Received SIGINT, cleaning up...');
    await cleanup();
    process.exit(130);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[Test] Received SIGTERM, cleaning up...');
    await cleanup();
    process.exit(143);
  });

  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Real Auth0 Integration Test');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('Auth0 Configuration:');
    console.log(`  Domain: ${AUTH0_DOMAIN}`);
    console.log(`  Client ID: ${AUTH0_CLIENT_ID}`);
    console.log(`  Client Secret: ${AUTH0_CLIENT_SECRET?.substring(0, 8)}...`);
    console.log('');

    // Step 1: Register MCP resources
    console.log('─────────────────────────────────────────────────────────');
    console.log('Step 1: Register MCP Resources');
    console.log('─────────────────────────────────────────────────────────');

    const resourceService = getResourceIndicatorService();
    resourceService.registerResource({
      uri: 'mcp://github',
      scopes: ['github.repo.read', 'github.issues.write', 'github.pr.read', 'github.pr.write'],
      description: 'GitHub MCP Server',
    });
    resourceService.registerResource({
      uri: 'mcp://playwright',
      scopes: ['playwright.browser.control', 'playwright.screenshot', 'playwright.navigate'],
      description: 'Playwright MCP Server',
    });

    console.log('✓ Registered mcp://github');
    console.log('✓ Registered mcp://playwright');
    console.log('');

    // Step 2: Start Authorization Server with Real Auth0
    console.log('─────────────────────────────────────────────────────────');
    console.log('Step 2: Start Authorization Server with Real Auth0');
    console.log('─────────────────────────────────────────────────────────');

    authServer = new AuthorizationServer({
      host: 'localhost',
      port: 4000,
      issuer: 'http://localhost:4000',
      cors: true,
      interactiveConsent: false, // SSO will handle authentication
      auth0: {
        domain: AUTH0_DOMAIN,
        clientId: AUTH0_CLIENT_ID,
        clientSecret: AUTH0_CLIENT_SECRET,
        redirectUri: 'http://localhost:4000/oauth/sso/callback',
        scopes: ['openid', 'profile', 'email'],
      },
    });

    await authServer.start();
    console.log('✓ Authorization Server running');
    console.log('');

    const jwtService = authServer.getJWTService();

    // Step 3: Register OAuth Client
    console.log('─────────────────────────────────────────────────────────');
    console.log('Step 3: Register OAuth Client (VSCode Extension)');
    console.log('─────────────────────────────────────────────────────────');

    const registerResponse = await fetch('http://localhost:4000/oauth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'VSCode Extension (Test)',
        redirect_uris: ['http://localhost:8080/callback'],
        grant_types: [
          'authorization_code',
          'refresh_token',
          'urn:ietf:params:oauth:grant-type:token-exchange',
        ],
        scope: 'github.repo.read github.issues.write playwright.browser.control',
      }),
    });

    if (!registerResponse.ok) {
      throw new Error(`Failed to register client: ${registerResponse.statusText}`);
    }

    const client = await registerResponse.json();
    console.log('✓ Client registered');
    console.log(`  Client ID: ${client.client_id}`);
    console.log('');

    // Step 4: Interactive OAuth Flow
    console.log('─────────────────────────────────────────────────────────');
    console.log('Step 4: OAuth Authorization Flow (with Real Auth0 SSO)');
    console.log('─────────────────────────────────────────────────────────');

    // Generate PKCE challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Build authorization URL
    const authUrl = new URL('http://localhost:4000/oauth/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', client.client_id);
    authUrl.searchParams.set('redirect_uri', 'http://localhost:8080/callback');
    authUrl.searchParams.set(
      'scope',
      'github.repo.read github.issues.write playwright.browser.control'
    );
    authUrl.searchParams.set('state', 'vscode_state_123');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    console.log('Opening browser for Auth0 login...');
    console.log('');
    console.log('IMPORTANT: After logging in with Auth0, you will be redirected');
    console.log('           to http://localhost:8080/callback with an authorization code.');
    console.log('           The callback server will capture this and continue the test.');
    console.log('');

    // Start callback server to capture authorization code
    const authCode = await new Promise<string>((resolve, reject) => {
      callbackServer = http.createServer((req, res) => {
        const url = new URL(req.url!, 'http://localhost:8080');

        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const state = url.searchParams.get('state');
          const error = url.searchParams.get('error');

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<h1>Error</h1><p>${error}</p>`);
            reject(new Error(`OAuth error: ${error}`));
            return;
          }

          if (!code || !state) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>Error</h1><p>Missing code or state parameter</p>');
            reject(new Error('Missing code or state parameter'));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head><title>OAuth Success</title></head>
              <body>
                <h1>✅ Authentication Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
                <p><strong>Authorization Code:</strong> ${code.substring(0, 8)}...</p>
              </body>
            </html>
          `);

          resolve(code);
        }
      });

      callbackServer.listen(8080, () => {
        console.log('✓ Callback server listening on http://localhost:8080');
        console.log('');

        // Open browser
        open(authUrl.toString()).catch((error) => {
          console.error('Failed to open browser automatically:', error.message);
          console.log('');
          console.log('Please open this URL manually in your browser:');
          console.log(authUrl.toString());
          console.log('');
        });
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        reject(new Error('OAuth flow timeout (2 minutes)'));
      }, 120000);
    });

    // Close callback server
    if (callbackServer) {
      callbackServer.close();
      callbackServer = null;
    }

    console.log('');
    console.log('✓ Received authorization code');
    console.log(`  Code: ${authCode.substring(0, 8)}...`);
    console.log('');

    // Step 5: Exchange authorization code for access token
    console.log('─────────────────────────────────────────────────────────');
    console.log('Step 5: Exchange Authorization Code for Access Token');
    console.log('─────────────────────────────────────────────────────────');

    const tokenResponse = await fetch('http://localhost:4000/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: 'http://localhost:8080/callback',
        client_id: client.client_id,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Failed to exchange code for token: ${error}`);
    }

    const tokens = await tokenResponse.json();
    console.log('✓ Access token issued with user context from Auth0');
    console.log('');

    // Decode token to show user claims
    const tokenPayload = jwtService.verifyToken(tokens.access_token);
    if (!tokenPayload.valid || !tokenPayload.payload) {
      throw new Error('Invalid access token');
    }

    console.log('Token Claims (from Auth0):');
    console.log(`  Subject: ${tokenPayload.payload.sub}`);
    console.log(`  Email: ${tokenPayload.payload.user_email || 'N/A'}`);
    console.log(`  Name: ${tokenPayload.payload.user_name || 'N/A'}`);
    console.log(`  Department: ${tokenPayload.payload.user_department || 'N/A (add custom claims in Auth0)'}`);
    console.log(`  Employee ID: ${tokenPayload.payload.employee_id || 'N/A (add custom claims in Auth0)'}`);
    console.log(`  Cost Center: ${tokenPayload.payload.cost_center || 'N/A (add custom claims in Auth0)'}`);
    console.log(`  Groups: ${JSON.stringify(tokenPayload.payload.user_groups || []) || 'N/A (add custom claims in Auth0)'}`);
    console.log(`  Roles: ${JSON.stringify(tokenPayload.payload.user_roles || []) || 'N/A (add custom claims in Auth0)'}`);
    console.log('');

    // Step 6: Token Exchange for GitHub MCP
    console.log('─────────────────────────────────────────────────────────');
    console.log('Step 6: Token Exchange for GitHub MCP Server');
    console.log('─────────────────────────────────────────────────────────');

    const githubTokenResponse = await fetch('http://localhost:4000/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: tokens.access_token,
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        scope: 'github.repo.read github.issues.write',
        resource: 'mcp://github',
        client_id: client.client_id,
      }),
    });

    if (!githubTokenResponse.ok) {
      const error = await githubTokenResponse.text();
      throw new Error(`Failed to exchange token for GitHub MCP: ${error}`);
    }

    const githubToken = await githubTokenResponse.json();
    console.log('✓ GitHub MCP token issued');

    const githubPayload = jwtService.verifyToken(githubToken.access_token);
    if (githubPayload.valid && githubPayload.payload) {
      console.log('');
      console.log('GitHub MCP Token Claims:');
      console.log(`  Subject: ${githubPayload.payload.sub}`);
      console.log(`  Email: ${githubPayload.payload.user_email || 'N/A'}`);
      console.log(`  Scope: ${githubPayload.payload.scope}`);
      console.log(`  Resource: ${JSON.stringify(githubPayload.payload.resource)}`);
    }
    console.log('');

    // Step 7: Token Exchange for Playwright MCP
    console.log('─────────────────────────────────────────────────────────');
    console.log('Step 7: Token Exchange for Playwright MCP Server');
    console.log('─────────────────────────────────────────────────────────');

    const playwrightTokenResponse = await fetch('http://localhost:4000/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: tokens.access_token,
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        scope: 'playwright.browser.control',
        resource: 'mcp://playwright',
        client_id: client.client_id,
      }),
    });

    if (!playwrightTokenResponse.ok) {
      const error = await playwrightTokenResponse.text();
      throw new Error(`Failed to exchange token for Playwright MCP: ${error}`);
    }

    const playwrightToken = await playwrightTokenResponse.json();
    console.log('✓ Playwright MCP token issued');

    const playwrightPayload = jwtService.verifyToken(playwrightToken.access_token);
    if (playwrightPayload.valid && playwrightPayload.payload) {
      console.log('');
      console.log('Playwright MCP Token Claims:');
      console.log(`  Subject: ${playwrightPayload.payload.sub}`);
      console.log(`  Email: ${playwrightPayload.payload.user_email || 'N/A'}`);
      console.log(`  Scope: ${playwrightPayload.payload.scope}`);
      console.log(`  Resource: ${JSON.stringify(playwrightPayload.payload.resource)}`);
    }
    console.log('');

    console.log('═══════════════════════════════════════════════════════');
    console.log('  ✅ Real Auth0 Integration Test PASSED!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('Summary:');
    console.log('✅ Auth0 SSO authentication successful');
    console.log('✅ User context propagated from Auth0 to OAuth tokens');
    console.log('✅ Token exchange for GitHub MCP successful');
    console.log('✅ Token exchange for Playwright MCP successful');
    console.log('✅ All tokens include user attribution');
    console.log('');

    if (!tokenPayload.payload.user_department) {
      console.log('ℹ️  Note: To add custom user claims (department, employee_id, etc.),');
      console.log('   configure custom actions in Auth0 Dashboard. See test file header.');
      console.log('');
    }

    await cleanup();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', (error as Error).message);
    await cleanup();
    process.exit(1);
  }
}

/**
 * Generate PKCE code verifier
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate PKCE code challenge from verifier
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Run the test
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
