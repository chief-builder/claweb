#!/usr/bin/env node

/**
 * Intelligent Agent with Claude Haiku Integration
 *
 * This agent uses Claude Haiku to intelligently decide which MCP tools to call
 * based on natural language input. It demonstrates:
 * - Converting MCP tools to Claude's tool format
 * - Agentic loop with Claude
 * - Tool execution and result feedback
 * - Multi-turn conversations
 */

import Anthropic from '@anthropic-ai/sdk';
import { MCPClient } from '../client/index.js';

/**
 * Convert MCP tool schema to Claude tool format
 */
function convertMCPToolToClaude(mcpTool: any): Anthropic.Tool {
  return {
    name: mcpTool.name,
    description: mcpTool.description,
    input_schema: mcpTool.inputSchema,
  };
}

/**
 * Convert Claude tool use to MCP tool call
 */
function convertClaudeToolUseToMCP(toolUse: Anthropic.ToolUseBlock) {
  return {
    name: toolUse.name,
    arguments: toolUse.input,
  };
}

export class IntelligentAgent {
  private client: MCPClient;
  private anthropic: Anthropic;
  private tools: Anthropic.Tool[] = [];
  private mcpTools: any[] = [];
  private conversationHistory: Anthropic.MessageParam[] = [];

  constructor(apiKey?: string) {
    this.client = new MCPClient();
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Initialize the agent by connecting to MCP server and discovering tools
   */
  async initialize(serverCommand: string, serverArgs: string[] = []) {
    console.error('\n🧠 Intelligent MCP Agent with Claude Haiku\n');

    // Connect to MCP server
    await this.client.connect(serverCommand, serverArgs);

    // Discover and convert tools
    console.error('🔍 Discovering MCP tools...');
    this.mcpTools = await this.client.listTools();
    this.tools = this.mcpTools.map(convertMCPToolToClaude);

    console.error(`   Found ${this.tools.length} tools:`);
    this.tools.forEach((tool) => {
      console.error(`   - ${tool.name}: ${tool.description}`);
    });

    // Discover resources
    console.error('\n📦 Discovering MCP resources...');
    const resources = await this.client.listResources();
    console.error(`   Found ${resources.length} resources:`);
    resources.forEach((resource) => {
      console.error(`   - ${resource.name} (${resource.uri})`);
    });

    // Add resource reading as a tool for Claude
    this.tools.push({
      name: 'read_resource',
      description: 'Read a resource from the MCP server',
      input_schema: {
        type: 'object',
        properties: {
          uri: {
            type: 'string',
            description: `Resource URI. Available resources: ${resources.map((r) => r.uri).join(', ')}`,
            enum: resources.map((r) => r.uri),
          },
        },
        required: ['uri'],
      },
    });

    console.error('\n✅ Agent initialized successfully\n');
  }

  /**
   * Process a user query using Claude to decide which tools to call
   */
  async processQuery(query: string): Promise<string> {
    console.error(`\n💭 Processing: "${query}"\n`);

    // Add user message to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: query,
    });

    let response: Anthropic.Message;
    let continueLoop = true;
    const maxIterations = 10; // Prevent infinite loops
    let iteration = 0;

    while (continueLoop && iteration < maxIterations) {
      iteration++;

      // Call Claude with available tools
      response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4096,
        tools: this.tools,
        messages: this.conversationHistory,
      });

      console.error(`🤖 Claude response (iteration ${iteration}):`);
      console.error(`   Stop reason: ${response.stop_reason}`);

      // Process the response
      const toolUses: Anthropic.ToolUseBlock[] = [];
      let textResponse = '';

      for (const block of response.content) {
        if (block.type === 'text') {
          textResponse += block.text;
          console.error(`   Text: ${block.text}`);
        } else if (block.type === 'tool_use') {
          toolUses.push(block);
          console.error(`   🔧 Tool use: ${block.name}`);
          console.error(`      Input: ${JSON.stringify(block.input, null, 2)}`);
        }
      }

      // If Claude wants to use tools, execute them
      if (toolUses.length > 0) {
        // Add assistant message to history
        this.conversationHistory.push({
          role: 'assistant',
          content: response.content,
        });

        // Execute each tool
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUses) {
          console.error(`\n⚙️  Executing tool: ${toolUse.name}...`);

          try {
            let result: any;

            if (toolUse.name === 'read_resource') {
              // Handle resource reading
              const uri = (toolUse.input as any).uri;
              const resourceResult = await this.client.readResource(uri);
              const content = resourceResult.contents[0];
              const text = 'text' in content ? content.text : JSON.stringify(content);
              result = { success: true, data: text };
            } else {
              // Handle regular tool calls
              const mcpResult = await this.client.callTool(
                toolUse.name,
                toolUse.input as Record<string, unknown>
              );

              // Extract text from MCP result
              const content = mcpResult.content[0];
              const text = content.type === 'text' ? content.text : JSON.stringify(content);
              result = { success: true, data: text };
            }

            console.error(`   ✅ Result: ${JSON.stringify(result).substring(0, 100)}...`);

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`   ❌ Error: ${errorMessage}`);

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify({ success: false, error: errorMessage }),
              is_error: true,
            });
          }
        }

        // Add tool results to conversation history
        this.conversationHistory.push({
          role: 'user',
          content: toolResults,
        });

        // Continue the loop to let Claude process the tool results
      } else {
        // Claude has finished and provided a text response
        continueLoop = false;

        // Add assistant message to history
        this.conversationHistory.push({
          role: 'assistant',
          content: response.content,
        });

        return textResponse;
      }
    }

    if (iteration >= maxIterations) {
      throw new Error('Max iterations reached in agentic loop');
    }

    return 'No response from Claude';
  }

  /**
   * Reset conversation history
   */
  resetConversation() {
    this.conversationHistory = [];
    console.error('\n🔄 Conversation history reset\n');
  }

  /**
   * Shutdown the agent
   */
  async shutdown() {
    console.error('\n👋 Shutting down intelligent agent...');
    await this.client.disconnect();
    console.error('✅ Agent shutdown complete\n');
  }
}

/**
 * Main function demonstrating the intelligent agent
 */
async function main() {
  const agent = new IntelligentAgent();

  try {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ Error: ANTHROPIC_API_KEY environment variable not set');
      console.error('\nPlease set your API key:');
      console.error('  export ANTHROPIC_API_KEY=your-api-key-here\n');
      process.exit(1);
    }

    // Initialize
    await agent.initialize('node', ['dist/server/index.js']);

    // Example queries demonstrating Claude's intelligent tool selection
    const queries = [
      'What is 15 plus 27, then multiply that result by 3?',
      'Can you tell me the current server status and what time it is?',
      'Calculate 100 divided by 4, and then show me the server configuration',
      'Echo this message: "The intelligent agent is working great!"',
    ];

    for (const query of queries) {
      const response = await agent.processQuery(query);
      console.error('\n📝 Final response:');
      console.log(response);
      console.error('\n' + '='.repeat(80));
    }

    // Shutdown
    await agent.shutdown();
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
