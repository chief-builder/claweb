/**
 * Authentication and Authorization Module
 *
 * Provides OAuth 2.0 and RFC 8707 support for MCP
 */

// OAuth 2.0 Core
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
