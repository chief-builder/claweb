/**
 * Current Time Tool
 * Returns the current server time
 */

interface CurrentTimeArgs {
  timezone?: string;
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

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          timestamp: now.toISOString(),
          timezone: timezone || 'UTC',
          formatted: timeString,
          unix: Math.floor(now.getTime() / 1000),
        }, null, 2),
      },
    ],
  };
}
