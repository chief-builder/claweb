/**
 * Transport Layer Module
 *
 * Unified exports for all transport types
 * MCP 2025-06-18 compliant
 */

// Base types and interfaces
export {
  MCP_PROTOCOL_VERSION,
  TransportType,
  ConnectionState,
  TransportError,
  ConnectionError,
  ProtocolError,
  formatSSEMessage,
  parseSSEMessage,
  type ITransport,
  type TransportConfig,
  type TransportEvents,
  type SSEMessage,
  type HttpTransportHeaders,
} from './base.js';

// HTTP transport
export {
  HttpServerTransport,
  HttpClientTransport,
  SSEStream,
  SSEStreamManager,
  parseSSEData,
  createRetryMessage,
  MCP_HEADERS,
  CONTENT_TYPES,
  setProtocolVersionHeader,
  getProtocolVersionHeader,
  isProtocolVersionCompatible,
  setSSEHeaders,
  setJSONHeaders,
  validateRequestHeaders,
  sendErrorResponse,
} from './http/index.js';
