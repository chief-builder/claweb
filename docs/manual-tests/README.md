# Manual Testing Guide

This directory contains documentation and templates for manual testing of the MCP Reference Implementation. While automated tests cover deterministic scenarios, manual testing remains essential for discovering unknown issues, evaluating usability, and testing edge cases that are difficult to automate.

## Why Manual Testing?

Even with comprehensive automation:

1. **Edge cases slip through** - Automated tests cover known scenarios; humans discover unknown unknowns
2. **Usability is invisible to machines** - Response clarity, tone, helpfulness
3. **Emergent behaviors** - Multi-turn conversations can produce unexpected results
4. **Security testing** - Prompt injection requires creative adversarial thinking
5. **Quality judgment** - Determining if an agent's creative solution is acceptable

## Testing Types

### 1. Exploratory Testing
Unstructured, creative testing to discover unknown issues.
- See: [exploratory-charters/](./exploratory-charters/)
- Frequency: Weekly 1-2 hour sessions

### 2. Structured Manual Scenarios
Scripted tests for complex scenarios hard to automate.
- See: [scenarios/](./scenarios/)
- Frequency: Before each release

### 3. Red Team Testing
Security-focused adversarial testing.
- See: [red-team/](./red-team/)
- Frequency: Monthly, or after significant changes

### 4. Quality Rubric Reviews
Human evaluation of response quality.
- See: [quality-rubric.md](./quality-rubric.md)
- Frequency: Monthly sample of 20 conversations

## Quick Start

### Running an Exploratory Session

1. Choose or create a charter from `exploratory-charters/`
2. Set a timer for 60 minutes
3. Document findings in `findings/`
4. Convert reproducible bugs to automated tests

### Running Manual Scenarios

1. Ensure the server is built: `npm run build`
2. Start the appropriate agent (simple/intelligent/oauth)
3. Follow steps in the scenario document
4. Record results in the scenario template

### Running Red Team Testing

1. Review the checklist in `red-team/security-checklist.md`
2. Use a dedicated test environment
3. Document all findings, even unsuccessful attempts
4. Report critical findings immediately

## Directory Structure

```
manual-tests/
├── README.md                    # This file
├── exploratory-charters/
│   ├── charter-template.md      # Template for new charters
│   └── example-charters/
├── scenarios/
│   ├── scenario-template.md     # Template for new scenarios
│   └── MT-001-*.md              # Manual test scenarios
├── red-team/
│   ├── security-checklist.md    # Security test checklist
│   └── prompt-injection-tests.md
├── quality-rubric.md            # Response quality evaluation guide
└── findings/
    ├── finding-template.md      # Template for documenting findings
    └── automation-candidates.md # Bugs to convert to automated tests
```

## Feedback Loop

Findings from manual testing should feed back into automated tests:

```
Exploratory Testing → Document Bug → Write Automated Regression Test → Fix Bug → Verify in CI
```

See `findings/automation-candidates.md` for bugs pending automation.
