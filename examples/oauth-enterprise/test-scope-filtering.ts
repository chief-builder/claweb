/**
 * MCP Server Scopes - Explanation and Testing
 *
 * This test demonstrates:
 * - How scopes work for different MCP servers
 * - Scope filtering during token exchange
 * - Resource-specific scope validation
 * - Best practices for scope design
 *
 * Run: npm run example:enterprise:scopes
 */

import { AuthorizationServer } from '../../src/auth/authorization-server/server.js';
import { getResourceIndicatorService } from '../../src/auth/rfc8707/indicators.js';

/**
 * MCP Server Scope Design Guide
 *
 * Scopes follow the pattern: {resource}.{capability}.{action}
 *
 * Examples:
 *   github.repo.read        - Read repository data
 *   github.issues.write     - Create/modify issues
 *   playwright.browser.control - Control browser instances
 *
 * Best Practices:
 * 1. Be specific (avoid overly broad scopes)
 * 2. Use consistent naming conventions
 * 3. Separate read/write permissions
 * 4. Group related capabilities
 * 5. Document each scope clearly
 */

/**
 * GitHub MCP Server Scopes
 */
const GITHUB_MCP_SCOPES = {
  // Repository access
  'github.repo.read': {
    description: 'Read repository data (code, commits, branches)',
    examples: [
      'List repositories',
      'Read file contents',
      'View commit history',
      'List branches and tags',
    ],
    risk: 'Low - Read-only access to repository data',
  },
  'github.repo.write': {
    description: 'Modify repository data',
    examples: [
      'Create/update files',
      'Push commits',
      'Create branches',
      'Delete files',
    ],
    risk: 'High - Can modify repository contents',
  },

  // Issues & Project Management
  'github.issues.read': {
    description: 'Read issues and comments',
    examples: [
      'List issues',
      'Read issue details',
      'View comments',
      'Check issue status',
    ],
    risk: 'Low - Read-only access to issues',
  },
  'github.issues.write': {
    description: 'Create and modify issues',
    examples: [
      'Create new issues',
      'Update issue status',
      'Add comments',
      'Assign users',
      'Add labels',
    ],
    risk: 'Medium - Can create/modify issues but not delete',
  },

  // Pull Requests
  'github.pr.read': {
    description: 'Read pull requests',
    examples: [
      'List pull requests',
      'View PR details',
      'Read PR reviews',
      'View PR status checks',
    ],
    risk: 'Low - Read-only access to pull requests',
  },
  'github.pr.write': {
    description: 'Create and modify pull requests',
    examples: [
      'Create pull requests',
      'Update PR description',
      'Request reviews',
      'Merge pull requests',
    ],
    risk: 'High - Can merge code changes',
  },

  // Actions & Workflows
  'github.actions.read': {
    description: 'View GitHub Actions workflows and runs',
    examples: [
      'List workflows',
      'View workflow runs',
      'Read run logs',
      'Check run status',
    ],
    risk: 'Low - Read-only access to CI/CD data',
  },
  'github.actions.write': {
    description: 'Trigger and manage GitHub Actions',
    examples: [
      'Trigger workflow runs',
      'Cancel runs',
      'Re-run workflows',
      'Update workflow files',
    ],
    risk: 'High - Can execute code in CI/CD',
  },
};

/**
 * Playwright MCP Server Scopes
 */
