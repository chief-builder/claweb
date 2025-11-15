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
┌─────────────────┐
│  Simple Agent   │  ← Orchestrates tool calls and workflows
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   MCP Client    │  ← Discovers and invokes server capabilities
└────────┬────────┘
         │ stdio
         ▼
┌─────────────────┐
│   MCP Server    │  ← Exposes tools and resources
└─────────────────┘
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

### Resources

The server provides the following resources:

#### 1. **config://server**
Server configuration and settings.

**Returns:**
```json
{
  "server": {
    "name": "mcp-reference-server",
    "version": "1.0.0",
    "protocol": "MCP",
    "transport": "stdio"
  },
  "capabilities": {
    "tools": true,
    "resources": true,
    "prompts": true
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

This implementation is currently based on **MCP Specification 2025-03-26** with plans to upgrade to newer versions.

### Current Status

- ✅ **2025-03-26** - Fully implemented (current)
- 📋 **2025-06-18** - Upgrade planned (latest stable)
- 🔮 **2025-11-25** - Roadmap prepared (upcoming)

### What's New in Each Version

**2025-06-18 (Latest Stable):**
- Structured tool output with schemas
- Elicitation support (interactive tools)
- Resource links
- Enhanced OAuth/RFC 8707 security
- Protocol version headers

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
- Enhance the agent with LLM integration
- Add more comprehensive error handling
- Create additional examples

## 📄 License

MIT License

## 🔮 Future Enhancements

Potential areas for expansion:

1. **LLM Integration**: Connect the agent to an actual LLM (Claude, GPT, etc.) for intelligent tool selection
2. **HTTP Transport**: Add support for HTTP/SSE transport in addition to stdio
3. **Persistent Resources**: Implement resources backed by databases or file systems
4. **Authentication**: Add authentication and authorization mechanisms
5. **Streaming**: Implement streaming responses for long-running operations
6. **Subscriptions**: Add resource subscription support for real-time updates
7. **Advanced Prompts**: Create more sophisticated prompt templates
8. **Error Recovery**: Implement retry logic and graceful error handling
9. **Monitoring**: Add metrics and logging capabilities
10. **Multi-Server**: Demonstrate connecting to multiple MCP servers simultaneously

## 📞 Support

For questions or issues:
- Check the [MCP Documentation](https://modelcontextprotocol.io/)
- Review the [TypeScript SDK docs](https://github.com/modelcontextprotocol/typescript-sdk)
- Open an issue in this repository
