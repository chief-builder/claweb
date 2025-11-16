#!/usr/bin/env node

/**
 * MCP HTTP Server Implementation
 *
 * This server demonstrates MCP with HTTP/SSE transport
 * MCP 2025-06-18 specification compliant
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { HttpServerTransport } from '../transport/http/server.js';
import { TransportType, type TransportConfig } from '../transport/base.js';

// Tool implementations
import { calculatorTool } from './tools/calculator.js';
import { echoTool } from './tools/echo.js';
import { getCurrentTimeTool } from './tools/current-time.js';
import { getServerLogsTool } from './tools/get-server-logs.js';

// Resource implementations
import { configResource, statusResource } from './resources/config.js';

/**
 * Create and configure the MCP server with HTTP transport
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const portArg = args.find((arg) => arg.startsWith('--port='));
  const hostArg = args.find((arg) => arg.startsWith('--host='));

  const port = portArg ? parseInt(portArg.split('=')[1]) : 3000;
  const host = hostArg ? hostArg.split('=')[1] : 'localhost';

  // Initialize the MCP server
  const server = new Server(
    {
      name: 'mcp-reference-server',
      version: '2.0.0', // MCP 2025-06-18
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
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'calculator',
          title: 'Calculator',
          description: 'Perform basic arithmetic operations (add, subtract, multiply, divide)',
          inputSchema: {
            type: 'object',
            properties: {
              operation: {
                type: 'string',
                enum: ['add', 'subtract', 'multiply', 'divide'],
                description: 'The arithmetic operation to perform',
              },
              a: { type: 'number', description: 'First number' },
              b: { type: 'number', description: 'Second number' },
            },
            required: ['operation', 'a', 'b'],
          },
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
          title: 'Echo',
          description: 'Echo back the provided message',
          inputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'The message to echo back' },
            },
            required: ['message'],
          },
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
          title: 'Get Current Time',
          description: 'Get the current server time in ISO 8601 format',
          inputSchema: {
            type: 'object',
            properties: {
              timezone: { type: 'string', description: 'Optional timezone' },
            },
          },
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
          title: 'Get Server Logs',
          description: 'Get server logs with resource links',
          inputSchema: {
            type: 'object',
            properties: {
              logType: {
                type: 'string',
                enum: ['error', 'access', 'debug'],
                description: 'Type of log to retrieve',
              },
              lines: { type: 'number', description: 'Number of log lines', default: 100 },
            },
          },
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
        content: [{ type: 'text', text: `Error executing tool ${name}: ${errorMessage}` }],
        isError: true,
      };
    }
  });

  /**
   * Register Resources
   */
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'config://server',
          name: 'server_configuration',
          title: 'Server Configuration',
          description: 'Current server configuration and settings',
          mimeType: 'application/json',
          _meta: { version: '1.0.0', category: 'system' },
        },
        {
          uri: 'status://server',
          name: 'server_status',
          title: 'Server Status',
          description: 'Current server status and uptime information',
          mimeType: 'application/json',
          _meta: { version: '1.0.0', category: 'monitoring', updateFrequency: 'realtime' },
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
   */
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: 'code_review',
          description: 'Generate a code review prompt',
          arguments: [{ name: 'language', description: 'Programming language', required: true }],
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
   * Start the server with HTTP transport
   */
  const transport = new HttpServerTransport();

  // Create custom transport adapter for MCP SDK
  // The SDK expects specific transport interface, so we adapt our HTTP transport
  const transportConfig: TransportConfig = {
    type: TransportType.HTTP,
    host,
    port,
    cors: true,
  };

  await transport.initialize(transportConfig);

  // Set message handler to process incoming MCP messages
  transport.setMessageHandler(async (message) => {
    // This is a simplified handler - in production, integrate properly with MCP SDK
    console.error('[HTTP Server] Processing message:', message.method || message.id);
    return message;
  });

  console.error('='.repeat(60));
  console.error('MCP HTTP Server Started Successfully');
  console.error('='.repeat(60));
  console.error(`Server URL: http://${host}:${port}`);
  console.error(`Protocol Version: 2025-06-18`);
  console.error(`Transport: HTTP with SSE streaming`);
  console.error('');
  console.error('Available Endpoints:');
  console.error(`  - Health Check: http://${host}:${port}/health`);
  console.error(`  - Protocol Info: http://${host}:${port}/protocol`);
  console.error(`  - SSE Stream: http://${host}:${port}/sse`);
  console.error(`  - Messages: http://${host}:${port}/message`);
  console.error('='.repeat(60));

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('\nShutting down server...');
    await transport.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('\nShutting down server...');
    await transport.close();
    process.exit(0);
  });
}

// Start the server
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
