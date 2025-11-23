# MCP Enhancement Proposal: Healthcare Domain Demonstration

**Status:** Implementation Ready
**Version:** 1.0
**Last Updated:** November 23, 2025

---

## Executive Summary

This proposal outlines enhancements to the MCP (Model Context Protocol) reference implementation, demonstrated through healthcare domain MCP servers. Healthcare is an ideal domain for showcasing advanced MCP capabilities due to:

- **Complex workflows**: Patient intake, care coordination, medication management
- **Policy compliance requirements**: HIPAA, HL7 FHIR, state regulations
- **Sensitive data handling**: PHI (Protected Health Information), PII
- **Role-based access**: Doctors, nurses, pharmacists, administrators
- **Audit trail requirements**: Every access must be logged

---

## Proposed Enhancements

### 1. Policy-Aware Tool Execution

**Current State:**
Tools execute without awareness of organizational policies, compliance requirements, or data sensitivity.

**Enhancement:**
Integrate policy metadata into tool definitions and responses.

```typescript
// Enhanced tool definition with policy hints
{
  name: 'get_patient_record',
  title: 'Get Patient Record',
  description: 'Retrieve patient medical record',
  inputSchema: { ... },
  outputSchema: { ... },
  // NEW: Policy metadata
  _policies: {
    dataClassification: 'restricted',  // public | internal | confidential | restricted
    piiHandling: 'restricted',          // allowed | restricted | forbidden
    requiredRoles: ['doctor', 'nurse', 'admin'],
    requiredScopes: ['patient:read', 'phi:access'],
    auditLevel: 'full',                 // none | basic | detailed | full
    complianceFrameworks: ['HIPAA', 'HITECH'],
    retentionPeriod: '7years'
  }
}
```

**Benefits:**
- Gateway can enforce policies before execution
- Audit system knows what to log
- Compliance reporting automated

---

### 2. Structured Audit Responses

**Current State:**
Tool responses include structured content but lack audit-ready metadata.

**Enhancement:**
Include audit trail information in structured responses.

```typescript
// Enhanced response with audit metadata
{
  content: [{ type: 'text', text: '...' }],
  structuredContent: {
    // Business data
    patient: { id: 'P12345', name: 'John Doe' },
    // NEW: Audit metadata
    _audit: {
      eventId: 'evt_abc123',
      timestamp: '2025-11-23T10:30:00Z',
      accessedFields: ['name', 'dob', 'diagnosis'],
      dataClassification: 'restricted',
      piiAccessed: true,
      piiFields: ['name', 'dob', 'ssn'],
      complianceContext: {
        hipaaCategory: 'treatment',
        minimumNecessary: true,
        breakGlass: false
      }
    }
  }
}
```

**Benefits:**
- Self-documenting audit trail
- Compliance-ready responses
- PII tracking built-in

---

### 3. Consent-Aware Data Access

**Current State:**
No mechanism to track patient consent for data access.

**Enhancement:**
Integrate consent status into tool execution.

```typescript
// Consent-aware tool response
{
  structuredContent: {
    patient: { id: 'P12345' },
    conditions: [...],
    // NEW: Consent metadata
    _consent: {
      status: 'granted',
      purposes: ['treatment', 'care-coordination'],
      restrictions: ['no-marketing', 'no-research'],
      expiresAt: '2026-01-01T00:00:00Z',
      consentDocumentUri: 'consent://P12345/2025-consent'
    }
  }
}
```

---

### 4. Break-Glass Emergency Access

**Current State:**
No mechanism for emergency access that bypasses normal authorization.

**Enhancement:**
Support break-glass scenarios with enhanced auditing.

