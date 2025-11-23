#!/usr/bin/env node

/**
 * Patient Records MCP Server
 *
 * A HIPAA-compliant MCP server for patient health records access.
 * Demonstrates MCP enhancements including:
 * - Policy-aware tool execution
 * - Structured audit responses
 * - Consent-aware data access
 * - Break-glass emergency access
 * - Data minimization patterns
 *
 * IMPORTANT: This is a demonstration server with mock data.
 * Real implementations would integrate with EHR systems like Epic, Cerner, etc.
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
  Patient,
  Condition,
  Allergy,
  Medication,
  VitalSign,
  CareTeam,
  AuditMetadata,
  ConsentMetadata,
  DataMinimizationMetadata,
  ToolPolicies,
  createAuditMetadata,
  detectPIIFields,
  generateEventId,
} from './types/healthcare.js';

// =============================================================================
// Mock Data Store
// =============================================================================

const MOCK_PATIENTS: Map<string, Patient> = new Map([
  ['P12345', {
    id: 'P12345',
    mrn: 'MRN-001234',
    name: { given: ['John', 'Robert'], family: 'Doe', display: 'John R. Doe' },
    dob: '1985-03-15',
    gender: 'male',
    address: {
      line: ['123 Main Street', 'Apt 4B'],
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
    },
    phone: '555-123-4567',
    email: 'john.doe@email.com',
    ssn: '123-45-6789',
    insurance: {
      provider: 'Blue Cross Blue Shield',
      memberId: 'BCBS-123456',
      groupId: 'GRP-789',
      planType: 'PPO',
    },
    emergencyContact: {
      name: 'Jane Doe',
      relationship: 'Spouse',
      phone: '555-987-6543',
    },
    primaryCareProvider: { reference: 'Practitioner/DR001', display: 'Dr. Sarah Smith' },
    active: true,
  }],
  ['P67890', {
    id: 'P67890',
    mrn: 'MRN-005678',
    name: { given: ['Mary', 'Elizabeth'], family: 'Johnson', display: 'Mary E. Johnson' },
    dob: '1972-08-22',
    gender: 'female',
    address: {
      line: ['456 Oak Avenue'],
      city: 'Springfield',
      state: 'IL',
      postalCode: '62702',
    },
    phone: '555-234-5678',
    email: 'mary.johnson@email.com',
    ssn: '987-65-4321',
    insurance: {
      provider: 'Aetna',
      memberId: 'AET-789012',
      planType: 'HMO',
    },
    primaryCareProvider: { reference: 'Practitioner/DR002', display: 'Dr. Michael Chen' },
    active: true,
  }],
]);

const MOCK_CONDITIONS: Map<string, Condition[]> = new Map([
  ['P12345', [
    {
      id: 'C001',
      code: {
        coding: [{ system: 'http://snomed.info/sct', code: '44054006', display: 'Type 2 Diabetes Mellitus' }],
        text: 'Type 2 Diabetes',
      },
      clinicalStatus: 'active',
      verificationStatus: 'confirmed',
      severity: 'moderate',
      onsetDate: '2018-06-15',
      recordedDate: '2018-06-15',
    },
    {
      id: 'C002',
      code: {
        coding: [{ system: 'http://snomed.info/sct', code: '38341003', display: 'Essential Hypertension' }],
        text: 'Hypertension',
      },
      clinicalStatus: 'active',
      verificationStatus: 'confirmed',
      severity: 'mild',
      onsetDate: '2020-01-10',
      recordedDate: '2020-01-10',
    },
  ]],
  ['P67890', [
    {
      id: 'C003',
      code: {
        coding: [{ system: 'http://snomed.info/sct', code: '195967001', display: 'Asthma' }],
        text: 'Asthma',
      },
      clinicalStatus: 'active',
      verificationStatus: 'confirmed',
      severity: 'mild',
      onsetDate: '2015-03-20',
      recordedDate: '2015-03-20',
    },
  ]],
]);

const MOCK_ALLERGIES: Map<string, Allergy[]> = new Map([
  ['P12345', [
    {
      id: 'A001',
      substance: {
        coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '7984', display: 'Penicillin' }],
        text: 'Penicillin',
      },
      clinicalStatus: 'active',
      verificationStatus: 'confirmed',
      type: 'allergy',
      category: 'medication',
      criticality: 'high',
      reactions: [{
        manifestation: [{ coding: [{ system: 'http://snomed.info/sct', code: '39579001', display: 'Anaphylaxis' }], text: 'Anaphylaxis' }],
        severity: 'severe',
      }],
      recordedDate: '2010-05-01',
    },
    {
      id: 'A002',
      substance: {
        coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '88249', display: 'Sulfonamides' }],
        text: 'Sulfa Drugs',
      },
      clinicalStatus: 'active',
      verificationStatus: 'confirmed',
      type: 'allergy',
      category: 'medication',
      criticality: 'high',
      reactions: [{
        manifestation: [{ coding: [{ system: 'http://snomed.info/sct', code: '271807003', display: 'Skin Rash' }], text: 'Rash' }],
        severity: 'moderate',
      }],
      recordedDate: '2012-08-15',
    },
  ]],
  ['P67890', [
    {
      id: 'A003',
      substance: {
        coding: [{ system: 'http://snomed.info/sct', code: '256349002', display: 'Peanut' }],
        text: 'Peanuts',
      },
      clinicalStatus: 'active',
      verificationStatus: 'confirmed',
      type: 'allergy',
      category: 'food',
      criticality: 'high',
      reactions: [{
        manifestation: [{ coding: [{ system: 'http://snomed.info/sct', code: '39579001', display: 'Anaphylaxis' }], text: 'Anaphylaxis' }],
        severity: 'severe',
      }],
      recordedDate: '2008-02-10',
    },
  ]],
]);

const MOCK_MEDICATIONS: Map<string, Medication[]> = new Map([
  ['P12345', [
    {
      id: 'M001',
      code: {
        coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '860975', display: 'Metformin 500mg' }],
        text: 'Metformin 500mg',
      },
      status: 'active',
      dosage: {
        text: '500mg twice daily with meals',
        timing: { frequency: 2, period: 1, periodUnit: 'd' },
        doseQuantity: { value: 500, unit: 'mg' },
      },
      prescriber: { reference: 'Practitioner/DR001', display: 'Dr. Sarah Smith' },
      reasonCode: [{ coding: [{ system: 'http://snomed.info/sct', code: '44054006', display: 'Type 2 Diabetes' }], text: 'Type 2 Diabetes' }],
    },
    {
      id: 'M002',
      code: {
        coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '314076', display: 'Lisinopril 10mg' }],
        text: 'Lisinopril 10mg',
      },
      status: 'active',
      dosage: {
        text: '10mg once daily',
        timing: { frequency: 1, period: 1, periodUnit: 'd' },
        doseQuantity: { value: 10, unit: 'mg' },
      },
      prescriber: { reference: 'Practitioner/DR001', display: 'Dr. Sarah Smith' },
      reasonCode: [{ coding: [{ system: 'http://snomed.info/sct', code: '38341003', display: 'Hypertension' }], text: 'Hypertension' }],
    },
    {
      id: 'M003',
      code: {
        coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '617312', display: 'Aspirin 81mg' }],
        text: 'Aspirin 81mg',
      },
      status: 'active',
      dosage: {
        text: '81mg once daily',
        timing: { frequency: 1, period: 1, periodUnit: 'd' },
        doseQuantity: { value: 81, unit: 'mg' },
      },
      prescriber: { reference: 'Practitioner/DR001', display: 'Dr. Sarah Smith' },
      notes: 'Low-dose aspirin for cardiovascular protection',
    },
  ]],
  ['P67890', [
    {
      id: 'M004',
      code: {
        coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '745679', display: 'Albuterol Inhaler' }],
        text: 'Albuterol HFA Inhaler',
      },
      status: 'active',
      dosage: {
        text: '2 puffs as needed for shortness of breath',
        route: { coding: [{ system: 'http://snomed.info/sct', code: '447694001', display: 'Inhalation' }], text: 'Inhalation' },
      },
      prescriber: { reference: 'Practitioner/DR002', display: 'Dr. Michael Chen' },
      reasonCode: [{ coding: [{ system: 'http://snomed.info/sct', code: '195967001', display: 'Asthma' }], text: 'Asthma' }],
    },
  ]],
]);

const MOCK_VITALS: Map<string, VitalSign[]> = new Map([
  ['P12345', [
    { id: 'V001', type: 'blood-pressure-systolic', value: 128, unit: 'mmHg', effectiveDateTime: '2025-11-20T10:30:00Z', interpretation: 'normal' },
    { id: 'V002', type: 'blood-pressure-diastolic', value: 82, unit: 'mmHg', effectiveDateTime: '2025-11-20T10:30:00Z', interpretation: 'normal' },
    { id: 'V003', type: 'heart-rate', value: 72, unit: 'bpm', effectiveDateTime: '2025-11-20T10:30:00Z', interpretation: 'normal' },
    { id: 'V004', type: 'temperature', value: 98.6, unit: 'F', effectiveDateTime: '2025-11-20T10:30:00Z', interpretation: 'normal' },
    { id: 'V005', type: 'weight', value: 185, unit: 'lbs', effectiveDateTime: '2025-11-20T10:30:00Z' },
    { id: 'V006', type: 'height', value: 70, unit: 'in', effectiveDateTime: '2025-11-20T10:30:00Z' },
  ]],
]);

const MOCK_CARE_TEAMS: Map<string, CareTeam> = new Map([
  ['P12345', {
    id: 'CT001',
    name: 'Diabetes Care Team',
    status: 'active',
    subject: { reference: 'Patient/P12345', display: 'John R. Doe' },
    members: [
      { id: 'CTM001', role: 'Primary Care Physician', name: 'Dr. Sarah Smith', specialty: 'Internal Medicine', phone: '555-100-0001', email: 'sarah.smith@hospital.org' },
      { id: 'CTM002', role: 'Endocrinologist', name: 'Dr. Robert Lee', specialty: 'Endocrinology', phone: '555-100-0002', email: 'robert.lee@hospital.org' },
      { id: 'CTM003', role: 'Diabetes Educator', name: 'Nancy Wilson, RN', specialty: 'Diabetes Education', phone: '555-100-0003' },
      { id: 'CTM004', role: 'Nutritionist', name: 'Jennifer Brown, RD', specialty: 'Clinical Nutrition', phone: '555-100-0004' },
    ],
  }],
]);

const MOCK_CONSENT: Map<string, ConsentMetadata> = new Map([
  ['P12345', {
    status: 'granted',
    purposes: ['treatment', 'care-coordination', 'billing'],
    restrictions: ['no-marketing', 'no-research'],
    grantedAt: '2025-01-15T00:00:00Z',
    expiresAt: '2026-01-15T00:00:00Z',
    consentDocumentUri: 'consent://P12345/2025-consent-v1',
  }],
  ['P67890', {
    status: 'granted',
    purposes: ['treatment'],
    restrictions: ['no-marketing', 'no-research', 'no-third-party'],
    grantedAt: '2024-06-01T00:00:00Z',
    expiresAt: '2025-06-01T00:00:00Z',
  }],
]);

// =============================================================================
// Tool Policies
// =============================================================================

const TOOL_POLICIES: Record<string, ToolPolicies> = {
  get_patient: {
    dataClassification: 'restricted',
    piiHandling: 'restricted',
    requiredRoles: ['doctor', 'nurse', 'admin'],
    requiredScopes: ['patient:read', 'phi:access'],
    auditLevel: 'full',
    complianceFrameworks: ['HIPAA', 'HITECH'],
    retentionPeriod: '7years',
  },
  search_patients: {
    dataClassification: 'confidential',
    piiHandling: 'restricted',
    requiredRoles: ['doctor', 'nurse', 'admin', 'registrar'],
    requiredScopes: ['patient:search'],
    auditLevel: 'detailed',
    complianceFrameworks: ['HIPAA'],
  },
  get_patient_conditions: {
    dataClassification: 'restricted',
    piiHandling: 'restricted',
    requiredRoles: ['doctor', 'nurse'],
    requiredScopes: ['patient:read', 'clinical:read'],
    auditLevel: 'full',
    complianceFrameworks: ['HIPAA'],
  },
  get_patient_allergies: {
    dataClassification: 'restricted',
    piiHandling: 'restricted',
    requiredRoles: ['doctor', 'nurse', 'pharmacist'],
    requiredScopes: ['patient:read', 'clinical:read'],
    auditLevel: 'full',
    complianceFrameworks: ['HIPAA'],
  },
  get_patient_medications: {
    dataClassification: 'restricted',
    piiHandling: 'restricted',
    requiredRoles: ['doctor', 'nurse', 'pharmacist'],
    requiredScopes: ['patient:read', 'medication:read'],
    auditLevel: 'full',
    complianceFrameworks: ['HIPAA'],
  },
  get_patient_vitals: {
    dataClassification: 'confidential',
    piiHandling: 'restricted',
    requiredRoles: ['doctor', 'nurse', 'ma'],
    requiredScopes: ['patient:read', 'vitals:read'],
    auditLevel: 'detailed',
    complianceFrameworks: ['HIPAA'],
  },
  get_care_team: {
    dataClassification: 'internal',
    piiHandling: 'allowed',
    requiredRoles: ['doctor', 'nurse', 'admin', 'care-coordinator'],
    requiredScopes: ['patient:read', 'careteam:read'],
    auditLevel: 'basic',
    complianceFrameworks: ['HIPAA'],
  },
};

// =============================================================================
// Patient Records MCP Server
// =============================================================================

class PatientRecordsMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'patient-records-mcp-server',
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
          name: 'get_patient',
          title: 'Get Patient Record',
          description: 'Retrieve patient demographics and health record. Requires patient:read and phi:access scopes. Supports break-glass for emergencies and data minimization through requestedFields parameter.',
          inputSchema: {
            type: 'object',
            properties: {
              patientId: { type: 'string', description: 'Patient ID (e.g., P12345)' },
              purpose: {
                type: 'string',
                enum: ['treatment', 'care-coordination', 'billing', 'emergency'],
                description: 'Purpose of access (required for HIPAA compliance)',
              },
              requestedFields: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific fields to return (for data minimization). If omitted, returns full record.',
              },
              breakGlass: {
                type: 'boolean',
                description: 'Emergency access override - bypasses normal consent checks but requires justification',
              },
              breakGlassReason: {
                type: 'string',
                description: 'Required when breakGlass is true - reason for emergency access',
              },
            },
            required: ['patientId', 'purpose'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              patient: { type: 'object' },
              _audit: { type: 'object', description: 'Audit trail metadata' },
              _consent: { type: 'object', description: 'Consent status' },
              _dataMinimization: { type: 'object', description: 'Data minimization applied' },
            },
            required: ['success', '_audit'],
          },
        },
        {
          name: 'search_patients',
          title: 'Search Patients',
          description: 'Search for patients by name, MRN, or date of birth. Returns limited demographics for patient identification.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Patient name (partial match)' },
              mrn: { type: 'string', description: 'Medical Record Number (exact match)' },
              dob: { type: 'string', description: 'Date of birth (YYYY-MM-DD)' },
              limit: { type: 'number', description: 'Maximum results to return', default: 10 },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              patients: { type: 'array', items: { type: 'object' } },
              count: { type: 'number' },
              _audit: { type: 'object' },
            },
          },
        },
        {
          name: 'get_patient_conditions',
          title: 'Get Patient Conditions',
          description: 'Retrieve patient diagnoses and medical conditions',
          inputSchema: {
            type: 'object',
            properties: {
              patientId: { type: 'string', description: 'Patient ID' },
              status: {
                type: 'string',
                enum: ['active', 'inactive', 'resolved', 'all'],
                description: 'Filter by condition status',
                default: 'active',
              },
              purpose: { type: 'string', enum: ['treatment', 'care-coordination', 'billing'], default: 'treatment' },
            },
            required: ['patientId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              conditions: { type: 'array' },
              count: { type: 'number' },
              _audit: { type: 'object' },
            },
          },
        },
        {
          name: 'get_patient_allergies',
          title: 'Get Patient Allergies',
          description: 'Retrieve patient allergy information - CRITICAL for medication safety',
          inputSchema: {
            type: 'object',
            properties: {
              patientId: { type: 'string', description: 'Patient ID' },
              criticality: {
                type: 'string',
                enum: ['high', 'low', 'all'],
                description: 'Filter by allergy criticality',
                default: 'all',
              },
            },
            required: ['patientId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              allergies: { type: 'array' },
              count: { type: 'number' },
              hasHighCriticality: { type: 'boolean' },
              _audit: { type: 'object' },
            },
          },
        },
        {
          name: 'get_patient_medications',
          title: 'Get Patient Medications',
          description: 'Retrieve current and historical medications for a patient',
          inputSchema: {
            type: 'object',
            properties: {
              patientId: { type: 'string', description: 'Patient ID' },
              status: {
                type: 'string',
                enum: ['active', 'completed', 'stopped', 'all'],
                description: 'Filter by medication status',
                default: 'active',
              },
            },
            required: ['patientId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              medications: { type: 'array' },
              count: { type: 'number' },
              _audit: { type: 'object' },
            },
          },
        },
        {
          name: 'get_patient_vitals',
          title: 'Get Patient Vital Signs',
          description: 'Retrieve patient vital signs history',
          inputSchema: {
            type: 'object',
            properties: {
              patientId: { type: 'string', description: 'Patient ID' },
              type: {
                type: 'string',
                enum: ['blood-pressure', 'heart-rate', 'temperature', 'weight', 'all'],
                description: 'Filter by vital sign type',
                default: 'all',
              },
              limit: { type: 'number', description: 'Maximum records to return', default: 10 },
            },
            required: ['patientId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              vitals: { type: 'array' },
              count: { type: 'number' },
              _audit: { type: 'object' },
            },
          },
        },
        {
          name: 'get_care_team',
          title: 'Get Care Team',
          description: 'Retrieve the care team members for a patient',
          inputSchema: {
            type: 'object',
            properties: {
              patientId: { type: 'string', description: 'Patient ID' },
            },
            required: ['patientId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              careTeam: { type: 'object' },
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
          case 'get_patient':
            return await this.handleGetPatient(args as any);
          case 'search_patients':
            return await this.handleSearchPatients(args as any);
          case 'get_patient_conditions':
            return await this.handleGetPatientConditions(args as any);
          case 'get_patient_allergies':
            return await this.handleGetPatientAllergies(args as any);
          case 'get_patient_medications':
            return await this.handleGetPatientMedications(args as any);
          case 'get_patient_vitals':
            return await this.handleGetPatientVitals(args as any);
          case 'get_care_team':
            return await this.handleGetCareTeam(args as any);
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
      const resources = [];

      for (const [id, patient] of MOCK_PATIENTS) {
        resources.push({
          uri: `patient://${id}`,
          name: `patient_${id}`,
          title: `Patient: ${patient.name.display}`,
          description: `Patient record for ${patient.name.display}`,
          mimeType: 'application/json',
          _meta: {
            dataClassification: 'restricted',
            requiresConsent: true,
            hipaaCategory: 'treatment',
          },
        });
      }

      return { resources };
    });

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      const match = uri.match(/^patient:\/\/([^/]+)$/);

      if (match) {
        const patientId = match[1];
        const patient = MOCK_PATIENTS.get(patientId);

        if (!patient) {
          throw new Error(`Patient not found: ${patientId}`);
        }

        const audit = createAuditMetadata(
          ['id', 'name', 'dob', 'gender'],
          {
            dataClassification: 'restricted',
            purpose: 'resource-read',
            complianceContext: {
              hipaaCategory: 'treatment',
              minimumNecessary: true,
              breakGlass: false,
            },
          }
        );

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({ patient, _audit: audit }, null, 2),
              _meta: {
                patientId,
                generatedAt: new Date().toISOString(),
                dataClassification: 'restricted',
              },
            },
          ],
        };
      }

      throw new Error(`Unknown resource: ${uri}`);
    });
  }

  // ===========================================================================
  // Tool Handlers
  // ===========================================================================

  private async handleGetPatient(args: {
    patientId: string;
    purpose: string;
    requestedFields?: string[];
    breakGlass?: boolean;
    breakGlassReason?: string;
  }) {
    const { patientId, purpose, requestedFields, breakGlass, breakGlassReason } = args;

    // Validate break-glass requirements
    if (breakGlass && !breakGlassReason) {
      throw new Error('breakGlassReason is required when breakGlass is true');
    }

    const patient = MOCK_PATIENTS.get(patientId);
    if (!patient) {
      throw new Error(`Patient not found: ${patientId}`);
    }

    // Get consent status
    const consent = MOCK_CONSENT.get(patientId) || {
      status: 'pending' as const,
      purposes: [],
    };

    // Check consent (unless break-glass)
    if (!breakGlass && !consent.purposes.includes(purpose) && consent.status === 'granted') {
      throw new Error(`Access denied: consent not granted for purpose '${purpose}'`);
    }

    // Determine which fields to return
    const allFields = Object.keys(patient);
    const fieldsToReturn = requestedFields || allFields;
    const redactedFields = allFields.filter(f => !fieldsToReturn.includes(f));

    // Build patient data with only requested fields
    let patientData: Partial<Patient> = {};
    if (requestedFields) {
      for (const field of requestedFields) {
        if (field in patient) {
          (patientData as any)[field] = (patient as any)[field];
        }
      }
    } else {
      patientData = patient;
    }

    // Create audit metadata
    const audit = createAuditMetadata(fieldsToReturn, {
      dataClassification: 'restricted',
      purpose,
      complianceContext: {
        hipaaCategory: purpose === 'emergency' ? 'emergency' : 'treatment',
        minimumNecessary: !!requestedFields,
        breakGlass: breakGlass || false,
        consentVerified: consent.status === 'granted',
      },
      breakGlass,
      breakGlassReason,
      breakGlassApprovedBy: breakGlass ? 'system-auto-emergency' : undefined,
      requiresReview: breakGlass,
      reviewDeadline: breakGlass
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : undefined,
    });

    // Build data minimization metadata
    const dataMinimization: DataMinimizationMetadata | undefined = requestedFields
      ? {
          requestedFields,
          returnedFields: fieldsToReturn.filter(f => f in patient),
          redactedFields,
          minimizationApplied: true,
          purpose,
        }
      : undefined;

    const structured = {
      success: true,
      patient: patientData,
      timestamp: new Date().toISOString(),
      _audit: audit,
      _consent: consent,
      _dataMinimization: dataMinimization,
    };

    // Format text response
    let textResponse = `Patient: ${patient.name.display} (ID: ${patient.id})\n`;
    textResponse += `DOB: ${patient.dob} | Gender: ${patient.gender}\n`;
    if (patient.primaryCareProvider) {
      textResponse += `PCP: ${patient.primaryCareProvider.display}\n`;
    }
    if (breakGlass) {
      textResponse += `\n[BREAK-GLASS ACCESS - Review required within 24 hours]\n`;
    }
    if (dataMinimization) {
      textResponse += `\n[Data minimization applied: ${dataMinimization.returnedFields.length} fields returned, ${dataMinimization.redactedFields.length} fields redacted]`;
    }

    return {
      content: [{ type: 'text', text: textResponse }],
      structuredContent: structured,
    };
  }

  private async handleSearchPatients(args: {
    name?: string;
    mrn?: string;
    dob?: string;
    limit?: number;
  }) {
    const { name, mrn, dob, limit = 10 } = args;

    let results: Array<{ id: string; name: string; dob: string; mrn?: string }> = [];

    for (const [id, patient] of MOCK_PATIENTS) {
      let matches = true;

      if (name && !patient.name.display?.toLowerCase().includes(name.toLowerCase())) {
        matches = false;
      }
      if (mrn && patient.mrn !== mrn) {
        matches = false;
      }
      if (dob && patient.dob !== dob) {
        matches = false;
      }

      if (matches) {
        results.push({
          id: patient.id,
          name: patient.name.display || `${patient.name.given.join(' ')} ${patient.name.family}`,
          dob: patient.dob,
          mrn: patient.mrn,
        });
      }

      if (results.length >= limit) break;
    }

    const audit = createAuditMetadata(
      ['id', 'name', 'dob', 'mrn'],
      {
        dataClassification: 'confidential',
        purpose: 'patient-search',
      }
    );

    const structured = {
      success: true,
      patients: results,
      count: results.length,
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    return {
      content: [{
        type: 'text',
        text: `Found ${results.length} patients:\n${results.map(p => `- ${p.name} (${p.id}) DOB: ${p.dob}`).join('\n')}`,
      }],
      structuredContent: structured,
    };
  }

  private async handleGetPatientConditions(args: {
    patientId: string;
    status?: string;
    purpose?: string;
  }) {
    const { patientId, status = 'active', purpose = 'treatment' } = args;

    const conditions = MOCK_CONDITIONS.get(patientId) || [];
    let filtered = conditions;

    if (status !== 'all') {
      filtered = conditions.filter(c => c.clinicalStatus === status);
    }

    const audit = createAuditMetadata(
      ['conditions', 'diagnosis', 'clinicalStatus'],
      {
        dataClassification: 'restricted',
        purpose,
        complianceContext: {
          hipaaCategory: 'treatment',
          minimumNecessary: true,
          breakGlass: false,
        },
      }
    );

    const structured = {
      success: true,
      conditions: filtered.map(c => ({
        id: c.id,
        name: c.code.text,
        status: c.clinicalStatus,
        severity: c.severity,
        onsetDate: c.onsetDate,
      })),
      count: filtered.length,
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    return {
      content: [{
        type: 'text',
        text: `Patient ${patientId} conditions (${filtered.length}):\n${filtered.map(c => `- ${c.code.text} [${c.clinicalStatus}] ${c.severity ? `(${c.severity})` : ''}`).join('\n')}`,
      }],
      structuredContent: structured,
    };
  }

  private async handleGetPatientAllergies(args: {
    patientId: string;
    criticality?: string;
  }) {
    const { patientId, criticality = 'all' } = args;

    const allergies = MOCK_ALLERGIES.get(patientId) || [];
    let filtered = allergies;

    if (criticality !== 'all') {
      filtered = allergies.filter(a => a.criticality === criticality);
    }

    const hasHighCriticality = allergies.some(a => a.criticality === 'high');

    const audit = createAuditMetadata(
      ['allergies', 'substance', 'reactions', 'criticality'],
      {
        dataClassification: 'restricted',
        purpose: 'medication-safety',
        complianceContext: {
          hipaaCategory: 'treatment',
          minimumNecessary: true,
          breakGlass: false,
        },
      }
    );

    const structured = {
      success: true,
      allergies: filtered.map(a => ({
        id: a.id,
        substance: a.substance.text,
        category: a.category,
        criticality: a.criticality,
        reactions: a.reactions?.map(r => r.manifestation[0]?.text).join(', '),
      })),
      count: filtered.length,
      hasHighCriticality,
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    const warningPrefix = hasHighCriticality ? 'HIGH ALERT - ' : '';
    return {
      content: [{
        type: 'text',
        text: `${warningPrefix}Patient ${patientId} allergies (${filtered.length}):\n${filtered.map(a => `- ${a.substance.text} [${a.criticality} criticality] - ${a.reactions?.[0]?.manifestation[0]?.text || 'Unknown reaction'}`).join('\n')}`,
      }],
      structuredContent: structured,
    };
  }

  private async handleGetPatientMedications(args: {
    patientId: string;
    status?: string;
  }) {
    const { patientId, status = 'active' } = args;

    const medications = MOCK_MEDICATIONS.get(patientId) || [];
    let filtered = medications;

    if (status !== 'all') {
      filtered = medications.filter(m => m.status === status);
    }

    const audit = createAuditMetadata(
      ['medications', 'dosage', 'prescriber'],
      {
        dataClassification: 'restricted',
        purpose: 'medication-management',
        complianceContext: {
          hipaaCategory: 'treatment',
          minimumNecessary: true,
          breakGlass: false,
        },
      }
    );

    const structured = {
      success: true,
      medications: filtered.map(m => ({
        id: m.id,
        name: m.code.text,
        dosage: m.dosage.text,
        status: m.status,
        prescriber: m.prescriber?.display,
        reason: m.reasonCode?.[0]?.text,
      })),
      count: filtered.length,
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    return {
      content: [{
        type: 'text',
        text: `Patient ${patientId} medications (${filtered.length}):\n${filtered.map(m => `- ${m.code.text}: ${m.dosage.text}`).join('\n')}`,
      }],
      structuredContent: structured,
    };
  }

  private async handleGetPatientVitals(args: {
    patientId: string;
    type?: string;
    limit?: number;
  }) {
    const { patientId, type = 'all', limit = 10 } = args;

    const vitals = MOCK_VITALS.get(patientId) || [];
    let filtered = vitals;

    if (type !== 'all') {
      if (type === 'blood-pressure') {
        filtered = vitals.filter(v =>
          v.type === 'blood-pressure-systolic' || v.type === 'blood-pressure-diastolic'
        );
      } else {
        filtered = vitals.filter(v => v.type === type);
      }
    }

    filtered = filtered.slice(0, limit);

    const audit = createAuditMetadata(
      ['vitals', 'blood-pressure', 'heart-rate', 'temperature'],
      {
        dataClassification: 'confidential',
        purpose: 'clinical-monitoring',
      }
    );

    const structured = {
      success: true,
      vitals: filtered.map(v => ({
        id: v.id,
        type: v.type,
        value: v.value,
        unit: v.unit,
        dateTime: v.effectiveDateTime,
        interpretation: v.interpretation,
      })),
      count: filtered.length,
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    return {
      content: [{
        type: 'text',
        text: `Patient ${patientId} vitals (${filtered.length}):\n${filtered.map(v => `- ${v.type}: ${v.value} ${v.unit} ${v.interpretation ? `[${v.interpretation}]` : ''}`).join('\n')}`,
      }],
      structuredContent: structured,
    };
  }

  private async handleGetCareTeam(args: { patientId: string }) {
    const { patientId } = args;

    const careTeam = MOCK_CARE_TEAMS.get(patientId);

    if (!careTeam) {
      return {
        content: [{ type: 'text', text: `No care team found for patient ${patientId}` }],
        structuredContent: {
          success: true,
          careTeam: null,
          timestamp: new Date().toISOString(),
          _audit: createAuditMetadata(['careTeam'], { dataClassification: 'internal' }),
        },
      };
    }

    const audit = createAuditMetadata(
      ['careTeam', 'members', 'contact-info'],
      {
        dataClassification: 'internal',
        purpose: 'care-coordination',
      }
    );

    const structured = {
      success: true,
      careTeam: {
        id: careTeam.id,
        name: careTeam.name,
        status: careTeam.status,
        members: careTeam.members.map(m => ({
          role: m.role,
          name: m.name,
          specialty: m.specialty,
          phone: m.phone,
        })),
      },
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    return {
      content: [{
        type: 'text',
        text: `Care Team: ${careTeam.name}\n${careTeam.members.map(m => `- ${m.role}: ${m.name} (${m.specialty || 'N/A'})`).join('\n')}`,
      }],
      structuredContent: structured,
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('Patient Records MCP Server started');
    console.error('Tools: get_patient, search_patients, get_patient_conditions, get_patient_allergies, get_patient_medications, get_patient_vitals, get_care_team');
  }
}

// Start the server
const server = new PatientRecordsMCPServer();
server.start().catch((error) => {
  console.error('Failed to start Patient Records MCP Server:', error);
  process.exit(1);
});
