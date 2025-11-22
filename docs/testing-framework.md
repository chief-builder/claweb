# MCP Testing Framework

## Overview

This document describes the comprehensive testing framework for the MCP (Model Context Protocol) reference implementation. The framework follows Martin Fowler's test pyramid principles, supporting both deterministic and non-deterministic agent testing.

## Test Architecture

```
                    ┌─────────────────┐
                    │  Manual Tests   │  ← Quality Reviews, Exploratory, Red Team
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Agent Tests   │  ← LLM-as-Judge, Acceptance Bands
                    └────────┬────────┘
                             │
              ┌──────────────▼──────────────┐
              │    Integration Tests        │  ← MCP Protocol Compliance
              └──────────────┬──────────────┘
                             │
       ┌─────────────────────▼─────────────────────┐
       │              Unit Tests                    │  ← Tools, Auth, Utilities
       └───────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

1. Ensure the project is built:
   ```bash
   npm run build
   ```

2. For live LLM tests, set your API key:
   ```bash
   export ANTHROPIC_API_KEY=your-api-key
   ```

### Running Tests

```bash
# Run all CI-safe tests (152 tests)
npm run test:ci:full

# Run only unit tests (fastest)
npm run test:unit

# Run only unit tests for specific modules
npm run test:unit:tools    # Calculator, echo, time tools
npm run test:unit:auth     # PKCE authentication

# Run agent tests (requires API key)
npm run test:agent

# Run only simple agent tests (deterministic)
npm run test:agent:simple

# Run intelligent agent tests (non-deterministic, requires API key)
npm run test:agent:intelligent

# Run MCP protocol compliance tests
npm run test:mcp-compliance

# Run full nightly suite with live LLM (slower, comprehensive)
LIVE_LLM=true npm run test:nightly
```

## Test Categories

### 1. Unit Tests (`tests/unit/`)

Deterministic tests for individual components.

| Module | File | Tests | Description |
|--------|------|-------|-------------|
| Calculator | `tools/calculator.test.ts` | 19 | Arithmetic operations, edge cases |
| Echo | `tools/echo.test.ts` | 8 | Message echoing and transformations |
| Current Time | `tools/current-time.test.ts` | 8 | Time formatting, timezones |
| PKCE Auth | `auth/pkce.test.ts` | 15 | OAuth PKCE flow, validation |

### 2. Agent Tests (`tests/agent/`)

Tests for agent behavior and tool selection.

| Agent | File | Tests | Type |
|-------|------|-------|------|
| Simple Agent | `simple-agent.test.ts` | 25 | Deterministic (pattern matching) |
| Intelligent Agent | `intelligent-agent.test.ts` | 16 | Non-deterministic (LLM-powered) |

### 3. MCP Compliance Tests (`tests/mcp-compliance/`)

Tests for MCP protocol adherence.

| Feature | File | Tests |
|---------|------|-------|
| Structured Output | `structured-output.test.ts` | 10 |
| Tool Titles | `tool-titles.test.ts` | 9 |
| Resource Metadata | `resource-metadata.test.ts` | 13 |
| Protocol Version | `protocol-version.test.ts` | 12 |

### 4. Integration Tests

- `tests/integration.test.ts` - End-to-end server/client communication

### 5. Manual Tests (`docs/manual-tests/`)

Human-driven testing for quality assurance.

- **Exploratory Charters**: Freeform testing sessions
- **Scenario Tests**: Scripted user journeys
- **Red Team Testing**: Security and edge case probing
- **Quality Rubric**: Response quality evaluation

## Test Utilities

The framework provides reusable utilities in `tests/utils/`:

| Utility | Purpose |
|---------|---------|
| `traceable-agent.ts` | Instrument agents for debugging |
| `llm-judge.ts` | Semantic evaluation using LLM |
| `fixtures.ts` | Standardized test data |
| `mock-llm.ts` | Deterministic LLM mocking |
| `test-helpers.ts` | Common utilities, acceptance bands |

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | API key for live LLM tests | - |
| `LIVE_LLM` | Enable live LLM in acceptance band tests | `false` |
| `TEST_TIMEOUT` | Test timeout in milliseconds | `30000` |

## Verification Instructions

### Full Test Suite Verification

```bash
# 1. Clean and build
npm run build

