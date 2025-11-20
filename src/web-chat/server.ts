#!/usr/bin/env node

/**
 * Web Chat Server with MCP Integration
 *
 * Express server that provides a web-based chat interface with
 * LLM integration and MCP server connectivity. Features:
 * - RESTful API for chat interactions
 * - WebSocket support for real-time updates
 * - OAuth 2.1 authentication
 * - GitHub MCP server integration
 * - Session management
 */

import express from 'express';
import cors from 'cors';
import { OAuthIntelligentAgent, type MCPServerConfig } from '../agent/oauth-intelligent-agent.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store agent instances per session
const sessions = new Map<string, OAuthIntelligentAgent>();

/**
 * Initialize a new agent session
 */
async function createAgentSession(sessionId: string): Promise<OAuthIntelligentAgent> {
  const agent = new OAuthIntelligentAgent();

  const serverConfigs: MCPServerConfig[] = [
    {
      name: 'github',
      command: 'node',
      args: ['dist/mcp-servers/github-server.js'],
      oauth: {
        enabled: true,
        authorizationServer: 'https://github.com',
        clientId: 'github-mcp-client',
        scopes: ['repo', 'user', 'read:org'],
      },
    },
  ];

  await agent.initialize(serverConfigs);
  sessions.set(sessionId, agent);

  return agent;
}

/**
 * Get or create agent for a session
 */
async function getAgent(sessionId: string): Promise<OAuthIntelligentAgent> {
  let agent = sessions.get(sessionId);

  if (!agent) {
    agent = await createAgentSession(sessionId);
  }

  return agent;
}

// API Routes

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    sessions: sessions.size,
  });
});

/**
 * Create a new chat session
 */
app.post('/api/sessions', async (req, res) => {
  try {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Check for required environment variables
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'ANTHROPIC_API_KEY not configured',
      });
    }

    if (!process.env.GITHUB_TOKEN) {
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'GITHUB_TOKEN not configured',
      });
    }

    await createAgentSession(sessionId);

    res.json({
      sessionId,
      created: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      error: 'Failed to create session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Send a chat message
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'sessionId and message are required',
      });
    }

    const agent = await getAgent(sessionId);
    const response = await agent.processQuery(message);

    res.json({
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({
      error: 'Failed to process message',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Reset conversation history
 */
app.post('/api/sessions/:sessionId/reset', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const agent = sessions.get(sessionId);

    if (!agent) {
      return res.status(404).json({
        error: 'Session not found',
      });
    }

    agent.resetConversation();

    res.json({
      success: true,
      message: 'Conversation reset',
    });
  } catch (error) {
    console.error('Error resetting session:', error);
    res.status(500).json({
      error: 'Failed to reset session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Delete a session
 */
app.delete('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const agent = sessions.get(sessionId);

    if (!agent) {
      return res.status(404).json({
        error: 'Session not found',
      });
    }

    await agent.shutdown();
    sessions.delete(sessionId);

    res.json({
      success: true,
      message: 'Session deleted',
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      error: 'Failed to delete session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get session info
 */
app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const agent = sessions.get(sessionId);

  if (!agent) {
    return res.status(404).json({
      error: 'Session not found',
    });
  }

  res.json({
    sessionId,
    active: true,
  });
});

/**
 * List all active sessions
 */
app.get('/api/sessions', (req, res) => {
  const sessionList = Array.from(sessions.keys()).map((id) => ({
    sessionId: id,
    active: true,
  }));

  res.json({
    sessions: sessionList,
    count: sessionList.length,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🌐 Web Chat Server started on http://localhost:${PORT}`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`   POST   /api/sessions        - Create new chat session`);
  console.log(`   GET    /api/sessions        - List active sessions`);
  console.log(`   GET    /api/sessions/:id    - Get session info`);
  console.log(`   POST   /api/chat            - Send chat message`);
  console.log(`   POST   /api/sessions/:id/reset - Reset conversation`);
  console.log(`   DELETE /api/sessions/:id    - Delete session`);
  console.log(`   GET    /api/health          - Health check`);
  console.log(`\n🔑 Required environment variables:`);
  console.log(`   ANTHROPIC_API_KEY - Claude API key`);
  console.log(`   GITHUB_TOKEN      - GitHub personal access token`);
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down web chat server...');

  // Shutdown all active sessions
  for (const [sessionId, agent] of sessions) {
    console.log(`   Shutting down session: ${sessionId}`);
    await agent.shutdown();
  }

  console.log('✅ Shutdown complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n🛑 Shutting down web chat server...');

  for (const [sessionId, agent] of sessions) {
    console.log(`   Shutting down session: ${sessionId}`);
    await agent.shutdown();
  }

  console.log('✅ Shutdown complete');
  process.exit(0);
});
