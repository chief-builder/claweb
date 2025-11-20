#!/usr/bin/env node

/**
 * GitHub MCP Server
 *
 * An MCP server that provides GitHub API capabilities through the Octokit library.
 * Supports OAuth 2.1 authentication for secure access to GitHub resources.
 *
 * Features:
 * - List repositories
 * - Get repository details
 * - Create/update/delete issues
 * - List pull requests
 * - Get file contents
 * - Create commits
 * - Search code, repositories, issues
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Octokit } from '@octokit/rest';

/**
 * GitHub MCP Server
 * Provides GitHub API capabilities through MCP protocol
 */
class GitHubMCPServer {
  private server: Server;
  private octokit: Octokit | null = null;
  private accessToken: string | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'github-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: 'list_repositories',
          title: 'List Repositories',
          description: 'List repositories for the authenticated user or a specific user/organization',
          inputSchema: {
            type: 'object',
            properties: {
              username: {
                type: 'string',
                description: 'Username or organization (optional, uses authenticated user if not provided)',
              },
              type: {
                type: 'string',
                enum: ['all', 'owner', 'public', 'private', 'member'],
                description: 'Filter by repository type',
                default: 'all',
              },
              sort: {
                type: 'string',
                enum: ['created', 'updated', 'pushed', 'full_name'],
                description: 'Sort repositories by',
                default: 'updated',
              },
              per_page: {
                type: 'number',
                description: 'Results per page (max 100)',
                default: 30,
              },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              repositories: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    full_name: { type: 'string' },
                    description: { type: 'string' },
                    url: { type: 'string' },
                    stars: { type: 'number' },
                    forks: { type: 'number' },
                  },
                },
              },
              count: { type: 'number' },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'repositories', 'count'],
          },
        },
        {
          name: 'get_repository',
          title: 'Get Repository',
          description: 'Get detailed information about a specific repository',
          inputSchema: {
            type: 'object',
            properties: {
              owner: {
                type: 'string',
                description: 'Repository owner (username or organization)',
              },
              repo: {
                type: 'string',
                description: 'Repository name',
              },
            },
            required: ['owner', 'repo'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              repository: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  full_name: { type: 'string' },
                  description: { type: 'string' },
                  url: { type: 'string' },
                  stars: { type: 'number' },
                  forks: { type: 'number' },
                  language: { type: 'string' },
                  created_at: { type: 'string' },
                  updated_at: { type: 'string' },
                },
              },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'repository'],
          },
        },
        {
          name: 'list_issues',
          title: 'List Issues',
          description: 'List issues for a repository',
          inputSchema: {
            type: 'object',
            properties: {
              owner: {
                type: 'string',
                description: 'Repository owner',
              },
              repo: {
                type: 'string',
                description: 'Repository name',
              },
              state: {
                type: 'string',
                enum: ['open', 'closed', 'all'],
                description: 'Issue state filter',
                default: 'open',
              },
              per_page: {
                type: 'number',
                description: 'Results per page (max 100)',
                default: 30,
              },
            },
            required: ['owner', 'repo'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              issues: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    number: { type: 'number' },
                    title: { type: 'string' },
                    state: { type: 'string' },
                    url: { type: 'string' },
                    created_at: { type: 'string' },
                  },
                },
              },
              count: { type: 'number' },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'issues', 'count'],
          },
        },
        {
          name: 'create_issue',
          title: 'Create Issue',
          description: 'Create a new issue in a repository',
          inputSchema: {
            type: 'object',
            properties: {
              owner: {
                type: 'string',
                description: 'Repository owner',
              },
              repo: {
                type: 'string',
                description: 'Repository name',
              },
              title: {
                type: 'string',
                description: 'Issue title',
              },
              body: {
                type: 'string',
                description: 'Issue body (optional)',
              },
              labels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Issue labels (optional)',
              },
            },
            required: ['owner', 'repo', 'title'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              issue: {
                type: 'object',
                properties: {
                  number: { type: 'number' },
                  title: { type: 'string' },
                  url: { type: 'string' },
                  state: { type: 'string' },
                },
              },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'issue'],
          },
        },
        {
          name: 'list_pull_requests',
          title: 'List Pull Requests',
          description: 'List pull requests for a repository',
          inputSchema: {
            type: 'object',
            properties: {
              owner: {
                type: 'string',
                description: 'Repository owner',
              },
              repo: {
                type: 'string',
                description: 'Repository name',
              },
              state: {
                type: 'string',
                enum: ['open', 'closed', 'all'],
                description: 'Pull request state filter',
                default: 'open',
              },
              per_page: {
                type: 'number',
                description: 'Results per page (max 100)',
                default: 30,
              },
            },
            required: ['owner', 'repo'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              pull_requests: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    number: { type: 'number' },
                    title: { type: 'string' },
                    state: { type: 'string' },
                    url: { type: 'string' },
                    created_at: { type: 'string' },
                  },
                },
              },
              count: { type: 'number' },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'pull_requests', 'count'],
          },
        },
        {
          name: 'get_file_contents',
          title: 'Get File Contents',
          description: 'Get the contents of a file in a repository',
          inputSchema: {
            type: 'object',
            properties: {
              owner: {
                type: 'string',
                description: 'Repository owner',
              },
              repo: {
                type: 'string',
                description: 'Repository name',
              },
              path: {
                type: 'string',
                description: 'File path in the repository',
              },
              ref: {
                type: 'string',
                description: 'Git ref (branch, tag, or commit SHA) - defaults to default branch',
              },
            },
            required: ['owner', 'repo', 'path'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              content: { type: 'string' },
              encoding: { type: 'string' },
              path: { type: 'string' },
              sha: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'content', 'path'],
          },
        },
        {
          name: 'search_code',
          title: 'Search Code',
          description: 'Search for code across GitHub repositories',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (e.g., "addClass in:file language:js repo:jquery/jquery")',
              },
              per_page: {
                type: 'number',
                description: 'Results per page (max 100)',
                default: 30,
              },
            },
            required: ['query'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    path: { type: 'string' },
                    repository: { type: 'string' },
                    url: { type: 'string' },
                  },
                },
              },
              total_count: { type: 'number' },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'results', 'total_count'],
          },
        },
      ];

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Ensure Octokit is initialized
        this.ensureOctokit();

        switch (name) {
          case 'list_repositories':
            return await this.handleListRepositories(args as any);
          case 'get_repository':
            return await this.handleGetRepository(args as { owner: string; repo: string });
          case 'list_issues':
            return await this.handleListIssues(args as any);
          case 'create_issue':
            return await this.handleCreateIssue(args as any);
          case 'list_pull_requests':
            return await this.handleListPullRequests(args as any);
          case 'get_file_contents':
            return await this.handleGetFileContents(args as any);
          case 'search_code':
            return await this.handleSearchCode(args as { query: string; per_page?: number });
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });

    // List resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'github://user',
            name: 'github_user',
            title: 'GitHub User Profile',
            description: 'Authenticated user profile information',
            mimeType: 'application/json',
            _meta: {
              category: 'profile',
              requiresAuth: true,
            },
          },
        ],
      };
    });

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;

      if (uri === 'github://user') {
        this.ensureOctokit();
        const { data: user } = await this.octokit!.rest.users.getAuthenticated();

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(user, null, 2),
              _meta: {
                username: user.login,
                createdAt: new Date().toISOString(),
              },
            },
          ],
        };
      }

      throw new Error(`Unknown resource: ${uri}`);
    });
  }

  private ensureOctokit() {
    if (!this.octokit) {
      // Get token from environment variable
      this.accessToken = process.env.GITHUB_TOKEN || process.env.GITHUB_ACCESS_TOKEN || null;

      if (!this.accessToken) {
        throw new Error(
          'GitHub access token not found. Set GITHUB_TOKEN or GITHUB_ACCESS_TOKEN environment variable.'
        );
      }

      this.octokit = new Octokit({
        auth: this.accessToken,
      });
    }
  }

  private async handleListRepositories(args: any) {
    const username = args.username;
    const type = args.type || 'all';
    const sort = args.sort || 'updated';
    const per_page = args.per_page || 30;

    let response;
    if (username) {
      response = await this.octokit!.rest.repos.listForUser({
        username,
        type,
        sort,
        per_page,
      });
    } else {
      response = await this.octokit!.rest.repos.listForAuthenticatedUser({
        type,
        sort,
        per_page,
      });
    }

    const repositories = response.data.map((repo) => ({
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description || '',
      url: repo.html_url,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
    }));

    const structured = {
      success: true,
      repositories,
      count: repositories.length,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: `Found ${repositories.length} repositories:\n${repositories
            .map((r) => `- ${r.full_name} (⭐ ${r.stars})`)
            .join('\n')}`,
        },
      ],
      structuredContent: structured,
    };
  }

  private async handleGetRepository(args: { owner: string; repo: string }) {
    const { data: repo } = await this.octokit!.rest.repos.get({
      owner: args.owner,
      repo: args.repo,
    });

    const repository = {
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description || '',
      url: repo.html_url,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language || 'Unknown',
      created_at: repo.created_at,
      updated_at: repo.updated_at,
    };

    const structured = {
      success: true,
      repository,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: `Repository: ${repository.full_name}\n${repository.description}\n⭐ ${repository.stars} | 🍴 ${repository.forks} | 💻 ${repository.language}`,
        },
      ],
      structuredContent: structured,
    };
  }

  private async handleListIssues(args: any) {
    const { data: issues } = await this.octokit!.rest.issues.listForRepo({
      owner: args.owner,
      repo: args.repo,
      state: args.state || 'open',
      per_page: args.per_page || 30,
    });

    const issueList = issues.map((issue) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      url: issue.html_url,
      created_at: issue.created_at,
    }));

    const structured = {
      success: true,
      issues: issueList,
      count: issueList.length,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: `Found ${issueList.length} issues:\n${issueList
            .map((i) => `#${i.number}: ${i.title} [${i.state}]`)
            .join('\n')}`,
        },
      ],
      structuredContent: structured,
    };
  }

  private async handleCreateIssue(args: any) {
    const { data: issue } = await this.octokit!.rest.issues.create({
      owner: args.owner,
      repo: args.repo,
      title: args.title,
      body: args.body,
      labels: args.labels,
    });

    const structured = {
      success: true,
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        state: issue.state,
      },
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: `Created issue #${issue.number}: ${issue.title}\n${issue.html_url}`,
        },
      ],
      structuredContent: structured,
    };
  }

  private async handleListPullRequests(args: any) {
    const { data: prs } = await this.octokit!.rest.pulls.list({
      owner: args.owner,
      repo: args.repo,
      state: args.state || 'open',
      per_page: args.per_page || 30,
    });

    const pull_requests = prs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      url: pr.html_url,
      created_at: pr.created_at,
    }));

    const structured = {
      success: true,
      pull_requests,
      count: pull_requests.length,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: `Found ${pull_requests.length} pull requests:\n${pull_requests
            .map((pr) => `#${pr.number}: ${pr.title} [${pr.state}]`)
            .join('\n')}`,
        },
      ],
      structuredContent: structured,
    };
  }

  private async handleGetFileContents(args: any) {
    const params: any = {
      owner: args.owner,
      repo: args.repo,
      path: args.path,
    };

    if (args.ref) {
      params.ref = args.ref;
    }

    const { data } = await this.octokit!.rest.repos.getContent(params);

    if ('content' in data) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');

      const structured = {
        success: true,
        content,
        encoding: data.encoding,
        path: data.path,
        sha: data.sha,
        timestamp: new Date().toISOString(),
      };

      return {
        content: [
          {
            type: 'text',
            text: `File: ${data.path}\n\n${content}`,
          },
        ],
        structuredContent: structured,
      };
    }

    throw new Error('Path is not a file');
  }

  private async handleSearchCode(args: { query: string; per_page?: number }) {
    const { data } = await this.octokit!.rest.search.code({
      q: args.query,
      per_page: args.per_page || 30,
    });

    const results = data.items.map((item) => ({
      name: item.name,
      path: item.path,
      repository: item.repository.full_name,
      url: item.html_url,
    }));

    const structured = {
      success: true,
      results,
      total_count: data.total_count,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: `Found ${data.total_count} results (showing ${results.length}):\n${results
            .map((r) => `- ${r.repository}/${r.path}`)
            .join('\n')}`,
        },
      ],
      structuredContent: structured,
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('GitHub MCP Server started');
  }
}

// Start the server
const server = new GitHubMCPServer();
server.start().catch((error) => {
  console.error('Failed to start GitHub MCP Server:', error);
  process.exit(1);
});
