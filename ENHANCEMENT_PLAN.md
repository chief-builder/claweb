# OAuth 2.0 MCP Reference Implementation - Enhancement Plan

## Overview
This document outlines enhancements needed to support enterprise internal use cases across different personas, applications, and MCP server deployments.

## Target Scenarios

| Persona | App | MCP Server | Key Requirements |
|---------|-----|------------|------------------|
| Developer | IDE (VSCode/Cursor) | GitHub MCP, Playwright MCP (Third-party) | User attribution, long-lived sessions, SSO, multi-server access |
| Data Analyst | Jupyter Notebook | Third-party data warehouse (Snowflake) | Auto-refresh, cost tracking, fine-grained permissions |
| CS Rep | Custom UI App | Enterprise knowledge base, CRM | User delegation, audit trails, session management |
| Executive | Dashboard | Analytics/billing MCP | Usage metrics, cost allocation, budget controls |

---

## 🎯 Scenario Analysis

### Scenario 1: Developer in IDE (VSCode/Cursor)

**MCP Servers**:
- **GitHub MCP Server** (Third-party) - Repository operations, code search, PRs, issues, commits
- **Playwright MCP Server** (Third-party) - Browser automation, screenshots, testing, debugging

**Current Flow**:
```typescript
// Developer needs to access GitHub and Playwright MCP servers from IDE
const githubClient = new OAuthClient({
  clientId: 'vscode-extension-12345',
  authorizationServer: 'https://auth.company.internal',
  scopes: ['github.repo.read', 'github.issues.write']
});

const playwrightClient = new OAuthClient({
  clientId: 'vscode-extension-12345',
  authorizationServer: 'https://auth.company.internal',
  scopes: ['playwright.browser.control', 'playwright.screenshots']
});

// Problem 1: Each MCP server requires separate authentication
// Problem 2: No user context (shows "vscode-extension" not "Alice")
// Problem 3: Tokens expire during long coding sessions
```

**Real-World Developer Workflow**:
```typescript
// Developer Alice wants to:
// 1. Search GitHub repos for code examples → GitHub MCP
// 2. Create a new PR with changes → GitHub MCP
// 3. Run Playwright test to verify UI → Playwright MCP
// 4. Take screenshot of results → Playwright MCP

// Current issues:
// ❌ Alice authenticates 2+ times (once per MCP server)
// ❌ GitHub API shows requests from "vscode-extension" not "Alice"
// ❌ Playwright screenshots aren't attributed to Alice's project
// ❌ After 1 hour, tokens expire and Alice must re-authenticate
// ❌ No audit trail showing Alice accessed customer repo
```

**Gaps Identified**:
1. ❌ **No user-specific token** (only client credentials) - Can't tell which developer made API calls
2. ❌ **No unified SSO** - Developer authenticates multiple times for different MCP servers
3. ❌ **Token expiration breaks flow** - Long coding sessions interrupted by auth prompts
4. ❌ **No audit trail** - Can't track "Alice accessed customer-data repo via GitHub MCP"
5. ❌ **No cost attribution** - Can't charge Alice's team for Playwright test runs

**After Enhancements**:
```typescript
// Enhancement 1 + 2: SSO + Token Exchange
// Developer logs in once via SSO (Azure AD)
const ssoToken = await vscode.authentication.getSession('microsoft');

// IDE exchanges SSO token for MCP tokens (with user context)
const githubToken = await oauthClient.exchangeToken({
  subjectToken: ssoToken.accessToken,
  scope: 'github.repo.read github.issues.write',
  resource: 'mcp://github',
  actor_token: 'vscode-extension-token'
});

// Token includes: { sub: 'alice@company.com', act: { sub: 'vscode-ext' } }
// GitHub MCP sees: "Alice via VSCode" not just "VSCode"

// Enhancement 4: Auto-refresh
// Token automatically refreshes at 45 minutes (before 1 hour expiry)
// Alice codes for 8 hours without re-authentication

// Enhancement 3: Usage tracking
// Every API call logged:
// - alice@company.com accessed mcp://github/search at 2024-11-19 10:30
// - alice@company.com ran playwright test, cost: $0.05
```

**Benefits**:
- ✅ Single sign-on via Azure AD/Okta
- ✅ User attribution (audit shows "Alice" not "VSCode")
- ✅ Seamless 8+ hour sessions (auto-refresh)
- ✅ Cost tracking per developer/team
- ✅ Security compliance (know who accessed what)

---

### Scenario 2: Data Analyst in Jupyter Notebook

**MCP Server**: Third-party data warehouse (Snowflake MCP)

**Current Flow**:
```python
# Analyst runs notebook, token expires during long query
token = get_token()  # Valid for 1 hour

for i in range(100):  # Runs 3+ hours
    result = snowflake_mcp.query(token, f"SELECT * FROM table_{i}")
    # ❌ Fails after 1 hour when token expires
```

**Gaps Identified**:
1. ❌ **Token expires mid-query** - Breaks long-running analyses
2. ❌ **No cost attribution** - Can't bill analyst's department for queries
3. ❌ **No usage tracking** - No visibility into who's using Snowflake MCP

