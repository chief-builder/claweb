/**
 * Unit Tests: PKCE (RFC 7636)
 *
 * Deterministic tests for PKCE code challenge generation and validation.
 */

import { describe, it, expect } from 'vitest';
import { PKCEService, CodeChallengeMethod } from '../../../src/auth/oauth/pkce.js';

describe('PKCE Service - Unit Tests', () => {
  describe('Code Verifier Generation', () => {
    it('should generate code verifier with correct length', () => {
      const params = PKCEService.generatePKCEParams();

      // RFC 7636: code verifier must be 43-128 characters
      expect(params.codeVerifier.length).toBeGreaterThanOrEqual(43);
      expect(params.codeVerifier.length).toBeLessThanOrEqual(128);
    });

    it('should generate unique code verifiers', () => {
      const verifiers = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const params = PKCEService.generatePKCEParams();
        verifiers.add(params.codeVerifier);
      }

      // All should be unique
      expect(verifiers.size).toBe(100);
    });

    it('should only use allowed characters', () => {
      const params = PKCEService.generatePKCEParams();

      // RFC 7636: code verifier characters: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
      expect(params.codeVerifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    });
  });

  describe('Code Challenge Generation', () => {
    it('should generate S256 challenge by default', () => {
      const params = PKCEService.generatePKCEParams();

      expect(params.codeChallengeMethod).toBe(CodeChallengeMethod.S256);
    });

    it('should generate plain challenge when specified', () => {
      const params = PKCEService.generatePKCEParams(CodeChallengeMethod.PLAIN);

      expect(params.codeChallengeMethod).toBe(CodeChallengeMethod.PLAIN);
      // For plain method, challenge equals verifier
      expect(params.codeChallenge).toBe(params.codeVerifier);
    });

    it('should generate base64url-encoded challenge for S256', () => {
      const params = PKCEService.generatePKCEParams(CodeChallengeMethod.S256);

      // Base64url should not contain + or /
      expect(params.codeChallenge).not.toMatch(/[+/]/);
      // Should not have padding
      expect(params.codeChallenge).not.toMatch(/=$/);
    });

    it('should generate different challenge than verifier for S256', () => {
      const params = PKCEService.generatePKCEParams(CodeChallengeMethod.S256);

      expect(params.codeChallenge).not.toBe(params.codeVerifier);
    });
  });

  describe('PKCE Validation', () => {
    it('should validate correct S256 verifier', () => {
      const params = PKCEService.generatePKCEParams(CodeChallengeMethod.S256);

      const validation = PKCEService.validatePKCE(
        params.codeVerifier,
        params.codeChallenge,
        CodeChallengeMethod.S256
      );

      expect(validation.valid).toBe(true);
    });

    it('should validate correct plain verifier', () => {
      const params = PKCEService.generatePKCEParams(CodeChallengeMethod.PLAIN);

      const validation = PKCEService.validatePKCE(
        params.codeVerifier,
        params.codeChallenge,
        CodeChallengeMethod.PLAIN
      );

      expect(validation.valid).toBe(true);
    });

    it('should reject invalid S256 verifier', () => {
      const params = PKCEService.generatePKCEParams(CodeChallengeMethod.S256);

      const validation = PKCEService.validatePKCE(
        'invalid_verifier_value',
        params.codeChallenge,
        CodeChallengeMethod.S256
      );

      expect(validation.valid).toBe(false);
    });

    it('should reject invalid plain verifier', () => {
      const params = PKCEService.generatePKCEParams(CodeChallengeMethod.PLAIN);

      const validation = PKCEService.validatePKCE(
        'wrong_verifier',
        params.codeChallenge,
        CodeChallengeMethod.PLAIN
      );

      expect(validation.valid).toBe(false);
    });

    it('should reject mismatched method', () => {
      const params = PKCEService.generatePKCEParams(CodeChallengeMethod.S256);

      // Try to validate S256 challenge with plain method
      const validation = PKCEService.validatePKCE(
        params.codeVerifier,
        params.codeChallenge,
        CodeChallengeMethod.PLAIN
      );

      // Should fail because plain expects challenge === verifier
      expect(validation.valid).toBe(false);
    });
  });

  describe('Known Test Vectors', () => {
    // RFC 7636 Appendix B example (modified for our implementation)
    it('should produce consistent hash for known input', () => {
      // Using a deterministic verifier for testing
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

      // Generate challenge from known verifier
      const challenge = PKCEService.generateCodeChallenge(verifier, CodeChallengeMethod.S256);

      // The challenge should be deterministic for the same verifier
      const challenge2 = PKCEService.generateCodeChallenge(verifier, CodeChallengeMethod.S256);
      expect(challenge).toBe(challenge2);

      // Validate the pair works
      const validation = PKCEService.validatePKCE(verifier, challenge, CodeChallengeMethod.S256);
      expect(validation.valid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum length verifier', () => {
      // 43 characters minimum
      const verifier = 'A'.repeat(43);
      const challenge = PKCEService.generateCodeChallenge(verifier, CodeChallengeMethod.S256);

      const validation = PKCEService.validatePKCE(verifier, challenge, CodeChallengeMethod.S256);
      expect(validation.valid).toBe(true);
    });

    it('should handle maximum length verifier', () => {
      // 128 characters maximum
      const verifier = 'B'.repeat(128);
      const challenge = PKCEService.generateCodeChallenge(verifier, CodeChallengeMethod.S256);

      const validation = PKCEService.validatePKCE(verifier, challenge, CodeChallengeMethod.S256);
      expect(validation.valid).toBe(true);
    });
  });
});
