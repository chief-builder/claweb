/**
 * OAuth 2.0 Endpoints
 *
 * Implements OAuth 2.0 server endpoints:
 * - Authorization endpoint
 * - Token endpoint
 * - Registration endpoint
 * - Introspection endpoint
 * - JWKS endpoint
 * - Discovery endpoint
 */

import { Request, Response, Router } from 'express';
import { OAuthDiscoveryService } from '../oauth/discovery.js';
import { PKCEService, PKCEStore, CodeChallengeMethod } from '../oauth/pkce.js';
import { JWTService } from '../oauth/jwt.js';
import { ClientRegistrationService } from '../oauth/registration.js';
import { TokenIntrospectionService } from '../oauth/introspection.js';
import { TokenRevocationService } from '../oauth/revocation.js';
import { getResourceIndicatorService } from '../rfc8707/indicators.js';
import { authenticate } from '../middleware/oauth.js';
import { Auth0Bridge } from '../sso/auth0-bridge.js';

/**
 * OAuth endpoints configuration
 */
export interface OAuthEndpointsConfig {
  /**
   * Base URL for the OAuth server (e.g., "http://localhost:3000")
   */
  issuer: string;

  /**
   * JWT service instance
   */
  jwtService: JWTService;

  /**
   * Client registration service
   */
  registrationService: ClientRegistrationService;

  /**
   * Token introspection service
   */
  introspectionService: TokenIntrospectionService;

  /**
   * Token revocation service
   */
  revocationService: TokenRevocationService;

  /**
   * PKCE store
   */
  pkceStore: PKCEStore;

  /**
   * Enable interactive consent page (default: false)
   */
  interactiveConsent?: boolean;

  /**
   * Auth0 SSO bridge (optional)
   */
  auth0Bridge?: Auth0Bridge;
}

/**
 * In-memory authorization code store (for development)
 * In production, use a persistent database
 */
interface AuthorizationCode {
  code: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  resources?: string[];
  codeChallenge?: string;
  codeChallengeMethod?: string;
  expiresAt: Date;
  used: boolean;
  // User claims from SSO (if authenticated via Auth0)
  userClaims?: {
    sub: string;
    email?: string;
    name?: string;
    department?: string;
    employee_id?: string;
    cost_center?: string;
    groups?: string[];
    roles?: string[];
  };
}

const authorizationCodes = new Map<string, AuthorizationCode>();

/**
 * SSO state store (temporary storage for OAuth params during SSO redirect)
 * State -> OAuth parameters
 */
interface SSOState {
  client_id: string;
  redirect_uri: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  resource?: string | string[];
  expiresAt: Date;
}

const ssoStates = new Map<string, SSOState>();

/**
 * Generate random authorization code
 */