**After Enhancements**:
```python
# Enhancement 4: Auto-refresh
client = MCPClient(auto_refresh=True)
client.authenticate()

for i in range(100):  # Runs for days
    result = client.query(...)  # ✅ Auto-refreshes token every 45 min

# Enhancement 3: Usage tracking
# Every query logged with user context and cost
# - bob@company.com ran query, cost: $1.50, duration: 45s
```

---

### Scenario 3: Customer Service Rep in Custom UI App

**MCP Servers**: Enterprise knowledge base MCP, CRM MCP

**Current Flow**:
```typescript
// CS rep logs in, no session management
// Token remains valid even after shift ends
```

**Gaps Identified**:
1. ❌ **No session timeout** - Token valid indefinitely
2. ❌ **Shared workstations** - Rep forgets to logout, next person has access
3. ❌ **No audit trail** - Can't prove who accessed customer PII

**After Enhancements**:
```typescript
// Enhancement 5: Session management
const sessionManager = new SessionManager({
  maxIdleMinutes: 30,      // Auto-logout after 30 min idle
  maxSessionHours: 8,       // Force logout after 8 hours
  shiftBasedLogout: true    // Logout at shift end
});

// Enhancement 1: User context
// Every CRM lookup logged:
// - carol@company.com (CS-Rep) viewed customer #12345 at 2pm
```

---

### Scenario 4: Executive Dashboard for Cost Controls

**MCP Server**: Analytics MCP, billing MCP

**Current Flow**:
```typescript
// No visibility into MCP usage or costs
```

**Gaps Identified**:
1. ❌ **No cost tracking** - Don't know how much GitHub/Playwright MCPs cost
2. ❌ **No usage metrics** - Can't see which teams are heavy users
3. ❌ **No budget controls** - No alerts when costs exceed limits

**After Enhancements**:
```sql
-- Enhancement 3: Usage tracking
SELECT
  department,
  mcp_server,
  SUM(cost_usd) as total_cost,
  COUNT(*) as api_calls
FROM mcp_usage
WHERE month = '2024-11'
GROUP BY department, mcp_server;

-- Output:
-- Engineering | mcp://github      | $12,345 | 456,789 calls
-- Engineering | mcp://playwright  | $3,456  | 23,456 calls
-- Data Science| mcp://snowflake   | $45,678 | 12,345 calls
```

---

## Enhancement 1: User Context & Token Exchange (RFC 8693)

### Problem
Current implementation only supports:
- ✅ Client Credentials Grant (machine-to-machine)
- ✅ Authorization Code Flow (basic user consent)

Missing:
- ❌ User context propagation through token chain
- ❌ Token exchange for downstream services
- ❌ Impersonation/delegation for service accounts

### Solution: Token Exchange (RFC 8693)

**Use Case**: Developer Alice uses VSCode to access GitHub MCP and Playwright MCP

```typescript
// 1. Alice authenticates to VSCode with SSO (Azure AD)
const userToken = await vscode.authentication.getSession('microsoft');
// User token: { sub: 'alice@company.com', name: 'Alice Smith', department: 'Engineering' }

// 2. VSCode exchanges user token for GitHub MCP access token
const githubToken = await oauthClient.exchangeToken({
  subjectToken: userToken.accessToken,
  subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
  requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
  scope: 'github.repo.read github.issues.write',
  resource: 'mcp://github',
  actor_token: 'vscode-extension-token', // VSCode's own identity
  actor_token_type: 'urn:ietf:params:oauth:token-type:access_token'
});

// 3. VSCode exchanges user token for Playwright MCP access token
const playwrightToken = await oauthClient.exchangeToken({
  subjectToken: userToken.accessToken,
  subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
  requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
  scope: 'playwright.browser.control playwright.screenshots',
  resource: 'mcp://playwright',
  actor_token: 'vscode-extension-token',
  actor_token_type: 'urn:ietf:params:oauth:token-type:access_token'
});

// 4. MCP servers validate tokens, see both user and IDE client identity
// GitHub MCP token claims: {
//   sub: 'alice@company.com',
//   act: { sub: 'vscode-extension-12345' },
//   scope: 'github.repo.read github.issues.write',
//   resource: 'mcp://github',
//   user_email: 'alice@company.com',
//   user_department: 'Engineering'
// }

// 5. Alice uses GitHub MCP - all actions attributed to her
await githubMCP.searchCode(githubToken, 'OAuth implementation');
// Audit log: alice@company.com (via VSCode) searched repos at 10:30am

await githubMCP.createPR(githubToken, { title: 'Fix OAuth bug' });
// Audit log: alice@company.com (via VSCode) created PR #123 at 11:15am

// 6. Alice uses Playwright MCP - actions attributed and billed
await playwrightMCP.runTest(playwrightToken, 'oauth-login.spec.ts');
// Audit log: alice@company.com ran test, cost: $0.05
// Cost center: Engineering dept
```

**Implementation**:

