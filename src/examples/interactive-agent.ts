#!/usr/bin/env node

/**
 * Interactive Intelligent Agent Example
 *
 * This script demonstrates how to use the intelligent agent
 * with custom queries. You can modify the queries array to test
 * different scenarios.
 */

import { IntelligentAgent } from '../agent/intelligent-agent.js';

async function main() {
  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Error: ANTHROPIC_API_KEY environment variable not set');
    console.error('\nPlease set your API key:');
    console.error('  export ANTHROPIC_API_KEY=your-api-key-here\n');
    process.exit(1);
  }

  const agent = new IntelligentAgent();

  try {
    // Initialize the agent
    await agent.initialize('node', ['dist/server/index.js']);

    // Example queries - modify these to test different scenarios
    const queries = [
      // Simple calculations
      'What is 42 times 7?',

      // Chained operations
      'Calculate 100 divided by 5, then add 30 to the result',

      // Mixed tool usage
      'Tell me the current time and server status',

      // Resource access
      'What is the server configuration?',

      // Echo test
      'Echo this message: "Hello from the intelligent agent!"',

      // Complex query
      'Calculate 25 plus 75, multiply the result by 2, then tell me what time it is',
    ];

    // Process each query
    for (let i = 0; i < queries.length; i++) {
      console.error(`\n${'='.repeat(80)}`);
      console.error(`Query ${i + 1}/${queries.length}`);
      console.error('='.repeat(80));

      const response = await agent.processQuery(queries[i]);

      console.error('\n📝 Final Answer:');
      console.log(`\n${response}\n`);
    }

    // Shutdown
    await agent.shutdown();

    console.error('✨ All queries completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    await agent.shutdown();
    process.exit(1);
  }
}

main();
