/**
 * JWT (JSON Web Token) Service
 *
 * Handles JWT creation, validation, and management for OAuth 2.0 tokens
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import * as jose from 'jose';

/**
 * JWT token types
 */
export enum TokenType {
  ACCESS = 'access_token',
  REFRESH = 'refresh_token',
  ID = 'id_token',
}

/**
 * JWT payload structure
 */
export interface JWTPayload {
  // Standard claims (RFC 7519)
  iss?: string; // Issuer
  sub: string; // Subject (user ID)
  aud?: string | string[]; // Audience
  exp: number; // Expiration time (Unix timestamp)
  nbf?: number; // Not before (Unix timestamp)
  iat: number; // Issued at (Unix timestamp)
  jti?: string; // JWT ID

  // OAuth 2.0 specific claims
  client_id: string; // Client identifier
  scope?: string; // Space-separated scopes
  token_type?: TokenType; // Token type

  // RFC 8707: Resource indicators
  resource?: string | string[]; // Resource indicators

  // MCP specific claims
  mcp_version?: string;
  mcp_capabilities?: string[];

  // Custom claims
  [key: string]: any;
}

/**
 * JWT verification result
 */
export interface JWTVerification {
  valid: boolean;
  payload?: JWTPayload;
  error?: string;
}

/**
 * JWT signing options
 */
export interface JWTSignOptions {
  expiresIn?: string | number; // e.g., '1h', 3600
  notBefore?: string | number;
  audience?: string | string[];
  issuer?: string;
  jwtid?: string;
  subject?: string;
}

/**
 * JWK (JSON Web Key) for key management
 */
export interface JWK {
  kty: string; // Key type
  use?: string; // Key use (sig, enc)
  kid: string; // Key ID
  alg?: string; // Algorithm
  n?: string; // RSA modulus
  e?: string; // RSA exponent
  d?: string; // RSA private exponent (private key only)
}

/**
 * JWT Service
 */
export class JWTService {
  private privateKey: string;
  private publicKey: string;
  private keyId: string;
  private algorithm: string;
  private issuer: string;

  constructor(config?: {
    privateKey?: string;
    publicKey?: string;
    keyId?: string;
    algorithm?: string;
    issuer?: string;
  }) {
    this.algorithm = config?.algorithm || 'RS256';
    this.issuer = config?.issuer || 'mcp-oauth-server';
    this.keyId = config?.keyId || this.generateKeyId();

    if (config?.privateKey && config?.publicKey) {
      this.privateKey = config.privateKey;
      this.publicKey = config.publicKey;
    } else {
      // Generate new key pair if not provided
      const keyPair = this.generateKeyPair();
      this.privateKey = keyPair.privateKey;
      this.publicKey = keyPair.publicKey;
    }
  }

  /**
   * Generate RSA key pair
   */
  private generateKeyPair(): { privateKey: string; publicKey: string } {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return { privateKey, publicKey };
  }

