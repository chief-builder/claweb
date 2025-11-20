# MCP Governance Architecture

**Status:** 📋 Design Document (Not Yet Implemented)
**Version:** 1.0
**Last Updated:** November 20, 2025

---

## Executive Summary

This document defines a comprehensive governance architecture for managing heterogeneous MCP (Model Context Protocol) server infrastructure. As organizations adopt MCP, they will inevitably operate a mix of:

- **In-house MCP servers** (custom business logic, proprietary APIs)
- **Third-party MCP servers** (GitHub, Slack, databases, cloud providers)
- **Vendor-provided MCP servers** (SaaS integrations, enterprise tools)

Without a unified governance layer, organizations face:
- ❌ **Security gaps**: Inconsistent authentication and authorization
- ❌ **Compliance risks**: No audit trail, data classification ignored
- ❌ **Operational chaos**: No rate limiting, health monitoring, or service discovery
- ❌ **Integration complexity**: Each server requires custom integration code

This architecture provides a **centralized governance layer** that enforces consistent policies across all MCP servers regardless of their origin.

---

## Current Implementation

### What We Have (Phase 1)

```
src/mcp-servers/
├── playwright-server.ts     # Custom browser automation server
└── github-server.ts          # Custom GitHub API server (using Octokit)

src/agent/
└── oauth-intelligent-agent.ts  # Multi-server agent with OAuth

src/web-chat/
└── server.ts                 # Web UI for chat interactions
```

**Characteristics:**
- ✅ Custom-built MCP servers
- ✅ OAuth 2.1 authentication per server
- ✅ MCP 2025-06-18 compliance
- ❌ No centralized governance
- ❌ No third-party server integration
- ❌ No unified policy enforcement
- ❌ No audit logging

---

## Proposed Architecture (Phase 2+)

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
│  (Web Chat, CLI, API Clients, IDE Extensions, etc.)        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ All requests go through gateway
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP GATEWAY LAYER                         │
│                 (Centralized Governance)                     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              1. Server Registry                         │ │
│  │  • Catalog of all MCP servers                          │ │
│  │  • Metadata: type, vendor, version, capabilities       │ │
│  │  • Health status and monitoring                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              2. Authentication Manager                  │ │
│  │  • OAuth token management (all servers)                │ │
│  │  • Credential injection for third-party servers        │ │
│  │  • Token refresh and validation                        │ │
│  │  • Scope verification                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              3. Policy Engine                           │ │
│  │  • RBAC/ABAC evaluation                                │ │
│  │  • Rate limiting per user/server                       │ │
│  │  • Data classification enforcement                     │ │
│  │  • Compliance checks (GDPR, SOC2, etc.)               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              4. Namespace Manager                       │ │
│  │  • Tool name conflict resolution                       │ │
│  │  • Server preference policies                          │ │
│  │  • Version management                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              5. Audit Logger                            │ │
│  │  • All MCP interactions logged                         │ │
│  │  • PII/sensitive data detection                        │ │
│  │  • Compliance reporting                                │ │
│  │  • Security event monitoring                           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              6. Router & Load Balancer                  │ │
│  │  • Request routing to correct server                   │ │
│  │  • Load balancing (multiple instances)                 │ │
│  │  • Circuit breaker pattern                             │ │
│  │  • Failover and retry logic                            │ │
│  └────────────────────────────────────────────────────────┘ │
└───┬──────────┬──────────┬──────────┬──────────┬────────────┘
    │          │          │          │          │
    ▼          ▼          ▼          ▼          ▼
┌─────────┬─────────┬─────────┬─────────┬──────────────────┐
│ Custom  │ Custom  │ Official│ Third   │ More servers...  │
│ GitHub  │Playwright│ GitHub │  Party  │                  │
│  (ours) │  (ours) │  Server │  Slack  │                  │
└─────────┴─────────┴─────────┴─────────┴──────────────────┘
```

---

## Component Specifications

### 1. Server Registry

**Purpose:** Central catalog of all MCP servers with metadata

**File:** `src/governance/server-registry.ts`

#### Data Model

```typescript
interface MCPServerMetadata {
  // Identity
  id: string;                    // Unique server identifier
  name: string;                  // Display name
  description: string;           // Human-readable description
  type: 'in-house' | 'third-party' | 'vendor';
  vendor?: string;               // e.g., "modelcontextprotocol", "anthropic"
  version: string;               // Semantic version

  // Connection
  connection: {
    type: 'stdio' | 'http' | 'sse';
    command?: string;            // For stdio: e.g., "node"
    args?: string[];             // For stdio: e.g., ["server.js"]
    url?: string;                // For http/sse
    env?: Record<string, string>; // Environment variables
  };

  // Authentication & Authorization
  authentication: {
    required: boolean;
    type: 'oauth' | 'api-key' | 'bearer' | 'none';
    scopes?: string[];           // OAuth scopes required
    credentialSource?: string;   // Where to get credentials
    tokenEndpoint?: string;      // OAuth token endpoint
  };

