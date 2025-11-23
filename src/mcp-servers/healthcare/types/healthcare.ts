/**
 * Healthcare Domain Types
 *
 * Types for healthcare MCP servers demonstrating policy-aware,
 * HIPAA-compliant data handling with comprehensive audit trails.
 */

// =============================================================================
// Data Classification
// =============================================================================

export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';
export type PIIHandling = 'allowed' | 'restricted' | 'forbidden';
export type AuditLevel = 'none' | 'basic' | 'detailed' | 'full';

// =============================================================================
// Policy Types
// =============================================================================

export interface ToolPolicies {
  dataClassification: DataClassification;
  piiHandling: PIIHandling;
  requiredRoles: string[];
  requiredScopes: string[];
  auditLevel: AuditLevel;
  complianceFrameworks: string[];
  retentionPeriod?: string;
}

export interface PolicyContext {
  userId: string;
  userRoles: string[];
  userDepartment?: string;
  purpose: string;
  breakGlass?: boolean;
  breakGlassReason?: string;
}

// =============================================================================
// Audit Types
// =============================================================================

export interface AuditMetadata {
  eventId: string;
  timestamp: string;
  userId?: string;
  userRoles?: string[];
  accessedFields: string[];
  dataClassification: DataClassification;
  piiAccessed: boolean;
  piiFields?: string[];
  purpose?: string;
  complianceContext?: HIPAAComplianceContext;
  breakGlass?: boolean;
  breakGlassReason?: string;
  breakGlassApprovedBy?: string;
  requiresReview?: boolean;
  reviewDeadline?: string;
}

export interface HIPAAComplianceContext {
  hipaaCategory: 'treatment' | 'payment' | 'operations' | 'research' | 'public-health' | 'emergency';
  minimumNecessary: boolean;
  breakGlass: boolean;
  consentVerified?: boolean;
}

// =============================================================================
// Consent Types
// =============================================================================

export interface ConsentMetadata {
  status: 'granted' | 'denied' | 'pending' | 'expired' | 'withdrawn';
  purposes: string[];
  restrictions?: string[];
  grantedAt?: string;
  expiresAt?: string;
  consentDocumentUri?: string;
}

// =============================================================================
// Data Minimization Types
// =============================================================================

export interface DataMinimizationMetadata {
  requestedFields: string[];
  returnedFields: string[];
  redactedFields: string[];
  minimizationApplied: boolean;
  purpose: string;
}

// =============================================================================
// FHIR-Inspired Resource Types
// =============================================================================

export interface FHIRReference {
  reference: string;  // e.g., "Patient/P12345"
  display?: string;
}

export interface FHIRCodeableConcept {
  coding: Array<{
    system: string;
    code: string;
    display: string;
  }>;
  text?: string;
}

export interface FHIRPeriod {
  start?: string;
  end?: string;
}

// =============================================================================
// Patient Types
// =============================================================================

export interface Patient {
  id: string;
  mrn?: string;  // Medical Record Number
  name: PatientName;
  dob: string;
  gender: 'male' | 'female' | 'other' | 'unknown';
  address?: Address;
  phone?: string;
  email?: string;
  ssn?: string;  // Highly sensitive
  insurance?: InsuranceInfo;
  emergencyContact?: EmergencyContact;
  primaryCareProvider?: FHIRReference;
  active: boolean;
}

export interface PatientName {
  given: string[];
  family: string;
  prefix?: string[];
  suffix?: string[];
  display?: string;
}

