#!/usr/bin/env node

/**
 * Healthcare Chat Server with MCP Integration
 *
 * A HIPAA-aware web chat server for healthcare workflows.
 * Connects to healthcare MCP servers (patient records, pharmacy, clinical workflow)
 * with comprehensive security features.
 *
 * Security Features:
 * - Content Security Policy headers
 * - Rate limiting
 * - Input sanitization (XSS prevention)
 * - CSRF protection
 * - Audit logging for HIPAA compliance
 * - Session timeout management
 * - Access purpose validation
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  HealthcareIntelligentAgent,
  DEFAULT_HEALTHCARE_SERVERS,
} from '../agent/healthcare-intelligent-agent.js';
import {
  sanitizeInput,
  securityHeaders,
  createRateLimiter,
  logAudit,
  getAuditLog,
  isValidSessionId,
  generateSessionId,
  isValidAccessPurpose,
  trackSessionActivity,
  isSessionValid,
  clearSessionActivity,
  requestLogger,
  generateCSRFToken,
  validateCSRFToken,
  clearCSRFToken,
  AccessPurpose,
} from '../utils/security.js';
import { JWTService } from '../auth/oauth/jwt.js';
import {
  configureHealthChatOAuth,
  generateAuthorizationParams,
  validateAuthorizationState,
  exchangeCodeForTokens,
  storeTokens,
  getStoredTokens,
  clearStoredTokens,
  getUserFromSession,
  buildAuthorizationUrl,
  revokeToken,
  refreshAccessToken,
  AuthenticatedUser,
  AuthenticatedRequest,
} from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.HEALTH_CHAT_PORT || 3002;

// Session configuration
const SESSION_CONFIG = {
  idleTimeoutMs: 30 * 60 * 1000, // 30 minutes idle timeout
  absoluteTimeoutMs: 8 * 60 * 60 * 1000, // 8 hours absolute timeout
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 requests per minute
  message: 'Too many requests. Please wait before trying again.',
};

// Store agent instances per session with metadata
interface SessionData {
  agent: HealthcareIntelligentAgent;
  patientContext?: {
    patientId: string;
    name?: string;
    loadedAt: string;
  };
  accessPurpose?: AccessPurpose;
  breakGlassActive: boolean;
  auditCount: number;
  // OAuth user context
  user?: AuthenticatedUser;
}

// OAuth configuration
const OAUTH_CONFIG = {
  authServerUrl: process.env.AUTH_SERVER_URL || 'http://localhost:4000',
  clientId: process.env.OAUTH_CLIENT_ID || 'health-chat-client',
  redirectUri: process.env.OAUTH_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`,
  scopes: ['openid', 'profile', 'email', 'healthcare:read', 'healthcare:write'],
};

// Initialize JWT service for token validation
const jwtService = new JWTService({
  issuer: OAUTH_CONFIG.authServerUrl,
});

// Configure OAuth (will be fully initialized after server starts)
configureHealthChatOAuth({
  ...OAUTH_CONFIG,
  jwtService,
  requireAuth: process.env.REQUIRE_AUTH === 'true',
});

/**
 * Register health-chat as an OAuth client with the authorization server
 */
