# Intelligent Agent with Claude Haiku

The intelligent agent demonstrates how to integrate Claude Haiku with MCP to create an AI agent that can intelligently decide which tools to call based on natural language queries.

## Overview

The intelligent agent:
- Uses **Claude 3 Haiku** for fast, cost-effective reasoning
- Automatically converts MCP tools to Claude's tool format
- Implements an **agentic loop** where Claude can use tools and see results
- Supports **multi-turn conversations** with tool execution
- Handles **chained tool calls** for complex queries

## Architecture

```
┌─────────────────────────────────────────────┐
│         User Query (Natural Language)       │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│         Claude Haiku (Decision Making)      │
│  - Analyzes query                           │
│  - Decides which tools to use               │
│  - Sequences tool calls if needed           │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│         Tool Execution (MCP Client)         │
│  - Calls MCP server tools                   │
│  - Reads MCP resources                      │
│  - Returns results to Claude                │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│         MCP Server (Tools & Resources)      │
│  - Calculator                               │
│  - Echo                                     │
│  - Current Time                             │
│  - Server Status & Config                   │
└─────────────────────────────────────────────┘
```

## Setup

### 1. Set Your API Key

You need an Anthropic API key to use Claude:

```bash
export ANTHROPIC_API_KEY=your-api-key-here
```

Or create a `.env` file:
```bash
echo "ANTHROPIC_API_KEY=your-api-key-here" > .env
```

### 2. Build the Project

```bash
npm install
npm run build
```

## Usage

### Quick Test

Run the built-in example queries:

```bash
npm run dev:agent:intelligent
```

This will execute several example queries demonstrating:
- Simple calculations
- Chained operations (calculate A, then use result in B)
- Mixed tool usage (time + status)
- Resource reading
- Echo functionality

### Interactive Example

Run the customizable example:

```bash
npm run example:interactive
```

Edit `src/examples/interactive-agent.ts` to add your own test queries.

### Programmatic Usage

```typescript
import { IntelligentAgent } from './src/agent/intelligent-agent.js';

const agent = new IntelligentAgent();

// Initialize (connects to MCP server and discovers tools)
await agent.initialize('node', ['dist/server/index.js']);

// Process queries
const response = await agent.processQuery(
  'Calculate 50 times 3, then tell me the current time'
);
console.log(response);

// Reset conversation history if needed
agent.resetConversation();

// Shutdown
await agent.shutdown();
```

## Example Queries

### Simple Calculations
```
Query: "What is 42 times 7?"
Claude will: Use calculator tool with multiply operation
Result: "42 × 7 = 294"
```

### Chained Operations
```
Query: "Calculate 100 divided by 5, then add 30 to the result"
Claude will:
  1. Use calculator to divide 100 by 5 (gets 20)
  2. Use calculator to add 30 to 20 (gets 50)
Result: "The result is 50"
```

### Multi-Tool Queries
```
Query: "Tell me the current time and server status"
Claude will:
  1. Call get_current_time tool
  2. Read status://server resource
Result: Formatted response with both pieces of information
```

### Resource Access
```
Query: "What is the server configuration?"
Claude will: Read config://server resource
Result: Server configuration details
```

### Complex Workflows
```
Query: "Calculate 25 plus 75, multiply the result by 2, then tell me what time it is"
Claude will:
  1. Use calculator to add 25 + 75 (gets 100)
  2. Use calculator to multiply 100 by 2 (gets 200)
  3. Call get_current_time
Result: "The result of your calculation is 200, and the current time is..."
```

## How It Works

### 1. Tool Discovery & Conversion

When the agent initializes, it:
1. Connects to the MCP server
2. Lists all available tools
3. Converts MCP tool schemas to Claude's format

```typescript
// MCP Tool Schema
{
  name: "calculator",
  description: "Perform arithmetic operations",
  inputSchema: {
    type: "object",
    properties: { ... }
  }
}

// Converted to Claude Tool
{
  name: "calculator",
  description: "Perform arithmetic operations",
  input_schema: {
    type: "object",
    properties: { ... }
  }
}
```

### 2. Agentic Loop

The agent implements a loop where:

```
1. Send user query + conversation history to Claude
2. Claude responds with either:
   a) Tool use request → Execute tools → Add results to history → Go to 1
   b) Final text response → Return to user
3. Repeat until Claude provides final answer (max 10 iterations)
```

### 3. Tool Execution

When Claude requests a tool:

```typescript
// Claude says: "Use calculator with {operation: 'add', a: 10, b: 5}"

// Agent executes:
const result = await mcpClient.callTool('calculator', {
  operation: 'add',
  a: 10,
  b: 5
});

// Returns result to Claude: {success: true, data: "15"}
```

