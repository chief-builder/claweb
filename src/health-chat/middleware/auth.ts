/**
 * OAuth Authentication Middleware for Health-Chat
 *
 * Provides JWT validation, user context extraction, and OAuth flow support
 * for the health-chat application.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { JWTService, JWTPayload } from '../../auth/oauth/jwt.js';
import { PKCEService, CodeChallengeMethod } from '../../auth/oauth/pkce.js';
import crypto from 'crypto';

/**
 * Authenticated user context from JWT
 */
export interface AuthenticatedUser {
  userId: string;
  email?: string;
  name?: string;
  roles?: string[];
  scopes: string[];
  clientId: string;
  authMethod: 'oauth' | 'anonymous';
}

/**
 * Extended request with user context
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * OAuth configuration for health-chat
 */
export interface HealthChatOAuthConfig {
  /** Authorization server URL */
  authServerUrl: string;
  /** Client ID for health-chat */
  clientId: string;
  /** Redirect URI after authentication */
  redirectUri: string;
  /** Required scopes */
  scopes: string[];
  /** JWT service for token validation */
  jwtService: JWTService;
  /** Whether authentication is required (false allows anonymous) */
  requireAuth: boolean;
}

/**
 * OAuth token response
 */
interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

/**
 * PKCE state storage (in-memory for demo, use Redis in production)
 */
interface PKCEState {
  codeVerifier: string;
  state: string;
  createdAt: number;
  redirectAfterAuth?: string;
}

const pkceStates = new Map<string, PKCEState>();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes
  for (const [key, value] of pkceStates.entries()) {
    if (now - value.createdAt > maxAge) {
      pkceStates.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Token storage for authenticated sessions
 * Maps sessionId -> tokens
 */
interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  user: AuthenticatedUser;
}

const tokenStore = new Map<string, StoredTokens>();

/**
 * Default OAuth configuration
 */
let oauthConfig: HealthChatOAuthConfig | null = null;

/**
 * Configure OAuth for health-chat
 */
export function configureHealthChatOAuth(config: HealthChatOAuthConfig): void {
  oauthConfig = config;
}

/**
 * Get OAuth configuration
 */
export function getHealthChatOAuthConfig(): HealthChatOAuthConfig | null {
  return oauthConfig;
}

/**
 * Extract Bearer token from request
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

/**
 * Extract access token from cookie
 */
function extractTokenFromCookie(req: Request): string | null {
  const cookies = req.headers.cookie;
  if (!cookies) return null;

  const match = cookies.match(/health_chat_token=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * JWT validation middleware for health-chat
 *
 * Validates Bearer tokens and extracts user context.
 * Supports both required and optional authentication.
 */
export function jwtAuth(options: { required?: boolean } = {}): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    // Try to extract token from Authorization header or cookie
    const token = extractBearerToken(req) || extractTokenFromCookie(req);

    if (!token) {
      if (options.required !== false) {
        res.status(401).json({
          error: 'authentication_required',
          message: 'Please log in to access this resource',
          loginUrl: '/auth/login',
        });
        return;
      }
      // Anonymous access allowed
      authReq.user = {
        userId: 'anonymous',
        scopes: [],
        clientId: 'anonymous',
        authMethod: 'anonymous',
      };
      next();
      return;
    }

    // Validate token
    if (!oauthConfig) {
      res.status(500).json({
        error: 'configuration_error',
        message: 'OAuth not configured',
      });
      return;
    }

    const verification = oauthConfig.jwtService.verifyToken(token);

    if (!verification.valid || !verification.payload) {
      res.status(401).json({
        error: 'invalid_token',
        message: verification.error || 'Token validation failed',
        loginUrl: '/auth/login',
      });
      return;
    }

    const payload = verification.payload;

    // Extract user context from JWT
    authReq.user = {
      userId: payload.sub,
      email: payload.user_email || payload.email,
      name: payload.user_name || payload.name,
      roles: payload.user_roles || payload.roles || [],
      scopes: payload.scope ? payload.scope.split(' ') : [],
      clientId: payload.client_id,
      authMethod: 'oauth',
    };

    next();
  };
}

/**
 * Scope validation middleware
 */
export function requireScopes(requiredScopes: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({
        error: 'authentication_required',
        message: 'Authentication required',
      });
      return;
    }

    const userScopes = authReq.user.scopes;
    const hasScope = requiredScopes.some((scope) => userScopes.includes(scope));

    if (!hasScope) {
      res.status(403).json({
        error: 'insufficient_scope',
        message: `Required scopes: ${requiredScopes.join(', ')}`,
        requiredScopes,
        userScopes,
      });
      return;
    }

    next();
  };
}

