/**
 * OAuth 2.0 / RFC 8707 Integration Tests
 *
 * Tests the complete OAuth 2.0 implementation including:
 * - Authorization Server Discovery (RFC 8414)
 * - PKCE (RFC 7636)
 * - JWT Bearer Tokens
 * - Dynamic Client Registration (RFC 7591)
 * - Token Introspection (RFC 7662)
 * - Resource Indicators (RFC 8707)
 *
 * Uses the role-separated OAuth architecture:
 * - AuthorizationServer for token issuance
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AuthorizationServer } from '../src/auth/authorization-server/server.js';
import { HttpResourceServerTransport } from '../src/transport/http/resource-server-transport.js';
import { TransportType, MCP_PROTOCOL_VERSION } from '../src/transport/base.js';
import { PKCEService, CodeChallengeMethod } from '../src/auth/oauth/pkce.js';

describe('OAuth 2.0 / RFC 8707 Integration', () => {
  let authServer: AuthorizationServer;
  let resourceServer: HttpResourceServerTransport;
  const authPort = 3100;
  const resourcePort = 3101;
  const testHost = 'localhost';
  const issuer = `http://${testHost}:${authPort}`;

  // Test data
  let testClient: any;
  let testAuthCode: string;
  let testAccessToken: string;
  let testRefreshToken: string;
  let pkceVerifier: string;
  let pkceChallenge: string;

  beforeAll(async () => {
    // Initialize Authorization Server (issues tokens)
    authServer = new AuthorizationServer({
      host: testHost,
      port: authPort,
      issuer,
      cors: true,
    });

    await authServer.start();

    // Initialize Resource Server (validates tokens, serves protected resources)
    resourceServer = new HttpResourceServerTransport(MCP_PROTOCOL_VERSION, {
      enabled: true,
      authorizationServer: issuer,
    });

    await resourceServer.initialize({
      type: TransportType.HTTP,
      host: testHost,
      port: resourcePort,
      cors: true,
    });

    console.log('\n🔐 OAuth 2.0 / RFC 8707 Test Suite Started\n');
    console.log(`   Authorization Server: ${issuer}`);
    console.log(`   Resource Server: http://${testHost}:${resourcePort}\n`);
  });

  // Helper to get resource server URL
  const resourceServerUrl = `http://${testHost}:${resourcePort}`;

  afterAll(async () => {
    await resourceServer.close();
    await authServer.stop();
    console.log('\n✅ OAuth 2.0 / RFC 8707 Test Suite Completed\n');
  });

  describe('OAuth Server Discovery (RFC 8414)', () => {
    it('should provide OAuth authorization server metadata', async () => {
      const response = await fetch(`${issuer}/.well-known/oauth-authorization-server`);

      expect(response.ok).toBe(true);

      const metadata = await response.json();
      console.log('✓ OAuth Discovery Metadata:', JSON.stringify(metadata, null, 2));

      expect(metadata).toMatchObject({
        issuer,
        authorization_endpoint: `${issuer}/oauth/authorize`,
        token_endpoint: `${issuer}/oauth/token`,
        registration_endpoint: `${issuer}/oauth/register`,
        jwks_uri: `${issuer}/oauth/jwks`,
        response_types_supported: expect.arrayContaining(['code']),
        grant_types_supported: expect.arrayContaining([
          'authorization_code',
          'client_credentials',
          'refresh_token',
        ]),
        code_challenge_methods_supported: expect.arrayContaining(['S256', 'plain']),
        resource_indicators_supported: true,
      });
    });

    it('should provide JWKS endpoint', async () => {
      const response = await fetch(`${issuer}/oauth/jwks`);

      expect(response.ok).toBe(true);

      const jwks = await response.json();
      console.log('✓ JWKS Response:', JSON.stringify(jwks, null, 2));

      expect(jwks).toHaveProperty('keys');
      expect(Array.isArray(jwks.keys)).toBe(true);
      expect(jwks.keys.length).toBeGreaterThan(0);
    });

    it('should include OAuth endpoints in protocol discovery', async () => {
      const response = await fetch(`${resourceServerUrl}/protocol`);

      expect(response.ok).toBe(true);

      const data = await response.json();
      console.log('✓ Protocol Discovery with OAuth:', JSON.stringify(data, null, 2));

      expect(data.oauth).toBeDefined();
      expect(data.oauth.enabled).toBe(true);
      expect(data.oauth.authorizationServer).toBe(issuer);
    });
  });

  describe('Dynamic Client Registration (RFC 7591)', () => {
    it('should register a new confidential client', async () => {
      const registrationRequest = {
        client_name: 'Test MCP Client',
        client_type: 'confidential',
        redirect_uris: ['http://localhost:8080/callback'],
        grant_types: ['authorization_code', 'refresh_token'],
        scope: 'mcp.tools.read mcp.tools.execute',
      };

      const response = await fetch(`${issuer}/oauth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationRequest),
      });

      expect(response.status).toBe(201);

      testClient = await response.json();
      console.log('✓ Registered Client:', JSON.stringify(testClient, null, 2));

      expect(testClient).toMatchObject({
        client_id: expect.any(String),
        client_secret: expect.any(String),
        client_name: 'Test MCP Client',
        client_type: 'confidential',
        redirect_uris: ['http://localhost:8080/callback'],
      });
    });

    it('should register a public client without secret', async () => {
      const registrationRequest = {
        client_name: 'Public Client',
        token_endpoint_auth_method: 'none', // This makes it a public client
        redirect_uris: ['http://localhost:8080/callback'],
      };

      const response = await fetch(`${issuer}/oauth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationRequest),
      });

      expect(response.status).toBe(201);

      const publicClient = await response.json();
      console.log('✓ Public Client:', JSON.stringify(publicClient, null, 2));

      expect(publicClient.client_secret).toBeUndefined();
    });
  });

  describe('PKCE (RFC 7636)', () => {
    it('should generate valid PKCE parameters', () => {
      const pkce = PKCEService.generatePKCEParams(CodeChallengeMethod.S256);

      console.log('✓ PKCE Parameters:');
      console.log('  Code Verifier:', pkce.codeVerifier.substring(0, 20) + '...');
      console.log('  Code Challenge:', pkce.codeChallenge.substring(0, 20) + '...');
      console.log('  Method:', pkce.codeChallengeMethod);

      expect(pkce.codeVerifier).toBeDefined();
      expect(pkce.codeChallenge).toBeDefined();
      expect(pkce.codeChallengeMethod).toBe(CodeChallengeMethod.S256);

      // Store for authorization flow test
      pkceVerifier = pkce.codeVerifier;
      pkceChallenge = pkce.codeChallenge;
    });

    it('should validate PKCE challenge', () => {
      const validation = PKCEService.validatePKCE(pkceVerifier, pkceChallenge, CodeChallengeMethod.S256);

      console.log('✓ PKCE Validation:', validation);

      expect(validation.valid).toBe(true);
    });

    it('should reject invalid PKCE verifier', () => {
      const validation = PKCEService.validatePKCE('invalid_verifier', pkceChallenge, CodeChallengeMethod.S256);

      console.log('✓ Invalid PKCE Validation:', validation);

      expect(validation.valid).toBe(false);
    });
  });

  describe('Authorization Code Flow with PKCE', () => {
    it('should initiate authorization request', async () => {
      const authUrl = new URL(`${issuer}/oauth/authorize`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', testClient.client_id);
      authUrl.searchParams.set('redirect_uri', testClient.redirect_uris[0]);
      authUrl.searchParams.set('scope', 'mcp.tools.read');
      authUrl.searchParams.set('state', 'test_state_123');
      authUrl.searchParams.set('code_challenge', pkceChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('resource', 'mcp://tools');

      console.log('→ Authorization Request URL:', authUrl.toString());

      // Make request without following redirect
      const response = await fetch(authUrl.toString(), {
        redirect: 'manual',
      });

      console.log('← Authorization Response Status:', response.status);

      // Should redirect with authorization code
      expect(response.status).toBe(302);

      const location = response.headers.get('Location');
      expect(location).toBeDefined();

      console.log('✓ Redirect Location:', location);

      // Extract authorization code from redirect
      const redirectUrl = new URL(location!);
      testAuthCode = redirectUrl.searchParams.get('code')!;
      const state = redirectUrl.searchParams.get('state');

      console.log('✓ Authorization Code:', testAuthCode.substring(0, 10) + '...');
      console.log('✓ State:', state);

      expect(testAuthCode).toBeDefined();
      expect(state).toBe('test_state_123');
    });

    it('should exchange authorization code for tokens', async () => {
      const tokenRequest = {
        grant_type: 'authorization_code',
        code: testAuthCode,
        redirect_uri: testClient.redirect_uris[0],
        client_id: testClient.client_id,
        client_secret: testClient.client_secret,
        code_verifier: pkceVerifier,
      };

      console.log('→ Token Request:', JSON.stringify({ ...tokenRequest, client_secret: '***' }));

      const response = await fetch(`${issuer}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tokenRequest),
      });

      expect(response.ok).toBe(true);

      const tokens = await response.json();
      console.log('✓ Token Response:', JSON.stringify({
        ...tokens,
        access_token: tokens.access_token.substring(0, 20) + '...',
        refresh_token: tokens.refresh_token?.substring(0, 20) + '...',
      }, null, 2));

      expect(tokens).toMatchObject({
        access_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: expect.any(String),
        scope: 'mcp.tools.read',
        resource: ['mcp://tools'],
      });

      // Store tokens for later tests
      testAccessToken = tokens.access_token;
      testRefreshToken = tokens.refresh_token;
    });

    it('should reject reuse of authorization code', async () => {
      const tokenRequest = {
        grant_type: 'authorization_code',
        code: testAuthCode,
        redirect_uri: testClient.redirect_uris[0],
        client_id: testClient.client_id,
        client_secret: testClient.client_secret,
        code_verifier: pkceVerifier,
      };

      const response = await fetch(`${issuer}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tokenRequest),
      });

      expect(response.ok).toBe(false);

      const error = await response.json();
      console.log('✓ Code Reuse Error:', JSON.stringify(error, null, 2));

      expect(error.error).toBe('invalid_grant');
    });
  });

  describe('Client Credentials Grant', () => {
    it('should issue token for client credentials', async () => {
      const tokenRequest = {
        grant_type: 'client_credentials',
        client_id: testClient.client_id,
        client_secret: testClient.client_secret,
        scope: 'mcp.tools.execute',
        resource: 'mcp://tools',
      };

      const response = await fetch(`${issuer}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tokenRequest),
      });

      expect(response.ok).toBe(true);

      const tokens = await response.json();
      console.log('✓ Client Credentials Token:', JSON.stringify({
        ...tokens,
        access_token: tokens.access_token.substring(0, 20) + '...',
      }, null, 2));

      expect(tokens).toMatchObject({
        access_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'mcp.tools.execute',
        resource: ['mcp://tools'],
      });
    });

    it('should reject invalid client credentials', async () => {
      const tokenRequest = {
        grant_type: 'client_credentials',
        client_id: testClient.client_id,
        client_secret: 'invalid_secret',
        scope: 'mcp.tools.execute',
      };

      const response = await fetch(`${issuer}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tokenRequest),
      });

      expect(response.status).toBe(401);

      const error = await response.json();
      console.log('✓ Invalid Credentials Error:', JSON.stringify(error, null, 2));

      expect(error.error).toBe('invalid_client');
    });
  });

  describe('Refresh Token Grant', () => {
    it('should refresh access token', async () => {
      const tokenRequest = {
        grant_type: 'refresh_token',
        refresh_token: testRefreshToken,
      };

      const response = await fetch(`${issuer}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tokenRequest),
      });

      expect(response.ok).toBe(true);

      const tokens = await response.json();
      console.log('✓ Refreshed Token:', JSON.stringify({
        ...tokens,
        access_token: tokens.access_token.substring(0, 20) + '...',
      }, null, 2));

      expect(tokens).toMatchObject({
        access_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: 3600,
      });

      // Token should be different
      expect(tokens.access_token).not.toBe(testAccessToken);
    });
  });

  describe('Token Introspection (RFC 7662)', () => {
    it('should introspect active token', async () => {
      const introspectionRequest = {
        token: testAccessToken,
      };

      const response = await fetch(`${issuer}/oauth/introspect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testAccessToken}`,
        },
        body: JSON.stringify(introspectionRequest),
      });

      expect(response.ok).toBe(true);

      const introspection = await response.json();
      console.log('✓ Token Introspection:', JSON.stringify(introspection, null, 2));

      expect(introspection).toMatchObject({
        active: true,
        client_id: testClient.client_id,
        scope: expect.any(String),
        token_type: 'access_token',
      });
    });

    it('should reject introspection without authentication', async () => {
      const introspectionRequest = {
        token: testAccessToken,
      };

      const response = await fetch(`${issuer}/oauth/introspect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Missing Authorization header
        },
        body: JSON.stringify(introspectionRequest),
      });

      expect(response.status).toBe(401);

      const error = await response.json();
      console.log('✓ Introspection Auth Error:', JSON.stringify(error, null, 2));

      expect(error.error).toBe('invalid_request');
    });
  });

  describe('Resource Indicators (RFC 8707)', () => {
    it('should provide resource metadata', async () => {
      const response = await fetch(`${issuer}/oauth/resources`);

      expect(response.ok).toBe(true);

      const metadata = await response.json();
      console.log('✓ Resource Metadata:', JSON.stringify(metadata, null, 2));

      expect(metadata.resources).toBeDefined();
      expect(Array.isArray(metadata.resources)).toBe(true);

      // Check for default MCP resources
      const resourceUris = metadata.resources.map((r: any) => r.uri);
      expect(resourceUris).toContain('mcp://tools');
      expect(resourceUris).toContain('mcp://resources');
      expect(resourceUris).toContain('mcp://prompts');
      expect(resourceUris).toContain('mcp://admin');
    });

    it('should reject invalid resource in authorization', async () => {
      const authUrl = new URL(`${issuer}/oauth/authorize`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', testClient.client_id);
      authUrl.searchParams.set('redirect_uri', testClient.redirect_uris[0]);
      authUrl.searchParams.set('resource', 'invalid://resource');

      const response = await fetch(authUrl.toString(), {
        redirect: 'manual',
      });

      expect(response.status).toBe(400);

      const error = await response.json();
      console.log('✓ Invalid Resource Error:', JSON.stringify(error, null, 2));

      expect(error.error).toBe('invalid_target');
    });

    it('should validate scope for resource', async () => {
      const authUrl = new URL(`${issuer}/oauth/authorize`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', testClient.client_id);
      authUrl.searchParams.set('redirect_uri', testClient.redirect_uris[0]);
      authUrl.searchParams.set('resource', 'mcp://tools');
      authUrl.searchParams.set('scope', 'invalid.scope');

      const response = await fetch(authUrl.toString(), {
        redirect: 'manual',
      });

      expect(response.status).toBe(400);

      const error = await response.json();
      console.log('✓ Invalid Scope for Resource:', JSON.stringify(error, null, 2));

      expect(error.error).toBe('invalid_target');
    });
  });

  describe('Health Check with OAuth', () => {
    it('should indicate OAuth is enabled', async () => {
      const response = await fetch(`${issuer}/health`);

      expect(response.ok).toBe(true);

      const health = await response.json();
      console.log('✓ Health Check with OAuth:', JSON.stringify(health, null, 2));

      expect(health.status).toBe('ok');
      expect(health.service).toBe('oauth-authorization-server');
      expect(health.issuer).toBe(issuer);
    });
  });
});
