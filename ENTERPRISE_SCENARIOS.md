# Enterprise Internal MCP OAuth Scenarios - Quick Reference

## Scenario Matrix

| Persona | App | MCP Server | Key Requirements | Current Gaps | Priority Enhancement |
|---------|-----|------------|------------------|--------------|---------------------|
| **Developer** | IDE (VSCode/Cursor) | **GitHub MCP**, **Playwright MCP** (third-party) | Long-lived sessions, user attribution, multi-server auth | ❌ No SSO, ❌ Manual refresh, ❌ No user context | 1. SSO + Token Exchange + Auto-refresh |
| **Data Analyst** | Jupyter Notebook | **Snowflake MCP** (third-party) | Auto-refresh, cost tracking | ❌ Token expires, ❌ No cost tracking | 2. Auto-refresh + Usage tracking |
| **CS Rep** | Custom UI App | **Enterprise KB MCP**, **CRM MCP** | User audit, session mgmt | ❌ No session mgmt, ❌ No audit trail | 3. Session mgmt + User context |
| **Executive** | Dashboard | **Analytics MCP**, **Billing MCP** | Cost visibility, budget controls | ❌ No usage metrics, ❌ No budgets | 4. Usage tracking + Cost analytics |

---

## Quick Start: Pick Your Scenario

### 🧑‍💻 Scenario 1: Developer in IDE (VSCode/Cursor)

**MCP Servers Used**:
- **GitHub MCP** - Search repos, create PRs, manage issues
- **Playwright MCP** - Run browser tests, take screenshots, debug UI

**What you have now**:
```typescript
// Developer Alice manually authenticates for each MCP server
const githubClient = new OAuthClient({
  clientId: 'vscode-ext',
  authorizationServer: 'https://auth.company.internal'
});
const githubToken = await githubClient.getClientCredentialsToken('github.repo.read');

const playwrightClient = new OAuthClient({
  clientId: 'vscode-ext',
  authorizationServer: 'https://auth.company.internal'
});
const playwrightToken = await playwrightClient.getClientCredentialsToken('playwright.browser.control');

// Problems:
// ❌ Alice authenticates twice (once per MCP server)
// ❌ GitHub shows "vscode-ext" not "Alice"
// ❌ Tokens expire after 1 hour during long coding session
// ❌ No audit trail (can't prove Alice accessed customer repo)
```

**What you need**: SSO + Token Exchange + Auto-refresh
```typescript
// After Enhancements 1, 2, & 4
const client = new OAuthClient({
  clientId: 'vscode-ext',
  ssoProvider: 'azure-ad',
  autoRefresh: true
});

// Alice logs in ONCE via SSO (Azure AD)
const ssoToken = await vscode.authentication.getSession('microsoft');

// Exchange SSO token for MCP tokens (with user context)
const githubToken = await client.exchangeToken({
  subjectToken: ssoToken.accessToken,
  scope: 'github.repo.read github.issues.write',
  resource: 'mcp://github'
});

const playwrightToken = await client.exchangeToken({
  subjectToken: ssoToken.accessToken,
  scope: 'playwright.browser.control',
  resource: 'mcp://playwright'
});

// Benefits:
// ✅ Single login via SSO
// ✅ Tokens include user context: { sub: 'alice@company.com', department: 'Engineering' }
// ✅ Auto-refresh every 45 min (Alice codes for 8+ hours uninterrupted)
// ✅ Full audit trail: "Alice via VSCode accessed customer-data repo"
// ✅ Cost tracking: "Engineering dept: $0.05 for Playwright test run"
```

**Real Workflow Example**:
```typescript
// Alice searches GitHub repos for code examples
const searchResults = await githubMCP.searchCode(githubToken, 'OAuth implementation');
// Audit log: alice@company.com searched repos at 10:30am

// Alice creates a PR with changes
await githubMCP.createPR(githubToken, {
  title: 'Fix OAuth bug',
  branch: 'alice/fix-oauth'
});
// Audit log: alice@company.com created PR #123 at 11:15am

// Alice runs Playwright test to verify fix
const testResult = await playwrightMCP.runTest(playwrightToken, 'oauth-login.spec.ts');
// Audit log: alice@company.com ran test, cost: $0.05 at 11:30am

// Alice takes screenshot for documentation
const screenshot = await playwrightMCP.screenshot(playwrightToken, { url: '/login' });
// Audit log: alice@company.com captured screenshot at 11:45am

// All actions tracked, attributed to Alice, and billed to Engineering dept
```

