#!/usr/bin/env node

/**
 * MCP Reference Server Implementation
 *
 * This server demonstrates the Model Context Protocol using the official TypeScript SDK.
 * It provides example tools and resources via stdio transport.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Tool implementations
import { calculatorTool } from './tools/calculator.js';
import { echoTool } from './tools/echo.js';
import { getCurrentTimeTool } from './tools/current-time.js';
import { getServerLogsTool } from './tools/get-server-logs.js';

// Resource implementations
import { configResource, statusResource } from './resources/config.js';

/**
 * Create and configure the MCP server
 * MCP 2025-06-18: Updated with structured output, resource links, and metadata
 */
async function main() {
  // Initialize the server with metadata
  const server = new Server(
    {
      name: 'mcp-reference-server',
      version: '2.0.0',  // MCP 2025-06-18
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  /**
   * Register Tools
   * Tools are executable functions that can perform actions
   */

  // List all available tools
  // MCP 2025-06-18: Added title and outputSchema fields
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'calculator',
          title: 'Calculator',  // MCP 2025-06-18: Display name
          description: 'Perform basic arithmetic operations (add, subtract, multiply, divide)',
          inputSchema: {
            type: 'object',
            properties: {
              operation: {
                type: 'string',
                enum: ['add', 'subtract', 'multiply', 'divide'],
                description: 'The arithmetic operation to perform',
              },
              a: {
                type: 'number',
                description: 'First number',
              },
              b: {
                type: 'number',
                description: 'Second number',
              },
            },
            required: ['operation', 'a', 'b'],
          },
          // MCP 2025-06-18: Output schema for structured validation
          outputSchema: {
            type: 'object',
            properties: {
              operation: { type: 'string' },
              a: { type: 'number' },
              b: { type: 'number' },
              result: { type: 'number' },
              expression: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['result', 'operation', 'a', 'b'],
          },
        },
        {
          name: 'echo',
          title: 'Echo',  // MCP 2025-06-18: Display name
          description: 'Echo back the provided message',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'The message to echo back',
              },
            },
            required: ['message'],
          },
          // MCP 2025-06-18: Output schema
          outputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              length: { type: 'number' },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['message'],
          },
        },
        {
          name: 'get_current_time',
          title: 'Get Current Time',  // MCP 2025-06-18: Display name
          description: 'Get the current server time in ISO 8601 format',
          inputSchema: {
            type: 'object',
            properties: {
              timezone: {
                type: 'string',
                description: 'Optional timezone (e.g., "America/New_York")',
              },
            },
          },
          // MCP 2025-06-18: Output schema
          outputSchema: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
              timezone: { type: 'string' },
              formatted: { type: 'string' },
              unix: { type: 'number' },
              iso8601: { type: 'string', format: 'date-time' },
            },
            required: ['timestamp', 'timezone', 'formatted', 'unix'],
          },
        },
        {
          name: 'get_server_logs',
          title: 'Get Server Logs',  // MCP 2025-06-18: Display name
          description: 'Get server logs with resource links (demonstrates MCP 2025-06-18 resource links)',
          inputSchema: {
            type: 'object',
            properties: {
              logType: {
                type: 'string',
                enum: ['error', 'access', 'debug'],
                description: 'Type of log to retrieve',
              },
              lines: {
                type: 'number',
                description: 'Number of log lines to retrieve',
                default: 100,
              },
            },
          },
          // MCP 2025-06-18: Output schema with resource link
          outputSchema: {
            type: 'object',
            properties: {
              logType: { type: 'string' },
              lines: { type: 'number' },
              resourceUri: { type: 'string', format: 'uri' },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['logType', 'resourceUri'],
          },
        },
      ],
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'calculator':
          return calculatorTool(args);
        case 'echo':
          return echoTool(args);
        case 'get_current_time':
          return getCurrentTimeTool(args);
        case 'get_server_logs':
          return getServerLogsTool(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool ${name}: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  /**
   * Register Resources
   * Resources provide read-only data
   */

  // List all available resources
  // MCP 2025-06-18: Added title field and _meta
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'config://server',
          name: 'server_configuration',  // Programmatic identifier
          title: 'Server Configuration',  // MCP 2025-06-18: Display name
          description: 'Current server configuration and settings',
          mimeType: 'application/json',
          _meta: {  // MCP 2025-06-18: Metadata
            version: '1.0.0',
            category: 'system',
          },
        },
        {
          uri: 'status://server',
          name: 'server_status',  // Programmatic identifier
          title: 'Server Status',  // MCP 2025-06-18: Display name
          description: 'Current server status and uptime information',
          mimeType: 'application/json',
          _meta: {  // MCP 2025-06-18: Metadata
            version: '1.0.0',
            category: 'monitoring',
            updateFrequency: 'realtime',
          },
        },
      ],
    };
  });

  // Handle resource reading
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    try {
      if (uri === 'config://server') {
        return configResource();
      } else if (uri === 'status://server') {
        return statusResource();
      } else {
        throw new Error(`Unknown resource: ${uri}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Error reading resource ${uri}: ${errorMessage}`);
    }
  });

  /**
   * Register Prompts
   * Prompts are predefined templates for LLM interactions
   */

  // List all available prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: 'code_review',
          description: 'Generate a code review prompt',
          arguments: [
            {
              name: 'language',
              description: 'Programming language',
              required: true,
            },
          ],
        },
      ],
    };
  });

  // Handle prompt generation
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'code_review') {
      const language = args?.language || 'unknown';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please review the following ${language} code for:\n- Code quality\n- Best practices\n- Potential bugs\n- Performance issues\n- Security concerns`,
            },
          },
        ],
      };
    }

    throw new Error(`Unknown prompt: ${name}`);
  });

  /**
   * Start the server with stdio transport
   */
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Log to stderr (stdout is used for MCP protocol messages)
  console.error('MCP Reference Server started');
  console.error('Capabilities: tools, resources, prompts');
  console.error('Transport: stdio');
}

// Start the server
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
