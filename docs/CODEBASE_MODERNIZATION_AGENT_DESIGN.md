# Autonomous Codebase Modernization Agent System

## Research & Design Document

Based on analysis of the [Two-Agent Autonomous Coding System](https://github.com/chief-builder/two-agent-autonomous-coding-setup), this document outlines the design for a multi-agent system specialized for maintaining, refactoring, and modernizing existing codebases.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Multi-Agent Architecture](#multi-agent-architecture)
4. [Core Use Cases](#core-use-cases)
5. [Agent Specifications](#agent-specifications)
6. [Workflow Orchestration](#workflow-orchestration)
7. [Data Structures & Artifacts](#data-structures--artifacts)
8. [Security Model](#security-model)
9. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

The **Codebase Modernization Agent System** extends the two-agent autonomous coding pattern to handle the unique challenges of working with existing codebases. Unlike greenfield development, modernization requires:

- **Understanding before changing**: Deep analysis of existing functionality
- **Preservation of behavior**: Ensuring changes don't break existing features
- **Incremental transformation**: Safe, reversible migration steps
- **Multi-modal validation**: Both static analysis and runtime verification

### Key Differentiators from Greenfield Agent

| Aspect | Greenfield Agent | Modernization Agent |
|--------|------------------|---------------------|
| Starting point | Specification | Existing codebase |
| Source of truth | feature_list.json | functionality_map.json + test_coverage.json |
| Validation | Build new tests | Discover & preserve existing behavior |
| Risk model | Low (new code) | High (breaking changes) |
| Session types | Initializer → Coding | Discovery → Analysis → Testing → Transformation |

---

## System Overview

### Design Philosophy

1. **Understand First, Change Second**: Never modify code without documented understanding
2. **Test Before Transform**: Establish behavioral anchors before refactoring
3. **Reversible Steps**: Every transformation should be revertible
4. **Human-in-the-Loop**: Critical decisions require approval gates

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR AGENT                           │
│  (Opus 4.5 - Planning, Decision Making, State Management)       │
└─────────────────────────────────────────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────────┐
│  DISCOVERY  │      │  ANALYSIS   │      │ TRANSFORMATION  │
│   AGENTS    │      │   AGENTS    │      │     AGENTS      │
└─────────────┘      └─────────────┘      └─────────────────┘
       │                      │                      │
       ▼                      ▼                      ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────────┐
│ Codebase    │      │ Dependency  │      │ Refactoring     │
│ Explorer    │      │ Analyzer    │      │ Agent           │
├─────────────┤      ├─────────────┤      ├─────────────────┤
│ Runtime     │      │ Pattern     │      │ Migration       │
│ Observer    │      │ Detector    │      │ Agent           │
├─────────────┤      ├─────────────┤      ├─────────────────┤
│ API         │      │ Test Gap    │      │ Test Writer     │
│ Discoverer  │      │ Analyzer    │      │ Agent           │
└─────────────┘      └─────────────┘      └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   VALIDATION    │
                    │     AGENTS      │
                    └─────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────────┐
│ Regression  │      │ Behavior    │      │ Performance     │
│ Tester      │      │ Comparator  │      │ Validator       │
└─────────────┘      └─────────────┘      └─────────────────┘
```

---

## Multi-Agent Architecture

### Agent Hierarchy & Model Selection

Following the cost optimization principles from the original system:

| Agent Type | Model | Reasoning Budget | Role |
|------------|-------|-----------------|------|
| Orchestrator | Opus 4.5 | High | Strategy, state management, approval gates |
| Discovery | Sonnet 4.5 | Medium | Codebase exploration, documentation |
| Analysis | Sonnet 4.5 | Medium-High | Pattern detection, dependency analysis |
| Transformation | Sonnet 4.5 | Medium | Code refactoring, migration |
| Validation | Haiku 4.5 | Low | Test execution, comparison |
| Workers | Haiku 4.5 | Low | File operations, simple transformations |

### Inter-Agent Communication

Agents communicate through shared artifacts in the project directory:

```
project_root/
├── .modernization/
│   ├── state.json              # Current orchestration state
│   ├── functionality_map.json  # Discovered features
│   ├── test_coverage.json      # Test coverage mapping
│   ├── dependency_graph.json   # Module dependencies
│   ├── transformation_plan.json # Planned changes
│   ├── validation_results.json # Test results
│   └── sessions/
│       ├── session_001.json    # Session transcripts
│       └── ...
└── ... (original codebase)
```

---

## Core Use Cases

### Use Case 1: Functionality Documentation

**Goal**: Create comprehensive documentation of existing system behavior through code analysis AND runtime observation.

#### Workflow

```
Session 1: Static Discovery
├── Parse all source files
├── Identify entry points (main, exports, routes)
├── Map function call graphs
├── Extract inline documentation
├── Identify API endpoints
└── Generate initial functionality_map.json

Session 2: Runtime Discovery
├── Start application (dev/prod mode)
├── Exercise discovered endpoints via browser automation
├── Capture request/response pairs
├── Record UI interactions and state changes
├── Screenshot key application states
└── Enrich functionality_map.json with runtime data

Session 3: Documentation Generation
├── Cross-reference static and runtime discoveries
├── Identify undocumented behaviors
├── Generate human-readable documentation
├── Create architecture diagrams (Mermaid)
└── Produce API documentation (OpenAPI if applicable)
```

#### Functionality Map Schema

```json
{
  "version": "1.0.0",
  "discovered_at": "2025-12-02T10:00:00Z",
  "source_analysis": {
    "language": "python",
    "framework": "flask",
    "entry_points": ["app.py:main"],
    "total_files": 45,
    "total_lines": 12500
  },
  "features": [
    {
      "id": "F001",
      "name": "User Authentication",
      "category": "security",
      "discovery_method": "static+runtime",
      "source_locations": [
        {"file": "auth/login.py", "lines": [15, 85]},
        {"file": "auth/middleware.py", "lines": [10, 50]}
      ],
      "api_endpoints": [
        {"method": "POST", "path": "/api/auth/login"},
        {"method": "POST", "path": "/api/auth/logout"}
      ],
      "ui_components": [
        {"type": "form", "id": "login-form", "screenshot": "screenshots/login.png"}
      ],
      "dependencies": ["F002", "F010"],
      "test_coverage": {
        "has_tests": true,
        "test_files": ["tests/test_auth.py"],
        "coverage_percent": 75
      },
      "documentation": {
        "inline_docs": true,
        "readme_section": false,
        "api_docs": true
      },
      "behavioral_notes": "Supports OAuth2 and local auth. Session timeout: 30min."
    }
  ],
  "undocumented_behaviors": [
    {
      "description": "Rate limiting on /api/auth/login after 5 failures",
      "discovered_via": "runtime",
      "evidence": "screenshots/rate-limit.png"
    }
  ]
}
```

---

### Use Case 2: Test Coverage Completion

**Goal**: Ensure comprehensive test coverage for all discovered functionality.

#### Workflow

```
Session 1: Coverage Analysis
├── Run existing test suite with coverage
├── Parse coverage reports (lcov, coverage.py, etc.)
├── Map coverage to functionality_map features
├── Identify gaps (0% coverage features)
├── Prioritize by risk (critical paths first)
└── Generate test_gap_analysis.json

Session 2+: Test Generation (iterative)
├── Select highest-priority untested feature
├── Analyze feature implementation
├── Generate test cases:
│   ├── Unit tests for functions
│   ├── Integration tests for APIs
│   ├── E2E tests for UI flows
├── Run generated tests
├── Fix failures (tests or implementation bugs found)
├── Update coverage mapping
└── Commit and continue to next feature
```

#### Test Coverage Schema

```json
{
  "version": "1.0.0",
  "analyzed_at": "2025-12-02T12:00:00Z",
  "overall_coverage": {
    "line_coverage": 65.5,
    "branch_coverage": 58.2,
    "function_coverage": 72.0
  },
  "by_feature": [
    {
      "feature_id": "F001",
      "feature_name": "User Authentication",
      "coverage": {
        "line": 75,
        "branch": 60,
        "function": 80
      },
      "test_files": ["tests/test_auth.py"],
      "gaps": [
        {
          "file": "auth/login.py",
          "uncovered_lines": [45, 46, 47, 78, 79],
          "description": "Error handling for invalid tokens"
        }
      ],
      "priority": "high",
      "tests_generated": false
    }
  ],
  "untested_features": ["F015", "F022", "F023"],
  "generation_queue": [
    {"feature_id": "F001", "priority": 1, "estimated_tests": 5},
    {"feature_id": "F015", "priority": 2, "estimated_tests": 10}
  ]
}
```

---

### Use Case 3: Iterative Enhancement

**Goal**: Add new features while preserving existing functionality.

This closely mirrors the existing Enhancer Agent pattern, with additional safeguards:

#### Workflow

```
Session 1: Enhancement Planning
├── Read enhancement_spec.txt
├── Load functionality_map.json
├── Identify affected existing features
├── Run full test suite (baseline)
├── Generate enhancement_plan.json
└── Create feature entries (continuing IDs)

Session 2+: Implementation (iterative)
├── Select next enhancement task
├── Implement changes
├── Run affected feature tests
├── Run full regression suite
├── If regressions:
│   ├── Analyze failure
│   ├── Fix regression OR rollback
│   └── Document decision
├── Update functionality_map.json
├── Commit with descriptive message
└── Continue to next task
```

#### Enhancement Plan Schema

```json
{
  "version": "1.0.0",
  "created_at": "2025-12-02T14:00:00Z",
  "enhancement_spec": "enhancement_spec.txt",
  "baseline_test_results": {
    "total": 150,
    "passed": 148,
    "failed": 2,
    "skipped": 0
  },
  "enhancements": [
    {
      "id": "E001",
      "title": "Add Two-Factor Authentication",
      "description": "Implement TOTP-based 2FA for user accounts",
      "affected_features": ["F001", "F002", "F005"],
      "new_features": ["F050", "F051"],
      "implementation_steps": [
        "Add TOTP library dependency",
        "Create 2FA setup flow UI",
        "Modify login flow to check 2FA",
        "Add recovery codes mechanism"
      ],
      "risk_level": "high",
      "requires_approval": true,
      "status": "pending"
    }
  ]
}
```

---

### Use Case 4: Tech Stack Migration

**Goal**: Completely rewrite the system in a different technology stack while preserving all functionality.

This is the most complex use case, requiring careful orchestration:

#### Migration Philosophy

1. **Behavior Preservation**: The new system must exhibit identical external behavior
2. **Parallel Running**: Old and new systems run side-by-side for comparison
3. **Feature-by-Feature**: Migrate incrementally, validating each step
4. **API Compatibility**: Maintain identical API contracts during transition
5. **Data Compatibility**: Handle data migration/compatibility

#### Workflow

```
Phase 1: Preparation (Sessions 1-3)
├── Session 1: Deep Discovery
│   ├── Complete functionality mapping
│   ├── Document all APIs (OpenAPI spec)
│   ├── Document all data models
│   ├── Capture behavioral tests
│   └── Generate golden test data
│
├── Session 2: Migration Planning
│   ├── Analyze source tech stack
│   ├── Map to target tech stack equivalents
│   ├── Identify migration challenges
│   ├── Create migration_plan.json
│   └── Establish validation criteria
│
└── Session 3: Scaffold Target Project
    ├── Initialize target project structure
    ├── Set up equivalent tooling
    ├── Configure CI/CD for both projects
    └── Create behavioral test harness

Phase 2: Migration (Sessions 4-N)
├── For each feature in priority order:
│   ├── Implement in target stack
│   ├── Run behavioral comparison tests
│   ├── Run performance comparison
│   ├── Document any intentional differences
│   └── Update migration_status.json

Phase 3: Validation (Sessions N+1 to N+3)
├── Full behavioral regression suite
├── Performance benchmarking
├── Security audit of new implementation
├── Data migration testing
└── Generate migration report

Phase 4: Cutover (Requires Human Approval)
├── Final validation in staging
├── Data migration execution
├── Traffic switching strategy
└── Rollback plan documentation
```

#### Migration Plan Schema

```json
{
  "version": "1.0.0",
  "created_at": "2025-12-02T16:00:00Z",
  "source": {
    "language": "python",
    "version": "3.9",
    "framework": "flask",
    "database": "postgresql",
    "key_dependencies": [
      {"name": "sqlalchemy", "version": "1.4"},
      {"name": "celery", "version": "5.2"}
    ]
  },
  "target": {
    "language": "go",
    "version": "1.21",
    "framework": "gin",
    "database": "postgresql",
    "equivalent_dependencies": [
      {"source": "sqlalchemy", "target": "gorm"},
      {"source": "celery", "target": "asynq"}
    ]
  },
  "feature_migration": [
    {
      "feature_id": "F001",
      "feature_name": "User Authentication",
      "complexity": "high",
      "migration_strategy": "rewrite",
      "target_files": ["internal/auth/handler.go", "internal/auth/service.go"],
      "validation": {
        "behavioral_tests": ["tests/behavioral/auth_test.go"],
        "api_compatibility": true,
        "performance_baseline": {"p99_latency_ms": 50}
      },
      "status": "pending",
      "notes": "Go's crypto libraries have different API; need custom wrapper"
    }
  ],
  "data_migration": {
    "strategy": "dual-write",
    "tables": [
      {"name": "users", "records": 50000, "strategy": "bulk_copy"},
      {"name": "sessions", "records": 10000, "strategy": "skip_historical"}
    ]
  },
  "risk_assessment": {
    "high_risk_features": ["F010", "F015"],
    "mitigation_strategies": [
      "Implement feature flags for gradual rollout",
      "Maintain source system for 30 days post-migration"
    ]
  }
}
```

---

## Agent Specifications

### 1. Orchestrator Agent (Opus 4.5)

**Role**: Central coordinator managing workflow state and making strategic decisions.

**Capabilities**:
- Load and validate project state
- Select next workflow phase
- Delegate tasks to specialized agents
- Handle approval gates
- Manage error recovery

**Prompt Template**:
```markdown
# Codebase Modernization Orchestrator

You are the orchestrator for an autonomous codebase modernization system.
Your role is to coordinate specialized agents to safely transform codebases.

## Current State
- Project: {project_path}
- Mode: {mode} (discovery|coverage|enhancement|migration)
- Phase: {current_phase}
- Progress: {completed_tasks}/{total_tasks}

## Your Responsibilities
1. Load and validate .modernization/state.json
2. Determine the next appropriate action
3. Delegate to specialized agents
4. Validate results before proceeding
5. Handle errors and edge cases
6. Request human approval for high-risk operations

## Decision Framework
- Discovery phase incomplete? → Delegate to Discovery Agent
- Coverage gaps exist? → Delegate to Test Writer Agent
- Enhancement pending? → Delegate to Refactoring Agent
- Migration in progress? → Coordinate Migration Agent

## Critical Rules
- NEVER proceed without baseline test results
- ALWAYS commit after successful validations
- STOP and request approval for destructive operations
- DOCUMENT all decisions in session logs
```

### 2. Discovery Agent (Sonnet 4.5)

**Role**: Explore and document existing codebase through static and runtime analysis.

**Prompt Template**:
```markdown
# Codebase Discovery Agent

You are analyzing an existing codebase to create comprehensive documentation.

## Your Mission
Create a complete functionality_map.json by:

1. **Static Analysis**
   - Parse all source files
   - Identify language, framework, patterns
   - Map module dependencies
   - Extract API endpoints
   - Find entry points

2. **Runtime Analysis** (if applicable)
   - Start the application
   - Exercise discovered endpoints
   - Capture request/response data
   - Screenshot UI states
   - Observe state transitions

## Output Requirements
- Generate functionality_map.json with all discovered features
- Each feature must have:
  - Unique ID continuing from existing IDs
  - Source locations (file:line)
  - Dependencies on other features
  - API endpoints (if any)
  - Test coverage status
  - Behavioral notes

## Critical Rules
- NEVER modify source code
- ONLY read and observe
- DOCUMENT everything discovered
- NOTE any anomalies or undocumented behaviors
```

### 3. Test Writer Agent (Sonnet 4.5)

**Role**: Generate tests for uncovered functionality.

**Prompt Template**:
```markdown
# Test Coverage Agent

You are generating tests to achieve comprehensive coverage.

## Current Coverage Status
{coverage_summary}

## Your Mission
For each untested feature in priority order:

1. **Analyze** the feature implementation
2. **Design** appropriate test cases:
   - Unit tests for pure functions
   - Integration tests for API endpoints
   - E2E tests for UI workflows
3. **Generate** test code following project conventions
4. **Execute** tests to verify they pass
5. **Update** test_coverage.json

## Test Design Principles
- Test behavior, not implementation
- Cover happy paths AND edge cases
- Include error scenarios
- Make tests deterministic
- Follow existing test patterns in the codebase

## Output
- New test files matching project structure
- Updated test_coverage.json
- Session notes documenting decisions
```

### 4. Migration Agent (Sonnet 4.5)

**Role**: Execute tech stack migration feature by feature.

**Prompt Template**:
```markdown
# Tech Stack Migration Agent

You are migrating functionality from {source_stack} to {target_stack}.

## Current Migration Status
{migration_status}

## Your Mission
For each feature in migration_plan.json:

1. **Study** the source implementation thoroughly
2. **Implement** equivalent functionality in target stack
3. **Write** behavioral comparison tests
4. **Validate** against golden test data
5. **Document** any intentional differences

## Migration Principles
- EXACT behavioral parity is required
- Performance should meet or exceed baseline
- API contracts must be identical
- Data formats must be compatible
- Document all architectural decisions

## Validation Requirements
- All behavioral tests must pass
- API response comparison must match
- Performance within acceptable bounds
- Security review for sensitive features

## Output
- Target implementation files
- Behavioral comparison tests
- Updated migration_status.json
- Session notes with decisions and rationale
```

---

## Workflow Orchestration

### State Machine

```
                    ┌─────────────────┐
                    │   INITIALIZE    │
                    │  Load project   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │    DISCOVERY    │◄──────────────┐
                    │ Analyze codebase│               │
                    └────────┬────────┘               │
                             │                        │
              ┌──────────────┴──────────────┐         │
              ▼                             ▼         │
    ┌─────────────────┐           ┌─────────────────┐ │
    │    COVERAGE     │           │   ENHANCEMENT   │ │
    │ Generate tests  │           │  Add features   │ │
    └────────┬────────┘           └────────┬────────┘ │
             │                             │          │
             └──────────────┬──────────────┘          │
                            ▼                         │
                   ┌─────────────────┐                │
                   │    MIGRATION    │────────────────┘
                   │ Transform stack │    (re-discover)
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │   VALIDATION    │
                   │  Final checks   │
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │    COMPLETE     │
                   │   Report done   │
                   └─────────────────┘
```

### Session Persistence

Following the pattern from the original two-agent system:

```typescript
interface ModernizationState {
  version: string;
  project_path: string;
  mode: 'discovery' | 'coverage' | 'enhancement' | 'migration';
  current_phase: string;
  session_number: number;

  // Progress tracking
  discovery_complete: boolean;
  coverage_target: number;
  current_coverage: number;

  // Migration specific
  source_stack?: TechStack;
  target_stack?: TechStack;
  features_migrated: number;
  features_total: number;

  // Session history
  sessions: SessionSummary[];

  // Approval gates
  pending_approvals: ApprovalRequest[];
}
```

---

## Security Model

Building on the original system's defense-in-depth approach:

### Command Allowlisting

```typescript
const MODERNIZATION_ALLOWED_COMMANDS = {
  // Read-only operations (always allowed)
  readonly: [
    'ls', 'cat', 'head', 'tail', 'grep', 'find', 'tree',
    'git status', 'git log', 'git diff', 'git show',
    'coverage report', 'pytest --collect-only'
  ],

  // Build/test operations (allowed with validation)
  build_test: [
    'npm install', 'npm test', 'npm run build',
    'pip install', 'pytest', 'python -m pytest',
    'go build', 'go test',
    'cargo build', 'cargo test'
  ],

  // Modification operations (require approval in migration mode)
  modify: [
    'git add', 'git commit', 'git checkout -b',
    'mkdir', 'touch', 'cp', 'mv'
  ],

  // Dangerous operations (always require explicit approval)
  dangerous: [
    'rm -rf', 'git push', 'git reset --hard',
    'DROP TABLE', 'DELETE FROM'
  ]
};
```

### Approval Gates

```typescript
interface ApprovalGate {
  operation: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  auto_approve: boolean;
  requires_human: boolean;
  timeout_action: 'block' | 'approve' | 'skip';
}

const APPROVAL_GATES: ApprovalGate[] = [
  { operation: 'delete_file', risk_level: 'medium', auto_approve: false, requires_human: true, timeout_action: 'block' },
  { operation: 'modify_database', risk_level: 'critical', auto_approve: false, requires_human: true, timeout_action: 'block' },
  { operation: 'push_changes', risk_level: 'high', auto_approve: false, requires_human: true, timeout_action: 'block' },
  { operation: 'start_migration', risk_level: 'critical', auto_approve: false, requires_human: true, timeout_action: 'block' },
];
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

1. **Core Infrastructure**
   - [ ] Project structure and TypeScript setup
   - [ ] State management (`.modernization/` directory)
   - [ ] Orchestrator agent implementation
   - [ ] Session persistence logic

2. **Discovery Agent**
   - [ ] Static code parser (multi-language)
   - [ ] Dependency graph builder
   - [ ] API endpoint extractor
   - [ ] functionality_map.json generator

### Phase 2: Analysis & Testing (Week 3-4)

3. **Coverage Analysis**
   - [ ] Integration with coverage tools (istanbul, coverage.py, etc.)
   - [ ] Feature-to-test mapping
   - [ ] Gap analysis reporting

4. **Test Generation**
   - [ ] Test template library
   - [ ] Context-aware test generation
   - [ ] Test execution and validation

### Phase 3: Transformation (Week 5-6)

5. **Enhancement Agent**
   - [ ] Enhancement spec parser
   - [ ] Safe modification patterns
   - [ ] Regression detection

6. **Migration Agent**
   - [ ] Tech stack mapping library
   - [ ] Behavioral test harness
   - [ ] Parallel validation framework

### Phase 4: Production Readiness (Week 7-8)

7. **Validation & Reporting**
   - [ ] Comprehensive validation suite
   - [ ] Migration report generator
   - [ ] Rollback mechanisms

8. **Documentation & CLI**
   - [ ] User documentation
   - [ ] CLI interface
   - [ ] Example projects

---

## Appendix: Prompt Templates

See separate files:
- `prompts/orchestrator_prompt.md`
- `prompts/discovery_prompt.md`
- `prompts/coverage_prompt.md`
- `prompts/enhancement_prompt.md`
- `prompts/migration_prompt.md`
- `prompts/validation_prompt.md`

---

## References

- [Two-Agent Autonomous Coding System](https://github.com/chief-builder/two-agent-autonomous-coding-setup)
- [Claude Agent SDK Documentation](https://docs.anthropic.com/claude-agent-sdk)
- [Enhancements Brainstorm](https://github.com/chief-builder/two-agent-autonomous-coding-setup/blob/claude/plan-typescript-agent-01VnvBrdNjdaRRJ4bLDLNFwQ/docs/ENHANCEMENTS.md)