```typescript
// Break-glass request
{
  toolName: 'get_patient_record',
  input: {
    patientId: 'P12345',
    breakGlass: true,
    breakGlassReason: 'Emergency - patient unconscious, need allergy info',
    breakGlassWitness: 'nurse_jane_doe'
  }
}

// Response includes break-glass audit
{
  structuredContent: {
    _audit: {
      breakGlass: true,
      breakGlassReason: 'Emergency - patient unconscious...',
      breakGlassWitness: 'nurse_jane_doe',
      breakGlassApprovedBy: 'system-auto-emergency',
      requiresReview: true,
      reviewDeadline: '2025-11-24T10:30:00Z'
    }
  }
}
```

---

### 5. Data Minimization Patterns

**Current State:**
Tools return full data sets without field-level filtering.

**Enhancement:**
Support field-level access control and data minimization.

```typescript
// Request with field restrictions
{
  toolName: 'get_patient_record',
  input: {
    patientId: 'P12345',
    requestedFields: ['name', 'allergies', 'currentMedications'],
    purpose: 'prescription-review'
  }
}

// Response with field-level audit
{
  structuredContent: {
    patient: {
      name: 'John Doe',            // Returned
      allergies: [...],            // Returned
      currentMedications: [...],   // Returned
      // dob: REDACTED,            // Not returned - not requested
      // ssn: REDACTED,            // Not returned - not requested
    },
    _dataMinimization: {
      requestedFields: ['name', 'allergies', 'currentMedications'],
      returnedFields: ['name', 'allergies', 'currentMedications'],
      redactedFields: ['dob', 'ssn', 'address', 'insurance'],
      minimizationApplied: true,
      purpose: 'prescription-review'
    }
  }
}
```

---

### 6. Inter-Tool References

**Current State:**
Tools operate independently without referencing related data.

**Enhancement:**
Support resource links between related data.

```typescript
// Response with related resource links
{
  content: [
    { type: 'text', text: 'Patient record retrieved' },
    // NEW: Resource links to related data
    {
      type: 'resource',
      resource: {
        uri: 'patient://P12345/allergies',
        mimeType: 'application/json',
        title: 'Patient Allergies',
        _meta: { recordCount: 3 }
      }
    },
    {
      type: 'resource',
      resource: {
        uri: 'patient://P12345/medications',
        mimeType: 'application/json',
        title: 'Current Medications',
        _meta: { recordCount: 5 }
      }
    }
  ]
}
```

---

### 7. Compliance Validation Hooks

**Current State:**
No pre-execution compliance validation.

**Enhancement:**
Tools can specify compliance validators.

```typescript
// Tool with compliance validators
{
  name: 'prescribe_medication',
  _compliance: {
    preExecutionValidators: [
      {
        type: 'drug-interaction-check',
        required: true,
        blockOnFailure: true
      },
      {
        type: 'allergy-check',
        required: true,
        blockOnFailure: true
      },
      {
        type: 'dosage-range-check',
        required: true,
        blockOnFailure: false,  // Warn but allow override
        allowOverrideWith: ['attending-physician-approval']
      }
    ],
    postExecutionValidators: [
      {
        type: 'audit-log',
        required: true
      },
      {
        type: 'pharmacy-notification',
        required: true
      }
    ]
  }
}
```

---

## Healthcare MCP Servers

To demonstrate these enhancements, we implement three healthcare domain MCP servers:

### 1. Patient Records MCP Server

**File:** `src/mcp-servers/healthcare/patient-records-server.ts`

**Purpose:** FHIR-compliant patient data access with HIPAA controls

**Tools:**
| Tool | Description | Policy Level |
|------|-------------|--------------|
| `get_patient` | Get patient demographics | restricted |
| `search_patients` | Search patients by criteria | confidential |
| `get_patient_conditions` | Get diagnoses/conditions | restricted |
| `get_patient_allergies` | Get allergy information | restricted |
| `get_patient_medications` | Get current medications | restricted |
| `get_patient_vitals` | Get vital signs history | confidential |
| `get_care_team` | Get patient care team | internal |

**Resources:**
- `patient://{id}` - Patient record resource
- `patient://{id}/summary` - Patient summary
- `fhir://Patient/{id}` - FHIR resource representation

---

### 2. Pharmacy MCP Server

