# MCP Reference Implementation

A comprehensive reference implementation of the Model Context Protocol (MCP) using the official TypeScript SDK. This project demonstrates how to build MCP servers, clients, and agents with practical examples.

## 📋 Overview

This reference implementation showcases:

- **MCP Server**: A fully-featured server exposing tools, resources, and prompts
- **MCP Client**: A client that connects to servers and interacts with their capabilities
- **Simple Agent**: A demonstration of tool orchestration and workflow execution
- **Intelligent Agent**: An AI-powered agent using Claude Haiku for smart tool selection 🧠

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Intelligent Agent 🧠                 │
│           (Claude Haiku + MCP Client)                │
│  • Natural language understanding                    │
│  • Smart tool selection                              │
│  • Multi-step reasoning                              │
└───────────────────┬──────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│                  Simple Agent                        │
│           (Rule-based + MCP Client)                  │
│  • Pre-defined workflows                             │
│  • Pattern matching                                  │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│                  MCP Client                          │
│  • Discovers server capabilities                     │
│  • Invokes tools and reads resources                 │
└───────────────────┬─────────────────────────────────┘
                    │ stdio transport
                    ▼
┌─────────────────────────────────────────────────────┐
│                  MCP Server                          │
│  • Tools: calculator, echo, time, logs               │
│  • Resources: config, status                         │
│  • Prompts: code_review                              │
│  • MCP 2025-06-18 compliant ✅                       │
└─────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Installation

```bash
npm install
npm run build
```

### Running the Server

```bash
npm run server
```

The server will start and listen on stdio for MCP protocol messages.

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

### Running the Agent

```bash
npm run agent
```

The agent will:
1. Initialize and discover capabilities
2. Execute a multi-step workflow
3. Demonstrate tool orchestration
4. Perform custom tasks

### Running the Intelligent Agent 🧠

**NEW!** An AI-powered agent using Claude Haiku for intelligent tool selection:

```bash
# Set your Anthropic API key first
export ANTHROPIC_API_KEY=your-api-key-here

# Run the intelligent agent
npm run dev:agent:intelligent

# Or run the interactive example
npm run example:interactive
```

The intelligent agent:
1. Uses Claude Haiku to understand natural language queries
2. Automatically selects and chains the right tools
3. Handles complex multi-step workflows
4. Provides natural language responses

**Example queries:**
- "What is 42 times 7?"
- "Calculate 100 divided by 5, then add 30 to the result"
- "Tell me the current time and server status"

See [INTELLIGENT_AGENT.md](./INTELLIGENT_AGENT.md) for detailed documentation.

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
│   │   ├── index.ts              # Server entry point
│   │   ├── tools/                # Tool implementations
│   │   │   ├── calculator.ts
│   │   │   ├── echo.ts
│   │   │   └── current-time.ts
│   │   └── resources/            # Resource providers
│   │       └── config.ts
│   ├── client/
│   │   └── index.ts              # Client implementation
│   └── agent/
│       └── simple-agent.ts       # Agent implementation
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

**🔜 Not Yet Implemented:**
- Elicitation support (interactive tools)
- Enhanced OAuth/RFC 8707 security
- Protocol version headers (HTTP only)

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

2. **MCP 2025-06-18 Features** ✅
   - Structured tool output with schemas
   - Display names (title fields)
   - Metadata fields (_meta)
   - Resource links
   - See: [MCP_2025_06_18_IMPLEMENTATION.md](./MCP_2025_06_18_IMPLEMENTATION.md)

3. **Comprehensive Documentation** ✅
   - Complete upgrade plans for future spec versions
   - Quick reference guides
   - Implementation examples
   - See: [MCP_UPGRADE_PLAN.md](./MCP_UPGRADE_PLAN.md)

## 🔮 Future Enhancements

Potential areas for expansion:

1. **HTTP Transport**: Add support for HTTP/SSE transport in addition to stdio
2. **Persistent Resources**: Implement resources backed by databases or file systems
3. **Enhanced OAuth/RFC 8707**: Complete authentication and authorization implementation
4. **Elicitation Support**: Enable interactive tool execution with user prompts
5. **Streaming**: Implement streaming responses for long-running operations
6. **Subscriptions**: Add resource subscription support for real-time updates
7. **Advanced Prompts**: Create more sophisticated prompt templates
8. **Error Recovery**: Implement retry logic and graceful error handling
9. **Monitoring**: Add metrics and logging capabilities
10. **Multi-Server**: Demonstrate connecting to multiple MCP servers simultaneously
11. **Sampling (2025-11-25)**: Servers request LLM completions
12. **Multimodal (2025-11-25)**: Images, audio, video support
13. **Agentic Workflows (2025-11-25)**: Multi-agent collaboration

See [MCP_UPGRADE_PLAN.md](./MCP_UPGRADE_PLAN.md) for detailed roadmap.

## 📞 Support

For questions or issues:
- Check the [MCP Documentation](https://modelcontextprotocol.io/)
- Review the [TypeScript SDK docs](https://github.com/modelcontextprotocol/typescript-sdk)
- Open an issue in this repository
