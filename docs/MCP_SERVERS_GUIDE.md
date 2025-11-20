# MCP Servers Implementation Guide

This guide covers the implementation of Playwright and GitHub MCP servers with OAuth 2.1 integration.

## Overview

We have implemented two production-ready MCP servers:

1. **Playwright MCP Server** - Browser automation capabilities
2. **GitHub MCP Server** - GitHub API integration with OAuth

Both servers follow MCP 2025-06-18 specification and support OAuth 2.1 authentication.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Chat UI                            │
│                    (Browser Client)                         │
└───────────────┬─────────────────────────────────────────────┘
                │
                │ HTTP/REST
                ▼
┌─────────────────────────────────────────────────────────────┐
│                  Express Web Server                         │
│               (src/web-chat/server.ts)                      │
└───────────────┬─────────────────────────────────────────────┘
                │
                │ Uses
                ▼
┌─────────────────────────────────────────────────────────────┐
│              OAuth Intelligent Agent                        │
│          (src/agent/oauth-intelligent-agent.ts)             │
└─────┬─────────────────────────────────┬─────────────────────┘
      │                                 │
      │ Connects to                     │ Connects to
      ▼                                 ▼
┌──────────────────────┐    ┌──────────────────────────────┐
│  Playwright MCP      │    │   GitHub MCP Server          │
│  Server              │    │   (OAuth Protected)          │
│                      │    │                              │
│  • navigate          │    │   • list_repositories        │
│  • screenshot        │    │   • get_repository           │
│  • click             │    │   • list_issues              │
│  • fill              │    │   • create_issue             │
│  • extract_text      │    │   • list_pull_requests       │
│  • evaluate          │    │   • get_file_contents        │
└──────────────────────┘    │   • search_code              │
                            └──────────────────────────────┘
```

---

## Playwright MCP Server

### Features

The Playwright MCP Server provides browser automation through the following tools:

| Tool | Description | OAuth Required |
|------|-------------|----------------|
| `navigate` | Navigate to a URL | No |
| `screenshot` | Take screenshots (full page or element) | No |
| `click` | Click on elements via CSS selector | No |
| `fill` | Fill form inputs | No |
| `extract_text` | Extract text content from page/element | No |
| `evaluate` | Execute JavaScript in browser context | No |

### File Location

```
src/mcp-servers/playwright-server.ts
```

### Running the Server

```bash
# Build first
npm run build

# Run the server
node dist/mcp-servers/playwright-server.js
```

### Example Usage

```typescript
import { MCPClient } from './client';

const client = new MCPClient();
await client.connect('node', ['dist/mcp-servers/playwright-server.js']);

// Navigate to a page
await client.callTool('navigate', { url: 'https://example.com' });

// Take a screenshot
await client.callTool('screenshot', { name: 'example', fullPage: true });

// Extract text
await client.callTool('extract_text', { selector: 'h1' });
```

### Tool Schemas

#### navigate

```json
{
  "name": "navigate",
  "inputSchema": {
    "type": "object",
    "properties": {
      "url": { "type": "string", "description": "The URL to navigate to" }
    },
    "required": ["url"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": { "type": "boolean" },
      "url": { "type": "string" },
      "title": { "type": "string" },
      "timestamp": { "type": "string", "format": "date-time" }
    }
  }
}
```

#### screenshot

```json
{
  "name": "screenshot",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Name for the screenshot" },
      "selector": { "type": "string", "description": "CSS selector (optional)" },
      "fullPage": { "type": "boolean", "description": "Capture full page", "default": false }
    },
    "required": ["name"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": { "type": "boolean" },
      "name": { "type": "string" },
      "path": { "type": "string" },
      "timestamp": { "type": "string", "format": "date-time" }
    }
  }
}
```

### Resources

The Playwright server exposes screenshots as MCP resources:

- **URI Format**: `screenshot://{name}`
- **MIME Type**: `image/png`
- **Metadata**: Creation timestamp, path, selector used

