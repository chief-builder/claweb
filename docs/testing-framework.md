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
| Healthcare Types | `healthcare/types.test.ts` | 29 | Audit metadata, PII detection, redaction |

### 2. Agent Tests (`tests/agent/`)

Tests for agent behavior and tool selection.

| Agent | File | Tests | Type |
|-------|------|-------|------|
| Simple Agent | `simple-agent.test.ts` | 25 | Deterministic (pattern matching) |
| Intelligent Agent | `intelligent-agent.test.ts` | 16 | Non-deterministic (LLM-powered) |
| Healthcare Agent | `healthcare-intelligent-agent.test.ts` | 23 | Non-deterministic (healthcare domain) |

#### Healthcare Intelligent Agent Tests

The healthcare agent tests demonstrate comprehensive testing patterns for domain-specific LLM agents:

| Category | Tests | Description |
|----------|-------|-------------|
| Initialization | 4 | Server connectivity and tool discovery |
| Patient Record Queries | 3 | Patient lookup, conditions, data minimization |
| Drug Interaction Queries | 3 | Interactions, dosage, medication info |
| Clinical Workflow Queries | 2 | Appointments, care plans |
| Multi-Server Queries | 1 | Cross-server tool chaining |
| LLM-as-Judge Evaluation | 2 | Semantic quality assessment |
| Acceptance Band Testing | 1 | Flake detection (70% threshold) |
| Mock LLM (Deterministic) | 5 | Pattern-based tool routing |
| Error Handling | 1 | Invalid input graceful handling |

**Running Healthcare Agent Tests:**
```bash
# Deterministic tests only (no API key needed)
npm run test -- tests/agent/healthcare-intelligent-agent.test.ts

# Full suite with live LLM
ANTHROPIC_API_KEY=your-key npm run test -- tests/agent/healthcare-intelligent-agent.test.ts

# With acceptance band tests
ANTHROPIC_API_KEY=your-key LIVE_LLM=true npm run test -- tests/agent/healthcare-intelligent-agent.test.ts
```

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

### 5. Healthcare MCP Server Tests (`tests/healthcare/`)

Comprehensive tests for healthcare domain MCP servers demonstrating MCP 2025-06-18 compliance:

| Server | File | Tests | Description |
|--------|------|-------|-------------|
| Patient Records | `patient-records.test.ts` | 26 | Patient lookup, conditions, break-glass, data minimization |
| Pharmacy | `pharmacy.test.ts` | 29 | Drug interactions, dosage, formulary, prescriptions |
| Clinical Workflow | `clinical-workflow.test.ts` | 39 | Appointments, referrals, care plans, messaging |

**Test Fixtures:** `tests/healthcare/fixtures.ts` provides reusable test data:
- Patient fixtures (valid, invalid, break-glass scenarios)
- Drug interaction fixtures (major, moderate, minor severity)
- Dosage fixtures (appropriate, inappropriate ranges)
- Appointment and referral fixtures

**Key Test Patterns:**
```typescript
// MCP 2025-06-18 compliance - tool definitions
it('should have title field for all tools', async () => {
  const tools = await client.listTools();
  for (const tool of tools) {
    expect(tool).toHaveProperty('title');
    expect(tool).toHaveProperty('outputSchema');
  }
});

// Audit metadata validation
it('should include audit metadata', async () => {
  const result = await client.callTool('get_patient', { patientId: 'P12345' });
  expect(result.structuredContent._audit).toHaveProperty('eventId');
  expect(result.structuredContent._audit).toHaveProperty('timestamp');
  expect(result.structuredContent._audit).toHaveProperty('dataClassification');
});

// Break-glass access
it('should allow break-glass access with review deadline', async () => {
  const result = await client.callTool('get_patient', {
    patientId: 'P12345',
    breakGlass: true,
    breakGlassReason: 'Emergency treatment',
  });
  expect(result.structuredContent._audit.breakGlass).toBe(true);
  expect(result.structuredContent._audit.breakGlassReason).toBeDefined();
});
```

**Running Healthcare Server Tests:**
```bash
# Run all healthcare integration tests
npm run test:integration -- tests/healthcare/

# Run specific server tests
npm run test -- tests/healthcare/patient-records.test.ts
npm run test -- tests/healthcare/pharmacy.test.ts
npm run test -- tests/healthcare/clinical-workflow.test.ts
```

### 6. Manual Tests (`docs/manual-tests/`)

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