  // Governance Policies
  policies: {
    // Access Control
    allowedUsers?: string[];     // Whitelist of user IDs
    allowedRoles?: string[];     // Required roles (RBAC)
    deniedUsers?: string[];      // Blacklist

    // Rate Limiting
    rateLimit?: {
      requests: number;          // Max requests
      window: string;            // Time window: "1m", "1h", "1d"
      per: 'user' | 'server' | 'global';
    };

    // Data Classification
    dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';

    // Compliance
    piiHandling: 'allowed' | 'restricted' | 'forbidden';
    dataResidency?: string[];    // Allowed regions: ["us", "eu"]
    retentionPeriod?: string;    // How long to keep logs

    // Audit
    auditLevel: 'none' | 'basic' | 'detailed' | 'full';
    logInputs: boolean;          // Log tool inputs
    logOutputs: boolean;         // Log tool outputs
    sensitiveFields?: string[];  // Fields to redact in logs
  };

  // Capabilities (discovered or declared)
  capabilities: {
    tools: ToolMetadata[];
    resources: ResourceMetadata[];
    prompts?: PromptMetadata[];
  };

  // Health & Monitoring
  health: {
    checkEndpoint?: string;      // Custom health check
    checkInterval: number;       // Seconds between checks
    timeout: number;             // Request timeout
    unhealthyThreshold: number;  // Failures before marked unhealthy
    healthyThreshold: number;    // Successes before marked healthy
  };

  // Operational
  status: 'active' | 'inactive' | 'deprecated' | 'maintenance';
  tags: string[];                // For filtering/grouping
  owner: string;                 // Team/person responsible
  documentation?: string;        // URL to docs
  sla?: {
    availability: number;        // e.g., 99.9
    responseTime: number;        // Max ms
  };
}

interface ToolMetadata {
  name: string;
  title: string;
  description: string;
  inputSchema: any;
  outputSchema?: any;

  // Tool-specific policies
  policies?: {
    rateLimit?: { requests: number; window: string };
    requiresApproval?: boolean;  // Human-in-the-loop
    sensitiveOperation?: boolean;
  };
}
```

#### API

```typescript
class MCPServerRegistry {
  // Registration
  async registerServer(metadata: MCPServerMetadata): Promise<void>;
  async updateServer(id: string, updates: Partial<MCPServerMetadata>): Promise<void>;
  async deregisterServer(id: string): Promise<void>;

  // Discovery
  async getServer(id: string): Promise<MCPServerMetadata>;
  async listServers(filters?: ServerFilters): Promise<MCPServerMetadata[]>;
  async searchTools(query: string): Promise<ToolSearchResult[]>;

  // Health
  async getHealthStatus(id: string): Promise<HealthStatus>;
  async setHealthStatus(id: string, status: HealthStatus): Promise<void>;

  // Capabilities
  async discoverCapabilities(id: string): Promise<Capabilities>;
  async validateCapabilities(id: string): Promise<ValidationResult>;
}
```

#### Configuration Format

**YAML** (`config/mcp-servers.yaml`):

```yaml
servers:
  # In-house custom server
  - id: github-custom
    name: "Custom GitHub Server"
    description: "In-house GitHub MCP server with custom features"
    type: in-house
    version: "1.0.0"

    connection:
      type: stdio
      command: node
      args: [dist/mcp-servers/github-server.js]
      env:
        NODE_ENV: production

    authentication:
      required: true
      type: oauth
      scopes: [repo, user]
      credentialSource: GITHUB_TOKEN

    policies:
      allowedRoles: [developer, admin]
      rateLimit:
        requests: 1000
        window: 1h
        per: user
      dataClassification: confidential
      piiHandling: restricted
      auditLevel: detailed
      logInputs: true
      logOutputs: true
      sensitiveFields: [token, password]

    health:
      checkInterval: 60
      timeout: 5000
      unhealthyThreshold: 3
      healthyThreshold: 2

    status: active
    tags: [github, git, vcs]
    owner: platform-team

  # Third-party official server
  - id: github-official
    name: "Official GitHub MCP Server"
    description: "ModelContextProtocol official GitHub server"
    type: third-party
    vendor: modelcontextprotocol
    version: "1.2.0"

    connection:
      type: stdio
      command: npx
      args: [-y, "@modelcontextprotocol/server-github"]
      env:
        GITHUB_PERSONAL_ACCESS_TOKEN: ${GITHUB_TOKEN}

    authentication:
      required: true
      type: oauth
      scopes: [repo, user, read:org]
      credentialSource: GITHUB_TOKEN

    policies:
      allowedRoles: [developer, admin, viewer]
      rateLimit:
        requests: 5000
        window: 1h
        per: user
      dataClassification: confidential
      piiHandling: restricted
      auditLevel: basic
      logInputs: false
      logOutputs: false

    health:
      checkInterval: 120
      timeout: 10000
      unhealthyThreshold: 5
      healthyThreshold: 2

    status: active
    tags: [github, official, third-party]
    owner: platform-team
    documentation: https://github.com/modelcontextprotocol/servers

  # Custom internal server
  - id: playwright
    name: "Playwright Browser Automation"
    type: in-house
    version: "1.0.0"

    connection:
      type: stdio
      command: node
      args: [dist/mcp-servers/playwright-server.js]

    authentication:
      required: false
      type: none

    policies:
      allowedRoles: [developer, qa, admin]
      rateLimit:
        requests: 100
        window: 1h
        per: user
      dataClassification: internal
      piiHandling: allowed
      auditLevel: basic
      logInputs: true
      logOutputs: false

    health:
      checkInterval: 300
      timeout: 30000
      unhealthyThreshold: 2
      healthyThreshold: 1

    status: active
    tags: [browser, automation, testing]
    owner: qa-team
