/**
 * HTTP Server Transport for MCP
 *
 * Implements HTTP transport with Server-Sent Events (SSE) streaming
 * MCP 2025-06-18 specification compliant
 *
 * @deprecated For OAuth-protected MCP servers, use HttpResourceServerTransport instead.
 * This transport does not support OAuth authentication.
 *
 * For OAuth support with proper role separation:
 * - Authorization Server: Use AuthorizationServer from auth/authorization-server/
 * - Resource Server: Use HttpResourceServerTransport from transport/http/resource-server-transport
 * - OAuth Client: Use OAuthClient from auth/client/
 */

import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import type { Server as HTTPServer } from 'http';
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

/**
 * HTTP Server Transport implementation (without OAuth)
 *
 * For OAuth-protected servers, use HttpResourceServerTransport instead.
 */
export class HttpServerTransport implements ITransport {
  readonly type = TransportType.HTTP;
  readonly protocolVersion: string;

  private app: Express;
  private server: HTTPServer | null = null;
  private streamManager: SSEStreamManager;
  private _state: ConnectionState = ConnectionState.DISCONNECTED;
  private eventHandlers = new Map<keyof TransportEvents, Set<Function>>();
  private config: TransportConfig | null = null;

  // Message handler for incoming MCP messages
  private messageHandler?: (message: any) => Promise<any>;

  constructor(protocolVersion: string = MCP_PROTOCOL_VERSION) {
    this.protocolVersion = protocolVersion;
    this.app = express();
    this.streamManager = new SSEStreamManager();
    this.setupMiddleware();
    this.setupRoutes();
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
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      setJSONHeaders(res, this.protocolVersion);
      res.json({
        status: 'ok',
        protocolVersion: this.protocolVersion,
        transport: 'http',
        activeStreams: this.streamManager.getActiveStreamCount(),
      });
    });

    // SSE endpoint for streaming MCP messages
    this.app.get('/sse', (req, res) => {
      this.handleSSEConnection(req, res);
    });

    // POST endpoint for sending MCP messages
    this.app.post('/message', async (req, res) => {
      await this.handleMessage(req, res);
    });

    // Protocol discovery endpoint
    this.app.get('/protocol', (req, res) => {
      setJSONHeaders(res, this.protocolVersion);
      res.json({
        protocol: 'MCP',
        version: this.protocolVersion,
        transports: ['http', 'sse'],
        endpoints: {
          sse: '/sse',
          message: '/message',
          health: '/health',
        },
      });
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

    const host = config.host || 'localhost';
    const port = config.port || 3000;

    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, host, () => {
          console.error(`[HTTP] Server listening on http://${host}:${port}`);
          console.error(`[HTTP] Protocol version: ${this.protocolVersion}`);
          console.error(`[HTTP] SSE endpoint: http://${host}:${port}/sse`);
          console.error(`[HTTP] Message endpoint: http://${host}:${port}/message`);
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
    activeStreams: number;
  } | null {
    if (!this.config || !this.server) {
      return null;
    }

    return {
      host: this.config.host || 'localhost',
      port: this.config.port || 3000,
      protocolVersion: this.protocolVersion,
      activeStreams: this.streamManager.getActiveStreamCount(),
    };
  }
}
