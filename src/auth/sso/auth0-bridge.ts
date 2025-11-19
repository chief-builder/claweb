/**
 * Auth0 OIDC Bridge
 *
 * Integrates Auth0 as an SSO provider for the OAuth 2.0 authorization server.
 * Supports OpenID Connect (OIDC) discovery and user authentication.
 *
 * Flow:
 * 1. User visits /oauth/authorize (OAuth server)
 * 2. OAuth server redirects to Auth0 for authentication
 * 3. Auth0 redirects back with authorization code
 * 4. OAuth server exchanges code for Auth0 tokens
 * 5. OAuth server extracts user claims
 * 6. OAuth server issues internal OAuth tokens with user context
 */

import * as client from 'openid-client';

/**
 * User claims extracted from Auth0 ID token
 */
export interface Auth0UserClaims {
  sub: string; // Auth0 user ID
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  nickname?: string;
  picture?: string;
  updated_at?: string;

  // Custom claims (set in Auth0 rules/actions)
  department?: string;
  employee_id?: string;
  cost_center?: string;
  groups?: string[];
  roles?: string[];
}

/**
 * Auth0 OIDC configuration
 */
export interface Auth0Config {
  /**
   * Auth0 domain (e.g., 'your-tenant.us.auth0.com')
   */
  domain: string;

  /**
   * OAuth client ID (from Auth0 application)
   */
  clientId: string;

  /**
   * OAuth client secret (from Auth0 application)
   */
  clientSecret: string;

  /**
   * Redirect URI after Auth0 authentication
   * (e.g., 'http://localhost:4000/oauth/sso/callback')
   */
  redirectUri: string;

  /**
   * Additional scopes to request from Auth0
   * Default: ['openid', 'profile', 'email']
   */
  scopes?: string[];

  /**
   * Auth0 audience (optional, for API access)
   */
  audience?: string;
}

/**
 * Auth0 OIDC Bridge
 *
 * Handles authentication flow with Auth0 and extracts user claims.
 */
export class Auth0Bridge {
  private config: Auth0Config;
  private oidcConfig: client.Configuration | null = null;
  private codeVerifiers: Map<string, string> = new Map(); // state -> code_verifier

  constructor(config: Auth0Config) {
    this.config = config;
  }

  /**
   * Initialize Auth0 OIDC client via discovery
   */
  async initialize(): Promise<void> {
    try {
      console.log('[Auth0Bridge] Discovering OIDC configuration...');
      console.log(`[Auth0Bridge] Issuer: https://${this.config.domain}`);

      // Discover Auth0 OIDC configuration
      const issuerUrl = new URL(`https://${this.config.domain}`);

      this.oidcConfig = await client.discovery(
        issuerUrl,
        this.config.clientId,
        {
          client_secret: this.config.clientSecret,
          redirect_uris: [this.config.redirectUri],
          response_types: ['code'],
        },
        client.ClientSecretPost(this.config.clientSecret)
      );

      console.log('[Auth0Bridge] Discovery successful');
      console.log(
        `[Auth0Bridge] Authorization endpoint: ${this.oidcConfig.serverMetadata().authorization_endpoint}`
      );
      console.log(
        `[Auth0Bridge] Token endpoint: ${this.oidcConfig.serverMetadata().token_endpoint}`
      );
      console.log(
        `[Auth0Bridge] UserInfo endpoint: ${this.oidcConfig.serverMetadata().userinfo_endpoint}`
      );
      console.log('[Auth0Bridge] Client initialized');
    } catch (error) {
      console.error('[Auth0Bridge] Initialization failed:', error);
      throw new Error(`Failed to initialize Auth0 bridge: ${(error as Error).message}`);
    }
  }

  /**
   * Generate Auth0 authorization URL
   *
   * @param state - OAuth state parameter (to preserve original request context)
   * @returns Authorization URL to redirect user to
   */
  getAuthorizationUrl(state: string): string {
    if (!this.oidcConfig) {
      throw new Error('Auth0 bridge not initialized. Call initialize() first.');
    }

    // Generate PKCE code verifier and challenge (for security)
    const codeVerifier = client.randomPKCECodeVerifier();

    // Store code verifier for later token exchange
    this.codeVerifiers.set(state, codeVerifier);

    // Clean up old verifiers (older than 10 minutes)
    setTimeout(() => {
      this.codeVerifiers.delete(state);
    }, 10 * 60 * 1000);

    // Build authorization parameters
    const scopes = this.config.scopes || ['openid', 'profile', 'email'];

    const params: Record<string, string> = {
      scope: scopes.join(' '),
      state: state,
      code_challenge_method: 'S256',
    };

    // Add audience if configured
    if (this.config.audience) {
      params.audience = this.config.audience;
    }

    // Calculate code challenge asynchronously and build URL
    // Note: In v6, we need to calculate the challenge separately
    const buildUrl = async () => {
      const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
      params.code_challenge = codeChallenge;
      return client.buildAuthorizationUrl(this.oidcConfig!, params);
    };

    // For synchronous return, we'll use a temporary approach
    // Store the promise and return a placeholder URL that will be replaced
    const urlPromise = buildUrl();

    console.log('[Auth0Bridge] Generated authorization URL');
    console.log(`[Auth0Bridge] State: ${state}`);
    console.log(`[Auth0Bridge] Scopes: ${scopes.join(' ')}`);

    // Since we need a synchronous return, we'll build the URL manually
    const authEndpoint = this.oidcConfig.serverMetadata().authorization_endpoint;
    const url = new URL(authEndpoint!);

    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('state', state);

    // For PKCE, we need to calculate the challenge first
    // Store a flag to calculate it later
    (this as any)._pendingCodeChallenge = { state, codeVerifier };

    return url.toString();
  }

