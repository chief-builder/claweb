/**
 * PKCE (Proof Key for Code Exchange) Implementation
 *
 * RFC 7636 - OAuth 2.0 extension to prevent authorization code interception attacks
 * Particularly important for public clients (mobile apps, SPAs)
 */

import crypto from 'crypto';

/**
 * Code challenge methods supported
 */
export enum CodeChallengeMethod {
  PLAIN = 'plain',
  S256 = 'S256',
}

/**
 * PKCE parameters
 */
export interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: CodeChallengeMethod;
}

/**
 * PKCE validation result
 */
export interface PKCEValidation {
  valid: boolean;
  error?: string;
}

/**
 * PKCE Service
 */
export class PKCEService {
  /**
   * Generate a cryptographically random code verifier
   *
   * MUST be between 43-128 characters
   * Uses unreserved characters: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
   */
  static generateCodeVerifier(length: number = 128): string {
    if (length < 43 || length > 128) {
      throw new Error('Code verifier length must be between 43 and 128 characters');
    }

    // Generate random bytes and encode as base64url
    const randomBytes = crypto.randomBytes(length);
    return PKCEService.base64UrlEncode(randomBytes).substring(0, length);
  }

  /**
   * Generate code challenge from code verifier
   *
   * @param codeVerifier - The code verifier
   * @param method - The challenge method (S256 recommended, plain for legacy)
   */
  static generateCodeChallenge(
    codeVerifier: string,
    method: CodeChallengeMethod = CodeChallengeMethod.S256
  ): string {
    if (method === CodeChallengeMethod.S256) {
      // S256: base64url(sha256(code_verifier))
      const hash = crypto.createHash('sha256').update(codeVerifier).digest();
      return PKCEService.base64UrlEncode(hash);
    } else {
      // plain: code_challenge = code_verifier
      return codeVerifier;
    }
  }

  /**
   * Generate complete PKCE parameters
   */
  static generatePKCEParams(
    method: CodeChallengeMethod = CodeChallengeMethod.S256
  ): PKCEParams {
    const codeVerifier = PKCEService.generateCodeVerifier();
    const codeChallenge = PKCEService.generateCodeChallenge(codeVerifier, method);

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: method,
    };
  }

  /**
   * Validate code verifier against code challenge
   *
   * Used during token exchange to verify the client
   */
  static validatePKCE(
    codeVerifier: string,
    codeChallenge: string,
    method: CodeChallengeMethod
  ): PKCEValidation {
    // Validate code verifier format
    if (!codeVerifier || codeVerifier.length < 43 || codeVerifier.length > 128) {
      return {
        valid: false,
        error: 'Invalid code verifier length (must be 43-128 characters)',
      };
    }

    // Validate code verifier contains only allowed characters
    const allowedChars = /^[A-Za-z0-9\-._~]+$/;
    if (!allowedChars.test(codeVerifier)) {
      return {
        valid: false,
        error: 'Code verifier contains invalid characters',
      };
    }

    // Regenerate code challenge and compare
    try {
      const expectedChallenge = PKCEService.generateCodeChallenge(codeVerifier, method);

      if (expectedChallenge !== codeChallenge) {
        return {
          valid: false,
          error: 'Code verifier does not match code challenge',
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'PKCE validation failed',
      };
    }
  }

  /**
   * Base64 URL encoding (RFC 4648)
   *
   * Converts binary data to base64url format (no padding, URL-safe characters)
   */
  private static base64UrlEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Base64 URL decoding
   */
  private static base64UrlDecode(str: string): Buffer {
    // Add padding if needed
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64');
  }

  /**
   * Validate code challenge method
   */
  static isValidMethod(method: string): method is CodeChallengeMethod {
    return method === CodeChallengeMethod.PLAIN || method === CodeChallengeMethod.S256;
  }

  /**
   * Get recommended method
   */
  static getRecommendedMethod(): CodeChallengeMethod {
    return CodeChallengeMethod.S256; // SHA-256 is the recommended method
  }
}

/**
 * PKCE storage interface for persisting authorization codes
 */
export interface PKCEStore {
  /**
   * Store PKCE parameters for an authorization code
   */
  set(
    authorizationCode: string,
    params: {
      codeChallenge: string;
      codeChallengeMethod: CodeChallengeMethod;
      clientId: string;
      expiresAt: Date;
    }
  ): Promise<void>;

  /**
   * Retrieve PKCE parameters for an authorization code
   */
  get(authorizationCode: string): Promise<{
    codeChallenge: string;
    codeChallengeMethod: CodeChallengeMethod;
    clientId: string;
    expiresAt: Date;
  } | null>;

  /**
   * Delete PKCE parameters (after successful token exchange)
   */
  delete(authorizationCode: string): Promise<void>;
}

/**
 * In-memory PKCE store (for development/testing)
 */
export class InMemoryPKCEStore implements PKCEStore {
  private store = new Map<
    string,
    {
      codeChallenge: string;
      codeChallengeMethod: CodeChallengeMethod;
      clientId: string;
      expiresAt: Date;
    }
  >();

  async set(
    authorizationCode: string,
    params: {
      codeChallenge: string;
      codeChallengeMethod: CodeChallengeMethod;
      clientId: string;
      expiresAt: Date;
    }
  ): Promise<void> {
    this.store.set(authorizationCode, params);

    // Auto-cleanup expired codes
    setTimeout(() => {
      const stored = this.store.get(authorizationCode);
      if (stored && stored.expiresAt <= new Date()) {
        this.store.delete(authorizationCode);
      }
    }, params.expiresAt.getTime() - Date.now());
  }

  async get(authorizationCode: string) {
    const params = this.store.get(authorizationCode);
    if (!params) {
      return null;
    }

    // Check if expired
    if (params.expiresAt <= new Date()) {
      this.store.delete(authorizationCode);
      return null;
    }

    return params;
  }

  async delete(authorizationCode: string): Promise<void> {
    this.store.delete(authorizationCode);
  }

  /**
   * Clear all stored parameters (for testing)
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get count of stored codes (for monitoring)
   */
  size(): number {
    return this.store.size;
  }
}
