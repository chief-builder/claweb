# Hoppscotch Modernization Exercise Plan

## Using the Autonomous Codebase Modernization Agent System

This document outlines a comprehensive exercise plan for applying our 4-use-case modernization agent system to [Hoppscotch](https://github.com/hoppscotch/hoppscotch), the popular open-source API development ecosystem with 77k+ GitHub stars.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Use Case 1: Functionality Documentation](#use-case-1-functionality-documentation)
3. [Use Case 2: Test Coverage Completion](#use-case-2-test-coverage-completion)
4. [Use Case 3: AI Feature Enhancement](#use-case-3-ai-feature-enhancement)
5. [Use Case 4: Tech Stack Migration](#use-case-4-tech-stack-migration)
6. [Implementation Timeline](#implementation-timeline)
7. [Success Metrics](#success-metrics)

---

## Project Overview

### Hoppscotch Architecture

```
hoppscotch/
├── packages/
│   ├── hoppscotch-common/      # 90% of UI + business logic (Vue 3)
│   ├── hoppscotch-kernel/      # Cross-platform runtime abstraction
│   ├── hoppscotch-data/        # Type-safe data layer
│   ├── hoppscotch-js-sandbox/  # Secure script execution
│   ├── hoppscotch-backend/     # Server-side services
│   ├── hoppscotch-cli/         # Command-line interface
│   ├── hoppscotch-desktop/     # Tauri desktop app
│   ├── hoppscotch-selfhost-web/# Self-hosted web version
│   ├── hoppscotch-sh-admin/    # Admin interface
│   ├── hoppscotch-agent/       # Agent functionality
│   ├── hoppscotch-relay/       # Request proxy service
│   └── codemirror-lang-graphql/# GraphQL editor support
├── docker-compose.yml
├── pnpm-workspace.yaml
└── ...
```

### Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | Vue 3, TypeScript, Tailwind CSS |
| **Desktop** | Tauri (Rust) |
| **Backend** | Node.js |
| **Database** | Firebase/Firestore |
| **Testing** | Vitest (migrated from Jest) |
| **Package Manager** | pnpm workspaces |
| **Build** | Vite |

### Current State Assessment

| Metric | Status |
|--------|--------|
| **Stars** | 77,100+ |
| **Open Issues** | 510 |
| **Test Coverage** | Partial (CLI tests disabled due to flakiness) |
| **AI Features** | None |
| **Documentation** | Good user docs, limited architecture docs |

---

## Use Case 1: Functionality Documentation

### Objective

Create comprehensive documentation of Hoppscotch's functionality through:
1. **Static analysis** of source code
2. **Runtime observation** of the running application
3. **API surface mapping** for all packages

### Discovery Agent Sessions

#### Session 1: Static Analysis - Package Structure

**Agent Task**: Parse all packages and create dependency graph

```markdown
# Discovery Prompt for Session 1

Analyze the Hoppscotch monorepo structure:

1. For each package in /packages/:
   - Identify entry points (index.ts, main.ts)
   - Map exports and public API
   - Document dependencies (internal and external)
   - Identify Vue components

2. Create package dependency graph showing:
   - Which packages depend on which
   - Shared utilities and types
   - Build order requirements

3. Output: packages_analysis.json
```

**Expected Output**:
```json
{
  "packages": [
    {
      "name": "hoppscotch-common",
      "type": "library",
      "entry_points": ["src/index.ts"],
      "exports": 250,
      "vue_components": 85,
      "composables": 42,
      "stores": 15,
      "dependencies": {
        "internal": ["hoppscotch-data", "hoppscotch-kernel"],
        "external": ["vue", "pinia", "@vueuse/core", "rxjs"]
      }
    }
  ],
  "dependency_graph": {
    "hoppscotch-selfhost-web": ["hoppscotch-common", "hoppscotch-kernel"],
    "hoppscotch-common": ["hoppscotch-data", "hoppscotch-kernel"],
    "hoppscotch-cli": ["hoppscotch-data", "hoppscotch-js-sandbox"]
  }
}
```

#### Session 2: Static Analysis - Feature Mapping

**Agent Task**: Identify all user-facing features

```markdown
# Discovery Prompt for Session 2

Map all features in hoppscotch-common:

1. Analyze Vue components in src/components/:
   - Identify feature boundaries
   - Map component hierarchies
   - Document props and events

2. Analyze Pinia stores in src/stores/:
   - Identify state management patterns
   - Map actions and mutations
   - Document reactive dependencies

3. Analyze composables in src/composables/:
   - Identify reusable logic
   - Map dependencies

4. Categories to identify:
   - Request handling (REST, GraphQL, WebSocket, etc.)
   - Collection management
   - Environment variables
   - Authentication methods
   - Test scripting
   - Response visualization

5. Output: features_map.json
```

**Expected Output**:
```json
{
  "features": [
    {
      "id": "F001",
      "name": "REST Request Builder",
      "category": "request",
      "components": [
        "components/http/Request.vue",
        "components/http/RequestOptions.vue",
        "components/http/URLBar.vue"
      ],
      "stores": ["stores/RESTSession.ts"],
      "composables": ["composables/useRequestFlow.ts"],
      "api_surface": {
        "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
        "features": ["headers", "body", "params", "auth"]
      }
    },
    {
      "id": "F002",
      "name": "GraphQL Client",
      "category": "request",
      "components": ["components/graphql/..."],
      "stores": ["stores/GQLSession.ts"]
    },
    {
      "id": "F003",
      "name": "WebSocket Client",
      "category": "realtime"
    },
    {
      "id": "F004",
      "name": "Collection Management",
      "category": "organization"
    },
    {
      "id": "F005",
      "name": "Environment Variables",
      "category": "configuration"
    },
    {
      "id": "F006",
      "name": "Pre-request Scripts",
      "category": "automation"
    },
    {
      "id": "F007",
      "name": "Test Scripts",
      "category": "testing"
    },
    {
      "id": "F008",
      "name": "Authentication",
      "category": "security",
      "sub_features": ["OAuth 2.0", "API Key", "Bearer Token", "Basic Auth"]
    }
  ]
}
```

#### Session 3: Runtime Discovery

**Agent Task**: Observe the running application

```markdown
# Discovery Prompt for Session 3

Run Hoppscotch locally and observe behavior:

1. Start the development server:
   pnpm install
   pnpm run dev

2. Using Playwright, exercise each feature:
   - Navigate to each section
   - Screenshot key UI states
   - Capture network requests
   - Log console output

3. For each feature discovered in Session 2:
   - Verify it works as expected
   - Document any undocumented behaviors
   - Capture edge cases

4. Output:
   - runtime_observations.json
   - screenshots/ directory
   - Enriched features_map.json
```

#### Session 4: Documentation Generation

**Agent Task**: Generate human-readable documentation

```markdown
# Discovery Prompt for Session 4

Using all gathered data, generate:

1. ARCHITECTURE.md
   - High-level system overview
   - Package relationships diagram (Mermaid)
   - Data flow diagrams
   - Key design decisions

2. FEATURES.md
   - Complete feature catalog
   - User-facing functionality
   - Screenshots for each feature

3. API_SURFACE.md
   - All exported functions/components
   - Type definitions
   - Usage examples

4. Output: docs/architecture/ directory
```

### Deliverables

| Artifact | Description |
|----------|-------------|
| `functionality_map.json` | Complete feature catalog with source locations |
| `dependency_graph.json` | Package and module dependencies |
| `ARCHITECTURE.md` | Human-readable architecture documentation |
| `FEATURES.md` | Feature catalog with screenshots |
| `screenshots/` | UI state captures |

---

## Use Case 2: Test Coverage Completion

### Objective

Achieve comprehensive test coverage for all features, addressing the known issues:
- CLI tests disabled due to flakiness
- Migration from Jest to Vitest incomplete
- Missing tests for many components

### Current State

From [Issue #4136](https://github.com/hoppscotch/hoppscotch/issues/4136):
> "Various unit tests exist for the Hoppscotch CLI, but they were disabled because they were found flaky. They need to be revisited."

### Coverage Agent Sessions

#### Session 1: Coverage Analysis

**Agent Task**: Analyze current test coverage

```markdown
# Coverage Prompt for Session 1

Analyze test coverage across all packages:

1. Run existing tests with coverage:
   pnpm run test:coverage

2. For each package, document:
   - Current line coverage %
   - Current branch coverage %
   - Files with 0% coverage
   - Disabled/skipped tests

3. Map coverage to features from functionality_map.json

4. Prioritize gaps by:
   - Critical path importance
   - Bug history
   - Code complexity

5. Output: test_coverage_analysis.json
```

**Expected Output**:
```json
{
  "overall_coverage": {
    "lines": 45,
    "branches": 38,
    "functions": 52
  },
  "by_package": [
    {
      "package": "hoppscotch-cli",
      "coverage": 12,
      "disabled_tests": 15,
      "issues": ["Flaky async tests", "Missing mocks"]
    },
    {
      "package": "hoppscotch-common",
      "coverage": 35,
      "untested_components": 45
    }
  ],
  "by_feature": [
    {
      "feature_id": "F001",
      "feature_name": "REST Request Builder",
      "coverage": 40,
      "gaps": [
        "Error handling for network failures",
        "Request cancellation",
        "Timeout handling"
      ]
    }
  ],
  "priority_queue": [
    {"feature": "F006", "reason": "Pre-request scripts - security critical"},
    {"feature": "F007", "reason": "Test scripts - core functionality"},
    {"feature": "F001", "reason": "REST - most used feature"}
  ]
}
```

#### Session 2-N: Test Generation

**Agent Task**: Generate tests for each gap

```markdown
# Coverage Prompt for Session 2+

Generate tests for priority feature gaps:

1. Read the feature implementation
2. Identify all code paths
3. Generate Vitest tests covering:
   - Happy path scenarios
   - Error handling
   - Edge cases
   - Integration points

4. Follow Hoppscotch testing patterns:
   - Use existing test utilities
   - Match code style
   - Use Vue Test Utils for components

5. Run tests and verify they pass
6. Update test_coverage.json

Example test structure:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import RequestBuilder from '@/components/http/Request.vue'

describe('REST Request Builder', () => {
  it('sends GET request with correct headers', async () => {
    // Arrange
    const wrapper = mount(RequestBuilder, {
      global: { plugins: [createPinia()] }
    })

    // Act
    await wrapper.find('[data-test="send-button"]').trigger('click')

    // Assert
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        headers: expect.any(Headers)
      })
    )
  })

  it('handles network timeout gracefully', async () => {
    // Test timeout handling
  })

  it('cancels in-flight request when new request sent', async () => {
    // Test request cancellation
  })
})
```
```

#### Session: Fix Flaky CLI Tests

**Agent Task**: Address Issue #4136

```markdown
# Coverage Prompt for CLI Tests

Fix the disabled CLI tests:

1. Read packages/hoppscotch-cli/src/__tests__/
2. Identify why each test is flaky:
   - Timing issues
   - Missing mocks
   - State leakage
   - Network dependencies

3. For each flaky test:
   - Add proper async handling (await, vi.useFakeTimers())
   - Mock external dependencies
   - Isolate test state
   - Add deterministic assertions

4. Migrate remaining Jest APIs to Vitest
5. Re-enable tests in CI pipeline
6. Verify all tests pass consistently (run 10x)
```

### Deliverables

| Artifact | Description |
|----------|-------------|
| `test_coverage.json` | Coverage mapping to features |
| `tests/**/*.test.ts` | Generated test files |
| `vitest.config.ts` | Updated configuration |
| Coverage report | 80%+ line coverage target |

---

## Use Case 3: AI Feature Enhancement

### Objective

Add AI-powered features to Hoppscotch to close the gap with Postman's Postbot:

1. **AI Test Generation** - Generate test scripts from request/response
2. **AI Documentation** - Auto-generate API docs from collections
3. **Smart Assertions** - Suggest assertions based on response patterns
4. **AI Debug Assistant** - Natural language error explanation

### Enhancement Specification

```markdown
# enhancement_spec.txt

## Enhancement: Hoppscotch AI Assistant

### Overview
Add AI-powered features to Hoppscotch that work offline and respect user privacy.

### Feature 1: AI Test Generation

**User Story**: As a developer, I want to automatically generate test scripts
for my API requests based on the response I receive.

**Acceptance Criteria**:
- [ ] "Generate Tests" button appears after receiving response
- [ ] Generates assertions for status code, headers, body structure
- [ ] Supports both success and error response testing
- [ ] Works with local LLM (Ollama) or cloud providers
- [ ] Generated tests use Hoppscotch's test script syntax

**Technical Requirements**:
- New component: AITestGenerator.vue
- Integration with hoppscotch-js-sandbox
- LLM provider abstraction (Ollama, OpenAI, Anthropic)
- Prompt templates for test generation

### Feature 2: Smart Assertions

**User Story**: As a developer, I want intelligent assertion suggestions
while writing test scripts.

**Acceptance Criteria**:
- [ ] Autocomplete suggests relevant assertions
- [ ] Suggestions based on response structure
- [ ] Learns from user's testing patterns
- [ ] Works without cloud connection

**Technical Requirements**:
- CodeMirror extension for assertion suggestions
- Response schema inference
- Pattern matching for common API patterns

### Feature 3: AI Documentation

**User Story**: As a developer, I want to generate API documentation
from my collections automatically.

**Acceptance Criteria**:
- [ ] "Generate Docs" button on collections
- [ ] Produces Markdown or OpenAPI spec
- [ ] Includes request/response examples
- [ ] Generates descriptions from request patterns

### Feature 4: Debug Assistant

**User Story**: As a developer, I want help understanding API errors.

**Acceptance Criteria**:
- [ ] "Explain Error" button on error responses
- [ ] Natural language explanation of error
- [ ] Suggests potential fixes
- [ ] Links to relevant documentation

### Privacy Requirements
- All AI features must support offline mode via Ollama
- No data sent to cloud without explicit consent
- Clear indicators when cloud AI is used
- Local embeddings for pattern matching
```

### Enhancement Agent Sessions

#### Session 1: Enhancement Planning

**Agent Task**: Plan the AI integration

```markdown
# Enhancement Prompt for Session 1

Plan the AI feature implementation:

1. Analyze existing architecture for integration points:
   - Where do test scripts get executed? (hoppscotch-js-sandbox)
   - Where is response handling? (hoppscotch-common)
   - How do plugins/extensions work?

2. Design the AI integration layer:
   - LLM provider abstraction
   - Prompt management
   - Response parsing
   - Error handling

3. Create implementation plan:
   - New packages needed
   - Component changes
   - Store modifications
   - API additions

4. Output: enhancement_plan.json
```

#### Session 2-N: Implementation

**Agent Task**: Implement AI features

```markdown
# Enhancement Prompt for Session 2+

Implement AI Test Generation:

1. Create packages/hoppscotch-ai/:
   - src/providers/ (Ollama, OpenAI adapters)
   - src/prompts/ (test generation prompts)
   - src/generators/ (test script generator)

2. Create AITestGenerator.vue component:
   - Button to trigger generation
   - Loading state with progress
   - Preview of generated tests
   - Edit before applying

3. Integrate with existing test script editor:
   - Add to response panel
   - Preserve existing functionality

4. Add settings for AI configuration:
   - Provider selection
   - API key management (encrypted)
   - Model selection
   - Temperature/creativity settings

5. Write tests for all new code
6. Update documentation
```

### Example Implementation

```typescript
// packages/hoppscotch-ai/src/providers/base.ts
export interface AIProvider {
  name: string
  generateTestScript(context: TestGenerationContext): Promise<string>
  suggestAssertions(response: APIResponse): Promise<Assertion[]>
  explainError(error: APIError): Promise<string>
}

// packages/hoppscotch-ai/src/providers/ollama.ts
export class OllamaProvider implements AIProvider {
  name = 'ollama'

  constructor(private config: OllamaConfig) {}

  async generateTestScript(context: TestGenerationContext): Promise<string> {
    const prompt = buildTestGenerationPrompt(context)
    const response = await this.chat(prompt)
    return parseTestScript(response)
  }
}

// packages/hoppscotch-ai/src/prompts/test-generation.ts
export function buildTestGenerationPrompt(context: TestGenerationContext): string {
  return `
You are an API testing expert. Generate test assertions for this API response.

Request: ${context.method} ${context.url}
Status: ${context.status}
Response Body:
${JSON.stringify(context.body, null, 2)}

Generate Hoppscotch test script that:
1. Asserts the status code
2. Validates response structure
3. Checks key fields
4. Handles edge cases

Use pw.expect() syntax. Example:
pw.expect(pw.response.status).toBe(200)
pw.expect(pw.response.body.id).toBeType("string")
`
}
```

```vue
<!-- packages/hoppscotch-common/src/components/http/AITestGenerator.vue -->
<template>
  <div class="ai-test-generator">
    <HoppButtonSecondary
      v-if="hasResponse"
      :icon="IconSparkles"
      :label="t('ai.generate_tests')"
      :loading="isGenerating"
      @click="generateTests"
    />

    <HoppModal v-if="showPreview" @close="showPreview = false">
      <template #title>{{ t('ai.generated_tests') }}</template>
      <template #body>
        <div class="code-preview">
          <CodemirrorEditor
            v-model="generatedTests"
            :language="'javascript'"
          />
        </div>
      </template>
      <template #footer>
        <HoppButtonPrimary
          :label="t('ai.apply_tests')"
          @click="applyTests"
        />
      </template>
    </HoppModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAIProvider } from '@hoppscotch/ai'
import { useRESTStore } from '~/stores/RESTSession'

const restStore = useRESTStore()
const aiProvider = useAIProvider()

const isGenerating = ref(false)
const showPreview = ref(false)
const generatedTests = ref('')

const hasResponse = computed(() => !!restStore.response)

async function generateTests() {
  isGenerating.value = true
  try {
    generatedTests.value = await aiProvider.generateTestScript({
      method: restStore.request.method,
      url: restStore.request.url,
      status: restStore.response.status,
      body: restStore.response.body,
      headers: restStore.response.headers
    })
    showPreview.value = true
  } finally {
    isGenerating.value = false
  }
}

function applyTests() {
  restStore.testScript = generatedTests.value
  showPreview.value = false
}
</script>
```

### Deliverables

| Artifact | Description |
|----------|-------------|
| `packages/hoppscotch-ai/` | New AI integration package |
| AI components | Vue components for AI features |
| Provider adapters | Ollama, OpenAI, Anthropic support |
| Updated stores | AI settings and state management |
| Tests | Full test coverage for AI features |
| Documentation | User guide for AI features |

---

## Use Case 4: Tech Stack Migration

### Objective

Demonstrate the migration capabilities by creating alternative implementations:

**Option A**: Migrate hoppscotch-cli from TypeScript/Node to **Go**
**Option B**: Create **React Native** mobile app from hoppscotch-common
**Option C**: Migrate hoppscotch-backend to **Rust**

### Recommended: CLI Migration (TypeScript → Go)

This is the most self-contained migration that demonstrates all aspects:

| Aspect | Source (TypeScript) | Target (Go) |
|--------|---------------------|-------------|
| Runtime | Node.js | Go binary |
| Package Manager | npm/pnpm | Go modules |
| Testing | Vitest | Go testing |
| CLI Framework | Commander.js | Cobra |
| HTTP Client | fetch/axios | net/http |
| JSON Handling | Native | encoding/json |

### Migration Agent Sessions

#### Session 1: Deep Discovery of CLI

```markdown
# Migration Prompt for Session 1

Perform deep analysis of hoppscotch-cli:

1. Map all CLI commands and options
2. Document input/output formats
3. Identify all dependencies
4. Create behavioral test suite
5. Generate golden test data

Output:
- cli_specification.json
- behavioral_tests/
- golden_data/
```

#### Session 2: Scaffold Go Project

```markdown
# Migration Prompt for Session 2

Create Go project structure:

1. Initialize Go module: github.com/hoppscotch/hoppscotch-cli-go
2. Set up Cobra CLI framework
3. Create package structure:
   - cmd/ (CLI commands)
   - internal/runner/ (collection runner)
   - internal/parser/ (collection parser)
   - pkg/types/ (shared types)
4. Set up Go testing framework
5. Configure CI/CD
```

#### Session 3-N: Feature Migration

```markdown
# Migration Prompt for Session 3+

Migrate feature by feature:

For each CLI command:
1. Read TypeScript implementation
2. Implement equivalent Go code
3. Run behavioral tests
4. Verify output matches exactly
5. Performance benchmark

Commands to migrate:
- hoppscotch test (run collections)
- hoppscotch run (single request)
- hoppscotch export (convert formats)
```

### Behavioral Comparison

```go
// behavioral_test.go
func TestCLIBehavior(t *testing.T) {
    testCases := loadGoldenData("golden_data/")

    for _, tc := range testCases {
        t.Run(tc.Name, func(t *testing.T) {
            // Run both implementations
            tsOutput := runTypeScriptCLI(tc.Args, tc.Input)
            goOutput := runGoCLI(tc.Args, tc.Input)

            // Compare outputs
            assert.JSONEq(t, tsOutput.Stdout, goOutput.Stdout)
            assert.Equal(t, tsOutput.ExitCode, goOutput.ExitCode)
        })
    }
}
```

### Deliverables

| Artifact | Description |
|----------|-------------|
| `hoppscotch-cli-go/` | Complete Go CLI implementation |
| Behavioral tests | Cross-implementation test suite |
| Migration report | Decisions, trade-offs, lessons |
| Performance comparison | Benchmarks vs TypeScript |

---

## Implementation Timeline

### Phase Overview

```
Week 1-2: Use Case 1 - Discovery
├── Session 1: Package analysis
├── Session 2: Feature mapping
├── Session 3: Runtime observation
└── Session 4: Documentation generation

Week 3-4: Use Case 2 - Coverage
├── Session 1: Coverage analysis
├── Sessions 2-5: Test generation for priority features
└── Session 6: Fix flaky CLI tests

Week 5-8: Use Case 3 - AI Enhancement
├── Session 1: Planning
├── Sessions 2-4: AI Test Generation
├── Sessions 5-6: Smart Assertions
├── Session 7: AI Documentation
└── Session 8: Debug Assistant

Week 9-10: Use Case 4 - CLI Migration
├── Session 1: CLI deep discovery
├── Session 2: Go scaffold
├── Sessions 3-6: Feature migration
└── Session 7: Validation & benchmarking
```

---

## Success Metrics

### Use Case 1: Discovery
- [ ] 100% of packages documented
- [ ] All features identified and cataloged
- [ ] Architecture diagrams generated
- [ ] Runtime behaviors captured

### Use Case 2: Coverage
- [ ] Line coverage > 80%
- [ ] Branch coverage > 70%
- [ ] Zero flaky tests
- [ ] All features have tests

### Use Case 3: Enhancement
- [ ] AI Test Generation working with Ollama
- [ ] Smart Assertions integrated
- [ ] All tests passing
- [ ] User documentation complete

### Use Case 4: Migration
- [ ] Go CLI passes all behavioral tests
- [ ] Performance equal or better
- [ ] All commands migrated
- [ ] Published as release

---

## References

- [Hoppscotch GitHub](https://github.com/hoppscotch/hoppscotch)
- [Hoppscotch Documentation](https://docs.hoppscotch.io/)
- [CLI Tests Issue #4136](https://github.com/hoppscotch/hoppscotch/issues/4136)
- [DeepWiki Hoppscotch Analysis](https://deepwiki.com/hoppscotch/hoppscotch)
