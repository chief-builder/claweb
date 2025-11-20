# OAuth 2.0 Role Separation

This directory demonstrates the **clean separation** between the three OAuth 2.0 roles in MCP:

## Three Separate Roles

### 1. Authorization Server (`01-authorization-server.ts`)
**Responsibility**: Issue access tokens

```typescript
import { AuthorizationServer } from '../../src/auth/authorization-server/server.js';

const authServer = new AuthorizationServer({
  issuer: 'http://localhost:4000',
  port: 4000,
});

await authServer.start();
```

**What it does**:
- ✅ Issues access tokens
- ✅ Registers clients
- ✅ Validates credentials
- ✅ Handles PKCE
- ✅ Provides JWKS for token validation
- ✅ Token introspection

**What it does NOT do**:
- ❌ Does NOT serve MCP resources
- ❌ Does NOT validate tokens for resource access
- ❌ Does NOT implement MCP protocol

**Endpoints**:
- `GET /.well-known/oauth-authorization-server` - Discovery
- `GET /oauth/jwks` - Public keys
- `GET /oauth/authorize` - Authorization
- `POST /oauth/token` - Token issuance
- `POST /oauth/register` - Client registration
- `POST /oauth/introspect` - Token introspection
- `GET /oauth/resources` - Resource metadata

---

### 2. Resource Server (`02-resource-server.ts`)
**Responsibility**: Serve protected MCP resources

```typescript
import { HttpResourceServerTransport } from '../../src/transport/http/resource-server-transport.js';
import { protectResource } from '../../src/auth/resource-server/middleware.js';

const transport = new HttpResourceServerTransport('2025-06-18', {
  enabled: true,
  authorizationServer: 'http://localhost:4000', // Where to validate tokens
});

// Protect MCP endpoints
app.get('/mcp/tools',
  protectResource({
    requiredScopes: ['mcp.tools.read'],
    requiredResource: 'mcp://tools'
  }),
  (req, res) => { /* serve tools */ }
);
```

**What it does**:
- ✅ Serves MCP resources (tools, prompts, etc.)
- ✅ Validates access tokens
- ✅ Enforces scopes
- ✅ Enforces resource indicators (RFC 8707)
- ✅ Implements MCP protocol

