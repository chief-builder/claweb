/**
 * OAuth 2.0 Authorization Server Discovery (RFC 8414)
 *
 * Implements the .well-known/oauth-authorization-server metadata endpoint
 * for OAuth 2.0 server discovery.
 */

export interface AuthorizationServerMetadata {
  // REQUIRED: The authorization server's issuer identifier
  issuer: string;

  // REQUIRED: URL of the authorization server's authorization endpoint
  authorization_endpoint: string;

  // REQUIRED: URL of the authorization server's token endpoint
  token_endpoint: string;

  // OPTIONAL: URL of the authorization server's JWK Set document
  jwks_uri?: string;

  // OPTIONAL: URL of the authorization server's dynamic client registration endpoint
  registration_endpoint?: string;

  // OPTIONAL: JSON array containing a list of the OAuth 2.0 scope values
  scopes_supported?: string[];

  // REQUIRED: JSON array containing a list of the OAuth 2.0 response_type values
  response_types_supported: string[];

  // OPTIONAL: JSON array containing a list of the OAuth 2.0 response_mode values
  response_modes_supported?: string[];

  // OPTIONAL: JSON array containing a list of the OAuth 2.0 grant type values
  grant_types_supported?: string[];

  // OPTIONAL: JSON array containing a list of client authentication methods
  token_endpoint_auth_methods_supported?: string[];

  // OPTIONAL: JSON array containing a list of the JWS signing algorithms
  token_endpoint_auth_signing_alg_values_supported?: string[];

  // OPTIONAL: URL of the authorization server's introspection endpoint (RFC 7662)
  introspection_endpoint?: string;

  // OPTIONAL: URL of the authorization server's revocation endpoint (RFC 7009)
  revocation_endpoint?: string;

  // OPTIONAL: JSON array containing proof key methods supported
  code_challenge_methods_supported?: string[];

  // RFC 8707: Resource indicators
  resource_indicators_supported?: boolean;

  // MCP specific metadata
  mcp_version?: string;
  mcp_features?: string[];
}

/**
 * OAuth 2.0 Discovery Service
 */
export class OAuthDiscoveryService {
  private baseUrl: string;
  private metadata: AuthorizationServerMetadata;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.metadata = this.buildMetadata();
  }

  /**
   * Build authorization server metadata
   */
  private buildMetadata(): AuthorizationServerMetadata {
    return {
      // Issuer identifier
      issuer: this.baseUrl,

      // Authorization endpoint
      authorization_endpoint: `${this.baseUrl}/oauth/authorize`,

      // Token endpoint
      token_endpoint: `${this.baseUrl}/oauth/token`,

      // JWK Set endpoint
      jwks_uri: `${this.baseUrl}/oauth/jwks`,

      // Dynamic client registration endpoint
      registration_endpoint: `${this.baseUrl}/oauth/register`,

      // Supported scopes
      scopes_supported: [
        'mcp.tools.read',
        'mcp.tools.execute',
        'mcp.resources.read',
        'mcp.prompts.read',
        'mcp.admin',
      ],

      // Response types supported
      response_types_supported: [
        'code',
        'token',
        'code token',
      ],

      // Response modes supported
      response_modes_supported: [
        'query',
        'fragment',
      ],

      // Grant types supported
      grant_types_supported: [
        'authorization_code',
        'client_credentials',
        'refresh_token',
      ],

      // Token endpoint authentication methods
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
        'client_secret_jwt',
        'private_key_jwt',
      ],

      // Signing algorithms supported
      token_endpoint_auth_signing_alg_values_supported: [
        'RS256',
        'ES256',
        'HS256',
      ],

      // Introspection endpoint
      introspection_endpoint: `${this.baseUrl}/oauth/introspect`,

      // Revocation endpoint
      revocation_endpoint: `${this.baseUrl}/oauth/revoke`,

      // PKCE support
      code_challenge_methods_supported: [
        'S256',
        'plain',
      ],

      // RFC 8707: Resource indicators support
      resource_indicators_supported: true,

      // MCP specific metadata
      mcp_version: '2025-06-18',
      mcp_features: [
        'tools',
        'resources',
        'prompts',
        'oauth',
        'rfc8707',
      ],
    };
  }

  /**
   * Get authorization server metadata
   */
  getMetadata(): AuthorizationServerMetadata {
    return this.metadata;
  }

  /**
   * Validate if a scope is supported
   */
  isScopeSupported(scope: string): boolean {
    return this.metadata.scopes_supported?.includes(scope) ?? false;
  }

  /**
   * Validate if a grant type is supported
   */
  isGrantTypeSupported(grantType: string): boolean {
    return this.metadata.grant_types_supported?.includes(grantType) ?? false;
  }

  /**
   * Validate if a response type is supported
   */
  isResponseTypeSupported(responseType: string): boolean {
    return this.metadata.response_types_supported.includes(responseType);
  }

  /**
   * Get the well-known discovery path
   */
  static getDiscoveryPath(): string {
    return '/.well-known/oauth-authorization-server';
  }

  /**
   * Validate metadata structure
   */
  validateMetadata(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.metadata.issuer) {
      errors.push('Missing required field: issuer');
    }

    if (!this.metadata.authorization_endpoint) {
      errors.push('Missing required field: authorization_endpoint');
    }

    if (!this.metadata.token_endpoint) {
      errors.push('Missing required field: token_endpoint');
    }

    if (!this.metadata.response_types_supported || this.metadata.response_types_supported.length === 0) {
      errors.push('Missing required field: response_types_supported');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Express middleware for OAuth discovery endpoint
 */
export function createOAuthDiscoveryEndpoint(baseUrl: string) {
  const discoveryService = new OAuthDiscoveryService(baseUrl);

  return (req: any, res: any) => {
    const metadata = discoveryService.getMetadata();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    res.json(metadata);
  };
}
