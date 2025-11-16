/**
 * SSE (Server-Sent Events) Streaming Utilities
 *
 * Implements streaming support for long-running operations
 * MCP 2025-06-18 compatible
 */

import type { Response } from 'express';
import { formatSSEMessage, type SSEMessage } from '../base.js';

/**
 * SSE stream manager for a single client connection
 */
export class SSEStream {
  private closed = false;
  private messageId = 0;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(
    private res: Response,
    private heartbeatIntervalMs: number = 30000
  ) {
    this.setupHeartbeat();
    this.setupCloseHandlers();
  }

  /**
   * Send an SSE message
   */
  send(event: string, data: any, id?: string): boolean {
    if (this.closed) {
      return false;
    }

    try {
      const message: SSEMessage = {
        event,
        data: typeof data === 'string' ? data : JSON.stringify(data),
        id: id || `${this.messageId++}`,
      };

      const formatted = formatSSEMessage(message);
      this.res.write(formatted);

      return true;
    } catch (error) {
      console.error('Error sending SSE message:', error);
      this.close();
      return false;
    }
  }

  /**
   * Send a protocol message (MCP message)
   */
  sendMessage(message: any): boolean {
    return this.send('message', message);
  }

  /**
   * Send an error event
   */
  sendError(error: string | Error): boolean {
    const errorMessage = error instanceof Error ? error.message : error;
    return this.send('error', { error: errorMessage });
  }

  /**
   * Send a heartbeat/ping to keep connection alive
   */
  sendHeartbeat(): boolean {
    return this.send('ping', { timestamp: Date.now() });
  }

  /**
   * Send protocol version announcement
   */
  sendProtocolVersion(version: string): boolean {
    return this.send('protocol', { version });
  }

  /**
   * Setup periodic heartbeat to keep connection alive
   */
  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (!this.sendHeartbeat()) {
        this.close();
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Setup handlers for client disconnect
   */
  private setupCloseHandlers(): void {
    const cleanup = () => {
      this.close();
    };

    this.res.on('close', cleanup);
    this.res.on('finish', cleanup);
    this.res.on('error', cleanup);
  }

  /**
   * Close the stream
   */
  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    try {
      // Send final close event
      const closeMessage = formatSSEMessage({
        event: 'close',
        data: JSON.stringify({ message: 'Stream closed' }),
      });
      this.res.write(closeMessage);
      this.res.end();
    } catch (error) {
      // Connection may already be closed
      console.error('Error closing SSE stream:', error);
    }
  }

  /**
   * Check if stream is closed
   */
  isClosed(): boolean {
    return this.closed;
  }
}

/**
 * SSE stream manager for multiple clients
 */
export class SSEStreamManager {
  private streams = new Map<string, SSEStream>();
  private nextClientId = 0;

  /**
   * Create a new stream for a client
   */
  createStream(res: Response, clientId?: string): { stream: SSEStream; id: string } {
    const id = clientId || `client-${this.nextClientId++}`;

    // Close existing stream if any
    const existing = this.streams.get(id);
    if (existing) {
      existing.close();
    }

    const stream = new SSEStream(res);
    this.streams.set(id, stream);

    // Remove stream when closed
    res.on('close', () => {
      this.streams.delete(id);
    });

    return { stream, id };
  }

  /**
   * Get a stream by client ID
   */
  getStream(clientId: string): SSEStream | undefined {
    return this.streams.get(clientId);
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(event: string, data: any): void {
    for (const [id, stream] of this.streams.entries()) {
      if (!stream.send(event, data)) {
        // Stream failed, remove it
        this.streams.delete(id);
      }
    }
  }

  /**
   * Broadcast MCP message to all clients
   */
  broadcastMessage(message: any): void {
    this.broadcast('message', message);
  }

  /**
   * Get count of active streams
   */
  getActiveStreamCount(): number {
    return this.streams.size;
  }

  /**
   * Close all streams
   */
  closeAll(): void {
    for (const stream of this.streams.values()) {
      stream.close();
    }
    this.streams.clear();
  }

  /**
   * Remove inactive streams
   */
  cleanup(): void {
    for (const [id, stream] of this.streams.entries()) {
      if (stream.isClosed()) {
        this.streams.delete(id);
      }
    }
  }
}

/**
 * Parse SSE event data from client
 */
export function parseSSEData(data: string): any {
  try {
    return JSON.parse(data);
  } catch (error) {
    return data; // Return as-is if not JSON
  }
}

/**
 * Create an SSE retry instruction
 */
export function createRetryMessage(retryMs: number): string {
  return formatSSEMessage({
    data: '',
    retry: retryMs,
  });
}