```typescript
// src/auth/endpoints/oauth.ts - Add token exchange endpoint

/**
 * Token Exchange endpoint (RFC 8693)
 * POST /oauth/token with grant_type=urn:ietf:params:oauth:grant-type:token-exchange
 */
router.post('/oauth/token', async (req: Request, res: Response) => {
  const { grant_type, subject_token, subject_token_type, resource, scope,
          actor_token, actor_token_type } = req.body;

  if (grant_type === 'urn:ietf:params:oauth:grant-type:token-exchange') {
    // Validate subject token (user's token)
    const subjectClaims = await jwtService.validateToken(subject_token);
    if (!subjectClaims.valid) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid subject token'
      });
    }

    // Validate actor token (client/app token)
    let actorClaims = null;
    if (actor_token) {
      actorClaims = await jwtService.validateToken(actor_token);
      if (!actorClaims.valid) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid actor token'
        });
      }
    }

    // Create new token with user context and actor context
    const exchangedToken = jwtService.createAccessToken({
      sub: subjectClaims.sub, // User identity
      client_id: actorClaims?.client_id,
      scope: scope || subjectClaims.scope,
      resource: resource ? [resource] : subjectClaims.resource,
      act: actorClaims ? { sub: actorClaims.sub } : undefined, // Actor claim
      // Add user metadata for audit
      user_email: subjectClaims.email,
      user_name: subjectClaims.name,
      user_department: subjectClaims.department
    });

    return res.json({
      access_token: exchangedToken,
      issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope,
      resource
    });
  }

  // ... existing grant types
});
```

**Token Structure** (with user context):
```json
{
  "sub": "alice@company.com",
  "client_id": "vscode-extension-12345",
  "scope": "code.read docs.read",
  "resource": ["mcp://code-search"],
  "act": {
    "sub": "vscode-extension-12345"
  },
  "user_email": "alice@company.com",
  "user_name": "Alice Smith",
  "user_department": "Engineering",
  "iat": 1234567890,
  "exp": 1234571490
}
```

