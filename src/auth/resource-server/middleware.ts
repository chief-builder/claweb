/**
 * OAuth 2.0 Resource Server Middleware
 *
 * Middleware for MCP servers acting as OAuth 2.0 resource servers.
 * Validates access tokens and enforces authorization policies.
 *
 * The resource server does NOT issue tokens - it only validates them.
 */

import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../oauth/jwt.js';
import { getResourceIndicatorService } from '../rfc8707/indicators.js';

/**
 * Extended request with OAuth context
 */
export interface ResourceServerRequest extends Request {
  oauth?: {
    token: string;
    payload: any;
    clientId: string;
    scopes: string[];
    resources?: string[];
  };
}

/**
 * Resource server middleware options
 */
export interface ResourceServerOptions {
  /**
   * Required scopes for this endpoint
   */
  requiredScopes?: string[];

  /**
   * Required resource for this endpoint
   */
  requiredResource?: string;

  /**
   * Whether authentication is optional
   */
  optional?: boolean;
}

/**
 * Resource server configuration
 */
export interface ResourceServerConfig {
  /**
   * JWT service for token validation
   * Should use the same keys as the authorization server
   */
  jwtService: JWTService;

  /**
   * Authorization server's JWKS URL for remote key fetching
   * Alternative to providing jwtService
   */
  jwksUrl?: string;

  /**
   * Expected token issuer (authorization server URL)
   */
  issuer: string;

  /**
   * Expected audience (this resource server's identifier)
   */
  audience?: string;
}

/**
 * Default resource server configuration
 */
let defaultResourceServerConfig: ResourceServerConfig | null = null;

/**
 * Configure the resource server
 */
export function configureResourceServer(config: ResourceServerConfig): void {
  defaultResourceServerConfig = config;
  console.error('[ResourceServer] Configured with issuer:', config.issuer);
}

/**
 * Get resource server configuration
 */
export function getResourceServerConfig(): ResourceServerConfig {
  if (!defaultResourceServerConfig) {
    throw new Error(
      'Resource server not configured. Call configureResourceServer() first.'
    );
  }
  return defaultResourceServerConfig;
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Expected format: "Bearer <token>"
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Send OAuth error response
 */
function sendOAuthError(
  res: Response,
  error: string,
  errorDescription?: string,
  statusCode: number = 401
): void {
  res.status(statusCode).json({
    error,
    error_description: errorDescription,
  });
}

/**
 * Validate access token middleware
 *
 * Validates Bearer tokens issued by the authorization server.
 * Does NOT issue tokens.
 *
 * @param options Validation options
 * @returns Express middleware
 */
export function validateAccessToken(options: ResourceServerOptions = {}): (
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const config = getResourceServerConfig();

    // Extract token
    const token = extractBearerToken(req);

    if (!token) {
      if (options.optional) {
        return next();
      }

      return sendOAuthError(
        res,
        'invalid_request',
        'Missing or invalid Authorization header. Expected: Authorization: Bearer <token>',
        401
      );
    }

    // Validate token
    const verification = config.jwtService.verifyToken(token, {
      issuer: config.issuer,
      audience: config.audience,
    });

    if (!verification.valid || !verification.payload) {
      return sendOAuthError(
        res,
        'invalid_token',
        verification.error || 'Token validation failed',
        401
      );
    }

    // Add OAuth context to request
    const oauthReq = req as ResourceServerRequest;
    oauthReq.oauth = {
      token,
      payload: verification.payload,
      clientId: verification.payload.sub || verification.payload.client_id || 'unknown',
      scopes: verification.payload.scope
        ? verification.payload.scope.split(' ')
        : [],
      resources: verification.payload.resource
        ? Array.isArray(verification.payload.resource)
          ? verification.payload.resource
          : [verification.payload.resource]
        : undefined,
    };

    next();
  };
}

/**
 * Require specific scopes middleware
 *
 * Enforces that the token has at least one of the required scopes.
 *
 * @param requiredScopes Required scopes (any of them must be present)
 * @returns Express middleware
 */
export function requireScopes(requiredScopes: string[]): (
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const oauthReq = req as ResourceServerRequest;

    if (!oauthReq.oauth) {
      return sendOAuthError(
        res,
        'invalid_request',
        'Authentication required',
        401
      );
    }

    const tokenScopes = oauthReq.oauth.scopes;
    const hasRequiredScope = requiredScopes.some((scope) =>
      tokenScopes.includes(scope)
    );

    if (!hasRequiredScope) {
      return sendOAuthError(
        res,
        'insufficient_scope',
        `Required scopes: ${requiredScopes.join(', ')}. Token scopes: ${tokenScopes.join(', ')}`,
        403
      );
    }

    next();
  };
}

/**
 * Require specific resource middleware (RFC 8707)
 *
 * Validates that the token is authorized for the requested resource.
 *
 * @param resource Required resource URI
 * @returns Express middleware
 */
export function requireResource(resource: string): (
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const oauthReq = req as ResourceServerRequest;

    if (!oauthReq.oauth) {
      return sendOAuthError(
        res,
        'invalid_request',
        'Authentication required',
        401
      );
    }

    const resourceService = getResourceIndicatorService();
    const tokenResources = oauthReq.oauth.resources;

    if (!resourceService.isTokenValidForResource(tokenResources, resource)) {
      return sendOAuthError(
        res,
        'invalid_token',
        `Token not authorized for resource: ${resource}. Token resources: ${tokenResources?.join(', ') || 'none'}`,
        403
      );
    }

    next();
  };
}

/**
 * Combined authorization middleware for resource servers
 *
 * Validates token, scopes, and resources in one step.
 *
 * @param options Middleware options
 * @returns Express middleware
 */
export function authorizeResourceAccess(options: ResourceServerOptions = {}): (
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    // First, validate token
    validateAccessToken(options)(req, res, (authError?: any) => {
      if (authError) {
        return next(authError);
      }

      const oauthReq = req as ResourceServerRequest;

      // If authentication was optional and no token, skip authorization
      if (options.optional && !oauthReq.oauth) {
        return next();
      }

      // Validate scopes if required
      if (options.requiredScopes && options.requiredScopes.length > 0) {
        requireScopes(options.requiredScopes)(req, res, (scopeError?: any) => {
          if (scopeError) {
            return next(scopeError);
          }

          // Validate resource if required
          if (options.requiredResource) {
            requireResource(options.requiredResource)(req, res, next);
          } else {
            next();
          }
        });
      } else if (options.requiredResource) {
        // Validate resource without scopes
        requireResource(options.requiredResource)(req, res, next);
      } else {
        // No additional validation needed
        next();
      }
    });
  };
}

/**
 * Helper to protect MCP resources
 *
 * Combines token validation and authorization into a single middleware.
 *
 * @example
 * ```typescript
 * app.get('/mcp/tools',
 *   protectResource({ requiredScopes: ['mcp.tools.read'], requiredResource: 'mcp://tools' }),
 *   (req, res) => { ... }
 * );
 * ```
 */
export function protectResource(options: ResourceServerOptions = {}): (
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  return authorizeResourceAccess(options);
}
