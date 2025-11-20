# OAuth 2.1 API Reference

Complete API reference for the MCP OAuth 2.1 implementation with Enterprise SSO and Token Exchange.

**Implementation Status**: ✅ Production Ready (32/32 tests passing)

## Table of Contents

- [Overview](#overview)
- [Authorization Server Endpoints](#authorization-server-endpoints)
  - [Discovery](#discovery)
  - [JWKS](#jwks)
  - [Client Registration](#client-registration)
  - [Authorization](#authorization)
  - [Token](#token)
  - [Token Introspection](#token-introspection)
  - [Token Revocation](#token-revocation)
  - [Resource Metadata](#resource-metadata)
  - [SSO Callback](#sso-callback)
- [Resource Server](#resource-server)
- [Client Library](#client-library)
- [Error Codes](#error-codes)

---

## Overview

The OAuth 2.1 implementation provides three main roles:

1. **Authorization Server** - Issues and manages access tokens
2. **Resource Server** - Validates tokens and serves protected MCP resources
3. **OAuth Client** - Requests and uses tokens to access resources

### Base URLs

```
Authorization Server: http://localhost:4000
Resource Server:      http://localhost:3000
```

### Supported RFCs

- **RFC 6749** - OAuth 2.0 Authorization Framework
- **RFC 7009** - Token Revocation
- **RFC 7519** - JSON Web Token (JWT)
- **RFC 7591** - Dynamic Client Registration
- **RFC 7636** - PKCE (Proof Key for Code Exchange)
- **RFC 7662** - Token Introspection
- **RFC 8414** - Authorization Server Metadata
- **RFC 8693** - OAuth 2.0 Token Exchange ⭐ NEW
- **RFC 8707** - Resource Indicators

### Enterprise Features

- ✅ **SSO Integration** - Auth0 OIDC authentication (15/15 tests passing)
- ✅ **Token Exchange** - Resource-specific token issuance (RFC 8693)
- ✅ **User Context Propagation** - Identity flows through all tokens
- ✅ **MCP Server Scopes** - 16 scopes across GitHub & Playwright MCPs

---

## Authorization Server Endpoints

### Discovery

Get OAuth authorization server metadata.

**Endpoint:** `GET /.well-known/oauth-authorization-server`

**Response:**
```json
{
  "issuer": "http://localhost:4000",
  "authorization_endpoint": "http://localhost:4000/oauth/authorize",
  "token_endpoint": "http://localhost:4000/oauth/token",
  "registration_endpoint": "http://localhost:4000/oauth/register",
  "introspection_endpoint": "http://localhost:4000/oauth/introspect",
  "revocation_endpoint": "http://localhost:4000/oauth/revoke",
  "jwks_uri": "http://localhost:4000/oauth/jwks",
  "sso_callback_endpoint": "http://localhost:4000/oauth/sso/callback",
  "response_types_supported": ["code"],
  "grant_types_supported": [
    "authorization_code",
    "client_credentials",
    "refresh_token",
    "urn:ietf:params:oauth:grant-type:token-exchange"
  ],
  "token_endpoint_auth_methods_supported": [
    "client_secret_post",
    "client_secret_basic",
    "none"
  ],
  "code_challenge_methods_supported": ["S256", "plain"],
  "resource_indicators_supported": true,
  "token_exchange_supported": true
}
```

**Example:**
```bash
curl http://localhost:4000/.well-known/oauth-authorization-server
```

---

### JWKS

Get JSON Web Key Set for token verification.

**Endpoint:** `GET /oauth/jwks`

**Response:**
```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "key-id",
      "use": "sig",
      "alg": "RS256",
      "n": "modulus...",
      "e": "AQAB"
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:4000/oauth/jwks
```

---

### Client Registration

Register a new OAuth client (RFC 7591).

**Endpoint:** `POST /oauth/register`

**Request Body:**
```json
{
  "client_name": "My MCP Client",
  "client_type": "confidential",
  "redirect_uris": ["http://localhost:8080/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "scope": "mcp.tools.read mcp.tools.execute"
}
```

**Parameters:**
- `client_name` (required) - Human-readable client name
- `client_type` (required) - `"confidential"` or `"public"`
- `redirect_uris` (required) - Array of valid redirect URIs
- `grant_types` (optional) - Allowed grant types (default: `["authorization_code"]`)
- `scope` (optional) - Requested scopes (space-separated)
- `token_endpoint_auth_method` (optional) - Authentication method

**Response (201 Created):**
```json
{
  "client_id": "client_abc123",
  "client_secret": "secret_xyz789",
  "client_name": "My MCP Client",
  "client_type": "confidential",
  "redirect_uris": ["http://localhost:8080/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "token_endpoint_auth_method": "client_secret_post",
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

**Public Client Example:**
```json
{
  "client_name": "Public Client",
  "token_endpoint_auth_method": "none",
  "redirect_uris": ["http://localhost:8080/callback"]
}
```

**Example:**
```bash
curl -X POST http://localhost:4000/oauth/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "My Client",
    "client_type": "confidential",
    "redirect_uris": ["http://localhost:8080/callback"],
    "grant_types": ["client_credentials"],
    "scope": "mcp.tools.read"
  }'
```

---

### Authorization

Initiate authorization code flow.

**Endpoint:** `GET /oauth/authorize`

**Query Parameters:**
- `response_type` (required) - Must be `"code"`
- `client_id` (required) - Client identifier
- `redirect_uri` (required) - Redirect URI (must match registered URI)
- `scope` (optional) - Requested scopes (space-separated)
- `state` (required) - CSRF protection token
- `code_challenge` (required for PKCE) - PKCE challenge
- `code_challenge_method` (required for PKCE) - `"S256"` or `"plain"`
- `resource` (optional) - Resource indicator (RFC 8707)

**Success Response (302 Redirect):**
```
Location: http://localhost:8080/callback?code=auth_code_123&state=state_xyz
```

**Error Response (302 Redirect):**
```
Location: http://localhost:8080/callback?error=invalid_request&error_description=...&state=state_xyz
```

**Example:**
```bash
curl -i "http://localhost:4000/oauth/authorize?response_type=code&client_id=client_abc123&redirect_uri=http://localhost:8080/callback&scope=mcp.tools.read&state=random_state&code_challenge=challenge&code_challenge_method=S256&resource=mcp://tools"
```

---

### Token

Exchange authorization code or credentials for access tokens.

**Endpoint:** `POST /oauth/token`

#### Authorization Code Grant

**Request Body:**
```json
{
  "grant_type": "authorization_code",
  "code": "auth_code_123",
  "redirect_uri": "http://localhost:8080/callback",
  "client_id": "client_abc123",
  "client_secret": "secret_xyz789",
  "code_verifier": "pkce_verifier_value"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_token_123",
  "scope": "mcp.tools.read",
  "resource": ["mcp://tools"]
}
```

#### Client Credentials Grant

**Request Body:**
```json
{
  "grant_type": "client_credentials",
  "client_id": "client_abc123",
  "client_secret": "secret_xyz789",
  "scope": "mcp.tools.execute",
  "resource": "mcp://tools"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "mcp.tools.execute",
  "resource": ["mcp://tools"]
}
```

#### Refresh Token Grant

**Request Body:**
```json
{
  "grant_type": "refresh_token",
  "refresh_token": "refresh_token_123",
  "client_id": "client_abc123",
  "client_secret": "secret_xyz789"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "mcp.tools.read"
}
```

#### Token Exchange Grant (RFC 8693) ⭐ NEW

Exchange a user token for a resource-specific token with filtered scopes.

**Request Body:**
```json
{
  "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
  "subject_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "resource": "mcp://github",
  "scope": "github.repo.read github.issues.write",
  "client_id": "client_abc123"
}
```

**Parameters:**
- `grant_type` (required) - Must be `"urn:ietf:params:oauth:grant-type:token-exchange"`
- `subject_token` (required) - The user's access token to exchange
- `subject_token_type` (required) - Must be `"urn:ietf:params:oauth:token-type:access_token"`
- `resource` (required) - Target resource indicator (e.g., `"mcp://github"`, `"mcp://playwright"`)
- `scope` (optional) - Requested scopes (must be subset of subject token scopes)
- `client_id` (required) - Client identifier

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "issued_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "github.repo.read github.issues.write",
  "resource": ["mcp://github"]
}
```

**Use Case Example:**

```typescript
// User authenticated via SSO, obtained broad token
const userToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...";

// Exchange for GitHub MCP token (only github.* scopes)
const githubResponse = await fetch('http://localhost:4000/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token: userToken,
    subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    resource: 'mcp://github',
    scope: 'github.repo.read github.pr.write',
    client_id: 'vscode_client'
  })
});

// Exchange for Playwright MCP token (only playwright.* scopes)
const playwrightResponse = await fetch('http://localhost:4000/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token: userToken,
    subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    resource: 'mcp://playwright',
    scope: 'playwright.browser.control playwright.screenshot',
    client_id: 'vscode_client'
  })
});
```

**Key Features:**
- **Scope Filtering** - Exchanged token only contains scopes valid for target resource
- **User Context Preservation** - Email, department, roles propagated to exchanged token
- **Actor Claims** - Original token subject recorded as actor for delegation scenarios
- **Least Privilege** - Each MCP gets minimal necessary permissions

**Example:**
```bash
# Client credentials grant
curl -X POST http://localhost:4000/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "client_abc123",
    "client_secret": "secret_xyz789",
    "scope": "mcp.tools.read",
    "resource": "mcp://tools"
  }'

# Token exchange
curl -X POST http://localhost:4000/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
    "subject_token": "<user_access_token>",
    "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
    "resource": "mcp://github",
    "scope": "github.repo.read",
    "client_id": "client_abc123"
  }'
```

---

### Token Introspection

Introspect token status and metadata (RFC 7662).

**Endpoint:** `POST /oauth/introspect`

**Authentication:** Requires Bearer token in Authorization header

**Request Body:**
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type_hint": "access_token"
}
```

**Response (Active Token):**
```json
{
  "active": true,
  "client_id": "client_abc123",
  "scope": "mcp.tools.read",
  "sub": "client_abc123",
  "aud": ["mcp://tools"],
  "iss": "http://localhost:4000",
  "exp": 1705328400,
  "iat": 1705324800,
  "token_type": "access_token"
}
```

**Response (Inactive Token):**
```json
{
  "active": false
}
```

**Example:**
```bash
curl -X POST http://localhost:4000/oauth/introspect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "token": "<token_to_introspect>"
  }'
```

---

### Token Revocation

Revoke access or refresh tokens (RFC 7009).

**Endpoint:** `POST /oauth/revoke`

**Request Body:**
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type_hint": "access_token",
  "client_id": "client_abc123",
  "client_secret": "secret_xyz789"
}
```

**Parameters:**
- `token` (required) - The token to revoke
- `token_type_hint` (optional) - `"access_token"` or `"refresh_token"`
- `client_id` (optional) - Client identifier
- `client_secret` (optional) - Client secret (for confidential clients)

**Response (200 OK):**
```json
{}
```

**Note:** Per RFC 7009, the server returns 200 even for invalid tokens to prevent token scanning attacks.

**Example:**
```bash
curl -X POST http://localhost:4000/oauth/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<access_token>",
    "token_type_hint": "access_token",
    "client_id": "client_abc123",
    "client_secret": "secret_xyz789"
  }'
```

---

### Resource Metadata

Get available resource indicators and their scopes (RFC 8707).

**Endpoint:** `GET /oauth/resources`

**Response:**
```json
{
  "resources": [
    {
      "uri": "mcp://tools",
      "name": "MCP Tools",
      "scopes": [
        {
          "name": "mcp.tools.read",
          "description": "Read tool definitions"
        },
        {
          "name": "mcp.tools.execute",
          "description": "Execute tools"
        }
      ]
    },
    {
      "uri": "mcp://resources",
      "name": "MCP Resources",
      "scopes": [
        {
          "name": "mcp.resources.read",
          "description": "Read resource definitions and contents"
        }
      ]
    },
    {
      "uri": "mcp://prompts",
      "name": "MCP Prompts",
      "scopes": [
        {
          "name": "mcp.prompts.read",
          "description": "Read prompt definitions"
        },
        {
          "name": "mcp.prompts.execute",
          "description": "Execute prompts"
        }
      ]
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:4000/oauth/resources
```

---

### SSO Callback

OAuth 2.0 callback endpoint for Auth0 OIDC integration.

**Endpoint:** `GET /oauth/sso/callback`

**Query Parameters:**
- `code` (required) - Authorization code from Auth0
- `state` (required) - State parameter for CSRF protection

**Description:**

This endpoint handles the callback from Auth0 after user authentication. It:
1. Exchanges Auth0 authorization code for Auth0 tokens
2. Extracts user context from Auth0 ID token (email, name, custom claims)
3. Creates an OAuth authorization code with user context
4. Redirects back to the original OAuth client with the authorization code

**Flow:**

```
1. User initiates OAuth flow: GET /oauth/authorize
2. Authorization server redirects to Auth0: https://tenant.auth0.com/authorize
3. User logs in to Auth0
4. Auth0 redirects back: GET /oauth/sso/callback?code=...&state=...
5. Authorization server exchanges Auth0 code for tokens
6. Authorization server extracts user context (email, department, roles)
7. Authorization server creates OAuth code with user context
8. Redirects to client: GET /callback?code=<oauth_code>&state=...
```

**User Context Extracted from Auth0:**
- `email` - User's email address
- `name` - User's full name
- `sub` - Auth0 user ID
- Custom claims (if configured in Auth0):
  - `department` - User's department
  - `employee_id` - Employee identifier
  - `cost_center` - Cost center for billing
  - `groups` - User groups/teams
  - `roles` - User roles

**Configuration:**

```typescript
const authServer = new AuthorizationServer({
  port: 4000,
  issuer: 'http://localhost:4000',
  auth0: {
    domain: 'your-tenant.auth0.com',
    clientId: 'your_client_id',
    clientSecret: 'your_client_secret',
    redirectUri: 'http://localhost:4000/oauth/sso/callback'
  }
});
```

**Example Auth0 Setup:**

See [TESTING_GUIDE.md](/TESTING_GUIDE.md) for complete Auth0 configuration instructions including:
- Creating Auth0 application
- Configuring callback URLs
- Adding custom user claims via Auth0 Actions

---

## Resource Server

### Protected Endpoints

All MCP endpoints on the resource server require OAuth authentication.

**Authentication:** Bearer token in Authorization header

**Request Example:**
```bash
curl http://localhost:3000/mcp/tools \
  -H "Authorization: Bearer <access_token>"
```

### Middleware Configuration

```typescript
import { protectResource } from './auth/resource-server/middleware.js';

app.get('/mcp/tools',
  protectResource({
    requiredScopes: ['mcp.tools.read'],
    requiredResource: 'mcp://tools'
  }),
  (req, res) => {
    res.json({ tools: [...] });
  }
);
```

**Parameters:**
- `requiredScopes` - Array of required scopes (all must be present)
- `requiredResource` - Required resource indicator URI

### Error Responses

**401 Unauthorized - Missing or Invalid Token:**
```json
{
  "error": "invalid_token",
  "error_description": "The access token is missing or invalid"
}
```

**403 Forbidden - Insufficient Scope:**
```json
{
  "error": "insufficient_scope",
  "error_description": "The token does not have the required scope: mcp.tools.execute",
  "scope": "mcp.tools.execute"
}
```

**403 Forbidden - Wrong Resource:**
```json
{
  "error": "invalid_token",
  "error_description": "Token is not valid for this resource (expected: mcp://tools)"
}
```

---

## Client Library

### TypeScript Client

```typescript
import { OAuthClient } from './auth/client/oauth-client.js';

// Initialize client
const client = new OAuthClient({
  clientId: 'client_abc123',
  clientSecret: 'secret_xyz789',
  authorizationServer: 'http://localhost:4000'
});

// Client credentials flow
const tokens = await client.getClientCredentialsToken(
  'mcp.tools.read',
  'mcp://tools'
);

// Use token
const response = await fetch('http://localhost:3000/mcp/tools', {
  headers: {
    'Authorization': `Bearer ${tokens.access_token}`
  }
});
```

### Authorization Code Flow

```typescript
import { PKCEService, CodeChallengeMethod } from './auth/oauth/pkce.js';

// 1. Generate PKCE parameters
const pkce = PKCEService.generatePKCEParams(CodeChallengeMethod.S256);

// 2. Build authorization URL
const authUrl = new URL('http://localhost:4000/oauth/authorize');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', redirectUri);
authUrl.searchParams.set('scope', 'mcp.tools.read');
authUrl.searchParams.set('state', randomState);
authUrl.searchParams.set('code_challenge', pkce.codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');
authUrl.searchParams.set('resource', 'mcp://tools');

// 3. Redirect user to authorization URL
window.location.href = authUrl.toString();

// 4. Exchange code for tokens (in callback handler)
const tokens = await fetch('http://localhost:4000/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'authorization_code',
    code: authorizationCode,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: pkce.codeVerifier
  })
});
```

---

## Error Codes

### OAuth Error Responses

All error responses follow RFC 6749 format:

```json
{
  "error": "error_code",
  "error_description": "Human-readable description",
  "error_uri": "https://example.com/docs/errors/error_code"
}
```

### Common Error Codes

| Error Code | Description | HTTP Status |
|-----------|-------------|-------------|
| `invalid_request` | The request is missing a required parameter | 400 |
| `invalid_client` | Client authentication failed | 401 |
| `invalid_grant` | Authorization code or refresh token is invalid | 400 |
| `unauthorized_client` | Client not authorized for this grant type | 400 |
| `unsupported_grant_type` | Grant type not supported | 400 |
| `invalid_scope` | Requested scope is invalid or unknown | 400 |
| `invalid_target` | Resource indicator is invalid (RFC 8707) | 400 |
| `access_denied` | User denied the authorization request | 400 |
| `server_error` | Internal server error | 500 |
| `invalid_token` | Access token is invalid, expired, or revoked | 401 |
| `insufficient_scope` | Token lacks required scope | 403 |

### Resource Indicators Errors (RFC 8707)

| Error Code | Description |
|-----------|-------------|
| `invalid_target` | Resource indicator URI is invalid or not supported |
| `invalid_target` | Requested scope not valid for the resource |

---

## JWT Token Format

Access tokens are JWT Bearer tokens with RS256 signatures.

### Header
```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "key-id"
}
```

### Payload (Client Credentials)
```json
{
  "iss": "http://localhost:4000",
  "sub": "client_abc123",
  "aud": ["mcp://tools"],
  "exp": 1705328400,
  "iat": 1705324800,
  "client_id": "client_abc123",
  "scope": "mcp.tools.read mcp.tools.execute",
  "resource": ["mcp://tools"]
}
```

### Payload (SSO with User Context) ⭐ NEW
```json
{
  "iss": "http://localhost:4000",
  "sub": "auth0|68fe3894f61d39b83ef6db6f",
  "aud": ["mcp://github"],
  "exp": 1705328400,
  "iat": 1705324800,
  "client_id": "vscode_client",
  "scope": "github.repo.read github.issues.write",
  "resource": ["mcp://github"],
  "email": "cardio@test.com",
  "user_name": "cardio@test.com",
  "user_department": "cardiology",
  "user_employee_id": "EMP-001",
  "user_cost_center": "CC-100",
  "user_groups": ["medical-staff", "developers"],
  "user_roles": ["doctor", "code-reviewer"]
}
```

**Standard Claims:**
- `iss` - Issuer (authorization server URL)
- `sub` - Subject (client ID or user ID from Auth0)
- `aud` - Audience (resource indicators)
- `exp` - Expiration time (Unix timestamp)
- `iat` - Issued at time (Unix timestamp)
- `client_id` - OAuth client identifier
- `scope` - Granted scopes (space-separated)
- `resource` - Resource indicators array (RFC 8707)

**User Context Claims (from SSO):**
- `email` - User's email address
- `user_name` - User's name/username
- `user_department` - User's department (optional)
- `user_employee_id` - Employee identifier (optional)
- `user_cost_center` - Cost center for billing/tracking (optional)
- `user_groups` - User groups/teams array (optional)
- `user_roles` - User roles array (optional)

**Note:** User context claims are only present in tokens issued via SSO authentication or token exchange from an SSO token. Client credentials tokens do not include user context.

---

## Scopes

### MCP Core Scopes

```
mcp.tools.read         - Read tool definitions
mcp.tools.execute      - Execute tools
mcp.resources.read     - Read resource definitions and contents
mcp.prompts.read       - Read prompt definitions
mcp.prompts.execute    - Execute prompts
mcp.admin              - Administrative operations
```

### GitHub MCP Server Scopes ⭐ NEW

**Resource Indicator:** `mcp://github`

| Scope | Permission | Risk Level |
|-------|-----------|-----------|
| `github.repo.read` | Read repository data (code, commits, branches) | Low |
| `github.repo.write` | Modify repository data | High |
| `github.issues.read` | Read issues and comments | Low |
| `github.issues.write` | Create and modify issues | Medium |
| `github.pr.read` | Read pull requests | Low |
| `github.pr.write` | Create and merge pull requests | High |
| `github.actions.read` | View GitHub Actions workflows | Low |
| `github.actions.write` | Trigger and manage workflows | High |

**Use Case Examples:**
- **Code Review Bot**: `github.repo.read`, `github.pr.read`, `github.pr.write`
- **Issue Tracker**: `github.issues.read`, `github.issues.write`
- **CI/CD Pipeline**: `github.repo.read`, `github.actions.write`

### Playwright MCP Server Scopes ⭐ NEW

**Resource Indicator:** `mcp://playwright`

| Scope | Permission | Risk Level |
|-------|-----------|-----------|
| `playwright.browser.control` | Full browser automation control | High |
| `playwright.navigate` | Navigate to URLs | Medium |
| `playwright.screenshot` | Capture screenshots | Low |
| `playwright.selectors.read` | Read DOM elements | Low |
| `playwright.selectors.write` | Interact with DOM (click, type) | High |
| `playwright.network.read` | Monitor network requests | Medium |
| `playwright.network.write` | Modify network (intercept, mock) | High |

**Use Case Examples:**
- **Web Scraper**: `playwright.navigate`, `playwright.selectors.read`, `playwright.screenshot`
- **E2E Testing**: `playwright.browser.control`, `playwright.selectors.write`
- **Network Monitor**: `playwright.navigate`, `playwright.network.read`

### Scope Format

**Pattern:** `{server}.{capability}.{action}`

**Examples:**
- `github.repo.read` - GitHub server, repository capability, read action
- `playwright.browser.control` - Playwright server, browser capability, control action
- `mcp.tools.execute` - Core MCP, tools capability, execute action

**Scope Filtering:**

When using token exchange (RFC 8693), scopes are automatically filtered based on the target resource:
- Request token for `mcp://github` → Only `github.*` scopes included
- Request token for `mcp://playwright` → Only `playwright.*` scopes included
- Request token for `mcp://tools` → Only `mcp.tools.*` scopes included

This ensures **least privilege** - each resource only receives the minimal necessary permissions.

---

## Rate Limiting

(Not yet implemented - see OAUTH-RECOMMENDATIONS.md)

Future rate limiting will follow these limits:
- Token endpoint: 100 requests per 15 minutes per client
- Introspection: 300 requests per 15 minutes per client
- Authorization: 50 requests per 15 minutes per client

---

## Security Considerations

1. **PKCE Required** - All authorization code flows should use PKCE
2. **HTTPS in Production** - Always use HTTPS for authorization server
3. **State Parameter** - Always include state parameter for CSRF protection
4. **Token Storage** - Store tokens securely (never in localStorage for web apps)
5. **Token Rotation** - Refresh tokens should be rotated on use
6. **Scope Minimization** - Request only necessary scopes
7. **Resource Indicators** - Always specify resource parameter for fine-grained access

---

## See Also

- [OAUTH-SECURITY.md](./OAUTH-SECURITY.md) - Security best practices
- [OAUTH-ARCHITECTURE.md](./OAUTH-ARCHITECTURE.md) - Architecture overview
- [OAUTH-RECOMMENDATIONS.md](../OAUTH-RECOMMENDATIONS.md) - Implementation roadmap