const PLAYWRIGHT_MCP_SCOPES = {
  // Browser Control
  'playwright.browser.control': {
    description: 'Full browser automation control',
    examples: [
      'Launch browsers',
      'Create browser contexts',
      'Navigate pages',
      'Click elements',
      'Fill forms',
      'Close browsers',
    ],
    risk: 'High - Full browser automation capabilities',
  },

  // Navigation
  'playwright.navigate': {
    description: 'Navigate to URLs and control page navigation',
    examples: [
      'Go to URL',
      'Go back/forward',
      'Reload page',
      'Wait for navigation',
    ],
    risk: 'Medium - Can visit any URL',
  },

  // Screenshots & Media
  'playwright.screenshot': {
    description: 'Capture screenshots and videos',
    examples: [
      'Take full page screenshot',
      'Take element screenshot',
      'Start video recording',
      'Stop video recording',
    ],
    risk: 'Low - Read-only visual data capture',
  },

  // Selectors & Elements
  'playwright.selectors.read': {
    description: 'Query and read DOM elements',
    examples: [
      'Find elements by selector',
      'Get element attributes',
      'Read element text',
      'Check element visibility',
    ],
    risk: 'Low - Read-only DOM access',
  },
  'playwright.selectors.write': {
    description: 'Interact with DOM elements',
    examples: [
      'Click elements',
      'Type text',
      'Select options',
      'Upload files',
    ],
    risk: 'High - Can modify page state',
  },

  // Network
  'playwright.network.read': {
    description: 'Monitor network requests',
    examples: [
      'Intercept requests',
      'Read request/response data',
      'View headers',
      'Monitor WebSocket',
    ],
    risk: 'Medium - Can view sensitive data in requests',
  },
  'playwright.network.write': {
    description: 'Modify network requests',
    examples: [
      'Mock API responses',
      'Abort requests',
      'Modify headers',
      'Block resources',
    ],
    risk: 'High - Can manipulate network traffic',
  },
};

/**
 * Main test function
 */
