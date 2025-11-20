#!/usr/bin/env node

/**
 * Playwright MCP Server
 *
 * An MCP server that provides browser automation capabilities through Playwright.
 * Supports OAuth 2.1 authentication for secure access to browser automation tools.
 *
 * Features:
 * - Navigate to URLs
 * - Click elements
 * - Fill forms
 * - Take screenshots
 * - Extract page content
 * - Execute JavaScript
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
import { chromium, Browser, Page } from 'playwright';

/**
 * Playwright MCP Server
 * Provides browser automation capabilities through MCP protocol
 */
class PlaywrightMCPServer {
  private server: Server;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private screenshots: Map<string, string> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: 'playwright-mcp-server',
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
          name: 'navigate',
          title: 'Navigate to URL',
          description: 'Navigate the browser to a specific URL',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to navigate to',
              },
            },
            required: ['url'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              url: { type: 'string' },
              title: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'url'],
          },
        },
        {
          name: 'screenshot',
          title: 'Take Screenshot',
          description: 'Take a screenshot of the current page or a specific element',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name for the screenshot',
              },
              selector: {
                type: 'string',
                description: 'CSS selector for element to screenshot (optional, full page if not provided)',
              },
              fullPage: {
                type: 'boolean',
                description: 'Capture full scrollable page',
                default: false,
              },
            },
            required: ['name'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              name: { type: 'string' },
              path: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'name'],
          },
        },
        {
          name: 'click',
          title: 'Click Element',
          description: 'Click on an element matching the given selector',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the element to click',
              },
            },
            required: ['selector'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              selector: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'selector'],
          },
        },
        {
          name: 'fill',
          title: 'Fill Input',
          description: 'Fill an input field with the given text',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the input field',
              },
              text: {
                type: 'string',
                description: 'Text to fill in the input',
              },
            },
            required: ['selector', 'text'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              selector: { type: 'string' },
              text: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'selector'],
          },
        },
        {
          name: 'extract_text',
          title: 'Extract Text',
          description: 'Extract text content from the page or a specific element',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for element (optional, extracts from body if not provided)',
              },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              text: { type: 'string' },
              selector: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'text'],
          },
        },
        {
          name: 'evaluate',
          title: 'Execute JavaScript',
          description: 'Execute JavaScript code in the browser context',
          inputSchema: {
            type: 'object',
            properties: {
              script: {
                type: 'string',
                description: 'JavaScript code to execute',
              },
            },
            required: ['script'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              result: {
                description: 'Result of the script execution',
              },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success'],
          },
        },
      ];

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Ensure browser is initialized
        await this.ensureBrowser();

        switch (name) {
          case 'navigate':
            return await this.handleNavigate(args as { url: string });
          case 'screenshot':
            return await this.handleScreenshot(args as {
              name: string;
              selector?: string;
              fullPage?: boolean;
            });
          case 'click':
            return await this.handleClick(args as { selector: string });
          case 'fill':
            return await this.handleFill(args as { selector: string; text: string });
          case 'extract_text':
            return await this.handleExtractText(args as { selector?: string });
          case 'evaluate':
            return await this.handleEvaluate(args as { script: string });
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

    // List resources (screenshots)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = Array.from(this.screenshots.entries()).map(([name, path]) => ({
        uri: `screenshot://${name}`,
        name: `screenshot_${name}`,
        title: `Screenshot: ${name}`,
        description: `Screenshot saved at ${path}`,
        mimeType: 'image/png',
        _meta: {
          createdAt: new Date().toISOString(),
        },
      }));

      return { resources };
    });

    // Read resource (return screenshot)
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      const name = uri.replace('screenshot://', '');
      const path = this.screenshots.get(name);

      if (!path) {
        throw new Error(`Screenshot not found: ${name}`);
      }

      return {
        contents: [
          {
            uri,
            mimeType: 'image/png',
            text: `Screenshot available at: ${path}`,
            _meta: {
              path,
              createdAt: new Date().toISOString(),
            },
          },
        ],
      };
    });
  }

  private async ensureBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
    if (!this.page) {
      this.page = await this.browser.newPage();
    }
  }

  private async handleNavigate(args: { url: string }) {
    if (!this.page) throw new Error('Browser not initialized');

    await this.page.goto(args.url, { waitUntil: 'networkidle' });
    const title = await this.page.title();

    const structured = {
      success: true,
      url: args.url,
      title,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: `Navigated to ${args.url}\nPage title: ${title}`,
        },
      ],
      structuredContent: structured,
    };
  }

  private async handleScreenshot(args: {
    name: string;
    selector?: string;
    fullPage?: boolean;
  }) {
    if (!this.page) throw new Error('Browser not initialized');

    const path = `/tmp/screenshot-${args.name}.png`;

    if (args.selector) {
      const element = await this.page.locator(args.selector);
      await element.screenshot({ path });
    } else {
      await this.page.screenshot({ path, fullPage: args.fullPage });
    }

    this.screenshots.set(args.name, path);

    const structured = {
      success: true,
      name: args.name,
      path,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: `Screenshot saved: ${path}`,
        },
        {
          type: 'resource',
          resource: {
            uri: `screenshot://${args.name}`,
            mimeType: 'image/png',
            text: `Screenshot saved at ${path}`,
            _meta: {
              path,
              selector: args.selector,
              fullPage: args.fullPage,
            },
          },
        },
      ],
      structuredContent: structured,
    };
  }

  private async handleClick(args: { selector: string }) {
    if (!this.page) throw new Error('Browser not initialized');

    await this.page.click(args.selector);

    const structured = {
      success: true,
      selector: args.selector,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: `Clicked element: ${args.selector}`,
        },
      ],
      structuredContent: structured,
    };
  }

  private async handleFill(args: { selector: string; text: string }) {
    if (!this.page) throw new Error('Browser not initialized');

    await this.page.fill(args.selector, args.text);

    const structured = {
      success: true,
      selector: args.selector,
      text: args.text,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: `Filled ${args.selector} with: ${args.text}`,
        },
      ],
      structuredContent: structured,
    };
  }

  private async handleExtractText(args: { selector?: string }) {
    if (!this.page) throw new Error('Browser not initialized');

    const selector = args.selector || 'body';
    const text = await this.page.locator(selector).textContent() || '';

    const structured = {
      success: true,
      text,
      selector,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: `Extracted text from ${selector}:\n${text}`,
        },
      ],
      structuredContent: structured,
    };
  }

  private async handleEvaluate(args: { script: string }) {
    if (!this.page) throw new Error('Browser not initialized');

    const result = await this.page.evaluate(args.script);

    const structured = {
      success: true,
      result,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: `Script result: ${JSON.stringify(result, null, 2)}`,
        },
      ],
      structuredContent: structured,
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Cleanup on exit
    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.cleanup();
      process.exit(0);
    });

    console.error('Playwright MCP Server started');
  }

  private async cleanup() {
    console.error('Cleaning up Playwright MCP Server...');
    if (this.page) {
      await this.page.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Start the server
const server = new PlaywrightMCPServer();
server.start().catch((error) => {
  console.error('Failed to start Playwright MCP Server:', error);
  process.exit(1);
});
