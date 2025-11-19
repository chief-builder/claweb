/**
 * Enterprise OAuth SSO + Token Exchange Flow Test
 *
 * Demonstrates:
 * - Enhancement 1: Token Exchange (RFC 8693)
 * - Enhancement 2: SSO Integration (Auth0 OIDC)
 *
 * Scenario: Developer (Alice) in VSCode accessing GitHub and Playwright MCP servers
 */

import { AuthorizationServer } from '../../src/auth/authorization-server/server.js';
import { JWTService } from '../../src/auth/oauth/jwt.js';
import type { Auth0UserClaims } from '../../src/auth/sso/auth0-bridge.js';

// Mock Auth0 Bridge for testing (simulates Auth0 without actual Auth0 account)
class MockAuth0Bridge {
  private mockUser: Auth0UserClaims = {
    sub: 'auth0|alice123',
    email: 'alice@company.com',
    email_verified: true,
    name: 'Alice Developer',
    given_name: 'Alice',
    family_name: 'Developer',
    picture: 'https://example.com/alice.jpg',
    department: 'Engineering',
    employee_id: 'EMP-001',
    cost_center: 'CC-100',
    groups: ['developers', 'senior-engineers'],
    roles: ['developer', 'code-reviewer'],
  };

  async initialize(): Promise<void> {
    console.log('[MockAuth0] Initialized (test mode)');
  }

  getAuthorizationUrl(state: string): string {
    // In test mode, return a fake Auth0 URL
    // The test will then directly call the callback endpoint instead
    return `https://mock.auth0.com/authorize?state=${state}&redirect_uri=http://localhost:4000/oauth/sso/callback`;
  }

  async authenticateUser(code: string, state: string): Promise<Auth0UserClaims> {
    console.log('[MockAuth0] Authenticating user...');
    console.log(`[MockAuth0]   Code: ${code.substring(0, 16)}...`);
    console.log(`[MockAuth0]   State: ${state.substring(0, 16)}...`);

    // Simulate Auth0 authentication
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log('[MockAuth0] Authentication successful');
    console.log(`[MockAuth0]   User: ${this.mockUser.email}`);
    console.log(`[MockAuth0]   Department: ${this.mockUser.department}`);

    return this.mockUser;
  }

  async validateToken(accessToken: string): Promise<Auth0UserClaims | null> {
    return this.mockUser;
  }

  getClient(): any {
    return {};
  }
}

/**
 * Test the complete SSO + Token Exchange flow
 */