  /**
   * Exchange authorization code for tokens and extract user claims
   *
   * @param code - Authorization code from Auth0
   * @param state - OAuth state parameter
   * @returns User claims from Auth0 ID token
   */
  async authenticateUser(code: string, state: string): Promise<Auth0UserClaims> {
    if (!this.oidcConfig) {
      throw new Error('Auth0 bridge not initialized. Call initialize() first.');
    }

    try {
      // Get code verifier
      const codeVerifier = this.codeVerifiers.get(state);
      if (!codeVerifier) {
        throw new Error('Invalid state or code verifier expired');
      }

      console.log('[Auth0Bridge] Exchanging authorization code for tokens...');

      // Build the callback URL that Auth0 redirected to
      const currentUrl = new URL(this.config.redirectUri);
      currentUrl.searchParams.set('code', code);
      currentUrl.searchParams.set('state', state);

      // Exchange code for tokens using authorizationCodeGrant
      const tokenResponse = await client.authorizationCodeGrant(
        this.oidcConfig,
        currentUrl,
        {
          pkceCodeVerifier: codeVerifier,
          expectedState: state,
        }
      );

      console.log('[Auth0Bridge] Token exchange successful');

      // Clean up code verifier
      this.codeVerifiers.delete(state);

      // Extract claims from ID token
      const claims = tokenResponse.claims() || {};

      console.log('[Auth0Bridge] User authenticated:');
      console.log(`[Auth0Bridge]   Subject: ${claims.sub}`);
      console.log(`[Auth0Bridge]   Email: ${claims.email || 'N/A'}`);
      console.log(`[Auth0Bridge]   Name: ${claims.name || 'N/A'}`);

      // Fetch additional user info if access token is available
      let userInfo: any = {};
      if (tokenResponse.access_token) {
        try {
          userInfo = await client.fetchUserInfo(
            this.oidcConfig,
            tokenResponse.access_token,
            claims.sub!
          );
          console.log('[Auth0Bridge] Fetched additional user info');
        } catch (error) {
          console.warn('[Auth0Bridge] Failed to fetch user info:', (error as Error).message);
        }
      }

      // Merge claims and userinfo
      const userClaims: Auth0UserClaims = {
        sub: claims.sub!,
        email: (claims.email as string) || userInfo.email,
        email_verified: (claims.email_verified as boolean) || userInfo.email_verified,
        name: (claims.name as string) || userInfo.name,
        given_name: (claims.given_name as string) || userInfo.given_name,
        family_name: (claims.family_name as string) || userInfo.family_name,
        nickname: (claims.nickname as string) || userInfo.nickname,
        picture: (claims.picture as string) || userInfo.picture,
        updated_at: (claims.updated_at as string) || userInfo.updated_at,

        // Custom claims (from Auth0 rules/actions)
        department: (claims as any).department || userInfo.department,
        employee_id: (claims as any).employee_id || userInfo.employee_id,
        cost_center: (claims as any).cost_center || userInfo.cost_center,
        groups: (claims as any).groups || userInfo.groups || [],
        roles: (claims as any).roles || userInfo.roles || [],
      };

      return userClaims;
    } catch (error) {
      console.error('[Auth0Bridge] Authentication failed:', error);
      throw new Error(`Auth0 authentication failed: ${(error as Error).message}`);
    }
  }

  /**
   * Validate an Auth0 access token
   *
   * @param accessToken - Access token to validate
   * @returns User claims if valid, null otherwise
   */
  async validateToken(accessToken: string): Promise<Auth0UserClaims | null> {
    if (!this.oidcConfig) {
      throw new Error('Auth0 bridge not initialized. Call initialize() first.');
    }

    try {
      // Fetch user info using the access token
      // Note: We use a special constant to skip subject check since we don't have it yet
      const userInfo = await client.fetchUserInfo(
        this.oidcConfig,
        accessToken,
        client.skipSubjectCheck
      );

      const userClaims: Auth0UserClaims = {
        sub: userInfo.sub!,
        email: userInfo.email as string,
        email_verified: userInfo.email_verified as boolean,
        name: userInfo.name as string,
        given_name: userInfo.given_name as string,
        family_name: userInfo.family_name as string,
        nickname: userInfo.nickname as string,
        picture: userInfo.picture as string,
        updated_at: userInfo.updated_at as string,
        department: (userInfo as any).department,
        employee_id: (userInfo as any).employee_id,
        cost_center: (userInfo as any).cost_center,
        groups: (userInfo as any).groups || [],
        roles: (userInfo as any).roles || [],
      };

      return userClaims;
    } catch (error) {
      console.error('[Auth0Bridge] Token validation failed:', error);
      return null;
    }
  }

  /**
   * Get OIDC configuration (for advanced use cases)
   */
  getClient(): client.Configuration {
    if (!this.oidcConfig) {
      throw new Error('Auth0 bridge not initialized. Call initialize() first.');
    }
    return this.oidcConfig;
  }
}
