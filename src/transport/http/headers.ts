/**
 * HTTP Transport Headers
 *
 * MCP 2025-06-18: MCP-Protocol-Version header support
 */

import { MCP_PROTOCOL_VERSION } from '../base.js';
import type { Request, Response } from 'express';

/**
 * Standard MCP HTTP headers
 */
export const MCP_HEADERS = {
  PROTOCOL_VERSION: 'MCP-Protocol-Version',
  CONTENT_TYPE: 'Content-Type',
  CACHE_CONTROL: 'Cache-Control',
  CONNECTION: 'Connection',
  X_ACCEL_BUFFERING: 'X-Accel-Buffering',
} as const;

/**
 * Content types for MCP messages
 */
export const CONTENT_TYPES = {
  JSON: 'application/json',
  SSE: 'text/event-stream',
  TEXT: 'text/plain',
} as const;

/**
 * Set MCP protocol version header
 */
export function setProtocolVersionHeader(
  res: Response,
  version: string = MCP_PROTOCOL_VERSION
): void {
  res.setHeader(MCP_HEADERS.PROTOCOL_VERSION, version);
}

/**
 * Get MCP protocol version from request
 */
export function getProtocolVersionHeader(req: Request): string | undefined {
  return req.get(MCP_HEADERS.PROTOCOL_VERSION);
}

/**
 * Validate protocol version compatibility
 */
export function isProtocolVersionCompatible(
  clientVersion: string,
  serverVersion: string = MCP_PROTOCOL_VERSION
): boolean {
  // For now, exact match required
  // Future: implement semantic version comparison
  return clientVersion === serverVersion;
}

/**
 * Set standard SSE headers
 */
export function setSSEHeaders(
  res: Response,
  protocolVersion: string = MCP_PROTOCOL_VERSION
): void {
  res.setHeader(MCP_HEADERS.CONTENT_TYPE, CONTENT_TYPES.SSE);
  res.setHeader(MCP_HEADERS.CACHE_CONTROL, 'no-cache, no-transform');
  res.setHeader(MCP_HEADERS.CONNECTION, 'keep-alive');
  res.setHeader(MCP_HEADERS.X_ACCEL_BUFFERING, 'no'); // Disable nginx buffering
  setProtocolVersionHeader(res, protocolVersion);
}

/**
 * Set standard JSON headers
 */
export function setJSONHeaders(
  res: Response,
  protocolVersion: string = MCP_PROTOCOL_VERSION
): void {
  res.setHeader(MCP_HEADERS.CONTENT_TYPE, CONTENT_TYPES.JSON);
  setProtocolVersionHeader(res, protocolVersion);
}

/**
 * Validate required headers in request
 */
export function validateRequestHeaders(req: Request): {
  valid: boolean;
  error?: string;
} {
  const protocolVersion = getProtocolVersionHeader(req);

  if (!protocolVersion) {
    return {
      valid: false,
      error: `Missing ${MCP_HEADERS.PROTOCOL_VERSION} header`,
    };
  }

  if (!isProtocolVersionCompatible(protocolVersion)) {
    return {
      valid: false,
      error: `Incompatible protocol version: ${protocolVersion} (expected ${MCP_PROTOCOL_VERSION})`,
    };
  }

  return { valid: true };
}

/**
 * Create error response with proper headers
 */
export function sendErrorResponse(
  res: Response,
  statusCode: number,
  error: string,
  protocolVersion: string = MCP_PROTOCOL_VERSION
): void {
  setJSONHeaders(res, protocolVersion);
  res.status(statusCode).json({
    jsonrpc: '2.0',
    error: {
      code: statusCode,
      message: error,
    },
  });
}
