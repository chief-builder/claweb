/**
 * Resource Providers
 * Resources provide read-only data to clients
 */

const serverStartTime = Date.now();

/**
 * Server configuration resource
 */
export function configResource() {
  const config = {
    server: {
      name: 'mcp-reference-server',
      version: '1.0.0',
      protocol: 'MCP',
      transport: 'stdio',
    },
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
    },
    limits: {
      maxRequestSize: 1024 * 1024, // 1MB
      maxResponseSize: 10 * 1024 * 1024, // 10MB
    },
  };

  return {
    contents: [
      {
        uri: 'config://server',
        mimeType: 'application/json',
        text: JSON.stringify(config, null, 2),
      },
    ],
  };
}

/**
 * Server status resource
 */
export function statusResource() {
  const uptime = Date.now() - serverStartTime;
  const uptimeSeconds = Math.floor(uptime / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);

  const status = {
    status: 'running',
    uptime: {
      milliseconds: uptime,
      seconds: uptimeSeconds,
      formatted: `${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`,
    },
    memory: {
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal,
      external: process.memoryUsage().external,
      rss: process.memoryUsage().rss,
    },
    process: {
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version,
    },
    timestamp: new Date().toISOString(),
  };

  return {
    contents: [
      {
        uri: 'status://server',
        mimeType: 'application/json',
        text: JSON.stringify(status, null, 2),
      },
    ],
  };
}
