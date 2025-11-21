# MCP Reference Implementation

A comprehensive reference implementation of the Model Context Protocol (MCP) using the official TypeScript SDK. This project demonstrates how to build MCP servers, clients, and agents with practical examples - from simple rule-based agents to production-ready web applications with OAuth authentication.

## 📋 Overview

This reference implementation showcases a progressive learning path:

1. **MCP Server**: A fully-featured server exposing tools, resources, and prompts
2. **MCP Client**: A client that connects to servers and interacts with their capabilities
3. **Simple Agent**: Rule-based tool orchestration and workflow execution
4. **Intelligent Agent**: AI-powered agent using Claude for smart tool selection 🧠
5. **OAuth Intelligent Agent**: Multi-server agent with OAuth 2.1 authentication 🔐
6. **Web Chat**: Production-ready web interface with GitHub & Playwright MCP integration 🌐

## 🏗️ Architecture

### Agent Progression (Simple → Advanced)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           AGENT COMPLEXITY PROGRESSION                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  Level 1: Simple Agent          Level 2: Intelligent Agent                       │
│  ┌─────────────────────┐        ┌─────────────────────────┐                      │
│  │   Simple Agent      │        │   Intelligent Agent     │                      │
│  │   (Rule-based)      │        │   (Claude Haiku)        │                      │
│  │                     │        │                         │                      │
│  │ • Pattern matching  │   →    │ • Natural language      │                      │
│  │ • Pre-defined       │        │ • Smart tool selection  │                      │
│  │   workflows         │        │ • Multi-step reasoning  │                      │
│  │ • Single server     │        │ • Single server         │                      │
│  └──────────┬──────────┘        └──────────┬──────────────┘                      │
│             │                              │                                      │
│             ▼                              ▼                                      │
│  Level 3: OAuth Intelligent Agent   Level 4: Web Chat Application               │
│  ┌─────────────────────────┐        ┌───────────────────────────────┐           │
│  │ OAuth Intelligent Agent │        │      Web Chat Server          │           │
│  │ (Multi-Server + Auth)   │        │   (Express + MCP + OAuth)     │           │
│  │                         │        │                               │           │
│  │ • OAuth 2.1 + PKCE      │   →    │ • RESTful API                 │           │
│  │ • Multiple MCP servers  │        │ • Session management          │           │
│  │ • Token management      │        │ • GitHub + Playwright MCP     │           │
│  │ • Scope-based access    │        │ • Production-ready            │           │
│  └─────────────────────────┘        └───────────────────────────────┘           │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              WEB CHAT APPLICATION                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        Browser Client                                    │    │
│  │                    (http://localhost:3001)                               │    │
│  └─────────────────────────────────┬───────────────────────────────────────┘    │
│                                    │ HTTP/REST API                              │
│                                    ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                      Express Server (web-chat/server.ts)                 │    │
│  │  • Session management • API endpoints • Static file serving              │    │
│  └─────────────────────────────────┬───────────────────────────────────────┘    │
│                                    │                                            │
│                                    ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │              OAuth Intelligent Agent (oauth-intelligent-agent.ts)        │    │
│  │  • Claude integration • Multi-server routing • OAuth token handling      │    │
│  └────────────────────┬────────────────────────────────┬───────────────────┘    │
│                       │                                │                        │
│          ┌────────────▼────────────┐      ┌────────────▼────────────┐          │
│          │   GitHub MCP Server     │      │  Playwright MCP Server  │          │
│          │  (OAuth Protected)      │      │  (Browser Automation)   │          │
│          │                         │      │                         │          │
│          │ • list_repositories     │      │ • navigate              │          │
│          │ • get_repository        │      │ • screenshot            │          │
│          │ • list_issues           │      │ • click                 │          │
│          │ • search_code           │      │ • extract_text          │          │
│          │ • get_file_contents     │      │ • fill                  │          │
│          └─────────────────────────┘      └─────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Installation

```bash
npm install
npm run build
```

### Running the Server

**stdio transport (default):**
```bash
npm run server
```

The server will start and listen on stdio for MCP protocol messages.

**HTTP transport (new! MCP 2025-06-18):** 🌐
```bash
npm run dev:server:http
```

The HTTP server will start with:
- RESTful HTTP endpoints
- Server-Sent Events (SSE) streaming
- MCP-Protocol-Version headers
- CORS support
- Real-time client connections

See [HTTP_TRANSPORT.md](./HTTP_TRANSPORT.md) for complete documentation.

### Running the Client

```bash
npm run client
```

The client will:
1. Connect to the server
2. Discover available tools and resources
3. Execute sample tool calls
4. Read resources
5. Display results

## 🤖 Agent Types (Progressive Learning Path)

This project demonstrates four levels of agent complexity, each building on the previous:

---

### Level 1: Simple Agent 📋

**File:** `src/agent/simple-agent.ts`

A rule-based agent that demonstrates basic MCP tool orchestration without AI. Perfect for understanding MCP fundamentals.

```bash
npm run agent
```

**Features:**
- Pattern matching for task routing
- Pre-defined workflows
- Direct tool invocation
- Single MCP server connection

**What it demonstrates:**
1. Connecting to an MCP server
2. Discovering available tools and resources
3. Executing tool calls
4. Reading resources
5. Basic workflow orchestration

**Example Usage:**
```typescript
import { SimpleAgent } from './src/agent/simple-agent.js';

const agent = new SimpleAgent();
await agent.initialize('node', ['dist/server/index.js']);

// Execute predefined workflows
await agent.executeWorkflow();

// Execute custom tasks (pattern-matched)
await agent.executeTask('Calculate 42 multiply 3');
await agent.executeTask('What is the current time?');

await agent.shutdown();
```

**Best for:** Learning MCP basics, testing server tools, simple automation.

---

### Level 2: Intelligent Agent 🧠

**File:** `src/agent/intelligent-agent.ts`

An AI-powered agent using Claude Haiku for intelligent tool selection based on natural language.

```bash
# Set your Anthropic API key first
export ANTHROPIC_API_KEY=your-api-key-here

# Run the intelligent agent
npm run dev:agent:intelligent

# Or run the interactive example
npm run example:interactive
```

**Features:**
- Natural language understanding via Claude
- Automatic tool selection
- Multi-step reasoning and tool chaining
- Conversation history management
- Single MCP server connection

**What it demonstrates:**
1. Converting MCP tools to Claude's tool format
2. Implementing an agentic loop
3. Handling tool use responses
4. Managing conversation context

**Example Usage:**
```typescript
import { IntelligentAgent } from './src/agent/intelligent-agent.js';

const agent = new IntelligentAgent();
await agent.initialize('node', ['dist/server/index.js']);

// Natural language queries
const response = await agent.processQuery(
  'Calculate 50 times 3, then tell me the current time'
);
console.log(response);

// Multi-turn conversations (remembers context)
await agent.processQuery('Now divide that result by 5');

agent.resetConversation(); // Clear history
await agent.shutdown();
```

**Example queries:**
- "What is 42 times 7?"
- "Calculate 100 divided by 5, then add 30 to the result"
- "Tell me the current time and server status"

**Best for:** Natural language interfaces, smart automation, learning Claude tool use.

See [INTELLIGENT_AGENT.md](./INTELLIGENT_AGENT.md) for detailed documentation.

---

### Level 3: OAuth Intelligent Agent 🔐

**File:** `src/agent/oauth-intelligent-agent.ts`

A multi-server agent with OAuth 2.1 authentication support for connecting to protected MCP resources.

```bash
# Set required environment variables
export ANTHROPIC_API_KEY=your-api-key-here
export GITHUB_TOKEN=ghp_your_github_token_here

# Run the OAuth-aware agent
npm run dev:agent:oauth
```

**Features:**
- OAuth 2.1 authentication with PKCE support
- Multiple MCP server connections
- Scope-based access control
- Token management (environment variables or interactive flow)
- Tool namespacing (prevents conflicts between servers)

**What it demonstrates:**
1. Configuring multiple MCP servers
2. OAuth token handling for protected resources
3. Routing tool calls to correct servers
4. Namespaced tool names (`serverName__toolName`)

**Example Usage:**
```typescript
import { OAuthIntelligentAgent, type MCPServerConfig } from './src/agent/oauth-intelligent-agent.js';

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
      scopes: ['repo', 'user'],
    },
  },
  {
    name: 'playwright',
    command: 'node',
    args: ['dist/mcp-servers/playwright-server.js'],
    oauth: { enabled: false, authorizationServer: '', clientId: '', scopes: [] },
  },
];

await agent.initialize(serverConfigs);

// Query uses tools from multiple servers
const response = await agent.processQuery('List my GitHub repositories');
console.log(response);

await agent.shutdown();
```

**Example queries:**
- "List my GitHub repositories"
- "Get details about owner/repo repository"
- "What issues are open in owner/repo?"
- "Navigate to github.com and take a screenshot"

**Best for:** Production agents, multi-service integration, OAuth-protected APIs.

---

### Level 4: Web Chat Application 🌐

**Files:** `src/web-chat/server.ts`, `public/index.html`

A production-ready web application with a chat interface, session management, and multi-MCP server integration.

```bash
# Set required environment variables
export ANTHROPIC_API_KEY=your-api-key-here
export GITHUB_TOKEN=ghp_your_github_token_here

# Build and run
npm run build
npm run web-chat

# Or development mode with auto-reload
npm run dev:web-chat
```

**Features:**
- Express.js web server
- RESTful API endpoints
- Session-based agent instances
- GitHub MCP server integration (OAuth)
- Playwright MCP server integration (browser automation)
- Static file serving for frontend
- Graceful shutdown handling

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sessions` | Create new chat session |
| GET | `/api/sessions` | List active sessions |
| GET | `/api/sessions/:id` | Get session info |
| POST | `/api/chat` | Send chat message |
| POST | `/api/sessions/:id/reset` | Reset conversation |
| DELETE | `/api/sessions/:id` | Delete session |
| GET | `/api/health` | Health check |

**Example API Usage:**
```bash
# Create a session
curl -X POST http://localhost:3001/api/sessions

# Send a message
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_123_abc",
    "message": "List my GitHub repositories"
  }'