async function registerOAuthClient(): Promise<boolean> {
  try {
    const response = await fetch(`${OAUTH_CONFIG.authServerUrl}/oauth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_name: 'Health Chat Application',
        redirect_uris: [OAUTH_CONFIG.redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none', // Public client (browser app)
        scope: OAUTH_CONFIG.scopes.join(' '),
      }),
    });

    if (response.ok) {
      const data = await response.json() as { client_id: string };
      console.log(`[OAuth] Client registered successfully: ${data.client_id}`);
      // Update config with the registered client ID if different
      if (data.client_id !== OAUTH_CONFIG.clientId) {
        OAUTH_CONFIG.clientId = data.client_id;
        configureHealthChatOAuth({
          ...OAUTH_CONFIG,
          jwtService,
          requireAuth: process.env.REQUIRE_AUTH === 'true',
        });
      }
      return true;
    } else {
      const error = await response.text();
      console.error(`[OAuth] Client registration failed: ${error}`);
      return false;
    }
  } catch (error) {
    console.error(`[OAuth] Could not connect to auth server: ${error}`);
    console.log(`[OAuth] Health-chat will work without OAuth. Start auth server at ${OAUTH_CONFIG.authServerUrl} for authentication.`);
    return false;
  }
}

const sessions = new Map<string, SessionData>();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '100kb' })); // Limit request body size
app.use(securityHeaders());
app.use(requestLogger());
app.use(createRateLimiter(RATE_LIMIT_CONFIG));

// Compute static file paths - use process.cwd() for reliability
const publicPath = path.join(process.cwd(), 'public/health-chat');
const indexPath = path.join(publicPath, 'index.html');

// Debug log paths on startup
console.error(`[DEBUG] Public path: ${publicPath}`);
console.error(`[DEBUG] Index path: ${indexPath}`);

// Serve the main HTML file FIRST (before static middleware)
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('[ERROR] Failed to send index.html:', err);
      res.status(500).json({ error: 'Failed to load UI', path: indexPath });
    }
  });
});

// Serve static files from public/health-chat
app.use(express.static(publicPath));

// ============================================================================
// OAuth Authentication Routes
// ============================================================================

/**
 * Initiate OAuth login flow
 */
app.get('/auth/login', (req: Request, res: Response) => {
  try {
    const params = generateAuthorizationParams();

    logAudit({
      sessionId: 'auth',
      action: 'LOGIN_INITIATED',
      resource: 'auth',
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      outcome: 'success',
      details: { state: params.state.substring(0, 8) + '...' },
    });

    const authUrl = buildAuthorizationUrl(
      params.state,
      params.codeChallenge,
      params.codeChallengeMethod
    );

    res.redirect(authUrl);
  } catch (error) {
    console.error('[Auth] Login initiation error:', error);
    res.redirect('/?error=login_failed');
  }
});

/**
 * OAuth callback handler
 */
app.get('/auth/callback', async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;

  // Handle OAuth errors
  if (error) {
    logAudit({
      sessionId: 'auth',
      action: 'LOGIN_FAILED',
      resource: 'auth',
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      outcome: 'failure',
      details: { error, error_description },
    });

    return res.redirect(`/?error=${encodeURIComponent(String(error))}`);
  }

  if (!code || !state) {
    return res.redirect('/?error=invalid_callback');
  }

  // Validate state and get PKCE verifier
  const pkceState = validateAuthorizationState(String(state));
  if (!pkceState) {
    logAudit({
      sessionId: 'auth',
      action: 'LOGIN_FAILED',
      resource: 'auth',
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      outcome: 'failure',
      details: { reason: 'Invalid or expired state' },
    });

    return res.redirect('/?error=invalid_state');
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(String(code), pkceState.codeVerifier);

    if (!tokens) {
      logAudit({
        sessionId: 'auth',
        action: 'LOGIN_FAILED',
        resource: 'auth',
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        outcome: 'failure',
        details: { reason: 'Token exchange failed' },
      });

      return res.redirect('/?error=token_exchange_failed');
    }

    // Create a session for the authenticated user
    const sessionId = generateSessionId();
    storeTokens(sessionId, tokens.accessToken, tokens.refreshToken, tokens.user, tokens.expiresIn);

    logAudit({
      sessionId,
      userId: tokens.user.userId,
      action: 'USER_LOGIN',
      resource: 'auth',
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      outcome: 'success',
      details: {
        userEmail: tokens.user.email,
        userName: tokens.user.name,
        authMethod: 'oauth',
      },
    });

    // Set httpOnly cookie with session ID for security
    res.cookie('health_chat_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expiresIn * 1000,
    });

    // Also set a non-httpOnly cookie with user info for frontend display
    res.cookie('health_chat_user', JSON.stringify({
      userId: tokens.user.userId,
      email: tokens.user.email,
      name: tokens.user.name,
      roles: tokens.user.roles,
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expiresIn * 1000,
    });

    res.redirect('/?login=success');
  } catch (error) {
    console.error('[Auth] Callback error:', error);
    res.redirect('/?error=callback_failed');
  }
});

/**
 * Logout endpoint
 */
app.post('/auth/logout', async (req: Request, res: Response) => {
  const sessionId = req.cookies?.health_chat_session;

  if (sessionId) {
    const storedTokens = getStoredTokens(sessionId);

    if (storedTokens) {
      // Revoke tokens on auth server
      await revokeToken(storedTokens.accessToken);
      if (storedTokens.refreshToken) {
        await revokeToken(storedTokens.refreshToken);
      }

      logAudit({
        sessionId,
        userId: storedTokens.user.userId,
        action: 'USER_LOGOUT',
        resource: 'auth',
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        outcome: 'success',
        details: {
          userEmail: storedTokens.user.email,
          userName: storedTokens.user.name,
        },
      });
    }

    clearStoredTokens(sessionId);
  }

  // Clear cookies
  res.clearCookie('health_chat_session');
  res.clearCookie('health_chat_user');
  res.clearCookie('health_chat_token');

  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * Get current user info
 */
app.get('/auth/me', (req: Request, res: Response) => {
  const sessionId = req.cookies?.health_chat_session;

  if (!sessionId) {
    return res.json({
      authenticated: false,
      user: null,
    });
  }

  const user = getUserFromSession(sessionId);

  if (!user) {
    return res.json({
      authenticated: false,
      user: null,
    });
  }

  res.json({
    authenticated: true,
    user: {
      userId: user.userId,
      email: user.email,
      name: user.name,
      roles: user.roles,
      scopes: user.scopes,
    },
  });
});

/**
 * Refresh access token
 */
app.post('/auth/refresh', async (req: Request, res: Response) => {
  const sessionId = req.cookies?.health_chat_session;

  if (!sessionId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const storedTokens = getStoredTokens(sessionId);

  if (!storedTokens || !storedTokens.refreshToken) {
    return res.status(401).json({ error: 'No refresh token available' });
  }

  try {
    const newTokens = await refreshAccessToken(storedTokens.refreshToken);

    if (!newTokens) {
      clearStoredTokens(sessionId);
      res.clearCookie('health_chat_session');
      res.clearCookie('health_chat_user');
      return res.status(401).json({ error: 'Token refresh failed' });
    }

    // Update stored tokens
    storeTokens(
      sessionId,
      newTokens.accessToken,
      newTokens.refreshToken || storedTokens.refreshToken,
      storedTokens.user,
      newTokens.expiresIn
    );

    logAudit({
      sessionId,
      userId: storedTokens.user.userId,
      action: 'TOKEN_REFRESH',
      resource: 'auth',
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      outcome: 'success',
    });

    // Update cookie expiration
    res.cookie('health_chat_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: newTokens.expiresIn * 1000,
    });

    res.json({
      success: true,
      expiresIn: newTokens.expiresIn,
    });
  } catch (error) {
    console.error('[Auth] Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * OAuth configuration info (for frontend)
 */
app.get('/auth/config', (_req: Request, res: Response) => {
  res.json({
    authEnabled: true,
    loginUrl: '/auth/login',
    logoutUrl: '/auth/logout',
    userInfoUrl: '/auth/me',
    authServerUrl: OAUTH_CONFIG.authServerUrl,
  });
});

// ============================================================================
// Session Management
// ============================================================================

/**
 * Session validation middleware
 */
function validateSession(req: Request, res: Response, next: NextFunction): void {
  // Safely access sessionId - req.body may be undefined for GET requests
  const sessionId = req.body?.sessionId || req.params?.sessionId;

  if (!sessionId) {
    next();
    return;
  }

  if (!isValidSessionId(sessionId)) {
    res.status(400).json({
      error: 'Invalid session ID format',
    });
    return;
  }

  const sessionCheck = isSessionValid(sessionId, SESSION_CONFIG);
  if (!sessionCheck.valid && sessions.has(sessionId)) {
    // Session timed out - clean up
    const session = sessions.get(sessionId);
    if (session) {
      session.agent.shutdown().catch(console.error);
    }
    sessions.delete(sessionId);
    clearSessionActivity(sessionId);
    clearCSRFToken(sessionId);

    logAudit({
      sessionId,
      action: 'SESSION_TIMEOUT',
      resource: 'session',
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      outcome: 'success',
      details: { reason: sessionCheck.reason },
    });

    res.status(401).json({
      error: 'Session expired',
      message: sessionCheck.reason,
    });
    return;
  }

  // Update session activity
  trackSessionActivity(sessionId);
  next();
}

app.use(validateSession);

/**
 * Initialize a new healthcare agent session
 */
async function createAgentSession(sessionId: string): Promise<SessionData> {
  const agent = new HealthcareIntelligentAgent();
  await agent.initialize(DEFAULT_HEALTHCARE_SERVERS);

  const sessionData: SessionData = {
    agent,
    breakGlassActive: false,
    auditCount: 0,
  };

  sessions.set(sessionId, sessionData);
  trackSessionActivity(sessionId);

  return sessionData;
}

/**
 * Get session data
 */
function getSession(sessionId: string): SessionData | undefined {
  return sessions.get(sessionId);
}

// API Routes

/**
 * Health check endpoint
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'health-chat',
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size,
    version: '1.0.0',
  });
});

/**
 * Create a new healthcare chat session
 */
app.post('/api/sessions', async (req: Request, res: Response) => {
  try {
    // Check for required environment variable
    if (!process.env.ANTHROPIC_API_KEY) {
      logAudit({
        sessionId: 'system',
        action: 'SESSION_CREATE_FAILED',
        resource: 'session',
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        outcome: 'failure',
        details: { reason: 'ANTHROPIC_API_KEY not configured' },
      });

      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Healthcare AI service not configured',
      });
    }

    const sessionId = generateSessionId();
    await createAgentSession(sessionId);

    // Generate CSRF token for this session
    const csrfToken = generateCSRFToken(sessionId);

    logAudit({
      sessionId,
      action: 'SESSION_CREATED',
      resource: 'session',
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      outcome: 'success',
    });

    res.json({
      sessionId,
      csrfToken,
      created: new Date().toISOString(),
      timeoutMinutes: SESSION_CONFIG.idleTimeoutMs / 60000,
    });
  } catch (error) {
    console.error('Error creating session:', error);

    logAudit({
      sessionId: 'system',
      action: 'SESSION_CREATE_FAILED',
      resource: 'session',
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      outcome: 'failure',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });

    res.status(500).json({
      error: 'Failed to create session',
      message: 'Unable to initialize healthcare services',
    });
  }
});

/**
 * Set access purpose for HIPAA compliance
 */
app.post('/api/sessions/:sessionId/purpose', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { purpose } = req.body;

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!purpose || !isValidAccessPurpose(purpose)) {
    return res.status(400).json({
      error: 'Invalid access purpose',
      validPurposes: ['treatment', 'payment', 'operations', 'emergency', 'research', 'public_health', 'legal'],
    });
  }

  session.accessPurpose = purpose;

  logAudit({
    sessionId,
    action: 'ACCESS_PURPOSE_SET',
    resource: 'session',
    purpose,
    ipAddress: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    outcome: 'success',
  });

  res.json({
    success: true,
    purpose,
    message: `Access purpose set to: ${purpose}`,
  });
});

/**
 * Set patient context
 */
app.post('/api/sessions/:sessionId/patient', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { patientId } = req.body;

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Require access purpose before accessing patient data
  if (!session.accessPurpose) {
    return res.status(403).json({
      error: 'Access purpose required',
      message: 'Please specify the purpose for accessing patient data',
    });
  }

  // Sanitize patient ID
  const sanitizedPatientId = sanitizeInput(patientId);

  // Validate patient ID format (basic validation)
  if (!sanitizedPatientId || !/^P\d+$/.test(sanitizedPatientId)) {
    return res.status(400).json({
      error: 'Invalid patient ID format',
      message: 'Patient ID should be in format P followed by numbers (e.g., P12345)',
    });
  }

  session.patientContext = {
    patientId: sanitizedPatientId,
    loadedAt: new Date().toISOString(),
  };

  logAudit({
    sessionId,
    action: 'PATIENT_CONTEXT_SET',
    resource: 'patient',
    resourceId: sanitizedPatientId,
    purpose: session.accessPurpose,
    ipAddress: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    outcome: 'success',
  });

  res.json({
    success: true,
    patientId: sanitizedPatientId,
    message: `Patient context set for ${sanitizedPatientId}`,
  });
});

/**
 * Activate break-glass access (emergency override)
 */
app.post('/api/sessions/:sessionId/break-glass', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { reason, authorizingProvider } = req.body;

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!reason || !authorizingProvider) {
    return res.status(400).json({
      error: 'Break-glass requires reason and authorizing provider',
    });
  }

  session.breakGlassActive = true;
  session.accessPurpose = 'emergency';

  logAudit({
    sessionId,
    action: 'BREAK_GLASS_ACTIVATED',
    resource: 'access_control',
    purpose: 'emergency',
    ipAddress: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    outcome: 'success',
    details: {
      reason: sanitizeInput(reason),
      authorizingProvider: sanitizeInput(authorizingProvider),
    },
  });

  res.json({
    success: true,
    breakGlassActive: true,
    message: 'Emergency access activated. All access will be logged for review.',
    warning: 'Break-glass access should only be used in genuine emergencies.',
  });
});

/**
 * Send a chat message
 */
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { sessionId, message, csrfToken } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'sessionId and message are required',
      });
    }

    // Validate CSRF token
    if (!csrfToken || !validateCSRFToken(sessionId, csrfToken)) {
      logAudit({
        sessionId,
        action: 'CSRF_VALIDATION_FAILED',
        resource: 'chat',
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        outcome: 'denied',
      });

      return res.status(403).json({
        error: 'Invalid security token',
        message: 'Please refresh the page and try again',
      });
    }

    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Require access purpose for patient-related queries
    const isPatientQuery = /patient|record|medication|prescription|appointment|condition|allerg/i.test(message);
    if (isPatientQuery && !session.accessPurpose) {
      return res.status(403).json({
        error: 'Access purpose required',
        message: 'Please specify the purpose for accessing patient data before making patient-related queries',
        requiresPurpose: true,
      });
    }

    // Sanitize the message
    const sanitizedMessage = sanitizeInput(message);

    // Log the query
    logAudit({
      sessionId,
      action: 'CHAT_QUERY',
      resource: 'chat',
      purpose: session.accessPurpose,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      outcome: 'success',
      details: {
        queryLength: sanitizedMessage.length,
        hasPatientContext: !!session.patientContext,
        breakGlassActive: session.breakGlassActive,
      },
    });

    session.auditCount++;

    // Process the query
    const response = await session.agent.processQuery(message);

    // Log successful response
    logAudit({
      sessionId,
      action: 'CHAT_RESPONSE',
      resource: 'chat',
      purpose: session.accessPurpose,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      outcome: 'success',
      details: {
        responseLength: response.length,
      },
    });

    res.json({
      response,
      timestamp: new Date().toISOString(),
      patientContext: session.patientContext,
      breakGlassActive: session.breakGlassActive,
    });
  } catch (error) {
    console.error('Error processing chat:', error);

    logAudit({
      sessionId: req.body.sessionId || 'unknown',
      action: 'CHAT_ERROR',
      resource: 'chat',
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      outcome: 'failure',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });

    res.status(500).json({
      error: 'Failed to process message',
      message: 'An error occurred while processing your healthcare query',
    });
  }
});

/**
 * Get session audit log
 */
app.get('/api/sessions/:sessionId/audit', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const auditEntries = getAuditLog({ sessionId });

  res.json({
    sessionId,
    entries: auditEntries,
    count: auditEntries.length,
  });
});

/**
 * Reset conversation history
 */
app.post('/api/sessions/:sessionId/reset', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.agent.resetConversation();

  // Clear patient context on reset
  session.patientContext = undefined;
  session.breakGlassActive = false;

  logAudit({
    sessionId,
    action: 'CONVERSATION_RESET',
    resource: 'session',
    ipAddress: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    outcome: 'success',
  });

  res.json({
    success: true,
    message: 'Conversation reset. Patient context cleared.',
  });
});

/**
 * Delete a session
 */
app.delete('/api/sessions/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  await session.agent.shutdown();
  sessions.delete(sessionId);
  clearSessionActivity(sessionId);
  clearCSRFToken(sessionId);

  logAudit({
    sessionId,
    action: 'SESSION_DELETED',
    resource: 'session',
    ipAddress: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    outcome: 'success',
    details: { totalQueries: session.auditCount },
  });

  res.json({
    success: true,
    message: 'Session deleted',
  });
});

/**
 * Get session info
 */
app.get('/api/sessions/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    sessionId,
    active: true,
    patientContext: session.patientContext,
    accessPurpose: session.accessPurpose,
    breakGlassActive: session.breakGlassActive,
    auditCount: session.auditCount,
  });
});

/**
 * List all active sessions (admin endpoint)
 */
app.get('/api/sessions', (_req: Request, res: Response) => {
  const sessionList = Array.from(sessions.entries()).map(([id, data]) => ({
    sessionId: id,
    active: true,
    hasPatientContext: !!data.patientContext,
    accessPurpose: data.accessPurpose,
    breakGlassActive: data.breakGlassActive,
    auditCount: data.auditCount,
  }));

  res.json({
    sessions: sessionList,
    count: sessionList.length,
  });
});

// Catch-all 404 handler for undefined routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'POST /api/sessions',
      'POST /api/chat',
    ],
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`\n🏥 Healthcare Chat Server started on http://localhost:${PORT}`);
  console.log(`\n📋 Security Features Enabled:`);
  console.log(`   ✓ Content Security Policy`);
  console.log(`   ✓ Rate Limiting (${RATE_LIMIT_CONFIG.maxRequests} req/min)`);
  console.log(`   ✓ Input Sanitization`);
  console.log(`   ✓ CSRF Protection`);
  console.log(`   ✓ Session Timeout (${SESSION_CONFIG.idleTimeoutMs / 60000} min idle)`);
  console.log(`   ✓ HIPAA Audit Logging`);
  console.log(`   ✓ OAuth 2.0 + PKCE Authentication`);

  // Register OAuth client with authorization server
  console.log(`\n🔐 Registering OAuth client with ${OAUTH_CONFIG.authServerUrl}...`);
  const registered = await registerOAuthClient();
  if (registered) {
    console.log(`   ✓ OAuth client registered (redirect: ${OAUTH_CONFIG.redirectUri})`);
  } else {
    console.log(`   ⚠ OAuth registration skipped (auth server not available)`);
  }

  console.log(`\n🔐 OAuth Authentication endpoints:`);
  console.log(`   GET    /auth/login                 - Initiate OAuth login`);
  console.log(`   GET    /auth/callback              - OAuth callback handler`);
  console.log(`   POST   /auth/logout                - Logout and revoke tokens`);
  console.log(`   GET    /auth/me                    - Get current user info`);
  console.log(`   POST   /auth/refresh               - Refresh access token`);
  console.log(`   GET    /auth/config                - OAuth configuration`);
  console.log(`\n📋 API endpoints:`);
  console.log(`   POST   /api/sessions               - Create new session`);
  console.log(`   POST   /api/sessions/:id/purpose   - Set access purpose`);
  console.log(`   POST   /api/sessions/:id/patient   - Set patient context`);
  console.log(`   POST   /api/sessions/:id/break-glass - Emergency access`);
  console.log(`   POST   /api/chat                   - Send chat message`);
  console.log(`   GET    /api/sessions/:id/audit     - Get audit log`);
  console.log(`   POST   /api/sessions/:id/reset     - Reset conversation`);
  console.log(`   DELETE /api/sessions/:id           - Delete session`);
  console.log(`   GET    /api/health                 - Health check`);
  console.log(`\n🔑 Environment variables:`);
  console.log(`   ANTHROPIC_API_KEY   - Claude API key (required)`);
  console.log(`   AUTH_SERVER_URL     - OAuth server URL (default: http://localhost:4000)`);
  console.log(`   OAUTH_CLIENT_ID     - OAuth client ID (default: health-chat-client)`);
  console.log(`\n🎨 UI Theme: Earthy Tones (#D7CCC8 → #795548)`);
  console.log('');
});

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n\n🛑 Received ${signal}. Shutting down healthcare chat server...`);

  // Log shutdown
  logAudit({
    sessionId: 'system',
    action: 'SERVER_SHUTDOWN',
    resource: 'server',
    ipAddress: 'localhost',
    userAgent: 'system',
    outcome: 'success',
    details: { signal, activeSessions: sessions.size },
  });

  // Shutdown all active sessions
  for (const [sessionId, session] of sessions) {
    console.log(`   Shutting down session: ${sessionId}`);
    await session.agent.shutdown();
    clearSessionActivity(sessionId);
  }

  console.log('✅ Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
