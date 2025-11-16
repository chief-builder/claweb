/**
 * Get Server Logs Tool
 * Demonstrates resource links (MCP 2025-06-18)
 *
 * This tool returns a resource link instead of inlining large log content,
 * which is more efficient and prevents token limit issues.
 */

interface GetServerLogsArgs {
  logType?: 'error' | 'access' | 'debug';
  lines?: number;
}

interface ServerLogsOutput {
  logType: string;
  lines: number;
  resourceUri: string;
  timestamp: string;
}

export function getServerLogsTool(args: unknown) {
  const { logType = 'access', lines = 100 } = (args as GetServerLogsArgs) || {};

  // Determine log file URI based on type
  const logUriMap = {
    error: 'file:///var/log/mcp-server/error.log',
    access: 'file:///var/log/mcp-server/access.log',
    debug: 'file:///var/log/mcp-server/debug.log',
  };

  const logUri = logUriMap[logType];

  // Structured output
  const structuredOutput: ServerLogsOutput = {
    logType,
    lines,
    resourceUri: logUri,
    timestamp: new Date().toISOString(),
  };

  // MCP 2025-06-18: Return resource link instead of inlining large content
  return {
    content: [
      {
        type: 'text',
        text: `Server logs (${logType}) available at ${logUri}`,
      },
      {
        // MCP 2025-06-18: Resource link content type
        type: 'resource',
        resource: {
          uri: logUri,
          mimeType: 'text/plain',
          text: `Log file: ${logType}\nLines requested: ${lines}\n\nNote: This is a demo. In production, this would link to actual log files.`,
          _meta: {
            logType,
            lines,
            size: '~2MB',
            encoding: 'utf-8',
          },
        },
      },
    ],
    // Structured output for type-safe parsing
    structuredContent: structuredOutput,
  };
}