**What it does NOT do**:
- ❌ Does NOT issue tokens
- ❌ Does NOT register clients
- ❌ Does NOT provide JWKS (uses auth server's)
- ❌ Does NOT handle authorization flows

**Endpoints**:
- `GET /health` - Health check (public)
- `GET /protocol` - Protocol discovery (public)
- `GET /mcp/tools` - Tools API (protected)
- `POST /mcp/tools/execute` - Execute tools (protected)
- All MCP endpoints (protected)

---

### 3. OAuth Client (`03-oauth-client.ts`)
**Responsibility**: Obtain and use access tokens

```typescript
import { OAuthClient } from '../../src/auth/client/oauth-client.js';

const client = new OAuthClient({
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  authorizationServer: 'http://localhost:4000',
});

// Get token
const tokens = await client.getClientCredentialsToken('mcp.tools.read', 'mcp://tools');

// Access protected resource
const response = await client.fetch('http://localhost:3000/mcp/tools');
```

**What it does**:
- ✅ Obtains access tokens from auth server
- ✅ Stores tokens securely
- ✅ Refreshes expired tokens automatically
- ✅ Injects tokens in requests
- ✅ Handles authorization code flow with PKCE
- ✅ Handles client credentials flow

**What it does NOT do**:
- ❌ Does NOT issue tokens
- ❌ Does NOT serve resources
- ❌ Does NOT validate tokens (just uses them)

---

## Running the Examples

### Start All Three Roles

**Terminal 1: Authorization Server**
```bash
npm run example:oauth:auth-server
```
Starts on http://localhost:4000

**Terminal 2: Resource Server**
```bash
npm run example:oauth:resource-server
```
Starts on http://localhost:3000

**Terminal 3: OAuth Client**
```bash
npm run example:oauth:client
```
Demonstrates token acquisition and usage

### Interactive Authorization Code Flow

**NEW! Interactive demo with HTML consent page**

```bash
npm run example:oauth:interactive
```

This starts a complete interactive OAuth 2.0 flow:
- **Authorization Server** with interactive consent page (port 4000)
- **Resource Server** with protected MCP resources (port 3000)
- **Demo Web Application** that initiates OAuth flow (port 8080)

**Try it out**:
1. Open your browser to http://localhost:8080
2. Click "Login with OAuth"
3. See the beautiful consent page
4. Click "Authorize" to approve access
5. Get redirected back with access token
6. View protected MCP tools

**Features demonstrated**:
- ✅ Full authorization code flow with PKCE
- ✅ Interactive user consent (approve/deny)
- ✅ Authorization code generation and exchange
- ✅ Token-based access to protected resources
- ✅ Beautiful, responsive consent UI
- ✅ Real browser-based flow

---

## Interactive Consent Page

The authorization server can show an interactive consent page when configured:

```typescript
const authServer = new AuthorizationServer({
  issuer: 'http://localhost:4000',
  port: 4000,
  staticFilesPath: path.join(__dirname, 'static'), // Serve consent.html
  interactiveConsent: true, // Enable interactive flow
});
```

**Consent Page Features**:
- Shows application name and requested permissions
- Displays scopes with human-readable descriptions
- Shows resource indicators (which APIs will be accessed)
- Beautiful, responsive UI with modern design
- Security warnings and notes
- Approve/Deny buttons

**How it works**:
1. User visits `/oauth/authorize` with OAuth parameters
2. Authorization server redirects to `/static/consent.html` with parameters
3. Consent page displays permissions and prompts user
4. User clicks "Authorize" → redirects to `/oauth/authorize/approve`
5. Server generates authorization code and redirects to client
6. Client exchanges code for access token

**Auto-approve mode** (for testing):
```typescript
const authServer = new AuthorizationServer({
  issuer: 'http://localhost:4000',
  interactiveConsent: false, // Auto-approve (default)
});
```

---

## Flow Diagram

```
┌─────────────────────┐
│                     │
│  OAuth Client       │
│  (MCP Client)       │
│                     │
└──────┬───────┬──────┘
       │       │
       │ (1)   │ (3)
       │ Get   │ Use
       │ Token │ Token
       │       │
       ▼       ▼
┌──────────────────────┐      ┌──────────────────────┐
│                      │      │                      │
│ Authorization Server │      │  Resource Server     │
│                      │ (2)  │  (MCP Server)        │
│ Issues Tokens        ├─────>│  Validates Tokens    │
│                      │ JWKS │  Serves Resources    │
└──────────────────────┘      └──────────────────────┘
     localhost:4000               localhost:3000
```

**Flow**:
1. Client requests token from Authorization Server
2. Resource Server fetches JWKS from Authorization Server (once, cached)
3. Client uses token to access Resource Server
4. Resource Server validates token using JWKS

---

## Key Differences

| Feature | Authorization Server | Resource Server | Client |
|---------|---------------------|-----------------|--------|
| **Issues Tokens** | ✅ Yes | ❌ No | ❌ No |
| **Validates Tokens** | ✅ Yes (introspection) | ✅ Yes (JWT/JWKS) | ❌ No |
| **Serves MCP Resources** | ❌ No | ✅ Yes | ❌ No |
| **Obtains Tokens** | ❌ No | ❌ No | ✅ Yes |
| **Client Registration** | ✅ Yes | ❌ No | ❌ No |
| **PKCE Handling** | ✅ Yes | ❌ No | ✅ Yes (generation) |
| **OAuth Endpoints** | ✅ Yes | ❌ No | ❌ No |
| **MCP Protocol** | ❌ No | ✅ Yes | ✅ Yes |

---

## Security Benefits of Separation

### 1. **Principle of Least Privilege**
- Authorization Server handles sensitive operations (token issuance)
- Resource Server only needs public keys for validation
- Clear security boundaries

### 2. **Scalability**
- Multiple resource servers can use one authorization server
- Resource servers can scale independently
- Authorization server can be hardened separately

### 3. **Key Management**
- Private keys stay on authorization server only
- Resource servers only need public keys (JWKS)
- Easier key rotation

### 4. **Flexibility**
- Can swap resource servers without changing auth
- Can have multiple MCP servers sharing auth
- Different security policies per server

---

## Testing the Separation

### 1. Try accessing resource without token (should fail)
```bash
curl http://localhost:3000/mcp/tools
# Expected: 401 Unauthorized
```

### 2. Get token from auth server
```bash
curl -X POST http://localhost:4000/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_SECRET",
    "scope": "mcp.tools.read",
    "resource": "mcp://tools"
  }'
```

### 3. Use token to access resource (should succeed)
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/mcp/tools
# Expected: 200 OK with tools list
```

---

## Production Deployment

### Recommended Topology

```
Internet
   │
   ▼
┌─────────────────┐
│   API Gateway   │ ← SSL/TLS termination
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌─────────────┐
│  Auth  │ │  Resource   │
│ Server │ │  Servers    │
│  (1x)  │ │ (multiple)  │
└────────┘ └─────────────┘
    │            │
    ▼            ▼
┌────────────────────┐
│     Database       │
└────────────────────┘
```

**Best Practices**:
1. **Authorization Server**:
   - High security zone
   - Minimal attack surface
   - Rate limiting
   - Audit logging

2. **Resource Servers**:
   - Scale horizontally
   - Cache JWKS responses
   - Validate tokens locally (JWT)
   - No shared secrets needed

3. **Network**:
   - HTTPS everywhere
   - Internal network for DB
   - OAuth server in DMZ

---

## 🧪 Testing

### Run All OAuth Tests (20 tests)

```bash
npm test tests/oauth.test.ts
```

All 20 tests should pass, covering:
- OAuth server discovery (RFC 8414)
- JWKS endpoint
- Dynamic client registration (confidential & public clients)
- PKCE generation and validation
- Authorization code flow with PKCE
- Client credentials grant
- Refresh token grant
- Token introspection
- Resource indicators (RFC 8707)

### Run Complete Integration Test

```bash
npm run example:oauth:test-flow
```

This validates the complete end-to-end flow:
- ✅ Auth server issues tokens
- ✅ Resource server fetches JWKS and validates tokens
- ✅ Client obtains tokens and accesses protected resources

### Run Interactive Authorization Code Flow Test

```bash
npm run example:oauth:test-interactive
```

This validates the interactive OAuth 2.0 flow (6 tests):
- ✅ Interactive consent enabled
- ✅ Authorization redirects to consent page
- ✅ Consent page is served correctly
- ✅ User approval generates authorization code
- ✅ Code exchange for tokens works
- ✅ Tokens work to access protected resources

### Run Edge Cases Test

```bash
npm run example:oauth:edge-cases
```

This validates error handling and edge cases (5 tests):
- ✅ Missing authentication → 401 Unauthorized
- ✅ Invalid token format → 401 Unauthorized
- ✅ Valid credentials → 200 OK
- ✅ Insufficient scope → 403 Forbidden
- ✅ Wrong resource → 403 Forbidden

### Run Token Revocation Test (RFC 7009)

```bash
npm run example:oauth:test-revocation
```

This validates token revocation functionality (6 tests):
- ✅ Token is valid before revocation
- ✅ Token revocation endpoint works
- ✅ Returns HTTP 200 per RFC 7009
- ✅ Handles invalid tokens gracefully
- ✅ Accepts revocation without client auth (public clients)
- ✅ Supports both access_token and refresh_token hints

---

## 🏢 Testing Enterprise MCP Tool Servers

### Overview

Enterprise MCP tool servers integrate with the OAuth 2.0 infrastructure to provide secure, token-based access to business-critical tools and resources. This section explains how to test your enterprise MCP servers with OAuth 2.0 protection.

### Prerequisites

Before testing enterprise MCP servers, ensure you have:
1. ✅ Authorization Server running (port 4000)
2. ✅ OAuth client credentials (from dynamic registration)
3. ✅ Required scopes defined for your tools
4. ✅ Resource indicators configured (e.g., `mcp://enterprise/tools`)

### Step 1: Configure Your Enterprise MCP Server

Add OAuth 2.0 protection to your enterprise MCP server:

```typescript
import { HttpResourceServerTransport } from './src/transport/http/resource-server-transport.js';
import { protectResource } from './src/auth/resource-server/middleware.js';
import express from 'express';

// Initialize with OAuth 2.0 support
const transport = new HttpResourceServerTransport('2025-06-18', {
  enabled: true,
  authorizationServer: 'http://localhost:4000', // Your auth server
});

await transport.initialize({
  type: 'http',
  host: 'localhost',
  port: 5000, // Your server port
  cors: true,
});

const app = transport.getApp();

// Protect your enterprise tools endpoint
app.get(
  '/mcp/enterprise/tools',
  protectResource({
    requiredScopes: ['enterprise.tools.read'],
    requiredResource: 'mcp://enterprise/tools',
  }),
  (req, res) => {
    res.json({
      tools: [
        {
          name: 'crm-lookup',
          description: 'Query CRM customer data',
          inputSchema: {
            type: 'object',
            properties: {
              customerId: { type: 'string' }
            }
          }
        },
        {
          name: 'database-query',
          description: 'Execute SQL queries on enterprise database',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              database: { type: 'string' }
            }
          }
        }
      ]
    });
  }
);

// Protect tool execution endpoint
app.post(
  '/mcp/enterprise/tools/execute',
  protectResource({
    requiredScopes: ['enterprise.tools.execute'],
    requiredResource: 'mcp://enterprise/tools',
  }),
  (req, res) => {
    const { toolName, arguments: args } = req.body;

    // Execute tool logic here
    res.json({
      result: `Executed ${toolName}`,
      success: true
    });
  }
);

await transport.start();
console.log('Enterprise MCP Server running on port 5000');
```

### Step 2: Register Your Enterprise Application

Register your enterprise client application:

```bash
curl -X POST http://localhost:4000/oauth/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Enterprise AI Assistant",
    "client_type": "confidential",
    "redirect_uris": ["https://your-app.company.com/callback"],
    "grant_types": ["client_credentials", "authorization_code"],
    "scope": "enterprise.tools.read enterprise.tools.execute"
  }'
```

**Response:**
```json
{
  "client_id": "client_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "client_secret": "secret_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
  "client_name": "Enterprise AI Assistant",
  "client_type": "confidential",
  "grant_types": ["client_credentials", "authorization_code"],
  "redirect_uris": ["https://your-app.company.com/callback"],
  "scope": "enterprise.tools.read enterprise.tools.execute"
}
```

Save the `client_id` and `client_secret` securely!

### Step 3: Obtain Access Token

Use client credentials flow for server-to-server access:

```bash
curl -X POST http://localhost:4000/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "client_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "client_secret": "secret_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
    "scope": "enterprise.tools.read enterprise.tools.execute",
    "resource": "mcp://enterprise/tools"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "enterprise.tools.read enterprise.tools.execute",
  "resource": ["mcp://enterprise/tools"]
}
```

### Step 4: Access Protected Enterprise Tools

**List Available Tools:**
```bash
curl -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  http://localhost:5000/mcp/enterprise/tools
```

**Expected Response:**
```json
{
  "tools": [
    {
      "name": "crm-lookup",
      "description": "Query CRM customer data",
      "inputSchema": { ... }
    },
    {
      "name": "database-query",
      "description": "Execute SQL queries on enterprise database",
      "inputSchema": { ... }
    }
  ]
}
```

**Execute a Tool:**
```bash
curl -X POST http://localhost:5000/mcp/enterprise/tools/execute \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "crm-lookup",
    "arguments": {
      "customerId": "CUST-12345"
    }
  }'
```

### Step 5: Test Error Cases

**Missing Token (401 Unauthorized):**
```bash
curl -v http://localhost:5000/mcp/enterprise/tools
# Expected: HTTP 401 with error: "invalid_token"
```

**Invalid Token (401 Unauthorized):**
```bash
curl -H "Authorization: Bearer invalid_token_here" \
  http://localhost:5000/mcp/enterprise/tools
# Expected: HTTP 401 with error: "invalid_token"
```

**Insufficient Scope (403 Forbidden):**
```bash
# Get token with only 'enterprise.tools.read' scope
curl -X POST http://localhost:4000/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_SECRET",
    "scope": "enterprise.tools.read",
    "resource": "mcp://enterprise/tools"
  }'

# Try to execute tool (requires 'enterprise.tools.execute')
curl -X POST http://localhost:5000/mcp/enterprise/tools/execute \
  -H "Authorization: Bearer <token_from_above>" \
  -H "Content-Type: application/json" \
  -d '{"toolName": "crm-lookup", "arguments": {}}'

# Expected: HTTP 403 with error: "insufficient_scope"
```

**Wrong Resource (403 Forbidden):**
```bash
# Get token for different resource
curl -X POST http://localhost:4000/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_SECRET",
    "scope": "enterprise.tools.read",
    "resource": "mcp://different/resource"
  }'

# Try to access enterprise tools
curl -H "Authorization: Bearer <token_from_above>" \
  http://localhost:5000/mcp/enterprise/tools

# Expected: HTTP 403 with error: "invalid_token"
```

### Step 6: Integration Testing

Create an automated test for your enterprise MCP server:

```typescript
// test-enterprise-server.ts
import { OAuthClient } from '../../src/auth/client/oauth-client.js';

async function testEnterpriseServer() {
  // Initialize OAuth client
  const client = new OAuthClient({
    clientId: process.env.ENTERPRISE_CLIENT_ID!,
    clientSecret: process.env.ENTERPRISE_CLIENT_SECRET!,
    authorizationServer: 'http://localhost:4000',
  });

  console.log('Test 1: List enterprise tools');
  const tokens = await client.getClientCredentialsToken(
    'enterprise.tools.read enterprise.tools.execute',
    'mcp://enterprise/tools'
  );

  const toolsResponse = await client.fetch(
    'http://localhost:5000/mcp/enterprise/tools'
  );
  const tools = await toolsResponse.json();
  console.log('✅ Tools retrieved:', tools.tools.length);

  console.log('\nTest 2: Execute enterprise tool');
  const executeResponse = await client.fetch(
    'http://localhost:5000/mcp/enterprise/tools/execute',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'crm-lookup',
        arguments: { customerId: 'CUST-12345' }
      })
    }
  );
  const result = await executeResponse.json();
  console.log('✅ Tool executed:', result);

  console.log('\nTest 3: Verify token scope enforcement');
  const limitedClient = new OAuthClient({
    clientId: process.env.ENTERPRISE_CLIENT_ID!,
    clientSecret: process.env.ENTERPRISE_CLIENT_SECRET!,
    authorizationServer: 'http://localhost:4000',
  });

  const limitedTokens = await limitedClient.getClientCredentialsToken(
    'enterprise.tools.read', // Only read, not execute
    'mcp://enterprise/tools'
  );

  try {
    await limitedClient.fetch(
      'http://localhost:5000/mcp/enterprise/tools/execute',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'crm-lookup',
          arguments: {}
        })
      }
    );
    console.log('❌ Should have been forbidden');
  } catch (error) {
    console.log('✅ Correctly rejected insufficient scope');
  }

  console.log('\n✅ All enterprise server tests passed!');
}

testEnterpriseServer().catch(console.error);
```

### Step 7: Performance Testing

Test your enterprise server under load:

```bash
# Install Apache Bench
apt-get install apache2-utils

# Get access token
export TOKEN="eyJhbGciOiJSUzI1NiIs..."

# Test with 100 concurrent requests
ab -n 1000 -c 100 \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/mcp/enterprise/tools

# Monitor server logs for performance metrics
```

### Best Practices for Enterprise MCP Servers

1. **Granular Scopes**: Define specific scopes for different operations
   ```
   enterprise.tools.read       - List available tools
   enterprise.tools.execute    - Execute tools
   enterprise.data.read        - Read enterprise data
   enterprise.data.write       - Modify enterprise data
   enterprise.admin            - Administrative operations
   ```

2. **Resource Indicators**: Use hierarchical resource identifiers
   ```
   mcp://enterprise/tools
   mcp://enterprise/crm
   mcp://enterprise/database
   mcp://enterprise/analytics
   ```

3. **Audit Logging**: Log all OAuth-protected access
   ```typescript
   app.use((req, res, next) => {
     if (req.auth) {
       logger.info('OAuth Access', {
         client_id: req.auth.client_id,
         scope: req.auth.scope,
         resource: req.auth.resource,
         endpoint: req.path,
         timestamp: new Date().toISOString()
       });
     }
     next();
   });
   ```

4. **Rate Limiting**: Protect against abuse
   ```typescript
   import rateLimit from 'express-rate-limit';

   const enterpriseLimiter = rateLimit({
     windowMs: 60 * 1000, // 1 minute
     max: 100, // 100 requests per minute per client
     keyGenerator: (req) => req.auth?.client_id || req.ip
   });

   app.use('/mcp/enterprise', enterpriseLimiter);
   ```

5. **Health Checks**: Monitor OAuth integration
   ```typescript
   app.get('/health', async (req, res) => {
     try {
       // Verify auth server is reachable
       const jwksResponse = await fetch(
         'http://localhost:4000/oauth/jwks'
       );
       const jwksOk = jwksResponse.ok;

       res.json({
         status: jwksOk ? 'healthy' : 'degraded',
         oauth: {
           authServer: 'http://localhost:4000',
           jwksAccessible: jwksOk
         },
         timestamp: new Date().toISOString()
       });
     } catch (error) {
       res.status(503).json({
         status: 'unhealthy',
         error: error.message
       });
     }
   });
   ```

### Troubleshooting Enterprise Servers

**Problem: "JWKS fetch failed"**
```
[ResourceServer] Failed to fetch JWKS
Error: connect ECONNREFUSED 127.0.0.1:4000
```

**Solution:**
- Ensure authorization server is running on port 4000
- Check network connectivity between servers
- Verify firewall rules allow access to JWKS endpoint
- Check auth server logs: `npm run example:oauth:auth-server`

**Problem: "Token validation fails intermittently"**

**Solution:**
- Implement JWKS caching to reduce network calls
- Add retry logic with exponential backoff
- Monitor auth server health and performance

**Problem: "Scope requirements unclear"**

**Solution:**
- Document all available scopes in API documentation
- Return clear error messages indicating required scopes
- Use OpenAPI/Swagger spec to define scope requirements

---

## 🐛 Troubleshooting

### "invalid signature" Error

**Cause**: Resource server can't validate token with auth server's public key

**Solution**: Ensure resource server can fetch JWKS. Check logs for:
```
[ResourceServer] Fetching JWKS from: http://localhost:4000/oauth/jwks
[ResourceServer] Successfully fetched public key from JWKS
[ResourceServer] Key ID: abc123...
```

### "insufficient_scope" Error

**Cause**: Token doesn't have required scope for endpoint

**Solution**: Request correct scopes when obtaining token:
```typescript
const tokens = await client.getClientCredentialsToken(
  'mcp.tools.read',  // ← Must match endpoint requirement
  'mcp://tools'
);
```

### "invalid_token - Token not authorized for resource"

**Cause**: Token issued for different resource

**Solution**: Request token for correct resource indicator:
```typescript
const tokens = await client.getClientCredentialsToken(
  'mcp.tools.read',
  'mcp://tools'  // ← Must match endpoint resource
);
```

---

## 📚 Token Structure

### Access Token (JWT)

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "key-id-here"
}
.
{
  "iss": "http://localhost:4000",
  "sub": "client_abc123",
  "client_id": "client_abc123",
  "scope": "mcp.tools.read",
  "resource": ["mcp://tools"],
  "iat": 1234567890,
  "exp": 1234571490,
  "jti": "unique-token-id",
  "token_type": "access_token"
}
.
[signature]
```

### Token Response

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
  "scope": "mcp.tools.read",
  "resource": ["mcp://tools"]
}
```