### 4. Conversation History

The agent maintains conversation history for context:

```typescript
[
  { role: 'user', content: 'What is 10 + 5?' },
  { role: 'assistant', content: [{ type: 'tool_use', name: 'calculator', ... }] },
  { role: 'user', content: [{ type: 'tool_result', ... }] },
  { role: 'assistant', content: '10 + 5 equals 15' }
]
```

## Advanced Features

### Multi-Turn Conversations

The agent maintains context across tool calls:

```typescript
const agent = new IntelligentAgent();
await agent.initialize('node', ['dist/server/index.js']);

// First query
await agent.processQuery('Calculate 50 times 2');

// Second query (Claude remembers previous context)
await agent.processQuery('Now divide that by 5');

// Reset if you want to start fresh
agent.resetConversation();
```

### Resource Reading

Resources are automatically added as tools:

```typescript
// Agent discovers resources and creates a special tool:
{
  name: 'read_resource',
  description: 'Read a resource from the MCP server',
  input_schema: {
    properties: {
      uri: {
        enum: ['config://server', 'status://server']
      }
    }
  }
}
```

### Error Handling

The agent gracefully handles errors:

```typescript
try {
  const result = await agent.processQuery('Invalid query');
} catch (error) {
  // Tool execution errors are sent back to Claude
  // Claude can retry or provide alternative solutions
}
```

## Configuration

### Using Different Claude Models

Modify `src/agent/intelligent-agent.ts`:

```typescript
response = await this.anthropic.messages.create({
  model: 'claude-3-haiku-20240307',    // Fast and cheap
  // model: 'claude-3-5-sonnet-20241022', // More capable
  // model: 'claude-3-opus-20240229',     // Most capable
  max_tokens: 4096,
  tools: this.tools,
  messages: this.conversationHistory,
});
```

### Adjusting Max Iterations

Change the loop limit in `processQuery`:

```typescript
const maxIterations = 10; // Prevent infinite loops
```

### Custom System Prompts

Add a system prompt for specific behavior:

```typescript
response = await this.anthropic.messages.create({
  model: 'claude-3-haiku-20240307',
  max_tokens: 4096,
  system: 'You are a helpful assistant focused on precise calculations.',
  tools: this.tools,
  messages: this.conversationHistory,
});
```

## Performance

### Token Usage

Claude Haiku is optimized for speed and cost:
- **Input:** ~$0.25 per million tokens
- **Output:** ~$1.25 per million tokens

Typical query usage:
- Simple query: 500-1000 tokens
- Complex multi-tool: 1500-3000 tokens

### Speed

- Simple queries: 1-2 seconds
- Multi-tool queries: 3-5 seconds
- Complex chains: 5-10 seconds

## Debugging

### Enable Verbose Logging

The agent already logs to stderr:
- Tool discovery
- Claude iterations
- Tool execution
- Results

### View Raw Messages

Add logging in the loop:

```typescript
console.error('Raw Claude response:', JSON.stringify(response, null, 2));
```

### Test with MCP Inspector

You can also test the underlying MCP server:

```bash
npm run inspector
```

## Limitations

1. **Max Iterations:** Limited to 10 to prevent infinite loops
2. **Token Limit:** 4096 max tokens per response
3. **Tool Results:** Large tool results may hit token limits
4. **API Key Required:** Must have valid Anthropic API key

## Troubleshooting

### "API key not set"
```bash
export ANTHROPIC_API_KEY=your-key-here
```

### "Max iterations reached"
Reduce query complexity or increase max iterations limit.

### "Tool execution failed"
Check that MCP server is running and tools are registered correctly.

### Rate Limits
Claude API has rate limits. Add delays between queries if needed:

```typescript
await new Promise(resolve => setTimeout(resolve, 1000));
```

## Next Steps

1. **Add More Tools:** Extend the MCP server with additional tools
2. **Custom Prompts:** Add system prompts for specific use cases
3. **Streaming:** Implement streaming responses for better UX
4. **Memory:** Add long-term memory storage
5. **Multi-Server:** Connect to multiple MCP servers
6. **Web Interface:** Build a web UI for the agent

## Examples in the Wild

Check `src/examples/interactive-agent.ts` for ready-to-run examples showcasing:
- Simple calculations
- Chained operations
- Mixed tool usage
- Resource reading
- Complex workflows

## Learn More

- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Claude Tool Use Guide](https://docs.anthropic.com/en/docs/tool-use)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
