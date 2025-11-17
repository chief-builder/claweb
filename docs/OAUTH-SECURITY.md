# OAuth 2.1 Security Best Practices

Comprehensive security guide for the MCP OAuth 2.1 implementation with RFC 8707 Resource Indicators.

## Table of Contents

- [Security Overview](#security-overview)
- [Threat Model](#threat-model)
- [Authentication & Authorization](#authentication--authorization)
- [Token Security](#token-security)
- [PKCE (Proof Key for Code Exchange)](#pkce-proof-key-for-code-exchange)
- [Client Security](#client-security)
- [Resource Server Security](#resource-server-security)
- [Network Security](#network-security)
- [Operational Security](#operational-security)
- [Security Checklist](#security-checklist)
- [Incident Response](#incident-response)

---

## Security Overview

### OAuth 2.1 Security Improvements

OAuth 2.1 consolidates security best practices from various OAuth 2.0 extensions:

✅ **PKCE Required** - Mandatory for all authorization code flows (RFC 7636)
✅ **No Implicit Flow** - Removed insecure implicit grant
✅ **No Password Flow** - Removed resource owner password credentials grant
✅ **Exact Redirect URI Matching** - Prevents redirect URI manipulation
✅ **Refresh Token Rotation** - Recommended for enhanced security

### Defense in Depth

Our implementation employs multiple layers of security:

1. **Authentication** - Client credentials, PKCE, JWT signatures
2. **Authorization** - Scope-based access control, resource indicators
3. **Encryption** - TLS for all communications (production)
4. **Validation** - Input validation, token verification, scope checking
5. **Monitoring** - Audit logging, anomaly detection (recommended)

---

## Threat Model

### Threat Actors

| Actor | Motivation | Capabilities |
|-------|-----------|--------------|
| Malicious Client | Unauthorized access to user data | Can register clients, manipulate requests |
| Phishing Attacker | Steal user credentials or tokens | Social engineering, fake auth pages |
| Network Attacker | Intercept tokens in transit | Man-in-the-middle, packet sniffing |
| Compromised Resource Server | Access tokens without authorization | Server-level access |
| Token Theft | Replay stolen tokens | Physical or digital token access |

### Attack Vectors

#### 1. Authorization Code Interception

**Threat:** Attacker intercepts authorization code during redirect

**Mitigation:**
- ✅ **PKCE** - Code verifier prevents code replay
- ✅ **State Parameter** - Prevents CSRF attacks
- ✅ **Short Code Lifetime** - Codes expire in 60 seconds
- ✅ **One-time Use** - Codes cannot be reused

**Implementation:**
```typescript
// PKCE validation in token endpoint
const validation = PKCEService.validatePKCE(
  codeVerifier,
  storedChallenge,
  CodeChallengeMethod.S256
);

if (!validation.valid) {
  return error('invalid_grant', 'PKCE validation failed');
}
```

#### 2. Token Theft and Replay

**Threat:** Stolen access token used by attacker

**Mitigation:**
- ✅ **Short Token Lifetime** - Access tokens expire in 1 hour
- ✅ **Token Revocation** - RFC 7009 revocation endpoint
- ✅ **Resource Binding** - RFC 8707 resource indicators
- ✅ **Scope Minimization** - Tokens limited to specific permissions
- ⏳ **Token Binding** - DPoP or certificate binding (recommended)

**Revocation Example:**
```typescript
// Revoke compromised token immediately
await fetch('http://localhost:4000/oauth/revoke', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: compromisedToken,
    client_id: clientId,
    client_secret: clientSecret
  })
});
```

#### 3. Client Impersonation

**Threat:** Malicious client pretends to be legitimate client

**Mitigation:**
- ✅ **Client Authentication** - Confidential clients use secret
- ✅ **Redirect URI Validation** - Exact matching required
- ✅ **PKCE for Public Clients** - Prevents impersonation
- ⏳ **Client Attestation** - Cryptographic client identity (recommended)

#### 4. Scope Escalation

**Threat:** Client requests more permissions than intended

**Mitigation:**
- ✅ **Scope Validation** - Resource server validates scopes
- ✅ **Resource Indicators** - Tokens bound to specific resources
- ✅ **Consent Screen** - User approves exact permissions
- ✅ **Least Privilege** - Clients request minimum necessary scopes

**Scope Enforcement:**
```typescript
// Resource server middleware validates scopes
protectResource({
  requiredScopes: ['mcp.tools.execute'], // Required scope
  requiredResource: 'mcp://tools'         // Required resource
})
```

#### 5. Redirect URI Manipulation

**Threat:** Attacker redirects authorization to malicious URI

**Mitigation:**
- ✅ **Exact Matching** - No wildcard or partial matching
- ✅ **Registration Required** - URIs must be pre-registered
- ✅ **HTTPS Required** - For production (except localhost)
- ✅ **No Open Redirectors** - Strict URI validation

**Validation Example:**
```typescript
// Exact redirect URI matching
if (redirectUri !== registeredUri) {
  return error('invalid_request', 'Redirect URI mismatch');
}
```

---

## Authentication & Authorization

### Client Authentication

#### Confidential Clients

**Method:** Client Secret Post
```json
{
  "grant_type": "client_credentials",
  "client_id": "client_abc123",
  "client_secret": "secret_xyz789"
}
```

**Security:**
- Store secrets in environment variables or secure vault
- Never commit secrets to version control
- Rotate secrets regularly (recommended: every 90 days)
- Use secure random generation (≥256 bits entropy)

#### Public Clients

**Method:** PKCE (No secret)
```json
{
  "grant_type": "authorization_code",
  "client_id": "public_client_123",
  "code_verifier": "pkce_verifier_value"
}
```

**Security:**
- PKCE is mandatory for public clients
- Use S256 challenge method (not plain)
- Generate verifier with ≥256 bits entropy
- Never reuse verifiers across requests

### Authorization Flow Security

#### Interactive Consent

**Consent Page Must:**
- ✅ Display exact scopes being requested
- ✅ Show client name and identity
- ✅ Allow user to deny access
- ✅ Highlight sensitive permissions
- ✅ Be served over HTTPS (production)

**Example Consent Display:**
```
Client "Weather App" is requesting access to:
☑ Read your tools (mcp.tools.read)
☑ Execute tools (mcp.tools.execute)

Resource: mcp://tools

[Deny] [Allow]
```

---

## Token Security

### Access Token Lifetime

**Current:** 1 hour (3600 seconds)

**Considerations:**
- Shorter = More secure, more refresh requests
- Longer = Better UX, higher risk if compromised
- Recommended: 15-60 minutes for sensitive operations

### Refresh Token Security

**Best Practices:**
1. ✅ **Rotation** - Issue new refresh token on each use
2. ✅ **Revocation** - Support revocation endpoint
3. ✅ **Lifetime Limits** - Max 90 days, require re-authentication
4. ✅ **Scope Binding** - Cannot escalate permissions
5. ⏳ **Device Binding** - Tie to specific device (recommended)

**Refresh Token Rotation:**
```typescript
// Issue new refresh token, revoke old one
const newRefreshToken = this.createRefreshToken({...});
this.revokeToken(oldRefreshToken);

return {
  access_token: newAccessToken,
  refresh_token: newRefreshToken, // NEW token
  expires_in: 3600
};
```

### JWT Security

#### Token Signing

**Algorithm:** RS256 (RSA with SHA-256)
**Key Size:** 2048 bits

**Security:**
- ✅ Use RS256 (asymmetric), never HS256 for distributed systems
- ✅ Keep private keys secure (HSM or secure vault in production)
- ✅ Rotate signing keys regularly (recommended: yearly)
- ✅ Support multiple active keys during rotation

#### Token Validation

**Resource Server Must:**
```typescript
// 1. Verify signature
const jwks = await fetchJWKS(authServerJwksUri);
const publicKey = findKey(jwks, token.header.kid);
const signatureValid = verifySignature(token, publicKey);

// 2. Validate claims
assert(token.iss === expectedIssuer);
assert(token.exp > now);
assert(token.aud.includes(expectedResource));

// 3. Check revocation
const isRevoked = await checkRevocationList(token.jti);
assert(!isRevoked);

// 4. Validate scopes
assert(token.scope.includes(requiredScope));
```

---

## PKCE (Proof Key for Code Exchange)

### Why PKCE?

PKCE prevents authorization code interception attacks, especially for:
- Public clients (mobile apps, SPAs)
- Confidential clients on untrusted networks
- Any client where code interception is possible

### Implementation

**1. Generate Code Verifier:**
```typescript
import { PKCEService, CodeChallengeMethod } from './auth/oauth/pkce.js';

const pkce = PKCEService.generatePKCEParams(CodeChallengeMethod.S256);
// pkce.codeVerifier: Random 128-character string
// pkce.codeChallenge: Base64-URL-encoded SHA256 hash
```

**2. Authorization Request:**
```http
GET /oauth/authorize?
  response_type=code&
  client_id=client_123&
  code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
  code_challenge_method=S256&
  ...
```

**3. Token Request:**
```json
{
  "grant_type": "authorization_code",
  "code": "auth_code",
  "code_verifier": "original_verifier_value"
}
```

**4. Server Validation:**
```typescript
// Hash the verifier
const hashedVerifier = sha256(codeVerifier);

// Compare with stored challenge
if (hashedVerifier !== storedChallenge) {
  return error('invalid_grant', 'PKCE validation failed');
}
```

### PKCE Security Rules

1. ✅ **Use S256** - Always use S256 method, not plain
2. ✅ **High Entropy** - Verifier must have ≥256 bits entropy
3. ✅ **One-time Use** - Verifier used once, challenge discarded after use
4. ✅ **No Reuse** - Generate new verifier for each auth request
5. ✅ **Mandatory** - Required for all authorization code flows

---

## Client Security

### Client Secret Management

**DO:**
- ✅ Store in environment variables or secret vault
- ✅ Rotate regularly (every 90 days)
- ✅ Use secrets with ≥256 bits entropy
- ✅ Transmit only over HTTPS
- ✅ Hash and salt in database

**DON'T:**
- ❌ Hardcode in source code
- ❌ Commit to version control
- ❌ Log in plaintext
- ❌ Send in URL parameters
- ❌ Share between clients

### Client Registration Validation

```typescript
// Validate redirect URIs
for (const uri of redirectUris) {
  // Must be absolute URI
  if (!isAbsoluteUri(uri)) {
    return error('invalid_redirect_uri');
  }

  // HTTPS required (except localhost)
  if (!uri.startsWith('https://') && !isLocalhost(uri)) {
    return error('invalid_redirect_uri', 'HTTPS required');
  }

  // No wildcards or fragments
  if (uri.includes('*') || uri.includes('#')) {
    return error('invalid_redirect_uri');
  }
}
```

---

## Resource Server Security

### Token Validation Middleware

```typescript
export function protectResource(options: {
  requiredScopes: string[];
  requiredResource?: string;
}) {
  return async (req, res, next) => {
    // 1. Extract token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7);

    // 2. Verify signature and validate claims
    const verification = jwtService.verifyToken(token);
    if (!verification.valid) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: verification.error
      });
    }

    // 3. Check revocation
    if (revocationService.isTokenRevoked(token)) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Token has been revoked'
      });
    }

    // 4. Validate scopes
    const tokenScopes = verification.payload.scope.split(' ');
    const hasAllScopes = options.requiredScopes.every(
      scope => tokenScopes.includes(scope)
    );

    if (!hasAllScopes) {
      return res.status(403).json({
        error: 'insufficient_scope',
        error_description: `Token missing required scopes: ${options.requiredScopes.join(', ')}`,
        scope: options.requiredScopes.join(' ')
      });
    }

    // 5. Validate resource indicator (RFC 8707)
    if (options.requiredResource) {
      const tokenResources = verification.payload.resource || [];
      if (!tokenResources.includes(options.requiredResource)) {
        return res.status(403).json({
          error: 'invalid_token',
          error_description: `Token not valid for resource: ${options.requiredResource}`
        });
      }
    }

    // Attach token payload to request
    req.oauth = verification.payload;
    next();
  };
}
```

### Rate Limiting (Recommended)

```typescript
import rateLimit from 'express-rate-limit';

// Limit token endpoint
const tokenRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  message: {
    error: 'too_many_requests',
    error_description: 'Too many token requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/oauth/token', tokenRateLimiter, handleTokenRequest);
```

---

## Network Security

### TLS/HTTPS

**Requirements:**
- ✅ **Production**: HTTPS mandatory for all endpoints
- ✅ **TLS 1.2+**: Minimum TLS version
- ✅ **Strong Ciphers**: Use modern cipher suites
- ✅ **Certificate Validation**: Verify server certificates

**Development:**
- Localhost HTTP allowed for testing
- Never use self-signed certs in production

### CORS Configuration

```typescript
app.use(cors({
  origin: ['https://trusted-client.example.com'], // Whitelist only
  credentials: true, // Allow cookies/auth headers
  methods: ['GET', 'POST'], // Limit methods
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type'],
  maxAge: 86400 // 24 hours
}));
```

**Security:**
- ❌ Never use `origin: '*'` in production
- ✅ Whitelist specific trusted origins
- ✅ Enable credentials only when needed
- ✅ Limit allowed methods and headers

---

## Operational Security

### Audit Logging

**Log These Events:**
```typescript
interface AuditEvent {
  timestamp: Date;
  eventType: 'token_issued' | 'token_revoked' | 'auth_failed' | 'client_registered';
  clientId: string;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorCode?: string;
  resource?: string;
  scopes?: string[];
}
```

**Example:**
```typescript
auditLog.log({
  timestamp: new Date(),
  eventType: 'token_issued',
  clientId: 'client_abc123',
  ipAddress: req.ip,
  userAgent: req.get('User-Agent'),
  success: true,
  resource: 'mcp://tools',
  scopes: ['mcp.tools.read']
});
```

### Monitoring & Alerting

**Monitor:**
- Failed authentication attempts (threshold: >10 per minute)
- Unusual token request patterns
- Revocation rate spikes
- Error rate increases
- Latency anomalies
- JWKS fetch failures

**Alert On:**
- Multiple failed auth attempts from same IP
- Suspicious scope requests
- Token introspection failures
- Revoked token usage attempts
- Invalid signature errors

### Key Rotation

**Signing Key Rotation:**
```typescript
// 1. Generate new key pair
const newKeyPair = await generateRSAKeyPair(2048);

// 2. Add to JWKS with new kid
jwks.keys.push({
  kid: 'key-2024-01',
  kty: 'RSA',
  use: 'sig',
  alg: 'RS256',
  n: newKeyPair.publicKey.n,
  e: newKeyPair.publicKey.e
});

// 3. Start signing with new key
currentSigningKey = newKeyPair.privateKey;

// 4. Keep old key for validation (grace period: 24 hours)
setTimeout(() => {
  jwks.keys = jwks.keys.filter(k => k.kid !== 'key-2023-12');
}, 24 * 60 * 60 * 1000);
```

**Rotation Schedule:**
- Signing keys: Annually
- Client secrets: Every 90 days
- Refresh tokens: On each use (rotation)

---

## Security Checklist

### Before Production

#### Authorization Server
- [ ] HTTPS enabled with valid certificate
- [ ] Strong TLS configuration (TLS 1.2+)
- [ ] Private keys stored in HSM or vault
- [ ] Rate limiting implemented
- [ ] Audit logging enabled
- [ ] Monitoring and alerting configured
- [ ] CORS properly configured (no wildcards)
- [ ] Error messages don't leak sensitive info
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (if using SQL)

#### Resource Server
- [ ] Token signature verification enabled
- [ ] Revocation checking implemented
- [ ] Scope validation enforced
- [ ] Resource indicator validation
- [ ] HTTPS required for all requests
- [ ] Rate limiting on protected endpoints
- [ ] Proper error responses (401/403)

#### Clients
- [ ] Secrets stored securely (not in code)
- [ ] PKCE implemented for all flows
- [ ] State parameter used (CSRF protection)
- [ ] Redirect URI validation
- [ ] Token storage secure (not localStorage for web)
- [ ] Automatic token refresh
- [ ] Token revocation on logout

### Regular Security Tasks

**Daily:**
- Review audit logs for anomalies
- Check monitoring dashboards
- Verify system health

**Weekly:**
- Review failed authentication patterns
- Check for dependency updates
- Review access patterns

**Monthly:**
- Security patch updates
- Review and update client list
- Access review for admin accounts

**Quarterly:**
- Rotate client secrets
- Security audit
- Penetration testing
- Review and update policies

**Annually:**
- Rotate signing keys
- Full security assessment
- Disaster recovery testing
- Update threat model

---

## Incident Response

### Token Compromise

**Immediate Actions:**
1. Revoke compromised token
2. Revoke associated refresh tokens
3. Audit logs for unauthorized access
4. Notify affected users
5. Reset client credentials if needed

**Investigation:**
1. Identify breach vector
2. Check for lateral movement
3. Review audit logs for timeline
4. Determine data accessed

**Recovery:**
1. Patch vulnerability
2. Force re-authentication
3. Rotate all tokens for affected users
4. Update monitoring rules
5. Document incident

### Client Compromise

**Immediate Actions:**
1. Suspend client registration
2. Revoke all client tokens
3. Block client from authorization server
4. Notify client owner
5. Review all client activity

**Example:**
```typescript
// Revoke all tokens for compromised client
const revokedCount = revocationService.revokeAllClientTokens(compromisedClientId);

// Suspend client
await clientRegistration.suspendClient(compromisedClientId, {
  reason: 'Security incident',
  suspendedBy: 'security-team',
  suspendedAt: new Date()
});
```

### Authorization Server Breach

**Immediate Actions:**
1. Take server offline
2. Notify all clients and users
3. Revoke ALL issued tokens
4. Rotate ALL signing keys
5. Reset ALL client credentials
6. Forensic analysis

**Recovery:**
1. Rebuild from clean state
2. Apply security patches
3. Enhanced monitoring
4. Phased restoration
5. Post-mortem analysis

---

## Security Resources

### Standards & RFCs
- [RFC 6749](https://tools.ietf.org/html/rfc6749) - OAuth 2.0 Authorization Framework
- [RFC 6819](https://tools.ietf.org/html/rfc6819) - OAuth 2.0 Threat Model and Security Considerations
- [RFC 7009](https://tools.ietf.org/html/rfc7009) - OAuth 2.0 Token Revocation
- [RFC 7636](https://tools.ietf.org/html/rfc7636) - PKCE
- [RFC 8252](https://tools.ietf.org/html/rfc8252) - OAuth for Native Apps
- [RFC 8707](https://tools.ietf.org/html/rfc8707) - Resource Indicators

### Best Practice Guides
- [OAuth 2.0 Security Best Current Practice](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)
- [OWASP OAuth Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth_Cheat_Sheet.html)
- [OAuth 2.1 Authorization Framework](https://oauth.net/2.1/)

### Tools
- [JWT.io](https://jwt.io/) - JWT decoder and debugger
- [OAuth Debugger](https://oauthdebugger.com/) - Test OAuth flows
- [OWASP ZAP](https://www.zaproxy.org/) - Security testing

---

## Summary

**Key Security Principles:**

1. ✅ **Defense in Depth** - Multiple security layers
2. ✅ **Least Privilege** - Minimum necessary permissions
3. ✅ **Assume Breach** - Design for compromise scenarios
4. ✅ **Zero Trust** - Verify everything, trust nothing
5. ✅ **Secure by Default** - Security as the default state

**Critical Security Controls:**
- PKCE for all authorization code flows
- Short token lifetimes (≤1 hour)
- Token revocation support
- HTTPS in production
- Proper scope validation
- Resource indicator enforcement
- Audit logging
- Rate limiting
- Regular key rotation
- Incident response plan

---

**Remember:** Security is a continuous process, not a one-time implementation. Regularly review, test, and update your security measures.
