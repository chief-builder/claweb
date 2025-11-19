# Enterprise OAuth with SSO + Token Exchange

This example demonstrates **Enhancement 1 (Token Exchange RFC 8693)** and **Enhancement 2 (SSO Integration)** for the Developer IDE scenario with GitHub MCP and Playwright MCP servers.

## Scenario: Developer in IDE (VSCode/Cursor)

**Persona**: Alice, a software developer
**App**: VSCode with Claude extension
**MCP Servers**: GitHub MCP, Playwright MCP
**Requirements**:
- Single sign-on via Auth0
- User attribution (all actions tracked to Alice)
- Multi-server authentication with one login
- Full audit trail

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Developer (Alice)                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 1. Opens VSCode
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    VSCode Extension (IDE)                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ OAuth Client (vscode-ext)                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────┬──────────────────────────────────────┬───────────────────┘
       │                                      │
       │ 2. Initiate OAuth                    │ 4. Token Exchange
       │    Authorization Code Flow            │    for each MCP server
       ↓                                      ↓
┌─────────────────────────────────────────────────────────────────┐
│              OAuth Authorization Server                          │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │ /oauth/        │→ │ Auth0 Bridge   │→ │ /oauth/sso/      │  │
│  │ authorize      │  │ (OIDC)         │  │ callback         │  │
│  └────────────────┘  └────────────────┘  └──────────────────┘  │
│  ┌────────────────┐  ┌────────────────┐                         │
│  │ /oauth/token   │  │ /oauth/token   │                         │
│  │ (auth code)    │  │ (token-exch)   │                         │
│  └────────────────┘  └────────────────┘                         │
└──────┬───────────────────────────────────────┬──────────────────┘
       │                                       │
       │ 3. Redirect to Auth0                  │
       ↓                                       │
┌─────────────────────────────────────────┐   │
│        Auth0 (Identity Provider)         │   │
│  - Authenticate Alice                    │   │
│  - Return user claims (email, dept, etc) │   │
└──────────────────────────────────────────┘   │
                                               │
       ┌───────────────────────────────────────┘
       │ 5. MCP requests with user context
       │
       ├──────────────────────────────────────┐
       ↓                                      ↓
┌──────────────────────┐          ┌──────────────────────┐
│   GitHub MCP Server  │          │ Playwright MCP Server │
│  - Receives token    │          │  - Receives token     │
│  - User: alice@...   │          │  - User: alice@...    │
│  - Actor: vscode-ext │          │  - Actor: vscode-ext  │
│  - Dept: Engineering │          │  - Dept: Engineering  │
└──────────────────────┘          └──────────────────────┘
```

## Flow Details

### Step 1-2: Initial OAuth Flow

```typescript
// VSCode extension initiates OAuth
const client = new OAuthClient({
  clientId: 'vscode-ext',
  authorizationServer: 'http://localhost:4000',
});

// Start authorization code flow with PKCE
const authUrl = client.getAuthorizationUrl({
  scope: 'github.repo.read playwright.browser.control',
  redirectUri: 'http://localhost:8080/callback',
});

// User visits auth URL
```

### Step 2-3: SSO Redirect to Auth0

```
GET http://localhost:4000/oauth/authorize
  ?response_type=code
  &client_id=vscode-ext
  &redirect_uri=http://localhost:8080/callback
  &scope=github.repo.read playwright.browser.control
  &code_challenge=...
  &code_challenge_method=S256

↓ Authorization server detects Auth0 is configured

302 Redirect to Auth0
Location: https://your-tenant.auth0.com/authorize
  ?client_id=...
  &redirect_uri=http://localhost:4000/oauth/sso/callback
  &scope=openid profile email
  &state=abc123...
  &code_challenge=...
```

### Step 3: Auth0 Authentication

User logs in with corporate credentials:
- Email: alice@company.com
- Password: (or SSO via Azure AD, Okta, etc.)

Auth0 returns user claims:
```json
{
  "sub": "auth0|alice123",
  "email": "alice@company.com",
  "name": "Alice Developer",
  "department": "Engineering",
  "employee_id": "EMP-001",
  "cost_center": "CC-100",
  "groups": ["developers", "senior-engineers"],
  "roles": ["developer", "code-reviewer"]
}
```

### Step 4: SSO Callback

```
GET http://localhost:4000/oauth/sso/callback
  ?code=auth0_code_xyz
  &state=abc123...

↓ Authorization server exchanges Auth0 code for user claims

↓ Generates authorization code with user context

302 Redirect to VSCode
Location: http://localhost:8080/callback
  ?code=oauth_code_123
  &state=original_state
```

### Step 5: Token Exchange

VSCode exchanges authorization code for access token:

```
POST http://localhost:4000/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=oauth_code_123
&redirect_uri=http://localhost:8080/callback
&client_id=vscode-ext
&code_verifier=...

