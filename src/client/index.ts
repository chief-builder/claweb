#!/usr/bin/env node

/**
 * MCP Reference Client Implementation
 *
 * This client demonstrates how to connect to an MCP server and interact with its tools and resources.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  ListToolsResultSchema,
  CallToolResultSchema,
  ListResourcesResultSchema,
  ReadResourceResultSchema,
} from '@modelcontextprotocol/sdk/types.js';

export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;

  constructor() {
    this.client = new Client(
      {
        name: 'mcp-reference-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          // Client capabilities - what the client can do
          sampling: {},
        },
      }
    );
  }

  /**
   * Connect to an MCP server via stdio
   * @param serverCommand - Command to run (e.g., 'node')
   * @param serverArgs - Arguments for the command (e.g., ['server.js'])
   * @param env - Optional environment variables to pass to the subprocess
   */
  async connect(
    serverCommand: string,
    serverArgs: string[] = [],
    env?: Record<string, string>
  ) {
    // Merge provided env with current process env to ensure all required vars are available
    const processEnv = env
      ? { ...process.env, ...env }
      : process.env;

    this.transport = new StdioClientTransport({
      command: serverCommand,
      args: serverArgs,
      env: processEnv as Record<string, string>,
    });

    await this.client.connect(this.transport);

    console.error('Connected to MCP server');
    console.error('Server info:', {
      name: (this.client as any)._serverVersion?.name,
      version: (this.client as any)._serverVersion?.version,
    });
  }

  /**
   * List all available tools from the server
   */
  async listTools() {
    const response = await this.client.request(
      { method: 'tools/list' },
      ListToolsResultSchema
    );
    return response.tools;
  }

  /**
   * Call a tool on the server
   */
  async callTool(name: string, args: Record<string, unknown> = {}) {
    const response = await this.client.request(
      {
        method: 'tools/call',
        params: {
          name,
          arguments: args,
        },
      },
      CallToolResultSchema
    );
    return response;
  }

  /**
   * List all available resources from the server
   */
  async listResources() {
    const response = await this.client.request(
      { method: 'resources/list' },
      ListResourcesResultSchema
    );
    return response.resources;
  }

  /**
   * Read a resource from the server
   */
  async readResource(uri: string) {
    const response = await this.client.request(
      {
        method: 'resources/read',
        params: { uri },
      },
      ReadResourceResultSchema
    );
    return response;
  }

  /**
   * Disconnect from the server
   */
  async disconnect() {
    await this.client.close();
    console.error('Disconnected from MCP server');
  }
}

/**
 * Example usage of the client
 */
async function main() {
  const client = new MCPClient();

  try {
    // Connect to the server
    console.error('\n=== Connecting to MCP Server ===');
    await client.connect('node', ['dist/server/index.js']);

    // List available tools
    console.error('\n=== Available Tools ===');
    const tools = await client.listTools();
    console.log(JSON.stringify(tools, null, 2));

    // Call the calculator tool
    console.error('\n=== Calling Calculator Tool ===');
    const calcResult = await client.callTool('calculator', {
      operation: 'add',
      a: 10,
      b: 5,
    });
    console.log(JSON.stringify(calcResult, null, 2));

    // Call the echo tool
    console.error('\n=== Calling Echo Tool ===');
    const echoResult = await client.callTool('echo', {
      message: 'Hello from MCP client!',
    });
    console.log(JSON.stringify(echoResult, null, 2));

    // Call the current time tool
    console.error('\n=== Calling Current Time Tool ===');
    const timeResult = await client.callTool('get_current_time', {});
    console.log(JSON.stringify(timeResult, null, 2));

    // List available resources
    console.error('\n=== Available Resources ===');
    const resources = await client.listResources();
    console.log(JSON.stringify(resources, null, 2));

    // Read server config resource
    console.error('\n=== Reading Server Config Resource ===');
    const configResult = await client.readResource('config://server');
    console.log(JSON.stringify(configResult, null, 2));

    // Read server status resource
    console.error('\n=== Reading Server Status Resource ===');
    const statusResult = await client.readResource('status://server');
    console.log(JSON.stringify(statusResult, null, 2));

    // Disconnect
    await client.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the client example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
