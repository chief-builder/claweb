/**
 * OAuth 2.0 Middleware for HTTP Transport
 *
 * Provides authentication and authorization middleware for Express.js
 * Validates Bearer tokens, scopes, and resource indicators (RFC 8707)
 */

import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../oauth/jwt.js';
import { getResourceIndicatorService } from '../rfc8707/indicators.js';

/**
 * Extended request with OAuth context
 */
export interface OAuthRequest extends Request {
  oauth?: {
    token: string;
    payload: any;
    clientId: string;
    scopes: string[];
    resources?: string[];
  };
}

/**
 * OAuth middleware options
 */
export interface OAuthMiddlewareOptions {
  /**
   * Required scopes for this endpoint
   */
  requiredScopes?: string[];

  /**
   * Required resource for this endpoint
   */
  requiredResource?: string;

  /**
   * Whether to allow requests without authentication
   */
  optional?: boolean;

  /**
   * Custom JWT service instance
   */
  jwtService?: JWTService;
}

/**
 * OAuth middleware configuration
 */
export interface OAuthConfig {
  /**
   * JWT service for token validation
   */
  jwtService: JWTService;

  /**
   * Whether OAuth is enabled
   */
  enabled: boolean;
}

/**
 * Default OAuth configuration
 */
let defaultOAuthConfig: OAuthConfig | null = null;

/**
 * Configure OAuth middleware
 */
export function configureOAuth(config: OAuthConfig): void {
  defaultOAuthConfig = config;
}

/**
 * Get OAuth configuration
 */
export function getOAuthConfig(): OAuthConfig {
  if (!defaultOAuthConfig) {
    // Default configuration with OAuth disabled
    return {
      jwtService: new JWTService(),
      enabled: false,
    };
  }
  return defaultOAuthConfig;
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
 * OAuth authentication middleware
 *
 * Validates Bearer tokens and adds OAuth context to request
 *
 * @param options Middleware options
 * @returns Express middleware
 */
export function authenticate(options: OAuthMiddlewareOptions = {}): (
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const config = getOAuthConfig();
    const jwtService = options.jwtService || config.jwtService;

    // If OAuth is disabled and endpoint doesn't require it, skip
    if (!config.enabled && options.optional) {
      return next();
    }

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
    const verification = jwtService.verifyToken(token);

    if (!verification.valid || !verification.payload) {
      return sendOAuthError(
        res,
        'invalid_token',
        verification.error || 'Token validation failed',
        401
      );
    }

    // Add OAuth context to request
    const oauthReq = req as OAuthRequest;
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
 * Scope validation middleware
 *
 * Requires specific scopes to be present in the token
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
    const oauthReq = req as OAuthRequest;

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
 * Resource validation middleware (RFC 8707)
 *
 * Validates that the token is authorized for the requested resource
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
    const oauthReq = req as OAuthRequest;

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
 * Combined authentication and authorization middleware
 *
 * Validates token, scopes, and resources in one step
 *
 * @param options Middleware options
 * @returns Express middleware
 */
export function authorize(options: OAuthMiddlewareOptions = {}): (
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    // First, authenticate
    authenticate(options)(req, res, (authError?: any) => {
      if (authError) {
        return next(authError);
      }

      const oauthReq = req as OAuthRequest;

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
 * OAuth error handler middleware
 *
 * Catches OAuth errors and formats them properly
 */
export function oauthErrorHandler(): (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    // Only handle OAuth-related errors
    if (
      err.error &&
      (err.error === 'invalid_token' ||
        err.error === 'invalid_request' ||
        err.error === 'insufficient_scope')
    ) {
      sendOAuthError(
        res,
        err.error,
        err.error_description,
        err.statusCode || 401
      );
    } else {
      // Pass to next error handler
      next(err);
    }
  };
}

/**
 * Helper to create protected endpoint
 *
 * Combines authentication and authorization into a single middleware
 *
 * @example
 * ```typescript
 * app.get('/api/tools',
 *   protect({ requiredScopes: ['mcp.tools.read'], requiredResource: 'mcp://tools' }),
 *   (req, res) => { ... }
 * );
 * ```
 */
export function protect(options: OAuthMiddlewareOptions = {}): (
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  return authorize(options);
}
