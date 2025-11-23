#!/usr/bin/env node

/**
 * Clinical Workflow MCP Server
 *
 * A comprehensive care coordination MCP server demonstrating:
 * - Appointment scheduling
 * - Care plan management
 * - Referral processing
 * - Secure clinical messaging
 * - Provider availability
 *
 * IMPORTANT: This is a demonstration server with mock data.
 * Real implementations would integrate with scheduling systems
 * like Epic Cadence, Cerner Scheduling, or similar.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import {
  Appointment,
  ProviderAvailability,
  TimeSlot,
  Referral,
  CarePlan,
  ClinicalMessage,
  FHIRReference,
  createAuditMetadata,
  generateEventId,
} from './types/healthcare.js';

// =============================================================================
// Mock Data Store
// =============================================================================

const MOCK_PROVIDERS = new Map([
  ['DR001', { id: 'DR001', name: 'Dr. Sarah Smith', specialty: 'Internal Medicine', department: 'Primary Care' }],
  ['DR002', { id: 'DR002', name: 'Dr. Michael Chen', specialty: 'Internal Medicine', department: 'Primary Care' }],
  ['DR003', { id: 'DR003', name: 'Dr. Emily Johnson', specialty: 'Cardiology', department: 'Cardiology' }],
  ['DR004', { id: 'DR004', name: 'Dr. Robert Lee', specialty: 'Endocrinology', department: 'Endocrinology' }],
  ['DR005', { id: 'DR005', name: 'Dr. Lisa Wong', specialty: 'Pulmonology', department: 'Pulmonology' }],
]);

const MOCK_APPOINTMENTS: Map<string, Appointment[]> = new Map([
  ['P12345', [
    {
      id: 'APT001',
      status: 'booked',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0276', code: 'CHECKUP', display: 'Routine Check-up' }], text: 'Annual Physical' },
      reason: [{ coding: [{ system: 'http://snomed.info/sct', code: '410620009', display: 'Well adult encounter' }], text: 'Annual wellness visit' }],
      description: 'Annual physical examination and diabetes follow-up',
      start: '2025-12-01T09:00:00Z',
      end: '2025-12-01T09:30:00Z',
      duration: 30,
      patient: { reference: 'Patient/P12345', display: 'John R. Doe' },
      provider: { reference: 'Practitioner/DR001', display: 'Dr. Sarah Smith' },
      location: { reference: 'Location/LOC001', display: 'Main Campus - Room 201' },
    },
    {
      id: 'APT002',
      status: 'booked',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0276', code: 'FOLLOWUP', display: 'Follow-up' }], text: 'Cardiology Follow-up' },
      reason: [{ coding: [{ system: 'http://snomed.info/sct', code: '38341003', display: 'Hypertension' }], text: 'Hypertension follow-up' }],
      description: 'Cardiology consultation for hypertension management',
      start: '2025-12-15T14:00:00Z',
      end: '2025-12-15T14:45:00Z',
      duration: 45,
      patient: { reference: 'Patient/P12345', display: 'John R. Doe' },
      provider: { reference: 'Practitioner/DR003', display: 'Dr. Emily Johnson' },
      location: { reference: 'Location/LOC002', display: 'Cardiology Center - Suite 400' },
    },
  ]],
]);

const MOCK_CARE_PLANS: Map<string, CarePlan> = new Map([
  ['P12345', {
    id: 'CP001',
    status: 'active',
    intent: 'plan',
    title: 'Diabetes and Hypertension Management Plan',
    description: 'Comprehensive care plan for management of Type 2 Diabetes and Essential Hypertension',
    subject: { reference: 'Patient/P12345', display: 'John R. Doe' },
    period: { start: '2025-01-01', end: '2025-12-31' },
    created: '2025-01-01',
    author: { reference: 'Practitioner/DR001', display: 'Dr. Sarah Smith' },
    careTeam: [{ reference: 'CareTeam/CT001', display: 'Diabetes Care Team' }],
    goals: [
      {
        id: 'G001',
        description: 'Maintain HbA1c below 7%',
        status: 'active',
        priority: 'high',
        target: {
          measure: { coding: [{ system: 'http://loinc.org', code: '4548-4', display: 'HbA1c' }], text: 'HbA1c' },
          detailQuantity: { value: 7, unit: '%' },
          dueDate: '2025-06-30',
        },
      },
      {
        id: 'G002',
        description: 'Reduce blood pressure to below 130/80 mmHg',
        status: 'active',
        priority: 'high',
        target: {
          measure: { coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure' }], text: 'Blood Pressure' },
          dueDate: '2025-06-30',
        },
      },
      {
        id: 'G003',
        description: 'Lose 10 lbs through diet and exercise',
        status: 'active',
        priority: 'medium',
        target: {
          measure: { coding: [{ system: 'http://loinc.org', code: '29463-7', display: 'Body Weight' }], text: 'Weight' },
          detailQuantity: { value: 175, unit: 'lbs' },
          dueDate: '2025-12-31',
        },
      },
    ],
    activities: [
      {
        id: 'A001',
        status: 'in-progress',
        description: 'Take Metformin 500mg twice daily',
        kind: 'medication',
        scheduledPeriod: { start: '2025-01-01' },
        notes: 'Take with meals',
      },
      {
        id: 'A002',
        status: 'in-progress',
        description: 'Take Lisinopril 10mg daily',
        kind: 'medication',
        scheduledPeriod: { start: '2025-01-01' },
        notes: 'Take in the morning',
      },
      {
        id: 'A003',
        status: 'scheduled',
        description: 'Monthly blood pressure monitoring',
        kind: 'observation',
        scheduledPeriod: { start: '2025-01-01', end: '2025-12-31' },
      },
      {
        id: 'A004',
        status: 'scheduled',
        description: 'Quarterly HbA1c testing',
        kind: 'observation',
        scheduledPeriod: { start: '2025-01-01', end: '2025-12-31' },
      },
      {
        id: 'A005',
        status: 'scheduled',
        description: 'Annual eye exam for diabetic retinopathy screening',
        kind: 'procedure',
        scheduledPeriod: { start: '2025-06-01', end: '2025-08-31' },
      },
    ],
  }],
]);

const MOCK_REFERRALS: Referral[] = [
  {
    id: 'REF001',
    status: 'active',
    intent: 'order',
    priority: 'routine',
    patient: { reference: 'Patient/P12345', display: 'John R. Doe' },
    requester: { reference: 'Practitioner/DR001', display: 'Dr. Sarah Smith' },
    recipient: { reference: 'Practitioner/DR003', display: 'Dr. Emily Johnson' },
    reasonCode: [{ coding: [{ system: 'http://snomed.info/sct', code: '38341003', display: 'Essential Hypertension' }], text: 'Hypertension - BP not controlled on current regimen' }],
    description: 'Cardiology evaluation for resistant hypertension',
    authoredOn: '2025-11-15',
    occurrencePeriod: { start: '2025-11-15', end: '2026-02-15' },
    notes: 'Patient has been on Lisinopril 10mg for 6 months with persistent BP > 140/90. Consider adding second agent or adjusting therapy.',
  },
];

const MOCK_MESSAGES: ClinicalMessage[] = [];

// Generate provider availability
function generateAvailability(providerId: string, date: string): ProviderAvailability {
  const provider = MOCK_PROVIDERS.get(providerId);
  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }

  const slots: TimeSlot[] = [];
  const startHour = 8;
  const endHour = 17;

  for (let hour = startHour; hour < endHour; hour++) {
    // Skip lunch hour
    if (hour === 12) continue;

    // Randomly mark some slots as unavailable
    const available = Math.random() > 0.3;

    slots.push({
      start: `${date}T${hour.toString().padStart(2, '0')}:00:00Z`,
      end: `${date}T${hour.toString().padStart(2, '0')}:30:00Z`,
      available,
      appointmentType: available ? 'Follow-up' : undefined,
    });

    slots.push({
      start: `${date}T${hour.toString().padStart(2, '0')}:30:00Z`,
      end: `${date}T${(hour + 1).toString().padStart(2, '0')}:00:00Z`,
      available: Math.random() > 0.3,
      appointmentType: available ? 'Follow-up' : undefined,
    });
  }

  return {
    providerId,
    providerName: provider.name,
    date,
    slots,
  };
}

// =============================================================================
// Clinical Workflow MCP Server
// =============================================================================

class ClinicalWorkflowMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'clinical-workflow-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: 'get_appointments',
          title: 'Get Patient Appointments',
          description: 'Retrieve upcoming and past appointments for a patient',
          inputSchema: {
            type: 'object',
            properties: {
              patientId: { type: 'string', description: 'Patient ID' },
              status: {
                type: 'string',
                enum: ['booked', 'arrived', 'fulfilled', 'cancelled', 'all'],
                description: 'Filter by appointment status',
                default: 'booked',
              },
              startDate: { type: 'string', description: 'Start date filter (YYYY-MM-DD)' },
              endDate: { type: 'string', description: 'End date filter (YYYY-MM-DD)' },
            },
            required: ['patientId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              appointments: { type: 'array' },
              count: { type: 'number' },
              _audit: { type: 'object' },
            },
          },
        },
        {
          name: 'schedule_appointment',
          title: 'Schedule Appointment',
          description: 'Schedule a new appointment for a patient',
          inputSchema: {
            type: 'object',
            properties: {
              patientId: { type: 'string', description: 'Patient ID' },
              providerId: { type: 'string', description: 'Provider ID' },
              startTime: { type: 'string', description: 'Appointment start time (ISO 8601)' },
              duration: { type: 'number', description: 'Appointment duration in minutes', default: 30 },
              appointmentType: {
                type: 'string',
                enum: ['new-patient', 'follow-up', 'annual-physical', 'urgent', 'procedure'],
                description: 'Type of appointment',
              },
              reason: { type: 'string', description: 'Reason for visit' },
              notes: { type: 'string', description: 'Additional notes' },
            },
            required: ['patientId', 'providerId', 'startTime', 'appointmentType'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              appointment: { type: 'object' },
              confirmationNumber: { type: 'string' },
              _audit: { type: 'object' },
            },
          },
        },
        {
          name: 'get_provider_availability',
          title: 'Get Provider Availability',
          description: 'Check provider schedule availability for a given date range',
          inputSchema: {
            type: 'object',
            properties: {
              providerId: { type: 'string', description: 'Provider ID' },
              date: { type: 'string', description: 'Date to check (YYYY-MM-DD)' },
              appointmentType: {
                type: 'string',
                enum: ['new-patient', 'follow-up', 'annual-physical', 'urgent', 'procedure'],
                description: 'Type of appointment (affects slot duration)',
              },
            },
            required: ['providerId', 'date'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              availability: { type: 'object' },
              availableSlots: { type: 'number' },
              _audit: { type: 'object' },
            },
          },
        },
        {
          name: 'create_referral',
          title: 'Create Referral',
          description: 'Create a referral to a specialist or service',
          inputSchema: {
            type: 'object',
            properties: {
              patientId: { type: 'string', description: 'Patient ID' },
              requesterId: { type: 'string', description: 'Requesting provider ID' },
              recipientId: { type: 'string', description: 'Specialist/receiving provider ID' },
              priority: {
                type: 'string',
                enum: ['routine', 'urgent', 'stat'],
                description: 'Referral priority',
                default: 'routine',
              },
              reason: { type: 'string', description: 'Reason for referral' },
              clinicalQuestion: { type: 'string', description: 'Clinical question to be addressed' },
              notes: { type: 'string', description: 'Additional clinical notes' },
            },
            required: ['patientId', 'requesterId', 'recipientId', 'reason'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              referral: { type: 'object' },
              referralId: { type: 'string' },
              _audit: { type: 'object' },
            },
          },
        },
        {
          name: 'get_care_plan',
          title: 'Get Care Plan',
          description: 'Retrieve the active care plan for a patient',
          inputSchema: {
            type: 'object',
            properties: {
              patientId: { type: 'string', description: 'Patient ID' },
              includeCompleted: { type: 'boolean', description: 'Include completed care plans', default: false },
            },
            required: ['patientId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              carePlan: { type: 'object' },
              _audit: { type: 'object' },
            },
          },
        },
        {
          name: 'update_care_plan',
          title: 'Update Care Plan',
          description: 'Update a care plan goal or activity status',
          inputSchema: {
            type: 'object',
            properties: {
              carePlanId: { type: 'string', description: 'Care Plan ID' },
              goalId: { type: 'string', description: 'Goal ID to update (if updating a goal)' },
              activityId: { type: 'string', description: 'Activity ID to update (if updating an activity)' },
              newStatus: { type: 'string', description: 'New status' },
              notes: { type: 'string', description: 'Update notes' },
            },
            required: ['carePlanId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              updated: { type: 'object' },
              _audit: { type: 'object' },
            },
          },
        },
        {
          name: 'send_clinical_message',
          title: 'Send Clinical Message',
          description: 'Send a secure clinical message to another provider or care team',
          inputSchema: {
            type: 'object',
            properties: {
              senderId: { type: 'string', description: 'Sender provider ID' },
              recipientIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Recipient provider IDs',
              },
              patientId: { type: 'string', description: 'Related patient ID (optional)' },
              category: {
                type: 'string',
                enum: ['notification', 'request', 'alert', 'instruction'],
                description: 'Message category',
                default: 'notification',
              },
              priority: {
                type: 'string',
                enum: ['routine', 'urgent', 'stat'],
                description: 'Message priority',
                default: 'routine',
              },
              subject: { type: 'string', description: 'Message subject' },
              message: { type: 'string', description: 'Message content' },
            },
            required: ['senderId', 'recipientIds', 'subject', 'message'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              messageId: { type: 'string' },
              sent: { type: 'string' },
              _audit: { type: 'object' },
            },
          },
        },
      ];

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_appointments':
            return await this.handleGetAppointments(args as any);
          case 'schedule_appointment':
            return await this.handleScheduleAppointment(args as any);
          case 'get_provider_availability':
            return await this.handleGetProviderAvailability(args as any);
          case 'create_referral':
            return await this.handleCreateReferral(args as any);
          case 'get_care_plan':
            return await this.handleGetCarePlan(args as any);
          case 'update_care_plan':
            return await this.handleUpdateCarePlan(args as any);
          case 'send_clinical_message':
            return await this.handleSendClinicalMessage(args as any);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text', text: `Error executing ${name}: ${errorMessage}` }],
          isError: true,
        };
      }
    });

    // List resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'schedule://providers',
            name: 'provider_directory',
            title: 'Provider Directory',
            description: 'List of healthcare providers and their specialties',
            mimeType: 'application/json',
            _meta: {
              dataClassification: 'public',
            },
          },
          {
            uri: 'workflow://referrals',
            name: 'pending_referrals',
            title: 'Pending Referrals',
            description: 'List of pending referrals requiring action',
            mimeType: 'application/json',
            _meta: {
              dataClassification: 'confidential',
            },
          },
        ],
      };
    });

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;

      if (uri === 'schedule://providers') {
        const providers = Array.from(MOCK_PROVIDERS.values());
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(providers, null, 2),
            _meta: {
              generatedAt: new Date().toISOString(),
              recordCount: providers.length,
            },
          }],
        };
      }

      if (uri === 'workflow://referrals') {
        const pendingReferrals = MOCK_REFERRALS.filter(r => r.status === 'active');
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(pendingReferrals, null, 2),
            _meta: {
              generatedAt: new Date().toISOString(),
              recordCount: pendingReferrals.length,
            },
          }],
        };
      }

      throw new Error(`Unknown resource: ${uri}`);
    });
  }

  // ===========================================================================
  // Tool Handlers
  // ===========================================================================

  private async handleGetAppointments(args: {
    patientId: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { patientId, status = 'booked' } = args;

    let appointments = MOCK_APPOINTMENTS.get(patientId) || [];

    if (status !== 'all') {
      appointments = appointments.filter(a => a.status === status);
    }

    const audit = createAuditMetadata(
      ['appointments', 'schedule', 'patientId'],
      {
        dataClassification: 'internal',
        purpose: 'schedule-review',
      }
    );

    const structured = {
      success: true,
      appointments: appointments.map(a => ({
        id: a.id,
        status: a.status,
        type: a.type.text,
        provider: a.provider.display,
        start: a.start,
        end: a.end,
        duration: a.duration,
        location: a.location?.display,
        reason: a.reason?.[0]?.text,
      })),
      count: appointments.length,
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    let textResponse = `Appointments for patient ${patientId} (${appointments.length}):\n\n`;

    if (appointments.length === 0) {
      textResponse += 'No appointments found.';
    } else {
      for (const apt of appointments) {
        const date = new Date(apt.start).toLocaleDateString();
        const time = new Date(apt.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        textResponse += `📅 ${date} at ${time}\n`;
        textResponse += `   ${apt.type.text} with ${apt.provider.display}\n`;
        textResponse += `   Location: ${apt.location?.display || 'TBD'}\n`;
        textResponse += `   Status: ${apt.status}\n\n`;
      }
    }

    return {
      content: [{ type: 'text', text: textResponse }],
      structuredContent: structured,
    };
  }

  private async handleScheduleAppointment(args: {
    patientId: string;
    providerId: string;
    startTime: string;
    duration?: number;
    appointmentType: string;
    reason?: string;
    notes?: string;
  }) {
    const { patientId, providerId, startTime, duration = 30, appointmentType, reason, notes } = args;

    const provider = MOCK_PROVIDERS.get(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    const appointmentId = `APT${Date.now()}`;
    const endTime = new Date(new Date(startTime).getTime() + duration * 60000).toISOString();

    const newAppointment: Appointment = {
      id: appointmentId,
      status: 'booked',
      type: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0276', code: appointmentType.toUpperCase(), display: appointmentType }],
        text: appointmentType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      },
      reason: reason ? [{ coding: [], text: reason }] : undefined,
      description: reason,
      start: startTime,
      end: endTime,
      duration,
      patient: { reference: `Patient/${patientId}`, display: `Patient ${patientId}` },
      provider: { reference: `Practitioner/${providerId}`, display: provider.name },
      notes,
    };

    // Add to mock data
    const existing = MOCK_APPOINTMENTS.get(patientId) || [];
    existing.push(newAppointment);
    MOCK_APPOINTMENTS.set(patientId, existing);

    const confirmationNumber = `CNF-${Date.now().toString(36).toUpperCase()}`;

    const audit = createAuditMetadata(
      ['appointment', 'schedule', 'patientId', 'providerId'],
      {
        dataClassification: 'internal',
        purpose: 'appointment-scheduling',
      }
    );

    const structured = {
      success: true,
      appointment: {
        id: appointmentId,
        status: 'booked',
        type: newAppointment.type.text,
        provider: provider.name,
        start: startTime,
        end: endTime,
        duration,
      },
      confirmationNumber,
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    const date = new Date(startTime).toLocaleDateString();
    const time = new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let textResponse = `✅ Appointment Scheduled\n\n`;
    textResponse += `Confirmation: ${confirmationNumber}\n`;
    textResponse += `Date: ${date} at ${time}\n`;
    textResponse += `Provider: ${provider.name}\n`;
    textResponse += `Type: ${newAppointment.type.text}\n`;
    textResponse += `Duration: ${duration} minutes\n`;
    if (reason) {
      textResponse += `Reason: ${reason}\n`;
    }

    return {
      content: [{ type: 'text', text: textResponse }],
      structuredContent: structured,
    };
  }

  private async handleGetProviderAvailability(args: {
    providerId: string;
    date: string;
    appointmentType?: string;
  }) {
    const { providerId, date } = args;

    const availability = generateAvailability(providerId, date);
    const availableSlots = availability.slots.filter(s => s.available);

    const audit = createAuditMetadata(
      ['providerAvailability', 'schedule'],
      {
        dataClassification: 'public',
        purpose: 'schedule-check',
      }
    );

    const structured = {
      success: true,
      availability: {
        providerId: availability.providerId,
        providerName: availability.providerName,
        date: availability.date,
        slots: availability.slots.map(s => ({
          start: s.start,
          end: s.end,
          available: s.available,
        })),
      },
      availableSlots: availableSlots.length,
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    let textResponse = `Provider Availability: ${availability.providerName}\n`;
    textResponse += `Date: ${date}\n\n`;
    textResponse += `Available Slots (${availableSlots.length}):\n`;

    for (const slot of availableSlots) {
      const time = new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      textResponse += `  ✓ ${time}\n`;
    }

    if (availableSlots.length === 0) {
      textResponse += '  No available slots for this date.\n';
    }

    return {
      content: [{ type: 'text', text: textResponse }],
      structuredContent: structured,
    };
  }

  private async handleCreateReferral(args: {
    patientId: string;
    requesterId: string;
    recipientId: string;
    priority?: string;
    reason: string;
    clinicalQuestion?: string;
    notes?: string;
  }) {
    const { patientId, requesterId, recipientId, priority = 'routine', reason, clinicalQuestion, notes } = args;

    const requester = MOCK_PROVIDERS.get(requesterId);
    const recipient = MOCK_PROVIDERS.get(recipientId);

    if (!requester) throw new Error(`Requesting provider not found: ${requesterId}`);
    if (!recipient) throw new Error(`Recipient provider not found: ${recipientId}`);

    const referralId = `REF${Date.now()}`;

    const newReferral: Referral = {
      id: referralId,
      status: 'active',
      intent: 'order',
      priority: priority as 'routine' | 'urgent' | 'stat',
      patient: { reference: `Patient/${patientId}`, display: `Patient ${patientId}` },
      requester: { reference: `Practitioner/${requesterId}`, display: requester.name },
      recipient: { reference: `Practitioner/${recipientId}`, display: recipient.name },
      reasonCode: [{ coding: [], text: reason }],
      description: clinicalQuestion || reason,
      authoredOn: new Date().toISOString().split('T')[0],
      notes,
    };

    MOCK_REFERRALS.push(newReferral);

    const audit = createAuditMetadata(
      ['referral', 'patientId', 'requesterId', 'recipientId'],
      {
        dataClassification: 'confidential',
        purpose: 'referral-creation',
        complianceContext: {
          hipaaCategory: 'treatment',
          minimumNecessary: true,
          breakGlass: false,
        },
      }
    );

    const structured = {
      success: true,
      referral: {
        id: referralId,
        status: 'active',
        priority,
        from: requester.name,
        to: recipient.name,
        specialty: recipient.specialty,
        reason,
      },
      referralId,
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    const priorityEmoji = priority === 'stat' ? '🔴' : priority === 'urgent' ? '🟡' : '🟢';

    let textResponse = `✅ Referral Created\n\n`;
    textResponse += `Referral ID: ${referralId}\n`;
    textResponse += `Priority: ${priorityEmoji} ${priority.toUpperCase()}\n\n`;
    textResponse += `From: ${requester.name} (${requester.specialty})\n`;
    textResponse += `To: ${recipient.name} (${recipient.specialty})\n\n`;
    textResponse += `Reason: ${reason}\n`;
    if (clinicalQuestion) {
      textResponse += `Clinical Question: ${clinicalQuestion}\n`;
    }

    return {
      content: [{ type: 'text', text: textResponse }],
      structuredContent: structured,
    };
  }

  private async handleGetCarePlan(args: { patientId: string; includeCompleted?: boolean }) {
    const { patientId } = args;

    const carePlan = MOCK_CARE_PLANS.get(patientId);

    if (!carePlan) {
      const audit = createAuditMetadata(['carePlan'], { dataClassification: 'restricted' });
      return {
        content: [{ type: 'text', text: `No active care plan found for patient ${patientId}` }],
        structuredContent: {
          success: true,
          carePlan: null,
          timestamp: new Date().toISOString(),
          _audit: audit,
        },
      };
    }

    const audit = createAuditMetadata(
      ['carePlan', 'goals', 'activities'],
      {
        dataClassification: 'restricted',
        purpose: 'care-plan-review',
        complianceContext: {
          hipaaCategory: 'treatment',
          minimumNecessary: true,
          breakGlass: false,
        },
      }
    );

    const structured = {
      success: true,
      carePlan: {
        id: carePlan.id,
        title: carePlan.title,
        status: carePlan.status,
        period: carePlan.period,
        author: carePlan.author?.display,
        goals: carePlan.goals?.map(g => ({
          id: g.id,
          description: g.description,
          status: g.status,
          priority: g.priority,
          target: g.target?.detailQuantity ? `${g.target.detailQuantity.value} ${g.target.detailQuantity.unit}` : undefined,
          dueDate: g.target?.dueDate,
        })),
        activities: carePlan.activities?.map(a => ({
          id: a.id,
          description: a.description,
          status: a.status,
          kind: a.kind,
        })),
      },
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    let textResponse = `Care Plan: ${carePlan.title}\n`;
    textResponse += `Status: ${carePlan.status} | Period: ${carePlan.period?.start} to ${carePlan.period?.end}\n`;
    textResponse += `Author: ${carePlan.author?.display}\n\n`;

    textResponse += `Goals (${carePlan.goals?.length || 0}):\n`;
    for (const goal of carePlan.goals || []) {
      const statusEmoji = goal.status === 'completed' ? '✅' : goal.status === 'active' ? '🔄' : '⏳';
      const priority = goal.priority === 'high' ? '🔴' : goal.priority === 'medium' ? '🟡' : '🟢';
      textResponse += `  ${statusEmoji} ${priority} ${goal.description}\n`;
      if (goal.target?.dueDate) {
        textResponse += `     Due: ${goal.target.dueDate}\n`;
      }
    }

    textResponse += `\nActivities (${carePlan.activities?.length || 0}):\n`;
    for (const activity of carePlan.activities || []) {
      const statusEmoji = activity.status === 'completed' ? '✅' : activity.status === 'in-progress' ? '🔄' : '⏳';
      textResponse += `  ${statusEmoji} ${activity.description}\n`;
    }

    return {
      content: [{ type: 'text', text: textResponse }],
      structuredContent: structured,
    };
  }

  private async handleUpdateCarePlan(args: {
    carePlanId: string;
    goalId?: string;
    activityId?: string;
    newStatus?: string;
    notes?: string;
  }) {
    const { carePlanId, goalId, activityId, newStatus, notes } = args;

    // Find the care plan
    let carePlan: CarePlan | undefined;
    for (const [, cp] of MOCK_CARE_PLANS) {
      if (cp.id === carePlanId) {
        carePlan = cp;
        break;
      }
    }

    if (!carePlan) {
      throw new Error(`Care plan not found: ${carePlanId}`);
    }

    let updated: any = null;

    if (goalId && newStatus) {
      const goal = carePlan.goals?.find(g => g.id === goalId);
      if (goal) {
        goal.status = newStatus as any;
        updated = { type: 'goal', id: goalId, newStatus };
      }
    }

    if (activityId && newStatus) {
      const activity = carePlan.activities?.find(a => a.id === activityId);
      if (activity) {
        activity.status = newStatus as any;
        if (notes) {
          activity.notes = notes;
        }
        updated = { type: 'activity', id: activityId, newStatus };
      }
    }

    const audit = createAuditMetadata(
      ['carePlan', 'update', goalId || activityId || 'unknown'],
      {
        dataClassification: 'restricted',
        purpose: 'care-plan-update',
        complianceContext: {
          hipaaCategory: 'treatment',
          minimumNecessary: true,
          breakGlass: false,
        },
      }
    );

    const structured = {
      success: true,
      updated,
      carePlanId,
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    let textResponse = updated
      ? `✅ Care Plan Updated\n\n${updated.type} ${updated.id} status changed to: ${updated.newStatus}`
      : `No updates made to care plan ${carePlanId}`;

    return {
      content: [{ type: 'text', text: textResponse }],
      structuredContent: structured,
    };
  }

  private async handleSendClinicalMessage(args: {
    senderId: string;
    recipientIds: string[];
    patientId?: string;
    category?: string;
    priority?: string;
    subject: string;
    message: string;
  }) {
    const { senderId, recipientIds, patientId, category = 'notification', priority = 'routine', subject, message } = args;

    const sender = MOCK_PROVIDERS.get(senderId);
    if (!sender) throw new Error(`Sender not found: ${senderId}`);

    const recipients = recipientIds.map(id => {
      const provider = MOCK_PROVIDERS.get(id);
      if (!provider) throw new Error(`Recipient not found: ${id}`);
      return { reference: `Practitioner/${id}`, display: provider.name };
    });

    const messageId = `MSG${Date.now()}`;
    const sent = new Date().toISOString();

    const newMessage: ClinicalMessage = {
      id: messageId,
      status: 'completed',
      category: category as any,
      priority: priority as any,
      sender: { reference: `Practitioner/${senderId}`, display: sender.name },
      recipient: recipients,
      subject: patientId ? { reference: `Patient/${patientId}` } : undefined,
      sent,
      payload: [
        { contentType: 'text', content: message, title: subject },
      ],
    };

    MOCK_MESSAGES.push(newMessage);

    const audit = createAuditMetadata(
      ['clinicalMessage', 'senderId', 'recipientIds'],
      {
        dataClassification: 'confidential',
        purpose: 'clinical-communication',
        complianceContext: {
          hipaaCategory: 'treatment',
          minimumNecessary: true,
          breakGlass: false,
        },
      }
    );

    const structured = {
      success: true,
      messageId,
      sent,
      from: sender.name,
      to: recipients.map(r => r.display),
      subject,
      priority,
      category,
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    const priorityEmoji = priority === 'stat' ? '🔴' : priority === 'urgent' ? '🟡' : '🟢';

    let textResponse = `✅ Clinical Message Sent\n\n`;
    textResponse += `Message ID: ${messageId}\n`;
    textResponse += `Priority: ${priorityEmoji} ${priority.toUpperCase()}\n\n`;
    textResponse += `From: ${sender.name}\n`;
    textResponse += `To: ${recipients.map(r => r.display).join(', ')}\n\n`;
    textResponse += `Subject: ${subject}\n`;
    textResponse += `---\n${message}`;

    return {
      content: [{ type: 'text', text: textResponse }],
      structuredContent: structured,
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('Clinical Workflow MCP Server started');
    console.error('Tools: get_appointments, schedule_appointment, get_provider_availability, create_referral, get_care_plan, update_care_plan, send_clinical_message');
  }
}

// Start the server
const server = new ClinicalWorkflowMCPServer();
server.start().catch((error) => {
  console.error('Failed to start Clinical Workflow MCP Server:', error);
  process.exit(1);
});