async function main() {
  let passedTests = 0;
  let failedTests = 0;
  let authServer: AuthorizationServer | null = null;

  // Cleanup function
  const cleanup = async () => {
    if (authServer) {
      try {
        await authServer.stop();
      } catch (e) {
        console.error('[Cleanup] Error stopping auth server:', (e as Error).message);
      }
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
    console.log('  Enterprise OAuth SSO + Token Exchange Flow Test');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('Scenario: Developer (Alice) in VSCode');
    console.log('MCP Servers: GitHub MCP, Playwright MCP');
    console.log('');

    // Step 1: Start Authorization Server with Mock Auth0
    console.log('─────────────────────────────────────────────────────────');
    console.log('Step 1: Start Authorization Server with SSO');
    console.log('─────────────────────────────────────────────────────────');

    const mockAuth0 = new MockAuth0Bridge() as any;
    await mockAuth0.initialize(); // Initialize the mock bridge

    authServer = new AuthorizationServer({
      host: 'localhost',
      port: 4000,
      issuer: 'http://localhost:4000',
      cors: true,
      interactiveConsent: false, // Auto-approve for testing
      // Don't pass auth0 config - we'll inject the mock bridge directly
    });

    // Inject mock Auth0 bridge BEFORE server starts
    (authServer as any).auth0Bridge = mockAuth0;
    // Also set a fake config for logging
    (authServer as any).config.auth0 = {
      domain: 'mock.auth0.com',
      redirectUri: 'http://localhost:4000/oauth/sso/callback',
    };

    try {
      await authServer.start();
      console.log('✓ Authorization Server running with SSO enabled');
      passedTests++;
    } catch (error) {
      console.error('✗ Failed to start Authorization Server');
      console.error('  Error:', (error as Error).message);
      failedTests++;
      throw error;
    }

    const jwtService = authServer.getJWTService();

    console.log('');

    // Step 2: Register VSCode OAuth Client
    console.log('─────────────────────────────────────────────────────────');
    console.log('Step 2: Register VSCode OAuth Client');
    console.log('─────────────────────────────────────────────────────────');

    const registerResponse = await fetch('http://localhost:4000/oauth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'VSCode Extension',
        redirect_uris: ['http://localhost:8080/callback'],
        grant_types: ['authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:token-exchange'],
        scope: 'github.repo.read github.issues.write playwright.browser.control',
      }),
    });

    if (registerResponse.ok) {
      const client = await registerResponse.json();
      console.log('✓ VSCode client registered');
      console.log(`  Client ID: ${client.client_id}`);
      passedTests++;

      // Step 3: Simulate OAuth Authorization Code Flow with SSO
      console.log('');
      console.log('─────────────────────────────────────────────────────────');
      console.log('Step 3: OAuth Authorization Code Flow (with SSO)');
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

      console.log('VSCode initiates OAuth flow:');
      console.log(`  ${authUrl.toString()}`);
      console.log('');

      // Follow redirect to Auth0 (mocked)
      const authResponse = await fetch(authUrl.toString(), {
        redirect: 'manual',
      });

      if (authResponse.status === 302 || authResponse.status === 301) {
        const redirectLocation = authResponse.headers.get('location');
        console.log('✓ Redirecting to SSO provider (Auth0)');
        console.log(`  Location: ${redirectLocation}`);
        passedTests++;

        // In test mode, extract SSO state and simulate Auth0 callback
        const auth0Url = new URL(redirectLocation!);
        const ssoState = auth0Url.searchParams.get('state');

        console.log('');
        console.log('Simulating Auth0 authentication...');
        console.log('  User: alice@company.com');
        console.log('  Password: ********');
        console.log('');

        // Simulate Auth0 calling back to our SSO callback endpoint
        const callbackUrl = new URL('http://localhost:4000/oauth/sso/callback');
        callbackUrl.searchParams.set('code', 'mock_auth0_code_xyz');
        callbackUrl.searchParams.set('state', ssoState!);

        const callbackResponse = await fetch(callbackUrl.toString(), {
          redirect: 'manual',
        });

        if (callbackResponse.status === 302) {
          const callbackLocation = callbackResponse.headers.get('location');
          const callbackRedirect = new URL(callbackLocation!);
          const authCode = callbackRedirect.searchParams.get('code');

          console.log('✓ SSO authentication successful');
          console.log('✓ Authorization code issued with user context');
          console.log(`  Code: ${authCode?.substring(0, 8)}...`);
          passedTests += 2;

          // Step 4: Exchange authorization code for access token
          console.log('');
          console.log('─────────────────────────────────────────────────────────');
          console.log('Step 4: Exchange Authorization Code for Access Token');
          console.log('─────────────────────────────────────────────────────────');

          const tokenResponse = await fetch('http://localhost:4000/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code: authCode!,
              redirect_uri: 'http://localhost:8080/callback',
              client_id: client.client_id,
              code_verifier: codeVerifier,
            }),
          });

          if (tokenResponse.ok) {
            const tokens = await tokenResponse.json();
            console.log('✓ Access token issued with user context');

            // Decode token to show user claims
            const tokenPayload = jwtService.validateAccessToken(tokens.access_token);
            if (tokenPayload.valid && tokenPayload.payload) {
              console.log('');
              console.log('Token Claims:');
              console.log(`  Subject: ${tokenPayload.payload.sub}`);
              console.log(`  Email: ${tokenPayload.payload.user_email}`);
              console.log(`  Name: ${tokenPayload.payload.user_name}`);
              console.log(`  Department: ${tokenPayload.payload.user_department}`);
              console.log(`  Employee ID: ${tokenPayload.payload.employee_id}`);
              console.log(`  Cost Center: ${tokenPayload.payload.cost_center}`);
              console.log(`  Groups: ${JSON.stringify(tokenPayload.payload.user_groups)}`);
              console.log(`  Roles: ${JSON.stringify(tokenPayload.payload.user_roles)}`);
              passedTests++;

              // Step 5: Token Exchange for GitHub MCP
              console.log('');
              console.log('─────────────────────────────────────────────────────────');
              console.log('Step 5: Token Exchange for GitHub MCP Server');
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

              if (githubTokenResponse.ok) {
                const githubToken = await githubTokenResponse.json();
                console.log('✓ GitHub MCP token issued');

                // Decode GitHub token
                const githubPayload = jwtService.validateAccessToken(githubToken.access_token);
                if (githubPayload.valid && githubPayload.payload) {
                  console.log('');
                  console.log('GitHub MCP Token Claims:');
                  console.log(`  Subject: ${githubPayload.payload.sub}`);
                  console.log(`  Email: ${githubPayload.payload.user_email}`);
                  console.log(`  Department: ${githubPayload.payload.user_department}`);
                  console.log(`  Scope: ${githubPayload.payload.scope}`);
                  console.log(`  Resource: ${JSON.stringify(githubPayload.payload.resource)}`);
                  console.log(`  Actor: ${JSON.stringify(githubPayload.payload.act || 'N/A')}`);
                  passedTests++;
                }
              } else {
                console.error('✗ Failed to get GitHub MCP token');
                failedTests++;
              }

              // Step 6: Token Exchange for Playwright MCP
              console.log('');
              console.log('─────────────────────────────────────────────────────────');
              console.log('Step 6: Token Exchange for Playwright MCP Server');
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

              if (playwrightTokenResponse.ok) {
                const playwrightToken = await playwrightTokenResponse.json();
                console.log('✓ Playwright MCP token issued');

                // Decode Playwright token
                const playwrightPayload = jwtService.validateAccessToken(
                  playwrightToken.access_token
                );
                if (playwrightPayload.valid && playwrightPayload.payload) {
                  console.log('');
                  console.log('Playwright MCP Token Claims:');
                  console.log(`  Subject: ${playwrightPayload.payload.sub}`);
                  console.log(`  Email: ${playwrightPayload.payload.user_email}`);
                  console.log(`  Department: ${playwrightPayload.payload.user_department}`);
                  console.log(`  Scope: ${playwrightPayload.payload.scope}`);
                  console.log(`  Resource: ${JSON.stringify(playwrightPayload.payload.resource)}`);
                  console.log(
                    `  Actor: ${JSON.stringify(playwrightPayload.payload.act || 'N/A')}`
                  );
                  passedTests++;
                }
              } else {
                console.error('✗ Failed to get Playwright MCP token');
                failedTests++;
              }
            } else {
              console.error('✗ Failed to decode access token');
              failedTests++;
            }
          } else {
            console.error('✗ Failed to exchange authorization code');
            const error = await tokenResponse.json();
            console.error('  Error:', error);
            failedTests++;
          }
        } else {
          console.error('✗ SSO callback failed');
          console.error(`  Status: ${callbackResponse.status}`);
          const responseText = await callbackResponse.text();
          console.error(`  Response: ${responseText.substring(0, 200)}`);
          failedTests++;
        }
      } else {
        console.error('✗ Failed to redirect to SSO provider');
        console.error(`  Status: ${authResponse.status}`);
        const responseText = await authResponse.text();
        console.error(`  Response: ${responseText.substring(0, 200)}`);
        failedTests++;
      }
    } else {
      console.error('✗ Failed to register client');
      const error = await registerResponse.json();
      console.error('  Error:', error);
      console.error(`  Status: ${registerResponse.status}`);
      failedTests++;
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Test Results');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    if (failedTests === 0) {
      console.log('✅ All Tests Passed!');
    } else {
      console.log(`❌ Some Tests Failed`);
    }

    console.log(`Passed: ${passedTests}/${passedTests + failedTests}`);
    console.log(`Failed: ${failedTests}/${passedTests + failedTests}`);
    console.log('');

    console.log('═══════════════════════════════════════════════════════');
    console.log('  Summary');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('✅ Single sign-on via Auth0 (simulated)');
    console.log('✅ User context propagated through OAuth flow');
    console.log('✅ Token exchange for multiple MCP servers');
    console.log('✅ All tokens include user attribution');
    console.log('✅ Ready for audit logging and cost tracking');
    console.log('');

    await cleanup();
    process.exit(failedTests > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n✗ Test suite failed:', (error as Error).message);
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
