# Enterprise Internal MCP OAuth Scenarios - Quick Reference

## Scenario Matrix

| Persona | App | MCP Server Location | Key Requirements | Current Gaps | Priority Enhancement |
|---------|-----|---------------------|------------------|--------------|---------------------|
| **Developer** | IDE (VSCode/Cursor) | Internal code search | Long-lived sessions, user attribution | ❌ No SSO, ❌ Manual refresh | 1. SSO + Auto-refresh |
| **Data Analyst** | Jupyter Notebook | Third-party (Snowflake) | Auto-refresh, cost tracking | ❌ Token expires, ❌ No cost tracking | 2. Auto-refresh + Usage tracking |
| **CS Rep** | Custom UI App | Enterprise KB/CRM | User audit, session mgmt | ❌ No session mgmt, ❌ No audit trail | 3. Session mgmt + User context |
| **Executive** | Dashboard | Analytics server | Cost visibility, budget controls | ❌ No usage metrics, ❌ No budgets | 4. Usage tracking + Cost analytics |

---

## Quick Start: Pick Your Scenario

### 🧑‍💻 Scenario 1: Developer in IDE

**What you have now**:
```typescript
// Developer manually manages token
const client = new OAuthClient({
  clientId: 'vscode-ext',
  clientSecret: 'secret'
});
const token = await client.getClientCredentialsToken('code.read');
```

**What you need**: SSO + User Context
```typescript
// After Enhancement 1 & 2
const client = new OAuthClient({
  clientId: 'vscode-ext',
  ssoProvider: 'azure-ad',
  autoRefresh: true
});

// User logs in once via SSO
await client.loginWithSSO();

// Token automatically includes user context
// { sub: 'alice@company.com', department: 'Engineering' }
```

**Read**: [ENHANCEMENT_PLAN.md](./ENHANCEMENT_PLAN.md#enhancement-1-user-context--token-exchange-rfc-8693)

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
