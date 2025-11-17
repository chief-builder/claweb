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

## Further Reading

- [RFC 6749](https://tools.ietf.org/html/rfc6749) - OAuth 2.0 Framework
- [RFC 8707](https://tools.ietf.org/html/rfc8707) - Resource Indicators
- [OAuth 2.1](https://oauth.net/2.1/) - OAuth 2.1 (upcoming)
- [MCP Specification](https://modelcontextprotocol.io)