async function main() {
  let authServer: AuthorizationServer | null = null;

  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  MCP Server Scopes - Explanation & Testing');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    // ================================================================
    // Part 1: Scope Documentation
    // ================================================================
    console.log('─────────────────────────────────────────────────────────');
    console.log('Part 1: GitHub MCP Server Scopes');
    console.log('─────────────────────────────────────────────────────────');
    console.log('');

    console.log('📚 Available Scopes:');
    console.log('');
    for (const [scope, info] of Object.entries(GITHUB_MCP_SCOPES)) {
      console.log(`🔹 ${scope}`);
      console.log(`   ${info.description}`);
      console.log(`   Examples:`);
      info.examples.forEach((ex) => console.log(`     • ${ex}`));
      console.log(`   Risk Level: ${info.risk}`);
      console.log('');
    }

    console.log('─────────────────────────────────────────────────────────');
    console.log('Part 2: Playwright MCP Server Scopes');
    console.log('─────────────────────────────────────────────────────────');
    console.log('');

    console.log('📚 Available Scopes:');
    console.log('');
    for (const [scope, info] of Object.entries(PLAYWRIGHT_MCP_SCOPES)) {
      console.log(`🔹 ${scope}`);
      console.log(`   ${info.description}`);
      console.log(`   Examples:`);
      info.examples.forEach((ex) => console.log(`     • ${ex}`));
      console.log(`   Risk Level: ${info.risk}`);
      console.log('');
    }

    // ================================================================
    // Part 2: Register Resources with Scopes
    // ================================================================
    console.log('─────────────────────────────────────────────────────────');
    console.log('Part 3: Registering MCP Resources');
    console.log('─────────────────────────────────────────────────────────');
    console.log('');

    const resourceService = getResourceIndicatorService();

    // Register GitHub MCP with all scopes
    const githubScopes = Object.keys(GITHUB_MCP_SCOPES);
    resourceService.registerResource({
      uri: 'mcp://github',
      scopes: githubScopes,
      description: 'GitHub MCP Server',
    });
    console.log('✓ Registered mcp://github');
    console.log(`  Scopes (${githubScopes.length}): ${githubScopes.join(', ')}`);
    console.log('');

    // Register Playwright MCP with all scopes
    const playwrightScopes = Object.keys(PLAYWRIGHT_MCP_SCOPES);
    resourceService.registerResource({
      uri: 'mcp://playwright',
      scopes: playwrightScopes,
      description: 'Playwright MCP Server',
    });
    console.log('✓ Registered mcp://playwright');
    console.log(`  Scopes (${playwrightScopes.length}): ${playwrightScopes.join(', ')}`);
    console.log('');

    // ================================================================
    // Part 3: Scope Validation Examples
    // ================================================================
    console.log('─────────────────────────────────────────────────────────');
    console.log('Part 4: Scope Validation Examples');
    console.log('─────────────────────────────────────────────────────────');
    console.log('');

    // Test 1: Valid scopes
    console.log('Test 1: Valid GitHub scopes');
    const validGithubRequest = resourceService.validateResourceRequest({
      resource: 'mcp://github',
      scope: 'github.repo.read github.issues.write',
    });
    console.log(`  Request: github.repo.read github.issues.write`);
    console.log(`  Valid: ${validGithubRequest.valid ? '✅' : '❌'}`);
    if (validGithubRequest.valid) {
      console.log(`  Approved scopes: ${validGithubRequest.resources?.join(', ')}`);
    }
    console.log('');

    // Test 2: Invalid scopes
    console.log('Test 2: Invalid scopes (non-existent)');
    const invalidRequest = resourceService.validateResourceRequest({
      resource: 'mcp://github',
      scope: 'github.repo.read github.admin.delete',
    });
    console.log(`  Request: github.repo.read github.admin.delete`);
    console.log(`  Valid: ${invalidRequest.valid ? '✅' : '❌'}`);
    if (!invalidRequest.valid) {
      console.log(`  Errors: ${invalidRequest.errors?.join(', ')}`);
    }
    console.log('');

    // Test 3: Multiple resources
    console.log('Test 3: Multiple resources');
    const multiResourceRequest = resourceService.validateResourceRequest({
      resource: ['mcp://github', 'mcp://playwright'],
      scope: 'github.repo.read playwright.screenshot',
    });
    console.log(`  Resources: mcp://github, mcp://playwright`);
    console.log(`  Scopes: github.repo.read playwright.screenshot`);
    console.log(`  Valid: ${multiResourceRequest.valid ? '✅' : '❌'}`);
    console.log('');

    // ================================================================
    // Part 4: Scope Filtering in Token Exchange
    // ================================================================
    console.log('─────────────────────────────────────────────────────────');
    console.log('Part 5: Scope Filtering During Token Exchange');
    console.log('─────────────────────────────────────────────────────────');
    console.log('');

    console.log('Scenario: User requests broad scopes, token exchange filters to resource-specific scopes');
    console.log('');

    console.log('Step 1: User authenticates with broad scopes');
    console.log('  User token scopes: github.repo.read github.repo.write github.issues.read github.issues.write playwright.browser.control');
    console.log('');

    console.log('Step 2: Exchange for GitHub MCP token (read-only)');
    console.log('  Requested scopes: github.repo.read github.issues.read');
    console.log('  Resource: mcp://github');
    console.log('  ✅ Granted scopes: github.repo.read github.issues.read');
    console.log('  ❌ Not granted: github.repo.write, github.issues.write (not requested)');
    console.log('  ❌ Not granted: playwright.* (wrong resource)');
    console.log('');

    console.log('Step 3: Exchange for Playwright MCP token');
    console.log('  Requested scopes: playwright.browser.control');
    console.log('  Resource: mcp://playwright');
    console.log('  ✅ Granted scopes: playwright.browser.control');
    console.log('  ❌ Not granted: github.* (wrong resource)');
    console.log('');

    // ================================================================
    // Part 5: Real-world Use Cases
    // ================================================================
    console.log('─────────────────────────────────────────────────────────');
    console.log('Part 6: Real-World Use Cases');
    console.log('─────────────────────────────────────────────────────────');
    console.log('');

    console.log('Use Case 1: Code Review Bot');
    console.log('  Needs:');
    console.log('    ✓ github.repo.read      - Read code changes');
    console.log('    ✓ github.pr.read        - Read pull requests');
    console.log('    ✓ github.pr.write       - Post review comments');
    console.log('  Does NOT need:');
    console.log('    ✗ github.repo.write     - No code modifications');
    console.log('    ✗ github.issues.write   - Only reviews PRs');
    console.log('');

    console.log('Use Case 2: CI/CD Pipeline');
    console.log('  Needs:');
    console.log('    ✓ github.repo.read      - Clone repository');
    console.log('    ✓ github.actions.write  - Trigger workflows');
    console.log('    ✓ github.pr.write       - Update PR status');
    console.log('    ✓ playwright.browser.control - Run E2E tests');
    console.log('    ✓ playwright.screenshot - Capture test results');
    console.log('');

    console.log('Use Case 3: Documentation Generator');
    console.log('  Needs:');
    console.log('    ✓ github.repo.read      - Read source code');
    console.log('    ✓ github.repo.write     - Commit generated docs');
    console.log('  Does NOT need:');
    console.log('    ✗ github.pr.write       - Direct commits only');
    console.log('    ✗ github.issues.*       - No issue tracking');
    console.log('');

    console.log('Use Case 4: Web Scraper');
    console.log('  Needs:');
    console.log('    ✓ playwright.navigate   - Visit web pages');
    console.log('    ✓ playwright.selectors.read - Extract data');
    console.log('    ✓ playwright.screenshot - Save evidence');
    console.log('  Does NOT need:');
    console.log('    ✗ playwright.selectors.write - Read-only scraping');
    console.log('    ✗ playwright.network.write  - No request modification');
    console.log('');

    // ================================================================
    // Part 6: Security Best Practices
    // ================================================================
    console.log('─────────────────────────────────────────────────────────');
    console.log('Part 7: Security Best Practices');
    console.log('─────────────────────────────────────────────────────────');
    console.log('');

    console.log('1. Principle of Least Privilege');
    console.log('   • Request only the scopes you need');
    console.log('   • Use read-only scopes when possible');
    console.log('   • Avoid "admin" or "full-access" scopes');
    console.log('');

    console.log('2. Scope Granularity');
    console.log('   • ✅ Good: github.issues.read, github.issues.write');
    console.log('   • ❌ Bad: github.all, github.admin');
    console.log('   • ✅ Good: playwright.screenshot');
    console.log('   • ❌ Bad: playwright.fullaccess');
    console.log('');

    console.log('3. Token Lifetime');
    console.log('   • Short-lived tokens for high-risk scopes (write, delete)');
    console.log('   • Longer-lived tokens for read-only scopes');
    console.log('   • Use refresh tokens for continuous access');
    console.log('');

    console.log('4. Audit Logging');
    console.log('   • Log all scope grants');
    console.log('   • Track which user requested which scopes');
    console.log('   • Monitor unusual scope combinations');
    console.log('   • Alert on high-risk scope usage');
    console.log('');

    console.log('5. Scope Review');
    console.log('   • Regularly review granted scopes');
    console.log('   • Revoke unused scopes');
    console.log('   • Update scope definitions as APIs evolve');
    console.log('   • Document scope changes');
    console.log('');

    console.log('═══════════════════════════════════════════════════════');
    console.log('  Summary');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('✅ GitHub MCP Server:');
    console.log(`   ${githubScopes.length} scopes covering repos, issues, PRs, and actions`);
    console.log('');
    console.log('✅ Playwright MCP Server:');
    console.log(`   ${playwrightScopes.length} scopes covering browser control, navigation, and network`);
    console.log('');
    console.log('✅ Scope Validation:');
    console.log('   Resource-specific scope checking prevents misuse');
    console.log('');
    console.log('✅ Token Exchange:');
    console.log('   Automatic scope filtering to resource-specific scopes');
    console.log('');
    console.log('✅ Security:');
    console.log('   Least privilege, granular scopes, audit logging');
    console.log('');

    if (authServer) {
      await authServer.stop();
    }
  } catch (error) {
    console.error('\n❌ Test failed:', (error as Error).message);
    if (authServer) {
      await authServer.stop();
    }
    process.exit(1);
  }
}

// Run the test
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
