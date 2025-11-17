/**
 * Token Introspection (RFC 7662)
 *
 * Endpoint for validating and obtaining information about OAuth 2.0 tokens
 * Used by resource servers to validate access tokens
 */

import { JWTService, type JWTPayload } from './jwt.js';
import type { ClientRegistrationService } from './registration.js';

/**
 * Token introspection request
 */
export interface TokenIntrospectionRequest {
  token: string; // REQUIRED: The token to introspect
  token_type_hint?: 'access_token' | 'refresh_token'; // OPTIONAL: Hint about token type
  client_id?: string; // Client identifier (for authentication)
  client_secret?: string; // Client secret (for authentication)
}

/**
 * Token introspection response
 */
export interface TokenIntrospectionResponse {
  // REQUIRED: Boolean indicator of whether token is currently active
  active: boolean;

  // OPTIONAL: The following are only included if active=true
  scope?: string; // Space-separated list of scopes
  client_id?: string; // Client identifier
  username?: string; // Human-readable identifier for the resource owner
  token_type?: string; // Type of token
  exp?: number; // Expiration timestamp
  iat?: number; // Issued at timestamp
  nbf?: number; // Not before timestamp
  sub?: string; // Subject of the token
  aud?: string | string[]; // Intended audience
  iss?: string; // Issuer
  jti?: string; // JWT ID

  // RFC 8707: Resource indicators
  resource?: string | string[]; // Resource indicators

  // MCP specific
  mcp_version?: string;
  mcp_capabilities?: string[];

  // Custom claims
  [key: string]: any;
}

/**
 * Token Introspection Service
 */
export class TokenIntrospectionService {
  constructor(
    private jwtService: JWTService,
    private clientService: ClientRegistrationService
  ) {}

  /**
   * Introspect a token
   */
  async introspect(request: TokenIntrospectionRequest): Promise<TokenIntrospectionResponse> {
    // Validate client credentials if provided
    if (request.client_id) {
      const isValid = await this.clientService.validateCredentials(
        request.client_id,
        request.client_secret
      );

      if (!isValid) {
        return { active: false };
      }
    }

    // Verify and decode token
    const verification = this.jwtService.verifyToken(request.token);

    if (!verification.valid || !verification.payload) {
      return { active: false };
    }

    // Check if token is expired
    if (this.jwtService.isTokenExpired(request.token)) {
      return { active: false };
    }

    // Token is active - return full information
    return this.buildIntrospectionResponse(verification.payload);
  }

  /**
   * Build introspection response from JWT payload
   */
  private buildIntrospectionResponse(payload: JWTPayload): TokenIntrospectionResponse {
    return {
      active: true,
      scope: payload.scope,
      client_id: payload.client_id,
      username: payload.sub, // Subject as username
      token_type: payload.token_type || 'Bearer',
      exp: payload.exp,
      iat: payload.iat,
      nbf: payload.nbf,
      sub: payload.sub,
      aud: payload.aud,
      iss: payload.iss,
      jti: payload.jti,
      resource: payload.resource,
      mcp_version: payload.mcp_version,
      mcp_capabilities: payload.mcp_capabilities,
    };
  }

  /**
   * Validate token for specific scope
   */
  async validateTokenForScope(token: string, requiredScope: string): Promise<{
    valid: boolean;
    response: TokenIntrospectionResponse;
  }> {
    const response = await this.introspect({ token });

    if (!response.active) {
      return { valid: false, response };
    }

    const scopes = response.scope?.split(' ') || [];
    const valid = scopes.includes(requiredScope);

    return { valid, response };
  }

  /**
   * Validate token for specific resource (RFC 8707)
   */
  async validateTokenForResource(token: string, resource: string): Promise<{
    valid: boolean;
    response: TokenIntrospectionResponse;
  }> {
    const response = await this.introspect({ token });

    if (!response.active) {
      return { valid: false, response };
    }

    // Check if token has resource indicators
    if (!response.resource) {
      // If no resource indicators, token is valid for all resources
      return { valid: true, response };
    }

    // Check if requested resource is in the token's resource list
    const resources = Array.isArray(response.resource)
      ? response.resource
      : [response.resource];

    const valid = resources.includes(resource);

    return { valid, response };
  }

  /**
   * Get token metadata (without full introspection)
   */
  getTokenMetadata(token: string): {
    exp?: number;
    iat?: number;
    sub?: string;
    client_id?: string;
  } | null {
    const decoded = this.jwtService.decodeToken(token);
    if (!decoded) {
      return null;
    }

    return {
      exp: decoded.exp,
      iat: decoded.iat,
      sub: decoded.sub,
      client_id: decoded.client_id,
    };
  }
}

/**
 * Express middleware for token introspection endpoint
 */
export function createIntrospectionEndpoint(introspectionService: TokenIntrospectionService) {
  return async (req: any, res: any) => {
    try {
      // Parse request body
      const { token, token_type_hint, client_id, client_secret } = req.body;

      if (!token) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing required parameter: token',
        });
      }

      // Introspect token
      const response = await introspectionService.introspect({
        token,
        token_type_hint,
        client_id,
        client_secret,
      });

      res.json(response);
    } catch (error) {
      console.error('[OAuth] Introspection error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error',
      });
    }
  };
}
