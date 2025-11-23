/**
 * Healthcare Clinical Workflow Server Tests
 *
 * Tests for MCP compliance and clinical workflow features:
 * - Appointment scheduling
 * - Provider availability
 * - Referral management
 * - Care plan management
 * - Clinical messaging
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPClient } from '../../src/client/index.js';
import {
  AppointmentFixtures,
  ReferralFixtures,
  AuditMetadataRequiredFields,
  getFutureAppointmentTime,
} from './fixtures.js';

describe('Clinical Workflow MCP Server', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = new MCPClient();
    await client.connect('node', ['dist/mcp-servers/healthcare/clinical-workflow-server.js']);
  });

  afterAll(async () => {
    await client.disconnect();
  });

  describe('MCP 2025-06-18 Compliance: Tool Definitions', () => {
    it('should list all expected tools', async () => {
      const tools = await client.listTools();
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain('get_appointments');
      expect(toolNames).toContain('schedule_appointment');
      expect(toolNames).toContain('get_provider_availability');
      expect(toolNames).toContain('create_referral');
      expect(toolNames).toContain('get_care_plan');
      expect(toolNames).toContain('update_care_plan');
      expect(toolNames).toContain('send_clinical_message');
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

  describe('get_appointments Tool', () => {
    it('should return structured content', async () => {
      const result = await client.callTool('get_appointments', {
        patientId: 'P12345',
      });

      expect(result).toHaveProperty('structuredContent');
      expect(result.structuredContent).toHaveProperty('success', true);
      expect(result.structuredContent).toHaveProperty('appointments');
    });

    it('should return array of appointments', async () => {
      const result = await client.callTool('get_appointments', {
        patientId: 'P12345',
      });

      expect(Array.isArray(result.structuredContent.appointments)).toBe(true);
    });

    it('should filter by date range', async () => {
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const result = await client.callTool('get_appointments', {
        patientId: 'P12345',
        startDate,
        endDate,
      });

      expect(result.structuredContent.success).toBe(true);
    });

    it('should filter by status', async () => {
      const result = await client.callTool('get_appointments', {
        patientId: 'P12345',
        status: 'booked',
      });

      for (const appt of result.structuredContent.appointments) {
        expect(appt.status).toBe('booked');
      }
    });

    it('should include audit metadata', async () => {
      const result = await client.callTool('get_appointments', {
        patientId: 'P12345',
      });

      expect(result.structuredContent).toHaveProperty('_audit');

      const audit = result.structuredContent._audit;
      for (const field of AuditMetadataRequiredFields) {
        expect(audit).toHaveProperty(field);
      }
    });

    it('should have text content alongside structured content', async () => {
      const result = await client.callTool('get_appointments', {
        patientId: 'P12345',
      });

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('schedule_appointment Tool', () => {
    it('should create appointment with valid data', async () => {
      const fixture = AppointmentFixtures[0];
      const appointmentTime = getFutureAppointmentTime(7);

      const result = await client.callTool('schedule_appointment', {
        patientId: fixture.patientId,
        providerId: fixture.providerId,
        appointmentType: fixture.appointmentType,
        startTime: appointmentTime,
        duration: fixture.duration,
        reason: 'Follow-up visit',
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.appointment).toBeDefined();
      expect(result.structuredContent.appointment.status).toBe('booked');
    });

    it('should include appointment ID in response', async () => {
      const appointmentTime = getFutureAppointmentTime(14);

      const result = await client.callTool('schedule_appointment', {
        patientId: 'P12345',
        providerId: 'DR001',
        appointmentType: 'follow-up',
        startTime: appointmentTime,
        duration: 30,
      });

      expect(result.structuredContent.appointment).toHaveProperty('id');
      expect(result.structuredContent.appointment.id).toBeTruthy();
    });

    it('should include confirmation number', async () => {
      const appointmentTime = getFutureAppointmentTime(21);

      const result = await client.callTool('schedule_appointment', {
        patientId: 'P12345',
        providerId: 'DR001',
        appointmentType: 'follow-up',
        startTime: appointmentTime,
        duration: 30,
      });

      expect(result.structuredContent).toHaveProperty('confirmationNumber');
      expect(result.structuredContent.confirmationNumber).toBeTruthy();
    });

    it('should include audit metadata', async () => {
      const appointmentTime = getFutureAppointmentTime(28);

      const result = await client.callTool('schedule_appointment', {
        patientId: 'P12345',
        providerId: 'DR001',
        appointmentType: 'follow-up',
        startTime: appointmentTime,
        duration: 30,
      });

      expect(result.structuredContent).toHaveProperty('_audit');
      expect(result.structuredContent._audit.dataClassification).toBe('internal');
    });
  });

  describe('get_provider_availability Tool', () => {
    it('should return availability slots', async () => {
      const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const result = await client.callTool('get_provider_availability', {
        providerId: 'DR001',
        date,
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.availability).toBeDefined();
      expect(result.structuredContent.availability.slots).toBeDefined();
    });

    it('should include provider info', async () => {
      const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const result = await client.callTool('get_provider_availability', {
        providerId: 'DR001',
        date,
      });

      expect(result.structuredContent.availability).toHaveProperty('providerId');
      expect(result.structuredContent.availability).toHaveProperty('providerName');
    });

    it('should mark slots as available or unavailable', async () => {
      const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const result = await client.callTool('get_provider_availability', {
        providerId: 'DR001',
        date,
      });

      for (const slot of result.structuredContent.availability.slots) {
        expect(slot).toHaveProperty('available');
        expect(typeof slot.available).toBe('boolean');
      }
    });

    it('should count available slots', async () => {
      const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const result = await client.callTool('get_provider_availability', {
        providerId: 'DR001',
        date,
      });

      expect(result.structuredContent).toHaveProperty('availableSlots');
      expect(typeof result.structuredContent.availableSlots).toBe('number');
    });
  });

  describe('create_referral Tool', () => {
    it('should create referral with valid data', async () => {
      const fixture = ReferralFixtures[0];

      const result = await client.callTool('create_referral', {
        patientId: fixture.patientId,
        requesterId: fixture.requesterId,
        recipientId: fixture.recipientId,
        priority: fixture.priority,
        reason: fixture.reason,
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.referral).toBeDefined();
    });

    it('should include referral ID', async () => {
      const fixture = ReferralFixtures[1];

      const result = await client.callTool('create_referral', {
        patientId: fixture.patientId,
        requesterId: fixture.requesterId,
        recipientId: fixture.recipientId,
        priority: fixture.priority,
        reason: fixture.reason,
      });

      expect(result.structuredContent.referral).toHaveProperty('id');
      expect(result.structuredContent).toHaveProperty('referralId');
    });

    it('should set correct priority', async () => {
      const result = await client.callTool('create_referral', {
        patientId: 'P12345',
        requesterId: 'DR001',
        recipientId: 'DR003',
        priority: 'urgent',
        reason: 'Urgent cardiac evaluation needed',
      });

      expect(result.structuredContent.referral.priority).toBe('urgent');
    });

    it('should include audit metadata with confidential classification', async () => {
      const result = await client.callTool('create_referral', {
        patientId: 'P12345',
        requesterId: 'DR001',
        recipientId: 'DR003',
        priority: 'routine',
        reason: 'Annual specialist review',
      });

      expect(result.structuredContent).toHaveProperty('_audit');
      expect(result.structuredContent._audit.dataClassification).toBe('confidential');
    });
  });

  describe('get_care_plan Tool', () => {
    it('should return care plan for patient', async () => {
      const result = await client.callTool('get_care_plan', {
        patientId: 'P12345',
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.carePlan).toBeDefined();
    });

    it('should include goals', async () => {
      const result = await client.callTool('get_care_plan', {
        patientId: 'P12345',
      });

      expect(result.structuredContent.carePlan).toHaveProperty('goals');
      expect(Array.isArray(result.structuredContent.carePlan.goals)).toBe(true);
    });

    it('should include activities', async () => {
      const result = await client.callTool('get_care_plan', {
        patientId: 'P12345',
      });

      expect(result.structuredContent.carePlan).toHaveProperty('activities');
      expect(Array.isArray(result.structuredContent.carePlan.activities)).toBe(true);
    });

    it('should include care plan details', async () => {
      const result = await client.callTool('get_care_plan', {
        patientId: 'P12345',
      });

      expect(result.structuredContent.carePlan).toHaveProperty('id');
      expect(result.structuredContent.carePlan).toHaveProperty('title');
      expect(result.structuredContent.carePlan).toHaveProperty('status');
    });

    it('should include audit metadata with restricted classification', async () => {
      const result = await client.callTool('get_care_plan', {
        patientId: 'P12345',
      });

      expect(result.structuredContent).toHaveProperty('_audit');
      expect(result.structuredContent._audit.dataClassification).toBe('restricted');
    });
  });

  describe('update_care_plan Tool', () => {
    it('should update goal status', async () => {
      const result = await client.callTool('update_care_plan', {
        carePlanId: 'CP001',
        goalId: 'G001',
        newStatus: 'completed',
      });

      expect(result.structuredContent.success).toBe(true);
    });

    it('should update activity status', async () => {
      const result = await client.callTool('update_care_plan', {
        carePlanId: 'CP001',
        activityId: 'A001',
        newStatus: 'in-progress',
      });

      expect(result.structuredContent.success).toBe(true);
    });

    it('should track update details', async () => {
      const result = await client.callTool('update_care_plan', {
        carePlanId: 'CP001',
        goalId: 'G002',
        newStatus: 'active',
      });

      expect(result.structuredContent).toHaveProperty('updated');
      expect(result.structuredContent).toHaveProperty('carePlanId');
    });

    it('should include audit metadata', async () => {
      const result = await client.callTool('update_care_plan', {
        carePlanId: 'CP001',
        activityId: 'A002',
        newStatus: 'completed',
      });

      expect(result.structuredContent).toHaveProperty('_audit');
      expect(result.structuredContent._audit.accessedFields.length).toBeGreaterThan(0);
    });
  });

  describe('send_clinical_message Tool', () => {
    it('should send message to recipients', async () => {
      const result = await client.callTool('send_clinical_message', {
        senderId: 'DR001',
        recipientIds: ['DR003'],
        category: 'notification',
        priority: 'routine',
        subject: 'Patient Update',
        message: 'Patient follow-up completed.',
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent).toHaveProperty('messageId');
    });

    it('should include message ID', async () => {
      const result = await client.callTool('send_clinical_message', {
        senderId: 'DR001',
        recipientIds: ['DR003'],
        category: 'request',
        priority: 'urgent',
        subject: 'Lab Review',
        message: 'Please review labs for P12345.',
      });

      expect(result.structuredContent.messageId).toBeTruthy();
    });

    it('should set correct priority', async () => {
      const result = await client.callTool('send_clinical_message', {
        senderId: 'DR001',
        recipientIds: ['DR003'],
        category: 'alert',
        priority: 'stat',
        subject: 'Critical Labs',
        message: 'Critical lab values for patient.',
        patientId: 'P12345',
      });

      expect(result.structuredContent.priority).toBe('stat');
    });

    it('should include sent timestamp', async () => {
      const result = await client.callTool('send_clinical_message', {
        senderId: 'DR001',
        recipientIds: ['DR003'],
        category: 'notification',
        priority: 'routine',
        subject: 'Test',
        message: 'Test message.',
      });

      expect(result.structuredContent).toHaveProperty('sent');
    });

    it('should include audit metadata with confidential classification', async () => {
      const result = await client.callTool('send_clinical_message', {
        senderId: 'DR001',
        recipientIds: ['DR003'],
        category: 'notification',
        priority: 'routine',
        subject: 'Test',
        message: 'Test message.',
      });

      expect(result.structuredContent).toHaveProperty('_audit');
      expect(result.structuredContent._audit.dataClassification).toBe('confidential');
    });
  });

  describe('Resource Access', () => {
    it('should list workflow resources', async () => {
      const resources = await client.listResources();

      expect(resources.length).toBeGreaterThan(0);
    });

    it('should include provider directory resource', async () => {
      const resources = await client.listResources();
      const providerResource = resources.find((r) => r.uri === 'schedule://providers');

      expect(providerResource).toBeDefined();
      expect(providerResource?.name).toBe('provider_directory');
    });

    it('should include referrals resource', async () => {
      const resources = await client.listResources();
      const referralsResource = resources.find((r) => r.uri === 'workflow://referrals');

      expect(referralsResource).toBeDefined();
      expect(referralsResource?.name).toBe('pending_referrals');
    });
  });
});