**Benefits**:
- ✅ MCP servers can audit by user, not just client
- ✅ Fine-grained permissions based on user attributes
- ✅ Maintains security boundary (IDE can't impersonate arbitrary users)

---

## Enhancement 2: SSO Integration (SAML/OIDC)

### Problem
Enterprise users already authenticate via SSO (Okta, Azure AD, Google Workspace).
Current implementation requires separate OAuth login.

### Solution: SAML/OIDC Bridge

```typescript
// src/auth/sso/oidc-bridge.ts

import { Issuer, Client } from 'openid-client';

export class OIDCBridge {
  private oidcClient: Client;

  async initialize(config: {
    issuerUrl: string; // e.g., https://login.microsoftonline.com/tenant-id
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }) {
    const issuer = await Issuer.discover(config.issuerUrl);
    this.oidcClient = new issuer.Client({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uris: [config.redirectUri],
      response_types: ['code']
    });
  }

  /**
   * Authenticate user via OIDC, return user claims
   */
  async authenticateUser(authorizationCode: string): Promise<UserClaims> {
    const tokenSet = await this.oidcClient.callback(
      config.redirectUri,
      { code: authorizationCode }
    );

    const userinfo = await this.oidcClient.userinfo(tokenSet.access_token);

    return {
      sub: userinfo.sub,
      email: userinfo.email,
      name: userinfo.name,
      groups: userinfo.groups, // AD groups for RBAC
      department: userinfo.department,
      // Custom claims from SSO provider
      employee_id: userinfo.employee_id,
      cost_center: userinfo.cost_center
    };
  }
}
```

**Modified Authorization Flow**:

```typescript
// src/auth/endpoints/oauth.ts

// Step 1: User visits /oauth/authorize
router.get('/oauth/authorize', async (req, res) => {
  const { client_id, redirect_uri, scope, state } = req.query;

  // Check if SSO is enabled for this client
  const client = await registrationService.getClient(client_id);
  if (client.sso_enabled) {
    // Redirect to SSO provider (Azure AD, Okta, etc.)
    const ssoAuthUrl = await oidcBridge.getAuthorizationUrl({
      scope: 'openid profile email',
      state: state, // Preserve OAuth state
      redirect_uri: 'http://localhost:4000/oauth/sso/callback'
    });
    return res.redirect(ssoAuthUrl);
  }

  // ... existing consent flow
});

// Step 2: SSO provider redirects back
router.get('/oauth/sso/callback', async (req, res) => {
  const { code, state } = req.query;

  // Exchange SSO code for user claims
  const userClaims = await oidcBridge.authenticateUser(code);

  // Create OAuth authorization code with user context
  const authCode = generateAuthorizationCode();
  authorizationCodes.set(authCode, {
    code: authCode,
    clientId: originalClientId, // From state
    redirectUri: originalRedirectUri,
    scopes: requestedScopes,
    userClaims: userClaims, // ← Store user context
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    used: false
  });

  // Redirect back to original OAuth client
  res.redirect(`${originalRedirectUri}?code=${authCode}&state=${state}`);
});
```

**Benefits**:
- ✅ Single sign-on for all enterprise apps
- ✅ Centralized user management (HR systems → SSO → OAuth)
- ✅ Group-based access control from AD/LDAP
- ✅ No separate password management

---

## Enhancement 3: Usage Tracking & Cost Attribution

### Problem
No built-in tracking of:
- API calls per user/department
- Token usage by resource
- Cost allocation for third-party MCP servers

### Solution: Usage Tracking Middleware

```typescript
// src/auth/middleware/usage-tracking.ts

export interface UsageEvent {
  timestamp: Date;
  user_id: string;
  user_email: string;
  department: string;
  cost_center: string;
  client_id: string;
  resource: string;
  scope: string;
  endpoint: string;
  method: string;
  response_status: number;
  response_time_ms: number;
  // For cost attribution
  compute_units?: number;
  estimated_cost_usd?: number;
}

export class UsageTracker {
  private events: UsageEvent[] = [];
  private analyticsBackend: AnalyticsBackend;

  /**
   * Middleware to track MCP API usage
   */
  trackUsage() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Extract user context from JWT
      const token = extractToken(req);
      const claims = await jwtService.validateToken(token);

      // Capture response
      const originalSend = res.send;
      res.send = function(data) {
        const responseTime = Date.now() - startTime;

        // Record usage event
        const event: UsageEvent = {
          timestamp: new Date(),
          user_id: claims.sub,
          user_email: claims.user_email,
          department: claims.user_department,
          cost_center: claims.cost_center,
          client_id: claims.client_id,
          resource: claims.resource?.[0] || 'unknown',
          scope: claims.scope,
          endpoint: req.path,
          method: req.method,
          response_status: res.statusCode,
          response_time_ms: responseTime
        };

        // Estimate cost based on resource and operation
        event.estimated_cost_usd = estimateCost(event);

        // Send to analytics backend (async)
        usageTracker.recordEvent(event);

        return originalSend.call(this, data);
      };

      next();
    };
  }

  async recordEvent(event: UsageEvent) {
    // Send to analytics backend (e.g., ClickHouse, BigQuery)
    await this.analyticsBackend.insert('mcp_usage', event);

    // Check budget limits
    await this.checkBudgetLimits(event);
  }

  async checkBudgetLimits(event: UsageEvent) {
    // Get department budget
    const budget = await this.getBudget(event.department);
    const currentSpend = await this.getMonthlySpend(event.department);

    if (currentSpend + event.estimated_cost_usd > budget.limit) {
      // Alert finance team
      await this.alertBudgetExceeded(event.department, currentSpend, budget.limit);

      // Optionally rate-limit or block further requests
      if (budget.hard_limit) {
        throw new Error('Department budget exceeded');
      }
    }
  }

  /**
   * Estimate cost based on operation type
   */
  private estimateCost(event: UsageEvent): number {
    const pricing = {
      'mcp://snowflake/warehouse': {
        'query': 0.05, // $0.05 per query
        'export': 0.10  // $0.10 per export
      },
      'mcp://enterprise/tools': {
        'read': 0.001,   // $0.001 per read
        'execute': 0.01  // $0.01 per execution
      }
    };

    const resourcePricing = pricing[event.resource];
    if (!resourcePricing) return 0;

    // Determine operation from endpoint
    const operation = event.endpoint.includes('execute') ? 'execute' : 'read';
    return resourcePricing[operation] || 0;
  }
}
```

**Usage in Resource Server**:

```typescript
// examples/oauth-roles/02-resource-server.ts

import { UsageTracker } from '../../src/auth/middleware/usage-tracking.js';

const usageTracker = new UsageTracker({
  analyticsBackend: new ClickHouseBackend({
    host: 'analytics.company.internal',
    database: 'mcp_usage'
  })
});

// Apply to all protected endpoints
app.use('/mcp/*',
  protectResource({ /* ... */ }),
  usageTracker.trackUsage() // ← Track after auth
);
```

**Analytics Query Examples**:

```sql
-- Cost by department (last 30 days)
SELECT
  department,
  SUM(estimated_cost_usd) as total_cost,
  COUNT(*) as api_calls,
  AVG(response_time_ms) as avg_response_time
FROM mcp_usage
WHERE timestamp >= NOW() - INTERVAL 30 DAY
GROUP BY department
ORDER BY total_cost DESC;

-- Top users by API calls
SELECT
  user_email,
  department,
  COUNT(*) as api_calls,
  SUM(estimated_cost_usd) as total_cost
FROM mcp_usage
WHERE timestamp >= NOW() - INTERVAL 7 DAY
GROUP BY user_email, department
ORDER BY api_calls DESC
LIMIT 10;

-- Resource utilization by hour
SELECT
  DATE_TRUNC('hour', timestamp) as hour,
  resource,
  COUNT(*) as requests,
  AVG(response_time_ms) as avg_latency
FROM mcp_usage
WHERE timestamp >= NOW() - INTERVAL 1 DAY
GROUP BY hour, resource
ORDER BY hour DESC;
```

**Executive Dashboard**:

```typescript
// src/dashboards/cost-control.ts

export class CostControlDashboard {
  async getDepartmentCosts(month: string) {
    return await analytics.query(`
      SELECT department, SUM(estimated_cost_usd) as cost
      FROM mcp_usage
      WHERE DATE_TRUNC('month', timestamp) = '${month}'
      GROUP BY department
    `);
  }

  async getBudgetAlerts() {
    // Departments over 80% of budget
    return await budgetService.getOverBudgetDepartments(0.8);
  }

  async getTopExpensiveOperations() {
    return await analytics.query(`
      SELECT endpoint, resource, COUNT(*) as calls,
             SUM(estimated_cost_usd) as total_cost
      FROM mcp_usage
      WHERE timestamp >= NOW() - INTERVAL 30 DAY
      GROUP BY endpoint, resource
      ORDER BY total_cost DESC
      LIMIT 20
    `);
  }
}
```

**Benefits**:
- ✅ Real-time cost tracking per user/department
- ✅ Budget alerts and enforcement
- ✅ Chargebacks to business units
- ✅ Identify expensive operations for optimization

---

## Enhancement 4: Automatic Token Refresh for Long-Running Sessions

### Problem
- Jupyter notebooks run for hours/days
- IDE sessions stay open for weeks
- Tokens expire after 1 hour, breaking workflows

### Solution: Proactive Token Refresh

```typescript
// src/auth/client/token-manager.ts

export class TokenManager {
  private tokens: Map<string, TokenSet> = new Map();
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Stores token and schedules automatic refresh
   */
  async storeToken(key: string, tokens: TokenSet) {
    this.tokens.set(key, tokens);

    // Schedule refresh at 75% of token lifetime
    const expiresIn = tokens.expires_in || 3600;
    const refreshIn = expiresIn * 0.75 * 1000; // 45 minutes for 1 hour token

    const timer = setTimeout(async () => {
      try {
        console.log(`[TokenManager] Auto-refreshing token for ${key}`);
        const newTokens = await this.refreshToken(key);
        this.storeToken(key, newTokens); // Reschedule next refresh
      } catch (error) {
        console.error(`[TokenManager] Failed to refresh token for ${key}:`, error);
        // Notify application that token refresh failed
        this.emit('token-refresh-failed', { key, error });
      }
    }, refreshIn);

    this.refreshTimers.set(key, timer);
  }

  /**
   * Get current valid token (auto-refreshes if needed)
   */
  async getToken(key: string): Promise<string> {
    const tokens = this.tokens.get(key);
    if (!tokens) {
      throw new Error(`No token found for ${key}`);
    }

    // Check if token is still valid (with 5 minute buffer)
    const expiresAt = tokens.issued_at + tokens.expires_in;
    const now = Date.now() / 1000;

    if (expiresAt - now < 300) {
      // Token expires in less than 5 minutes, refresh now
      console.log(`[TokenManager] Token expiring soon, refreshing for ${key}`);
      const newTokens = await this.refreshToken(key);
      this.storeToken(key, newTokens);
      return newTokens.access_token;
    }

    return tokens.access_token;
  }

  private async refreshToken(key: string): Promise<TokenSet> {
    const tokens = this.tokens.get(key);
    if (!tokens || !tokens.refresh_token) {
      throw new Error('No refresh token available');
    }

    // Call OAuth token endpoint
    const response = await fetch(`${this.authServer}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: this.clientId,
        client_secret: this.clientSecret
      })
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const newTokens = await response.json();
    return {
      ...newTokens,
      issued_at: Date.now() / 1000
    };
  }

  /**
   * Clean up timers on shutdown
   */
  destroy() {
    for (const timer of this.refreshTimers.values()) {
      clearTimeout(timer);
    }
    this.tokens.clear();
    this.refreshTimers.clear();
  }
}
```

**Usage in Jupyter Notebook**:

```python
# Python wrapper for MCP OAuth client with auto-refresh