**Read**: [ENHANCEMENT_PLAN.md - Scenario 1](./ENHANCEMENT_PLAN.md#scenario-1-developer-in-ide-vscodecursor)

---

### 📊 Scenario 2: Data Analyst in Jupyter

**What you have now**:
```python
# Token expires after 1 hour, breaks long-running queries
token = get_token()
for i in range(100):  # Runs 3+ hours
    result = query_database(token)  # ❌ Fails after 1 hour
```

**What you need**: Auto-refresh
```python
# After Enhancement 4
client = MCPClient(auto_refresh=True)
client.authenticate()

for i in range(100):  # Runs for days
    result = client.query_database()  # ✅ Auto-refreshes token
```

**Read**: [ENHANCEMENT_PLAN.md](./ENHANCEMENT_PLAN.md#enhancement-4-automatic-token-refresh-for-long-running-sessions)

---

### 👥 Scenario 3: CS Rep in Custom UI

**What you have now**:
```typescript
// No session management, tokens never expire
// CS rep forgets to logout, token still valid
```

**What you need**: Session Management
```typescript
// After Enhancement 5
const sessionManager = new SessionManager({
  maxIdleMinutes: 30,
  maxSessionHours: 8,
  shiftBasedLogout: true
});

// Auto-logout at end of shift
// Idle timeout after 30 min
// Audit trail of all access
```

**Read**: [ENHANCEMENT_PLAN.md](./ENHANCEMENT_PLAN.md#enhancement-5-session-management--automatic-logout)

---

### 💼 Scenario 4: Executive Dashboard

**What you have now**:
```typescript
// No visibility into costs or usage
// Can't track which departments are using MCP servers
```

**What you need**: Usage Tracking + Cost Analytics
```typescript
// After Enhancement 3
const usageTracker = new UsageTracker({
  analyticsBackend: clickhouse
});

// Automatic cost tracking per user/department
// Budget alerts
// Chargebacks to business units
```

**Analytics Queries**:
```sql
SELECT department, SUM(cost) FROM mcp_usage
WHERE month = '2024-11' GROUP BY department;
```

**Read**: [ENHANCEMENT_PLAN.md](./ENHANCEMENT_PLAN.md#enhancement-3-usage-tracking--cost-attribution)

---

## Cross-Cutting Concerns

### 🔐 Fine-Grained Permissions (All Scenarios)

**Problem**: Current scopes too coarse
- `data.read` gives access to ALL data
- No row-level security

**Solution**: Policy Engine (Enhancement 6)
```json
{
  "name": "Sales Analysts - Regional Data",
  "principals": { "groups": ["sales-analysts"] },
  "actions": ["data.read"],
  "resources": ["mcp://snowflake/*"],
  "conditions": {
    "attribute_filters": {
      "region": "${user.region}"
    }
  }
}
```

**Read**: [ENHANCEMENT_PLAN.md](./ENHANCEMENT_PLAN.md#enhancement-6-fine-grained-permissions-with-policy-engine)

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2) - **Start Here**
- [x] Basic OAuth 2.0 (already implemented)
- [ ] **Enhancement 1**: SSO Integration (SAML/OIDC)
- [ ] **Enhancement 2**: Token Exchange (RFC 8693)

**Why first**: Enables all other scenarios, single sign-on for all users

### Phase 2: Usability (Weeks 3-4)
- [ ] **Enhancement 4**: Auto-refresh tokens
- [ ] **Enhancement 5**: Session management

**Why second**: Dramatically improves UX for developers and analysts

### Phase 3: Governance (Weeks 5-6)
- [ ] **Enhancement 3**: Usage tracking
- [ ] **Enhancement 6**: Policy engine

**Why third**: Enables cost controls and compliance

---

## Quick Decision Tree

```
Do you need user attribution (who accessed what)?
├─ YES → Start with Enhancement 1 (SSO) + 2 (Token Exchange)
└─ NO  → Skip to Enhancement 3 (Usage Tracking)

Do you have long-running sessions (notebooks, IDEs)?
├─ YES → Implement Enhancement 4 (Auto-refresh)
└─ NO  → Skip

Do you need to track costs per user/department?
├─ YES → Implement Enhancement 3 (Usage Tracking)
└─ NO  → Skip

Do you need row-level security (data filtering by user)?
├─ YES → Implement Enhancement 6 (Policy Engine)
└─ NO  → Skip

Do you have shift workers or shared workstations?
├─ YES → Implement Enhancement 5 (Session Management)
└─ NO  → Skip
```

---

## Next Steps

1. **Read the full plan**: [ENHANCEMENT_PLAN.md](./ENHANCEMENT_PLAN.md)
2. **Pick your top priority** based on scenario matrix
3. **Start with SSO** if you need user attribution (most common)
4. **Test incrementally** - each enhancement is independent

---

## Questions?

- **SSO not working?** → Check [ENHANCEMENT_PLAN.md - SSO Section](./ENHANCEMENT_PLAN.md#enhancement-2-sso-integration-samloidc)
- **Tokens expiring?** → See [Auto-refresh Section](./ENHANCEMENT_PLAN.md#enhancement-4-automatic-token-refresh-for-long-running-sessions)
- **Need cost tracking?** → Read [Usage Tracking Section](./ENHANCEMENT_PLAN.md#enhancement-3-usage-tracking--cost-attribution)
- **Row-level security?** → Check [Policy Engine Section](./ENHANCEMENT_PLAN.md#enhancement-6-fine-grained-permissions-with-policy-engine)

---

**Status**: All enhancements are **design-complete** and ready for implementation.
See [ENHANCEMENT_PLAN.md](./ENHANCEMENT_PLAN.md) for detailed code examples and implementation guide.
