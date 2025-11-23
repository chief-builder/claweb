/**
 * Healthcare Pharmacy Server Tests
 *
 * Tests for MCP compliance and pharmacy-specific features:
 * - Drug interaction checking
 * - Dosage validation
 * - Formulary status
 * - Prescription verification
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPClient } from '../../src/client/index.js';
import {
  DrugInteractionFixtures,
  DosageFixtures,
  AuditMetadataRequiredFields,
  getInteractionsBySeverity,
} from './fixtures.js';

describe('Pharmacy MCP Server', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = new MCPClient();
    await client.connect('node', ['dist/mcp-servers/healthcare/pharmacy-server.js']);
  });

  afterAll(async () => {
    await client.disconnect();
  });

  describe('MCP 2025-06-18 Compliance: Tool Definitions', () => {
    it('should list all expected tools', async () => {
      const tools = await client.listTools();
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain('check_drug_interactions');
      expect(toolNames).toContain('get_medication_info');
      expect(toolNames).toContain('check_dosage');
      expect(toolNames).toContain('get_formulary_status');
      expect(toolNames).toContain('get_alternatives');
      expect(toolNames).toContain('verify_prescription');
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

  describe('check_drug_interactions Tool', () => {
    it('should return structured content', async () => {
      const result = await client.callTool('check_drug_interactions', {
        newDrug: 'Warfarin',
        currentMedications: ['Aspirin'],
      });

      expect(result).toHaveProperty('structuredContent');
      expect(result.structuredContent).toHaveProperty('success', true);
    });

    it('should detect major drug interactions', async () => {
      const fixture = DrugInteractionFixtures.find(
        (f) => f.newDrug === 'Warfarin' && f.currentMedications.includes('Aspirin')
      );

      const result = await client.callTool('check_drug_interactions', {
        newDrug: fixture!.newDrug,
        currentMedications: fixture!.currentMedications,
      });

      // Check hasSevereInteractions flag
      expect(result.structuredContent.hasSevereInteractions).toBe(true);
      expect(result.structuredContent.interactions.length).toBeGreaterThan(0);

      const interaction = result.structuredContent.interactions[0];
      expect(interaction.severity).toBe('major');
    });

    it('should return no interactions for safe combinations', async () => {
      const fixture = DrugInteractionFixtures.find(
        (f) => !f.expectInteraction && f.newDrug === 'Metformin'
      );

      const result = await client.callTool('check_drug_interactions', {
        newDrug: fixture!.newDrug,
        currentMedications: fixture!.currentMedications,
      });

      expect(result.structuredContent.hasSevereInteractions).toBe(false);
      expect(result.structuredContent.interactions.length).toBe(0);
    });

    it('should include audit metadata', async () => {
      const result = await client.callTool('check_drug_interactions', {
        newDrug: 'Warfarin',
        currentMedications: ['Aspirin'],
      });

      expect(result.structuredContent).toHaveProperty('_audit');

      const audit = result.structuredContent._audit;
      for (const field of AuditMetadataRequiredFields) {
        expect(audit).toHaveProperty(field);
      }
    });

    it('should have text content alongside structured content', async () => {
      const result = await client.callTool('check_drug_interactions', {
        newDrug: 'Warfarin',
        currentMedications: ['Aspirin'],
      });

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
    });

    it('should indicate safeToAdd flag', async () => {
      // Safe combination
      const safeResult = await client.callTool('check_drug_interactions', {
        newDrug: 'Metformin',
        currentMedications: ['Lisinopril'],
      });
      expect(safeResult.structuredContent.safeToAdd).toBe(true);

      // Unsafe combination
      const unsafeResult = await client.callTool('check_drug_interactions', {
        newDrug: 'Warfarin',
        currentMedications: ['Aspirin'],
      });
      // Still safe to add (not contraindicated), but has major interaction
      expect(unsafeResult.structuredContent).toHaveProperty('safeToAdd');
    });
  });

  describe('check_dosage Tool', () => {
    it('should validate appropriate dosages', async () => {
      const fixture = DosageFixtures.find(
        (f) => f.expectAppropriate && f.drugName === 'Lisinopril'
      );

      const result = await client.callTool('check_dosage', {
        drugName: fixture!.drugName,
        dose: fixture!.dose,
        unit: fixture!.unit,
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.appropriate).toBe(true);
    });

    it('should flag inappropriate dosages', async () => {
      const fixture = DosageFixtures.find(
        (f) => !f.expectAppropriate && f.drugName === 'Lisinopril'
      );

      const result = await client.callTool('check_dosage', {
        drugName: fixture!.drugName,
        dose: fixture!.dose,
        unit: fixture!.unit,
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.appropriate).toBe(false);
    });

    it('should include recommended range', async () => {
      const result = await client.callTool('check_dosage', {
        drugName: 'Metformin',
        dose: 500,
        unit: 'mg',
      });

      expect(result.structuredContent).toHaveProperty('recommendedRange');
      expect(result.structuredContent.recommendedRange).toHaveProperty('min');
      expect(result.structuredContent.recommendedRange).toHaveProperty('max');
    });

    it('should include audit metadata', async () => {
      const result = await client.callTool('check_dosage', {
        drugName: 'Aspirin',
        dose: 81,
        unit: 'mg',
      });

      expect(result.structuredContent).toHaveProperty('_audit');
      // Dosage checks involve patient-specific info, so classification is confidential
      expect(result.structuredContent._audit.dataClassification).toBe('confidential');
    });
  });

  describe('get_medication_info Tool', () => {
    it('should return medication details', async () => {
      const result = await client.callTool('get_medication_info', {
        drugName: 'Lisinopril',
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.drug).toBeDefined();
      expect(result.structuredContent.drug.name).toBe('Lisinopril');
    });

    it('should include drug class information', async () => {
      const result = await client.callTool('get_medication_info', {
        drugName: 'Lisinopril',
      });

      expect(result.structuredContent.drug).toHaveProperty('drugClass');
      expect(Array.isArray(result.structuredContent.drug.drugClass)).toBe(true);
    });

    it('should return error for unknown drugs', async () => {
      const result = await client.callTool('get_medication_info', {
        drugName: 'UnknownDrug12345',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/not found|unknown/i);
    });
  });

  describe('get_formulary_status Tool', () => {
    it('should return formulary coverage status', async () => {
      const result = await client.callTool('get_formulary_status', {
        drugName: 'Lisinopril',
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.formularyStatus).toHaveProperty('covered');
    });

    it('should include tier information when covered', async () => {
      const result = await client.callTool('get_formulary_status', {
        drugName: 'Lisinopril',
      });

      if (result.structuredContent.formularyStatus.covered) {
        expect(result.structuredContent.formularyStatus).toHaveProperty('tier');
      }
    });

    it('should indicate prior authorization requirements', async () => {
      const result = await client.callTool('get_formulary_status', {
        drugName: 'Lisinopril',
      });

      expect(result.structuredContent.formularyStatus).toHaveProperty('priorAuthRequired');
    });
  });

  describe('get_alternatives Tool', () => {
    it('should return therapeutic alternatives', async () => {
      const result = await client.callTool('get_alternatives', {
        drugName: 'Lisinopril',
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.alternatives).toBeDefined();
      expect(Array.isArray(result.structuredContent.alternatives)).toBe(true);
    });

    it('should include original drug info', async () => {
      const result = await client.callTool('get_alternatives', {
        drugName: 'Lisinopril',
      });

      expect(result.structuredContent.originalDrug).toBeDefined();
      expect(result.structuredContent.originalDrug.name).toBe('Lisinopril');
    });
  });

  describe('verify_prescription Tool', () => {
    it('should verify valid prescriptions', async () => {
      const result = await client.callTool('verify_prescription', {
        prescriptionId: 'RX001',
        patientId: 'P12345',
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent).toHaveProperty('valid');
      expect(result.structuredContent.verification).toBeDefined();
    });

    it('should check refills remaining', async () => {
      const result = await client.callTool('verify_prescription', {
        prescriptionId: 'RX001',
        patientId: 'P12345',
      });

      expect(result.structuredContent.verification).toHaveProperty('refillsRemaining');
    });

    it('should return issues for expired prescriptions', async () => {
      const result = await client.callTool('verify_prescription', {
        prescriptionId: 'RX_expired_001',
        patientId: 'P12345',
      });

      expect(result.structuredContent.valid).toBe(false);
      expect(result.structuredContent.issues).toBeDefined();
      expect(result.structuredContent.issues.length).toBeGreaterThan(0);
    });

    it('should return issues for no-refills prescriptions', async () => {
      const result = await client.callTool('verify_prescription', {
        prescriptionId: 'RX_no-refills_001',
        patientId: 'P12345',
      });

      expect(result.structuredContent.valid).toBe(false);
      expect(result.structuredContent.issues).toBeDefined();
      expect(result.structuredContent.issues.length).toBeGreaterThan(0);
    });

    it('should include audit metadata with restricted classification', async () => {
      const result = await client.callTool('verify_prescription', {
        prescriptionId: 'RX001',
        patientId: 'P12345',
      });

      expect(result.structuredContent).toHaveProperty('_audit');
      expect(result.structuredContent._audit.dataClassification).toBe('restricted');
    });
  });

  describe('Interaction Severity Levels', () => {
    it('should correctly categorize major interactions', async () => {
      const majorFixtures = getInteractionsBySeverity('major');

      for (const fixture of majorFixtures.slice(0, 2)) {
        const result = await client.callTool('check_drug_interactions', {
          newDrug: fixture.newDrug,
          currentMedications: fixture.currentMedications,
        });

        expect(result.structuredContent.hasSevereInteractions).toBe(true);
        const interaction = result.structuredContent.interactions.find(
          (i: { severity: string }) => i.severity === 'major'
        );
        expect(interaction).toBeDefined();
      }
    });

    it('should correctly categorize moderate interactions', async () => {
      const moderateFixtures = getInteractionsBySeverity('moderate');

      for (const fixture of moderateFixtures) {
        const result = await client.callTool('check_drug_interactions', {
          newDrug: fixture.newDrug,
          currentMedications: fixture.currentMedications,
        });

        const interaction = result.structuredContent.interactions.find(
          (i: { severity: string }) => i.severity === 'moderate'
        );
        expect(interaction).toBeDefined();
      }
    });
  });
});
