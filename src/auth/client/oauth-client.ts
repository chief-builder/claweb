/**
 * OAuth 2.0 Client
 *
 * MCP client implementation that obtains and uses access tokens
 * from an authorization server to access protected MCP resources.
 *
 * Supports:
 * - Authorization Code flow with PKCE
 * - Client Credentials flow
 * - Automatic token refresh
 */

import { PKCEService, CodeChallengeMethod, type PKCEParams } from '../oauth/pkce.js';

/**
 * OAuth client configuration
 */
export interface OAuthClientConfig {
  /**
   * Client ID (from registration)
   */
  clientId: string;

  /**
   * Client secret (for confidential clients)
   */
  clientSecret?: string;

  /**
   * Authorization server URL (e.g., "https://auth.example.com")
   */
  authorizationServer: string;

  /**
   * Redirect URI for authorization code flow
   */
  redirectUri?: string;

  /**
   * Default scopes to request
   */
  scopes?: string[];

  /**
   * Default resources to request (RFC 8707)
   */
  resources?: string[];
}

/**
 * Token set
 */
export interface TokenSet {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  resource?: string | string[];
  expires_at?: number; // Calculated expiration timestamp
}

/**
 * Authorization URL parameters
 */
export interface AuthorizationUrlParams {
  scope?: string;
  state?: string;
  resource?: string | string[];
  pkce?: PKCEParams;
}

/**
 * OAuth 2.0 Client for MCP
 *
 * Handles token acquisition and management for accessing protected MCP resources.
 */
export class OAuthClient {
  private config: OAuthClientConfig;
  private currentTokens: TokenSet | null = null;
  private pkceParams: PKCEParams | null = null;

  constructor(config: OAuthClientConfig) {
    this.config = config;
  }

