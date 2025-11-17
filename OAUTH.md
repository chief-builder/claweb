# OAuth 2.0 and RFC 8707 Resource Indicators

Complete OAuth 2.0 implementation with RFC 8707 Resource Indicators for MCP HTTP transport.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [OAuth 2.0 Features](#oauth-20-features)
- [RFC 8707 Resource Indicators](#rfc-8707-resource-indicators)
- [API Endpoints](#api-endpoints)
- [Grant Types](#grant-types)
- [Security Features](#security-features)
- [Configuration](#configuration)
- [Examples](#examples)
- [Testing](#testing)

## Overview

This implementation provides a complete OAuth 2.0 authorization server integrated with the MCP HTTP transport layer. It includes:

- **RFC 8414**: Authorization Server Metadata (Discovery)
- **RFC 7636**: Proof Key for Code Exchange (PKCE)
- **RFC 7591**: Dynamic Client Registration
- **RFC 7662**: Token Introspection
- **RFC 8707**: Resource Indicators for OAuth 2.0
- **JWT Bearer Tokens** with RS256 algorithm
- **Express Middleware** for authentication and authorization

## Quick Start

### Enable OAuth in HTTP Transport

```typescript
import { HttpServerTransport } from './transport/http/server.js';
import { TransportType } from './transport/base.js';

const transport = new HttpServerTransport(
  '2025-06-18', // MCP protocol version
  {
    enabled: true,
    issuer: 'http://localhost:3000',
  }
);

await transport.initialize({
  type: TransportType.HTTP,
  host: 'localhost',
  port: 3000,
  cors: true,
});
```

### Discover OAuth Server

```bash
curl http://localhost:3000/.well-known/oauth-authorization-server
```

### Register a Client

```bash
curl -X POST http://localhost:3000/oauth/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "My MCP Client",
    "client_type": "confidential",
    "redirect_uris": ["http://localhost:8080/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "scope": "mcp.tools.read mcp.tools.execute"
  }'
```

## OAuth 2.0 Features

### Authorization Server Discovery (RFC 8414)

Provides server metadata and capabilities.

**Endpoint**: `GET /.well-known/oauth-authorization-server`

**Response**:
```json
{
  "issuer": "http://localhost:3000",
  "authorization_endpoint": "http://localhost:3000/oauth/authorize",
  "token_endpoint": "http://localhost:3000/oauth/token",
  "jwks_uri": "http://localhost:3000/oauth/jwks",
  "registration_endpoint": "http://localhost:3000/oauth/register",
  "scopes_supported": [
    "mcp.tools.read",
    "mcp.tools.execute",
    "mcp.resources.read",
    "mcp.prompts.read",
    "mcp.admin"
  ],
  "grant_types_supported": [
    "authorization_code",
    "client_credentials",
    "refresh_token"
  ],
  "code_challenge_methods_supported": ["S256", "plain"],
  "resource_indicators_supported": true,
  "mcp_version": "2025-06-18"
}
```

### PKCE (RFC 7636)

Protects against authorization code interception attacks.

**Supported Methods**:
- `S256`: SHA-256 hash (recommended)
- `plain`: Plain text (not recommended for production)

**Example** (TypeScript):
```typescript
import { PKCEService, CodeChallengeMethod } from './auth/oauth/pkce.js';

// Generate PKCE parameters
const pkce = PKCEService.generatePKCEParams(CodeChallengeMethod.S256);
console.log(pkce.codeVerifier);    // Store securely
console.log(pkce.codeChallenge);   // Send in authorization request
console.log(pkce.codeChallengeMethod); // 'S256'
```

### JWT Bearer Tokens

Stateless authentication using JSON Web Tokens.

**Features**:
- RS256 algorithm with auto-generated RSA key pairs
- Access tokens (1 hour validity)
- Refresh tokens (7 days validity)
- JWKS endpoint for public key distribution
- Custom MCP claims

**Token Payload**:
```json
{
  "iss": "http://localhost:3000",
  "sub": "client_abc123",
  "client_id": "client_abc123",
  "scope": "mcp.tools.read mcp.tools.execute",
  "resource": ["mcp://tools"],
  "iat": 1234567890,
  "exp": 1234571490,
  "token_type": "access_token",
  "mcp_version": "2025-06-18"
}
```

### Dynamic Client Registration (RFC 7591)

Self-service client onboarding.

**Client Types**:
- **Confidential**: Server-side applications (receives client_secret)
- **Public**: Browser/mobile apps (no secret, must use PKCE)

**Request**:
```json
{
  "client_name": "My Application",
  "client_type": "confidential",
  "redirect_uris": ["https://app.example.com/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "scope": "mcp.tools.read"
}
```

**Response**:
```json
{
  "client_id": "client_abc123xyz",
  "client_secret": "secret_xyz789abc",
  "client_id_issued_at": 1234567890,
  "client_secret_expires_at": 0,
  "redirect_uris": ["https://app.example.com/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "client_type": "confidential",
  "mcp_version": "2025-06-18"
}
```

### Token Introspection (RFC 7662)

Validate and inspect OAuth tokens.

**Endpoint**: `POST /oauth/introspect`

**Request**:
```bash
curl -X POST http://localhost:3000/oauth/introspect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"token": "TOKEN_TO_INSPECT"}'
```

**Response**:
```json
{
  "active": true,
  "client_id": "client_abc123",
  "scope": "mcp.tools.read mcp.tools.execute",
  "exp": 1234571490,
  "iat": 1234567890,
  "token_type": "access_token",
  "resource": ["mcp://tools"]
}
```

## RFC 8707 Resource Indicators

Scope tokens to specific resource servers for improved security.

### Registered MCP Resources

| Resource URI | Scopes | Description |
|--------------|--------|-------------|
| `mcp://tools` | `mcp.tools.read`, `mcp.tools.execute` | MCP Tools API |
| `mcp://resources` | `mcp.resources.read` | MCP Resources API |
| `mcp://prompts` | `mcp.prompts.read` | MCP Prompts API |
| `mcp://admin` | `mcp.admin` | MCP Administrative API |

### Resource Metadata Endpoint

**Endpoint**: `GET /oauth/resources`

**Response**:
```json
{
  "resources": [
    {
      "uri": "mcp://tools",
      "scopes": ["mcp.tools.read", "mcp.tools.execute"],
      "description": "MCP Tools API"
    },
    {
      "uri": "mcp://resources",
      "scopes": ["mcp.resources.read"],
      "description": "MCP Resources API"
    }
  ]
}
```

### Using Resource Indicators

**Authorization Request**:
```
GET /oauth/authorize?
  response_type=code&
  client_id=client_abc123&
  redirect_uri=https://app.example.com/callback&
  scope=mcp.tools.read&
  resource=mcp://tools&
  state=xyz123
```

**Token Request**:
```bash
curl -X POST http://localhost:3000/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "client_abc123",
    "client_secret": "secret_xyz",
    "scope": "mcp.tools.execute",
    "resource": "mcp://tools"
  }'
```

The resulting token will be valid **only** for `mcp://tools` resource.

## API Endpoints

### Discovery & Metadata

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/.well-known/oauth-authorization-server` | Server discovery metadata |
| GET | `/oauth/jwks` | JSON Web Key Set |
| GET | `/oauth/resources` | Resource metadata (RFC 8707) |

### Core OAuth Flow

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/oauth/authorize` | Authorization endpoint |
| POST | `/oauth/token` | Token endpoint |
| POST | `/oauth/register` | Dynamic client registration |
| POST | `/oauth/introspect` | Token introspection |

## Grant Types

### 1. Authorization Code Flow (with PKCE)

**Recommended for**: Web applications, mobile apps, SPAs

**Step 1: Generate PKCE Parameters**
```typescript
const pkce = PKCEService.generatePKCEParams(CodeChallengeMethod.S256);
```

**Step 2: Authorization Request**
```
GET /oauth/authorize?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=YOUR_REDIRECT_URI&
  scope=mcp.tools.read&
  state=RANDOM_STATE&
  code_challenge=CODE_CHALLENGE&
  code_challenge_method=S256&
  resource=mcp://tools
```

**Step 3: Exchange Code for Token**
```bash
curl -X POST http://localhost:3000/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "AUTHORIZATION_CODE",
    "redirect_uri": "YOUR_REDIRECT_URI",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "code_verifier": "CODE_VERIFIER"
  }'
```

**Response**:
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_token_xyz",
  "scope": "mcp.tools.read",
  "resource": ["mcp://tools"]
}
```

### 2. Client Credentials Flow

**Recommended for**: Server-to-server communication

```bash
curl -X POST http://localhost:3000/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "scope": "mcp.tools.execute",
    "resource": "mcp://tools"
  }'
```

**Response**:
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "mcp.tools.execute",
  "resource": ["mcp://tools"]
}
```

### 3. Refresh Token Flow

```bash
curl -X POST http://localhost:3000/oauth/token \
  -H "Content-Type": application/json" \
  -d '{
    "grant_type": "refresh_token",
    "refresh_token": "YOUR_REFRESH_TOKEN"
  }'
```

## Security Features

### 1. PKCE (Proof Key for Code Exchange)

- Prevents authorization code interception
- Required for public clients
- Recommended for all clients
- Supports S256 (SHA-256) and plain methods

### 2. Resource Indicators (RFC 8707)

- Limits token scope to specific resources
- Prevents token misuse across services
- Fine-grained access control
- Resource-scope validation

### 3. Token Security

- Short-lived access tokens (1 hour)
- Longer-lived refresh tokens (7 days)
- RS256 signature algorithm
- Key rotation support via JWKS

### 4. Client Authentication

- Client secret for confidential clients
- HTTPS required for redirect URIs (except localhost)
- Automatic client ID/secret generation
- Token endpoint authentication

### 5. Middleware Protection

Use OAuth middleware to protect MCP endpoints:

```typescript
import { protect } from './auth/middleware/oauth.js';

// Protect an endpoint with required scopes and resource
app.get('/mcp/tools',
  protect({
    requiredScopes: ['mcp.tools.read'],
    requiredResource: 'mcp://tools'
  }),
  (req, res) => {
    // Access granted - req.oauth contains token info
    res.json({ tools: [...] });
  }
);
```

## Configuration

### HTTP Transport with OAuth

```typescript
import { HttpServerTransport } from './transport/http/server.js';
import { JWTService } from './auth/oauth/jwt.js';

// Optional: Provide custom JWT service
const jwtService = new JWTService({
  algorithm: 'RS256',
  expiresIn: 7200, // 2 hours
});

const transport = new HttpServerTransport(
  '2025-06-18',
  {
    enabled: true,
    issuer: 'https://auth.example.com',
    jwtService, // Optional
  }
);
```

### Custom Resource Registration

```typescript
import { getResourceIndicatorService } from './auth/rfc8707/indicators.js';

const resourceService = getResourceIndicatorService();

// Register custom resource
resourceService.registerResource({
  uri: 'mcp://custom-api',
  scopes: ['custom.read', 'custom.write'],
  description: 'Custom API Resource',
});
```

## Examples

### Complete Authorization Code Flow

```typescript
import { PKCEService, CodeChallengeMethod } from './auth/oauth/pkce.js';

// 1. Generate PKCE parameters
const pkce = PKCEService.generatePKCEParams(CodeChallengeMethod.S256);

// 2. Redirect user to authorization endpoint
const authUrl = new URL('http://localhost:3000/oauth/authorize');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', 'YOUR_CLIENT_ID');
authUrl.searchParams.set('redirect_uri', 'http://localhost:8080/callback');
authUrl.searchParams.set('scope', 'mcp.tools.read');
authUrl.searchParams.set('state', 'random_state_123');
authUrl.searchParams.set('code_challenge', pkce.codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');
authUrl.searchParams.set('resource', 'mcp://tools');

// User is redirected to authUrl...

// 3. Handle callback (receives authorization code)
async function handleCallback(code: string) {
  const response = await fetch('http://localhost:3000/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'http://localhost:8080/callback',
      client_id: 'YOUR_CLIENT_ID',
      client_secret: 'YOUR_CLIENT_SECRET',
      code_verifier: pkce.codeVerifier,
    }),
  });

  const tokens = await response.json();
  console.log('Access Token:', tokens.access_token);
  console.log('Refresh Token:', tokens.refresh_token);

  return tokens;
}
```

### Using Access Token

```typescript
async function callProtectedEndpoint(accessToken: string) {
  const response = await fetch('http://localhost:3000/mcp/tools', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'MCP-Protocol-Version': '2025-06-18',
    },
  });

  const data = await response.json();
  return data;
}
```

### Middleware Usage

```typescript
import express from 'express';
import { protect, requireScopes, authenticate } from './auth/middleware/oauth.js';

const app = express();

// Public endpoint (no auth)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Protected endpoint (any valid token)
app.get('/api/info',
  authenticate({ optional: false }),
  (req, res) => {
    res.json({ message: 'Authenticated!' });
  }
);

// Scope-protected endpoint
app.get('/api/tools',
  protect({ requiredScopes: ['mcp.tools.read'] }),
  (req, res) => {
    res.json({ tools: [...] });
  }
);

// Resource-protected endpoint
app.get('/api/admin',
  protect({
    requiredScopes: ['mcp.admin'],
    requiredResource: 'mcp://admin'
  }),
  (req, res) => {
    res.json({ admin: 'data' });
  }
);
```

## Testing

### Run OAuth Tests

```bash
npm test tests/oauth.test.ts
```

### Test Coverage

The OAuth implementation includes 20 comprehensive integration tests:

- ✅ OAuth server discovery (RFC 8414)
- ✅ JWKS endpoint
- ✅ Dynamic client registration (confidential and public)
- ✅ PKCE generation and validation
- ✅ Authorization code flow with PKCE
- ✅ Client credentials grant
- ✅ Refresh token grant
- ✅ Token introspection
- ✅ Resource indicators (RFC 8707)
- ✅ Resource validation
- ✅ Scope validation
- ✅ Middleware authentication

### Manual Testing

**1. Discover OAuth Server**:
```bash
curl http://localhost:3000/.well-known/oauth-authorization-server | jq
```

**2. Get JWKS**:
```bash
curl http://localhost:3000/oauth/jwks | jq
```

**3. Register Client**:
```bash
curl -X POST http://localhost:3000/oauth/register \
  -H "Content-Type: application/json" \
  -d '{"client_name":"Test","client_type":"confidential","redirect_uris":["http://localhost:8080/cb"]}' | jq
```

**4. Get Client Credentials Token**:
```bash
curl -X POST http://localhost:3000/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type":"client_credentials",
    "client_id":"YOUR_CLIENT_ID",
    "client_secret":"YOUR_SECRET",
    "scope":"mcp.tools.read",
    "resource":"mcp://tools"
  }' | jq
```

**5. Introspect Token**:
```bash
curl -X POST http://localhost:3000/oauth/introspect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"token":"TOKEN_TO_INSPECT"}' | jq
```

**6. List Resources**:
```bash
curl http://localhost:3000/oauth/resources | jq
```

## Production Considerations

### Security

1. **Use HTTPS** in production
2. **Set proper issuer** URL (must match your domain)
3. **Implement rate limiting** on token endpoints
4. **Use persistent storage** for clients, tokens, and PKCE codes
5. **Rotate keys regularly** and update JWKS
6. **Validate redirect URIs** strictly
7. **Implement token revocation**
8. **Add audit logging**

### Performance

1. **Use Redis/database** for token and client storage
2. **Cache JWKS responses**
3. **Implement connection pooling**
4. **Use CDN** for static OAuth pages
5. **Monitor token validation** performance

### Scalability

1. **Use distributed cache** for session data
2. **Load balance** authorization servers
3. **Separate token** validation from issuance
4. **Consider API gateway** for rate limiting

## References

- [RFC 6749](https://tools.ietf.org/html/rfc6749) - OAuth 2.0 Authorization Framework
- [RFC 7636](https://tools.ietf.org/html/rfc7636) - Proof Key for Code Exchange (PKCE)
- [RFC 7591](https://tools.ietf.org/html/rfc7591) - Dynamic Client Registration
- [RFC 7662](https://tools.ietf.org/html/rfc7662) - Token Introspection
- [RFC 8414](https://tools.ietf.org/html/rfc8414) - Authorization Server Metadata
- [RFC 8707](https://tools.ietf.org/html/rfc8707) - Resource Indicators for OAuth 2.0
- [RFC 7519](https://tools.ietf.org/html/rfc7519) - JSON Web Token (JWT)

---

**OAuth 2.0 Implementation** - MCP Reference Implementation
