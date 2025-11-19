/**
 * OAuth 2.0 Authorization Server
 *
 * Standalone authorization server responsible for:
 * - User authentication (if needed)
 * - Client authentication
 * - Token issuance (access tokens, refresh tokens)
 * - Client registration
 * - Token introspection
 *
 * This server is SEPARATE from the MCP Resource Server.
 */

import express, { type Express } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Server as HTTPServer } from 'http';
import { createOAuthRouter, type OAuthEndpointsConfig } from '../endpoints/oauth.js';
import { JWTService } from '../oauth/jwt.js';
import { InMemoryClientStore, ClientRegistrationService } from '../oauth/registration.js';
import { TokenIntrospectionService } from '../oauth/introspection.js';
import { TokenRevocationService } from '../oauth/revocation.js';
import { InMemoryPKCEStore } from '../oauth/pkce.js';
import { Auth0Bridge, type Auth0Config } from '../sso/auth0-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Authorization Server configuration
 */
export interface AuthorizationServerConfig {
  /**
   * Server host
   */
  host?: string;

  /**
   * Server port
   */
  port?: number;

  /**
   * Issuer URL (e.g., "https://auth.example.com")
   * Must be accessible by clients and resource servers
   */
  issuer: string;

  /**
   * Custom JWT service (optional)
   */
  jwtService?: JWTService;

  /**
   * Enable CORS (default: true)
   */
  cors?: boolean;

  /**
   * Allowed CORS origins (default: '*')
   */
  corsOrigins?: string | string[];

  /**
   * Path to static files directory (for consent page, etc.)
   * If not provided, interactive consent will be disabled
   */
  staticFilesPath?: string;

  /**
   * Enable interactive consent page (default: false)
   * When true, authorization endpoint shows HTML consent page
   * When false, authorization endpoint auto-approves (for testing)
   */
  interactiveConsent?: boolean;

  /**
   * Auth0 SSO configuration (optional)
   * When provided, enables SSO integration with Auth0
   */
  auth0?: Auth0Config;
}

/**
 * OAuth 2.0 Authorization Server
 *
 * Issues access tokens for use at MCP Resource Servers.
 * Runs independently from MCP servers.
 */
export class AuthorizationServer {
  private app: Express;
  private server: HTTPServer | null = null;
  private config: AuthorizationServerConfig;

  // OAuth services
  private jwtService: JWTService;
  private clientStore: InMemoryClientStore;
  private registrationService: ClientRegistrationService;
  private introspectionService: TokenIntrospectionService;
  private revocationService: TokenRevocationService;
  private pkceStore: InMemoryPKCEStore;

  // SSO integration
  private auth0Bridge?: Auth0Bridge;

