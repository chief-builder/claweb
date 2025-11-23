/**
 * Security Utilities for Healthcare Applications
 *
 * Implements security best practices for HIPAA-compliant healthcare applications:
 * - Input sanitization (XSS prevention)
 * - CSRF protection
 * - Rate limiting
 * - Audit logging
 * - Session security
 * - Content Security Policy
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import crypto from 'crypto';

/**
 * Audit log entry for HIPAA compliance
 */
export interface AuditLogEntry {
  timestamp: string;
  sessionId: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  purpose?: string;
  ipAddress: string;
  userAgent: string;
  outcome: 'success' | 'failure' | 'denied';
  details?: Record<string, unknown>;
}

/**
 * In-memory audit log (in production, use persistent storage)
 */
const auditLog: AuditLogEntry[] = [];

/**
 * Rate limit tracking per IP
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * CSRF token storage per session
 */
const csrfTokens = new Map<string, string>();

/**
 * Sanitize user input to prevent XSS attacks
 * Escapes HTML special characters
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;');
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

/**
 * Generate a secure CSRF token
 */
export function generateCSRFToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(sessionId, token);
  return token;
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(sessionId: string, token: string): boolean {
  const storedToken = csrfTokens.get(sessionId);
  if (!storedToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(storedToken), Buffer.from(token));
}

/**
 * Clear CSRF token for a session
 */
export function clearCSRFToken(sessionId: string): void {
  csrfTokens.delete(sessionId);
}

/**
 * Rate limiting middleware configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
}

/**
 * Create rate limiting middleware
 */
export function createRateLimiter(config: RateLimitConfig): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let rateData = rateLimitMap.get(ip);

    if (!rateData || now > rateData.resetTime) {
      rateData = { count: 1, resetTime: now + config.windowMs };
      rateLimitMap.set(ip, rateData);
    } else {
      rateData.count++;
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - rateData.count).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateData.resetTime / 1000).toString());

    if (rateData.count > config.maxRequests) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: config.message || 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((rateData.resetTime - now) / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * Security headers middleware
 * Sets various security headers including CSP
 */
export function securityHeaders(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    // Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'", // Allow inline scripts for our app
        "style-src 'self' 'unsafe-inline'", // Allow inline styles
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "base-uri 'self'",
      ].join('; ')
    );

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS filter
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=()'
    );

    // Strict Transport Security (for HTTPS)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Cache control for sensitive data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    next();
  };
}

/**
 * Log an audit entry
 */
export function logAudit(entry: Omit<AuditLogEntry, 'timestamp'>): void {
  const fullEntry: AuditLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  auditLog.push(fullEntry);

  // In production, persist to secure storage
  // For now, log to stderr (not stdout to avoid mixing with responses)
  console.error(`[AUDIT] ${fullEntry.timestamp} | ${fullEntry.action} | ${fullEntry.resource} | ${fullEntry.outcome}`);
}

/**
 * Get audit log entries (for compliance review)
 */
export function getAuditLog(
  filters?: {
    sessionId?: string;
    resource?: string;
    startTime?: string;
    endTime?: string;
  }
): AuditLogEntry[] {
  let filtered = [...auditLog];

  if (filters?.sessionId) {
    filtered = filtered.filter((e) => e.sessionId === filters.sessionId);
  }

  if (filters?.resource) {
    filtered = filtered.filter((e) => e.resource === filters.resource);
  }

  if (filters?.startTime) {
    filtered = filtered.filter((e) => e.timestamp >= filters.startTime!);
  }

  if (filters?.endTime) {
    filtered = filtered.filter((e) => e.timestamp <= filters.endTime!);
  }

  return filtered;
}

/**
 * Clear audit log (for testing only)
 */
export function clearAuditLog(): void {
  auditLog.length = 0;
}

/**
 * Validate session ID format
 * Session IDs should be alphanumeric with underscores
 */
