/**
 * Healthcare Test Fixtures
 *
 * Provides standardized test data for healthcare MCP server testing.
 * Follows the testing framework patterns established in the project.
 */

// =============================================================================
// Patient Fixtures
// =============================================================================

export interface PatientFixture {
  patientId: string;
  purpose: string;
  description: string;
  expectSuccess: boolean;
  expectPII?: boolean;
  requestedFields?: string[];
  breakGlass?: boolean;
  breakGlassReason?: string;
}

export const PatientFixtures: PatientFixture[] = [
  {
    patientId: 'P12345',
    purpose: 'treatment',
    description: 'Valid patient with treatment purpose',
    expectSuccess: true,
    expectPII: true,
  },
  {
    patientId: 'P67890',
    purpose: 'treatment',
    description: 'Second valid patient',
    expectSuccess: true,
    expectPII: true,
  },
  {
    patientId: 'P12345',
    purpose: 'treatment',
    description: 'Data minimization - specific fields only',
    expectSuccess: true,
    expectPII: true,
    requestedFields: ['name', 'dob', 'allergies'],
  },
  {
    patientId: 'P12345',
    purpose: 'emergency',
    description: 'Break-glass emergency access',
    expectSuccess: true,
    expectPII: true,
    breakGlass: true,
    breakGlassReason: 'Patient unconscious, need allergy info',
  },
  {
    patientId: 'INVALID',
    purpose: 'treatment',
    description: 'Non-existent patient',
    expectSuccess: false,
  },
];

// =============================================================================
// Drug Interaction Fixtures
// =============================================================================

export interface DrugInteractionFixture {
  newDrug: string;
  currentMedications: string[];
  expectInteraction: boolean;
  expectedSeverity?: 'contraindicated' | 'major' | 'moderate' | 'minor';
  description: string;
}

export const DrugInteractionFixtures: DrugInteractionFixture[] = [
  {
    newDrug: 'Warfarin',
    currentMedications: ['Aspirin'],
    expectInteraction: true,
    expectedSeverity: 'major',
    description: 'Warfarin + Aspirin = Major bleeding risk',
  },
  {
    newDrug: 'Warfarin',
    currentMedications: ['Ibuprofen'],
    expectInteraction: true,
    expectedSeverity: 'major',
    description: 'Warfarin + NSAID = Major bleeding risk',
  },
  {
    newDrug: 'Lisinopril',
    currentMedications: ['Potassium'],
    expectInteraction: true,
    expectedSeverity: 'major',
    description: 'ACE inhibitor + Potassium = Hyperkalemia risk',
  },
  {
    newDrug: 'Clopidogrel',
    currentMedications: ['Omeprazole'],
    expectInteraction: true,
    expectedSeverity: 'moderate',
    description: 'Clopidogrel + PPI = Reduced efficacy',
  },
  {
    newDrug: 'Metformin',
    currentMedications: ['Lisinopril'],
    expectInteraction: false,
    description: 'Safe combination - no significant interaction',
  },
  {
    newDrug: 'Amlodipine',
    currentMedications: ['Metformin', 'Lisinopril'],
    expectInteraction: false,
    description: 'Common diabetes/hypertension combo - safe',
  },
];

// =============================================================================
// Dosage Fixtures
// =============================================================================

export interface DosageFixture {
  drugName: string;
  dose: number;
  unit: string;
  expectAppropriate: boolean;
  description: string;
}

export const DosageFixtures: DosageFixture[] = [
  {
    drugName: 'Lisinopril',
    dose: 10,
    unit: 'mg',
    expectAppropriate: true,
    description: 'Normal lisinopril dose',
  },
  {
    drugName: 'Lisinopril',
    dose: 100,
    unit: 'mg',
    expectAppropriate: false,
    description: 'Lisinopril dose too high',
  },
  {
    drugName: 'Metformin',
    dose: 500,
    unit: 'mg',
    expectAppropriate: true,
    description: 'Normal metformin dose',
  },
  {
    drugName: 'Metformin',
    dose: 5000,
    unit: 'mg',
    expectAppropriate: false,
    description: 'Metformin dose exceeds max',
  },
  {
    drugName: 'Aspirin',
    dose: 81,
    unit: 'mg',
    expectAppropriate: true,
    description: 'Low-dose aspirin',
  },
];