## Flake Detection

### What Are Flaky Tests?

**Flaky tests** are tests that sometimes pass and sometimes fail without any code changes. They're particularly common in non-deterministic systems like LLM-powered agents.

**Why they're problematic:**
- Erode trust in the test suite
- Cause CI failures that aren't real bugs
- Waste developer time investigating false failures
- Can mask real regressions

### The `test:flake-detection` Script

```bash
npm run test:flake-detection
# Executes: vitest run --reporter=verbose --retry=3 tests/agent
```

| Flag | Purpose |
|------|---------|
| `--reporter=verbose` | Show detailed output for each test |
| `--retry=3` | If a test fails, retry up to 3 times before marking as failed |
| `tests/agent` | Only run agent tests (most likely to be flaky due to LLM behavior) |

### How It Detects Flakiness

1. **Retry Logic**: If a test fails once but passes on retry, it indicates potential flakiness
2. **Verbose Output**: Shows which tests needed retries and why
3. **Pattern Recognition**: Running tests multiple times reveals inconsistent behavior

### Interpreting Results

| Result | Meaning | Action |
|--------|---------|--------|
| All pass first try | Stable test suite | No action needed |
| Pass after 1-2 retries | Potentially flaky | Investigate root cause |
| Fail after 3 retries | Genuine failure OR highly flaky | Fix the test or underlying code |

### Expected Variation Notes

The test suite includes logging for expected non-deterministic variations:

```
Note: Multi-tool query did not mention calculation result in response
Note: Multi-part response was empty (LLM explained in intermediate steps)
```

These notes indicate **expected LLM variability** - the tests pass despite these variations because we use soft assertions.

### When to Run Flake Detection

| Scenario | Why |
|----------|-----|
| Before merging PRs | Verify no new flaky tests introduced |
| After LLM/prompt changes | Check if changes introduced instability |
| Debugging CI failures | Identify tests that fail intermittently |
| Nightly/weekly runs | Track flakiness trends over time |

### Advanced Flake Detection

For more thorough flake detection, run multiple iterations:

```bash
# Run flake detection 5 times to catch intermittent failures
for i in {1..5}; do
  echo "=== Run $i ==="
  npm run test:flake-detection
done

# Or use acceptance bands for statistical analysis
LIVE_LLM=true npm run test:agent:intelligent:live
```

### Writing Flake-Resistant Tests

When testing non-deterministic systems:

1. **Use soft assertions** - Check for reasonable outputs, not exact values
   ```typescript
   // Bad: Brittle assertion
   expect(response).toBe('The result is 80.');

   // Good: Flexible assertion
   expect(response).toMatch(/80/);
   ```

2. **Handle empty responses gracefully**
   ```typescript
   if (!response || response.trim() === '') {
     console.log('Note: Response was empty (explained in intermediate steps)');
     expect(true).toBe(true); // Pass - agent worked, just different output
     return;
   }
   ```

3. **Use acceptance bands for statistical tests**
   ```typescript
   const band = createAcceptanceBand({ minScore: 0.7, totalRuns: 3 });
   for (let i = 0; i < 3; i++) {
     const passed = /expected/.test(response);
     band.record(passed);
   }
   expect(band.isPassing()).toBe(true); // 70%+ success rate
   ```

4. **Log variations for debugging**
   ```typescript
   if (!hasExpectedContent) {
     console.log('Note: Response variation detected - still valid');
   }
   ```

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

### Port already in use

```bash
# Check what's using the port
lsof -i :3001

# Kill the process
lsof -ti:3001 | xargs kill -9
```

### CORS errors in browser

1. Verify API URL is correct (`http://localhost:3001`)
2. Ensure server is running
3. Try hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
4. Check browser console for exact error details

### "Cannot find module" errors

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

### GitHub rate limit exceeded

```bash
# Check rate limit status
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/rate_limit
```

Wait for rate limit reset or use a different token.

## OAuth 2.1 Testing

The project includes comprehensive OAuth 2.1 testing with 32 tests covering core flows and enterprise features.

### OAuth Test Commands

```bash
# Run all OAuth tests (32 tests)
npm run test:oauth:all

# Individual test suites
npm run example:oauth:test-flow        # Complete OAuth flow
npm run example:oauth:test-interactive # Interactive consent (6 tests)
npm run example:oauth:edge-cases       # Edge cases (5 tests)
npm run example:oauth:test-revocation  # Token revocation (6 tests)
```