export interface Address {
  line: string[];
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface InsuranceInfo {
  provider: string;
  memberId: string;
  groupId?: string;
  planType?: string;
  effectiveDate?: string;
  terminationDate?: string;
}

// =============================================================================
// Clinical Types
// =============================================================================

export interface Condition {
  id: string;
  code: FHIRCodeableConcept;
  clinicalStatus: 'active' | 'recurrence' | 'relapse' | 'inactive' | 'remission' | 'resolved';
  verificationStatus: 'unconfirmed' | 'provisional' | 'differential' | 'confirmed' | 'refuted';
  severity?: 'mild' | 'moderate' | 'severe';
  onsetDate?: string;
  abatementDate?: string;
  recordedDate: string;
  recorder?: FHIRReference;
  notes?: string;
}

export interface Allergy {
  id: string;
  substance: FHIRCodeableConcept;
  clinicalStatus: 'active' | 'inactive' | 'resolved';
  verificationStatus: 'unconfirmed' | 'confirmed' | 'refuted';
  type: 'allergy' | 'intolerance';
  category: 'food' | 'medication' | 'environment' | 'biologic';
  criticality: 'low' | 'high' | 'unable-to-assess';
  reactions?: AllergyReaction[];
  recordedDate: string;
  recorder?: FHIRReference;
}

export interface AllergyReaction {
  substance?: FHIRCodeableConcept;
  manifestation: FHIRCodeableConcept[];
  severity?: 'mild' | 'moderate' | 'severe';
  onset?: string;
}

export interface Medication {
  id: string;
  code: FHIRCodeableConcept;
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'stopped' | 'draft';
  dosage: Dosage;
  prescriber?: FHIRReference;
  authoredOn?: string;
  reasonCode?: FHIRCodeableConcept[];
  notes?: string;
}

export interface Dosage {
  text?: string;
  timing?: {
    frequency: number;
    period: number;
    periodUnit: 'h' | 'd' | 'wk' | 'mo';
  };
  route?: FHIRCodeableConcept;
  doseQuantity?: {
    value: number;
    unit: string;
  };
  maxDosePerPeriod?: {
    numerator: { value: number; unit: string };
    denominator: { value: number; unit: string };
  };
}

export interface VitalSign {
  id: string;
  type: VitalSignType;
  value: number;
  unit: string;
  effectiveDateTime: string;
  performer?: FHIRReference;
  interpretation?: 'normal' | 'low' | 'high' | 'critical-low' | 'critical-high';
}

export type VitalSignType =
  | 'blood-pressure-systolic'
  | 'blood-pressure-diastolic'
  | 'heart-rate'
  | 'respiratory-rate'
  | 'temperature'
  | 'oxygen-saturation'
  | 'weight'
  | 'height'
  | 'bmi';

// =============================================================================
// Care Team Types
// =============================================================================

export interface CareTeamMember {
  id: string;
  role: string;
  name: string;
  specialty?: string;
  phone?: string;
  email?: string;
  organization?: string;
  period?: FHIRPeriod;
}

export interface CareTeam {
  id: string;
  name: string;
  status: 'proposed' | 'active' | 'suspended' | 'inactive';
  category?: FHIRCodeableConcept[];
  subject: FHIRReference;
  members: CareTeamMember[];
  managingOrganization?: FHIRReference[];
}

// =============================================================================
// Pharmacy Types
// =============================================================================

export interface DrugInteraction {
  drug1: DrugInfo;
  drug2: DrugInfo;
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
  description: string;
  mechanism?: string;
  clinicalConsequence?: string;
  recommendation: string;
  evidenceLevel?: 'established' | 'theoretical' | 'case-report';
}

export interface DrugInfo {
  ndc?: string;  // National Drug Code
  rxcui?: string;  // RxNorm Concept Unique Identifier
  name: string;
  genericName?: string;
  brandNames?: string[];
  drugClass?: string[];
  manufacturer?: string;
}

export interface PrescriptionVerification {
  valid: boolean;
  prescriptionId: string;
  patientId: string;
  medication: DrugInfo;
  prescriber: FHIRReference;
  prescribedDate: string;
  expirationDate: string;
  refillsRemaining: number;
  quantityPrescribed: number;
  daysSupply: number;
  issues?: PrescriptionIssue[];
}

export interface PrescriptionIssue {
  type: 'expired' | 'no-refills' | 'early-refill' | 'quantity-exceeded' | 'prescriber-invalid' | 'duplicate-therapy';
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface DosageCheck {
  appropriate: boolean;
  prescribedDose: { value: number; unit: string };
  recommendedRange: {
    min: { value: number; unit: string };
    max: { value: number; unit: string };
  };
  indication?: string;
  patientFactors?: string[];
  warnings?: string[];
}

export interface FormularyStatus {
  covered: boolean;
  tier?: number;
  priorAuthRequired: boolean;
  stepTherapyRequired: boolean;
  quantityLimit?: { quantity: number; days: number };
  alternatives?: DrugInfo[];
  estimatedCopay?: { amount: number; currency: string };
}

// =============================================================================
// Clinical Workflow Types
// =============================================================================

export interface Appointment {
  id: string;
  status: 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow';
  type: FHIRCodeableConcept;
  reason?: FHIRCodeableConcept[];
  priority?: number;
  description?: string;
  start: string;
  end: string;
  duration: number;  // minutes
  patient: FHIRReference;
  provider: FHIRReference;
  location?: FHIRReference;
  notes?: string;
}

export interface ProviderAvailability {
  providerId: string;
  providerName: string;
  date: string;
  slots: TimeSlot[];
}

export interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
  appointmentType?: string;
}

export interface Referral {
  id: string;
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed';
  intent: 'proposal' | 'plan' | 'order';
  priority: 'routine' | 'urgent' | 'stat';
  patient: FHIRReference;
  requester: FHIRReference;
  recipient: FHIRReference;
  reasonCode?: FHIRCodeableConcept[];
  reasonReference?: FHIRReference[];
  description?: string;
  authoredOn: string;
  occurrencePeriod?: FHIRPeriod;
  notes?: string;
}

export interface CarePlan {
  id: string;
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed';
  intent: 'proposal' | 'plan' | 'order';
  title: string;
  description?: string;
  subject: FHIRReference;
  period?: FHIRPeriod;
  created: string;
  author?: FHIRReference;
  careTeam?: FHIRReference[];
  addresses?: FHIRReference[];  // Conditions being addressed
  goals?: CarePlanGoal[];
  activities?: CarePlanActivity[];
}

export interface CarePlanGoal {
  id: string;
  description: string;
  status: 'proposed' | 'planned' | 'accepted' | 'active' | 'on-hold' | 'completed' | 'cancelled';
  priority?: 'high' | 'medium' | 'low';
  target?: {
    measure: FHIRCodeableConcept;
    detailQuantity?: { value: number; unit: string };
    dueDate?: string;
  };
}

export interface CarePlanActivity {
  id: string;
  status: 'not-started' | 'scheduled' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled';
  description: string;
  kind?: 'appointment' | 'medication' | 'procedure' | 'observation' | 'communication';
  scheduledPeriod?: FHIRPeriod;
  performer?: FHIRReference[];
  notes?: string;
}

export interface ClinicalMessage {
  id: string;
  status: 'preparation' | 'in-progress' | 'completed' | 'entered-in-error';
  category: 'notification' | 'request' | 'alert' | 'instruction';
  priority: 'routine' | 'urgent' | 'stat';
  sender: FHIRReference;
  recipient: FHIRReference[];
  subject?: FHIRReference;  // Patient if applicable
  sent: string;
  received?: string;
  payload: MessagePayload[];
}

export interface MessagePayload {
  contentType: 'text' | 'attachment' | 'reference';
  content: string;
  title?: string;
}

// =============================================================================
// Response Types with Audit
// =============================================================================

export interface HealthcareToolResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  _audit: AuditMetadata;
  _consent?: ConsentMetadata;
  _dataMinimization?: DataMinimizationMetadata;
}

