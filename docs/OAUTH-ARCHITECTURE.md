# OAuth 2.1 Architecture Overview

Architectural design and implementation details for the MCP OAuth 2.1 system with RFC 8707 Resource Indicators.

## Table of Contents

- [System Overview](#system-overview)
- [Three-Role Architecture](#three-role-architecture)
- [Component Diagram](#component-diagram)
- [Data Flow](#data-flow)
- [Key Components](#key-components)
- [Integration Points](#integration-points)
- [Deployment Architecture](#deployment-architecture)
- [Scalability & Performance](#scalability--performance)
- [Future Enhancements](#future-enhancements)

---

## System Overview

The MCP OAuth 2.1 implementation follows a **three-role separation** architecture, clearly delineating responsibilities between:

1. **Authorization Server** - Issues and manages tokens
2. **Resource Server** - Validates tokens and serves protected MCP resources
3. **OAuth Client** - Requests tokens and accesses protected resources

### Design Principles

- **Separation of Concerns** - Each role has distinct responsibilities
- **Stateless Tokens** - JWT bearer tokens enable distributed validation
- **Fine-Grained Access** - RFC 8707 resource indicators for precision
- **Security by Default** - PKCE mandatory, short lifetimes, proper validation
- **Standards Compliance** - Full RFC implementation

---

## Three-Role Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         OAuth 2.1 System                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│  Authorization       │         │  Resource Server     │
│  Server              │         │  (MCP Server)        │
│                      │         │                      │
│  Port: 4000          │         │  Port: 3000          │
│  ┌────────────────┐  │         │  ┌────────────────┐  │
│  │ Token Issuance │  │         │  │ Token          │  │
│  │ Client Reg     │  │◄────────┤  │ Validation     │  │
│  │ User Auth      │  │  JWKS   │  │ Scope Check    │  │
│  │ PKCE Validation│  │         │  │ MCP Services   │  │
│  └────────────────┘  │         │  └────────────────┘  │
└──────────────────────┘         └──────────────────────┘
           ▲                                ▲
           │ 1. Register                    │ 3. Access
           │ 2. Get Token                   │    with Token
           │                                │
           └────────────┬───────────────────┘
                        │
                ┌───────▼────────┐
                │  OAuth Client  │
                │                │
                │  ┌──────────┐  │
                │  │ Token    │  │
                │  │ Request  │  │
                │  │ Token    │  │
                │  │ Storage  │  │
                │  │ API Call │  │
                │  └──────────┘  │
                └────────────────┘
```

### Role Responsibilities

| Role | Responsibilities | Technologies |
|------|-----------------|--------------|
| **Authorization Server** | • Client registration<br>• User authentication<br>• Token issuance<br>• PKCE validation<br>• Token revocation<br>• Introspection | Express.js<br>JWT (jose)<br>In-memory storage |
| **Resource Server** | • Token validation<br>• Scope enforcement<br>• Resource protection<br>• MCP protocol<br>• JWKS fetching | Express.js<br>MCP SDK<br>JWT verification |
| **OAuth Client** | • Client registration<br>• Authorization flow<br>• Token management<br>• API requests | TypeScript<br>fetch API<br>PKCE generation |

---

## Component Diagram

```
Authorization Server (src/auth/authorization-server/)
│
├── server.ts                      # Main server setup
├── oauth-endpoints.ts             # Route handlers
│
└── OAuth Services
    ├── oauth/jwt.ts              # JWT signing & verification
    ├── oauth/registration.ts      # Client registration
    ├── oauth/introspection.ts     # Token introspection
    ├── oauth/revocation.ts        # Token revocation
    ├── oauth/pkce.ts             # PKCE generation & validation
    └── oauth/resources.ts         # Resource indicators metadata

Resource Server (src/auth/resource-server/)
│
├── middleware.ts                  # protectResource middleware
├── token-validator.ts             # Token validation logic
└── jwks-fetcher.ts               # JWKS caching & fetching

OAuth Client (src/auth/client/)
│
└── oauth-client.ts               # Client library

MCP Transport (src/transport/)
│
├── http/
│   ├── http-transport.ts         # Base HTTP transport
│   └── resource-server-transport.ts  # OAuth-enabled transport
└── base.ts                       # Transport interface
```

---

## Data Flow

### 1. Client Credentials Flow

```
Client                   Auth Server              Resource Server
  │                           │                          │
  │  1. POST /oauth/token    │                          │
  │  {grant_type: client_    │                          │
  │   credentials}            │                          │
  ├──────────────────────────>│                          │
  │                           │                          │
  │                           │ 2. Validate credentials  │
  │                           │    Generate JWT          │
  │                           │    Sign with RS256       │
  │                           │                          │
  │  3. {access_token: ...}  │                          │
  │<──────────────────────────┤                          │
  │                           │                          │
  │  4. GET /mcp/tools        │                          │
  │     Authorization: Bearer │                          │
  ├───────────────────────────┼─────────────────────────>│
  │                           │                          │
  │                           │  5. Fetch JWKS          │
  │                           │<─────────────────────────┤
  │                           │  {keys: [...]}          │
  │                           │─────────────────────────>│
  │                           │                          │
  │                           │                  6. Verify signature
  │                           │                     Validate claims
  │                           │                     Check scopes
  │                           │                          │
  │  7. {tools: [...]}        │                          │
  │<──────────────────────────┼──────────────────────────┤
  │                           │                          │
```

### 2. Authorization Code Flow with PKCE

```
Client              Auth Server            User Browser        Resource Server
  │                      │                      │                     │
  │ 1. Generate PKCE     │                      │                     │
  │    verifier &        │                      │                     │
  │    challenge         │                      │                     │
  │                      │                      │                     │
  │ 2. Redirect to       │                      │                     │
  │    /oauth/authorize  │                      │                     │
  ├──────────────────────┼─────────────────────>│                     │
  │                      │                      │                     │
  │                      │  3. Show consent     │                     │
  │                      │<─────────────────────┤                     │
  │                      │                      │                     │
  │                      │  4. User approves    │                     │
  │                      │<─────────────────────┤                     │
  │                      │                      │                     │
  │                      │  5. Store PKCE       │                     │
  │                      │     challenge        │                     │
  │                      │     Generate code    │                     │
  │                      │                      │                     │
  │                      │  6. Redirect with    │                     │
  │                      │     auth code        │                     │
  │                      ├─────────────────────>│                     │
  │                      │                      │                     │
  │  7. Auth code        │                      │                     │
  │<─────────────────────┼──────────────────────┤                     │
  │                      │                      │                     │
  │  8. POST /oauth/token│                      │                     │
  │     {code, verifier} │                      │                     │
  ├─────────────────────>│                      │                     │
  │                      │                      │                     │
  │                      │  9. Validate PKCE    │                     │
  │                      │     SHA256(verifier) │                     │
  │                      │     == challenge     │                     │
  │                      │     Generate tokens  │                     │
  │                      │                      │                     │
  │ 10. {access_token,   │                      │                     │
  │      refresh_token}  │                      │                     │
  │<─────────────────────┤                      │                     │
  │                      │                      │                     │
  │ 11. Access protected │                      │                     │
  │     resources        │                      │                     │
  ├────────────────────────────────────────────────────────────────>│
  │                      │                      │                     │
```

---

## Key Components

### 1. JWT Service

**File:** `src/auth/oauth/jwt.ts`

**Responsibilities:**
- Generate RSA key pairs
- Sign access and refresh tokens
- Verify token signatures
- Provide JWKS endpoint data

**Key Methods:**
```typescript
class JWTService {
  // Create signed access token
  createAccessToken(payload: TokenPayload): string

  // Create signed refresh token
  createRefreshToken(payload: TokenPayload): string

  // Verify token signature and claims
  verifyToken(token: string): TokenVerification

  // Get public JWKS for resource servers
  getJWKS(): JWKS
}
```

**Token Structure:**
```typescript
interface TokenPayload {
  iss: string;           // Issuer
  sub: string;           // Subject (user/client ID)
  aud: string[];         // Audience (resource indicators)
  exp: number;           // Expiration time
  iat: number;           // Issued at
  client_id: string;     // Client identifier
  scope: string;         // Space-separated scopes
  resource?: string[];   // RFC 8707 resource indicators
}
```

### 2. Client Registration Service

**File:** `src/auth/oauth/registration.ts`

**Responsibilities:**
- Register new OAuth clients
- Validate client credentials
- Store client metadata
- Generate client IDs and secrets

**Storage:**
```typescript
interface ClientInfo {
  client_id: string;
  client_secret?: string;
  client_name: string;
  client_type: 'confidential' | 'public';
  redirect_uris: string[];
  grant_types: string[];
  token_endpoint_auth_method: string;
  created_at: Date;
}

class InMemoryClientStore {
  private clients: Map<string, ClientInfo>;

  async registerClient(request: ClientRegistrationRequest): Promise<ClientInfo>
  async getClient(clientId: string): Promise<ClientInfo | null>
  async validateCredentials(clientId: string, clientSecret: string): Promise<boolean>
}
```

### 3. PKCE Service

**File:** `src/auth/oauth/pkce.ts`

**Responsibilities:**
- Generate code verifiers and challenges
- Validate PKCE parameters
- Support S256 and plain methods

**Implementation:**
```typescript
class PKCEService {
  // Generate verifier (128 chars) and challenge (SHA256 hash)
  static generatePKCEParams(method: CodeChallengeMethod): {
    codeVerifier: string;
    codeChallenge: string;
    codeChallengeMethod: string;
  }

  // Validate verifier matches challenge
  static validatePKCE(
    verifier: string,
    challenge: string,
    method: CodeChallengeMethod
  ): PKCEValidation
}
```

### 4. Token Revocation Service

**File:** `src/auth/oauth/revocation.ts`

**Responsibilities:**
- Revoke access and refresh tokens
- Maintain revocation blacklist
- Cleanup expired entries

**Data Structure:**
```typescript
interface RevokedTokenEntry {
  token: string;
  tokenType: 'access_token' | 'refresh_token';
  clientId: string;
  revokedAt: Date;
  expiresAt: Date;  // When to remove from blacklist
}

class TokenRevocationService {
  private revokedTokens: Map<string, RevokedTokenEntry>;

  async revokeToken(request: TokenRevocationRequest): Promise<void>
  isTokenRevoked(token: string): boolean
  getRevokedTokenInfo(token: string): RevokedTokenEntry | null
}
```

**Cleanup Job:**
- Runs every 5 minutes
- Removes expired tokens from blacklist
- Prevents memory growth

### 5. Resource Protection Middleware

**File:** `src/auth/resource-server/middleware.ts`

**Responsibilities:**
- Extract and validate Bearer tokens
- Verify JWT signatures
- Check token revocation
- Enforce scope requirements
- Validate resource indicators

**Usage:**
```typescript
app.get('/mcp/tools',
  protectResource({
    requiredScopes: ['mcp.tools.read'],
    requiredResource: 'mcp://tools'
  }),
  (req, res) => {
    // req.oauth contains validated token payload
    res.json({ tools: [...] });
  }
);
```

**Validation Flow:**
```typescript
async function protectResource(options) {
  return async (req, res, next) => {
    // 1. Extract Bearer token
    const token = extractBearerToken(req);

    // 2. Verify signature with JWKS
    const verification = await verifyWithJWKS(token);

    // 3. Check revocation
    const isRevoked = await checkRevocation(token);

    // 4. Validate scopes
    const hasScopes = validateScopes(
      verification.payload.scope,
      options.requiredScopes
    );

    // 5. Validate resource indicator
    const validResource = validateResource(
      verification.payload.resource,
      options.requiredResource
    );

    if (all_valid) {
      req.oauth = verification.payload;
      next();
    } else {
      res.status(401/403).json({ error: ... });
    }
  };
}
```

---

## Integration Points

### 1. Authorization Server ↔ Resource Server

**Communication:** One-way (Resource Server fetches from Auth Server)

**JWKS Endpoint:**
```http
GET http://localhost:4000/oauth/jwks
```

**Response:**
```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "key-id",
      "use": "sig",
      "alg": "RS256",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

**Caching Strategy:**
- Resource Server caches JWKS
- Cache duration: 1 hour
- Refetch on signature verification failure
- Support key rotation (multiple active keys)

### 2. Client ↔ Authorization Server

**Registration:**
```http
POST http://localhost:4000/oauth/register
Content-Type: application/json

{
  "client_name": "My Client",
  "client_type": "confidential",
  "redirect_uris": ["http://localhost:8080/callback"],
  "grant_types": ["client_credentials"],
  "scope": "mcp.tools.read"
}
```

**Token Request:**
```http
POST http://localhost:4000/oauth/token
Content-Type: application/json

{
  "grant_type": "client_credentials",
  "client_id": "client_abc123",
  "client_secret": "secret_xyz789",
  "scope": "mcp.tools.read",
  "resource": "mcp://tools"
}
```

### 3. Client ↔ Resource Server

**Authenticated Request:**
```http
GET http://localhost:3000/mcp/tools
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "tools": [
    {
      "name": "calculator",
      "description": "Perform calculations"
    }
  ]
}
```

---

## Deployment Architecture

### Development

```
┌─────────────────────────────────────────────┐
│  Single Machine                             │
│                                             │
│  ┌──────────────┐    ┌──────────────┐      │
│  │ Auth Server  │    │ Resource     │      │
│  │ :4000        │    │ Server :3000 │      │
│  │ HTTP         │    │ HTTP         │      │
│  └──────────────┘    └──────────────┘      │
│                                             │
│  Storage: In-Memory                         │
│  Keys: Generated on startup                 │
└─────────────────────────────────────────────┘
```

### Production

```
┌─────────────────────────────────────────────────────────────┐
│  Cloud Infrastructure                                       │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Load Balancer (HTTPS)                             │    │
│  └─────────┬──────────────────────────┬────────────────┘    │
│            │                          │                     │
│  ┌─────────▼────────┐      ┌─────────▼────────┐           │
│  │ Auth Server 1    │      │ Resource Server  │           │
│  │ :4000 HTTPS      │      │ Cluster          │           │
│  └──────────────────┘      │ :3000 HTTPS      │           │
│  ┌──────────────────┐      └──────────────────┘           │
│  │ Auth Server 2    │                │                     │
│  │ :4000 HTTPS      │                │                     │
│  └────────┬─────────┘                │                     │
│           │                          │                     │
│  ┌────────▼─────────────┐   ┌────────▼─────────┐          │
│  │ Redis                │   │ MCP Data Store   │          │
│  │ • Client Store       │   │ • Tools          │          │
│  │ • Token Blacklist    │   │ • Resources      │          │
│  │ • PKCE Challenges    │   │ • Prompts        │          │
│  └──────────────────────┘   └──────────────────┘          │
│                                                             │
│  ┌────────────────────┐   ┌─────────────────────┐         │
│  │ Key Vault (HSM)    │   │ Monitoring          │         │
│  │ • Signing Keys     │   │ • Logs              │         │
│  │ • Client Secrets   │   │ • Metrics           │         │
│  └────────────────────┘   │ • Alerts            │         │
│                           └─────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Scaling Considerations

**Authorization Server:**
- Stateless token issuance (horizontal scaling)
- Shared Redis for client store and PKCE challenges
- Shared revocation blacklist
- Load balancer with session affinity (optional)

**Resource Server:**
- Stateless token validation (horizontal scaling)
- JWKS caching per instance
- No shared state required
- Auto-scaling based on request volume

---

## Scalability & Performance

### Current Implementation

**Bottlenecks:**
- In-memory storage (not distributed)
- No connection pooling
- No caching layer
- Synchronous JWKS fetch

**Performance Metrics:**
- Token issuance: ~50ms
- Token validation: ~10ms (with cached JWKS)
- Authorization flow: ~200ms
- Revocation: ~5ms

### Production Optimizations

#### 1. Distributed Storage

```typescript
// Replace in-memory with Redis
import Redis from 'ioredis';

class RedisClientStore implements ClientStore {
  private redis: Redis;

  async registerClient(client: ClientInfo): Promise<void> {
    await this.redis.setex(
      `client:${client.client_id}`,
      86400 * 30, // 30 days TTL
      JSON.stringify(client)
    );
  }

  async getClient(clientId: string): Promise<ClientInfo | null> {
    const data = await this.redis.get(`client:${clientId}`);
    return data ? JSON.parse(data) : null;
  }
}
```

#### 2. JWKS Caching

```typescript
class JWKSCache {
  private cache: Map<string, { jwks: JWKS; expiry: number }>;

  async getJWKS(uri: string): Promise<JWKS> {
    const cached = this.cache.get(uri);

    if (cached && cached.expiry > Date.now()) {
      return cached.jwks;
    }

    // Fetch and cache
    const jwks = await fetch(uri).then(r => r.json());

    this.cache.set(uri, {
      jwks,
      expiry: Date.now() + 3600 * 1000 // 1 hour
    });

    return jwks;
  }
}
```

#### 3. Connection Pooling

```typescript
// HTTP agent with keep-alive
import { Agent } from 'http';

const agent = new Agent({
  keepAlive: true,
  maxSockets: 50,
  keepAliveMsecs: 60000
});

fetch(url, { agent });
```

#### 4. Request Batching

```typescript
// Batch introspection requests
class IntrospectionBatcher {
  async introspectBatch(tokens: string[]): Promise<Map<string, IntrospectionResult>> {
    // Single request for multiple tokens
    const results = await this.batchIntrospect(tokens);
    return new Map(tokens.map((token, i) => [token, results[i]]));
  }
}
```

### Monitoring Metrics

**Key Metrics:**
```typescript
interface Metrics {
  // Request rates
  tokenRequests: Counter;
  introspectionRequests: Counter;
  authorizationRequests: Counter;

  // Latencies
  tokenIssuanceLatency: Histogram;
  tokenValidationLatency: Histogram;

  // Errors
  authenticationFailures: Counter;
  invalidTokens: Counter;
  insufficientScope: Counter;

  // System health
  activeTokens: Gauge;
  revokedTokens: Gauge;
  registeredClients: Gauge;
}
```

---

## Future Enhancements

### Phase 1: Security Hardening
1. Refresh token rotation
2. Rate limiting
3. Audit logging
4. Token binding (DPoP)
5. Persistent storage (Redis)

### Phase 2: Advanced Features
1. Scope hierarchies
2. Dynamic scope generation
3. Consent management
4. Client management UI
5. Token introspection batching

### Phase 3: Enterprise Features
1. Multi-tenancy
2. Custom claims
3. Token exchange (RFC 8693)
4. Device flow (RFC 8628)
5. Pushed Authorization Requests (PAR)

### Phase 4: Observability
1. OpenTelemetry integration
2. Distributed tracing
3. Real-time dashboards
4. Anomaly detection
5. Security analytics

---

## Summary

**Architecture Highlights:**

✅ **Three-role separation** - Clear boundaries and responsibilities
✅ **Stateless tokens** - JWT enables distributed validation
✅ **Standards-based** - Full RFC compliance
✅ **Security-first** - PKCE, short lifetimes, proper validation
✅ **Scalable design** - Horizontal scaling ready
✅ **MCP integration** - Seamless OAuth for MCP protocol

**Design Decisions:**

- **JWT over Opaque Tokens** - Stateless validation, no db lookup
- **RS256 over HS256** - Distributed verification without shared secrets
- **Resource Indicators** - Fine-grained access control (RFC 8707)
- **In-memory Storage** - Simple development, production needs Redis
- **Express.js** - Lightweight, familiar, well-supported

**Next Steps:**

1. Implement production-ready storage (Redis)
2. Add rate limiting and monitoring
3. Deploy with proper HTTPS and certificates
4. Implement refresh token rotation
5. Add comprehensive audit logging

See [OAUTH-RECOMMENDATIONS.md](../OAUTH-RECOMMENDATIONS.md) for detailed implementation roadmap.