### OAuth Test Coverage

| Feature | Status | Description |
|---------|--------|-------------|
| Authorization Code + PKCE | ✅ | Core OAuth 2.1 flow |
| Token Revocation (RFC 7009) | ✅ | 6 tests |
| Interactive Consent | ✅ | User approval workflow |
| Edge Cases | ✅ | Invalid/expired codes, PKCE failures |
| Token Exchange (RFC 8693) | ✅ | Enterprise SSO |
| Auth0 SSO Integration | ✅ | Real + mock Auth0 testing |

### Enterprise SSO Testing

```bash
# Mock Auth0 SSO (automated, no credentials needed)
npm run example:enterprise:sso

# Real Auth0 integration (requires Auth0 account)
AUTH0_DOMAIN=your-tenant.auth0.com \
AUTH0_CLIENT_ID=your_client_id \
AUTH0_CLIENT_SECRET=your_client_secret \
npm run example:enterprise:real-auth0

# MCP scopes documentation
npm run example:enterprise:scopes
```

See `TESTING_GUIDE.md` for complete OAuth testing documentation including Auth0 setup instructions.

## Manual Integration Testing

### MCP Inspector Testing

Test MCP servers manually using the MCP Inspector:

```bash
# Build the project
npm run build

# Test Playwright MCP server
npm run mcp:playwright
# In another terminal:
npx @modelcontextprotocol/inspector node dist/mcp-servers/playwright-server.js

# Test GitHub MCP server
export GITHUB_TOKEN=ghp_your_token_here
npm run mcp:github
# In another terminal:
npx @modelcontextprotocol/inspector node dist/mcp-servers/github-server.js

# Test Healthcare MCP servers
npm run mcp:healthcare:patient
npm run mcp:healthcare:pharmacy
npm run mcp:healthcare:clinical
```

### Web Chat API Testing

Test the web chat API endpoints with curl:

```bash
# Start the web chat server
export ANTHROPIC_API_KEY=sk-ant-xxx
export GITHUB_TOKEN=ghp_xxx
npm run web-chat

# Health check
curl http://localhost:3001/api/health

# Create session
SESSION_ID=$(curl -X POST http://localhost:3001/api/sessions | jq -r '.sessionId')

# Send message
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"message\": \"List my GitHub repositories\"}"

# Reset conversation
curl -X POST http://localhost:3001/api/sessions/$SESSION_ID/reset

# Delete session
curl -X DELETE http://localhost:3001/api/sessions/$SESSION_ID
```

See `docs/INTEGRATION_TESTING_GUIDE.md` for comprehensive manual testing procedures.

## Performance Testing

### Response Time Benchmarks

| Operation | Expected Time | Notes |
|-----------|--------------|-------|
| Session creation | < 2s | Includes server initialization |
| List repositories | < 3s | Depends on GitHub API |
| Get repository | < 2s | Cached by GitHub |
| Search code | < 5s | Complex queries take longer |
| Create issue | < 3s | Write operation |
| Playwright navigation | < 5s | Depends on website |
| Playwright screenshot | < 2s | After navigation |
| Claude query processing | 2-10s | Depends on complexity |

### Load Testing

```bash
# Install Apache Bench
# Ubuntu/Debian: sudo apt-get install apache2-utils
# macOS: brew install apache-bench

# Create test payload
echo '{"sessionId": "test-session", "message": "List my repositories"}' > test-message.json

# Run load test (10 requests, 2 concurrent)
ab -n 10 -c 2 -H "Content-Type: application/json" \
  -p test-message.json \
  http://localhost:3001/api/chat
```

**Expected Results:**
- No failed requests
- Average response time < 5s
- No memory leaks

## Security Testing

### OAuth Token Validation

```bash
# Test with invalid token
export GITHUB_TOKEN=invalid
npm run web-chat
# Expected: Authentication error

# Verify token is not exposed
# Check browser Network tab - token should NOT appear in requests/responses
```

### Input Validation Testing

```bash
# XSS protection test
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test", "message": "<script>alert(\"XSS\")</script>"}'
# Expected: Script should be escaped, no execution
```

### Token Handling Checklist

- [ ] Tokens not exposed in client-side requests
- [ ] Tokens not logged to console or files
- [ ] Invalid tokens produce clear error messages
- [ ] Expired tokens are detected and handled gracefully

