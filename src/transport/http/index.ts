/**
 * HTTP Transport Module
 *
 * Exports HTTP transport server, client, and utilities
 * MCP 2025-06-18 compliant
 */

export { HttpServerTransport } from './server.js';
export { HttpClientTransport } from './client.js';
export { SSEStream, SSEStreamManager, parseSSEData, createRetryMessage } from './streaming.js';
export {
  MCP_HEADERS,
  CONTENT_TYPES,
  setProtocolVersionHeader,
  getProtocolVersionHeader,
  isProtocolVersionCompatible,
  setSSEHeaders,
  setJSONHeaders,
  validateRequestHeaders,
  sendErrorResponse,
} from './headers.js';