---

## 💡 Common Use Cases

### Use Case 1: Server-to-Server API Access

```typescript
// Service A accessing MCP Service B
const client = new OAuthClient({
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  authorizationServer: 'https://auth.example.com',
});

const tokens = await client.getClientCredentialsToken(
  'mcp.tools.execute',
  'mcp://tools'
);

const response = await client.fetch('https://mcp-service.example.com/mcp/tools');
```

### Use Case 2: Multi-Resource Access

```typescript
// Request tokens for multiple resources
const tokens = await client.getClientCredentialsToken(
  'mcp.tools.read mcp.resources.read',
  ['mcp://tools', 'mcp://resources']
);

// Token is valid for both resources
await client.fetch('https://service1.example.com/mcp/tools');
await client.fetch('https://service2.example.com/mcp/resources');
```

### Use Case 3: Token Revocation (RFC 7009)

```typescript
// Logout or security event - revoke active tokens
const client = new OAuthClient({
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
  authorizationServer: 'https://auth.example.com',
});

// Get token
const tokens = await client.getClientCredentialsToken('mcp.tools.read');

// Use token for a while...
await client.fetch('https://api.example.com/mcp/tools');

// Revoke token when done or on logout
await fetch('https://auth.example.com/oauth/revoke', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: tokens.access_token,
    token_type_hint: 'access_token',
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
  }),
});

console.log('Token revoked successfully');
```