```

---

### 2. Authentication Manager

**Purpose:** Unified OAuth and credential management across all servers

**File:** `src/governance/auth-manager.ts`

#### Responsibilities

1. **Token Storage**: Securely store OAuth tokens per user per server
2. **Token Refresh**: Automatically refresh expired tokens
3. **Credential Injection**: Inject credentials into server environments
4. **Scope Validation**: Verify tokens have required scopes
5. **Token Revocation**: Handle token revocation

#### API

```typescript
interface TokenSet {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  expires_at: number;
}

interface CredentialConfig {
  serverId: string;
  userId: string;
  authType: 'oauth' | 'api-key' | 'bearer';
  scopes?: string[];
}

class UnifiedAuthManager {
  /**
   * Get a valid token for a user-server combination
   * Automatically refreshes if expired
   */
  async getTokenForServer(
    serverId: string,
    userId: string,
    requiredScopes: string[]
  ): Promise<TokenSet>;

  /**
   * Store a new token set
   */
  async storeToken(
    serverId: string,
    userId: string,
    tokenSet: TokenSet
  ): Promise<void>;

  /**
   * Refresh an expired token
   */
  async refreshToken(
    serverId: string,
    userId: string,
    refreshToken: string
  ): Promise<TokenSet>;

  /**
   * Validate that a token has required scopes
   */
  async validateScopes(
    token: TokenSet,
    requiredScopes: string[]
  ): Promise<boolean>;

  /**
   * Inject credentials into server environment
   * Used for third-party servers that read from env vars
   */
  async injectCredentials(
    serverId: string,
    userId: string
  ): Promise<Record<string, string>>;

  /**
   * Revoke a token
   */
  async revokeToken(
    serverId: string,
    userId: string
  ): Promise<void>;

  /**
   * Check if user has valid credentials for a server
   */
  async hasValidCredentials(
    serverId: string,
    userId: string
  ): Promise<boolean>;
}
```

#### Token Storage

**Options:**

1. **In-Memory** (development only)
2. **Encrypted File System**
3. **Database** (PostgreSQL, MongoDB)
4. **Secret Manager** (AWS Secrets Manager, HashiCorp Vault)

**Schema:**

```typescript
interface StoredToken {
  id: string;
  serverId: string;
  userId: string;
  tokenSet: TokenSet;
  createdAt: string;
  updatedAt: string;
  lastUsed: string;
}
```

---

### 3. Policy Engine

**Purpose:** Evaluate and enforce access policies

**File:** `src/governance/policy-engine.ts`

#### Policy Types

1. **RBAC** (Role-Based Access Control)
2. **ABAC** (Attribute-Based Access Control)
3. **Rate Limiting**
4. **Data Classification**
5. **Compliance** (GDPR, SOC2, HIPAA, etc.)

#### API

```typescript
interface PolicyContext {
  userId: string;
  userRoles: string[];
  userAttributes?: Record<string, any>;
  serverId: string;
  toolName: string;
  input: any;
  timestamp: string;
  sourceIp?: string;
  userAgent?: string;
}

interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  modifications?: {
    rateLimit?: number;
    timeout?: number;
    requiresApproval?: boolean;
    auditRequired?: boolean;
    redactFields?: string[];
  };
  warnings?: string[];
}

class PolicyEngine {
  /**
   * Main policy evaluation entry point
   */
  async evaluateAccess(context: PolicyContext): Promise<PolicyDecision>;

  /**
   * Check RBAC policies
   */
  async evaluateRBAC(
    userId: string,
    roles: string[],
    serverId: string,
    toolName: string
  ): Promise<boolean>;

  /**
   * Check ABAC policies (attribute-based)
   */
  async evaluateABAC(
    context: PolicyContext,
    policy: ABACPolicy
  ): Promise<boolean>;

  /**
   * Enforce rate limits
   */
  async enforceRateLimit(
    userId: string,
    serverId: string,
    limit: RateLimit
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }>;

  /**
   * Check compliance requirements
   */
  async checkCompliance(
    serverId: string,
    toolName: string,
    input: any,
    dataClassification: string
  ): Promise<{ compliant: boolean; violations: string[] }>;

  /**
   * Detect PII in input/output
   */
  async detectPII(data: any): Promise<{
    hasPII: boolean;
    fields: string[];
    types: string[];
  }>;
}
```

#### Policy Language

Use **Rego** (from Open Policy Agent) or **Cedar** (AWS) for policy definitions:

```rego
# Example Rego policy
package mcp.authorization

