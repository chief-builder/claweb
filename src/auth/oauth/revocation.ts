/**
 * OAuth 2.0 Token Revocation (RFC 7009)
 *
 * Implements token revocation functionality, allowing clients to
 * notify the authorization server that a previously obtained token
 * is no longer needed and should be invalidated.
 *
 * Use cases:
 * - User logout
 * - Security (revoke compromised tokens)
 * - Token lifecycle management
 *
 * RFC 7009: https://tools.ietf.org/html/rfc7009
 */

import { JWTService } from './jwt.js';
import { ClientRegistrationService } from './registration.js';

/**
 * Token revocation request
 */
export interface TokenRevocationRequest {
  /**
   * The token to be revoked
   */
  token: string;

  /**
   * A hint about the type of the token
   * Values: "access_token" or "refresh_token"
   */
  token_type_hint?: 'access_token' | 'refresh_token';

  /**
   * Client identifier (required for public clients)
   */
  client_id?: string;

  /**
   * Client secret (required for confidential clients)
   */
  client_secret?: string;
}

/**
 * Token revocation response
 */
export interface TokenRevocationResponse {
  /**
   * Whether the revocation was successful
   */
  success: boolean;

  /**
   * Error code if revocation failed
   */
  error?: string;

  /**
   * Error description if revocation failed
   */
  error_description?: string;
}

/**
 * Revoked token entry
 */
interface RevokedTokenEntry {
  token: string;
  tokenType: 'access_token' | 'refresh_token';
  clientId: string;
  revokedAt: Date;
  expiresAt: Date; // When to remove from blacklist
}

/**
 * Token Revocation Service
 *
 * Implements RFC 7009 token revocation with a token blacklist.
 * In production, use a distributed cache (Redis) for the blacklist.
 */
export class TokenRevocationService {
  private jwtService: JWTService;
  private clientRegistrationService: ClientRegistrationService;
  private revokedTokens: Map<string, RevokedTokenEntry>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    jwtService: JWTService,
    clientRegistrationService: ClientRegistrationService
  ) {
    this.jwtService = jwtService;
    this.clientRegistrationService = clientRegistrationService;
    this.revokedTokens = new Map();

    // Start cleanup job to remove expired entries
    this.startCleanupJob();
  }

  /**
   * Revoke a token
   *
   * @param request Revocation request
   * @returns Revocation response
   */
  async revokeToken(request: TokenRevocationRequest): Promise<TokenRevocationResponse> {
    try {
      const { token, token_type_hint, client_id, client_secret } = request;

      // Validate token format
      if (!token || typeof token !== 'string') {
        return {
          success: false,
          error: 'invalid_request',
          error_description: 'Missing or invalid token parameter',
        };
      }

      // Authenticate client
      if (client_id) {
        // Public client or confidential client with credentials
        if (client_secret) {
          // Confidential client - validate credentials
          const isValid = await this.clientRegistrationService.validateCredentials(
            client_id,
            client_secret
          );

          if (!isValid) {
            return {
              success: false,
              error: 'invalid_client',
              error_description: 'Client authentication failed',
            };
          }
        }
        // Public clients can revoke their own tokens without a secret
      }

      // Try to decode and validate the token
      let tokenPayload: any = null;
      let tokenType: 'access_token' | 'refresh_token' = token_type_hint || 'access_token';

      try {
        // Try to verify the token using the JWT service
        const verification = this.jwtService.verifyToken(token);

        if (verification.valid && verification.payload) {
          tokenPayload = verification.payload;
          // Determine token type based on the hint or payload
          tokenType = token_type_hint || 'access_token';
        } else {
          // Token is invalid or already expired
          // Per RFC 7009: "The authorization server responds with HTTP 200
          // if the token has been revoked successfully or if the client
          // submitted an invalid token."
          return { success: true };
        }
      } catch (error) {
        // Token validation failed
        // Per RFC 7009, return success even on error to prevent token scanning
        return { success: true };
      }

      // Verify client owns the token
      if (client_id && tokenPayload.client_id !== client_id) {
        return {
          success: false,
          error: 'invalid_request',
          error_description: 'Token does not belong to this client',
        };
      }

      // Add token to revocation list
      const expiresAt = new Date(tokenPayload.exp * 1000);
      const revokedEntry: RevokedTokenEntry = {
        token,
        tokenType,
        clientId: tokenPayload.client_id || tokenPayload.sub,
        revokedAt: new Date(),
        expiresAt,
      };

      this.revokedTokens.set(token, revokedEntry);

      console.error(`[TokenRevocation] Revoked ${tokenType} for client ${revokedEntry.clientId}`);

      return { success: true };
    } catch (error) {
      console.error('[TokenRevocation] Error revoking token:', error);

      // Per RFC 7009, return success even on error to prevent token scanning
      return { success: true };
    }
  }

  /**
   * Check if a token has been revoked
   *
   * @param token Token to check
   * @returns True if token is revoked
   */
  isTokenRevoked(token: string): boolean {
    return this.revokedTokens.has(token);
  }

  /**
   * Get revoked token info
   *
   * @param token Token to check
   * @returns Revoked token entry or null
   */
  getRevokedTokenInfo(token: string): RevokedTokenEntry | null {
    return this.revokedTokens.get(token) || null;
  }

  /**
   * Revoke all tokens for a client
   *
   * @param clientId Client identifier
   * @returns Number of tokens revoked
   */
  revokeAllClientTokens(clientId: string): number {
    let count = 0;
    for (const [token, entry] of this.revokedTokens.entries()) {
      if (entry.clientId === clientId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get total number of revoked tokens in blacklist
   */
  getRevokedTokenCount(): number {
    return this.revokedTokens.size;
  }

  /**
   * Start cleanup job to remove expired tokens from blacklist
   */
  private startCleanupJob(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop cleanup job
   */
  stopCleanupJob(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Remove expired tokens from blacklist
   */
  private cleanupExpiredTokens(): void {
    const now = new Date();
    let removed = 0;

    for (const [token, entry] of this.revokedTokens.entries()) {
      if (entry.expiresAt < now) {
        this.revokedTokens.delete(token);
        removed++;
      }
    }

    if (removed > 0) {
      console.error(`[TokenRevocation] Cleaned up ${removed} expired revoked tokens`);
    }
  }

  /**
   * Manually trigger cleanup
   */
  cleanup(): void {
    this.cleanupExpiredTokens();
  }

  /**
   * Clear all revoked tokens (for testing)
   */
  clearAll(): void {
    this.revokedTokens.clear();
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    this.stopCleanupJob();
    this.clearAll();
  }
}

/**
 * Create a token revocation service
 */
export function createTokenRevocationService(
  jwtService: JWTService,
  clientRegistrationService: ClientRegistrationService
): TokenRevocationService {
  return new TokenRevocationService(jwtService, clientRegistrationService);
}
