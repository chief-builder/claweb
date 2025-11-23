/**
 * Healthcare Patient Records Server Tests
 *
 * Tests for MCP compliance and healthcare-specific features:
 * - Structured output with audit metadata
 * - Tool title compliance (MCP 2025-06-18)
 * - HIPAA audit trail requirements
 * - Break-glass access patterns
 * - Data minimization
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPClient } from '../../src/client/index.js';
import {
  PatientFixtures,
  AuditMetadataRequiredFields,
  getSuccessFixtures,
  getErrorFixtures,
} from './fixtures.js';

describe('Patient Records MCP Server', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = new MCPClient();
    await client.connect('node', ['dist/mcp-servers/healthcare/patient-records-server.js']);
  });

  afterAll(async () => {
    await client.disconnect();
  });

  describe('MCP 2025-06-18 Compliance: Tool Definitions', () => {
    it('should list all expected tools', async () => {
      const tools = await client.listTools();
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain('get_patient');
      expect(toolNames).toContain('search_patients');
      expect(toolNames).toContain('get_patient_conditions');
      expect(toolNames).toContain('get_patient_allergies');
      expect(toolNames).toContain('get_patient_medications');
      expect(toolNames).toContain('get_patient_vitals');
      expect(toolNames).toContain('get_care_team');
    });

    it('should have title field for all tools', async () => {
      const tools = await client.listTools();

      for (const tool of tools) {
        expect(tool).toHaveProperty('title');
        expect(tool.title).toBeTruthy();
        expect(typeof tool.title).toBe('string');
      }
    });

    it('should have outputSchema for all tools', async () => {
      const tools = await client.listTools();

      for (const tool of tools) {
        expect(tool).toHaveProperty('outputSchema');
        expect(tool.outputSchema).toHaveProperty('type');
      }
    });

    it('should have inputSchema for all tools', async () => {
      const tools = await client.listTools();

      for (const tool of tools) {
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type', 'object');
      }
    });
  });

  describe('get_patient Tool', () => {
    it('should return structured content', async () => {
      const result = await client.callTool('get_patient', {
        patientId: 'P12345',
        purpose: 'treatment',
      });

      expect(result).toHaveProperty('structuredContent');
      expect(result.structuredContent).toHaveProperty('success', true);
      expect(result.structuredContent).toHaveProperty('patient');
    });

    it('should include audit metadata in structured content', async () => {
      const result = await client.callTool('get_patient', {
        patientId: 'P12345',
        purpose: 'treatment',
      });

      expect(result.structuredContent).toHaveProperty('_audit');

      const audit = result.structuredContent._audit;
      for (const field of AuditMetadataRequiredFields) {
        expect(audit).toHaveProperty(field);
      }
    });

    it('should detect PII access', async () => {
      const result = await client.callTool('get_patient', {
        patientId: 'P12345',
        purpose: 'treatment',
      });

      const audit = result.structuredContent._audit;
      expect(audit.piiAccessed).toBe(true);
      expect(audit.piiFields).toBeDefined();
      expect(Array.isArray(audit.piiFields)).toBe(true);
    });

    it('should include consent metadata', async () => {
      const result = await client.callTool('get_patient', {
        patientId: 'P12345',
        purpose: 'treatment',
      });

      expect(result.structuredContent).toHaveProperty('_consent');
      expect(result.structuredContent._consent).toHaveProperty('status');
      expect(result.structuredContent._consent).toHaveProperty('purposes');
    });

    it('should return error for non-existent patient', async () => {
      const result = await client.callTool('get_patient', {
        patientId: 'INVALID',
        purpose: 'treatment',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/not found/i);
    });

    it('should have text content alongside structured content', async () => {
      const result = await client.callTool('get_patient', {
        patientId: 'P12345',
        purpose: 'treatment',
      });

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBeTruthy();
    });
  });

  describe('Data Minimization', () => {
    it('should return only requested fields when specified', async () => {
      const result = await client.callTool('get_patient', {
        patientId: 'P12345',
        purpose: 'treatment',
        requestedFields: ['name', 'dob'],
      });

      expect(result.structuredContent).toHaveProperty('_dataMinimization');
      const dm = result.structuredContent._dataMinimization;
      expect(dm.minimizationApplied).toBe(true);
      expect(dm.requestedFields).toEqual(['name', 'dob']);
    });

    it('should track redacted fields', async () => {
      const result = await client.callTool('get_patient', {
        patientId: 'P12345',
        purpose: 'treatment',
        requestedFields: ['name'],
      });

      const dm = result.structuredContent._dataMinimization;
      expect(dm.redactedFields).toBeDefined();
      expect(dm.redactedFields.length).toBeGreaterThan(0);
    });
  });

  describe('Break-Glass Access', () => {
    it('should require breakGlassReason when breakGlass is true', async () => {
      const result = await client.callTool('get_patient', {
        patientId: 'P12345',
        purpose: 'emergency',
        breakGlass: true,
        // Missing breakGlassReason
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/breakGlassReason.*required/i);
    });

    it('should log break-glass access in audit metadata', async () => {
      const result = await client.callTool('get_patient', {
        patientId: 'P12345',
        purpose: 'emergency',
        breakGlass: true,
        breakGlassReason: 'Patient unconscious, need allergy info',
      });

      const audit = result.structuredContent._audit;
      expect(audit.breakGlass).toBe(true);
      expect(audit.breakGlassReason).toBe('Patient unconscious, need allergy info');
      expect(audit.requiresReview).toBe(true);
    });

    it('should set review deadline for break-glass access', async () => {
      const result = await client.callTool('get_patient', {
        patientId: 'P12345',
        purpose: 'emergency',
        breakGlass: true,
        breakGlassReason: 'Emergency access',
      });

      const audit = result.structuredContent._audit;
      expect(audit.reviewDeadline).toBeDefined();
      // Should be about 24 hours from now
      const deadline = new Date(audit.reviewDeadline);
      const now = new Date();
      const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThan(20);
      expect(diffHours).toBeLessThan(28);
    });
  });

  describe('get_patient_allergies Tool', () => {
    it('should return allergy list', async () => {
      const result = await client.callTool('get_patient_allergies', {
        patientId: 'P12345',
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.allergies).toBeDefined();
      expect(Array.isArray(result.structuredContent.allergies)).toBe(true);
    });

    it('should indicate high criticality allergies', async () => {
      const result = await client.callTool('get_patient_allergies', {
        patientId: 'P12345',
      });

      expect(result.structuredContent).toHaveProperty('hasHighCriticality');
    });

    it('should include audit metadata', async () => {
      const result = await client.callTool('get_patient_allergies', {
        patientId: 'P12345',
      });

      expect(result.structuredContent).toHaveProperty('_audit');
      expect(result.structuredContent._audit.dataClassification).toBe('restricted');
    });
  });

  describe('get_patient_medications Tool', () => {
    it('should return medication list', async () => {
      const result = await client.callTool('get_patient_medications', {
        patientId: 'P12345',
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.medications).toBeDefined();
      expect(result.structuredContent.count).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      const result = await client.callTool('get_patient_medications', {
        patientId: 'P12345',
        status: 'active',
      });

      for (const med of result.structuredContent.medications) {
        expect(med.status).toBe('active');
      }
    });
  });

  describe('get_patient_conditions Tool', () => {
    it('should return conditions list', async () => {
      const result = await client.callTool('get_patient_conditions', {
        patientId: 'P12345',
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.conditions).toBeDefined();
      expect(Array.isArray(result.structuredContent.conditions)).toBe(true);
    });

    it('should include HIPAA compliance context', async () => {
      const result = await client.callTool('get_patient_conditions', {
        patientId: 'P12345',
        purpose: 'treatment',
      });

      const audit = result.structuredContent._audit;
      expect(audit.complianceContext).toBeDefined();
      expect(audit.complianceContext.hipaaCategory).toBe('treatment');
    });
  });

  describe('get_care_team Tool', () => {
    it('should return care team members', async () => {
      const result = await client.callTool('get_care_team', {
        patientId: 'P12345',
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.careTeam).toBeDefined();
      expect(result.structuredContent.careTeam.members).toBeDefined();
    });

    it('should have internal classification (less sensitive)', async () => {
      const result = await client.callTool('get_care_team', {
        patientId: 'P12345',
      });

      expect(result.structuredContent._audit.dataClassification).toBe('internal');
    });
  });

  describe('Resource Access', () => {
    it('should list patient resources', async () => {
      const resources = await client.listResources();

      expect(resources.length).toBeGreaterThan(0);
      const patientResources = resources.filter((r) => r.uri.startsWith('patient://'));
      expect(patientResources.length).toBeGreaterThan(0);
    });

    it('should include resource metadata', async () => {
      const resources = await client.listResources();
      const patientResource = resources.find((r) => r.uri === 'patient://P12345');

      expect(patientResource).toBeDefined();
      expect(patientResource?._meta).toBeDefined();
      expect(patientResource?._meta?.dataClassification).toBe('restricted');
    });
  });
});
