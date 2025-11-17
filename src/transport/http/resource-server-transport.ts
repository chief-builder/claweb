/**
 * HTTP Resource Server Transport for MCP
 *
 * MCP server acting as an OAuth 2.0 Resource Server.
 * Validates access tokens but does NOT issue them.
 *
 * For token issuance, use the separate Authorization Server.
 */

import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import type { Server as HTTPServer } from 'http';
import * as jose from 'jose';
import {
  TransportType,
  ConnectionState,
  MCP_PROTOCOL_VERSION,
  ConnectionError,
  type TransportConfig,
  type ITransport,
  type TransportEvents,
} from '../base.js';
import {
  setSSEHeaders,
  setJSONHeaders,
  validateRequestHeaders,
  sendErrorResponse,
  getProtocolVersionHeader,
} from './headers.js';
import { SSEStreamManager, type SSEStream } from './streaming.js';
import {
  configureResourceServer,
  protectResource,
  type ResourceServerConfig,
} from '../../auth/resource-server/middleware.js';
import { JWTService } from '../../auth/oauth/jwt.js';

/**
 * Fetch JWKS from authorization server and extract public key
 */
async function fetchPublicKeyFromJWKS(jwksUrl: string): Promise<{ publicKey: string; keyId: string } | null> {
  try {
    const response = await fetch(jwksUrl);
    if (!response.ok) {
      console.error('[ResourceServer] Failed to fetch JWKS:', response.statusText);
      return null;
    }

    const jwks = await response.json() as any;

    if (!jwks.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
      console.error('[ResourceServer] No keys found in JWKS');
      return null;
    }

    // Get the first signing key
    const jwk = jwks.keys.find((key: any) => key.use === 'sig' || !key.use);

    if (!jwk) {
      console.error('[ResourceServer] No signing key found in JWKS');
      return null;
    }

    // Convert JWK to PEM using jose library
    const keyObject = await jose.importJWK(jwk, jwk.alg || 'RS256');
    const publicKey = await jose.exportSPKI(keyObject as any);

    console.error('[ResourceServer] Successfully fetched public key from JWKS');
    console.error('[ResourceServer] Key ID:', jwk.kid);

    return {
      publicKey,
      keyId: jwk.kid,
    };
  } catch (error) {
    console.error('[ResourceServer] Error fetching JWKS:', error);
    return null;
  }
}

/**
 * Resource server configuration for HTTP transport
 */
export interface HttpResourceServerConfig {
  /**
   * Enable OAuth 2.0 resource protection
   */
  enabled: boolean;

  /**
   * JWT service for token validation
   * Should use the same keys as the authorization server
   */
  jwtService?: JWTService;

  /**
   * Authorization server URL (issuer)
   */
  authorizationServer: string;

  /**
   * Authorization server's JWKS URL for remote key fetching
   */
  jwksUrl?: string;

  /**
   * This resource server's identifier (audience)
   */
  audience?: string;
}

/**
 * HTTP Server Transport as OAuth 2.0 Resource Server
 *
 * This transport validates OAuth tokens but does NOT issue them.
 * Tokens must be obtained from a separate Authorization Server.
 */
export class HttpResourceServerTransport implements ITransport {
  readonly type = TransportType.HTTP;
  readonly protocolVersion: string;

  private app: Express;
  private server: HTTPServer | null = null;
  private streamManager: SSEStreamManager;
  private _state: ConnectionState = ConnectionState.DISCONNECTED;
  private eventHandlers = new Map<keyof TransportEvents, Set<Function>>();
  private config: TransportConfig | null = null;
  private resourceServerConfig: HttpResourceServerConfig | null = null;

  // Message handler for incoming MCP messages
  private messageHandler?: (message: any) => Promise<any>;

