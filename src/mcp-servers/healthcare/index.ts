/**
 * Healthcare MCP Servers
 *
 * A collection of healthcare domain MCP servers demonstrating
 * MCP enhancements including policy-aware execution, structured
 * audit trails, consent-aware access, and HIPAA compliance patterns.
 *
 * Servers:
 * - patient-records-server: FHIR-compliant patient data access
 * - pharmacy-server: Medication management with drug interactions
 * - clinical-workflow-server: Care coordination and scheduling
 *
 * Usage:
 * ```bash
 * # Run individual servers
 * node dist/mcp-servers/healthcare/patient-records-server.js
 * node dist/mcp-servers/healthcare/pharmacy-server.js
 * node dist/mcp-servers/healthcare/clinical-workflow-server.js
 * ```
 */

// Re-export types
export * from './types/healthcare.js';