---

## GitHub MCP Server

### Features

The GitHub MCP Server provides GitHub API access through the following tools:

| Tool | Description | OAuth Required | Scopes Needed |
|------|-------------|----------------|---------------|
| `list_repositories` | List user/org repositories | Yes | `repo`, `read:org` |
| `get_repository` | Get repository details | Yes | `repo` |
| `list_issues` | List repository issues | Yes | `repo` |
| `create_issue` | Create a new issue | Yes | `repo` |
| `list_pull_requests` | List pull requests | Yes | `repo` |
| `get_file_contents` | Get file from repository | Yes | `repo` |
| `search_code` | Search code across GitHub | Yes | `repo` |

### File Location

```
src/mcp-servers/github-server.ts
```

### OAuth Configuration

The GitHub MCP server requires OAuth authentication:

```typescript
{
  oauth: {
    enabled: true,
    authorizationServer: 'https://github.com',
    clientId: 'your-github-app-client-id',
    scopes: ['repo', 'user', 'read:org']
  }
}
```

### Required Environment Variables

```bash
# GitHub Personal Access Token or OAuth token
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Alternative variable name
export GITHUB_ACCESS_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

### Running the Server

```bash
# Set your GitHub token
export GITHUB_TOKEN=your_github_token

# Build first
npm run build

# Run the server
node dist/mcp-servers/github-server.js
```

### Example Usage

```typescript
import { OAuthIntelligentAgent } from './agent/oauth-intelligent-agent';

const agent = new OAuthIntelligentAgent();

await agent.initialize([
  {
    name: 'github',
    command: 'node',
    args: ['dist/mcp-servers/github-server.js'],
    oauth: {
      enabled: true,
      authorizationServer: 'https://github.com',
      clientId: 'github-mcp-client',
      scopes: ['repo', 'user', 'read:org']
    }
  }
]);

