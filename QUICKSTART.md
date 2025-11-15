# Quick Start Guide

This guide will help you get started with the MCP Reference Implementation in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- npm or yarn

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## Running the Examples

### 1. Test the Client

The client connects to the MCP server and demonstrates all available capabilities:

```bash
npm run client
```

**What it does:**
- Connects to the MCP server via stdio transport
- Discovers available tools and resources
- Calls each tool with sample data
- Reads all available resources
- Displays the results

### 2. Test the Agent

The agent demonstrates a more sophisticated workflow:

```bash
npm run agent
```

**What it does:**
- Initializes and discovers server capabilities
- Executes a multi-step workflow:
  - Checks server status
  - Performs chained calculations
  - Gets current time
  - Echoes a summary message
- Executes custom tasks:
  - Calculator operations
  - Time queries
  - Status checks

### 3. Run the Server Standalone

You can also run just the server and interact with it manually:

```bash
npm run server
```

The server will wait for JSON-RPC messages on stdin.

### 4. Use the MCP Inspector

The MCP Inspector provides an interactive UI for testing:

```bash
npm run inspector
```

This will open a web UI where you can:
- Browse available tools and resources
- Test tool invocations interactively
- View protocol messages
- Debug your implementation

## Development Mode

For development with auto-reload:

```bash
# Run server in dev mode
npm run dev:server

# Run client in dev mode
npm run dev:client

# Run agent in dev mode
npm run dev:agent
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific integration tests
npm run test:integration
```

## Next Steps

1. **Explore the Code:**
   - `src/server/` - Server implementation with tools and resources
   - `src/client/` - Client implementation
   - `src/agent/` - Agent with workflow orchestration

2. **Add Your Own Tools:**
   - Create a new file in `src/server/tools/`
   - Implement your tool function
   - Register it in `src/server/index.ts`
   - Rebuild with `npm run build`

3. **Add Your Own Resources:**
   - Create a new file in `src/server/resources/`
   - Implement your resource function
   - Register it in `src/server/index.ts`
   - Rebuild with `npm run build`

4. **Integrate with an LLM:**
   - Modify `src/agent/simple-agent.ts`
   - Add LLM API calls (Claude, GPT, etc.)
   - Use the LLM to decide which tools to call
   - Build intelligent workflows

## Example: Adding a New Tool

1. Create `src/server/tools/weather.ts`:

```typescript
export function weatherTool(args: unknown) {
  const { city } = args as { city: string };

  // In a real implementation, call a weather API
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          city,
          temperature: 72,
          conditions: 'Sunny',
        }, null, 2),
      },
    ],
  };
}
```

2. Register in `src/server/index.ts`:

```typescript
// Import
import { weatherTool } from './tools/weather.js';

// Add to tools list
{
  name: 'weather',
  description: 'Get weather for a city',
  inputSchema: {
    type: 'object',
    properties: {
      city: { type: 'string' }
    },
    required: ['city']
  }
}

// Add to call handler
case 'weather':
  return weatherTool(args);
```

3. Rebuild and test:

```bash
npm run build
npm run client
```

## Troubleshooting

**Error: Cannot find module**
- Run `npm run build` to compile TypeScript

**Server not responding**
- Check that the server is running
- Ensure stdio transport is not blocked
- Check for errors in console output

**Type errors**
- Ensure you're using Node.js 18+
- Run `npm install` to update dependencies
- Check `tsconfig.json` settings

## Learn More

- [Full Documentation](./README.md)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
