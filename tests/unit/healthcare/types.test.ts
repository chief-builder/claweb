/**
 * Unit Tests: Healthcare Types and Utilities
 *
 * Deterministic tests for healthcare type definitions and utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  generateEventId,
  createAuditMetadata,
  detectPIIFields,
  redactPII,
} from '../../../src/mcp-servers/healthcare/types/healthcare.js';
import { AuditMetadataRequiredFields, DataClassificationLevels } from '../../healthcare/fixtures.js';

describe('Healthcare Types - Unit Tests', () => {
  describe('generateEventId', () => {
    it('should generate unique event IDs', () => {
      const id1 = generateEventId();
      const id2 = generateEventId();

      expect(id1).not.toBe(id2);
    });

    it('should have correct format', () => {
      const id = generateEventId();

      expect(id).toMatch(/^evt_\d+_[a-z0-9]+$/);
    });

    it('should start with evt_ prefix', () => {
      const id = generateEventId();

      expect(id.startsWith('evt_')).toBe(true);
    });
  });

  describe('createAuditMetadata', () => {
    it('should create audit metadata with all required fields', () => {
      const audit = createAuditMetadata(['name', 'dob']);

      for (const field of AuditMetadataRequiredFields) {
        expect(audit).toHaveProperty(field);
      }
    });

    it('should include eventId', () => {
      const audit = createAuditMetadata(['name']);

      expect(audit.eventId).toMatch(/^evt_/);
    });

    it('should include timestamp in ISO format', () => {
      const audit = createAuditMetadata(['name']);

      expect(audit.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should set accessed fields correctly', () => {
      const fields = ['name', 'dob', 'allergies'];
      const audit = createAuditMetadata(fields);

      expect(audit.accessedFields).toEqual(fields);
    });

    it('should detect PII fields automatically', () => {
      const audit = createAuditMetadata(['name', 'dob', 'ssn', 'status']);

      expect(audit.piiAccessed).toBe(true);
      expect(audit.piiFields).toContain('name');
      expect(audit.piiFields).toContain('dob');
      expect(audit.piiFields).toContain('ssn');
      expect(audit.piiFields).not.toContain('status');
    });

    it('should set piiAccessed to false when no PII', () => {
      const audit = createAuditMetadata(['status', 'timestamp', 'count']);

      expect(audit.piiAccessed).toBe(false);
      expect(audit.piiFields).toBeUndefined();
    });

    it('should use default classification', () => {
      const audit = createAuditMetadata(['name']);

      expect(audit.dataClassification).toBe('internal');
    });

    it('should allow custom data classification', () => {
      const audit = createAuditMetadata(['name'], {
        dataClassification: 'restricted',
      });

      expect(audit.dataClassification).toBe('restricted');
    });

    it('should allow custom options', () => {
      const audit = createAuditMetadata(['name'], {
        purpose: 'treatment',
        breakGlass: true,
        breakGlassReason: 'Emergency',
      });

      expect(audit.purpose).toBe('treatment');
      expect(audit.breakGlass).toBe(true);
      expect(audit.breakGlassReason).toBe('Emergency');
    });

    it('should include compliance context when provided', () => {
      const audit = createAuditMetadata(['name'], {
        complianceContext: {
          hipaaCategory: 'treatment',
          minimumNecessary: true,
          breakGlass: false,
        },
      });

      expect(audit.complianceContext).toBeDefined();
      expect(audit.complianceContext?.hipaaCategory).toBe('treatment');
      expect(audit.complianceContext?.minimumNecessary).toBe(true);
    });
  });

  describe('detectPIIFields', () => {
    it('should detect name-related fields', () => {
      const pii = detectPIIFields(['name', 'firstName', 'lastName', 'givenName', 'familyName']);

      expect(pii).toContain('name');
      expect(pii).toContain('firstName');
      expect(pii).toContain('lastName');
    });

    it('should detect date of birth fields', () => {
      const pii = detectPIIFields(['dob', 'dateOfBirth', 'birthDate']);

      expect(pii.length).toBe(3);
    });

    it('should detect SSN fields', () => {
      const pii = detectPIIFields(['ssn', 'socialSecurity', 'social_security_number']);

      expect(pii.length).toBe(3);
    });

    it('should detect address fields', () => {
      const pii = detectPIIFields(['address', 'street', 'city', 'state', 'zip', 'postalCode']);

      expect(pii.length).toBe(6);
    });

    it('should detect contact fields', () => {
      const pii = detectPIIFields(['phone', 'email', 'telephone', 'mobile']);

      expect(pii.length).toBe(4);
    });

    it('should detect medical record numbers', () => {
      const pii = detectPIIFields(['mrn', 'medicalRecordNumber']);

      expect(pii.length).toBe(2);
    });

    it('should detect insurance fields', () => {
      const pii = detectPIIFields(['insurance', 'memberId', 'groupId']);

      expect(pii.length).toBe(3);
    });

    it('should be case insensitive', () => {
      const pii = detectPIIFields(['NAME', 'DOB', 'SSN', 'Email']);

      expect(pii.length).toBe(4);
    });

    it('should return empty array for non-PII fields', () => {
      const pii = detectPIIFields(['status', 'severity', 'count', 'timestamp']);

      expect(pii.length).toBe(0);
    });

    it('should handle mixed fields', () => {
      const pii = detectPIIFields(['name', 'status', 'dob', 'severity', 'phone']);

      expect(pii).toContain('name');
      expect(pii).toContain('dob');
      expect(pii).toContain('phone');
      expect(pii.length).toBe(3);
    });
  });

  describe('redactPII', () => {
    it('should redact specified fields', () => {
      const data = {
        name: 'John Doe',
        dob: '1985-03-15',
        status: 'active',
      };

      const redacted = redactPII(data, ['name', 'dob']);

      expect(redacted.name).toBe('[REDACTED]');
      expect(redacted.dob).toBe('[REDACTED]');
      expect(redacted.status).toBe('active');
    });

    it('should not modify original object', () => {
      const data = { name: 'John Doe' };
      const redacted = redactPII(data, ['name']);

      expect(data.name).toBe('John Doe');
      expect(redacted.name).toBe('[REDACTED]');
    });

    it('should handle non-existent fields gracefully', () => {
      const data = { name: 'John Doe' };
      const redacted = redactPII(data, ['name', 'nonexistent']);

      expect(redacted.name).toBe('[REDACTED]');
      expect(redacted).not.toHaveProperty('nonexistent');
    });

    it('should handle empty field list', () => {
      const data = { name: 'John Doe', status: 'active' };
      const redacted = redactPII(data, []);

      expect(redacted.name).toBe('John Doe');
      expect(redacted.status).toBe('active');
    });

    it('should handle complex objects', () => {
      const data = {
        patient: { name: 'John', id: 'P12345' },
        ssn: '123-45-6789',
        active: true,
      };

      const redacted = redactPII(data, ['ssn']);

      expect(redacted.ssn).toBe('[REDACTED]');
      expect(redacted.patient).toEqual({ name: 'John', id: 'P12345' });
      expect(redacted.active).toBe(true);
    });
  });

  describe('Data Classification Levels', () => {
    it('should have all expected classification levels', () => {
      const expectedLevels = ['public', 'internal', 'confidential', 'restricted'];

      expect(DataClassificationLevels).toEqual(expectedLevels);
    });
  });
});