  constructor(config: AuthorizationServerConfig) {
    this.config = config;
    this.app = express();

    // Initialize OAuth services
    this.jwtService = config.jwtService || new JWTService({ issuer: config.issuer });
    this.clientStore = new InMemoryClientStore();
    this.registrationService = new ClientRegistrationService(this.clientStore);
    this.introspectionService = new TokenIntrospectionService(
      this.jwtService,
      this.registrationService
    );
    this.revocationService = new TokenRevocationService(
      this.jwtService,
      this.registrationService
    );
    this.pkceStore = new InMemoryPKCEStore();

    // Initialize Auth0 bridge if configured
    if (config.auth0) {
      this.auth0Bridge = new Auth0Bridge(config.auth0);
    }

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // JSON body parser
    this.app.use(express.json());

    // URL-encoded body parser (for form submissions)
    this.app.use(express.urlencoded({ extended: true }));

    // CORS support
    if (this.config.cors !== false) {
      this.app.use(
        cors({
          origin: this.config.corsOrigins || '*',
          credentials: true,
          exposedHeaders: ['Content-Type', 'Authorization'],
        })
      );
    }

    // Serve static files if configured
    if (this.config.staticFilesPath) {
      console.error(`[AuthServer] Serving static files from: ${this.config.staticFilesPath}`);
      this.app.use('/static', express.static(this.config.staticFilesPath));
    }

    // Request logging
    this.app.use((req, res, next) => {
      console.error(`[AuthServer] ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup OAuth routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        service: 'oauth-authorization-server',
        issuer: this.config.issuer,
      });
    });

    // OAuth endpoints router
    const oauthRouter = createOAuthRouter({
      issuer: this.config.issuer,
      jwtService: this.jwtService,
      registrationService: this.registrationService,
      introspectionService: this.introspectionService,
      revocationService: this.revocationService,
      pkceStore: this.pkceStore,
      interactiveConsent: this.config.interactiveConsent,
      auth0Bridge: this.auth0Bridge,
    });

    this.app.use(oauthRouter);

    // Error handler
    this.app.use(
      (
        err: Error,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        console.error('[AuthServer] Error:', err);
        res.status(500).json({
          error: 'server_error',
          error_description: err.message,
        });
      }
    );
  }

  /**
   * Start the authorization server
   */
  async start(): Promise<void> {
    const host = this.config.host || 'localhost';
    const port = this.config.port || 4000;

    // Initialize Auth0 bridge if configured
    if (this.auth0Bridge) {
      try {
        await this.auth0Bridge.initialize();
        console.error('[AuthServer] Auth0 SSO integration enabled');
        console.error(`[AuthServer] Auth0 Domain: ${this.config.auth0?.domain}`);
      } catch (error) {
        console.error('[AuthServer] Failed to initialize Auth0:', error);
        throw error;
      }
    }

    return new Promise((resolve, reject) => {
      let resolved = false;

      try {
        // Set up error handler before listen() to catch immediate errors
        const errorHandler = (error: Error) => {
          if (!resolved) {
            resolved = true;
            console.error('[AuthServer] Failed to start server:', error);
            this.server = null;
            reject(error);
          }
        };

        this.server = this.app.listen(port, host, () => {
          if (!resolved) {
            resolved = true;
            console.error('');
            console.error('═══════════════════════════════════════════════════════');
            console.error('  OAuth 2.0 Authorization Server');
            console.error('═══════════════════════════════════════════════════════');
            console.error(`  Issuer:    ${this.config.issuer}`);
            console.error(`  Address:   http://${host}:${port}`);
            console.error(`  Discovery: ${this.config.issuer}/.well-known/oauth-authorization-server`);
            console.error(`  JWKS:      ${this.config.issuer}/oauth/jwks`);
            if (this.auth0Bridge) {
              console.error(`  Auth0 SSO: Enabled`);
              console.error(`  SSO Callback: ${this.config.auth0?.redirectUri}`);
            }
            console.error('═══════════════════════════════════════════════════════');
            console.error('');
            resolve();
          }
        });

        this.server.on('error', errorHandler);
      } catch (error) {
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      }
    });
  }

  /**
   * Stop the authorization server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    // Shutdown revocation service
    this.revocationService.shutdown();

    return new Promise((resolve) => {
      this.server!.close(() => {
        console.error('[AuthServer] Server stopped');
        this.server = null;
        resolve();
      });
    });
  }

  /**
   * Get server info
   */
  getInfo(): {
    issuer: string;
    host: string;
    port: number;
    endpoints: {
      discovery: string;
      jwks: string;
      authorize: string;
      token: string;
      register: string;
      introspect: string;
      resources: string;
    };
  } {
    return {
      issuer: this.config.issuer,
      host: this.config.host || 'localhost',
      port: this.config.port || 4000,
      endpoints: {
        discovery: `${this.config.issuer}/.well-known/oauth-authorization-server`,
        jwks: `${this.config.issuer}/oauth/jwks`,
        authorize: `${this.config.issuer}/oauth/authorize`,
        token: `${this.config.issuer}/oauth/token`,
        register: `${this.config.issuer}/oauth/register`,
        introspect: `${this.config.issuer}/oauth/introspect`,
        resources: `${this.config.issuer}/oauth/resources`,
      },
    };
  }

  /**
   * Get JWT service (for resource servers to validate tokens)
   */
  getJWTService(): JWTService {
    return this.jwtService;
  }
}

/**
 * Create and start an authorization server
 */
export async function createAuthorizationServer(
  config: AuthorizationServerConfig
): Promise<AuthorizationServer> {
  const server = new AuthorizationServer(config);
  await server.start();
  return server;
}
