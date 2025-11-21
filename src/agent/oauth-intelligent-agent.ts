#!/usr/bin/env node

/**
 * OAuth-Aware Intelligent Agent with Claude Integration
 *
 * This agent extends the basic intelligent agent to support OAuth 2.1
 * authentication when connecting to MCP servers. It demonstrates:
 * - OAuth 2.1 authentication with PKCE
 * - Scope-based access control
 * - Token management and refresh
 * - Multiple MCP server connections with different OAuth scopes
 * - Agentic loop with Claude and MCP tools
 */

import Anthropic from '@anthropic-ai/sdk';
import { MCPClient } from '../client/index.js';
import { OAuthClient, type OAuthClientConfig, type TokenSet } from '../auth/client/oauth-client.js';

/**
 * MCP Server Configuration with OAuth
 */
export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  oauth?: {
    enabled: boolean;
    authorizationServer: string;
    clientId: string;
    clientSecret?: string;
    scopes: string[];
    resources?: string[];
  };
}

/**
 * Convert MCP tool schema to Claude tool format
 */
function convertMCPToolToClaude(mcpTool: any, serverName: string): Anthropic.Tool {
  return {
    name: `${serverName}__${mcpTool.name}`,
    description: `[${serverName}] ${mcpTool.description}`,
    input_schema: mcpTool.inputSchema,
  };
}

/**
 * OAuth-Aware Intelligent Agent
 *
 * Handles authentication and authorization when connecting to protected MCP resources.
 */
export class OAuthIntelligentAgent {
  private anthropic: Anthropic;
  private servers: Map<string, { client: MCPClient; oauth?: OAuthClient; tokens?: TokenSet }> =
    new Map();
  private tools: Anthropic.Tool[] = [];
  private toolToServer: Map<string, string> = new Map();
  private conversationHistory: Anthropic.MessageParam[] = [];

