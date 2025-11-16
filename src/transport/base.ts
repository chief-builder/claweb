/**
 * Base Transport Layer for MCP
 *
 * Provides abstraction for different transport mechanisms (stdio, HTTP/SSE)
 * following MCP 2025-06-18 specification
 */

/**
 * MCP Protocol version following MCP 2025-06-18
 */
export const MCP_PROTOCOL_VERSION = '2025-06-18';

/**
 * Transport types supported by this implementation
 */
export enum TransportType {
  STDIO = 'stdio',
  HTTP = 'http',
  HTTPS = 'https'
}

/**
 * Transport configuration options
 */
export interface TransportConfig {
  type: TransportType;
  protocolVersion?: string;

  // HTTP-specific options
  host?: string;
  port?: number;
  path?: string;
  cors?: boolean;

  // Connection options
  timeout?: number;
  keepAlive?: boolean;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
}

/**
 * Transport connection state
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

/**
 * Transport event types
 */
export interface TransportEvents {
  connect: () => void;
  disconnect: () => void;
  error: (error: Error) => void;
  message: (message: any) => void;
  stateChange: (state: ConnectionState) => void;
}

/**
 * Base transport interface
 * All transport implementations must conform to this interface
 */
export interface ITransport {
  /**
   * Get the transport type
   */
  readonly type: TransportType;

  /**
   * Get the MCP protocol version
   */
  readonly protocolVersion: string;

  /**
   * Get current connection state
   */
  readonly state: ConnectionState;

  /**
   * Initialize the transport
   */
  initialize(config: TransportConfig): Promise<void>;

  /**
   * Send a message through the transport
   */
  send(message: any): Promise<void>;

  /**
   * Close the transport connection
   */
  close(): Promise<void>;

  /**
   * Register event handlers
   */
  on<K extends keyof TransportEvents>(
    event: K,
    handler: TransportEvents[K]
  ): void;

  /**
   * Remove event handlers
   */
  off<K extends keyof TransportEvents>(
    event: K,
    handler: TransportEvents[K]
  ): void;
}

/**
 * HTTP transport specific headers
 */
export interface HttpTransportHeaders {
  'MCP-Protocol-Version': string;
  'Content-Type': string;
  'Cache-Control'?: string;
  'Connection'?: string;
  'X-Accel-Buffering'?: string;
}

/**
 * SSE (Server-Sent Events) message format
 */
export interface SSEMessage {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
}

/**
 * Helper to format SSE messages
 */
export function formatSSEMessage(message: SSEMessage): string {
  let formatted = '';

  if (message.event) {
    formatted += `event: ${message.event}\n`;
  }

  if (message.id) {
    formatted += `id: ${message.id}\n`;
  }

  if (message.retry) {
    formatted += `retry: ${message.retry}\n`;
  }

  // Split data into multiple lines if needed
  const dataLines = message.data.split('\n');
  for (const line of dataLines) {
    formatted += `data: ${line}\n`;
  }

  // End with blank line
  formatted += '\n';

  return formatted;
}

/**
 * Parse SSE message from raw string
 */
export function parseSSEMessage(raw: string): SSEMessage | null {
  const lines = raw.split('\n');
  const message: SSEMessage = { data: '' };

  for (const line of lines) {
    if (line.startsWith('event:')) {
      message.event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      if (message.data) {
        message.data += '\n';
      }
      message.data += line.slice(5).trim();
    } else if (line.startsWith('id:')) {
      message.id = line.slice(3).trim();
    } else if (line.startsWith('retry:')) {
      message.retry = parseInt(line.slice(6).trim(), 10);
    }
  }

  return message.data ? message : null;
}

/**
 * Base transport error
 */
export class TransportError extends Error {
  constructor(
    message: string,
    public readonly transport: TransportType,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

/**
 * Connection error
 */
export class ConnectionError extends TransportError {
  constructor(message: string, transport: TransportType) {
    super(message, transport, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
  }
}

/**
 * Protocol error
 */
export class ProtocolError extends TransportError {
  constructor(message: string, transport: TransportType) {
    super(message, transport, 'PROTOCOL_ERROR');
    this.name = 'ProtocolError';
  }
}
