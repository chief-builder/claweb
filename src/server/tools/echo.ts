/**
 * Echo Tool
 * Simply echoes back the provided message
 *
 * MCP 2025-06-18: Returns structured output
 */

interface EchoArgs {
  message: string;
}

interface EchoOutput {
  message: string;
  length: number;
  timestamp: string;
}

export function echoTool(args: unknown) {
  const { message } = args as EchoArgs;

  // Structured output (2025-06-18)
  const structuredOutput: EchoOutput = {
    message,
    length: message.length,
    timestamp: new Date().toISOString(),
  };

  return {
    content: [
      {
        type: 'text',
        text: message,
      },
    ],
    // MCP 2025-06-18: Structured content for type-safe parsing
    structuredContent: structuredOutput,
  };
}