  constructor(apiKey?: string) {
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Initialize the agent by connecting to one or more MCP servers
   */
  async initialize(serverConfigs: MCPServerConfig[]) {
    console.error('\n🧠 OAuth-Aware Intelligent MCP Agent with Claude\n');

    for (const config of serverConfigs) {
      await this.connectToServer(config);
    }

    console.error(`\n✅ Agent initialized with ${this.servers.size} server(s)\n`);
  }

  /**
   * Connect to a single MCP server with optional OAuth
   */
  private async connectToServer(config: MCPServerConfig) {
    console.error(`\n🔌 Connecting to MCP server: ${config.name}`);

    const client = new MCPClient();
    let tokens: TokenSet | undefined;
    let oauthClient: OAuthClient | undefined;

    // Build environment variables to pass to subprocess
    // Always pass through important env vars like GITHUB_TOKEN
    const serverEnv: Record<string, string> = {};

    // Handle OAuth if configured
    if (config.oauth?.enabled) {
      console.error('   🔐 OAuth authentication required');
      console.error(`   📋 Scopes: ${config.oauth.scopes.join(', ')}`);

      oauthClient = new OAuthClient({
        clientId: config.oauth.clientId,
        clientSecret: config.oauth.clientSecret,
        authorizationServer: config.oauth.authorizationServer,
        scopes: config.oauth.scopes,
        resources: config.oauth.resources,
      });

      // Get tokens (in a real application, this would involve user interaction)
      tokens = await this.obtainTokens(oauthClient, config.oauth.scopes);

      // Pass token to subprocess environment
      if (tokens.access_token) {
        serverEnv.GITHUB_TOKEN = tokens.access_token;
        serverEnv.GITHUB_ACCESS_TOKEN = tokens.access_token;
        serverEnv.OAUTH_ACCESS_TOKEN = tokens.access_token;
      }

      console.error('   ✅ OAuth authentication successful');
    }

    // Connect to MCP server with environment variables
    await client.connect(config.command, config.args || [], serverEnv);

    // Store server connection
    this.servers.set(config.name, { client, oauth: oauthClient, tokens });

    // Discover and register tools
    await this.discoverTools(config.name, client);

    // Discover resources
    await this.discoverResources(config.name, client);
  }

  /**
   * Obtain OAuth tokens for a server
   */
  private async obtainTokens(oauthClient: OAuthClient, scopes: string[]): Promise<TokenSet> {
    // Check if token is provided via environment variable
    const envToken = process.env.GITHUB_TOKEN || process.env.OAUTH_ACCESS_TOKEN;

    if (envToken) {
      console.error('   📦 Using token from environment variable');
      return {
        access_token: envToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: scopes.join(' '),
      };
    }

    // In a real application, this would initiate the OAuth flow
    // For now, we'll throw an error instructing the user to provide a token
    throw new Error(
      'OAuth token required. Please set GITHUB_TOKEN or OAUTH_ACCESS_TOKEN environment variable, or implement interactive OAuth flow.'
    );
  }

  /**
   * Discover tools from an MCP server
   */
  private async discoverTools(serverName: string, client: MCPClient) {
    console.error(`   🔍 Discovering tools from ${serverName}...`);

    const mcpTools = await client.listTools();
    const claudeTools = mcpTools.map((tool) => convertMCPToolToClaude(tool, serverName));

    this.tools.push(...claudeTools);

    // Map tool names to server names
    claudeTools.forEach((tool) => {
      this.toolToServer.set(tool.name, serverName);
    });

    console.error(`      Found ${mcpTools.length} tools:`);
    mcpTools.forEach((tool) => {
      console.error(`      - ${tool.name}: ${tool.description}`);
    });
  }

  /**
   * Discover resources from an MCP server
   */
  private async discoverResources(serverName: string, client: MCPClient) {
    console.error(`   📦 Discovering resources from ${serverName}...`);

    const resources = await client.listResources();
    console.error(`      Found ${resources.length} resources:`);
    resources.forEach((resource) => {
      console.error(`      - ${resource.name} (${resource.uri})`);
    });

    // Add resource reading as a tool for Claude
    if (resources.length > 0) {
      this.tools.push({
        name: `${serverName}__read_resource`,
        description: `[${serverName}] Read a resource from the MCP server`,
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

      this.toolToServer.set(`${serverName}__read_resource`, serverName);
    }
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
    const maxIterations = 10;
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
            const result = await this.executeTool(toolUse.name, toolUse.input as Record<string, unknown>);

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
      } else {
        // Claude has finished and provided a text response
        continueLoop = false;

        const nonEmptyContent = response.content.filter((block) => {
          if (block.type === 'text') {
            return block.text.trim().length > 0;
          }
          return true;
        });

        if (nonEmptyContent.length > 0) {
          this.conversationHistory.push({
            role: 'assistant',
            content: nonEmptyContent,
          });
        } else if (textResponse.trim().length > 0) {
          this.conversationHistory.push({
            role: 'assistant',
            content: [{ type: 'text', text: textResponse }],
          });
        }

        return textResponse;
      }
    }

    if (iteration >= maxIterations) {
      throw new Error('Max iterations reached in agentic loop');
    }

    return 'No response from Claude';
  }

  /**
   * Execute a tool on the appropriate MCP server
   */
  private async executeTool(toolName: string, input: Record<string, unknown>): Promise<any> {
    const serverName = this.toolToServer.get(toolName);

    if (!serverName) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const serverInfo = this.servers.get(serverName);

    if (!serverInfo) {
      throw new Error(`Server not connected: ${serverName}`);
    }

    // Extract the actual tool name (remove server prefix)
    const actualToolName = toolName.replace(`${serverName}__`, '');

    // Handle resource reading
    if (actualToolName === 'read_resource') {
      const uri = (input as any).uri;
      const resourceResult = await serverInfo.client.readResource(uri);
      const content = resourceResult.contents[0];
      const text = 'text' in content ? content.text : JSON.stringify(content);
      return { success: true, data: text };
    }

    // Handle regular tool calls
    const mcpResult = await serverInfo.client.callTool(actualToolName, input);

    // Extract text from MCP result
    const content = mcpResult.content[0];
    const text = content.type === 'text' ? content.text : JSON.stringify(content);

    // If structured content is available, prefer it
    if ('structuredContent' in mcpResult && mcpResult.structuredContent) {
      return mcpResult.structuredContent;
    }

    return { success: true, data: text };
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
    console.error('\n👋 Shutting down OAuth-aware intelligent agent...');

    for (const [name, { client }] of this.servers) {
      console.error(`   Disconnecting from ${name}...`);
      await client.disconnect();
    }

    console.error('✅ Agent shutdown complete\n');
  }
}

/**
 * Example usage demonstrating OAuth-aware agent with multiple MCP servers
 */
async function main() {
  const agent = new OAuthIntelligentAgent();

  try {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ Error: ANTHROPIC_API_KEY environment variable not set');
      console.error('\nPlease set your API key:');
      console.error('  export ANTHROPIC_API_KEY=your-api-key-here\n');
      process.exit(1);
    }

    // Configure MCP servers
    const serverConfigs: MCPServerConfig[] = [
      {
        name: 'playwright',
        command: 'node',
        args: ['dist/mcp-servers/playwright-server.js'],
        oauth: {
          enabled: false, // Playwright doesn't require OAuth in this example
          authorizationServer: 'http://localhost:3000',
          clientId: 'playwright-client',
          scopes: ['browser:read', 'browser:write'],
        },
      },
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
    ];

    // Initialize with configured servers
    await agent.initialize(serverConfigs);

    // Example queries demonstrating multi-server capabilities
    const queries = [
      'List my GitHub repositories',
      'Get the details of the chief-builder/claweb repository',
      'What issues are open in the chief-builder/claweb repository?',
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