# 2. Run the full CI test suite
npm run test:ci:full

# Expected output: All 152+ tests should pass
```

### Verifying Specific Components

```bash
# Unit tests only (no API key needed)
npm run test:unit
# Expected: 50 tests pass

# Simple agent (deterministic, API key required for tool discovery)
npm run test:agent:simple
# Expected: 25 tests pass

# MCP compliance
npm run test:mcp-compliance
# Expected: 44 tests pass
```

### Live LLM Testing

```bash
# Set API key
export ANTHROPIC_API_KEY=your-key

# Run intelligent agent tests
npm run test:agent:intelligent
# Expected: 16 tests pass (some may show notes about non-deterministic behavior)

# Full nightly suite
LIVE_LLM=true npm run test:nightly
```

## Understanding Non-Deterministic Tests

Some tests involve LLM responses which are inherently non-deterministic. The framework handles this through:

1. **Acceptance Bands**: Tests pass if success rate exceeds a threshold (e.g., 70%)
2. **LLM-as-Judge**: Semantic evaluation rather than exact string matching
3. **Soft Assertions**: Check for reasonable outputs rather than exact values
4. **Logging**: Debug output for investigating flaky behavior

Example soft assertion:
```typescript
// Accept if response contains EITHER result
const hasCalculation = /80/.test(response);
const hasTimeInfo = /time|clock/i.test(response);
expect(hasCalculation || hasTimeInfo).toBe(true);
```

## Manual Testing Guide

See `docs/manual-tests/README.md` for comprehensive manual testing procedures:

- Exploratory testing charters
- Red team security testing
- Quality rubric evaluation
- Finding documentation templates

## Continuous Integration

### Recommended CI Pipeline

```yaml
# Fast feedback (every commit)
test:unit + test:mcp-compliance

# Full CI (every PR)
test:ci:full

# Nightly (scheduled)
LIVE_LLM=true test:nightly
```

### Test Scripts Reference

| Script | Description | API Key? | Duration |
|--------|-------------|----------|----------|
| `test` | Run all tests | Yes | ~2min |
| `test:watch` | Watch mode | Yes | - |
| `test:unit` | Unit tests only | No | ~5s |
| `test:unit:tools` | Tool unit tests | No | ~2s |
| `test:unit:auth` | Auth unit tests | No | ~2s |
| `test:agent` | All agent tests | Yes | ~1min |
| `test:agent:simple` | Simple agent | Yes | ~30s |
| `test:agent:intelligent` | Intelligent agent | Yes | ~45s |
| `test:mcp-compliance` | MCP compliance | No | ~10s |
| `test:ci` | CI-safe tests | No | ~20s |
| `test:ci:full` | Full CI suite | Yes | ~1min |
| `test:nightly` | Comprehensive suite | Yes | ~3min |
| `test:flake-detection` | Flaky test detection | Yes | ~2min |

## Troubleshooting

### Tests fail with "ANTHROPIC_API_KEY not set"

Set the environment variable:
```bash
export ANTHROPIC_API_KEY=your-key
```

### Agent tests timeout

Increase timeout or check network connectivity:
```bash
TEST_TIMEOUT=60000 npm run test:agent
```

### Non-deterministic test failures

1. Check logs for "Note:" messages indicating expected variability
2. Run with `--retry=3` to detect flaky tests
3. Consider using acceptance bands for highly variable tests

### Build errors before tests

Ensure clean build:
```bash
npm run build
```

## Contributing

When adding new tests:

1. Follow the existing patterns in similar test files
2. Use fixtures from `tests/utils/fixtures.ts`
3. For non-deterministic tests, use acceptance bands or LLM-as-Judge
4. Document any manual testing requirements
5. Update this file if adding new test categories