import requests
from datetime import datetime, timedelta

class MCPClient:
    def __init__(self, auth_server, client_id, client_secret):
        self.auth_server = auth_server
        self.client_id = client_id
        self.client_secret = client_secret
        self.token = None
        self.refresh_token = None
        self.expires_at = None

    def authenticate(self, scopes, resource):
        """Get initial token"""
        response = requests.post(f"{self.auth_server}/oauth/token", json={
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "scope": scopes,
            "resource": resource
        })
        tokens = response.json()
        self.token = tokens['access_token']
        self.refresh_token = tokens.get('refresh_token')
        self.expires_at = datetime.now() + timedelta(seconds=tokens['expires_in'])

    def _ensure_valid_token(self):
        """Auto-refresh token if needed"""
        if self.expires_at and datetime.now() >= self.expires_at - timedelta(minutes=5):
            print("Token expiring soon, refreshing...")
            self._refresh_token()

    def _refresh_token(self):
        response = requests.post(f"{self.auth_server}/oauth/token", json={
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
            "client_id": self.client_id,
            "client_secret": self.client_secret
        })
        tokens = response.json()
        self.token = tokens['access_token']
        self.expires_at = datetime.now() + timedelta(seconds=tokens['expires_in'])

    def query(self, endpoint, **kwargs):
        """Execute MCP query with auto-refresh"""
        self._ensure_valid_token()
        return requests.get(
            endpoint,
            headers={"Authorization": f"Bearer {self.token}"},
            **kwargs
        )

# Usage in Jupyter notebook
client = MCPClient(
    auth_server="https://auth.company.internal",
    client_id="jupyter-notebook-12345",
    client_secret="secret-xyz"
)

client.authenticate(
    scopes="data.read data.query",
    resource="mcp://snowflake/warehouse"
)

# This can run for hours without token expiry issues
for i in range(1000):
    result = client.query("https://mcp-server.internal/query",
                         params={"sql": f"SELECT * FROM table_{i}"})
    process(result)
    time.sleep(60)  # Run every minute for 16+ hours