  constructor(
    protocolVersion: string = MCP_PROTOCOL_VERSION,
    resourceServerConfig?: HttpResourceServerConfig
  ) {
    this.protocolVersion = protocolVersion;
    this.resourceServerConfig = resourceServerConfig || null;
    this.app = express();
    this.streamManager = new SSEStreamManager();

    // Note: OAuth resource server will be initialized in initialize() method
    // because it needs to fetch JWKS asynchronously

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Initialize resource server (async to fetch JWKS)
   */
  private async initializeResourceServer(): Promise<void> {
    if (!this.resourceServerConfig) {
      return;
    }

    console.error('[ResourceServer] Initializing OAuth 2.0 Resource Server...');
    console.error('[ResourceServer] Authorization Server:', this.resourceServerConfig.authorizationServer);

    let jwtService = this.resourceServerConfig.jwtService;

    // If no JWT service provided, fetch public key from authorization server
    if (!jwtService) {
      // Determine JWKS URL
      const jwksUrl = this.resourceServerConfig.jwksUrl ||
        `${this.resourceServerConfig.authorizationServer}/oauth/jwks`;

      console.error('[ResourceServer] Fetching JWKS from:', jwksUrl);

      const keyInfo = await fetchPublicKeyFromJWKS(jwksUrl);

      if (keyInfo) {
        // Create JWT service with the public key from authorization server
        jwtService = new JWTService({
          publicKey: keyInfo.publicKey,
          keyId: keyInfo.keyId,
          issuer: this.resourceServerConfig.authorizationServer,
        });
      } else {
        throw new Error(
          `Failed to fetch JWKS from ${jwksUrl}. ` +
          'Ensure the authorization server is running and accessible.'
        );
      }
    }

    const config: ResourceServerConfig = {
      jwtService,
      issuer: this.resourceServerConfig.authorizationServer,
      audience: this.resourceServerConfig.audience,
      jwksUrl: this.resourceServerConfig.jwksUrl,
    };

    configureResourceServer(config);

    console.error('[ResourceServer] Resource server initialized');
  }

  get state(): ConnectionState {
    return this._state;
  }

  private setState(state: ConnectionState): void {
    if (this._state !== state) {
      this._state = state;
      this.emit('stateChange', state);
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // JSON body parser
    this.app.use(express.json());

    // CORS support
    this.app.use(
      cors({
        origin: '*', // Configure appropriately for production
        credentials: true,
        exposedHeaders: ['MCP-Protocol-Version'],
      })
    );

    // Protocol version middleware
    this.app.use((req, res, next) => {
      // Set protocol version header on all responses
      setJSONHeaders(res, this.protocolVersion);
      next();
    });

    // Request logging (stderr to avoid stdout pollution)
    this.app.use((req, res, next) => {
      console.error(`[HTTP] ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup HTTP routes
   */
  private setupRoutes(): void {
    // Health check endpoint (public)
    this.app.get('/health', (req, res) => {
      setJSONHeaders(res, this.protocolVersion);
      res.json({
        status: 'ok',
        protocolVersion: this.protocolVersion,
        transport: 'http',
        role: 'resource-server',
        oauth: this.resourceServerConfig?.enabled || false,
        authorizationServer: this.resourceServerConfig?.authorizationServer,
        activeStreams: this.streamManager.getActiveStreamCount(),
      });
    });

    // SSE endpoint for streaming MCP messages (optionally protected)
    this.app.get('/sse', (req, res) => {
      this.handleSSEConnection(req, res);
    });

    // POST endpoint for sending MCP messages (optionally protected)
    this.app.post('/message', async (req, res) => {
      await this.handleMessage(req, res);
    });

    // Protocol discovery endpoint (public)
    this.app.get('/protocol', (req, res) => {
      setJSONHeaders(res, this.protocolVersion);
      const protocolInfo: any = {
        protocol: 'MCP',
        version: this.protocolVersion,
        transports: ['http', 'sse'],
        role: 'resource-server',
        endpoints: {
          sse: '/sse',
          message: '/message',
          health: '/health',
        },
      };

      // Add OAuth info if enabled
      if (this.resourceServerConfig?.enabled) {
        protocolInfo.oauth = {
          enabled: true,
          role: 'resource-server',
          authorizationServer: this.resourceServerConfig.authorizationServer,
          tokenValidation: 'bearer',
          note: 'This server validates tokens but does not issue them. Obtain tokens from the authorization server.',
        };
      }

      res.json(protocolInfo);
    });

    // Error handler
    this.app.use(
      (
        err: Error,
        req: Request,
        res: Response,
        next: express.NextFunction
      ) => {
        console.error('[HTTP] Error:', err);
        sendErrorResponse(res, 500, err.message, this.protocolVersion);
      }
    );
  }

  /**
   * Handle SSE connection
   */
  private handleSSEConnection(req: Request, res: Response): void {
    console.error('[HTTP] New SSE connection');

    // Validate protocol version
    const validation = validateRequestHeaders(req);
    if (!validation.valid) {
      sendErrorResponse(res, 400, validation.error!, this.protocolVersion);
      return;
    }

    // Setup SSE headers
    setSSEHeaders(res, this.protocolVersion);

    // Create stream for this client
    const { stream, id } = this.streamManager.createStream(res);

    // Send initial protocol version
    stream.sendProtocolVersion(this.protocolVersion);

    // Send connection acknowledgment
    stream.send('connected', {
      clientId: id,
      protocolVersion: this.protocolVersion,
      timestamp: new Date().toISOString(),
    });

    console.error(`[HTTP] SSE client connected: ${id}`);

    // Handle client disconnect
    res.on('close', () => {
      console.error(`[HTTP] SSE client disconnected: ${id}`);
    });
  }

  /**
   * Handle incoming MCP message
   */
  private async handleMessage(req: Request, res: Response): Promise<void> {
    try {
      // Validate protocol version
      const validation = validateRequestHeaders(req);
      if (!validation.valid) {
        sendErrorResponse(res, 400, validation.error!, this.protocolVersion);
        return;
      }

      const message = req.body;

      if (!message || typeof message !== 'object') {
        sendErrorResponse(res, 400, 'Invalid message format', this.protocolVersion);
        return;
      }

      console.error('[HTTP] Received message:', message.method || message.id);

      // Process message through handler
      if (this.messageHandler) {
        const response = await this.messageHandler(message);

        // Send response
        setJSONHeaders(res, this.protocolVersion);
        res.json(response);

        // Also broadcast to SSE clients if it's a notification
        if (!message.id) {
          this.streamManager.broadcastMessage(response);
        }
      } else {
        sendErrorResponse(
          res,
          503,
          'Server not ready to handle messages',
          this.protocolVersion
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[HTTP] Error handling message:', errorMessage);
      sendErrorResponse(res, 500, errorMessage, this.protocolVersion);
    }
  }

  /**
   * Initialize the transport
   */
  async initialize(config: TransportConfig): Promise<void> {
    if (this._state !== ConnectionState.DISCONNECTED) {
      throw new ConnectionError(
        'Transport already initialized',
        TransportType.HTTP
      );
    }

    this.config = config;
    this.setState(ConnectionState.CONNECTING);

    // Initialize OAuth resource server (fetch JWKS if needed)
    if (this.resourceServerConfig?.enabled) {
      await this.initializeResourceServer();
    }

    const host = config.host || 'localhost';
    const port = config.port || 3000;

    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, host, () => {
          console.error(`[HTTP] MCP Resource Server listening on http://${host}:${port}`);
          console.error(`[HTTP] Protocol version: ${this.protocolVersion}`);
          console.error(`[HTTP] SSE endpoint: http://${host}:${port}/sse`);
          console.error(`[HTTP] Message endpoint: http://${host}:${port}/message`);
          if (this.resourceServerConfig?.enabled) {
            console.error(`[HTTP] OAuth: Enabled (Resource Server)`);
            console.error(`[HTTP] Auth Server: ${this.resourceServerConfig.authorizationServer}`);
          }
          this.setState(ConnectionState.CONNECTED);
          this.emit('connect');
          resolve();
        });

        this.server.on('error', (error) => {
          console.error('[HTTP] Server error:', error);
          this.setState(ConnectionState.ERROR);
          this.emit('error', error);
          reject(new ConnectionError(error.message, TransportType.HTTP));
        });
      } catch (error) {
        this.setState(ConnectionState.ERROR);
        reject(
          new ConnectionError(
            error instanceof Error ? error.message : 'Unknown error',
            TransportType.HTTP
          )
        );
      }
    });
  }