// Query the agent
const response = await agent.processQuery('List my GitHub repositories');
```

### Tool Schemas

#### list_repositories

```json
{
  "name": "list_repositories",
  "inputSchema": {
    "type": "object",
    "properties": {
      "username": { "type": "string", "description": "Username/org (optional)" },
      "type": { "type": "string", "enum": ["all", "owner", "public", "private", "member"], "default": "all" },
      "sort": { "type": "string", "enum": ["created", "updated", "pushed", "full_name"], "default": "updated" },
      "per_page": { "type": "number", "description": "Results per page (max 100)", "default": 30 }
    }
  }
}
```

#### get_repository

```json
{
  "name": "get_repository",
  "inputSchema": {
    "type": "object",
    "properties": {
      "owner": { "type": "string", "description": "Repository owner" },
      "repo": { "type": "string", "description": "Repository name" }
    },
    "required": ["owner", "repo"]
  }
}
```

#### create_issue

```json
{
  "name": "create_issue",
  "inputSchema": {
    "type": "object",
    "properties": {
      "owner": { "type": "string" },
      "repo": { "type": "string" },
      "title": { "type": "string" },
      "body": { "type": "string" },
      "labels": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["owner", "repo", "title"]
  }
}
```

### Resources

The GitHub server exposes user profile as an MCP resource:

- **URI**: `github://user`
- **MIME Type**: `application/json`
- **Content**: Authenticated user profile information
- **Requires**: OAuth authentication

---

## OAuth-Aware Intelligent Agent

### Overview

The `OAuthIntelligentAgent` extends the basic `IntelligentAgent` to support:

- Multiple MCP server connections
- OAuth 2.1 authentication with PKCE
- Scope-based access control
- Token management and refresh
- Automatic tool routing to correct server

### File Location

```
src/agent/oauth-intelligent-agent.ts
```

### Configuration

```typescript
import { OAuthIntelligentAgent, MCPServerConfig } from './agent/oauth-intelligent-agent';

const serverConfigs: MCPServerConfig[] = [
  {
    name: 'playwright',
    command: 'node',
    args: ['dist/mcp-servers/playwright-server.js'],
    oauth: {
      enabled: false  // Playwright doesn't require OAuth
    }
  },
  {
    name: 'github',
    command: 'node',
    args: ['dist/mcp-servers/github-server.js'],
    oauth: {
      enabled: true,
      authorizationServer: 'https://github.com',
      clientId: 'github-mcp-client',
      scopes: ['repo', 'user', 'read:org'],
      resources: ['https://api.github.com']  // RFC 8707 resource indicators
    }
  }
];

const agent = new OAuthIntelligentAgent(process.env.ANTHROPIC_API_KEY);
await agent.initialize(serverConfigs);
```

### Features

1. **Multi-Server Support**: Connect to multiple MCP servers simultaneously
2. **Tool Namespacing**: Tools are prefixed with server name (e.g., `github__list_repositories`)
3. **Automatic Routing**: Agent routes tool calls to the correct server
4. **OAuth Integration**: Handles OAuth flow for protected servers
5. **Token Management**: Stores and manages OAuth tokens per server
6. **Scope Validation**: Ensures requests have proper OAuth scopes

### Usage Example

```typescript
const agent = new OAuthIntelligentAgent();
await agent.initialize(serverConfigs);

// The agent intelligently selects the right tools
const response = await agent.processQuery(
  'List my repositories and take a screenshot of the first one'
);

console.log(response);
```

---

## Web Chat UI

### Overview

A complete web-based chat interface for interacting with MCP servers through Claude.

### Components

1. **Backend Server** (`src/web-chat/server.ts`)
   - Express REST API
   - Session management
   - Agent lifecycle management

2. **Frontend** (`public/index.html`)
   - Modern chat interface
   - Real-time messaging
   - Suggested queries
   - Error handling

### Running the Web Chat

```bash
# Set required environment variables
export ANTHROPIC_API_KEY=sk-ant-xxx
export GITHUB_TOKEN=ghp_xxx

# Build the project
npm run build

# Start the web chat server
npm run web-chat
```

Then open http://localhost:3001 in your browser.

### API Endpoints

#### POST /api/sessions
Create a new chat session

**Response:**
```json
{
  "sessionId": "session_1234567890_abc123",
  "created": "2025-11-20T12:00:00.000Z"
}
```

#### POST /api/chat
Send a chat message

**Request:**
```json
{
  "sessionId": "session_1234567890_abc123",
  "message": "List my GitHub repositories"
}
```

**Response:**
```json
{
  "response": "Here are your repositories:\n- user/repo1 (⭐ 42)\n- user/repo2 (⭐ 13)",
  "timestamp": "2025-11-20T12:00:01.000Z"
}
```

#### POST /api/sessions/:sessionId/reset
Reset conversation history

#### DELETE /api/sessions/:sessionId
Delete a session and cleanup resources

#### GET /api/health
Health check endpoint

---

## Environment Variables

### Required

```bash
# Claude API Key (required for all agents)
export ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# GitHub Token (required for GitHub MCP server)
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# OR
export GITHUB_ACCESS_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Optional

```bash
# Web server port (default: 3001)
export PORT=3001

# OAuth client credentials (if using full OAuth flow)
export GITHUB_CLIENT_ID=your_client_id
export GITHUB_CLIENT_SECRET=your_client_secret
```

---

## Getting a GitHub Token

### Personal Access Token (Classic)

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select scopes:
   - `repo` - Full control of private repositories
   - `user` - Read user profile data
   - `read:org` - Read org and team membership
4. Generate and copy the token
5. Set as environment variable: `export GITHUB_TOKEN=ghp_xxx`

### Fine-grained Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Click "Generate new token"
3. Select repository access and permissions:
   - Repository access: All repositories or select repositories
   - Repository permissions:
     - Contents: Read and write
     - Issues: Read and write
     - Pull requests: Read and write
4. Generate and copy the token
5. Set as environment variable: `export GITHUB_TOKEN=github_pat_xxx`

---

## Security Considerations

### OAuth Best Practices

1. **Scope Minimization**: Only request necessary scopes
   ```typescript
   scopes: ['repo']  // Don't request admin:org if you only need repo access
   ```

2. **Token Storage**: Never commit tokens to version control
   ```bash
   # Use environment variables
   export GITHUB_TOKEN=xxx

   # Or use .env file (add to .gitignore)
   echo "GITHUB_TOKEN=xxx" > .env
   ```

3. **PKCE**: Always use PKCE for public clients
   ```typescript
   oauth: {
     enabled: true,
     usePKCE: true  // Recommended for all OAuth flows
   }
   ```

4. **Token Expiration**: Implement token refresh logic
   ```typescript
   if (isTokenExpired(tokens)) {
     tokens = await refreshToken(tokens.refresh_token);
   }
   ```

### Rate Limiting

GitHub API has rate limits:
- **Authenticated**: 5,000 requests/hour
- **Unauthenticated**: 60 requests/hour

The MCP server automatically uses authentication when GITHUB_TOKEN is provided.

---

## Testing

### Test Playwright Server

```bash
# Terminal 1: Start the server
npm run build
node dist/mcp-servers/playwright-server.js

# Terminal 2: Use the client
npm run dev:agent
```

### Test GitHub Server

```bash
# Set your token
export GITHUB_TOKEN=ghp_xxx

# Terminal 1: Start the server
npm run build
node dist/mcp-servers/github-server.js

# Terminal 2: Test with the OAuth agent
node dist/agent/oauth-intelligent-agent.js
```

### Test Web Chat

```bash
# Set environment variables
export ANTHROPIC_API_KEY=sk-ant-xxx
export GITHUB_TOKEN=ghp_xxx

# Build and start
npm run build
npm run web-chat

# Open browser to http://localhost:3001
```

---

## Troubleshooting

### "GitHub access token not found"

**Solution**: Set the GITHUB_TOKEN environment variable
```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx
```

### "Failed to create session"

**Causes**:
1. ANTHROPIC_API_KEY not set
2. GITHUB_TOKEN not set
3. Server not running

**Solution**:
```bash
# Check environment variables
echo $ANTHROPIC_API_KEY
echo $GITHUB_TOKEN

# Restart server with proper env vars
export ANTHROPIC_API_KEY=sk-ant-xxx
export GITHUB_TOKEN=ghp_xxx
npm run web-chat
```

### "Browser not initialized"

**Cause**: Playwright browser failed to launch

**Solution**:
```bash
# Install Playwright browsers
npx playwright install chromium

# Or install all browsers
npx playwright install
```

### Rate Limit Exceeded

**Solution**: Wait for rate limit to reset or use authenticated requests:
```bash
# Always set GITHUB_TOKEN to get 5,000 requests/hour instead of 60
export GITHUB_TOKEN=ghp_xxx
```

---

## Next Steps

1. **Implement Full OAuth Flow**: Add interactive OAuth consent flow
2. **Add More Tools**: Extend GitHub server with more API endpoints
3. **WebSocket Support**: Add real-time updates to web chat
4. **Multi-User Support**: Add user authentication and multi-tenancy
5. **Tool Composition**: Chain multiple tools together
6. **Error Recovery**: Add retry logic and better error handling

---

## References

- [MCP Specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18)
- [OAuth 2.1 Draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-07)
- [RFC 8707 - Resource Indicators](https://datatracker.ietf.org/doc/html/rfc8707)
- [Playwright API](https://playwright.dev/docs/api/class-playwright)
- [Octokit (GitHub API)](https://github.com/octokit/rest.js)
- [Anthropic Claude API](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)

---

**Document Version:** 1.0
**Last Updated:** November 20, 2025
**Author:** MCP Reference Implementation Team