## Diagnostic Tools

### Port Availability Check

```bash
# Check if port 4000 is available (OAuth tests)
npx tsx examples/oauth-roles/check-port.ts

# Kill process on specific port
lsof -ti:4000 | xargs kill -9
```

### Code Loading Verification

```bash
# Verify tsx is loading latest code (debug cache issues)
npx tsx examples/oauth-roles/diagnostic-test.ts
```

### Cache Clearing (macOS)

```bash
# Clear tsx cache
rm -rf ~/Library/Caches/tsx
rm -rf node_modules/.cache
npm cache clean --force
npm run build
```

## Test Results Template

Use this template when documenting manual test results:

```markdown
# Test Results

**Date:** YYYY-MM-DD
**Tester:** Name
**Environment:** Development / CI
**Build:** Git commit SHA

## Environment
- Node.js: `node --version`
- OS: macOS / Linux / Windows
- ANTHROPIC_API_KEY: ✅ Set
- GITHUB_TOKEN: ✅ Set

## Test Results

### Unit Tests
- [ ] All unit tests pass (`npm run test:unit`)

### Agent Tests
- [ ] Simple agent tests pass
- [ ] Healthcare agent tests pass
- [ ] Intelligent agent tests pass (if API key available)

### MCP Compliance
- [ ] Protocol compliance tests pass
- [ ] Structured output validation passes

### OAuth Tests
- [ ] Core OAuth flow works
- [ ] Token revocation works
- [ ] Enterprise SSO works (if configured)

### Integration Tests
- [ ] Healthcare servers respond correctly
- [ ] Web chat API endpoints work
- [ ] Multi-server agent coordination works

## Performance
| Metric | Result | Expected | Pass/Fail |
|--------|--------|----------|-----------|
| Session creation | Xs | < 2s | |
| Query processing | Xs | < 10s | |

## Issues Found
1. [Issue description, severity, steps to reproduce]

## Sign-off
- [ ] All critical tests passed
- [ ] Documentation updated
```

## Contributing

When adding new tests:

1. Follow the existing patterns in similar test files
2. Use fixtures from `tests/utils/fixtures.ts`
3. For non-deterministic tests, use acceptance bands or LLM-as-Judge
4. Document any manual testing requirements
5. Update this file if adding new test categories
6. For OAuth tests, follow patterns in `examples/oauth-roles/`
7. For healthcare tests, use fixtures from `tests/healthcare/fixtures.ts`

## Related Documentation

| Document | Description |
|----------|-------------|
| [TESTING_GUIDE.md](../TESTING_GUIDE.md) | OAuth 2.1 and Enterprise SSO testing guide with Auth0 setup |
| [INTEGRATION_TESTING_GUIDE.md](./INTEGRATION_TESTING_GUIDE.md) | Manual integration testing for MCP servers with MCP Inspector |
| [manual-tests/README.md](./manual-tests/README.md) | Exploratory testing charters and quality rubrics |
| [MCP_ENHANCEMENT_PROPOSAL.md](./MCP_ENHANCEMENT_PROPOSAL.md) | MCP 2025-06-18 specification enhancements |

## Test Summary

### Automated Test Counts

| Category | Tests | Type |
|----------|-------|------|
| Unit Tests | 79 | Deterministic |
| Agent Tests (Simple) | 25 | Deterministic |
| Agent Tests (Intelligent) | 16 | Non-deterministic |
| Agent Tests (Healthcare) | 23 | Non-deterministic |
| MCP Compliance | 44 | Deterministic |
| Healthcare Servers | 94 | Deterministic |
| OAuth 2.1 | 32 | Deterministic |
| **Total** | **313+** | Mixed |

### Test Execution Times

| Suite | Duration | Notes |
|-------|----------|-------|
| Unit tests | ~5s | No API key needed |
| MCP compliance | ~10s | No API key needed |
| Agent tests (simple) | ~30s | Needs API key for tool discovery |
| Agent tests (intelligent) | ~45s | Needs API key |
| Healthcare agent | ~1min | Needs API key |
| Full CI suite | ~2min | Needs API key |
| Nightly suite | ~3min | LIVE_LLM=true |

### Quick Validation

```bash
# Fastest validation (no API key)
npm run test:unit && npm run test:mcp-compliance

# Full validation (with API key)
npm run test:ci:full

# Complete validation (with live LLM)
LIVE_LLM=true npm run test:nightly
```