**When to revoke tokens:**
- User logout
- Security breach detected
- Client application uninstalled
- Token no longer needed
- Session timeout

**Benefits:**
- Improved security (invalidate compromised tokens)
- Resource cleanup (remove unused tokens)
- Compliance (GDPR, data privacy)
- Audit trail (track token lifecycle)

---

## 🔒 Production Security Checklist

✅ **HTTPS Everywhere**
```typescript
const authServer = new AuthorizationServer({
  host: 'auth.example.com',
  port: 443,
  issuer: 'https://auth.example.com',
  https: {
    key: fs.readFileSync('privkey.pem'),
    cert: fs.readFileSync('cert.pem'),
  },
});
```

✅ **Rate Limiting**
```typescript
import rateLimit from 'express-rate-limit';

const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests
});

app.post('/oauth/token', tokenLimiter, ...);
```

✅ **Persistent Storage**
- Replace in-memory stores with database (PostgreSQL, MongoDB)
- Use Redis for tokens and authorization codes
- Implement token revocation lists

✅ **Audit Logging**
- Log all OAuth operations (token issuance, validation, errors)
- Include client_id, grant_type, IP, timestamp
- Monitor for suspicious patterns

✅ **Key Rotation**
- Implement automatic key rotation (e.g., monthly)
- Support multiple active keys in JWKS
- Graceful key rollover period

---

## Further Reading

- [RFC 6749](https://tools.ietf.org/html/rfc6749) - OAuth 2.0 Framework
- [RFC 7009](https://tools.ietf.org/html/rfc7009) - Token Revocation
- [RFC 7519](https://tools.ietf.org/html/rfc7519) - JSON Web Token (JWT)
- [RFC 7636](https://tools.ietf.org/html/rfc7636) - PKCE
- [RFC 7591](https://tools.ietf.org/html/rfc7591) - Dynamic Client Registration
- [RFC 7662](https://tools.ietf.org/html/rfc7662) - Token Introspection
- [RFC 8414](https://tools.ietf.org/html/rfc8414) - Authorization Server Metadata
- [RFC 8707](https://tools.ietf.org/html/rfc8707) - Resource Indicators
- [OAuth 2.1](https://oauth.net/2.1/) - OAuth 2.1 (draft)
- [MCP Specification](https://modelcontextprotocol.io)
- [JWT.io](https://jwt.io/) - Decode and verify JWTs