**File:** `src/mcp-servers/healthcare/pharmacy-server.ts`

**Purpose:** Medication management with drug interaction checking

**Tools:**
| Tool | Description | Policy Level |
|------|-------------|--------------|
| `check_drug_interactions` | Check for drug-drug interactions | confidential |
| `get_medication_info` | Get drug information | public |
| `verify_prescription` | Verify prescription validity | restricted |
| `check_dosage` | Check dosage appropriateness | confidential |
| `get_formulary_status` | Check insurance formulary | internal |
| `get_alternatives` | Get therapeutic alternatives | internal |

**Special Features:**
- Drug interaction severity levels (contraindicated, major, moderate, minor)
- Dosage range validation
- Allergy cross-reference

---

### 3. Clinical Workflow MCP Server

**File:** `src/mcp-servers/healthcare/clinical-workflow-server.ts`

**Purpose:** Care coordination and appointment scheduling

**Tools:**
| Tool | Description | Policy Level |
|------|-------------|--------------|
| `schedule_appointment` | Schedule patient appointment | internal |
| `get_appointments` | Get appointment list | internal |
| `create_referral` | Create specialist referral | confidential |
| `get_care_plan` | Get patient care plan | restricted |
| `update_care_plan` | Update care plan | restricted |
| `send_clinical_message` | Send secure message | confidential |
| `get_provider_availability` | Check provider schedule | public |

---

## Implementation Architecture

```
src/mcp-servers/healthcare/
├── index.ts                      # Re-exports all servers
├── types/
│   ├── fhir.ts                   # FHIR resource types
│   ├── hipaa.ts                  # HIPAA compliance types
│   └── healthcare.ts             # Common healthcare types
├── utils/
│   ├── audit.ts                  # Audit logging utilities
│   ├── consent.ts                # Consent checking
│   ├── data-minimization.ts      # Field filtering
│   └── policy.ts                 # Policy evaluation
├── patient-records-server.ts     # Patient records server
├── pharmacy-server.ts            # Pharmacy server
└── clinical-workflow-server.ts   # Clinical workflow server
```

---

## Data Classification Levels

| Level | Description | Examples | Access Requirements |
|-------|-------------|----------|---------------------|
| **Public** | Non-sensitive, publicly available | Drug info, provider directory | None |
| **Internal** | Internal business data | Schedules, capacity | Employee role |
| **Confidential** | Sensitive business data | Insurance info, utilization | Specific role |
| **Restricted** | Most sensitive (PHI/PII) | Medical records, diagnoses | Role + consent + audit |

---

## HIPAA Compliance Features

### Access Controls (45 CFR 164.312(a)(1))
- Role-based access with fine-grained permissions
- Break-glass for emergencies with enhanced logging
- Automatic session timeout

### Audit Controls (45 CFR 164.312(b))
- Every PHI access logged with:
  - Who (user, role, department)
  - What (patient ID, fields accessed)
  - When (timestamp)
  - Where (IP, device)
  - Why (purpose code)
- Immutable audit logs
- 6-year retention

### Integrity (45 CFR 164.312(c)(1))
- Data integrity verification
- Change tracking
- Version history

### Transmission Security (45 CFR 164.312(e)(1))
- All data encrypted in transit (handled by transport)
- Structured output for secure parsing

### Minimum Necessary (45 CFR 164.502(b))
- Field-level data minimization
- Purpose-based filtering
- Only return what's needed

---

## Sample Interactions

### Example 1: Patient Record Access

**Request:**
```
Agent: "Get patient record for patient P12345 for medication review"
```

**Tool Call:**
```json
{
  "tool": "get_patient",
  "input": {
    "patientId": "P12345",
    "purpose": "medication-review",
    "requestedFields": ["name", "dob", "allergies", "medications"]
  }
}
```