export function isValidSessionId(sessionId: string): boolean {
  if (!sessionId || typeof sessionId !== 'string') {
    return false;
  }

  // Session ID format: session_<timestamp>_<random>
  const sessionIdPattern = /^session_\d+_[a-z0-9]+$/;
  return sessionIdPattern.test(sessionId) && sessionId.length < 100;
}

/**
 * Generate a secure session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `session_${timestamp}_${random}`;
}

/**
 * Validate access purpose for HIPAA minimum necessary
 */
export type AccessPurpose =
  | 'treatment'
  | 'payment'
  | 'operations'
  | 'emergency'
  | 'research'
  | 'public_health'
  | 'legal';

const VALID_PURPOSES: AccessPurpose[] = [
  'treatment',
  'payment',
  'operations',
  'emergency',
  'research',
  'public_health',
  'legal',
];

export function isValidAccessPurpose(purpose: string): purpose is AccessPurpose {
  return VALID_PURPOSES.includes(purpose as AccessPurpose);
}

/**
 * Mask sensitive data for logging
 * Replaces middle characters with asterisks
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (!data || data.length <= visibleChars * 2) {
    return '*'.repeat(data?.length || 0);
  }

  const start = data.substring(0, visibleChars);
  const end = data.substring(data.length - visibleChars);
  const middle = '*'.repeat(Math.min(8, data.length - visibleChars * 2));

  return `${start}${middle}${end}`;
}

/**
 * Detect potential PII in text
 * Returns true if PII patterns are found
 */
export function detectPII(text: string): { hasPII: boolean; types: string[] } {
  const piiPatterns = [
    { type: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
    { type: 'Phone', pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/ },
    { type: 'Email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/ },
    { type: 'CreditCard', pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/ },
    { type: 'DOB', pattern: /\b\d{1,2}\/\d{1,2}\/\d{4}\b/ },
    { type: 'MRN', pattern: /\b[A-Z]{0,3}\d{6,10}\b/ },
  ];

  const detectedTypes: string[] = [];

  for (const { type, pattern } of piiPatterns) {
    if (pattern.test(text)) {
      detectedTypes.push(type);
    }
  }

  return {
    hasPII: detectedTypes.length > 0,
    types: detectedTypes,
  };
}

/**
 * Session timeout configuration
 */
export interface SessionTimeoutConfig {
  idleTimeoutMs: number; // Timeout after inactivity
  absoluteTimeoutMs: number; // Maximum session duration
}

/**
 * Session activity tracking
 */
const sessionActivity = new Map<string, { created: number; lastActivity: number }>();

/**
 * Track session activity
 */
export function trackSessionActivity(sessionId: string): void {
  const now = Date.now();
  const existing = sessionActivity.get(sessionId);

  if (existing) {
    existing.lastActivity = now;
  } else {
    sessionActivity.set(sessionId, { created: now, lastActivity: now });
  }
}

/**
 * Check if session is valid (not timed out)
 */
export function isSessionValid(
  sessionId: string,
  config: SessionTimeoutConfig
): { valid: boolean; reason?: string } {
  const activity = sessionActivity.get(sessionId);
  const now = Date.now();

  if (!activity) {
    return { valid: false, reason: 'Session not found' };
  }

  if (now - activity.lastActivity > config.idleTimeoutMs) {
    return { valid: false, reason: 'Session idle timeout' };
  }

  if (now - activity.created > config.absoluteTimeoutMs) {
    return { valid: false, reason: 'Session absolute timeout' };
  }

  return { valid: true };
}

/**
 * Clear session activity tracking
 */
export function clearSessionActivity(sessionId: string): void {
  sessionActivity.delete(sessionId);
}

/**
 * Request logging middleware (excludes sensitive data)
 */
export function requestLogger(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const sanitizedUrl = req.url.replace(/sessionId=[^&]+/, 'sessionId=[REDACTED]');
    console.error(
      `[REQUEST] ${new Date().toISOString()} | ${req.method} ${sanitizedUrl} | IP: ${req.ip}`
    );
    next();
  };
}