```

**Best for:** Production deployments, web interfaces, team collaboration tools.

See [docs/WEB_CHAT_QUICKSTART.md](./docs/WEB_CHAT_QUICKSTART.md) for detailed documentation.

## 🔐 OAuth 2.1 Authentication (NEW!)

Full OAuth 2.1 implementation with RFC 8707 Resource Indicators for secure MCP server access.

### Three-Role Architecture

1. **Authorization Server** - Issues JWT access tokens
2. **Resource Server** - Validates tokens, serves protected MCP resources
3. **OAuth Client** - Obtains and uses tokens

### Quick Start

```bash
# Test complete OAuth flow
npm run example:oauth:test-flow

# Or run components separately:
npm run example:oauth:auth-server    # Terminal 1
npm run example:oauth:resource-server # Terminal 2
npm run example:oauth:client          # Terminal 3
```

### Features

✅ **JWT Bearer Tokens** (RS256, 2048-bit RSA)
✅ **PKCE** (RFC 7636) for authorization code flow
✅ **Dynamic Client Registration** (RFC 7591)
✅ **Token Introspection** (RFC 7662)
✅ **Resource Indicators** (RFC 8707) for fine-grained access
✅ **JWKS** endpoint for public key distribution
✅ **20/20 tests passing** with complete coverage

### Example Output

```
✓ Access token obtained
  Token payload: {
    "iss": "http://localhost:4000",
    "scope": "mcp.tools.read",
    "resource": ["mcp://tools"]
  }

