/**
 * Traceable Agent Wrapper
 *
 * Provides instrumentation for agents to track tool calls, resources accessed,
 * and timing information for testing purposes.
 */

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

export interface ResourceAccess {
  uri: string;
  timestamp: number;
  duration: number;
  success: boolean;
}

export interface AgentTrace {
  toolsUsed: ToolCall[];
  resourcesAccessed: ResourceAccess[];
  iterations: number;
  totalDuration: number;
  startTime: number;
  endTime: number;
}

export interface TraceResult<T> {
  response: T;
  trace: AgentTrace;
}

/**
 * Creates an empty trace object
 */
export function createEmptyTrace(): AgentTrace {
  return {
    toolsUsed: [],
    resourcesAccessed: [],
    iterations: 0,
    totalDuration: 0,
    startTime: 0,
    endTime: 0,
  };
}

/**
 * Wraps a tool call with tracing
 */
export async function traceToolCall<T>(
  trace: AgentTrace,
  toolName: string,
  input: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const toolCall: ToolCall = {
    name: toolName,
    input,
    duration: 0,
    timestamp: startTime,
    success: false,
  };

  try {
    const result = await fn();
    toolCall.output = result;
    toolCall.success = true;
    return result;
  } catch (error) {
    toolCall.success = false;
    toolCall.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    toolCall.duration = Date.now() - startTime;
    trace.toolsUsed.push(toolCall);
  }
}

/**
 * Wraps a resource access with tracing
 */
export async function traceResourceAccess<T>(
  trace: AgentTrace,
  uri: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const access: ResourceAccess = {
    uri,
    timestamp: startTime,
    duration: 0,
    success: false,
  };

  try {
    const result = await fn();
    access.success = true;
    return result;
  } catch (error) {
    access.success = false;
    throw error;
  } finally {
    access.duration = Date.now() - startTime;
    trace.resourcesAccessed.push(access);
  }
}

/**
 * Utility to check if specific tools were called
 */
export function toolWasCalled(trace: AgentTrace, toolName: string): boolean {
  return trace.toolsUsed.some((t) => t.name === toolName);
}

/**
 * Get all tool names called in order
 */
export function getToolCallOrder(trace: AgentTrace): string[] {
  return trace.toolsUsed.map((t) => t.name);
}

/**
 * Get tool call count
 */
export function getToolCallCount(trace: AgentTrace, toolName?: string): number {
  if (toolName) {
    return trace.toolsUsed.filter((t) => t.name === toolName).length;
  }
  return trace.toolsUsed.length;
}

/**
 * Check if a resource was accessed
 */
export function resourceWasAccessed(trace: AgentTrace, uri: string): boolean {
  return trace.resourcesAccessed.some((r) => r.uri === uri);
}

/**
 * Calculate total tool execution time
 */
export function getTotalToolTime(trace: AgentTrace): number {
  return trace.toolsUsed.reduce((sum, t) => sum + t.duration, 0);
}

/**
 * Get failed tool calls
 */
export function getFailedToolCalls(trace: AgentTrace): ToolCall[] {
  return trace.toolsUsed.filter((t) => !t.success);
}