function generateAuthorizationCode(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

/**
 * Create OAuth endpoints router
 */
export function createOAuthRouter(config: OAuthEndpointsConfig): Router {
  const router = Router();
  const discovery = new OAuthDiscoveryService(config.issuer);
  const resourceService = getResourceIndicatorService();

  /**
   * OAuth 2.0 Authorization Server Metadata (RFC 8414)
   * GET /.well-known/oauth-authorization-server
   */
  router.get('/.well-known/oauth-authorization-server', (req: Request, res: Response) => {
    const metadata = discovery.getMetadata();
    res.json(metadata);
  });

  /**
   * JWKS endpoint (JSON Web Key Set)
   * GET /oauth/jwks
   */
  router.get('/oauth/jwks', async (req: Request, res: Response) => {
    try {
      const jwks = await config.jwtService.getJWKS();
      res.json(jwks);
    } catch (error) {
      res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to retrieve JWKS',
      });
    }
  });

  /**
   * Authorization endpoint
   * GET /oauth/authorize
   *
   * Handles OAuth 2.0 authorization code flow with PKCE
   */
  router.get('/oauth/authorize', async (req: Request, res: Response) => {
    try {
      const {
        response_type,
        client_id,
        redirect_uri,
        scope,
        state,
        code_challenge,
        code_challenge_method,
        resource,
      } = req.query;

      // Validate required parameters
      if (!response_type || response_type !== 'code') {
        return res.status(400).json({
          error: 'unsupported_response_type',
          error_description: 'Only "code" response type is supported',
        });
      }

      if (!client_id || typeof client_id !== 'string') {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing or invalid client_id',
        });
      }

      if (!redirect_uri || typeof redirect_uri !== 'string') {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing or invalid redirect_uri',
        });
      }

      // Validate redirect URI
      const isValidRedirect = await config.registrationService.validateRedirectUri(
        client_id,
        redirect_uri
      );

      if (!isValidRedirect) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Invalid redirect_uri for this client',
        });
      }

      // Validate PKCE (required for public clients)
      if (code_challenge && typeof code_challenge !== 'string') {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Invalid code_challenge',
        });
      }

      const challengeMethod =
        typeof code_challenge_method === 'string' ? code_challenge_method : 'S256';

      // Validate resource indicators (RFC 8707)
      let resources: string[] | undefined;
      if (resource) {
        const resourceArray = Array.isArray(resource) ? resource : [resource];
        const validation = resourceService.validateResourceRequest({
          resource: resourceArray as string[],
          scope: typeof scope === 'string' ? scope : undefined,
        });

        if (!validation.valid) {
          return res.status(400).json({
            error: 'invalid_target',
            error_description: validation.errors?.join(', '),
          });
        }

        resources = validation.resources;
      }

      // If Auth0 SSO is enabled, redirect to Auth0 for authentication
      if (config.auth0Bridge) {
        // Generate SSO state to preserve OAuth parameters
        const ssoState = generateAuthorizationCode(); // Reuse for simplicity
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        ssoStates.set(ssoState, {
          client_id: client_id,
          redirect_uri: redirect_uri,
          scope: typeof scope === 'string' ? scope : undefined,
          state: typeof state === 'string' ? state : undefined,
          code_challenge: typeof code_challenge === 'string' ? code_challenge : undefined,
          code_challenge_method: challengeMethod,
          resource: resource,
          expiresAt,
        });

        // Clean up expired states
        setTimeout(() => {
          ssoStates.delete(ssoState);
        }, 10 * 60 * 1000);

        // Redirect to Auth0
        const auth0Url = config.auth0Bridge.getAuthorizationUrl(ssoState);
        console.log(`[OAuth] Redirecting to Auth0 for SSO authentication`);
        console.log(`[OAuth]   State: ${ssoState}`);
        console.log(`[OAuth]   Client: ${client_id}`);
        return res.redirect(auth0Url);
      }

      // If interactive consent is enabled, show consent page
      if (config.interactiveConsent) {
        // Build consent page URL with parameters
        const consentUrl = new URL('/static/consent.html', config.issuer);
        consentUrl.searchParams.set('client_id', client_id);
        consentUrl.searchParams.set('redirect_uri', redirect_uri);
        if (scope && typeof scope === 'string') {
          consentUrl.searchParams.set('scope', scope);
        }
        if (state && typeof state === 'string') {
          consentUrl.searchParams.set('state', state);
        }
        if (resource) {
          const resourceArray = Array.isArray(resource) ? resource : [resource];
          resourceArray.forEach(r => consentUrl.searchParams.append('resource', r as string));
        }
        if (code_challenge && typeof code_challenge === 'string') {
          consentUrl.searchParams.set('code_challenge', code_challenge);
        }
        if (challengeMethod) {
          consentUrl.searchParams.set('code_challenge_method', challengeMethod);
        }

        // Redirect to consent page
        return res.redirect(consentUrl.toString());
      }

      // Auto-approve (for non-interactive flows or testing)
      // Generate authorization code
      const code = generateAuthorizationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      authorizationCodes.set(code, {
        code,
        clientId: client_id,
        redirectUri: redirect_uri,
        scopes: typeof scope === 'string' ? scope.split(' ') : [],
        resources,
        codeChallenge: typeof code_challenge === 'string' ? code_challenge : undefined,
        codeChallengeMethod: challengeMethod,
        expiresAt,
        used: false,
      });

      // Build redirect URL
      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set('code', code);
      if (state && typeof state === 'string') {
        redirectUrl.searchParams.set('state', state);
      }

      // Redirect back to client
      res.redirect(redirectUrl.toString());
    } catch (error) {
      res.status(500).json({
        error: 'server_error',
        error_description: error instanceof Error ? error.message : 'Authorization failed',
      });
    }
  });

  /**
   * SSO Callback endpoint
   * GET /oauth/sso/callback
   *
   * Handles callback from Auth0 after user authentication
   */
  router.get('/oauth/sso/callback', async (req: Request, res: Response) => {
    try {
      const { code, state, error, error_description } = req.query;

      // Handle Auth0 errors
      if (error) {
        console.error('[SSO] Auth0 returned error:', error, error_description);
        return res.status(400).json({
          error: typeof error === 'string' ? error : 'sso_error',
          error_description: typeof error_description === 'string' ? error_description : 'SSO authentication failed',
        });
      }

      // Validate parameters
      if (!code || typeof code !== 'string') {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing authorization code from SSO provider',
        });
      }

      if (!state || typeof state !== 'string') {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing state parameter',
        });
      }

      // Retrieve original OAuth parameters
      const ssoState = ssoStates.get(state);
      if (!ssoState) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Invalid or expired SSO state',
        });
      }

      // Check if state expired
      if (ssoState.expiresAt < new Date()) {
        ssoStates.delete(state);
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'SSO state expired',
        });
      }

      // Exchange Auth0 code for user claims
      if (!config.auth0Bridge) {
        return res.status(500).json({
          error: 'server_error',
          error_description: 'Auth0 bridge not configured',
        });
      }

      let userClaims;
      try {
        userClaims = await config.auth0Bridge.authenticateUser(code, state);
        console.log('[SSO] User authenticated via Auth0');
        console.log(`[SSO]   Subject: ${userClaims.sub}`);
        console.log(`[SSO]   Email: ${userClaims.email || 'N/A'}`);
        console.log(`[SSO]   Name: ${userClaims.name || 'N/A'}`);
        console.log(`[SSO]   Department: ${userClaims.department || 'N/A'}`);
      } catch (error) {
        console.error('[SSO] Failed to authenticate user:', error);
        return res.status(500).json({
          error: 'server_error',
          error_description: 'Failed to authenticate user with SSO provider',
        });
      }

      // Clean up SSO state
      ssoStates.delete(state);

      // Validate resource indicators from original request
      let resources: string[] | undefined;
      if (ssoState.resource) {
        const resourceArray = Array.isArray(ssoState.resource)
          ? ssoState.resource
          : [ssoState.resource];
        const validation = resourceService.validateResourceRequest({
          resource: resourceArray as string[],
          scope: ssoState.scope,
        });

        if (!validation.valid) {
          return res.status(400).json({
            error: 'invalid_target',
            error_description: validation.errors?.join(', '),
          });
        }

        resources = validation.resources;
      }

      // If interactive consent is enabled, show consent page with user context
      if (config.interactiveConsent) {
        const consentUrl = new URL('/static/consent.html', config.issuer);
        consentUrl.searchParams.set('client_id', ssoState.client_id);
        consentUrl.searchParams.set('redirect_uri', ssoState.redirect_uri);
        if (ssoState.scope) {
          consentUrl.searchParams.set('scope', ssoState.scope);
        }
        if (ssoState.state) {
          consentUrl.searchParams.set('state', ssoState.state);
        }
        if (ssoState.resource) {
          const resourceArray = Array.isArray(ssoState.resource)
            ? ssoState.resource
            : [ssoState.resource];
          resourceArray.forEach(r => consentUrl.searchParams.append('resource', r as string));
        }
        if (ssoState.code_challenge) {
          consentUrl.searchParams.set('code_challenge', ssoState.code_challenge);
        }
        if (ssoState.code_challenge_method) {
          consentUrl.searchParams.set('code_challenge_method', ssoState.code_challenge_method);
        }

        // Add user context for consent page display
        consentUrl.searchParams.set('user_email', userClaims.email || '');
        consentUrl.searchParams.set('user_name', userClaims.name || '');

        console.log('[SSO] Redirecting to consent page with user context');
        return res.redirect(consentUrl.toString());
      }

      // Auto-approve: Generate authorization code with user claims
      const authCode = generateAuthorizationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      authorizationCodes.set(authCode, {
        code: authCode,
        clientId: ssoState.client_id,
        redirectUri: ssoState.redirect_uri,
        scopes: ssoState.scope ? ssoState.scope.split(' ') : [],
        resources,
        codeChallenge: ssoState.code_challenge,
        codeChallengeMethod: ssoState.code_challenge_method,
        expiresAt,
        used: false,
        userClaims: {
          sub: userClaims.sub,
          email: userClaims.email,
          name: userClaims.name,
          department: userClaims.department,
          employee_id: userClaims.employee_id,
          cost_center: userClaims.cost_center,
          groups: userClaims.groups,
          roles: userClaims.roles,
        },
      });

      console.log('[SSO] Generated authorization code with user context');
      console.log(`[SSO]   Code: ${authCode.substring(0, 8)}...`);
      console.log(`[SSO]   User: ${userClaims.email || userClaims.sub}`);

      // Redirect back to client with authorization code
      const redirectUrl = new URL(ssoState.redirect_uri);
      redirectUrl.searchParams.set('code', authCode);
      if (ssoState.state) {
        redirectUrl.searchParams.set('state', ssoState.state);
      }

      res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('[SSO] Callback error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: error instanceof Error ? error.message : 'SSO callback failed',
      });
    }
  });

  /**
   * Authorization approval endpoint
   * GET /oauth/authorize/approve
   *
   * Handles user consent approval (called from consent page)
   */
  router.get('/oauth/authorize/approve', async (req: Request, res: Response) => {
    try {
      const {
        client_id,
        redirect_uri,
        scope,
        state,
        code_challenge,
        code_challenge_method,
        resource,
      } = req.query;

      // Validate required parameters
      if (!client_id || typeof client_id !== 'string') {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing or invalid client_id',
        });
      }

      if (!redirect_uri || typeof redirect_uri !== 'string') {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing or invalid redirect_uri',
        });
      }

      // Validate resource indicators (RFC 8707)
      let resources: string[] | undefined;
      if (resource) {
        const resourceArray = Array.isArray(resource) ? resource : [resource];
        const validation = resourceService.validateResourceRequest({
          resource: resourceArray as string[],
          scope: typeof scope === 'string' ? scope : undefined,
        });

        if (!validation.valid) {
          return res.status(400).json({
            error: 'invalid_target',
            error_description: validation.errors?.join(', '),
          });
        }

        resources = validation.resources;
      }

      const challengeMethod =
        typeof code_challenge_method === 'string' ? code_challenge_method : 'S256';

      // Generate authorization code
      const code = generateAuthorizationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      authorizationCodes.set(code, {
        code,
        clientId: client_id,
        redirectUri: redirect_uri,
        scopes: typeof scope === 'string' ? scope.split(' ') : [],
        resources,
        codeChallenge: typeof code_challenge === 'string' ? code_challenge : undefined,
        codeChallengeMethod: challengeMethod,
        expiresAt,
        used: false,
      });

      // Build redirect URL
      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set('code', code);
      if (state && typeof state === 'string') {
        redirectUrl.searchParams.set('state', state);
      }

      // Redirect back to client with authorization code
      res.redirect(redirectUrl.toString());
    } catch (error) {
      res.status(500).json({
        error: 'server_error',
        error_description: error instanceof Error ? error.message : 'Authorization approval failed',
      });
    }
  });

  /**
   * Token endpoint
   * POST /oauth/token
   *
   * Handles token requests for:
   * - Authorization code grant
   * - Client credentials grant
   * - Refresh token grant
   */
  router.post('/oauth/token', async (req: Request, res: Response) => {
    try {
      const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier, refresh_token, scope, resource } =
        req.body;

      // Validate grant type
      if (!grant_type) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing grant_type',
        });
      }

      // Handle authorization code grant
      if (grant_type === 'authorization_code') {
        if (!code || !redirect_uri || !client_id) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing required parameters',
          });
        }

        // Validate authorization code
        const authCode = authorizationCodes.get(code);

        if (!authCode) {
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Invalid authorization code',
          });
        }

        if (authCode.used) {
          // Code reuse detected - revoke all tokens for this client
          authorizationCodes.delete(code);
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Authorization code already used',
          });
        }

        if (authCode.expiresAt < new Date()) {
          authorizationCodes.delete(code);
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Authorization code expired',
          });
        }

        if (authCode.clientId !== client_id || authCode.redirectUri !== redirect_uri) {
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Client mismatch',
          });
        }

        // Validate PKCE
        if (authCode.codeChallenge) {
          if (!code_verifier) {
            return res.status(400).json({
              error: 'invalid_request',
              error_description: 'Missing code_verifier for PKCE',
            });
          }

          const pkceValidation = PKCEService.validatePKCE(
            code_verifier,
            authCode.codeChallenge,
            authCode.codeChallengeMethod as CodeChallengeMethod
          );

          if (!pkceValidation.valid) {
            return res.status(400).json({
              error: 'invalid_grant',
              error_description: 'PKCE validation failed',
            });
          }
        }

        // Mark code as used
        authCode.used = true;

        // Generate tokens with user context (if available from SSO)
        const tokenClaims: any = {
          sub: authCode.userClaims?.sub || client_id,
          client_id,
          scope: authCode.scopes.join(' '),
          resource: authCode.resources,
        };

        // Add user metadata if available (from SSO authentication)
        if (authCode.userClaims) {
          tokenClaims.user_email = authCode.userClaims.email;
          tokenClaims.user_name = authCode.userClaims.name;
          tokenClaims.user_department = authCode.userClaims.department;
          tokenClaims.employee_id = authCode.userClaims.employee_id;
          tokenClaims.cost_center = authCode.userClaims.cost_center;
          tokenClaims.user_groups = authCode.userClaims.groups;
          tokenClaims.user_roles = authCode.userClaims.roles;

          console.log('[Token] Issuing token with user context');
          console.log(`[Token]   User: ${authCode.userClaims.email || authCode.userClaims.sub}`);
          console.log(`[Token]   Department: ${authCode.userClaims.department || 'N/A'}`);
          console.log(`[Token]   Client: ${client_id}`);
        }

        const accessToken = config.jwtService.createAccessToken(tokenClaims);

        const refreshToken = config.jwtService.createRefreshToken(tokenClaims);

        return res.json({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: refreshToken,
          scope: authCode.scopes.join(' '),
          resource: authCode.resources,
        });
      }

      // Handle client credentials grant
      if (grant_type === 'client_credentials') {
        if (!client_id || !client_secret) {
          return res.status(400).json({
            error: 'invalid_client',
            error_description: 'Missing client credentials',
          });
        }

        // Validate client credentials
        const isValid = await config.registrationService.validateCredentials(
          client_id,
          client_secret
        );

        if (!isValid) {
          return res.status(401).json({
            error: 'invalid_client',
            error_description: 'Invalid client credentials',
          });
        }

        // Validate resource indicators
        let resources: string[] | undefined;
        if (resource) {
          const resourceArray = Array.isArray(resource) ? resource : [resource];
          const validation = resourceService.validateResourceRequest({
            resource: resourceArray,
            scope,
          });

          if (!validation.valid) {
            return res.status(400).json({
              error: 'invalid_target',
              error_description: validation.errors?.join(', '),
            });
          }

          resources = validation.resources;
        }

        // Generate access token
        const accessToken = config.jwtService.createAccessToken({
          sub: client_id,
          client_id,
          scope: scope || '',
          resource: resources,
        });

        return res.json({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 3600,
          scope: scope || '',
          resource: resources,
        });
      }

      // Handle refresh token grant
      if (grant_type === 'refresh_token') {
        if (!refresh_token) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing refresh_token',
          });
        }

        const result = config.jwtService.refreshAccessToken(refresh_token);

        if (result.error) {
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: result.error,
          });
        }

        return res.json({
          access_token: result.accessToken,
          token_type: 'Bearer',
          expires_in: 3600,
        });
      }

      // Handle token exchange grant (RFC 8693)
      if (grant_type === 'urn:ietf:params:oauth:grant-type:token-exchange') {
        const {
          subject_token,
          subject_token_type,
          actor_token,
          actor_token_type,
          requested_token_type,
        } = req.body;

        // Validate required parameters
        if (!subject_token || !subject_token_type) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing subject_token or subject_token_type',
          });
        }

        // Currently only support access_token types
        const supportedTokenType = 'urn:ietf:params:oauth:token-type:access_token';
        if (subject_token_type !== supportedTokenType) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: `Unsupported subject_token_type. Only ${supportedTokenType} is supported.`,
          });
        }

        // Validate subject token (user's SSO token)
        const subjectValidation = config.jwtService.validateAccessToken(subject_token);
        if (!subjectValidation.valid || !subjectValidation.payload) {
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Invalid subject_token',
          });
        }

        const subjectClaims = subjectValidation.payload;

        // Validate actor token if provided (client/app token)
        let actorClaims = null;
        if (actor_token && actor_token_type) {
          if (actor_token_type !== supportedTokenType) {
            return res.status(400).json({
              error: 'invalid_request',
              error_description: `Unsupported actor_token_type. Only ${supportedTokenType} is supported.`,
            });
          }

          const actorValidation = config.jwtService.validateAccessToken(actor_token);
          if (!actorValidation.valid || !actorValidation.payload) {
            return res.status(400).json({
              error: 'invalid_grant',
              error_description: 'Invalid actor_token',
            });
          }

          actorClaims = actorValidation.payload;
        }

        // Validate resource indicators
        let resources: string[] | undefined;
        if (resource) {
          const resourceArray = Array.isArray(resource) ? resource : [resource];
          const validation = resourceService.validateResourceRequest({
            resource: resourceArray as string[],
            scope: scope || subjectClaims.scope,
          });

          if (!validation.valid) {
            return res.status(400).json({
              error: 'invalid_target',
              error_description: validation.errors?.join(', '),
            });
          }

          resources = validation.resources;
        }

        // Create exchanged token with user context and actor context
        const exchangedToken = config.jwtService.createAccessToken({
          sub: subjectClaims.sub, // User identity from SSO
          client_id: actorClaims?.client_id || client_id,
          scope: scope || subjectClaims.scope,
          resource: resources || subjectClaims.resource,

          // Actor claim (RFC 8693) - represents the app/IDE acting on behalf of user
          ...(actorClaims && {
            act: {
              sub: actorClaims.sub,
              client_id: actorClaims.client_id,
            },
          }),

          // User metadata for audit and authorization
          user_email: subjectClaims.user_email || subjectClaims.email,
          user_name: subjectClaims.user_name || subjectClaims.name,
          user_department: subjectClaims.user_department || subjectClaims.department,
          user_groups: subjectClaims.user_groups || subjectClaims.groups,
          user_roles: subjectClaims.user_roles || subjectClaims.roles,
          employee_id: subjectClaims.employee_id,
          cost_center: subjectClaims.cost_center,
        });

        console.log('[TokenExchange] Issued exchanged token');
        console.log(`[TokenExchange]   Subject: ${subjectClaims.sub}`);
        console.log(`[TokenExchange]   Actor: ${actorClaims?.sub || 'N/A'}`);
        console.log(`[TokenExchange]   Resource: ${resources?.join(', ') || 'N/A'}`);

        return res.json({
          access_token: exchangedToken,
          issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: scope || subjectClaims.scope,
          ...(resources && { resource: resources }),
        });
      }

      // Unsupported grant type
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: `Grant type "${grant_type}" is not supported`,
      });
    } catch (error) {
      res.status(500).json({
        error: 'server_error',
        error_description: error instanceof Error ? error.message : 'Token request failed',
      });
    }
  });

  /**
   * Dynamic Client Registration endpoint (RFC 7591)
   * POST /oauth/register
   */
  router.post('/oauth/register', async (req: Request, res: Response) => {
    try {
      const result = await config.registrationService.registerClient(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: error instanceof Error ? error.message : 'Registration failed',
      });
    }
  });

  /**
   * Token Introspection endpoint (RFC 7662)
   * POST /oauth/introspect
   */
  router.post('/oauth/introspect', authenticate({ optional: false, jwtService: config.jwtService }), async (req: Request, res: Response) => {
    try {
      const result = await config.introspectionService.introspect(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: 'server_error',
        error_description: error instanceof Error ? error.message : 'Introspection failed',
      });
    }
  });

  /**
   * Token Revocation endpoint (RFC 7009)
   * POST /oauth/revoke
   *
   * Allows clients to notify the authorization server that a previously
   * obtained token is no longer needed and should be invalidated.
   */
  router.post('/oauth/revoke', async (req: Request, res: Response) => {
    try {
      const result = await config.revocationService.revokeToken(req.body);

      // RFC 7009: The authorization server responds with HTTP 200
      // regardless of whether the token was successfully revoked
      // or if the client submitted an invalid token
      res.status(200).json(result.success ? {} : {
        error: result.error,
        error_description: result.error_description,
      });
    } catch (error) {
      // Per RFC 7009, return 200 even on error to prevent token scanning
      console.error('[OAuth] Revocation error:', error);
      res.status(200).json({});
    }
  });

  /**
   * Resource metadata endpoint (RFC 8707)
   * GET /oauth/resources
   */
  router.get('/oauth/resources', (req: Request, res: Response) => {
    const metadata = resourceService.getResourceMetadata();
    res.json(metadata);
  });

  return router;
}

/**
 * Create index/exports for auth endpoints
 */
export { createOAuthRouter as default };
