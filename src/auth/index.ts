/**
 * Authentication and Authorization Module
 *
 * Provides OAuth 2.0 and RFC 8707 support for MCP with clean role separation:
 * - Authorization Server: Issues tokens
 * - Resource Server: Validates tokens and serves protected resources
 * - Client: Obtains and uses tokens
 */

// ============================================================================
// OAuth 2.0 Role Separation
// ============================================================================

// Authorization Server (issues tokens)
export { AuthorizationServer, createAuthorizationServer } from './authorization-server/server.js';
export type { AuthorizationServerConfig } from './authorization-server/server.js';

// Resource Server (validates tokens, serves protected resources)
export { HttpResourceServerTransport } from '../transport/http/resource-server-transport.js';
export type { HttpResourceServerConfig } from '../transport/http/resource-server-transport.js';
export {
  configureResourceServer,
  validateAccessToken,
  requireScopes,
  requireResource,
  authorizeResourceAccess,
  protectResource,
} from './resource-server/middleware.js';
export type {
  ResourceServerRequest,
  ResourceServerOptions,
  ResourceServerConfig,
} from './resource-server/middleware.js';

// OAuth Client (obtains and uses tokens)
export { OAuthClient, createOAuthClient } from './client/oauth-client.js';
export type {
  OAuthClientConfig,
  TokenSet,
  AuthorizationUrlParams,
} from './client/oauth-client.js';

// ============================================================================
// OAuth 2.0 Core Components (shared by all roles)
// ============================================================================

// Discovery (RFC 8414)
export { OAuthDiscoveryService } from './oauth/discovery.js';
export type { AuthorizationServerMetadata } from './oauth/discovery.js';

export {
  PKCEService,
  InMemoryPKCEStore,
  CodeChallengeMethod,
  type PKCEStore,
  type PKCEParams,
  type PKCEValidation,
} from './oauth/pkce.js';

export {
  JWTService,
  type JWTPayload,
  type JWTSignOptions,
  type JWTVerification,
  type JWK,
} from './oauth/jwt.js';

export {
  ClientRegistrationService,
  ClientType,
  type ClientRegistrationRequest,
  type ClientRegistrationResponse,
  type RegisteredClient,
} from './oauth/registration.js';

export {
  TokenIntrospectionService,
  type TokenIntrospectionRequest,
  type TokenIntrospectionResponse,
} from './oauth/introspection.js';

// RFC 8707 - Resource Indicators
export {
  ResourceIndicatorService,
  getResourceIndicatorService,
  type ResourceIndicator,
  type ResourceIndicatorRequest,
  type ResourceIndicatorResponse,
} from './rfc8707/indicators.js';

// Middleware
export {
  authenticate,
  requireScopes,
  requireResource,
  authorize,
  protect,
  configureOAuth,
  getOAuthConfig,
  oauthErrorHandler,
  type OAuthRequest,
  type OAuthMiddlewareOptions,
  type OAuthConfig,
} from './middleware/oauth.js';

// Endpoints
export {
  createOAuthRouter,
  type OAuthEndpointsConfig,
} from './endpoints/oauth.js';