✓ Successfully accessed /mcp/tools
  Tools: [{"name": "calculator", ...}]
```

**Documentation**: See [examples/oauth-roles/README.md](./examples/oauth-roles/README.md) for complete guide including:
- Architecture diagrams
- Security best practices
- Production deployment guide
- Troubleshooting
- Token structure details

## 📦 Features

### Tools

The server provides the following tools:

#### 1. **calculator**
Performs basic arithmetic operations.

**Input Schema:**
```json
{
  "operation": "add" | "subtract" | "multiply" | "divide",
  "a": number,
  "b": number
}
```

**Example:**
```typescript
await client.callTool('calculator', {
  operation: 'add',
  a: 10,
  b: 5
});
// Returns: { result: 15, expression: "10 + 5 = 15" }
```

#### 2. **echo**
Echoes back the provided message.

**Input Schema:**
```json
{
  "message": string
}
```

**Example:**
```typescript
await client.callTool('echo', {
  message: 'Hello, MCP!'
});
// Returns: "Hello, MCP!"
```

#### 3. **get_current_time**
Returns the current server time.

**Input Schema:**
```json
{
  "timezone": string (optional)
}
```

**Example:**
```typescript
await client.callTool('get_current_time', {
  timezone: 'America/New_York'
});
// Returns: { timestamp: "2025-11-15T...", formatted: "...", ... }
```

#### 4. **get_server_logs** 🆕
Get server logs with resource links (MCP 2025-06-18).

**Input Schema:**
```json
{
  "logType": "error" | "access" | "debug",
  "lines": number (optional)
}
```

**Example:**
```typescript
await client.callTool('get_server_logs', {
  logType: 'access',
  lines: 100
});
// Returns resource link to log file
```

**Features:**
- Demonstrates MCP 2025-06-18 resource links
- Points to external log files instead of inlining
- Efficient for large files

### Resources

The server provides the following resources:

#### 1. **config://server**
Server configuration and settings.

**Returns:**
```json
{
  "server": {
    "name": "mcp-reference-server",
    "version": "2.0.0",
    "protocol": "MCP",
    "protocolVersion": "2025-06-18",
    "transport": "stdio"
  },
  "capabilities": {
    "tools": true,
    "resources": true,
    "prompts": true
  },
  "features": {
    "structuredOutput": true,
    "resourceLinks": true,
    "metadata": true
  }
}
```

#### 2. **status://server**
Current server status and uptime information.

**Returns:**
```json
{
  "status": "running",
  "uptime": {
    "milliseconds": 123456,
    "formatted": "0h 2m 3s"
  },
  "memory": { ... },
  "process": { ... }
}
```

### Prompts

The server provides predefined prompts:

#### 1. **code_review**
Generates a code review prompt for the specified programming language.

## 🔧 Development

### Project Structure

```
/
├── src/
│   ├── server/
│   │   ├── index.ts              # MCP Server entry point
│   │   ├── tools/                # Tool implementations
│   │   │   ├── calculator.ts
│   │   │   ├── echo.ts
│   │   │   └── current-time.ts
│   │   └── resources/            # Resource providers
│   │       └── config.ts
│   ├── client/
│   │   └── index.ts              # MCP Client implementation
│   ├── agent/
│   │   ├── simple-agent.ts       # Level 1: Rule-based agent
│   │   ├── intelligent-agent.ts  # Level 2: Claude-powered agent
│   │   └── oauth-intelligent-agent.ts  # Level 3: Multi-server OAuth agent
│   ├── web-chat/
│   │   └── server.ts             # Level 4: Web chat Express server
│   ├── mcp-servers/
│   │   ├── github-server.ts      # GitHub MCP server (OAuth-protected)
│   │   └── playwright-server.ts  # Playwright browser automation MCP server
│   └── auth/
│       └── client/
│           └── oauth-client.ts   # OAuth 2.1 client implementation
├── public/
│   └── index.html                # Web chat frontend
├── docs/
│   ├── WEB_CHAT_QUICKSTART.md    # Web chat setup guide
│   └── MCP_SERVERS_GUIDE.md      # MCP servers documentation
├── tests/
│   └── integration.test.ts       # Integration tests
└── package.json
```

### Running Tests

```bash
npm test
```

### Development Mode

Run in development mode with auto-reloading:

```bash
# Server
npm run dev:server