# Allow developers to use GitHub tools
allow {
    input.user.roles[_] == "developer"
    startswith(input.tool, "github__")
}

# Allow QA to use Playwright tools
allow {
    input.user.roles[_] == "qa"
    startswith(input.tool, "playwright__")
}

# Admin can do anything
allow {
    input.user.roles[_] == "admin"
}

# Rate limit: max 1000 requests per hour per user
rate_limit = 1000 {
    input.server.policies.rateLimit.requests
}
```

---

### 4. Namespace Manager

**Purpose:** Resolve tool name conflicts when multiple servers provide the same tool

**File:** `src/governance/namespace-manager.ts`

#### Problem

Both our custom GitHub server and the official GitHub server have:
- `list_repositories`
- `get_repository`
- `list_issues`
- etc.

How do we handle this?

#### Solutions

##### Option 1: Prefix with Server ID

```
github_custom__list_repositories
github_official__list_repositories
```

**Pros:** Simple, explicit
**Cons:** Verbose, breaks existing code

##### Option 2: Version-based

```
list_repositories@v1
list_repositories@v2
```

**Pros:** Semantic versioning
**Cons:** Requires version management

##### Option 3: Priority/Preference

```
User requests: list_repositories
Gateway checks preference:
  - User preference: github_official
  - Fallback: github_custom
```

**Pros:** Transparent to user
**Cons:** Need to manage preferences

##### Option 4: Capability-based

```
User requests: list_repositories[scopes=repo,user]
Gateway matches to server with those capabilities
```

**Pros:** Intelligent routing
**Cons:** Complex matching logic

#### Recommended: Hybrid Approach

```typescript
interface ToolNamespace {
  toolName: string;          // e.g., "list_repositories"
  servers: ServerToolMap[];  // Which servers provide it
  defaultServer?: string;    // Default if no preference
  userPreferences: Map<string, string>; // User-specific preferences
}

interface ServerToolMap {
  serverId: string;
  actualToolName: string;    // May differ from canonical name
  version?: string;
  capabilities?: string[];
}

class ToolNamespaceManager {
  /**
   * Resolve a tool name to a specific server
   */
  async resolveToolName(
    toolName: string,
    userId: string,
    context?: ResolutionContext
  ): Promise<{ serverId: string; actualToolName: string }>;

  /**
   * Register tools from a server
   */
  async registerTools(
    serverId: string,
    tools: Tool[]
  ): Promise<void>;

  /**
   * Set user preference for a tool
   */
  async setUserPreference(
    userId: string,
    toolName: string,
    preferredServer: string
  ): Promise<void>;

  /**
   * Detect conflicts (multiple servers, same tool)
   */
  async detectConflicts(): Promise<ToolConflict[]>;

  /**
   * Get all available tools (across all servers)
   */
  async listAllTools(userId: string): Promise<ToolCatalog>;
}
```

---

### 5. Audit Logger

**Purpose:** Comprehensive audit trail for compliance and security

**File:** `src/governance/audit-logger.ts`

#### What to Log

1. **Tool Calls**
   - Who, what, when, where
   - Input parameters (with PII redaction)
   - Output (with PII redaction)
   - Success/failure
   - Duration

2. **Authentication Events**
   - Login/logout
   - Token refresh
   - Token revocation
   - Failed authentication

3. **Policy Decisions**
   - Access granted/denied
   - Rate limit hit
   - Compliance violations

4. **System Events**
   - Server registration/deregistration
   - Health status changes
   - Configuration changes

#### Data Model

```typescript
interface AuditEvent {
  // Identity
  id: string;
  timestamp: string;
  type: 'tool_call' | 'auth' | 'policy' | 'system';

  // Actor
  userId: string;
  userRoles?: string[];
  sourceIp?: string;
  userAgent?: string;

  // Target
  serverId: string;
  serverType: 'in-house' | 'third-party';
  toolName?: string;
  resourceUri?: string;

  // Action
  action: string;
  input?: any;              // Redacted if contains PII
  output?: any;             // Redacted if contains PII
  error?: string;
  duration?: number;        // milliseconds

  // Policy
  policyDecision?: PolicyDecision;
  scopesUsed?: string[];

  // Classification
  dataClassification: string;
  sensitiveDataAccessed: boolean;
  piiIncluded: boolean;
  piiFields?: string[];

  // Compliance
  complianceFlags?: string[];  // e.g., ["GDPR", "SOC2"]
  retentionRequired: boolean;

  // Metadata
  traceId?: string;         // For distributed tracing
  sessionId?: string;
  correlationId?: string;
}
```

#### API

```typescript
class AuditLogger {
  /**
   * Log a tool call
   */
  async logToolCall(event: ToolCallEvent): Promise<void>;

  /**
   * Log an authentication event
   */
  async logAuthEvent(event: AuthEvent): Promise<void>;

  /**
   * Log a policy decision
   */
  async logPolicyDecision(event: PolicyEvent): Promise<void>;

