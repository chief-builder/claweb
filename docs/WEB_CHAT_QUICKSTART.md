# Web Chat Quickstart Guide

Get started with the MCP-powered web chat in 5 minutes!

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Anthropic API Key** - Get one from https://console.anthropic.com/
3. **GitHub Personal Access Token** - Get one from https://github.com/settings/tokens

## Quick Start

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Set Environment Variables

```bash
# Required: Claude API key
export ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Required: GitHub token for MCP server
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: Custom port (default: 3001)
export PORT=3001
```

### Step 3: Build the Project

```bash
npm run build
```

### Step 4: Start the Web Chat Server

```bash
npm run web-chat
```

You should see:

```
🌐 Web Chat Server started on http://localhost:3001

📋 Available endpoints:
   POST   /api/sessions        - Create new chat session
   GET    /api/sessions        - List active sessions
   GET    /api/sessions/:id    - Get session info
   POST   /api/chat            - Send chat message
   POST   /api/sessions/:id/reset - Reset conversation
   DELETE /api/sessions/:id    - Delete session
   GET    /api/health          - Health check

🔑 Required environment variables:
   ANTHROPIC_API_KEY - Claude API key
   GITHUB_TOKEN      - GitHub personal access token
```

### Step 5: Open in Browser

Open your browser to: **http://localhost:3001**

You should see a modern chat interface!

## Try These Queries

Once the chat interface is open, try these example queries:

### List Repositories
```
List my GitHub repositories
```

### Repository Details
```
Get details about chief-builder/claweb
```

### View Issues
```
Show me open issues in chief-builder/claweb
```

### Search Code
```
Search for "OAuth" in chief-builder/claweb
```

### File Contents
```
Get the contents of README.md from chief-builder/claweb
```

## Architecture

```
┌─────────────────────┐
│   Browser Client    │
│  (http://localhost  │
│      :3001)         │
└──────────┬──────────┘
           │ HTTP/REST
           ▼
┌─────────────────────┐
│   Express Server    │
│ (web-chat/server.ts)│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  OAuth Agent        │
│  (Multi-Server)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  GitHub MCP Server  │
│  (OAuth Protected)  │
└─────────────────────┘
```

## API Usage

You can also use the API directly:

### Create a Session

```bash
curl -X POST http://localhost:3001/api/sessions
```

Response:
```json
{
  "sessionId": "session_1234567890_abc123",
  "created": "2025-11-20T12:00:00.000Z"
}
```

### Send a Message

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_1234567890_abc123",
    "message": "List my repositories"
  }'
```

Response:
```json
{
  "response": "Here are your repositories:\n- user/repo1 (⭐ 42)\n- user/repo2 (⭐ 13)",
  "timestamp": "2025-11-20T12:00:01.000Z"
}
```

### Reset Conversation

```bash
curl -X POST http://localhost:3001/api/sessions/session_1234567890_abc123/reset
```

### Delete Session

```bash
curl -X DELETE http://localhost:3001/api/sessions/session_1234567890_abc123
```

## Development Mode

For faster development with auto-reload:

```bash
npm run dev:web-chat
```

This uses `tsx` to run TypeScript directly without building.

## Running Individual MCP Servers

### GitHub MCP Server

```bash
# Set environment variable
export GITHUB_TOKEN=ghp_xxx

# Build and run
npm run build
npm run mcp:github
```

### Playwright MCP Server

```bash
# Build and run
npm run build
npm run mcp:playwright
```

## Troubleshooting

### "Failed to create session"

**Cause**: Missing environment variables

**Solution**:
```bash
# Check if variables are set
echo $ANTHROPIC_API_KEY
echo $GITHUB_TOKEN

# Set them if missing
export ANTHROPIC_API_KEY=sk-ant-xxx
export GITHUB_TOKEN=ghp_xxx
```

### "Connection failed" in Browser

**Cause**: Server not running or wrong port

**Solution**:
1. Check server is running: `ps aux | grep web-chat`
2. Check port: `lsof -i :3001`
3. Restart server: `npm run web-chat`

### CORS Errors

**Cause**: Frontend trying to connect from different origin

**Solution**: The server already has CORS enabled. If issues persist, check browser console for the exact error.

### Rate Limit Errors

**Cause**: GitHub API rate limit exceeded

**Solution**:
- Authenticated requests get 5,000/hour (vs 60/hour unauthenticated)
- Always set `GITHUB_TOKEN` environment variable
- Wait for rate limit to reset

## Features

### Current Features

- ✅ Real-time chat interface
- ✅ GitHub repository browsing
- ✅ Issue tracking
- ✅ Code search
- ✅ File content viewing
- ✅ Session management
- ✅ Conversation history
- ✅ OAuth 2.1 authentication
- ✅ Error handling
- ✅ Suggested queries

### Planned Features

- 🔜 WebSocket support for real-time updates
- 🔜 Multi-user authentication
- 🔜 Markdown rendering
- 🔜 Code syntax highlighting
- 🔜 File upload support
- 🔜 Repository cloning via Playwright
- 🔜 Automated testing workflows

## Security Notes

1. **Never commit tokens**: Add `.env` to `.gitignore`
2. **Use environment variables**: Don't hardcode secrets
3. **Token scopes**: Only request necessary GitHub scopes
4. **HTTPS in production**: Use SSL/TLS for production deployments
5. **Rate limiting**: Implement rate limiting for production use

## Next Steps

1. **Customize the UI**: Edit `public/index.html`
2. **Add more MCP servers**: Create new servers in `src/mcp-servers/`
3. **Extend GitHub tools**: Add more GitHub API endpoints
4. **Add authentication**: Implement user login
5. **Deploy to production**: Use services like Vercel, Netlify, or Railway

## Learn More

- [MCP Servers Guide](./MCP_SERVERS_GUIDE.md) - Complete documentation
- [OAuth Implementation](../OAUTH_IMPLEMENTATION_SUMMARY.md) - OAuth 2.1 details
- [MCP Specification](https://modelcontextprotocol.io/) - Official MCP docs

## Support

Having issues? Check:

1. **Logs**: Check server console for errors
2. **Browser Console**: Check for frontend errors
3. **Environment**: Verify all environment variables are set
4. **Dependencies**: Run `npm install` again

---

**Happy chatting! 🚀**