  /**
   * Send a message through the transport
   * For HTTP server, this broadcasts to all SSE clients
   */
  async send(message: any): Promise<void> {
    if (this._state !== ConnectionState.CONNECTED) {
      throw new ConnectionError(
        'Transport not connected',
        TransportType.HTTP
      );
    }

    // Broadcast to all SSE clients
    this.streamManager.broadcastMessage(message);
  }

  /**
   * Set the message handler for incoming MCP messages
   */
  setMessageHandler(handler: (message: any) => Promise<any>): void {
    this.messageHandler = handler;
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    if (this._state === ConnectionState.DISCONNECTED) {
      return;
    }

    console.error('[HTTP] Closing server...');

    // Close all SSE streams
    this.streamManager.closeAll();

    // Close HTTP server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          console.error('[HTTP] Server closed');
          resolve();
        });
      });
      this.server = null;
    }

    this.setState(ConnectionState.DISCONNECTED);
    this.emit('disconnect');
  }

  /**
   * Register event handler
   */
  on<K extends keyof TransportEvents>(
    event: K,
    handler: TransportEvents[K]
  ): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove event handler
   */
  off<K extends keyof TransportEvents>(
    event: K,
    handler: TransportEvents[K]
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit event
   */
  private emit<K extends keyof TransportEvents>(
    event: K,
    ...args: Parameters<TransportEvents[K]>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          (handler as any)(...args);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      }
    }
  }

  /**
   * Get server info
   */
  getServerInfo(): {
    host: string;
    port: number;
    protocolVersion: string;
    role: string;
    oauth: boolean;
    authorizationServer?: string;
    activeStreams: number;
  } | null {
    if (!this.config || !this.server) {
      return null;
    }

    return {
      host: this.config.host || 'localhost',
      port: this.config.port || 3000,
      protocolVersion: this.protocolVersion,
      role: 'resource-server',
      oauth: this.resourceServerConfig?.enabled || false,
      authorizationServer: this.resourceServerConfig?.authorizationServer,
      activeStreams: this.streamManager.getActiveStreamCount(),
    };
  }

  /**
   * Get Express app (for adding protected routes)
   */
  getApp(): Express {
    return this.app;
  }
}
