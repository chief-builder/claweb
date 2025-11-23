#!/usr/bin/env node

/**
 * Pharmacy MCP Server
 *
 * A comprehensive medication management MCP server demonstrating:
 * - Drug interaction checking with severity levels
 * - Dosage validation
 * - Formulary status checking
 * - Therapeutic alternatives
 * - Prescription verification
 *
 * IMPORTANT: This is a demonstration server with mock data.
 * Real implementations would integrate with drug databases like
 * First Databank, Medi-Span, or Clinical Pharmacology.
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
  DrugInteraction,
  DrugInfo,
  DosageCheck,
  FormularyStatus,
  PrescriptionVerification,
  createAuditMetadata,
} from './types/healthcare.js';

// =============================================================================
// Mock Drug Database
// =============================================================================

const DRUG_DATABASE: Map<string, DrugInfo> = new Map([
  ['warfarin', {
    rxcui: '11289',
    name: 'Warfarin',
    genericName: 'Warfarin Sodium',
    brandNames: ['Coumadin', 'Jantoven'],
    drugClass: ['Anticoagulant', 'Vitamin K Antagonist'],
  }],
  ['aspirin', {
    rxcui: '1191',
    name: 'Aspirin',
    genericName: 'Acetylsalicylic Acid',
    brandNames: ['Bayer', 'Ecotrin'],
    drugClass: ['NSAID', 'Antiplatelet', 'Salicylate'],
  }],
  ['lisinopril', {
    rxcui: '29046',
    name: 'Lisinopril',
    genericName: 'Lisinopril',
    brandNames: ['Prinivil', 'Zestril'],
    drugClass: ['ACE Inhibitor', 'Antihypertensive'],
  }],
  ['metformin', {
    rxcui: '6809',
    name: 'Metformin',
    genericName: 'Metformin Hydrochloride',
    brandNames: ['Glucophage', 'Glumetza'],
    drugClass: ['Biguanide', 'Antidiabetic'],
  }],
  ['ibuprofen', {
    rxcui: '5640',
    name: 'Ibuprofen',
    genericName: 'Ibuprofen',
    brandNames: ['Advil', 'Motrin'],
    drugClass: ['NSAID', 'Analgesic', 'Anti-inflammatory'],
  }],
  ['omeprazole', {
    rxcui: '7646',
    name: 'Omeprazole',
    genericName: 'Omeprazole',
    brandNames: ['Prilosec', 'Losec'],
    drugClass: ['Proton Pump Inhibitor', 'Antacid'],
  }],
  ['simvastatin', {
    rxcui: '36567',
    name: 'Simvastatin',
    genericName: 'Simvastatin',
    brandNames: ['Zocor'],
    drugClass: ['HMG-CoA Reductase Inhibitor', 'Statin'],
  }],
  ['amlodipine', {
    rxcui: '17767',
    name: 'Amlodipine',
    genericName: 'Amlodipine Besylate',
    brandNames: ['Norvasc'],
    drugClass: ['Calcium Channel Blocker', 'Antihypertensive'],
  }],
  ['penicillin', {
    rxcui: '7984',
    name: 'Penicillin V',
    genericName: 'Penicillin V Potassium',
    brandNames: ['Pen-Vee K', 'Veetids'],
    drugClass: ['Penicillin Antibiotic', 'Beta-Lactam'],
  }],
  ['amoxicillin', {
    rxcui: '723',
    name: 'Amoxicillin',
    genericName: 'Amoxicillin',
    brandNames: ['Amoxil', 'Trimox'],
    drugClass: ['Aminopenicillin', 'Beta-Lactam'],
  }],
  ['clopidogrel', {
    rxcui: '32968',
    name: 'Clopidogrel',
    genericName: 'Clopidogrel Bisulfate',
    brandNames: ['Plavix'],
    drugClass: ['Antiplatelet', 'P2Y12 Inhibitor'],
  }],
  ['potassium', {
    rxcui: '8591',
    name: 'Potassium Chloride',
    genericName: 'Potassium Chloride',
    brandNames: ['K-Dur', 'Klor-Con'],
    drugClass: ['Electrolyte Supplement'],
  }],
]);

// Mock drug interactions database
const DRUG_INTERACTIONS: DrugInteraction[] = [
  {
    drug1: DRUG_DATABASE.get('warfarin')!,
    drug2: DRUG_DATABASE.get('aspirin')!,
    severity: 'major',
    description: 'Concurrent use increases the risk of bleeding',
    mechanism: 'Additive anticoagulant/antiplatelet effects',
    clinicalConsequence: 'Increased risk of GI bleeding, intracranial hemorrhage, and other bleeding events',
    recommendation: 'If coadministration is necessary, monitor closely for signs of bleeding. Consider gastroprotection.',
    evidenceLevel: 'established',
  },
  {
    drug1: DRUG_DATABASE.get('warfarin')!,
    drug2: DRUG_DATABASE.get('ibuprofen')!,
    severity: 'major',
    description: 'NSAIDs increase the risk of bleeding when combined with warfarin',
    mechanism: 'NSAIDs inhibit platelet function and may cause GI mucosal damage',
    clinicalConsequence: 'Significantly increased risk of GI bleeding',
    recommendation: 'Avoid combination if possible. Use acetaminophen for pain when appropriate.',
    evidenceLevel: 'established',
  },
  {
    drug1: DRUG_DATABASE.get('lisinopril')!,
    drug2: DRUG_DATABASE.get('potassium')!,
    severity: 'major',
    description: 'ACE inhibitors increase potassium levels; adding potassium supplements may cause hyperkalemia',
    mechanism: 'ACE inhibitors reduce aldosterone secretion, decreasing potassium excretion',
    clinicalConsequence: 'Hyperkalemia can cause cardiac arrhythmias and may be fatal',
    recommendation: 'Monitor serum potassium levels closely. Avoid combination unless potassium is low.',
    evidenceLevel: 'established',
  },
  {
    drug1: DRUG_DATABASE.get('clopidogrel')!,
    drug2: DRUG_DATABASE.get('omeprazole')!,
    severity: 'moderate',
    description: 'Omeprazole may reduce the antiplatelet effect of clopidogrel',
    mechanism: 'CYP2C19 inhibition reduces conversion of clopidogrel to its active metabolite',
    clinicalConsequence: 'Reduced cardiovascular protection',
    recommendation: 'Consider pantoprazole as an alternative PPI or use H2 blocker',
    evidenceLevel: 'established',
  },
  {
    drug1: DRUG_DATABASE.get('simvastatin')!,
    drug2: DRUG_DATABASE.get('amlodipine')!,
    severity: 'moderate',
    description: 'Amlodipine increases simvastatin exposure, raising risk of myopathy',
    mechanism: 'CYP3A4 inhibition by amlodipine',
    clinicalConsequence: 'Increased risk of myopathy and rhabdomyolysis',
    recommendation: 'Limit simvastatin dose to 20mg daily when used with amlodipine',
    evidenceLevel: 'established',
  },
  {
    drug1: DRUG_DATABASE.get('metformin')!,
    drug2: DRUG_DATABASE.get('ibuprofen')!,
    severity: 'minor',
    description: 'NSAIDs may slightly affect renal function, potentially affecting metformin clearance',
    mechanism: 'NSAIDs reduce renal prostaglandin synthesis',
    clinicalConsequence: 'Usually minimal clinical significance in patients with normal renal function',
    recommendation: 'Monitor renal function in patients with renal impairment',
    evidenceLevel: 'theoretical',
  },
];

// Mock dosage ranges
const DOSAGE_RANGES: Record<string, { min: number; max: number; unit: string; frequency: string }> = {
  'warfarin': { min: 1, max: 10, unit: 'mg', frequency: 'daily' },
  'aspirin': { min: 81, max: 325, unit: 'mg', frequency: 'daily' },
  'lisinopril': { min: 2.5, max: 40, unit: 'mg', frequency: 'daily' },
  'metformin': { min: 500, max: 2550, unit: 'mg', frequency: 'daily' },
  'ibuprofen': { min: 200, max: 800, unit: 'mg', frequency: 'every 6-8 hours' },
  'omeprazole': { min: 20, max: 40, unit: 'mg', frequency: 'daily' },
  'simvastatin': { min: 5, max: 40, unit: 'mg', frequency: 'daily' },
  'amlodipine': { min: 2.5, max: 10, unit: 'mg', frequency: 'daily' },
};

// Mock formulary
const FORMULARY: Record<string, FormularyStatus> = {
  'lisinopril': {
    covered: true,
    tier: 1,
    priorAuthRequired: false,
    stepTherapyRequired: false,
    estimatedCopay: { amount: 5, currency: 'USD' },
  },
  'metformin': {
    covered: true,
    tier: 1,
    priorAuthRequired: false,
    stepTherapyRequired: false,
    estimatedCopay: { amount: 5, currency: 'USD' },
  },
  'simvastatin': {
    covered: true,
    tier: 2,
    priorAuthRequired: false,
    stepTherapyRequired: false,
    estimatedCopay: { amount: 15, currency: 'USD' },
  },
  'warfarin': {
    covered: true,
    tier: 2,
    priorAuthRequired: false,
    stepTherapyRequired: false,
    estimatedCopay: { amount: 10, currency: 'USD' },
  },
  'brand-drug-example': {
    covered: true,
    tier: 3,
    priorAuthRequired: true,
    stepTherapyRequired: true,
    quantityLimit: { quantity: 30, days: 30 },
    estimatedCopay: { amount: 50, currency: 'USD' },
    alternatives: [DRUG_DATABASE.get('simvastatin')!],
  },
};

// =============================================================================
// Pharmacy MCP Server
// =============================================================================

class PharmacyMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'pharmacy-mcp-server',
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
          name: 'check_drug_interactions',
          title: 'Check Drug Interactions',
          description: 'Check for drug-drug interactions between medications. Supports checking a new drug against existing medications or checking interactions within a medication list.',
          inputSchema: {
            type: 'object',
            properties: {
              newDrug: {
                type: 'string',
                description: 'Name of the new drug to check',
              },
              currentMedications: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of current medication names to check against',
              },
              patientId: {
                type: 'string',
                description: 'Optional patient ID to fetch current medications automatically',
              },
              includeMinor: {
                type: 'boolean',
                description: 'Include minor interactions in results',
                default: false,
              },
            },
            required: ['newDrug'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              interactions: { type: 'array' },
              hasSevereInteractions: { type: 'boolean' },
              safeToAdd: { type: 'boolean' },
              recommendations: { type: 'array', items: { type: 'string' } },
              _audit: { type: 'object' },
            },
          },
        },
        {
          name: 'get_medication_info',
          title: 'Get Medication Information',
          description: 'Get detailed information about a medication including drug class, brand names, and common uses',
          inputSchema: {
            type: 'object',
            properties: {
              drugName: {
                type: 'string',
                description: 'Name of the drug (generic or brand)',
              },
            },
            required: ['drugName'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              drug: { type: 'object' },
              _audit: { type: 'object' },
            },
          },
        },
        {
          name: 'check_dosage',
          title: 'Check Dosage',
          description: 'Verify if a prescribed dosage is within therapeutic range',
          inputSchema: {
            type: 'object',
            properties: {
              drugName: {
                type: 'string',
                description: 'Name of the drug',
              },
              dose: {
                type: 'number',
                description: 'Prescribed dose amount',
              },
              unit: {
                type: 'string',
                description: 'Dose unit (e.g., mg, mcg)',
              },
              frequency: {
                type: 'string',
                description: 'Dosing frequency (e.g., daily, twice daily)',
              },
              indication: {
                type: 'string',
                description: 'Indication for use (may affect dose range)',
              },
              patientFactors: {
                type: 'object',
                properties: {
                  age: { type: 'number' },
                  weight: { type: 'number' },
                  renalFunction: { type: 'string', enum: ['normal', 'mild-impairment', 'moderate-impairment', 'severe-impairment'] },
                  hepaticFunction: { type: 'string', enum: ['normal', 'mild-impairment', 'moderate-impairment', 'severe-impairment'] },
                },
                description: 'Patient-specific factors affecting dosing',
              },
            },
            required: ['drugName', 'dose', 'unit'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              appropriate: { type: 'boolean' },
              prescribedDose: { type: 'object' },
              recommendedRange: { type: 'object' },
              warnings: { type: 'array' },
              _audit: { type: 'object' },
            },
          },
        },
        {
          name: 'get_formulary_status',
          title: 'Get Formulary Status',
          description: 'Check insurance formulary coverage and tier for a medication',
          inputSchema: {
            type: 'object',
            properties: {
              drugName: {
                type: 'string',
                description: 'Name of the drug',
              },
              insurancePlan: {
                type: 'string',
                description: 'Insurance plan identifier (optional)',
              },
            },
            required: ['drugName'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              formularyStatus: { type: 'object' },
              alternatives: { type: 'array' },
              _audit: { type: 'object' },
            },
          },
        },
        {
          name: 'get_alternatives',
          title: 'Get Therapeutic Alternatives',
          description: 'Get therapeutic alternatives for a medication (same drug class or indication)',
          inputSchema: {
            type: 'object',
            properties: {
              drugName: {
                type: 'string',
                description: 'Name of the drug to find alternatives for',
              },
              reason: {
                type: 'string',
                enum: ['allergy', 'intolerance', 'cost', 'formulary', 'interaction'],
                description: 'Reason for seeking alternative',
              },
              avoidDrugClasses: {
                type: 'array',
                items: { type: 'string' },
                description: 'Drug classes to avoid (e.g., for allergy)',
              },
            },
            required: ['drugName'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              originalDrug: { type: 'object' },
              alternatives: { type: 'array' },
              _audit: { type: 'object' },
            },
          },
        },
        {
          name: 'verify_prescription',
          title: 'Verify Prescription',
          description: 'Verify a prescription is valid, not expired, and has refills remaining',
          inputSchema: {
            type: 'object',
            properties: {
              prescriptionId: {
                type: 'string',
                description: 'Prescription identifier',
              },
              patientId: {
                type: 'string',
                description: 'Patient ID for verification',
              },
            },
            required: ['prescriptionId', 'patientId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              valid: { type: 'boolean' },
              verification: { type: 'object' },
              issues: { type: 'array' },
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
          case 'check_drug_interactions':
            return await this.handleCheckDrugInteractions(args as any);
          case 'get_medication_info':
            return await this.handleGetMedicationInfo(args as any);
          case 'check_dosage':
            return await this.handleCheckDosage(args as any);
          case 'get_formulary_status':
            return await this.handleGetFormularyStatus(args as any);
          case 'get_alternatives':
            return await this.handleGetAlternatives(args as any);
          case 'verify_prescription':
            return await this.handleVerifyPrescription(args as any);
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
            uri: 'drug://formulary',
            name: 'formulary_list',
            title: 'Insurance Formulary',
            description: 'Current insurance formulary drug list with tiers',
            mimeType: 'application/json',
            _meta: {
              dataClassification: 'internal',
              updateFrequency: 'quarterly',
            },
          },
          {
            uri: 'drug://interactions-database',
            name: 'interactions_database',
            title: 'Drug Interactions Database',
            description: 'Known drug-drug interactions database',
            mimeType: 'application/json',
            _meta: {
              dataClassification: 'public',
              source: 'Clinical Database (Mock)',
              lastUpdated: '2025-11-01',
            },
          },
        ],
      };
    });

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;

      if (uri === 'drug://formulary') {
        const formularyList = Object.entries(FORMULARY).map(([drug, status]) => ({
          drug,
          ...status,
        }));

        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(formularyList, null, 2),
            _meta: {
              generatedAt: new Date().toISOString(),
              recordCount: formularyList.length,
            },
          }],
        };
      }

      if (uri === 'drug://interactions-database') {
        const interactionsSummary = DRUG_INTERACTIONS.map(i => ({
          drug1: i.drug1.name,
          drug2: i.drug2.name,
          severity: i.severity,
          description: i.description,
        }));

        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(interactionsSummary, null, 2),
            _meta: {
              generatedAt: new Date().toISOString(),
              recordCount: interactionsSummary.length,
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

  private async handleCheckDrugInteractions(args: {
    newDrug: string;
    currentMedications?: string[];
    patientId?: string;
    includeMinor?: boolean;
  }) {
    const { newDrug, currentMedications = [], includeMinor = false } = args;

    const newDrugLower = newDrug.toLowerCase();
    const newDrugInfo = DRUG_DATABASE.get(newDrugLower);

    if (!newDrugInfo) {
      throw new Error(`Drug not found in database: ${newDrug}`);
    }

    // Find interactions
    const interactions: DrugInteraction[] = [];
    for (const med of currentMedications) {
      const medLower = med.toLowerCase();
      const medInfo = DRUG_DATABASE.get(medLower);

      if (!medInfo) continue;

      // Check both directions of interaction
      for (const interaction of DRUG_INTERACTIONS) {
        const matchesNewToMed =
          interaction.drug1.name.toLowerCase() === newDrugLower &&
          interaction.drug2.name.toLowerCase() === medLower;
        const matchesMedToNew =
          interaction.drug1.name.toLowerCase() === medLower &&
          interaction.drug2.name.toLowerCase() === newDrugLower;

        if (matchesNewToMed || matchesMedToNew) {
          if (includeMinor || interaction.severity !== 'minor') {
            interactions.push(interaction);
          }
        }
      }
    }

    const hasSevereInteractions = interactions.some(
      i => i.severity === 'contraindicated' || i.severity === 'major'
    );

    const safeToAdd = !interactions.some(i => i.severity === 'contraindicated');

    const recommendations: string[] = [];
    if (interactions.length === 0) {
      recommendations.push('No significant interactions detected. Safe to add.');
    } else {
      for (const interaction of interactions) {
        recommendations.push(interaction.recommendation);
      }
      if (hasSevereInteractions) {
        recommendations.push('CLINICAL REVIEW REQUIRED: Major interactions detected.');
      }
    }

    const audit = createAuditMetadata(
      ['drugInteractions', 'newDrug', 'currentMedications'],
      {
        dataClassification: 'confidential',
        purpose: 'medication-safety-check',
      }
    );

    const structured = {
      success: true,
      newDrug: newDrugInfo,
      interactions: interactions.map(i => ({
        drug1: i.drug1.name,
        drug2: i.drug2.name,
        severity: i.severity,
        description: i.description,
        recommendation: i.recommendation,
        evidenceLevel: i.evidenceLevel,
      })),
      hasSevereInteractions,
      safeToAdd,
      recommendations,
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    // Build text response
    let textResponse = `Drug Interaction Check: ${newDrug}\n`;
    textResponse += `Checked against: ${currentMedications.join(', ')}\n\n`;

    if (interactions.length === 0) {
      textResponse += 'No significant interactions found.\n';
    } else {
      textResponse += `Found ${interactions.length} interaction(s):\n`;
      for (const i of interactions) {
        const severityEmoji =
          i.severity === 'contraindicated' ? '🛑' :
          i.severity === 'major' ? '🔴' :
          i.severity === 'moderate' ? '🟡' : '🟢';
        textResponse += `\n${severityEmoji} ${i.severity.toUpperCase()}: ${i.drug1.name} + ${i.drug2.name}\n`;
        textResponse += `   ${i.description}\n`;
        textResponse += `   → ${i.recommendation}\n`;
      }
    }

    textResponse += `\nSafe to add: ${safeToAdd ? 'Yes' : 'No - requires clinical review'}`;

    return {
      content: [{ type: 'text', text: textResponse }],
      structuredContent: structured,
    };
  }

  private async handleGetMedicationInfo(args: { drugName: string }) {
    const { drugName } = args;
    const drug = DRUG_DATABASE.get(drugName.toLowerCase());

    if (!drug) {
      throw new Error(`Drug not found: ${drugName}`);
    }

    const audit = createAuditMetadata(
      ['drugInfo'],
      {
        dataClassification: 'public',
        purpose: 'drug-information',
      }
    );

    const structured = {
      success: true,
      drug: {
        ...drug,
        dosageRange: DOSAGE_RANGES[drugName.toLowerCase()],
      },
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    let textResponse = `Medication: ${drug.name}\n`;
    textResponse += `Generic: ${drug.genericName}\n`;
    textResponse += `Brand Names: ${drug.brandNames?.join(', ') || 'N/A'}\n`;
    textResponse += `Drug Class: ${drug.drugClass?.join(', ') || 'N/A'}\n`;

    const dosage = DOSAGE_RANGES[drugName.toLowerCase()];
    if (dosage) {
      textResponse += `Dosage Range: ${dosage.min}-${dosage.max} ${dosage.unit} ${dosage.frequency}`;
    }

    return {
      content: [{ type: 'text', text: textResponse }],
      structuredContent: structured,
    };
  }

  private async handleCheckDosage(args: {
    drugName: string;
    dose: number;
    unit: string;
    frequency?: string;
    indication?: string;
    patientFactors?: {
      age?: number;
      weight?: number;
      renalFunction?: string;
      hepaticFunction?: string;
    };
  }) {
    const { drugName, dose, unit, frequency, indication, patientFactors } = args;

    const drugLower = drugName.toLowerCase();
    const range = DOSAGE_RANGES[drugLower];

    if (!range) {
      throw new Error(`Dosage information not available for: ${drugName}`);
    }

    const warnings: string[] = [];
    let appropriate = true;

    // Check if dose is within range
    if (dose < range.min) {
      warnings.push(`Dose ${dose}${unit} is below minimum therapeutic dose of ${range.min}${range.unit}`);
      appropriate = false;
    } else if (dose > range.max) {
      warnings.push(`Dose ${dose}${unit} exceeds maximum recommended dose of ${range.max}${range.unit}`);
      appropriate = false;
    }

    // Check patient factors
    if (patientFactors) {
      if (patientFactors.age && patientFactors.age >= 65) {
        warnings.push('Elderly patient: Consider starting at lower end of dose range');
      }
      if (patientFactors.renalFunction && patientFactors.renalFunction !== 'normal') {
        if (['metformin', 'lisinopril'].includes(drugLower)) {
          warnings.push(`Renal impairment: Dose adjustment may be required for ${drugName}`);
        }
      }
      if (patientFactors.hepaticFunction && patientFactors.hepaticFunction !== 'normal') {
        if (['simvastatin', 'warfarin'].includes(drugLower)) {
          warnings.push(`Hepatic impairment: Monitor closely and consider dose reduction for ${drugName}`);
        }
      }
    }

    const audit = createAuditMetadata(
      ['dosageCheck', 'prescribedDose', 'patientFactors'],
      {
        dataClassification: 'confidential',
        purpose: 'dosage-verification',
      }
    );

    const structured: DosageCheck & { _audit: any; timestamp: string; success: boolean } = {
      success: true,
      appropriate,
      prescribedDose: { value: dose, unit },
      recommendedRange: {
        min: { value: range.min, unit: range.unit },
        max: { value: range.max, unit: range.unit },
      },
      indication,
      patientFactors: patientFactors ? Object.entries(patientFactors).map(([k, v]) => `${k}: ${v}`) : undefined,
      warnings,
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    let textResponse = `Dosage Check: ${drugName} ${dose}${unit}\n`;
    textResponse += `Recommended Range: ${range.min}-${range.max}${range.unit} ${range.frequency}\n`;
    textResponse += `Status: ${appropriate ? 'APPROPRIATE' : 'REQUIRES REVIEW'}\n`;

    if (warnings.length > 0) {
      textResponse += `\nWarnings:\n${warnings.map(w => `⚠️ ${w}`).join('\n')}`;
    }

    return {
      content: [{ type: 'text', text: textResponse }],
      structuredContent: structured,
    };
  }

  private async handleGetFormularyStatus(args: { drugName: string; insurancePlan?: string }) {
    const { drugName } = args;
    const drugLower = drugName.toLowerCase();

    const status = FORMULARY[drugLower] || {
      covered: false,
      priorAuthRequired: true,
      stepTherapyRequired: false,
    };

    const audit = createAuditMetadata(
      ['formularyStatus', 'coverage', 'tier'],
      {
        dataClassification: 'internal',
        purpose: 'formulary-check',
      }
    );

    const structured = {
      success: true,
      drug: drugName,
      formularyStatus: status,
      alternatives: status.alternatives?.map(a => ({
        name: a.name,
        genericName: a.genericName,
      })),
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    let textResponse = `Formulary Status: ${drugName}\n`;
    textResponse += `Covered: ${status.covered ? 'Yes' : 'No'}\n`;

    if (status.covered) {
      textResponse += `Tier: ${status.tier}\n`;
      if (status.estimatedCopay) {
        textResponse += `Estimated Copay: $${status.estimatedCopay.amount}\n`;
      }
      if (status.priorAuthRequired) {
        textResponse += `Prior Authorization: Required\n`;
      }
      if (status.stepTherapyRequired) {
        textResponse += `Step Therapy: Required\n`;
      }
      if (status.quantityLimit) {
        textResponse += `Quantity Limit: ${status.quantityLimit.quantity} per ${status.quantityLimit.days} days\n`;
      }
    }

    if (status.alternatives && status.alternatives.length > 0) {
      textResponse += `\nFormulary Alternatives:\n${status.alternatives.map(a => `- ${a.name}`).join('\n')}`;
    }

    return {
      content: [{ type: 'text', text: textResponse }],
      structuredContent: structured,
    };
  }

  private async handleGetAlternatives(args: {
    drugName: string;
    reason?: string;
    avoidDrugClasses?: string[];
  }) {
    const { drugName, reason, avoidDrugClasses = [] } = args;
    const drugLower = drugName.toLowerCase();

    const originalDrug = DRUG_DATABASE.get(drugLower);
    if (!originalDrug) {
      throw new Error(`Drug not found: ${drugName}`);
    }

    // Find alternatives in same drug class
    const alternatives: DrugInfo[] = [];
    const originalClasses = originalDrug.drugClass || [];

    for (const [name, drug] of DRUG_DATABASE) {
      if (name === drugLower) continue;

      // Check if any class matches
      const hasMatchingClass = drug.drugClass?.some(dc =>
        originalClasses.some(oc => dc.toLowerCase().includes(oc.toLowerCase()) || oc.toLowerCase().includes(dc.toLowerCase()))
      );

      // Check if should avoid
      const shouldAvoid = drug.drugClass?.some(dc =>
        avoidDrugClasses.some(avoid => dc.toLowerCase().includes(avoid.toLowerCase()))
      );

      if (hasMatchingClass && !shouldAvoid) {
        alternatives.push(drug);
      }
    }

    const audit = createAuditMetadata(
      ['drugAlternatives', 'drugClass'],
      {
        dataClassification: 'internal',
        purpose: 'therapeutic-alternatives',
      }
    );

    const structured = {
      success: true,
      originalDrug: {
        name: originalDrug.name,
        genericName: originalDrug.genericName,
        drugClass: originalDrug.drugClass,
      },
      reason,
      alternatives: alternatives.map(a => ({
        name: a.name,
        genericName: a.genericName,
        drugClass: a.drugClass,
        formularyStatus: FORMULARY[a.name.toLowerCase()]?.covered ? 'On Formulary' : 'Not on Formulary',
      })),
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    let textResponse = `Therapeutic Alternatives for ${drugName}`;
    if (reason) {
      textResponse += ` (Reason: ${reason})`;
    }
    textResponse += `\n\nOriginal Drug Class: ${originalDrug.drugClass?.join(', ')}\n\n`;

    if (alternatives.length === 0) {
      textResponse += 'No alternatives found in the same drug class.';
    } else {
      textResponse += `Alternatives (${alternatives.length}):\n`;
      for (const alt of alternatives) {
        const onFormulary = FORMULARY[alt.name.toLowerCase()]?.covered;
        textResponse += `- ${alt.name} (${alt.genericName}) ${onFormulary ? '✓ On Formulary' : ''}\n`;
      }
    }

    return {
      content: [{ type: 'text', text: textResponse }],
      structuredContent: structured,
    };
  }

  private async handleVerifyPrescription(args: { prescriptionId: string; patientId: string }) {
    const { prescriptionId, patientId } = args;

    // Mock prescription verification
    const mockVerification: PrescriptionVerification = {
      valid: true,
      prescriptionId,
      patientId,
      medication: DRUG_DATABASE.get('metformin')!,
      prescriber: { reference: 'Practitioner/DR001', display: 'Dr. Sarah Smith' },
      prescribedDate: '2025-10-15',
      expirationDate: '2026-10-15',
      refillsRemaining: 3,
      quantityPrescribed: 90,
      daysSupply: 30,
      issues: [],
    };

    // Add some mock issues for certain prescription IDs
    if (prescriptionId.includes('expired')) {
      mockVerification.valid = false;
      mockVerification.expirationDate = '2025-06-01';
      mockVerification.issues = [{
        type: 'expired',
        severity: 'error',
        message: 'Prescription has expired. New prescription required.',
      }];
    }

    if (prescriptionId.includes('no-refills')) {
      mockVerification.valid = false;
      mockVerification.refillsRemaining = 0;
      mockVerification.issues = [{
        type: 'no-refills',
        severity: 'error',
        message: 'No refills remaining. Contact prescriber.',
      }];
    }

    const audit = createAuditMetadata(
      ['prescriptionVerification', 'prescriptionId', 'patientId'],
      {
        dataClassification: 'restricted',
        purpose: 'prescription-dispensing',
        complianceContext: {
          hipaaCategory: 'treatment',
          minimumNecessary: true,
          breakGlass: false,
        },
      }
    );

    const structured = {
      success: true,
      valid: mockVerification.valid,
      verification: {
        prescriptionId: mockVerification.prescriptionId,
        patientId: mockVerification.patientId,
        medication: mockVerification.medication.name,
        prescriber: mockVerification.prescriber.display,
        prescribedDate: mockVerification.prescribedDate,
        expirationDate: mockVerification.expirationDate,
        refillsRemaining: mockVerification.refillsRemaining,
        quantityPrescribed: mockVerification.quantityPrescribed,
        daysSupply: mockVerification.daysSupply,
      },
      issues: mockVerification.issues,
      timestamp: new Date().toISOString(),
      _audit: audit,
    };

    let textResponse = `Prescription Verification: ${prescriptionId}\n`;
    textResponse += `Status: ${mockVerification.valid ? '✓ VALID' : '✗ INVALID'}\n\n`;
    textResponse += `Medication: ${mockVerification.medication.name}\n`;
    textResponse += `Prescriber: ${mockVerification.prescriber.display}\n`;
    textResponse += `Prescribed: ${mockVerification.prescribedDate}\n`;
    textResponse += `Expires: ${mockVerification.expirationDate}\n`;
    textResponse += `Refills Remaining: ${mockVerification.refillsRemaining}\n`;
    textResponse += `Quantity: ${mockVerification.quantityPrescribed} (${mockVerification.daysSupply} day supply)\n`;

    if (mockVerification.issues && mockVerification.issues.length > 0) {
      textResponse += `\nIssues:\n`;
      for (const issue of mockVerification.issues) {
        const icon = issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : 'ℹ️';
        textResponse += `${icon} ${issue.message}\n`;
      }
    }

    return {
      content: [{ type: 'text', text: textResponse }],
      structuredContent: structured,
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('Pharmacy MCP Server started');
    console.error('Tools: check_drug_interactions, get_medication_info, check_dosage, get_formulary_status, get_alternatives, verify_prescription');
  }
}

// Start the server
const server = new PharmacyMCPServer();
server.start().catch((error) => {
  console.error('Failed to start Pharmacy MCP Server:', error);
  process.exit(1);
});