/**
 * Generate PKCE parameters and state for authorization
 */
export function generateAuthorizationParams(): {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: CodeChallengeMethod;
} {
  const state = crypto.randomBytes(32).toString('hex');
  const codeVerifier = PKCEService.generateCodeVerifier();
  const codeChallenge = PKCEService.generateCodeChallenge(
    codeVerifier,
    CodeChallengeMethod.S256
  );

  // Store for later verification
  pkceStates.set(state, {
    codeVerifier,
    state,
    createdAt: Date.now(),
  });

  return {
    state,
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: CodeChallengeMethod.S256,
  };
}

/**
 * Retrieve and validate PKCE state
 */
export function validateAuthorizationState(state: string): PKCEState | null {
  const stored = pkceStates.get(state);
  if (!stored) return null;

  // Remove after retrieval (one-time use)
  pkceStates.delete(state);

  // Check expiration (10 minutes)
  const maxAge = 10 * 60 * 1000;
  if (Date.now() - stored.createdAt > maxAge) {
    return null;
  }

  return stored;
}

/**
 * Store tokens for a session
 */
export function storeTokens(
  sessionId: string,
  accessToken: string,
  refreshToken: string | undefined,
  user: AuthenticatedUser,
  expiresIn: number = 3600
): void {
  tokenStore.set(sessionId, {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    user,
  });
}

/**
 * Get stored tokens for a session
 */
export function getStoredTokens(sessionId: string): StoredTokens | null {
  const stored = tokenStore.get(sessionId);
  if (!stored) return null;

  // Check if expired
  if (Date.now() > stored.expiresAt) {
    tokenStore.delete(sessionId);
    return null;
  }

  return stored;
}

/**
 * Clear tokens for a session (logout)
 */
export function clearStoredTokens(sessionId: string): void {
  tokenStore.delete(sessionId);
}

/**
 * Get user from stored tokens
 */
export function getUserFromSession(sessionId: string): AuthenticatedUser | null {
  const stored = getStoredTokens(sessionId);
  return stored?.user || null;
}

/**
 * Build authorization URL for OAuth redirect
 */
export function buildAuthorizationUrl(
  state: string,
  codeChallenge: string,
  codeChallengeMethod: CodeChallengeMethod
): string {
  if (!oauthConfig) {
    throw new Error('OAuth not configured');
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: oauthConfig.clientId,
    redirect_uri: oauthConfig.redirectUri,
    scope: oauthConfig.scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
  });

  return `${oauthConfig.authServerUrl}/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  user: AuthenticatedUser;
} | null> {
  if (!oauthConfig) {
    throw new Error('OAuth not configured');
  }

  try {
    const response = await fetch(`${oauthConfig.authServerUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: oauthConfig.redirectUri,
        client_id: oauthConfig.clientId,
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!response.ok) {
      console.error('[OAuth] Token exchange failed:', await response.text());
      return null;
    }

    const data = await response.json() as OAuthTokenResponse;

    // Decode the access token to get user info
    const payload = oauthConfig.jwtService.decodeToken(data.access_token);

    if (!payload) {
      console.error('[OAuth] Failed to decode access token');
      return null;
    }

    const user: AuthenticatedUser = {
      userId: payload.sub,
      email: payload.user_email || payload.email || `${payload.client_id}@health-chat.local`,
      name: payload.user_name || payload.name || 'Healthcare User',
      roles: payload.user_roles || payload.roles || [],
      scopes: payload.scope ? payload.scope.split(' ') : [],
      clientId: payload.client_id,
      authMethod: 'oauth',
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 3600,
      tokenType: data.token_type || 'Bearer',
      user,
    };
  } catch (error) {
    console.error('[OAuth] Token exchange error:', error);
    return null;
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
} | null> {
  if (!oauthConfig) {
    throw new Error('OAuth not configured');
  }

  try {
    const response = await fetch(`${oauthConfig.authServerUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: oauthConfig.clientId,
      }).toString(),
    });

    if (!response.ok) {
      console.error('[OAuth] Token refresh failed:', await response.text());
      return null;
    }

    const data = await response.json() as OAuthTokenResponse;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 3600,
    };
  } catch (error) {
    console.error('[OAuth] Token refresh error:', error);
    return null;
  }
}

/**
 * Revoke tokens (logout)
 */
export async function revokeToken(token: string): Promise<boolean> {
  if (!oauthConfig) {
    return false;
  }

  try {
    const response = await fetch(`${oauthConfig.authServerUrl}/oauth/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token,
        client_id: oauthConfig.clientId,
      }).toString(),
    });

    return response.ok;
  } catch (error) {
    console.error('[OAuth] Token revocation error:', error);
    return false;
  }
}