  /**
   * Log a security event
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void>;

  /**
   * Query audit log
   */
  async queryAuditLog(filters: AuditFilters): Promise<AuditEvent[]>;

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    startDate: string,
    endDate: string,
    format: 'json' | 'csv' | 'pdf'
  ): Promise<ComplianceReport>;

  /**
   * Export audit logs
   */
  async exportLogs(
    filters: AuditFilters,
    destination: 'file' | 's3' | 'elasticsearch'
  ): Promise<void>;
}
```

#### Storage Options

1. **Time-series Database** (InfluxDB, TimescaleDB)
2. **Elasticsearch** (for search/analytics)
3. **S3** (for long-term retention)
4. **SIEM Integration** (Splunk, DataDog, etc.)

---

### 6. MCP Gateway Router

**Purpose:** Main entry point that orchestrates all governance components

**File:** `src/governance/mcp-gateway.ts`

#### Request Flow

```
1. Client Request
   ↓
2. Gateway receives request
   ↓
3. Authenticate user
   ↓
4. Resolve tool name → server
   ↓
5. Check policy (RBAC, rate limit, etc.)
   ↓
6. Get/validate credentials for server
   ↓
7. Route to server
   ↓
8. Execute tool
   ↓
9. Audit log
   ↓
10. Return response to client
```

#### API

```typescript
interface GatewayRequest {
  userId: string;
  toolName: string;
  input: any;
  context?: RequestContext;
}

interface GatewayResponse {
  success: boolean;
  result?: any;
  error?: string;
  metadata?: {
    serverId: string;
    duration: number;
    cached?: boolean;
  };
}

class MCPGateway {
  private registry: MCPServerRegistry;
  private authManager: UnifiedAuthManager;
  private policyEngine: PolicyEngine;
  private namespaceManager: ToolNamespaceManager;
  private auditLogger: AuditLogger;
  private serverConnections: Map<string, MCPClient>;
  private circuitBreakers: Map<string, CircuitBreaker>;

  /**
   * Main entry point for all MCP interactions
   */
  async callTool(request: GatewayRequest): Promise<GatewayResponse> {
    const startTime = Date.now();
    let serverId: string | undefined;
    let error: Error | undefined;

    try {
      // 1. Resolve tool to server
      const resolution = await this.namespaceManager.resolveToolName(
        request.toolName,
        request.userId,
        request.context
      );
      serverId = resolution.serverId;
      const actualToolName = resolution.actualToolName;

      // 2. Get server metadata
      const serverMeta = await this.registry.getServer(serverId);

      // 3. Check if server is healthy
      const health = await this.registry.getHealthStatus(serverId);
      if (health.status !== 'healthy') {
        throw new Error(`Server ${serverId} is unhealthy: ${health.message}`);
      }

      // 4. Evaluate policy
      const policyContext: PolicyContext = {
        userId: request.userId,
        userRoles: await this.getUserRoles(request.userId),
        serverId,
        toolName: actualToolName,
        input: request.input,
        timestamp: new Date().toISOString(),
      };

      const policyDecision = await this.policyEngine.evaluateAccess(policyContext);

      if (!policyDecision.allowed) {
        throw new PolicyViolationError(policyDecision.reason || 'Access denied');
      }

      // 5. Get/validate credentials
      if (serverMeta.authentication.required) {
        const hasValidCreds = await this.authManager.hasValidCredentials(
          serverId,
          request.userId
        );

        if (!hasValidCreds) {
          throw new AuthenticationError(
            `No valid credentials for server ${serverId}`
          );
        }

        // Get token and inject into environment
        const env = await this.authManager.injectCredentials(
          serverId,
          request.userId
        );

        // Apply to server connection
        await this.updateServerEnvironment(serverId, env);
      }

      // 6. Get or create server connection
      const client = await this.getOrCreateClient(serverId, serverMeta);

      // 7. Execute tool with circuit breaker
      const circuitBreaker = this.getCircuitBreaker(serverId);
      const result = await circuitBreaker.execute(async () => {
        return await client.callTool(actualToolName, request.input);
      });

      // 8. Audit log (success)
      await this.auditLogger.logToolCall({
        id: generateId(),
        timestamp: new Date().toISOString(),
        type: 'tool_call',
        userId: request.userId,
        serverId,
        serverType: serverMeta.type,
        toolName: actualToolName,
        action: 'execute',
        input: request.input,
        output: result,
        duration: Date.now() - startTime,
        policyDecision,
        dataClassification: serverMeta.policies.dataClassification,
        sensitiveDataAccessed: false, // TODO: detect
        piiIncluded: false, // TODO: detect
      });

      return {
        success: true,
        result,
        metadata: {
          serverId,
          duration: Date.now() - startTime,
        },
      };

    } catch (err) {
      error = err as Error;

      // Audit log (failure)
      await this.auditLogger.logToolCall({
        id: generateId(),
        timestamp: new Date().toISOString(),
        type: 'tool_call',
        userId: request.userId,
        serverId: serverId || 'unknown',
        toolName: request.toolName,
        action: 'execute',
        input: request.input,
        error: error.message,
        duration: Date.now() - startTime,
        dataClassification: 'unknown',
        sensitiveDataAccessed: false,
        piiIncluded: false,
      });

      throw error;
    }
  }

