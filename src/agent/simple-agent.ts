#!/usr/bin/env node

/**
 * Simple Agent Implementation
 *
 * This agent demonstrates how to use the MCP client to orchestrate tool calls
 * and build a simple workflow. In a real-world scenario, this would integrate
 * with an LLM to make intelligent decisions about which tools to call.
 */

import { MCPClient } from '../client/index.js';

export class SimpleAgent {
  private client: MCPClient;
  private toolsCache: any[] = [];
  private resourcesCache: any[] = [];

  constructor() {
    this.client = new MCPClient();
  }

  /**
   * Initialize the agent by connecting to the server and discovering capabilities
   */
  async initialize(serverCommand: string, serverArgs: string[] = []) {
    console.error('\n🤖 Simple MCP Agent Starting...\n');

    // Connect to server
    await this.client.connect(serverCommand, serverArgs);

    // Discover available tools
    console.error('📋 Discovering available tools...');
    this.toolsCache = await this.client.listTools();
    console.error(`   Found ${this.toolsCache.length} tools:`);
    this.toolsCache.forEach((tool) => {
      console.error(`   - ${tool.name}: ${tool.description}`);
    });

    // Discover available resources
    console.error('\n📦 Discovering available resources...');
    this.resourcesCache = await this.client.listResources();
    console.error(`   Found ${this.resourcesCache.length} resources:`);
    this.resourcesCache.forEach((resource) => {
      console.error(`   - ${resource.name} (${resource.uri})`);
    });

    console.error('\n✅ Agent initialized successfully\n');
  }

  /**
   * Execute a simple workflow demonstrating tool orchestration
   */
  async executeWorkflow() {
    console.error('🔄 Executing sample workflow...\n');

    // Step 1: Get server status
    console.error('Step 1: Checking server status...');
    const status = await this.client.readResource('status://server');
    const statusContent = status.contents[0];
    const statusText = 'text' in statusContent ? statusContent.text : '{}';
    const statusData = JSON.parse(statusText);
    console.error(`   Server status: ${statusData.status}`);
    console.error(`   Uptime: ${statusData.uptime?.formatted || 'unknown'}\n`);

    // Step 2: Perform some calculations
    console.error('Step 2: Performing calculations...');
    const calc1 = await this.client.callTool('calculator', {
      operation: 'add',
      a: 15,
      b: 25,
    });
    const calc1Content = calc1.content[0];
    const calc1Text = calc1Content.type === 'text' ? calc1Content.text : '{}';
    const result1 = JSON.parse(calc1Text);
    console.error(`   15 + 25 = ${result1.result}`);

    const calc2 = await this.client.callTool('calculator', {
      operation: 'multiply',
      a: result1.result,
      b: 2,
    });
    const calc2Content = calc2.content[0];
    const calc2Text = calc2Content.type === 'text' ? calc2Content.text : '{}';
    const result2 = JSON.parse(calc2Text);
    console.error(`   ${result1.result} × 2 = ${result2.result}\n`);

    // Step 3: Get current time
    console.error('Step 3: Getting current time...');
    const timeResult = await this.client.callTool('get_current_time', {});
    const timeContent = timeResult.content[0];
    const timeText = timeContent.type === 'text' ? timeContent.text : '{}';
    const timeData = JSON.parse(timeText);
    console.error(`   Current time: ${timeData.formatted}\n`);

    // Step 4: Echo a message
    console.error('Step 4: Echoing a message...');
    const echoResult = await this.client.callTool('echo', {
      message: `Workflow completed at ${timeData.formatted}. Final calculation result: ${result2.result}`,
    });
    const echoContent = echoResult.content[0];
    const echoText = echoContent.type === 'text' ? echoContent.text : '';
    console.error(`   ${echoText}\n`);

    console.error('✅ Workflow completed successfully\n');
  }

  /**
   * Execute a custom task based on user input
   * This simulates what an LLM-powered agent might do
   */
  async executeTask(task: string) {
    console.error(`\n🎯 Executing task: "${task}"\n`);

    // Simple rule-based task execution (in a real agent, this would use an LLM)
    if (task.toLowerCase().includes('calculate') || task.toLowerCase().includes('math')) {
      console.error('Detected calculation task...');

      // Extract numbers if possible (simple pattern matching)
      const numbers = task.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        const a = parseInt(numbers[0]);
        const b = parseInt(numbers[1]);

        // Detect operation
        let operation = 'add';
        if (task.includes('multiply') || task.includes('×') || task.includes('*')) {
          operation = 'multiply';
        } else if (task.includes('divide') || task.includes('÷') || task.includes('/')) {
          operation = 'divide';
        } else if (task.includes('subtract') || task.includes('-')) {
          operation = 'subtract';
        }

        const result = await this.client.callTool('calculator', {
          operation,
          a,
          b,
        });

        const content = result.content[0];
        if (content.type === 'text') {
          console.log(content.text);
        }
      }
    } else if (task.toLowerCase().includes('time') || task.toLowerCase().includes('clock')) {
      console.error('Detected time query...');
      const result = await this.client.callTool('get_current_time', {});
      const content = result.content[0];
      if (content.type === 'text') {
        console.log(content.text);
      }
    } else if (task.toLowerCase().includes('status')) {
      console.error('Detected status query...');
      const result = await this.client.readResource('status://server');
      const content = result.contents[0];
      if ('text' in content) {
        console.log(content.text);
      }
    } else if (task.toLowerCase().includes('config')) {
      console.error('Detected config query...');
      const result = await this.client.readResource('config://server');
      const content = result.contents[0];
      if ('text' in content) {
        console.log(content.text);
      }
    } else {
      console.error('No specific handler found, echoing task...');
      const result = await this.client.callTool('echo', { message: task });
      const content = result.content[0];
      if (content.type === 'text') {
        console.log(content.text);
      }
    }

    console.error('\n✅ Task completed\n');
  }

  /**
   * Shutdown the agent
   */
  async shutdown() {
    console.error('👋 Shutting down agent...');
    await this.client.disconnect();
    console.error('✅ Agent shutdown complete\n');
  }
}

/**
 * Main function to run the agent
 */
async function main() {
  const agent = new SimpleAgent();

  try {
    // Initialize the agent
    await agent.initialize('node', ['dist/server/index.js']);

    // Execute the sample workflow
    await agent.executeWorkflow();

    // Execute some custom tasks
    await agent.executeTask('Calculate 42 multiply 3');
    await agent.executeTask('What is the current time?');
    await agent.executeTask('Show me the server status');

    // Shutdown
    await agent.shutdown();
  } catch (error) {
    console.error('❌ Agent error:', error);
    process.exit(1);
  }
}

// Run the agent if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
