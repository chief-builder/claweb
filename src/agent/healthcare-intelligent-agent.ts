#!/usr/bin/env node

/**
 * Healthcare Intelligent Agent
 *
 * An LLM-powered agent specialized for healthcare workflows.
 * This agent uses Claude Haiku to intelligently decide which healthcare
 * MCP tools to call based on natural language clinical queries.
 *
 * Features:
 * - Multi-server connectivity (patient records, pharmacy, clinical workflow)
 * - Healthcare-aware prompt engineering
 * - HIPAA-compliant audit awareness
 * - Clinical decision support
 */

import Anthropic from '@anthropic-ai/sdk';
import { MCPClient } from '../client/index.js';

/**
 * Healthcare server configuration
 */
export interface HealthcareServerConfig {
  name: string;
  command: string;
  args: string[];
}

/**
 * Default healthcare server configurations
 */
export const DEFAULT_HEALTHCARE_SERVERS: HealthcareServerConfig[] = [
  {
    name: 'patient-records',
    command: 'node',
    args: ['dist/mcp-servers/healthcare/patient-records-server.js'],
  },
  {
    name: 'pharmacy',
    command: 'node',
    args: ['dist/mcp-servers/healthcare/pharmacy-server.js'],
  },
  {
    name: 'clinical-workflow',
    command: 'node',
    args: ['dist/mcp-servers/healthcare/clinical-workflow-server.js'],
  },
];

/**
 * Convert MCP tool schema to Claude tool format
 */
function convertMCPToolToClaude(mcpTool: any, serverName: string): Anthropic.Tool {
  return {
    name: mcpTool.name,
    description: `[${serverName}] ${mcpTool.description}`,
    input_schema: mcpTool.inputSchema,
  };
}

/**
 * Healthcare-specialized intelligent agent
 */
export class HealthcareIntelligentAgent {
  private clients: Map<string, MCPClient> = new Map();
  private toolToServer: Map<string, string> = new Map();
  private anthropic: Anthropic;
  private tools: Anthropic.Tool[] = [];
  private conversationHistory: Anthropic.MessageParam[] = [];
  private systemPrompt: string;

  constructor(apiKey?: string) {
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });

    // Healthcare-specialized system prompt
    this.systemPrompt = `You are a healthcare clinical assistant with access to electronic health record (EHR) tools.
You help healthcare providers with:
- Patient record lookups and clinical data retrieval
- Drug interaction checking and medication management
- Appointment scheduling and clinical workflows
- Care plan review and management

IMPORTANT GUIDELINES:
1. Always verify patient identity before accessing records
2. Request only the minimum necessary data (data minimization principle)
3. Note the purpose of each data access for HIPAA compliance
4. Flag any potential drug interactions or clinical alerts
5. Be precise with medical terminology and dosages

When retrieving patient data, specify which fields are needed using requestedFields when possible.
When checking drug interactions, always include the patient's current medication list.`;
  }

  /**
   * Initialize the agent by connecting to healthcare MCP servers
   */
  async initialize(servers: HealthcareServerConfig[] = DEFAULT_HEALTHCARE_SERVERS) {
    console.error('\n🏥 Healthcare Intelligent Agent\n');

    for (const server of servers) {
      console.error(`🔗 Connecting to ${server.name} server...`);
      const client = new MCPClient();
      await client.connect(server.command, server.args);
      this.clients.set(server.name, client);

      // Discover tools from this server
      const serverTools = await client.listTools();
      console.error(`   Found ${serverTools.length} tools`);

      for (const tool of serverTools) {
        this.tools.push(convertMCPToolToClaude(tool, server.name));
        this.toolToServer.set(tool.name, server.name);
      }

      // Discover resources
      const resources = await client.listResources();
      if (resources.length > 0) {
        console.error(`   Found ${resources.length} resources`);
      }
    }

    console.error(`\n✅ Agent initialized with ${this.tools.length} tools\n`);
  }

  /**
   * Initialize with a single healthcare server (for focused testing)
   */
  async initializeSingleServer(serverConfig: HealthcareServerConfig) {
    return this.initialize([serverConfig]);
  }

  /**
   * Process a clinical query using Claude to decide which tools to call
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

      // Call Claude with healthcare tools and system prompt
      response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4096,
        system: this.systemPrompt,
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
          console.error(`   Text: ${block.text.substring(0, 100)}...`);
        } else if (block.type === 'tool_use') {
          toolUses.push(block);
          console.error(`   🔧 Tool use: ${block.name}`);
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
          const serverName = this.toolToServer.get(toolUse.name);
          if (!serverName) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify({ success: false, error: `Unknown tool: ${toolUse.name}` }),
              is_error: true,
            });
            continue;
          }

          const client = this.clients.get(serverName);
          if (!client) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify({ success: false, error: `Server not connected: ${serverName}` }),
              is_error: true,
            });
            continue;
          }

          console.error(`\n⚙️  Executing tool: ${toolUse.name} (${serverName})...`);

          try {
            const mcpResult = await client.callTool(
              toolUse.name,
              toolUse.input as Record<string, unknown>
            );

            // Extract text and structured content from MCP result
            const content = mcpResult.content[0];
            const text = content.type === 'text' ? content.text : JSON.stringify(content);
            const result = {
              success: true,
              data: text,
              structured: mcpResult.structuredContent,
            };

            console.error(`   ✅ Result received`);

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

        // Add assistant message to history if non-empty
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
      throw new Error('Max iterations reached in healthcare agentic loop');
    }

    return 'No response from healthcare agent';
  }

  /**
   * Get list of available tools
   */
  getTools(): Anthropic.Tool[] {
    return this.tools;
  }

  /**
   * Get tool to server mapping
   */
  getToolServerMapping(): Map<string, string> {
    return this.toolToServer;
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
    console.error('\n👋 Shutting down healthcare agent...');
    for (const [name, client] of this.clients) {
      console.error(`   Disconnecting from ${name}...`);
      await client.disconnect();
    }
    this.clients.clear();
    console.error('✅ Healthcare agent shutdown complete\n');
  }
}

/**
 * Main function demonstrating the healthcare intelligent agent
 */
async function main() {
  const agent = new HealthcareIntelligentAgent();

  try {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ Error: ANTHROPIC_API_KEY environment variable not set');
      process.exit(1);
    }

    // Initialize with all healthcare servers
    await agent.initialize();

    // Example healthcare queries
    const queries = [
      'Look up patient P12345 and show me their current conditions',
      'Check for drug interactions if I want to add Warfarin to a patient currently on Aspirin',
      'What appointments does patient P12345 have scheduled?',
      'Check if 100mg of Lisinopril is an appropriate dosage',
    ];

    for (const query of queries) {
      const response = await agent.processQuery(query);
      console.error('\n📝 Final response:');
      console.log(response);
      console.error('\n' + '='.repeat(80));
      agent.resetConversation();
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