// =============================================================================
// Appointment Fixtures
// =============================================================================

export interface AppointmentFixture {
  patientId: string;
  providerId: string;
  appointmentType: string;
  duration: number;
  description: string;
}

export const AppointmentFixtures: AppointmentFixture[] = [
  {
    patientId: 'P12345',
    providerId: 'DR001',
    appointmentType: 'follow-up',
    duration: 30,
    description: 'Standard follow-up appointment',
  },
  {
    patientId: 'P12345',
    providerId: 'DR003',
    appointmentType: 'new-patient',
    duration: 45,
    description: 'New patient specialist visit',
  },
];

// =============================================================================
// Referral Fixtures
// =============================================================================

export interface ReferralFixture {
  patientId: string;
  requesterId: string;
  recipientId: string;
  priority: 'routine' | 'urgent' | 'stat';
  reason: string;
  description: string;
}

export const ReferralFixtures: ReferralFixture[] = [
  {
    patientId: 'P12345',
    requesterId: 'DR001',
    recipientId: 'DR003',
    priority: 'routine',
    reason: 'Hypertension evaluation',
    description: 'Routine cardiology referral',
  },
  {
    patientId: 'P12345',
    requesterId: 'DR001',
    recipientId: 'DR004',
    priority: 'urgent',
    reason: 'Uncontrolled diabetes',
    description: 'Urgent endocrinology referral',
  },
];

// =============================================================================
// Audit Metadata Fixtures
// =============================================================================

export const AuditMetadataRequiredFields = [
  'eventId',
  'timestamp',
  'accessedFields',
  'dataClassification',
  'piiAccessed',
];

export const DataClassificationLevels = [
  'public',
  'internal',
  'confidential',
  'restricted',
];

export const HIPAACategoryValues = [
  'treatment',
  'payment',
  'operations',
  'research',
  'public-health',
  'emergency',
];

// =============================================================================
// Tool Policy Fixtures
// =============================================================================

export interface ToolPolicyFixture {
  toolName: string;
  expectedClassification: string;
  expectedRoles: string[];
  description: string;
}

export const ToolPolicyFixtures: ToolPolicyFixture[] = [
  {
    toolName: 'get_patient',
    expectedClassification: 'restricted',
    expectedRoles: ['doctor', 'nurse', 'admin'],
    description: 'Patient records require restricted access',
  },
  {
    toolName: 'get_patient_allergies',
    expectedClassification: 'restricted',
    expectedRoles: ['doctor', 'nurse', 'pharmacist'],
    description: 'Allergy info requires restricted access',
  },
  {
    toolName: 'get_care_team',
    expectedClassification: 'internal',
    expectedRoles: ['doctor', 'nurse', 'admin', 'care-coordinator'],
    description: 'Care team info is internal',
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get fixtures filtered by expected outcome
 */
export function getSuccessFixtures<T extends { expectSuccess?: boolean }>(
  fixtures: T[]
): T[] {
  return fixtures.filter((f) => f.expectSuccess !== false);
}

/**
 * Get fixtures that expect errors
 */
export function getErrorFixtures<T extends { expectSuccess?: boolean }>(
  fixtures: T[]
): T[] {
  return fixtures.filter((f) => f.expectSuccess === false);
}

/**
 * Get drug interaction fixtures by severity
 */
export function getInteractionsBySeverity(
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor'
): DrugInteractionFixture[] {
  return DrugInteractionFixtures.filter(
    (f) => f.expectInteraction && f.expectedSeverity === severity
  );
}

/**
 * Generate a future appointment time for testing
 */
export function getFutureAppointmentTime(daysAhead: number = 7): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}
