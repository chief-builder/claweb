# MCP Tool Building Enhancement Proposal

Based on comprehensive research of Anthropic's latest best practices for MCP tool building and tool calling, this document proposes enhancements to our reference implementation.

## Executive Summary

This proposal outlines **12 key enhancements** derived from Anthropic's engineering recommendations, including:
- Code Execution Pattern (98% token reduction)
- Progressive Tool Discovery
- Think Tool Integration
- Tool Annotations for Safety
- Response Format Control
- Security Sandboxing

**Estimated Impact:**
- 90-98% reduction in token consumption for large-scale tool usage
- Improved security through tool annotations and sandboxing
- Better agent reasoning with think tool integration
- Enhanced tool discovery and selection

---

## Table of Contents

1. [Research Sources](#research-sources)
2. [Enhancement 1: Code Execution Pattern](#enhancement-1-code-execution-pattern)
3. [Enhancement 2: Progressive Tool Discovery](#enhancement-2-progressive-tool-discovery)
4. [Enhancement 3: Think Tool Integration](#enhancement-3-think-tool-integration)
5. [Enhancement 4: Tool Annotations](#enhancement-4-tool-annotations)
6. [Enhancement 5: Response Format Control](#enhancement-5-response-format-control)
7. [Enhancement 6: Token Efficiency Optimizations](#enhancement-6-token-efficiency-optimizations)
8. [Enhancement 7: Security Sandboxing](#enhancement-7-security-sandboxing)
9. [Enhancement 8: Improved Naming Conventions](#enhancement-8-improved-naming-conventions)
10. [Enhancement 9: Evaluation-Driven Refinement](#enhancement-9-evaluation-driven-refinement)
11. [Enhancement 10: Error Handling Improvements](#enhancement-10-error-handling-improvements)
12. [Enhancement 11: Tool Composition Patterns](#enhancement-11-tool-composition-patterns)
13. [Enhancement 12: Data Filtering Architecture](#enhancement-12-data-filtering-architecture)
14. [Implementation Roadmap](#implementation-roadmap)
15. [Current Implementation Gap Analysis](#current-implementation-gap-analysis)

---

## Research Sources

This proposal is based on the following Anthropic resources:

- [Code Execution with MCP: Building More Efficient AI Agents](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [Writing Effective Tools for AI Agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [The "Think" Tool: Enabling Claude to Stop and Think](https://www.anthropic.com/engineering/claude-think-tool)
- [Making Claude Code More Secure with Sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing)
- [Introducing the Model Context Protocol](https://www.anthropic.com/news/model-context-protocol)
- [Anthropic MCP Directory Policy](https://support.anthropic.com/en/articles/11697096-anthropic-mcp-directory-policy)
- [MCP Specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)

---

## Enhancement 1: Code Execution Pattern

### Problem Statement

From Anthropic's research:
> "As agents connect to hundreds or thousands of tools, they'll need to process hundreds of thousands of tokens before reading a request."

Two critical inefficiencies at scale:
1. **Tool Definition Overhead**: Loading all tool definitions upfront consumes excessive context
2. **Intermediate Result Bloat**: Results flow through the model between operations

### Proposed Solution

Present MCP servers as **code APIs** rather than direct tool calls. Agents write code to interact with MCP servers.

**Token Reduction**: From 150,000 tokens to 2,000 tokens — **98.7% savings**

### Implementation

#### New File: `src/server/code-execution/filesystem-api.ts`

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Exposes MCP tools as a virtual filesystem for code execution pattern.
 * Models can read tool definitions on-demand rather than loading all upfront.
 */
export class FilesystemToolAPI {
  private server: Server;
  private toolsBasePath: string;

  constructor(server: Server, toolsBasePath: string = '/mcp/tools') {
    this.server = server;
    this.toolsBasePath = toolsBasePath;
  }

  /**
   * Generate filesystem structure for tools
   *
   * servers/
   * ├── google-drive/
   * │   ├── getDocument.ts
   * │   └── index.ts
   * ├── salesforce/
   * │   ├── updateRecord.ts
   * │   └── index.ts
   */
  async generateToolFilesystem(): Promise<void> {
    const tools = await this.server.listTools();

    for (const tool of tools.tools) {
      const toolDir = path.join(this.toolsBasePath, tool.name);

      // Create tool definition file
      const definitionContent = `
/**
 * ${tool.title || tool.name}
 * ${tool.description}
 *
 * Input Schema:
 * ${JSON.stringify(tool.inputSchema, null, 2)}
 *
 * Output Schema:
 * ${JSON.stringify(tool.outputSchema, null, 2)}
 */
export async function ${this.toCamelCase(tool.name)}(args: ${tool.name}Args): Promise<${tool.name}Result> {
  // Implementation provided by MCP server
  return await mcpClient.callTool('${tool.name}', args);
}

// Type definitions
interface ${tool.name}Args ${JSON.stringify(tool.inputSchema, null, 2)}
interface ${tool.name}Result ${JSON.stringify(tool.outputSchema || {}, null, 2)}
`;

      await fs.mkdir(toolDir, { recursive: true });
      await fs.writeFile(
        path.join(toolDir, `${tool.name}.ts`),
        definitionContent
      );
    }
  }

  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}
```

#### New Tool: `src/server/tools/execute-code.ts`

```typescript
import { createSandbox, SandboxConfig } from '../security/sandbox.js';

export interface ExecuteCodeArgs {
  code: string;
  language: 'typescript' | 'javascript' | 'python';
  timeout?: number;
  allowedTools?: string[];
}

export async function executeCodeTool(
  args: ExecuteCodeArgs,
  mcpClient: MCPClient
): Promise<ExecuteCodeResult> {
  const { code, language, timeout = 30000, allowedTools = [] } = args;

  // Create sandboxed execution environment
  const sandbox = await createSandbox({
    timeout,
    allowedTools,
    memoryLimit: 256 * 1024 * 1024, // 256MB
    networkAccess: false,
  });

  try {
    // Inject MCP client for tool access
    sandbox.setGlobal('mcpClient', createRestrictedMCPClient(mcpClient, allowedTools));

    // Execute code in sandbox
    const result = await sandbox.execute(code, language);

    return {
      success: true,
      output: result.output,
      executionTime: result.executionTime,
      toolCallsCount: result.toolCalls.length,
      structuredContent: {
        success: true,
        output: result.output,
        executionTime: result.executionTime,
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      isError: true,
    };
  } finally {
    await sandbox.destroy();
  }
}
```

### Benefits

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Tool Definition Tokens | 150,000 | 2,000 | 98.7% reduction |
| Intermediate Results | Pass through model | Stay in sandbox | 100% reduction |
| Control Flow | Alternating calls | Native code | Faster execution |

---

## Enhancement 2: Progressive Tool Discovery

### Problem Statement

Loading hundreds of tool definitions upfront is inefficient. Models should discover tools on-demand.

### Proposed Solution

Implement a `search_tools` tool with configurable detail levels.

### Implementation

#### New Tool: `src/server/tools/search-tools.ts`

```typescript
export interface SearchToolsArgs {
  query: string;
  detailLevel: 'name_only' | 'name_and_description' | 'full_definition';
  category?: string;
  limit?: number;
}

export interface ToolSearchResult {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: object;
  outputSchema?: object;
  annotations?: ToolAnnotations;
}

export async function searchToolsTool(
  args: SearchToolsArgs,
  server: Server
): Promise<SearchToolsResult> {
  const { query, detailLevel, category, limit = 10 } = args;

  const allTools = await server.listTools();

  // Score tools by relevance
  const scoredTools = allTools.tools.map(tool => ({
    tool,
    score: calculateRelevance(tool, query, category)
  }));

  // Sort and limit
  const topTools = scoredTools
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ tool }) => tool);

  // Return based on detail level
  return {
    content: [{
      type: 'text',
      text: formatToolResults(topTools, detailLevel)
    }],
    structuredContent: {
      tools: topTools.map(tool => projectToolByDetailLevel(tool, detailLevel)),
      totalMatches: scoredTools.filter(t => t.score > 0).length,
      detailLevel
    }
  };
}

function projectToolByDetailLevel(
  tool: Tool,
  detailLevel: SearchToolsArgs['detailLevel']
): ToolSearchResult {
  switch (detailLevel) {
    case 'name_only':
      return { name: tool.name };

    case 'name_and_description':
      return {
        name: tool.name,
        title: tool.title,
        description: tool.description
      };

    case 'full_definition':
      return {
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations
      };
  }
}

function calculateRelevance(tool: Tool, query: string, category?: string): number {
  let score = 0;
  const queryLower = query.toLowerCase();

  // Name match (highest weight)
  if (tool.name.toLowerCase().includes(queryLower)) score += 10;

  // Title match
  if (tool.title?.toLowerCase().includes(queryLower)) score += 8;

  // Description match
  if (tool.description?.toLowerCase().includes(queryLower)) score += 5;

  // Category match
  if (category && tool.annotations?.category === category) score += 3;

  // Keywords match (if available)
  if (tool.annotations?.keywords?.some(k =>
    k.toLowerCase().includes(queryLower))) score += 4;

  return score;
}
```

#### Tool Definition

```typescript
{
  name: 'search_tools',
  title: 'Search Available Tools',
  description: `Search for available tools by query. Use detail levels to conserve context:
    - 'name_only': Just tool names (most efficient)
    - 'name_and_description': Names with descriptions
    - 'full_definition': Complete schemas (use sparingly)

    Example: search_tools({ query: 'database', detailLevel: 'name_and_description' })`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for finding relevant tools'
      },
      detailLevel: {
        type: 'string',
        enum: ['name_only', 'name_and_description', 'full_definition'],
        default: 'name_and_description',
        description: 'Level of detail to return (affects token usage)'
      },
      category: {
        type: 'string',
        description: 'Filter by tool category (e.g., "data", "integration")'
      },
      limit: {
        type: 'number',
        default: 10,
        description: 'Maximum number of tools to return'
      }
    },
    required: ['query']
  },
  outputSchema: {
    type: 'object',
    properties: {
      tools: { type: 'array' },
      totalMatches: { type: 'number' },
      detailLevel: { type: 'string' }
    }
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true
  }
}
```

---

## Enhancement 3: Think Tool Integration

### Problem Statement

From Anthropic's research:
> "The think tool is better suited for when Claude needs to call complex tools, analyze tool outputs carefully in long chains of tool calls, navigate policy-heavy environments with detailed guidelines, or make sequential decisions."

### Proposed Solution

Add a dedicated "think" tool to enable structured reasoning during complex workflows.

### Implementation

#### New Tool: `src/server/tools/think.ts`

```typescript
/**
 * The Think Tool - Enables structured reasoning during complex tool chains
 *
 * From Anthropic's research, this tool provides:
 * - 54% relative improvement on complex customer service scenarios
 * - Better policy compliance in rule-heavy environments
 * - Improved sequential decision making
 */
export interface ThinkArgs {
  thought: string;
  context?: 'analysis' | 'planning' | 'verification' | 'reflection';
}

export async function thinkTool(args: ThinkArgs): Promise<ThinkResult> {
  const { thought, context = 'analysis' } = args;

  // The think tool doesn't execute anything - it just records the thought
  // This allows Claude to reason explicitly before taking actions
  return {
    content: [{
      type: 'text',
      text: `[${context.toUpperCase()}] ${thought}`
    }],
    structuredContent: {
      thought,
      context,
      timestamp: new Date().toISOString()
    }
  };
}
```

#### Tool Definition with Optimized Prompt

```typescript
{
  name: 'think',
  title: 'Think',
  description: `Use this tool to reason through complex decisions before taking action.

    When to use:
    - Before calling tools with side effects
    - When analyzing previous tool outputs
    - When following multi-step policies
    - When the next action depends on synthesizing multiple pieces of information

    Context types:
    - 'analysis': Analyzing data or tool outputs
    - 'planning': Planning next steps
    - 'verification': Checking constraints or policies
    - 'reflection': Reviewing decisions

    This tool won't change any data - it just records your reasoning.`,
  inputSchema: {
    type: 'object',
    properties: {
      thought: {
        type: 'string',
        description: 'Your thought or reasoning'
      },
      context: {
        type: 'string',
        enum: ['analysis', 'planning', 'verification', 'reflection'],
        default: 'analysis',
        description: 'The type of thinking being done'
      }
    },
    required: ['thought']
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    title: 'Think'
  }
}
```

### Agent Integration

Update the intelligent agent to leverage think tool for complex workflows:

```typescript
// src/agent/intelligent-agent.ts - Enhanced with think tool guidance

const SYSTEM_PROMPT_WITH_THINK = `
You have access to a 'think' tool. Use it when:
1. You need to analyze results from previous tool calls
2. You're about to perform a destructive action
3. You need to verify compliance with policies
4. The decision requires synthesizing multiple pieces of information

Example reasoning patterns:
- Before database writes: think about data validation
- After API calls: think about error handling
- Multi-step workflows: think about ordering and dependencies
`;
```

---

## Enhancement 4: Tool Annotations

### Problem Statement

From Anthropic's MCP Directory Policy:
> "MCP servers must provide all applicable annotations for their tools, in particular readOnlyHint, destructiveHint, and title."

### Proposed Solution

Add comprehensive tool annotations to all tools in our implementation.

### Implementation

#### Type Definition: `src/server/types/annotations.ts`

```typescript
/**
 * Tool Annotations per MCP specification
 * These provide UX-specific information without affecting model context
 */
export interface ToolAnnotations {
  /** Human-readable title for the tool */
  title: string;

  /** If true, the tool does not modify its environment */
  readOnlyHint?: boolean;

  /** If true, the tool may perform destructive updates */
  destructiveHint?: boolean;

  /** If true, calling repeatedly with same args has no additional effect */
  idempotentHint?: boolean;

  /** If true, the tool may interact with external entities */
  openWorldHint?: boolean;

  // Extended annotations for better tooling

  /** Tool category for organization */
  category?: string;

  /** Keywords for search/discovery */
  keywords?: string[];

  /** Estimated cost in API credits/tokens */
  costEstimate?: 'free' | 'low' | 'medium' | 'high';

  /** Expected latency */
  latencyHint?: 'instant' | 'fast' | 'medium' | 'slow';

  /** Required OAuth scopes */
  requiredScopes?: string[];

  /** Whether human confirmation should be required */
  requiresConfirmation?: boolean;
}
```

#### Update All Tools with Annotations

```typescript
// src/server/index.ts - Updated tool definitions

const tools = [
  {
    name: 'calculator',
    title: 'Calculator',
    description: 'Perform basic arithmetic operations (add, subtract, multiply, divide)',
    inputSchema: calculatorInputSchema,
    outputSchema: calculatorOutputSchema,
    annotations: {
      title: 'Calculator',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      category: 'computation',
      keywords: ['math', 'arithmetic', 'calculation'],
      costEstimate: 'free',
      latencyHint: 'instant'
    }
  },
  {
    name: 'echo',
    title: 'Echo Message',
    description: 'Echo back a message with metadata',
    inputSchema: echoInputSchema,
    outputSchema: echoOutputSchema,
    annotations: {
      title: 'Echo Message',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      category: 'utility',
      keywords: ['test', 'debug', 'echo'],
      costEstimate: 'free',
      latencyHint: 'instant'
    }
  },
  {
    name: 'get_current_time',
    title: 'Get Current Time',
    description: 'Get current time with timezone support',
    inputSchema: timeInputSchema,
    outputSchema: timeOutputSchema,
    annotations: {
      title: 'Get Current Time',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false, // Time changes each call
      openWorldHint: false,
      category: 'utility',
      keywords: ['time', 'date', 'timezone', 'clock'],
      costEstimate: 'free',
      latencyHint: 'instant'
    }
  },
  // GitHub server tools with appropriate annotations
  {
    name: 'create_issue',
    title: 'Create GitHub Issue',
    description: 'Create a new issue in a GitHub repository',
    inputSchema: createIssueInputSchema,
    outputSchema: createIssueOutputSchema,
    annotations: {
      title: 'Create GitHub Issue',
      readOnlyHint: false,
      destructiveHint: false, // Creates new, doesn't destroy
      idempotentHint: false,
      openWorldHint: true, // Interacts with GitHub
      category: 'integration',
      keywords: ['github', 'issue', 'create', 'bug', 'feature'],
      costEstimate: 'low',
      latencyHint: 'fast',
      requiredScopes: ['repo', 'write:issues'],
      requiresConfirmation: false
    }
  },
  {
    name: 'delete_repository',
    title: 'Delete GitHub Repository',
    description: 'Permanently delete a GitHub repository. This action cannot be undone.',
    inputSchema: deleteRepoInputSchema,
    outputSchema: deleteRepoOutputSchema,
    annotations: {
      title: 'Delete GitHub Repository',
      readOnlyHint: false,
      destructiveHint: true, // DESTRUCTIVE!
      idempotentHint: true, // Deleting twice has same effect
      openWorldHint: true,
      category: 'integration',
      keywords: ['github', 'repository', 'delete', 'remove'],
      costEstimate: 'free',
      latencyHint: 'fast',
      requiredScopes: ['delete_repo'],
      requiresConfirmation: true // Require human confirmation
    }
  }
];
```

---

## Enhancement 5: Response Format Control

### Problem Statement

From Anthropic's research:
> "Implement an enum parameter for flexibility. Detailed responses include IDs for chaining tool calls; concise responses omit them to save tokens (~66% reduction)."

### Proposed Solution

Add a response format parameter to tools that return significant data.

### Implementation

```typescript
// src/server/tools/list-repositories.ts

export interface ListRepositoriesArgs {
  owner?: string;
  type?: 'all' | 'owner' | 'member';
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  responseFormat?: 'detailed' | 'concise'; // NEW
}

export async function listRepositoriesTool(
  args: ListRepositoriesArgs
): Promise<ListRepositoriesResult> {
  const { owner, type, sort, responseFormat = 'detailed' } = args;

  const repositories = await fetchRepositories(owner, type, sort);

  if (responseFormat === 'concise') {
    // ~66% token reduction
    return {
      content: [{
        type: 'text',
        text: repositories.map(r => `- ${r.full_name}: ${r.description || 'No description'}`).join('\n')
      }],
      structuredContent: {
        repositories: repositories.map(r => ({
          name: r.name,
          full_name: r.full_name,
          description: r.description
        })),
        count: repositories.length,
        format: 'concise'
      }
    };
  }

  // Detailed format includes IDs for chaining
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(repositories, null, 2)
    }],
    structuredContent: {
      repositories: repositories.map(r => ({
        id: r.id,
        node_id: r.node_id,
        name: r.name,
        full_name: r.full_name,
        description: r.description,
        html_url: r.html_url,
        created_at: r.created_at,
        updated_at: r.updated_at,
        pushed_at: r.pushed_at,
        language: r.language,
        default_branch: r.default_branch
      })),
      count: repositories.length,
      format: 'detailed'
    }
  };
}
```

#### Tool Description Update

```typescript
{
  name: 'list_repositories',
  title: 'List GitHub Repositories',
  description: `List repositories for a user or organization.

    Use 'concise' format when you only need names and descriptions.
    Use 'detailed' format when you need IDs for subsequent operations.

    Example: list_repositories({ owner: 'anthropics', responseFormat: 'concise' })`,
  inputSchema: {
    type: 'object',
    properties: {
      owner: { type: 'string' },
      type: { type: 'string', enum: ['all', 'owner', 'member'] },
      sort: { type: 'string', enum: ['created', 'updated', 'pushed', 'full_name'] },
      responseFormat: {
        type: 'string',
        enum: ['detailed', 'concise'],
        default: 'detailed',
        description: 'Response detail level. Use concise to save ~66% tokens.'
      }
    }
  }
}
```

---

## Enhancement 6: Token Efficiency Optimizations

### Problem Statement

> "Limit tool responses (Claude Code uses 25,000-token ceiling by default). Truncate large result sets with helpful guidance."

### Implementation

#### Response Truncation Middleware

```typescript
// src/server/middleware/response-truncation.ts

const MAX_RESPONSE_TOKENS = 25000;
const TRUNCATION_THRESHOLD = 20000;

export function createResponseTruncationMiddleware() {
  return async (response: ToolResponse): Promise<ToolResponse> => {
    const estimatedTokens = estimateTokens(response);

    if (estimatedTokens > TRUNCATION_THRESHOLD) {
      return truncateResponse(response, MAX_RESPONSE_TOKENS);
    }

    return response;
  };
}

function truncateResponse(
  response: ToolResponse,
  maxTokens: number
): ToolResponse {
  const content = response.content[0];

  if (content.type === 'text') {
    const truncatedText = truncateText(content.text, maxTokens);
    const wasTruncated = truncatedText.length < content.text.length;

    return {
      ...response,
      content: [{
        type: 'text',
        text: wasTruncated
          ? `${truncatedText}\n\n[Response truncated. ${response.structuredContent?.totalCount || 'Many'} total results. Use filters to narrow results: search(query, filter=['status=active'])]`
          : truncatedText
      }],
      structuredContent: {
        ...response.structuredContent,
        truncated: wasTruncated,
        truncatedAt: wasTruncated ? truncatedText.length : undefined
      }
    };
  }

  return response;
}
```

#### Pagination Support

```typescript
// src/server/tools/search-code.ts

export interface SearchCodeArgs {
  query: string;
  repository?: string;
  language?: string;
  // Pagination
  page?: number;
  perPage?: number;
  // Range selection
  startLine?: number;
  endLine?: number;
}

export async function searchCodeTool(args: SearchCodeArgs): Promise<SearchCodeResult> {
  const {
    query,
    repository,
    language,
    page = 1,
    perPage = 20, // Sensible default
    startLine,
    endLine
  } = args;

  const results = await searchCode(query, {
    repository,
    language,
    page,
    perPage
  });

  // Apply range selection if specified
  const filtered = startLine !== undefined
    ? results.map(r => ({
        ...r,
        content: r.content.split('\n').slice(startLine, endLine).join('\n')
      }))
    : results;

  return {
    content: [{
      type: 'text',
      text: formatSearchResults(filtered)
    }],
    structuredContent: {
      results: filtered,
      pagination: {
        page,
        perPage,
        totalPages: Math.ceil(results.totalCount / perPage),
        totalCount: results.totalCount
      },
      guidance: results.totalCount > perPage
        ? `Showing ${filtered.length} of ${results.totalCount} results. Use pagination or filters to refine.`
        : undefined
    }
  };
}
```

---

## Enhancement 7: Security Sandboxing

### Problem Statement

From Anthropic's research:
> "Running agent-generated code requires a secure execution environment with appropriate sandboxing, resource limits, and monitoring."

### Proposed Solution

Implement OS-level sandboxing using Linux bubblewrap and macOS seatbelt.

### Implementation

#### Sandbox Configuration: `src/server/security/sandbox.ts`

```typescript
import { spawn } from 'child_process';
import os from 'os';

export interface SandboxConfig {
  /** Maximum execution time in milliseconds */
  timeout: number;
  /** Maximum memory in bytes */
  memoryLimit: number;
  /** Whether to allow network access */
  networkAccess: boolean;
  /** Allowed filesystem paths (read-only) */
  allowedReadPaths?: string[];
  /** Allowed filesystem paths (read-write) */
  allowedWritePaths?: string[];
  /** Allowed tools the sandboxed code can call */
  allowedTools?: string[];
}

export interface Sandbox {
  execute(code: string, language: string): Promise<ExecutionResult>;
  setGlobal(name: string, value: unknown): void;
  destroy(): Promise<void>;
}

export async function createSandbox(config: SandboxConfig): Promise<Sandbox> {
  const platform = os.platform();

  if (platform === 'linux') {
    return createBubblewrapSandbox(config);
  } else if (platform === 'darwin') {
    return createSeatbeltSandbox(config);
  } else {
    throw new Error(`Unsupported platform for sandboxing: ${platform}`);
  }
}

async function createBubblewrapSandbox(config: SandboxConfig): Promise<Sandbox> {
  const bwrapArgs = [
    '--unshare-all',
    '--die-with-parent',
    '--new-session',
  ];

  // Network isolation
  if (!config.networkAccess) {
    bwrapArgs.push('--unshare-net');
  }

  // Filesystem isolation
  bwrapArgs.push(
    '--tmpfs', '/tmp',
    '--proc', '/proc',
    '--dev', '/dev',
  );

  // Mount allowed read paths
  for (const path of config.allowedReadPaths || []) {
    bwrapArgs.push('--ro-bind', path, path);
  }

  // Mount allowed write paths
  for (const path of config.allowedWritePaths || []) {
    bwrapArgs.push('--bind', path, path);
  }

  return {
    async execute(code: string, language: string): Promise<ExecutionResult> {
      return new Promise((resolve, reject) => {
        const runner = getLanguageRunner(language);
        const process = spawn('bwrap', [...bwrapArgs, runner, '-c', code], {
          timeout: config.timeout,
          maxBuffer: config.memoryLimit,
        });

        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => { stdout += data; });
        process.stderr.on('data', (data) => { stderr += data; });

        process.on('close', (exitCode) => {
          resolve({
            output: stdout,
            error: stderr,
            exitCode,
            executionTime: Date.now() - startTime,
          });
        });

        process.on('error', reject);

        const startTime = Date.now();
      });
    },

    setGlobal(name: string, value: unknown): void {
      // Inject into sandbox environment
    },

    async destroy(): Promise<void> {
      // Cleanup sandbox resources
    }
  };
}
```

#### Tool Permission Enforcement

```typescript
// src/server/security/permissions.ts

export interface ToolPermissions {
  /** Tools the agent can use freely */
  allowed: string[];
  /** Tools that require confirmation */
  requiresConfirmation: string[];
  /** Tools that are completely blocked */
  blocked: string[];
}

export function createPermissionEnforcer(permissions: ToolPermissions) {
  return async function enforcePermissions(
    toolName: string,
    args: unknown,
    confirmationCallback?: () => Promise<boolean>
  ): Promise<{ allowed: boolean; reason?: string }> {

    if (permissions.blocked.includes(toolName)) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' is blocked by security policy`
      };
    }

    if (permissions.requiresConfirmation.includes(toolName)) {
      if (!confirmationCallback) {
        return {
          allowed: false,
          reason: `Tool '${toolName}' requires confirmation but no callback provided`
        };
      }

      const confirmed = await confirmationCallback();
      if (!confirmed) {
        return {
          allowed: false,
          reason: `User denied permission for tool '${toolName}'`
        };
      }
    }

    return { allowed: true };
  };
}
```

---

## Enhancement 8: Improved Naming Conventions

### Problem Statement

From Anthropic's research:
> "Namespacing (grouping related tools under common prefixes) can help delineate boundaries between lots of tools... selecting between prefix- and suffix-based namespacing significantly impacts performance."

### Proposed Solution

Implement consistent namespacing with service and resource prefixes.

### Implementation

```typescript
// src/server/naming/conventions.ts

/**
 * Tool Naming Conventions
 *
 * Pattern: {service}_{resource}_{action}
 *
 * Examples:
 * - github_issues_list
 * - github_issues_create
 * - github_pulls_merge
 * - salesforce_contacts_search
 * - salesforce_opportunities_update
 */

export interface NamingConfig {
  service: string;
  resource: string;
  action: 'list' | 'get' | 'create' | 'update' | 'delete' | 'search' | 'execute';
}

export function generateToolName(config: NamingConfig): string {
  return `${config.service}_${config.resource}_${config.action}`;
}

export function parseToolName(name: string): NamingConfig | null {
  const parts = name.split('_');
  if (parts.length < 3) return null;

  return {
    service: parts[0],
    resource: parts.slice(1, -1).join('_'),
    action: parts[parts.length - 1] as NamingConfig['action']
  };
}

/**
 * Parameter Naming Conventions
 *
 * - Use explicit names: user_id not user
 * - Include type hints: created_at, is_active
 * - Be consistent across tools
 */
export const parameterNamingGuidelines = {
  identifiers: ['_id', '_ids'],
  timestamps: ['_at', '_date', '_time'],
  booleans: ['is_', 'has_', 'can_', 'should_'],
  counts: ['_count', '_total', '_limit'],
  filters: ['filter_', '_filter'],
};
```

#### Apply to All Tools

```typescript
// Before
{
  name: 'list_repositories',
  // ...
}

// After (with proper namespacing)
{
  name: 'github_repositories_list',
  title: 'List GitHub Repositories',
  // ...
}

{
  name: 'github_issues_create',
  title: 'Create GitHub Issue',
  // ...
}

{
  name: 'github_pulls_list',
  title: 'List Pull Requests',
  // ...
}
```

---

## Enhancement 9: Evaluation-Driven Refinement

### Problem Statement

From Anthropic's research:
> "Anthropic's internal testing showed Claude-optimized Slack and Asana MCP servers outperformed human-written versions on held-out test sets."

### Proposed Solution

Implement an evaluation framework for iterative tool refinement.

### Implementation

#### New Directory: `tests/evaluations/`

```typescript
// tests/evaluations/tool-evals.ts

export interface ToolEvaluation {
  /** Task description */
  task: string;
  /** Expected tool calls */
  expectedTools: string[];
  /** Expected outcome (for verification) */
  expectedOutcome: string | RegExp;
  /** Metrics to track */
  metrics: {
    accuracy: boolean;
    toolCallCount: number;
    tokenUsage: number;
    executionTime: number;
  };
}

export const toolEvaluations: ToolEvaluation[] = [
  {
    task: 'Find all open issues in the anthropics/claude-code repository labeled "bug"',
    expectedTools: ['github_issues_list'],
    expectedOutcome: /issues.*bug/i,
    metrics: {
      accuracy: true,
      toolCallCount: 1,
      tokenUsage: 500,
      executionTime: 2000
    }
  },
  {
    task: 'Calculate 15% tip on a $47.50 restaurant bill',
    expectedTools: ['calculator'],
    expectedOutcome: /7\.125|7\.13/,
    metrics: {
      accuracy: true,
      toolCallCount: 1,
      tokenUsage: 200,
      executionTime: 100
    }
  },
  // Multi-step evaluation
  {
    task: 'Find the most recently updated repository for user "octocat" and list its open issues',
    expectedTools: ['github_repositories_list', 'github_issues_list'],
    expectedOutcome: /issues/i,
    metrics: {
      accuracy: true,
      toolCallCount: 2,
      tokenUsage: 1000,
      executionTime: 5000
    }
  }
];

// Run evaluations
export async function runToolEvaluations(
  agent: IntelligentAgent,
  evaluations: ToolEvaluation[]
): Promise<EvaluationReport> {
  const results: EvaluationResult[] = [];

  for (const evaluation of evaluations) {
    const startTime = Date.now();
    const startTokens = agent.tokenUsage;

    const response = await agent.process(evaluation.task);

    const endTime = Date.now();
    const endTokens = agent.tokenUsage;

    const toolCalls = agent.getLastToolCalls();
    const outcomeMatches = evaluation.expectedOutcome instanceof RegExp
      ? evaluation.expectedOutcome.test(response)
      : response.includes(evaluation.expectedOutcome);

    results.push({
      task: evaluation.task,
      success: outcomeMatches,
      toolCallsActual: toolCalls.map(tc => tc.name),
      toolCallsExpected: evaluation.expectedTools,
      tokenUsage: endTokens - startTokens,
      executionTime: endTime - startTime,
      response
    });
  }

  return {
    results,
    summary: {
      totalTests: results.length,
      passed: results.filter(r => r.success).length,
      avgTokenUsage: results.reduce((a, r) => a + r.tokenUsage, 0) / results.length,
      avgExecutionTime: results.reduce((a, r) => a + r.executionTime, 0) / results.length
    }
  };
}
```

---

## Enhancement 10: Error Handling Improvements

### Problem Statement

From Anthropic's research:
> "Replace opaque error codes with actionable messages: 'Narrow your search with filters: search(query, filter=['status=active'])'"

### Implementation

```typescript
// src/server/errors/actionable-errors.ts

export interface ActionableError {
  code: string;
  message: string;
  suggestion: string;
  examples?: string[];
}

export const errorTemplates: Record<string, ActionableError> = {
  RESULTS_TOO_LARGE: {
    code: 'RESULTS_TOO_LARGE',
    message: 'Search returned too many results to process efficiently.',
    suggestion: 'Narrow your search with filters or pagination.',
    examples: [
      "search_code({ query: 'TODO', language: 'typescript' })",
      "search_code({ query: 'TODO', perPage: 10 })"
    ]
  },
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    message: 'API rate limit exceeded.',
    suggestion: 'Wait before retrying or use cached results if available.',
    examples: []
  },
  INVALID_PARAMETERS: {
    code: 'INVALID_PARAMETERS',
    message: 'One or more parameters are invalid.',
    suggestion: 'Check parameter types and required fields.',
    examples: []
  },
  RESOURCE_NOT_FOUND: {
    code: 'RESOURCE_NOT_FOUND',
    message: 'The requested resource was not found.',
    suggestion: 'Verify the resource identifier or search for it first.',
    examples: [
      "github_repositories_list({ owner: 'username' })",
      "search_tools({ query: 'repository' })"
    ]
  }
};

export function createActionableError(
  templateKey: string,
  context?: Record<string, unknown>
): ToolResponse {
  const template = errorTemplates[templateKey] || {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred.',
    suggestion: 'Check the tool documentation or try again.',
    examples: []
  };

  const errorMessage = `Error: ${template.message}

Suggestion: ${template.suggestion}${
  template.examples.length > 0
    ? `\n\nExamples:\n${template.examples.map(e => `  ${e}`).join('\n')}`
    : ''
}${
  context
    ? `\n\nContext: ${JSON.stringify(context, null, 2)}`
    : ''
}`;

  return {
    content: [{
      type: 'text',
      text: errorMessage
    }],
    isError: true,
    structuredContent: {
      error: template.code,
      message: template.message,
      suggestion: template.suggestion,
      examples: template.examples,
      context
    }
  };
}
```

---

## Enhancement 11: Tool Composition Patterns

### Problem Statement

Consolidate multi-step workflows into single tools to reduce round-trips.

From Anthropic's research:
> "Consolidate multi-step workflows into single tools (e.g., `schedule_event` instead of separate user/event tools)"

### Implementation

```typescript
// src/server/tools/composed/get-customer-context.ts

/**
 * Composed tool that returns all customer context in one call
 * Instead of: get_customer + get_transactions + get_notes
 */
export interface GetCustomerContextArgs {
  customerId: string;
  includeTransactions?: boolean;
  includeNotes?: boolean;
  transactionLimit?: number;
}

export async function getCustomerContextTool(
  args: GetCustomerContextArgs
): Promise<GetCustomerContextResult> {
  const {
    customerId,
    includeTransactions = true,
    includeNotes = true,
    transactionLimit = 10
  } = args;

  // Parallel fetch all data
  const [customer, transactions, notes] = await Promise.all([
    fetchCustomer(customerId),
    includeTransactions ? fetchTransactions(customerId, transactionLimit) : null,
    includeNotes ? fetchNotes(customerId) : null
  ]);

  return {
    content: [{
      type: 'text',
      text: formatCustomerContext(customer, transactions, notes)
    }],
    structuredContent: {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        status: customer.status,
        createdAt: customer.created_at
      },
      transactions: transactions?.map(t => ({
        id: t.id,
        amount: t.amount,
        date: t.date,
        type: t.type
      })),
      notes: notes?.map(n => ({
        id: n.id,
        content: n.content,
        author: n.author,
        createdAt: n.created_at
      })),
      summary: {
        totalTransactions: transactions?.length || 0,
        totalNotes: notes?.length || 0,
        accountAge: calculateAccountAge(customer.created_at)
      }
    }
  };
}
```

---

## Enhancement 12: Data Filtering Architecture

### Problem Statement

From Anthropic's research:
> "Filter large datasets before returning to the model. Processing 10,000 spreadsheet rows locally, then returning only filtered results, eliminates unnecessary context consumption."

### Implementation

```typescript
// src/server/tools/data-processing.ts

export interface QueryDataArgs {
  source: string; // Resource URI or table name
  query: {
    select?: string[];
    where?: Record<string, unknown>;
    orderBy?: { field: string; direction: 'asc' | 'desc' };
    limit?: number;
    offset?: number;
  };
  /** Process in sandbox to keep data out of context */
  processLocally?: boolean;
  /** Aggregation to apply */
  aggregate?: {
    groupBy?: string[];
    operations: Array<{
      field: string;
      operation: 'sum' | 'avg' | 'count' | 'min' | 'max';
      alias?: string;
    }>;
  };
}

export async function queryDataTool(args: QueryDataArgs): Promise<QueryDataResult> {
  const { source, query, processLocally = true, aggregate } = args;

  // Fetch raw data (stays in execution environment)
  const rawData = await fetchDataSource(source);

  // Apply filtering locally
  let result = rawData;

  if (query.where) {
    result = result.filter(row => matchesWhere(row, query.where!));
  }

  if (query.select) {
    result = result.map(row => pick(row, query.select!));
  }

  if (query.orderBy) {
    result = sortBy(result, query.orderBy.field, query.orderBy.direction);
  }

  // Apply aggregation if requested
  if (aggregate) {
    result = applyAggregation(result, aggregate);
  }

  // Apply pagination
  if (query.offset) {
    result = result.slice(query.offset);
  }
  if (query.limit) {
    result = result.slice(0, query.limit);
  }

  return {
    content: [{
      type: 'text',
      text: formatDataResults(result, rawData.length)
    }],
    structuredContent: {
      data: result,
      metadata: {
        totalRows: rawData.length,
        returnedRows: result.length,
        filtered: rawData.length !== result.length,
        aggregated: !!aggregate
      }
    }
  };
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

| Task | Priority | Effort |
|------|----------|--------|
| Add tool annotations to all existing tools | High | 2 days |
| Implement think tool | High | 1 day |
| Add response format control | Medium | 2 days |
| Implement error handling improvements | Medium | 2 days |
| Update naming conventions | Medium | 1 day |

### Phase 2: Progressive Discovery (Week 3)

| Task | Priority | Effort |
|------|----------|--------|
| Implement search_tools tool | High | 2 days |
| Add detail level support | High | 1 day |
| Update tool list handler | Medium | 1 day |
| Add category/keyword metadata | Medium | 1 day |

### Phase 3: Code Execution (Week 4-5)

| Task | Priority | Effort |
|------|----------|--------|
| Implement sandbox infrastructure | High | 3 days |
| Create filesystem API for tools | High | 2 days |
| Build execute_code tool | High | 3 days |
| Security hardening | High | 2 days |

### Phase 4: Token Efficiency (Week 6)

| Task | Priority | Effort |
|------|----------|--------|
| Implement response truncation middleware | Medium | 2 days |
| Add pagination to all list tools | Medium | 2 days |
| Implement data filtering tools | Medium | 2 days |

### Phase 5: Evaluation Framework (Week 7)

| Task | Priority | Effort |
|------|----------|--------|
| Create evaluation test suite | Medium | 3 days |
| Build metrics collection | Medium | 2 days |
| Document evaluation process | Low | 1 day |

---

## Current Implementation Gap Analysis

| Feature | Current Status | Proposed Status | Gap |
|---------|---------------|-----------------|-----|
| Tool Annotations | Partial (title only) | Full annotations | Medium |
| Think Tool | Not implemented | Implemented | High |
| Progressive Discovery | Not implemented | search_tools | High |
| Code Execution | Not implemented | Full sandbox | High |
| Response Format Control | Not implemented | detailed/concise | Medium |
| Token Efficiency | Basic | Truncation + pagination | Medium |
| Naming Conventions | Inconsistent | Namespaced | Low |
| Error Messages | Basic | Actionable | Low |
| Evaluation Framework | Not implemented | Comprehensive | Medium |
| Security Sandboxing | Not implemented | OS-level sandbox | High |

---

## Success Metrics

### Token Efficiency
- **Target**: 90%+ reduction in token usage for large-scale tool usage
- **Measurement**: Before/after comparison on standard task suite

### Agent Accuracy
- **Target**: 54%+ improvement on complex multi-tool tasks (matching Anthropic's think tool results)
- **Measurement**: Evaluation framework pass rate

### Security
- **Target**: Zero successful sandbox escapes in security testing
- **Measurement**: Red team testing results

### Developer Experience
- **Target**: <5 min to add new tool with full annotations
- **Measurement**: New tool creation time

---

## References

- [Code execution with MCP: building more efficient AI agents](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [Writing effective tools for AI agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [The "think" tool: Enabling Claude to stop and think](https://www.anthropic.com/engineering/claude-think-tool)
- [Making Claude Code more secure with sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing)
- [Anthropic MCP Directory Policy](https://support.anthropic.com/en/articles/11697096-anthropic-mcp-directory-policy)
- [MCP Specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [MCP Security Best Practices](https://www.stackhawk.com/blog/mcp-server-security-best-practices/)

---

**Document Version:** 1.0
**Created:** November 22, 2025
**Author:** Claude Code Research
**Status:** Proposal
