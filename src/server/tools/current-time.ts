/**
 * Current Time Tool
 * Returns the current server time
 *
 * MCP 2025-06-18: Returns structured output
 */

interface CurrentTimeArgs {
  timezone?: string;
}

interface CurrentTimeOutput {
  timestamp: string;
  timezone: string;
  formatted: string;
  unix: number;
  iso8601: string;
}

export function getCurrentTimeTool(args: unknown) {
  const { timezone } = (args as CurrentTimeArgs) || {};

  const now = new Date();
  let timeString: string;

  if (timezone) {
    try {
      timeString = now.toLocaleString('en-US', { timeZone: timezone });
    } catch (error) {
      throw new Error(`Invalid timezone: ${timezone}`);
    }
  } else {
    timeString = now.toISOString();
  }

  // Structured output (2025-06-18)
  const structuredOutput: CurrentTimeOutput = {
    timestamp: now.toISOString(),
    timezone: timezone || 'UTC',
    formatted: timeString,
    unix: Math.floor(now.getTime() / 1000),
    iso8601: now.toISOString(),
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(structuredOutput, null, 2),
      },
    ],
    // MCP 2025-06-18: Structured content for type-safe parsing
    structuredContent: structuredOutput,
  };
}