Response:
{
  "access_token": "eyJ...",  // Contains user context!
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "..."
}
```

**Access token payload**:
```json
{
  "sub": "auth0|alice123",
  "client_id": "vscode-ext",
  "scope": "github.repo.read playwright.browser.control",
  "user_email": "alice@company.com",
  "user_name": "Alice Developer",
  "user_department": "Engineering",
  "employee_id": "EMP-001",
  "cost_center": "CC-100",
  "user_groups": ["developers", "senior-engineers"],
  "user_roles": ["developer", "code-reviewer"]
}
```

### Step 6: Exchange for MCP-Specific Tokens

VSCode exchanges the SSO token for GitHub MCP token:

```
POST http://localhost:4000/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:token-exchange
&subject_token=eyJ...  // SSO token from step 5
&subject_token_type=urn:ietf:params:oauth:token-type:access_token
&scope=github.repo.read github.issues.write
&resource=mcp://github

Response:
{
  "access_token": "eyJ...",  // GitHub MCP token
  "issued_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "github.repo.read github.issues.write",
  "resource": ["mcp://github"]
}
```

**GitHub MCP token payload** (with actor claim):
```json
{
  "sub": "auth0|alice123",
  "client_id": "vscode-ext",
  "scope": "github.repo.read github.issues.write",
  "resource": ["mcp://github"],
  "act": {
    "sub": "auth0|alice123",
    "client_id": "vscode-ext"
  },
  "user_email": "alice@company.com",
  "user_name": "Alice Developer",
  "user_department": "Engineering",
  "employee_id": "EMP-001",
  "cost_center": "CC-100"
}
```

Similarly for Playwright MCP:

```
POST http://localhost:4000/oauth/token

grant_type=urn:ietf:params:oauth:grant-type:token-exchange
&subject_token=eyJ...
&subject_token_type=urn:ietf:params:oauth:token-type:access_token
&scope=playwright.browser.control
&resource=mcp://playwright
```

### Step 7: MCP Server Access

VSCode makes requests to MCP servers with user-attributed tokens:

**GitHub MCP Request**:
```
POST https://github-mcp.company.internal/mcp
Authorization: Bearer eyJ...  // GitHub MCP token

{
  "method": "search_code",
  "params": {
    "query": "OAuth implementation"
  }
}

Audit Log:
alice@company.com via vscode-ext searched repos at 10:30am
Department: Engineering, Cost Center: CC-100
```

**Playwright MCP Request**:
```
POST https://playwright-mcp.company.internal/mcp
Authorization: Bearer eyJ...  // Playwright MCP token

{
  "method": "run_test",
  "params": {
    "test": "oauth-login.spec.ts"
  }
}

Audit Log:
alice@company.com via vscode-ext ran test, cost: $0.05 at 11:30am
Department: Engineering, Cost Center: CC-100
```

## Benefits

✅ **Single Login**: Alice authenticates once via Auth0
✅ **User Attribution**: All actions tracked to alice@company.com
✅ **Multi-Server Auth**: One SSO login grants access to multiple MCP servers
✅ **Full Audit Trail**: Every request includes user identity, department, cost center
✅ **Cost Tracking**: Usage can be attributed to Engineering department
✅ **Actor Context**: Tokens include both user (Alice) and actor (VSCode) information

## Running the Example

1. Set up Auth0 (or use test mode):

```bash
# Option 1: Test mode (no Auth0 required)
npm run example:enterprise:test

# Option 2: With Auth0
export AUTH0_DOMAIN=your-tenant.us.auth0.com
export AUTH0_CLIENT_ID=your_client_id
export AUTH0_CLIENT_SECRET=your_client_secret
export AUTH0_REDIRECT_URI=http://localhost:4000/oauth/sso/callback

npm run example:enterprise:sso
```

2. The example will:
   - Start OAuth authorization server with Auth0 integration
   - Start mock GitHub MCP server
   - Start mock Playwright MCP server
   - Simulate VSCode OAuth flow
   - Exchange tokens for each MCP server
   - Make authenticated requests with user context

3. Check the output for audit logs showing user attribution

## Files

- `test-sso-flow.ts` - Complete SSO + Token Exchange flow test
- `mock-github-mcp.ts` - Mock GitHub MCP server
- `mock-playwright-mcp.ts` - Mock Playwright MCP server
- `package.json` - npm scripts for running examples

## Related Documentation

- [ENHANCEMENT_PLAN.md](../../ENHANCEMENT_PLAN.md) - Complete enhancement plan
- [ENTERPRISE_SCENARIOS.md](../../ENTERPRISE_SCENARIOS.md) - Scenario matrix and quick reference
- [RFC 8693 - OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693)