# Client
npm run dev:client

# Agent
npm run dev:agent
```

### Testing with MCP Inspector

The MCP Inspector is a powerful debugging tool:

```bash
npm run inspector
```

This will launch an interactive UI where you can:
- View server capabilities
- Test tool invocations
- Read resources
- Inspect protocol messages

## 📖 Usage Examples

### Creating a Custom Client

```typescript
import { MCPClient } from './src/client/index.js';

const client = new MCPClient();

// Connect to server
await client.connect('node', ['dist/server/index.js']);

// Discover tools
const tools = await client.listTools();
console.log('Available tools:', tools);

// Call a tool
const result = await client.callTool('calculator', {
  operation: 'multiply',
  a: 6,
  b: 7
});
console.log('Result:', result);

// Read a resource
const config = await client.readResource('config://server');
console.log('Config:', config);

// Disconnect
await client.disconnect();
```

### Creating a Custom Agent

```typescript
import { SimpleAgent } from './src/agent/simple-agent.js';

const agent = new SimpleAgent();

// Initialize
await agent.initialize('node', ['dist/server/index.js']);

// Execute a custom task
await agent.executeTask('Calculate 42 multiply 3');

// Shutdown
await agent.shutdown();
```

## 🔌 Protocol Details

### Transport

This implementation uses **stdio transport**:
- Messages are exchanged via standard input/output
- Each message is a single line of JSON-RPC 2.0
- Newline-delimited for message framing

### Message Flow

#### Initialization
```
Client → Server: initialize request
Server → Client: initialize response (with capabilities)
Client → Server: initialized notification
```

#### Tool Discovery and Execution
```
Client → Server: tools/list request
Server → Client: tools/list response
Client → Server: tools/call request
Server → Client: tools/call response
```

#### Resource Access
```
Client → Server: resources/list request
Server → Client: resources/list response
Client → Server: resources/read request
Server → Client: resources/read response
```

## 🧪 Testing

The project includes comprehensive integration tests covering:

- Tool discovery
- Tool execution (all tools and operations)
- Resource discovery
- Resource reading
- Agent workflows
- Error handling

Run tests with:
```bash
npm test
```

## 📋 MCP Specification Versions

This implementation is currently based on **MCP Specification 2025-06-18** (latest stable).

### Current Status

- ✅ **2025-06-18** - Fully implemented (current) ⭐
- 🔮 **2025-11-25** - Roadmap prepared (upcoming)

### Implemented Features (2025-06-18)

**✅ Structured Tool Output:**
- All tools return `structuredContent` field with typed JSON
- Output schemas defined for validation
- Example: Calculator returns structured `{ operation, a, b, result, timestamp }`

**✅ Display Names (title field):**
- Tools have both `name` (programmatic) and `title` (display)
- Resources have descriptive titles for better UX

**✅ Metadata Fields (_meta):**
- Resources include metadata (version, category, cache hints)
- Resource contents have generation timestamps and versioning

**✅ Resource Links:**
- New tool `get_server_logs` demonstrates resource link content type
- Points to external resources instead of inlining large content

**✅ HTTP Transport with SSE Streaming:** 🌐
- Full HTTP/HTTPS transport support
- Server-Sent Events for real-time streaming
- RESTful API endpoints (/health, /protocol, /sse, /message)
- CORS support for web-based clients
- See [HTTP_TRANSPORT.md](./HTTP_TRANSPORT.md) for details

**✅ Protocol Version Headers:**
- All HTTP responses include `MCP-Protocol-Version: 2025-06-18` header
- Protocol negotiation and validation
- Version compatibility checking

**🔜 Not Yet Implemented:**
- Elicitation support (interactive tools)
- Enhanced OAuth/RFC 8707 security

**2025-11-25 (Upcoming - Nov 25, 2025):**
- Sampling (servers request LLM completions)
- Multimodal support (images, audio, video)
- Advanced agentic workflows
- Registry & discovery
- Compliance test suites

### Documentation

- 📖 [Complete Upgrade Plan](./MCP_UPGRADE_PLAN.md) - Detailed migration guide with code examples
- 📋 [Quick Reference](./MCP_VERSIONS_QUICK_REF.md) - Version comparison and feature matrix
- 🔗 [Official Changelog](https://modelcontextprotocol.io/specification/2025-06-18/changelog)

## 📚 Learn More

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Documentation](https://modelcontextprotocol.io/)

## 🤝 Contributing

This is a reference implementation meant for learning and demonstration. Feel free to:

- Add new tools
- Implement additional resources
- Extend the intelligent agent capabilities
- Add more comprehensive error handling
- Create additional examples

## ✅ Already Implemented Enhancements

This implementation already includes several advanced features:

1. **LLM Integration** ✅
   - Intelligent agent with Claude Haiku for smart tool selection
   - Natural language understanding and tool orchestration
   - Multi-step reasoning and chained tool calls
   - See: `src/agent/intelligent-agent.ts`
   - Docs: [INTELLIGENT_AGENT.md](./INTELLIGENT_AGENT.md)
   - Run: `npm run dev:agent:intelligent`

2. **OAuth Intelligent Agent** ✅
   - Multi-server MCP connections with OAuth 2.1 authentication
   - Scope-based access control and token management
   - Tool namespacing to prevent conflicts between servers
   - See: `src/agent/oauth-intelligent-agent.ts`
   - Run: `npm run dev:agent:oauth`

3. **Web Chat Application** ✅
   - Production-ready Express.js web server
   - RESTful API with session management
   - GitHub MCP server integration (OAuth-protected)
   - Playwright MCP server for browser automation
   - See: `src/web-chat/server.ts`
   - Docs: [docs/WEB_CHAT_QUICKSTART.md](./docs/WEB_CHAT_QUICKSTART.md)
   - Run: `npm run web-chat`

4. **MCP Servers** ✅
   - **GitHub MCP Server**: Repository management, issues, pull requests, code search
   - **Playwright MCP Server**: Browser automation, screenshots, navigation, text extraction
   - See: `src/mcp-servers/`
   - Docs: [docs/MCP_SERVERS_GUIDE.md](./docs/MCP_SERVERS_GUIDE.md)

5. **MCP 2025-06-18 Features** ✅
   - Structured tool output with schemas
   - Display names (title fields)
   - Metadata fields (_meta)
   - Resource links
   - See: [MCP_2025_06_18_IMPLEMENTATION.md](./MCP_2025_06_18_IMPLEMENTATION.md)

6. **Comprehensive Documentation** ✅
   - Complete upgrade plans for future spec versions
   - Quick reference guides
   - Implementation examples
   - See: [MCP_UPGRADE_PLAN.md](./MCP_UPGRADE_PLAN.md)

## 🔮 Future Enhancements

Potential areas for expansion:

1. **Persistent Resources**: Implement resources backed by databases or file systems
2. **Elicitation Support**: Enable interactive tool execution with user prompts
3. **Streaming**: Implement streaming responses for long-running operations
4. **Subscriptions**: Add resource subscription support for real-time updates
5. **Advanced Prompts**: Create more sophisticated prompt templates
6. **Error Recovery**: Implement retry logic and graceful error handling
7. **Monitoring**: Add metrics and logging capabilities
8. **Sampling (2025-11-25)**: Servers request LLM completions
9. **Multimodal (2025-11-25)**: Images, audio, video support
10. **Agentic Workflows (2025-11-25)**: Multi-agent collaboration
11. **WebSocket Support**: Real-time bidirectional communication for web chat
12. **User Authentication**: Multi-user support with login/session management

See [MCP_UPGRADE_PLAN.md](./MCP_UPGRADE_PLAN.md) for detailed roadmap.

## 📞 Support

For questions or issues:
- Check the [MCP Documentation](https://modelcontextprotocol.io/)
- Review the [TypeScript SDK docs](https://github.com/modelcontextprotocol/typescript-sdk)
- Open an issue in this repository