  /**
   * List all available tools for a user
   */
  async listTools(userId: string): Promise<Tool[]> {
    // Get user roles for policy evaluation
    const userRoles = await this.getUserRoles(userId);

    // Get all servers
    const servers = await this.registry.listServers({ status: 'active' });

    // Filter servers by policy
    const allowedServers = await this.filterServersByPolicy(servers, userId, userRoles);

    // Get tools from each server
    const allTools: Tool[] = [];
    for (const server of allowedServers) {
      const tools = server.capabilities.tools;
      // Add server prefix to tool names
      const prefixedTools = tools.map(tool => ({
        ...tool,
        name: `${server.id}__${tool.name}`,
        description: `[${server.name}] ${tool.description}`,
      }));
      allTools.push(...prefixedTools);
    }

    return allTools;
  }

  /**
   * Health check for all servers
   */
  async healthCheck(): Promise<Map<string, HealthStatus>> {
    const servers = await this.registry.listServers();
    const healthStatuses = new Map<string, HealthStatus>();

    for (const server of servers) {
      const health = await this.checkServerHealth(server.id);
      healthStatuses.set(server.id, health);
    }

    return healthStatuses;
  }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation ✅ (Completed)

- ✅ Custom Playwright MCP server
- ✅ Custom GitHub MCP server
- ✅ OAuth-aware intelligent agent
- ✅ Web chat UI
- ✅ Basic multi-server support

### Phase 2: Core Governance (Recommended Next)

**Priority 1: Server Registry**
- [ ] Implement `MCPServerRegistry` class
- [ ] YAML configuration loader
- [ ] Server registration/discovery API
- [ ] Health monitoring

**Priority 2: MCP Gateway**
- [ ] Implement `MCPGateway` class
- [ ] Request routing logic
- [ ] Circuit breaker pattern
- [ ] Basic error handling

**Priority 3: Namespace Manager**
- [ ] Implement `ToolNamespaceManager`
- [ ] Tool name resolution
- [ ] Conflict detection
- [ ] User preferences

**Estimated Effort:** 2-3 weeks

### Phase 3: Security & Compliance

**Priority 1: Authentication Manager**
- [ ] Implement `UnifiedAuthManager`
- [ ] Token storage (database)
- [ ] Token refresh logic
- [ ] Credential injection

**Priority 2: Policy Engine**
- [ ] Implement `PolicyEngine`
- [ ] RBAC evaluation
- [ ] Rate limiting
- [ ] Integrate OPA or Cedar

**Priority 3: Audit Logger**
- [ ] Implement `AuditLogger`
- [ ] Log storage (Elasticsearch/PostgreSQL)
- [ ] PII detection
- [ ] Compliance reporting

**Estimated Effort:** 3-4 weeks

### Phase 4: Third-Party Integration

**Priority 1: Official GitHub Server**
- [ ] Install `@modelcontextprotocol/server-github`
- [ ] Register in server registry
- [ ] Configure in `mcp-servers.yaml`
- [ ] Test side-by-side with custom server

**Priority 2: Other Servers**
- [ ] Add Slack MCP server (if available)
- [ ] Add database MCP servers
- [ ] Add cloud provider servers (AWS, GCP, Azure)

**Estimated Effort:** 1-2 weeks

### Phase 5: Advanced Features

- [ ] Distributed tracing (OpenTelemetry)
- [ ] Caching layer (Redis)
- [ ] Load balancing across multiple instances
- [ ] A/B testing framework
- [ ] Cost tracking and chargeback
- [ ] Self-service server registration UI

**Estimated Effort:** 4-6 weeks

---

## Integration with Existing Code

### Before (Current)

```typescript
// src/agent/oauth-intelligent-agent.ts
const agent = new OAuthIntelligentAgent();
await agent.initialize([
  { name: 'github', command: 'node', args: ['...'] },
  { name: 'playwright', command: 'node', args: ['...'] }
]);
await agent.processQuery('List my repositories');
```

### After (With Gateway)

```typescript
// src/governance/mcp-gateway.ts
const gateway = new MCPGateway();
await gateway.initialize(); // Loads from config/mcp-servers.yaml

// Agent uses gateway
const agent = new OAuthIntelligentAgent(gateway);
await agent.processQuery('List my repositories');

// Gateway handles:
// - Policy check
// - Credential injection
// - Routing to correct server
// - Audit logging
```

---

## Configuration Management

### Environment Variables

```bash
# Gateway Configuration
MCP_GATEWAY_PORT=3002
MCP_CONFIG_PATH=./config/mcp-servers.yaml

# Authentication
OAUTH_TOKEN_STORE=database  # or "memory", "vault"
DATABASE_URL=postgresql://localhost/mcp

# Policy Engine
POLICY_ENGINE=opa  # or "cedar", "internal"
OPA_URL=http://localhost:8181

# Audit Logging
AUDIT_STORE=elasticsearch  # or "postgresql", "s3"
ELASTICSEARCH_URL=http://localhost:9200

# Third-party MCP servers
GITHUB_TOKEN=ghp_xxx
SLACK_TOKEN=xoxb-xxx
```

### Config Files

```
config/
├── mcp-servers.yaml       # Server registry
├── policies/
│   ├── rbac.rego          # Role-based policies
│   ├── rate-limits.rego   # Rate limiting
│   └── compliance.rego    # Compliance rules
├── users.yaml             # User definitions (dev only)
└── roles.yaml             # Role definitions
```

---

## Deployment Architecture

### Development

```
┌─────────────┐
│  Developer  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  MCP Gateway    │
│  (localhost)    │
└──────┬──────────┘
       │
       ├──→ In-house servers (stdio)
       └──→ Third-party servers (stdio/http)
```

### Production

```
┌───────────────┐
│   Load        │
│   Balancer    │
└───────┬───────┘
        │
   ┌────┴────┐
   │         │
   ▼         ▼
┌──────┐ ┌──────┐
│ GW 1 │ │ GW 2 │  (Multiple gateway instances)
└──┬───┘ └──┬───┘
   │        │
   ├────────┼────────────────────────────┐
   │        │                            │
   ▼        ▼                            ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ Server Pool 1  │  │ Server Pool 2  │  │ Server Pool 3  │
│ (GitHub x3)    │  │ (Playwright x2)│  │ (Others)       │
└────────────────┘  └────────────────┘  └────────────────┘
         │                   │                    │
         └───────────────────┴────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  Shared Services        │
              │  - PostgreSQL (tokens)  │
              │  - Redis (rate limits)  │
              │  - Elasticsearch (logs) │
              └─────────────────────────┘
```

---

## Metrics & Monitoring

### Key Metrics

1. **Performance**
   - Request latency (p50, p95, p99)
   - Server response time
   - Gateway overhead
   - Tool execution time

2. **Availability**
   - Server uptime
   - Gateway uptime
   - Success rate
   - Error rate

3. **Usage**
   - Requests per server
   - Active users
   - Most popular tools
   - Peak usage times

4. **Security**
   - Authentication failures
   - Authorization denials
   - Rate limit hits
   - Policy violations

5. **Compliance**
   - PII access events
   - Data export events
   - Audit log coverage
   - Retention compliance

### Dashboards

Create dashboards for:
- Real-time operations (Grafana)
- Security monitoring (SIEM)
- Compliance reporting (Custom)
- Cost tracking (FinOps)

---

## Security Considerations

### Threat Model

**Threats:**
1. **Unauthorized Access**: User accesses tools without permission
2. **Credential Theft**: OAuth tokens stolen
3. **Data Exfiltration**: Sensitive data leaked through tools
4. **DoS**: Resource exhaustion via excessive requests
5. **Server Compromise**: Malicious third-party server
6. **Man-in-the-Middle**: Traffic interception
7. **Privilege Escalation**: User gains unauthorized roles

**Mitigations:**
1. Policy engine with RBAC/ABAC
2. Encrypted token storage, short-lived tokens
3. PII detection, output filtering, audit logging
4. Rate limiting, circuit breakers
5. Server vetting, sandboxing, monitoring
6. TLS everywhere, certificate pinning
7. Immutable audit logs, regular access reviews

### Best Practices

1. **Principle of Least Privilege**
   - Minimum scopes for OAuth
   - Role-based access only
   - Time-limited credentials

2. **Defense in Depth**
   - Multiple layers of security
   - Fail securely
   - Audit everything

3. **Zero Trust**
   - Always authenticate
   - Always authorize
   - Never trust, always verify

4. **Compliance by Design**
   - GDPR: right to erasure, data portability
   - SOC2: access controls, audit trails
   - HIPAA: encryption, access logs

---

## Testing Strategy

### Unit Tests

Test each component in isolation:
```typescript
describe('PolicyEngine', () => {
  it('should deny access when user lacks required role', async () => {
    const policy = new PolicyEngine();
    const decision = await policy.evaluateAccess({
      userId: 'user1',
      userRoles: ['viewer'],
      serverId: 'github',
      toolName: 'create_issue',
      // ...
    });
    expect(decision.allowed).toBe(false);
  });
});
```

### Integration Tests

Test component interactions:
```typescript
describe('MCPGateway Integration', () => {
  it('should route request through full governance pipeline', async () => {
    const gateway = new MCPGateway();
    const response = await gateway.callTool({
      userId: 'user1',
      toolName: 'github__list_repositories',
      input: {},
    });
    expect(response.success).toBe(true);
  });
});
```

### End-to-End Tests

Test full user workflows:
```typescript
describe('E2E: GitHub Integration', () => {
  it('should list repositories with OAuth', async () => {
    // 1. User authenticates
    const token = await authenticateUser('user1');

    // 2. User requests tool via chat
    const response = await chatAPI.sendMessage(token, 'List my repositories');

    // 3. Verify response
    expect(response).toContain('repository list');

    // 4. Verify audit log
    const logs = await auditLogger.query({ userId: 'user1' });
    expect(logs).toHaveLength(1);
    expect(logs[0].toolName).toBe('list_repositories');
  });
});
```

---

## Cost Considerations

### Infrastructure Costs

| Component | Type | Monthly Cost (est.) |
|-----------|------|---------------------|
| Gateway instances | 2x t3.medium | $60 |
| PostgreSQL (RDS) | db.t3.small | $30 |
| Redis (ElastiCache) | cache.t3.micro | $15 |
| Elasticsearch | 3-node cluster | $150 |
| S3 (audit logs) | 100GB storage | $2 |
| **Total** | | **~$260/month** |

### Third-Party Costs

- **Claude API**: $0.01-0.10 per request (varies by model)
- **GitHub API**: Free for authenticated requests
- **Third-party MCP servers**: Varies by vendor

### Optimization Strategies

1. **Caching**: Cache frequently accessed data
2. **Rate Limiting**: Prevent expensive operations
3. **Server Pooling**: Reuse server connections
4. **Log Retention**: Archive old logs to cheaper storage
5. **Right-Sizing**: Scale infrastructure based on usage

---

## FAQ

### Q: Why not use API Gateway (AWS, Kong, etc.)?

**A:** Traditional API gateways are HTTP-focused. MCP uses stdio, SSE, and custom protocols. We need:
- Stdio process management
- MCP-specific tool routing
- OAuth token injection into subprocess environments
- MCP schema validation

However, for HTTP-based MCP servers, we can integrate with API gateways!

### Q: How does this compare to a service mesh (Istio, Linkerd)?

**A:** Service meshes are for microservices (HTTP/gRPC). Our gateway is for MCP protocol. But concepts overlap:
- **Traffic management**: ✓ Similar
- **Security**: ✓ Similar (mTLS, auth)
- **Observability**: ✓ Similar (tracing, metrics)
- **Policy enforcement**: ✓ Similar (rate limiting, access control)

We could use a service mesh for HTTP-based MCP servers!

### Q: Can we use this with Claude Desktop / VS Code?

**A:** Yes! Clients just need to connect to the gateway instead of individual servers:

```json
{
  "mcpServers": {
    "gateway": {
      "command": "node",
      "args": ["dist/governance/gateway-cli.js"],
      "env": {
        "USER_ID": "user123"
      }
    }
  }
}
```

The gateway CLI wraps the HTTP gateway with stdio transport.

### Q: What about performance overhead?

**A:** Gateway adds ~10-50ms latency per request:
- Policy evaluation: 5-20ms
- Token validation: 5-15ms
- Audit logging: 5-10ms (async)
- Routing overhead: 1-5ms

For AI workflows (seconds to minutes), this is negligible.

### Q: Can we use this with Anthropic's MCP servers?

**A:** Yes! Register them in `mcp-servers.yaml`:

```yaml
- id: anthropic-postgres
  name: "Anthropic PostgreSQL Server"
  type: third-party
  vendor: anthropic
  connection:
    command: npx
    args: [-y, "@anthropic/mcp-server-postgres"]
```

---

## Next Steps

### Immediate (Before Implementing)

1. ✅ **Integration test current implementation**
   - Test Playwright server
   - Test GitHub server with real GitHub API
   - Test web chat UI end-to-end
   - Validate OAuth flow

2. ✅ **Document findings**
   - What works well
   - What needs improvement
   - Performance characteristics

### Short-term (Next Sprint)

1. **Choose database for token storage**
   - PostgreSQL (recommended)
   - MongoDB
   - Redis

2. **Implement Server Registry**
   - Start with YAML config loader
   - Add database backend later

3. **Implement MCP Gateway (basic)**
   - Request routing
   - Tool name resolution
   - Error handling

4. **Add Official GitHub Server**
   - Install npm package
   - Register in config
   - Test side-by-side

### Medium-term (1-2 Months)

1. **Implement Policy Engine**
   - Start with simple RBAC
   - Add rate limiting
   - Integrate OPA

2. **Implement Audit Logger**
   - PostgreSQL backend
   - Basic query API
   - PII detection

3. **Production Hardening**
   - Health checks
   - Circuit breakers
   - Monitoring/alerting

### Long-term (3-6 Months)

1. **Advanced Governance**
   - ABAC policies
   - Compliance automation
   - Cost tracking

2. **Enterprise Features**
   - Multi-tenancy
   - SSO integration
   - Admin UI

3. **Ecosystem**
   - Plugin system for custom policies
   - Server marketplace
   - Community tooling

---

## References

### MCP Protocol
- [MCP Specification](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Official MCP Servers](https://github.com/modelcontextprotocol/servers)

### OAuth & Security
- [OAuth 2.1](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-07)
- [RFC 8707 - Resource Indicators](https://datatracker.ietf.org/doc/html/rfc8707)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)

### Policy Engines
- [Open Policy Agent (OPA)](https://www.openpolicyagent.org/)
- [AWS Cedar](https://www.cedarpolicy.com/)

### Governance Patterns
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [Cloud Security Alliance - Security Guidance](https://cloudsecurityalliance.org/)

---

**Document Status:** 📋 Design Phase
**Next Review:** After Phase 1 integration testing
**Owner:** Platform Architecture Team
**Stakeholders:** Security, Compliance, Engineering

---

**END OF DOCUMENT**