```

**Benefits**:
- ✅ No manual token management in long-running scripts
- ✅ Seamless user experience in IDE/notebooks
- ✅ Reduced authentication failures

---

## Enhancement 5: Session Management & Automatic Logout

### Problem
Customer service reps share workstations or forget to log out.
Tokens remain valid even after shift ends.

### Solution: Session Management with Automatic Expiration

```typescript
// src/auth/session/session-manager.ts

export interface Session {
  session_id: string;
  user_id: string;
  client_id: string;
  created_at: Date;
  expires_at: Date;
  last_activity: Date;
  ip_address: string;
  user_agent: string;
  tokens: {
    access_token: string;
    refresh_token: string;
  };
  metadata: {
    department: string;
    shift_end?: Date; // For shift workers
    max_idle_minutes?: number;
  };
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private config: {
    maxIdleMinutes: number; // Default 30
    maxSessionHours: number; // Default 8 (work shift)
    enableShiftBasedLogout: boolean;
  }) {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
  }

  /**
   * Create new session when user logs in
   */
  async createSession(user: UserClaims, tokens: TokenSet, clientInfo: any): Promise<string> {
    const sessionId = crypto.randomUUID();

    // Determine session expiration
    const now = new Date();
    const expiresAt = new Date();

    if (this.config.enableShiftBasedLogout && user.shift_end) {
      // Expire at end of shift
      expiresAt.setTime(user.shift_end.getTime());
    } else {
      // Expire after max session hours
      expiresAt.setHours(now.getHours() + this.config.maxSessionHours);
    }

    const session: Session = {
      session_id: sessionId,
      user_id: user.sub,
      client_id: clientInfo.client_id,
      created_at: now,
      expires_at: expiresAt,
      last_activity: now,
      ip_address: clientInfo.ip_address,
      user_agent: clientInfo.user_agent,
      tokens,
      metadata: {
        department: user.department,
        shift_end: user.shift_end,
        max_idle_minutes: this.config.maxIdleMinutes
      }
    };

    this.sessions.set(sessionId, session);

    // Log session creation for audit
    await this.auditLog('session_created', session);

    return sessionId;
  }

  /**
   * Validate session and update last activity
   */
  async validateSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const now = new Date();

    // Check absolute expiration
    if (now > session.expires_at) {
      await this.endSession(sessionId, 'expired');
      return null;
    }

    // Check idle timeout
    const idleMinutes = (now.getTime() - session.last_activity.getTime()) / (60 * 1000);
    if (idleMinutes > (session.metadata.max_idle_minutes || this.config.maxIdleMinutes)) {
      await this.endSession(sessionId, 'idle_timeout');
      return null;
    }

    // Update last activity
    session.last_activity = now;
    this.sessions.set(sessionId, session);

    return session;
  }

  /**
   * End session and revoke tokens
   */
  async endSession(sessionId: string, reason: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Revoke all tokens
    await this.revokeToken(session.tokens.access_token);
    await this.revokeToken(session.tokens.refresh_token);

    // Remove session
    this.sessions.delete(sessionId);

    // Log for audit
    await this.auditLog('session_ended', { session, reason });
  }

  /**
   * Cleanup expired and idle sessions
   */
  private async cleanupExpiredSessions() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const idleMinutes = (now.getTime() - session.last_activity.getTime()) / (60 * 1000);

      if (now > session.expires_at) {
        await this.endSession(sessionId, 'expired');
        cleanedCount++;
      } else if (idleMinutes > (session.metadata.max_idle_minutes || this.config.maxIdleMinutes)) {
        await this.endSession(sessionId, 'idle_timeout');
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[SessionManager] Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  /**
   * Get all active sessions for a user (for security dashboard)
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    return Array.from(this.sessions.values())
      .filter(s => s.user_id === userId);
  }

  /**
   * Force logout user from all sessions
   */
  async logoutUser(userId: string, reason: string = 'forced_logout') {
    const userSessions = await this.getUserSessions(userId);
    for (const session of userSessions) {
      await this.endSession(session.session_id, reason);
    }
  }

  private async revokeToken(token: string) {
    await fetch(`${this.authServer}/oauth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
  }

  private async auditLog(event: string, data: any) {
    // Log to audit system
    console.log(`[Audit] ${event}:`, JSON.stringify(data, null, 2));
  }
}
```

**Integration with Custom UI App**:

```typescript
// examples/custom-ui-app/server.ts

const sessionManager = new SessionManager({
  maxIdleMinutes: 30,
  maxSessionHours: 8,
  enableShiftBasedLogout: true
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // 1. Authenticate with SSO
  const userClaims = await ssoProvider.authenticate(username, password);

  // 2. Get OAuth tokens
  const tokens = await oauthClient.getTokensForUser(userClaims);

  // 3. Create session
  const sessionId = await sessionManager.createSession(
    userClaims,
    tokens,
    {
      client_id: 'cs-app-12345',
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    }
  );

  // 4. Set session cookie
  res.cookie('session_id', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  });

  res.json({ success: true, user: userClaims });
});

// Middleware to validate session on every request
app.use(async (req, res, next) => {
  const sessionId = req.cookies.session_id;
  if (!sessionId) {
    return res.status(401).json({ error: 'No session' });
  }

  const session = await sessionManager.validateSession(sessionId);
  if (!session) {
    res.clearCookie('session_id');
    return res.status(401).json({ error: 'Session expired' });
  }

  // Attach session to request
  req.session = session;
  next();
});

// Logout endpoint
app.post('/logout', async (req, res) => {
  const sessionId = req.cookies.session_id;
  await sessionManager.endSession(sessionId, 'user_logout');
  res.clearCookie('session_id');
  res.json({ success: true });
});
```

**Benefits**:
- ✅ Automatic logout at end of shift
- ✅ Idle timeout prevents unauthorized access
- ✅ Security dashboard shows all active sessions
- ✅ Force logout from all devices

---

## Enhancement 6: Fine-Grained Permissions with Policy Engine

### Problem
Current scope system is too coarse:
- `data.read` gives access to ALL data
- No way to limit by row-level security (e.g., analyst can only see their region's data)

### Solution: Attribute-Based Access Control (ABAC) with Policy Engine

```typescript
// src/auth/policies/policy-engine.ts

export interface AccessPolicy {
  id: string;
  name: string;
  description: string;
  effect: 'allow' | 'deny';
  principals: {
    users?: string[];
    groups?: string[];
    departments?: string[];
  };
  actions: string[]; // e.g., ['data.read', 'data.query']
  resources: string[]; // e.g., ['mcp://snowflake/warehouse/sales_*']
  conditions?: {
    // Row-level security
    attribute_filters?: Record<string, any>;
    // Time-based restrictions
    time_range?: { start: string; end: string };
    // IP restrictions
    ip_allowlist?: string[];
    // Cost limits
    max_cost_per_query?: number;
  };
}

export class PolicyEngine {
  private policies: AccessPolicy[] = [];

  async loadPolicies() {
    // Load from database or config files
    this.policies = await this.policyStore.getAllPolicies();
  }

  /**
   * Evaluate if user can perform action on resource
   */
  async evaluate(request: {
    user: UserClaims;
    action: string;
    resource: string;
    context?: Record<string, any>;
  }): Promise<PolicyDecision> {
    const { user, action, resource, context } = request;

    // Find applicable policies
    const applicablePolicies = this.policies.filter(policy => {
      // Check if policy applies to this user
      if (policy.principals.users && !policy.principals.users.includes(user.sub)) {
        return false;
      }
      if (policy.principals.departments && !policy.principals.departments.includes(user.department)) {
        return false;
      }
      if (policy.principals.groups) {
        const userGroups = user.groups || [];
        if (!policy.principals.groups.some(g => userGroups.includes(g))) {
          return false;
        }
      }

      // Check if policy covers this action
      if (!policy.actions.some(a => this.matchAction(a, action))) {
        return false;
      }

      // Check if policy covers this resource
      if (!policy.resources.some(r => this.matchResource(r, resource))) {
        return false;
      }

      return true;
    });

    // Evaluate conditions
    for (const policy of applicablePolicies) {
      // Check time-based restrictions
      if (policy.conditions?.time_range) {
        const now = new Date();
        const start = new Date(policy.conditions.time_range.start);
        const end = new Date(policy.conditions.time_range.end);
        if (now < start || now > end) {
          continue; // Policy not applicable now
        }
      }

      // Check IP restrictions
      if (policy.conditions?.ip_allowlist) {
        const clientIp = context?.ip_address;
        if (!policy.conditions.ip_allowlist.includes(clientIp)) {
          return {
            allowed: false,
            reason: 'IP address not in allowlist',
            policy_id: policy.id
          };
        }
      }

      // If we get here and policy effect is allow, grant access
      if (policy.effect === 'allow') {
        return {
          allowed: true,
          policy_id: policy.id,
          conditions: policy.conditions
        };
      }

      // If policy effect is deny, explicitly deny
      if (policy.effect === 'deny') {
        return {
          allowed: false,
          reason: `Denied by policy: ${policy.name}`,
          policy_id: policy.id
        };
      }
    }

    // Default deny if no policies match
    return {
      allowed: false,
      reason: 'No matching policy found'
    };
  }

  /**
   * Match action with wildcard support
   */
  private matchAction(policyAction: string, requestAction: string): boolean {
    if (policyAction === '*') return true;
    if (policyAction.endsWith('.*')) {
      const prefix = policyAction.slice(0, -2);
      return requestAction.startsWith(prefix);
    }
    return policyAction === requestAction;
  }

  /**
   * Match resource with wildcard support
   */
  private matchResource(policyResource: string, requestResource: string): boolean {
    if (policyResource === '*') return true;
    if (policyResource.includes('*')) {
      const regex = new RegExp('^' + policyResource.replace(/\*/g, '.*') + '$');
      return regex.test(requestResource);
    }
    return policyResource === requestResource;
  }

  /**
   * Get attribute filters for row-level security
   */
  getAttributeFilters(decision: PolicyDecision): Record<string, any> | null {
    if (!decision.allowed || !decision.conditions?.attribute_filters) {
      return null;
    }
    return decision.conditions.attribute_filters;
  }
}
```

**Example Policies**:

```json
// policies/sales-analysts.json
{
  "id": "policy-001",
  "name": "Sales Analysts - Regional Data Access",
  "description": "Sales analysts can only query data for their assigned region",
  "effect": "allow",
  "principals": {
    "groups": ["sales-analysts"],
    "departments": ["Sales"]
  },
  "actions": ["data.read", "data.query"],
  "resources": ["mcp://snowflake/warehouse/sales_*"],
  "conditions": {
    "attribute_filters": {
      "region": "${user.region}"
    },
    "time_range": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-12-31T23:59:59Z"
    },
    "max_cost_per_query": 10.0
  }
}

// policies/executives.json
{
  "id": "policy-002",
  "name": "Executives - Full Read Access",
  "description": "Executives can view all data across all regions",
  "effect": "allow",
  "principals": {
    "groups": ["executives"]
  },
  "actions": ["data.*"],
  "resources": ["mcp://snowflake/warehouse/*"],
  "conditions": {
    "ip_allowlist": ["10.0.0.0/8", "172.16.0.0/12"]
  }
}

// policies/cs-reps-pii.json
{
  "id": "policy-003",
  "name": "CS Reps - No PII Access After Hours",
  "description": "Customer service reps cannot access PII outside business hours",
  "effect": "deny",
  "principals": {
    "groups": ["customer-service"]
  },
  "actions": ["customer.read_pii"],
  "resources": ["mcp://crm/*"],
  "conditions": {
    "time_range": {
      "start": "1970-01-01T18:00:00Z",
      "end": "1970-01-02T08:00:00Z"
    }
  }
}
```

**Integration with Resource Server**:

```typescript
// src/auth/resource-server/middleware.ts

export function protectResourceWithPolicies(config: {
  requiredAction: string;
  requiredResource: string;
  policyEngine: PolicyEngine;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Validate OAuth token
    const token = extractToken(req);
    const claims = await jwtService.validateToken(token);

    if (!claims.valid) {
      return res.status(401).json({ error: 'invalid_token' });
    }

    // 2. Evaluate policy
    const decision = await config.policyEngine.evaluate({
      user: claims,
      action: config.requiredAction,
      resource: config.requiredResource,
      context: {
        ip_address: req.ip,
        timestamp: new Date()
      }
    });

    if (!decision.allowed) {
      return res.status(403).json({
        error: 'access_denied',
        error_description: decision.reason,
        policy_id: decision.policy_id
      });
    }

    // 3. Apply attribute filters for row-level security
    const filters = config.policyEngine.getAttributeFilters(decision);
    if (filters) {
      // Inject filters into request for database layer
      req.rowLevelFilters = filters;
    }

    // 4. Attach policy decision for audit
    req.policyDecision = decision;

    next();
  };
}
```

**Usage in MCP Server**:

```typescript
// Apply policy-based protection
app.get('/mcp/snowflake/query',
  protectResourceWithPolicies({
    requiredAction: 'data.query',
    requiredResource: 'mcp://snowflake/warehouse/sales_data',
    policyEngine: policyEngine
  }),
  async (req, res) => {
    const { sql } = req.query;

    // Apply row-level filters from policy
    const filters = req.rowLevelFilters;
    let modifiedSql = sql;

    if (filters) {
      // Inject WHERE clause based on user's region
      modifiedSql = `${sql} WHERE region = '${filters.region}'`;
    }

    // Execute query
    const results = await snowflakeClient.query(modifiedSql);
    res.json(results);
  }
);
```

**Benefits**:
- ✅ Row-level security (analysts see only their region)
- ✅ Time-based restrictions (no PII access after hours)
- ✅ IP-based restrictions (executives from office only)
- ✅ Cost limits per query
- ✅ Centralized policy management

---

## Implementation Priority

Based on the scenarios, here's the recommended implementation order:

### Phase 1: Foundation (Weeks 1-2)
1. ✅ SSO Integration (SAML/OIDC bridge) - **Highest impact**
2. ✅ Token Exchange (RFC 8693) for user context

### Phase 2: Usability (Weeks 3-4)
3. ✅ Automatic Token Refresh
4. ✅ Session Management

### Phase 3: Governance (Weeks 5-6)
5. ✅ Usage Tracking & Cost Attribution
6. ✅ Policy Engine for fine-grained permissions

### Phase 4: Advanced (Weeks 7-8)
7. Advanced analytics dashboard
8. Budget alerts and enforcement
9. Anomaly detection (unusual API usage patterns)

---

## Testing Strategy

For each enhancement, create corresponding tests:

```bash
# SSO Integration
npm run test:sso-bridge

# Token Exchange
npm run test:token-exchange

# Auto-refresh
npm run test:token-refresh

# Session Management
npm run test:sessions

# Usage Tracking
npm run test:usage-tracking

# Policy Engine
npm run test:policies
```

---

## Documentation Updates

Update the following docs:
1. `examples/oauth-roles/README.md` - Add enterprise scenarios
2. `docs/SSO_INTEGRATION.md` - New file for SSO setup
3. `docs/POLICY_ENGINE.md` - New file for policy configuration
4. `docs/COST_TRACKING.md` - New file for usage analytics

---

## Summary

These enhancements transform the reference implementation from a basic OAuth 2.0 server into an **enterprise-grade identity and access management system** for MCP servers.

**Key Benefits**:
- ✅ Seamless SSO for all enterprise users
- ✅ User attribution for compliance and audit
- ✅ Cost tracking and budget controls for executives
- ✅ Fine-grained permissions for data governance
- ✅ Better UX for developers, analysts, and business users