  /**
   * Generate unique key ID
   */
  private generateKeyId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Create JWT access token
   */
  createAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'token_type'>, options?: JWTSignOptions): string {
    const now = Math.floor(Date.now() / 1000);

    const fullPayload = {
      ...payload,
      iat: now,
      exp: now + (typeof options?.expiresIn === 'number' ? options.expiresIn : 3600), // 1 hour default
      token_type: TokenType.ACCESS,
      iss: options?.issuer || this.issuer,
    } as JWTPayload;

    return jwt.sign(fullPayload, this.privateKey, {
      algorithm: this.algorithm as jwt.Algorithm,
      keyid: this.keyId,
      jwtid: options?.jwtid || crypto.randomBytes(16).toString('hex'), // Always include unique jti
      ...(options?.audience && { audience: options.audience }),
    });
  }

  /**
   * Create JWT refresh token
   */
  createRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'token_type'>, options?: JWTSignOptions): string {
    const now = Math.floor(Date.now() / 1000);

    const fullPayload = {
      ...payload,
      iat: now,
      exp: now + (typeof options?.expiresIn === 'number' ? options.expiresIn : 604800), // 7 days default
      token_type: TokenType.REFRESH,
      iss: options?.issuer || this.issuer,
    } as JWTPayload;

    return jwt.sign(fullPayload, this.privateKey, {
      algorithm: this.algorithm as jwt.Algorithm,
      keyid: this.keyId,
      ...(options?.audience && { audience: options.audience }),
      ...(options?.jwtid && { jwtid: options.jwtid }),
    });
  }

  /**
   * Verify and decode JWT token
   */
  verifyToken(token: string, options?: jwt.VerifyOptions): JWTVerification {
    try {
      const payload = jwt.verify(token, this.publicKey, {
        algorithms: [this.algorithm as jwt.Algorithm],
        issuer: options?.issuer || this.issuer,
        ...options,
      }) as JWTPayload;

      return {
        valid: true,
        payload,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token verification failed',
      };
    }
  }

  /**
   * Decode JWT without verification (for debugging)
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch {
      return null;
    }
  }

  /**
   * Get JWK Set (public keys for verification)
   */
  async getJWKS(): Promise<{ keys: JWK[] }> {
    const publicKeyObject = crypto.createPublicKey(this.publicKey);
    const jwk = await jose.exportJWK(publicKeyObject);

    return {
      keys: [
        {
          kty: 'RSA',
          use: 'sig',
          kid: this.keyId,
          alg: this.algorithm,
          n: jwk.n,
          e: jwk.e,
        },
      ],
    };
  }

  /**
   * Validate token scopes
   */
  validateScopes(token: string, requiredScopes: string[]): JWTVerification {
    const verification = this.verifyToken(token);

    if (!verification.valid || !verification.payload) {
      return verification;
    }

    const tokenScopes = verification.payload.scope?.split(' ') || [];
    const hasAllScopes = requiredScopes.every((scope) => tokenScopes.includes(scope));

    if (!hasAllScopes) {
      return {
        valid: false,
        error: `Missing required scopes. Required: ${requiredScopes.join(', ')}`,
      };
    }

    return verification;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    return decoded.exp * 1000 < Date.now();
  }

  /**
   * Get time until token expiration (in seconds)
   */
  getTimeUntilExpiration(token: string): number {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return 0;
    }

    const expiresIn = decoded.exp * 1000 - Date.now();
    return Math.max(0, Math.floor(expiresIn / 1000));
  }

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(refreshToken: string): { accessToken: string; error?: string } {
    const verification = this.verifyToken(refreshToken);

    if (!verification.valid || !verification.payload) {
      return {
        accessToken: '',
        error: verification.error || 'Invalid refresh token',
      };
    }

    // Verify it's actually a refresh token
    if (verification.payload.token_type !== TokenType.REFRESH) {
      return {
        accessToken: '',
        error: 'Token is not a refresh token',
      };
    }

    // Create new access token with same claims
    const accessToken = this.createAccessToken({
      sub: verification.payload.sub,
      client_id: verification.payload.client_id,
      scope: verification.payload.scope,
      resource: verification.payload.resource,
      mcp_version: verification.payload.mcp_version,
      mcp_capabilities: verification.payload.mcp_capabilities,
    });

    return { accessToken };
  }

  /**
   * Get public key for verification
   */
  getPublicKey(): string {
    return this.publicKey;
  }

  /**
   * Get key ID
   */
  getKeyId(): string {
    return this.keyId;
  }
}

/**
 * Default JWT service instance (singleton)
 */
let defaultJWTService: JWTService | null = null;

/**
 * Get or create default JWT service
 */
export function getJWTService(config?: {
  privateKey?: string;
  publicKey?: string;
  keyId?: string;
  algorithm?: string;
  issuer?: string;
}): JWTService {
  if (!defaultJWTService) {
    defaultJWTService = new JWTService(config);
  }
  return defaultJWTService;
}