// =============================================================================
// Utility Functions
// =============================================================================

export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function createAuditMetadata(
  accessedFields: string[],
  options: Partial<AuditMetadata> = {}
): AuditMetadata {
  const piiFields = detectPIIFields(accessedFields);

  return {
    eventId: generateEventId(),
    timestamp: new Date().toISOString(),
    accessedFields,
    dataClassification: options.dataClassification || 'internal',
    piiAccessed: piiFields.length > 0,
    piiFields: piiFields.length > 0 ? piiFields : undefined,
    ...options,
  };
}

const PII_FIELD_PATTERNS = [
  'ssn', 'social_security', 'socialSecurity',
  'dob', 'date_of_birth', 'dateOfBirth', 'birthDate',
  'name', 'given', 'family', 'firstName', 'lastName',
  'address', 'street', 'city', 'state', 'zip', 'postalCode',
  'phone', 'telephone', 'mobile', 'cell',
  'email', 'emailAddress',
  'mrn', 'medical_record_number', 'medicalRecordNumber',
  'insurance', 'memberId', 'groupId',
];

export function detectPIIFields(fields: string[]): string[] {
  return fields.filter(field =>
    PII_FIELD_PATTERNS.some(pattern =>
      field.toLowerCase().includes(pattern.toLowerCase())
    )
  );
}

export function redactPII<T extends Record<string, any>>(
  data: T,
  fieldsToRedact: string[]
): T {
  const redacted = { ...data };
  for (const field of fieldsToRedact) {
    if (field in redacted) {
      (redacted as any)[field] = '[REDACTED]';
    }
  }
  return redacted;
}