  /**
   * Discover authorization server metadata
   */
  async discover(): Promise<any> {
    const discoveryUrl = `${this.config.authorizationServer}/.well-known/oauth-authorization-server`;

    const response = await fetch(discoveryUrl);

    if (!response.ok) {
      throw new Error(`Failed to discover authorization server: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Generate authorization URL for authorization code flow
   *
   * @param params URL parameters
   * @returns Authorization URL and PKCE parameters (store securely!)
   */
  generateAuthorizationUrl(params: AuthorizationUrlParams = {}): {
    url: string;
    pkce: PKCEParams;
    state: string;
  } {
    if (!this.config.redirectUri) {
      throw new Error('redirectUri is required for authorization code flow');
    }

    // Generate PKCE parameters
    const pkce = params.pkce || PKCEService.generatePKCEParams(CodeChallengeMethod.S256);
    this.pkceParams = pkce;

    // Generate state
    const state = params.state || this.generateRandomString(32);

    // Build authorization URL
    const authUrl = new URL(`${this.config.authorizationServer}/oauth/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', this.config.clientId);
    authUrl.searchParams.set('redirect_uri', this.config.redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', pkce.codeChallenge);
    authUrl.searchParams.set('code_challenge_method', pkce.codeChallengeMethod);

    // Add scope
    const scope = params.scope || this.config.scopes?.join(' ');
    if (scope) {
      authUrl.searchParams.set('scope', scope);
    }

    // Add resource (RFC 8707)
    const resources = params.resource
      ? Array.isArray(params.resource)
        ? params.resource
        : [params.resource]
      : this.config.resources;

    if (resources) {
      resources.forEach((resource) => {
        authUrl.searchParams.append('resource', resource);
      });
    }

    return {
      url: authUrl.toString(),
      pkce,
      state,
    };
  }

  /**
   * Exchange authorization code for tokens
   *
   * @param code Authorization code from callback
   * @param pkce PKCE parameters from authorization request
   * @returns Token set
   */
  async exchangeAuthorizationCode(
    code: string,
    pkce?: PKCEParams
  ): Promise<TokenSet> {
    if (!this.config.redirectUri) {
      throw new Error('redirectUri is required for authorization code flow');
    }

    const tokenUrl = `${this.config.authorizationServer}/oauth/token`;

    const codeVerifier = pkce?.codeVerifier || this.pkceParams?.codeVerifier;
    if (!codeVerifier) {
      throw new Error('PKCE code verifier is required');
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const error = await response.json() as any;
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
    }

    const tokens = await response.json() as TokenSet;
    this.storeTokens(tokens);

    return tokens;
  }

  /**
   * Obtain tokens using client credentials grant
   *
   * @param scope Optional scope override
   * @param resource Optional resource override
   * @returns Token set
   */
  async getClientCredentialsToken(
    scope?: string,
    resource?: string | string[]
  ): Promise<TokenSet> {
    if (!this.config.clientSecret) {
      throw new Error('clientSecret is required for client credentials flow');
    }

    const tokenUrl = `${this.config.authorizationServer}/oauth/token`;

    const requestBody: any = {
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    };

    // Add scope
    if (scope) {
      requestBody.scope = scope;
    } else if (this.config.scopes) {
      requestBody.scope = this.config.scopes.join(' ');
    }

    // Add resource
    const resources = resource
      ? Array.isArray(resource)
        ? resource
        : [resource]
      : this.config.resources;

    if (resources && resources.length > 0) {
      requestBody.resource = resources.length === 1 ? resources[0] : resources;
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json() as any;
      throw new Error(
        `Client credentials grant failed: ${error.error_description || error.error}`
      );
    }

    const tokens = await response.json() as TokenSet;
    this.storeTokens(tokens);

    return tokens;
  }

  /**
   * Refresh access token using refresh token
   *
   * @returns New token set
   */
  async refreshAccessToken(): Promise<TokenSet> {
    if (!this.currentTokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const tokenUrl = `${this.config.authorizationServer}/oauth/token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: this.currentTokens.refresh_token,
      }),
    });

    if (!response.ok) {
      const error = await response.json() as any;
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
    }

    const tokens = await response.json() as TokenSet;
    this.storeTokens(tokens);

    return tokens;
  }

  /**
   * Get current access token (refreshes if expired)
   *
   * @returns Access token
   */
  async getAccessToken(): Promise<string> {
    if (!this.currentTokens) {
      throw new Error('No tokens available. Authenticate first.');
    }

    // Check if token is expired
    if (this.isTokenExpired()) {
      // Try to refresh
      if (this.currentTokens.refresh_token) {
        await this.refreshAccessToken();
      } else {
        throw new Error('Access token expired and no refresh token available');
      }
    }

    return this.currentTokens.access_token;
  }

  /**
   * Make an authenticated request to a protected resource
   *
   * @param url Resource URL
   * @param options Fetch options
   * @returns Fetch response
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const accessToken = await this.getAccessToken();

    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);

    return fetch(url, {
      ...options,
      headers,
    });
  }

  /**
   * Get current tokens
   */
  getTokens(): TokenSet | null {
    return this.currentTokens;
  }

  /**
   * Clear stored tokens
   */
  clearTokens(): void {
    this.currentTokens = null;
    this.pkceParams = null;
  }

  /**
   * Check if access token is expired
   */
  private isTokenExpired(): boolean {
    if (!this.currentTokens?.expires_at) {
      return false;
    }

    // Consider expired if less than 60 seconds remaining
    const now = Date.now() / 1000;
    return this.currentTokens.expires_at - now < 60;
  }

  /**
   * Store tokens and calculate expiration
   */
  private storeTokens(tokens: TokenSet): void {
    this.currentTokens = {
      ...tokens,
      expires_at: tokens.expires_in
        ? Math.floor(Date.now() / 1000) + tokens.expires_in
        : undefined,
    };
  }

  /**
   * Generate random string
   */
  private generateRandomString(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      result += charset[randomValues[i] % charset.length];
    }
    return result;
  }
}

/**
 * Create an OAuth client
 */
export function createOAuthClient(config: OAuthClientConfig): OAuthClient {
  return new OAuthClient(config);
}