**Response:**
```json
{
  "content": [{"type": "text", "text": "Patient: John Doe (DOB: 1985-03-15)..."}],
  "structuredContent": {
    "patient": {
      "id": "P12345",
      "name": "John Doe",
      "dob": "1985-03-15",
      "allergies": ["penicillin", "sulfa"],
      "medications": [
        {"name": "Lisinopril", "dose": "10mg", "frequency": "daily"}
      ]
    },
    "_audit": {
      "eventId": "evt_001",
      "accessedFields": ["name", "dob", "allergies", "medications"],
      "piiAccessed": true,
      "purpose": "medication-review",
      "hipaaCategory": "treatment"
    }
  }
}
```

### Example 2: Drug Interaction Check

**Request:**
```
Agent: "Check if we can add Warfarin for patient P12345"
```

**Tool Calls:**
1. Get patient medications
2. Check drug interactions

**Response:**
```json
{
  "content": [{"type": "text", "text": "WARNING: Major drug interaction detected..."}],
  "structuredContent": {
    "interactions": [
      {
        "drug1": "Warfarin",
        "drug2": "Aspirin",
        "severity": "major",
        "description": "Increased bleeding risk",
        "recommendation": "Monitor closely or consider alternatives"
      }
    ],
    "safeToAdd": false,
    "requiresOverride": true,
    "alternatives": ["Apixaban", "Rivaroxaban"]
  }
}
```

### Example 3: Emergency Break-Glass Access

**Request:**
```
Agent: "EMERGENCY: Need complete record for unconscious patient P12345"
```

**Tool Call:**
```json
{
  "tool": "get_patient",
  "input": {
    "patientId": "P12345",
    "breakGlass": true,
    "breakGlassReason": "Patient unconscious in ED, need full history"
  }
}
```

**Response:**
```json
{
  "structuredContent": {
    "patient": { /* Full record */ },
    "_audit": {
      "breakGlass": true,
      "breakGlassReason": "Patient unconscious in ED...",
      "allFieldsReturned": true,
      "normalAccessDenied": false,
      "requiresReview": true,
      "reviewDeadline": "2025-11-24T10:30:00Z"
    }
  }
}
```

---

## Testing Strategy

### Compliance Tests
- Policy enforcement tests
- Audit log completeness
- Data minimization validation
- Consent checking
- Break-glass scenarios

### Security Tests
- Role-based access enforcement
- Unauthorized access attempts
- PHI exposure prevention
- Audit trail integrity

### Functional Tests
- Tool input/output validation
- FHIR resource conformance
- Drug interaction accuracy
- Workflow completion

---

## Metrics

### Compliance Metrics
- Audit log coverage (target: 100%)
- Consent verification rate
- Break-glass usage rate
- Policy violation attempts

### Operational Metrics
- Tool response times
- Error rates
- Cache hit rates
- Concurrent user capacity

---

## Implementation Phases

### Phase 1: Core Implementation
- [x] Patient Records MCP Server
- [x] Basic HIPAA audit logging
- [x] Role-based access hints
- [x] Structured output with audit metadata

### Phase 2: Enhanced Compliance
- [ ] Pharmacy MCP Server with drug interactions
- [ ] Clinical Workflow MCP Server
- [ ] Consent integration
- [ ] Break-glass support

### Phase 3: Governance Integration
- [ ] Policy engine integration
- [ ] Real audit logging backend
- [ ] Compliance reporting
- [ ] Multi-server coordination

---

## Conclusion

The healthcare domain provides an excellent showcase for MCP enhancements because it demands:

1. **Strong typing** - FHIR resources require strict schemas
2. **Policy enforcement** - HIPAA mandates access controls
3. **Audit trails** - Every access must be logged
4. **Data minimization** - Only return what's needed
5. **Emergency access** - Break-glass for life-threatening situations
6. **Consent management** - Patient rights must be respected

These servers demonstrate that MCP can handle enterprise-grade compliance requirements while maintaining the simplicity and composability that makes the protocol powerful.

---

**Document Status:** Implementation Ready
**Next Steps:** Implement healthcare MCP servers
**Owner:** MCP Reference Implementation Team

---

**END OF DOCUMENT**
