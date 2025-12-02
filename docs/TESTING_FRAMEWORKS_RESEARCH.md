# Open Source Testing Frameworks Research

## Focus: Non-Deterministic & AI/ML Testing Enhancement Opportunities

This document captures research on open source testing frameworks, with special attention to those that can be enhanced to support non-deterministic and AI workloads.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The Non-Deterministic Testing Challenge](#the-non-deterministic-testing-challenge)
3. [Traditional Testing Frameworks](#traditional-testing-frameworks)
4. [AI/LLM-Specific Testing Frameworks](#aillm-specific-testing-frameworks)
5. [Gap Analysis](#gap-analysis)
6. [Enhancement Opportunities](#enhancement-opportunities)
7. [Recommended Projects](#recommended-projects)

---

## Executive Summary

### The Problem

Traditional testing frameworks are built on deterministic assumptions:
- **Input X → Output Y** (always)
- **Binary assertions**: pass or fail
- **Reproducibility**: same test, same result

AI/ML systems break these assumptions:
- **Input X → Output Y₁, Y₂, Y₃...** (probabilistic)
- **Quality is a spectrum**: acceptable, good, excellent
- **Non-reproducibility**: same prompt, different response

### The Opportunity

There's a significant gap between:
1. **Mature traditional frameworks** (pytest: 13.3k stars, Jest: 44k stars) with rich ecosystems
2. **Nascent AI testing tools** (DeepEval: 12.4k stars, promptfoo: 9.3k stars) with limited integrations

**The winning strategy**: Enhance traditional frameworks with AI-aware capabilities rather than building from scratch.

---

## The Non-Deterministic Testing Challenge

### Key Challenges Identified

| Challenge | Traditional Approach | AI/ML Reality |
|-----------|---------------------|---------------|
| **Assertion model** | `assert output == expected` | Output varies each run |
| **Pass/fail criteria** | Binary | Probabilistic thresholds |
| **Test flakiness** | Bug to fix | Expected behavior |
| **Reproducibility** | Required | Often impossible |
| **Coverage metrics** | Line/branch coverage | Behavioral coverage |
| **Regression detection** | Exact match | Semantic similarity |

### Research Findings

From [Beyond Traditional Testing](https://dev.to/aws/beyond-traditional-testing-addressing-the-challenges-of-non-deterministic-software-583a):

> "Key strategies for testing non-deterministic software include property-based testing, repeatable environments, semantic similarity checking, and LLM-assisted test generation and validation."

From [AI Agent Evaluation Challenges](https://toloka.ai/blog/ai-agent-evaluation-methodologies-challenges-and-emerging-standards/):

> "Issues such as non-determinism, non-reproducibility, and prompt sensitivity have drawn attention to the need for more robust quality assurance practices."

---

## Traditional Testing Frameworks

### Tier 1: High-Star Frameworks

#### 1. **pytest** (Python)

| Metric | Value |
|--------|-------|
| **Stars** | 13,300+ |
| **Open Issues** | 864 |
| **Used By** | 1.6M projects |
| **Plugin Ecosystem** | 1,300+ plugins |

**Current AI-related plugins:**
- [pytest-evals](https://github.com/AlmogBaku/pytest-evals) - Minimalistic LLM evaluation
- [flaky](https://github.com/box/flaky) - Retry flaky tests (addresses non-determinism symptom)
- [pytest-xflaky](https://github.com/Tesorio/pytest-xflaky) - Quarantine flaky tests

**Enhancement gap**: No native support for:
- Statistical assertions (confidence intervals)
- Semantic similarity matching
- LLM-as-judge integration
- Probabilistic pass/fail thresholds

---

#### 2. **Hypothesis** (Python Property-Based Testing)

| Metric | Value |
|--------|-------|
| **Stars** | 8,300+ |
| **Open Issues** | 56 |
| **Used By** | 33.9k projects |
| **Downloads** | 8M+/week |

**Why this matters for AI testing:**
- Already handles non-determinism (random input generation)
- Shrinking finds minimal failing examples
- Used by Stripe for ML pipeline testing

**Enhancement gap**:
- No LLM output strategies
- No semantic similarity matchers
- No probabilistic property definitions

---

#### 3. **Robot Framework** (Python)

| Metric | Value |
|--------|-------|
| **Stars** | 11,300+ |
| **Open Issues** | 228 |
| **Used By** | 13k projects |

**Current AI extensions:**
- [robotframework-ai](https://github.com/MarketSquare/robotframework-ai) - Test data generation with AI

**Enhancement gap**:
- No LLM assertion keywords
- No behavioral comparison keywords
- Limited statistical validation

---

#### 4. **Great Expectations** (Data Testing)

| Metric | Value |
|--------|-------|
| **Stars** | 11,000+ |
| **Open Issues** | 64 |
| **Contributors** | 434 |

**Relevant for AI testing:**
- Data drift detection (useful for ML input validation)
- Expectation-based testing model
- [BirdiDQ](https://github.com/BirdiD/BirdiDQ) - Natural language expectations via LLM

**Enhancement gap**:
- No LLM output expectations
- No embedding similarity expectations
- Limited to structured data

---

### Tier 2: JavaScript Ecosystem

#### 5. **Jest** (JavaScript)

| Metric | Value |
|--------|-------|
| **Stars** | ~44,000 |
| **Ecosystem** | Dominant in React |

**Enhancement gap**:
- No native AI/LLM matchers
- Flaky test handling is symptom-focused
- No statistical assertions

---

## AI/LLM-Specific Testing Frameworks

### Leading Frameworks

#### 1. **DeepEval** ⭐ Most Comprehensive

| Metric | Value |
|--------|-------|
| **Stars** | 12,400+ |
| **Open Issues** | 209 |
| **License** | Apache-2.0 |

**Strengths:**
- pytest-like syntax for LLM testing
- 30+ built-in metrics (G-Eval, hallucination, RAGAS)
- Component-level tracing with decorators
- Red teaming / security scanning

**Limitations:**
- Heavy dependency on external LLM APIs for evaluation
- Cloud platform (Confident AI) lock-in risk
- Limited offline/local evaluation options

---

#### 2. **promptfoo** ⭐ Developer-Friendly

| Metric | Value |
|--------|-------|
| **Stars** | 9,300+ |
| **Open Issues** | 156 |
| **Language** | TypeScript |
| **Users** | 200k+ |

**Strengths:**
- Declarative YAML-based test configs
- Multi-provider comparison (GPT, Claude, Llama, etc.)
- GitHub Actions integration
- 100% local execution (privacy-friendly)
- Red teaming capabilities

**Limitations:**
- JavaScript/TypeScript focused
- Limited Python integration
- No pytest plugin

---

#### 3. **Giskard**

| Metric | Value |
|--------|-------|
| **Stars** | ~4,000 |
| **Focus** | Bias, security, performance |

**Strengths:**
- Auto-detects vulnerabilities (hallucination, bias, prompt injection)
- RAG-specific toolkit (RAGET)
- Works with both LLMs and traditional ML

**Limitations:**
- Smaller community than DeepEval/promptfoo
- Less CI/CD integration documentation

---

#### 4. **OpenAI Evals**

| Metric | Value |
|--------|-------|
| **Stars** | ~16,000 |
| **Maintainer** | OpenAI |

**Strengths:**
- Extensive eval registry
- Standard benchmarks (MMLU, HumanEval)
- CI/CD integration support

**Limitations:**
- OpenAI-centric (though works with other providers)
- Complex setup for custom evals
- Less community-driven

---

#### 5. **lm-evaluation-harness** (EleutherAI)

| Metric | Value |
|--------|-------|
| **Stars** | ~7,000 |
| **Used By** | HuggingFace Leaderboard, NVIDIA, Cohere |

**Strengths:**
- Industry standard for model benchmarking
- Massive task library
- Academic rigor

**Limitations:**
- Model evaluation focused (not application testing)
- Heavy setup requirements
- Less suited for CI/CD workflows

---

## Gap Analysis

### What's Missing in Traditional Frameworks

| Capability | pytest | Jest | Hypothesis | Great Expectations |
|------------|--------|------|------------|-------------------|
| Statistical assertions | ❌ | ❌ | Partial | ❌ |
| Semantic similarity | ❌ | ❌ | ❌ | ❌ |
| LLM-as-judge | ❌ | ❌ | ❌ | Via BirdiDQ |
| Probabilistic thresholds | ❌ | ❌ | ❌ | ❌ |
| Embedding comparison | ❌ | ❌ | ❌ | ❌ |
| Response quality metrics | ❌ | ❌ | ❌ | ❌ |
| Behavioral regression | ❌ | ❌ | ❌ | ❌ |

### What's Missing in AI-Specific Frameworks

| Capability | DeepEval | promptfoo | Giskard |
|------------|----------|-----------|---------|
| pytest native integration | ✅ | ❌ | Partial |
| Offline evaluation | Limited | ✅ | Partial |
| Traditional test mixing | ❌ | ❌ | ❌ |
| Property-based generation | ❌ | ❌ | ❌ |
| Statistical confidence | Limited | Limited | Limited |
| Cross-language support | Python only | JS primary | Python only |

---

## Enhancement Opportunities

### Opportunity 1: pytest Plugin for AI Testing

**Project**: Create `pytest-ai` - comprehensive AI testing plugin

**Features to implement:**
```python
# Statistical assertions
def test_model_accuracy():
    results = [model.predict(x) for x in test_data]
    assert_statistically(
        metric=accuracy(results),
        threshold=0.85,
        confidence=0.95,
        samples=100
    )

# Semantic similarity
def test_response_quality():
    response = llm.generate("Explain quantum computing")
    assert_semantically_similar(
        response,
        reference="Quantum computing uses qubits...",
        threshold=0.8
    )

# LLM-as-judge
def test_helpfulness():
    response = assistant.respond("How do I cook pasta?")
    assert_llm_judges(
        response,
        criteria="helpful, accurate, safe",
        min_score=4,
        max_score=5
    )

# Probabilistic pass
@pytest.mark.probabilistic(pass_rate=0.9, runs=10)
def test_creative_output():
    poem = llm.generate("Write a haiku about testing")
    assert len(poem.split('\n')) == 3
```

**Why this matters:**
- Leverages pytest's 1.6M project user base
- Integrates with existing CI/CD workflows
- Gradual adoption (mix AI and traditional tests)

---

### Opportunity 2: Hypothesis Strategies for LLM Testing

**Project**: `hypothesis-llm` - LLM-aware property testing

**Features to implement:**
```python
from hypothesis import given
from hypothesis_llm import llm_outputs, prompts, contexts

@given(prompt=prompts(topic="customer_service"))
def test_response_always_polite(prompt):
    response = chatbot.respond(prompt)
    assert not contains_rude_language(response)

@given(context=contexts(domain="medical"))
def test_no_dangerous_advice(context):
    response = assistant.respond(context.question)
    assert not gives_medical_diagnosis(response)

# Adversarial prompt generation
@given(prompt=adversarial_prompts(target="jailbreak"))
def test_resists_jailbreak(prompt):
    response = llm.generate(prompt)
    assert stays_in_character(response)
```

**Why this matters:**
- Property-based testing is natural fit for AI
- Hypothesis already handles non-determinism
- Shrinking finds minimal failing prompts

---

### Opportunity 3: Great Expectations for LLM Outputs

**Project**: Extend Great Expectations with LLM expectations

**Features to implement:**
```python
# New expectation types
validator.expect_llm_response_to_be_relevant(
    column="assistant_response",
    context_column="user_query",
    relevance_threshold=0.7
)

validator.expect_no_hallucinations(
    response_column="answer",
    source_column="context",
    method="nli"  # Natural Language Inference
)

validator.expect_sentiment_in_range(
    column="response",
    min_sentiment=-0.2,
    max_sentiment=0.8
)

validator.expect_response_length_reasonable(
    column="output",
    task_type="summarization",
    input_column="document"
)
```

**Why this matters:**
- Data teams already use Great Expectations
- Natural extension for ML pipelines
- Connects data quality to model quality

---

### Opportunity 4: Cross-Framework Test Orchestration

**Project**: Universal AI test runner bridging frameworks

**Vision:**
```yaml
# ai-tests.yaml
test_suites:
  - name: "Response Quality"
    framework: deepeval
    tests:
      - metric: answer_relevancy
        threshold: 0.8

  - name: "Security"
    framework: promptfoo
    tests:
      - type: red_team
        attacks: [jailbreak, prompt_injection]

  - name: "Regression"
    framework: pytest
    tests:
      - file: tests/test_api.py
        markers: [regression]

  - name: "Properties"
    framework: hypothesis
    tests:
      - module: tests.property_tests
```

---

## Recommended Projects

### For Our Modernization Agent System

Based on the research, here are the top candidates that fit all 4 use cases:

#### Tier 1: Best Fit

| Project | Stars | Why It Fits |
|---------|-------|-------------|
| **pytest** | 13.3k | Massive ecosystem, missing AI plugins, 864 open issues |
| **Hypothesis** | 8.3k | Natural fit for non-determinism, needs LLM strategies |
| **DeepEval** | 12.4k | Growing fast, needs offline/local improvements |

#### Tier 2: Strong Candidates

| Project | Stars | Why It Fits |
|---------|-------|-------------|
| **promptfoo** | 9.3k | Needs Python integration, pytest plugin |
| **Great Expectations** | 11k | Needs LLM expectations, accepting PRs |
| **Robot Framework** | 11.3k | Needs AI keywords, 228 open issues |

---

### Recommended Exercise Plan

#### Option A: Enhance pytest for AI Testing

```
Use Case 1: Document pytest's assertion system
Use Case 2: Add test coverage for plugin system
Use Case 3: Create pytest-ai plugin with:
           - Statistical assertions
           - Semantic similarity matchers
           - LLM-as-judge integration
Use Case 4: Port core functionality to Jest (pytest-ai → jest-ai)
```

#### Option B: Bridge DeepEval and pytest

```
Use Case 1: Document DeepEval's metric system
Use Case 2: Add tests for edge cases (offline mode, local LLMs)
Use Case 3: Enhance with:
           - Hypothesis integration
           - Great Expectations bridge
           - Offline evaluation modes
Use Case 4: Create TypeScript version for Jest ecosystem
```

#### Option C: Create Hypothesis LLM Strategies

```
Use Case 1: Document Hypothesis strategy system
Use Case 2: Add tests for custom strategies
Use Case 3: Create hypothesis-llm with:
           - Prompt generation strategies
           - Adversarial input generation
           - Semantic output validation
Use Case 4: Port to JavaScript (fast-check integration)
```

---

## References

### Traditional Testing Frameworks
- [pytest](https://github.com/pytest-dev/pytest) - 13.3k stars
- [Hypothesis](https://github.com/HypothesisWorks/hypothesis) - 8.3k stars
- [Jest](https://github.com/jestjs/jest) - ~44k stars
- [Robot Framework](https://github.com/robotframework/robotframework) - 11.3k stars
- [Great Expectations](https://github.com/great-expectations/great_expectations) - 11k stars

### AI/LLM Testing Frameworks
- [DeepEval](https://github.com/confident-ai/deepeval) - 12.4k stars
- [promptfoo](https://github.com/promptfoo/promptfoo) - 9.3k stars
- [Giskard](https://github.com/Giskard-AI/giskard-oss) - ~4k stars
- [OpenAI Evals](https://github.com/openai/evals) - ~16k stars
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) - ~7k stars

### Flaky/Non-Deterministic Test Handling
- [flaky](https://github.com/box/flaky) - pytest plugin for retrying
- [pytest-xflaky](https://github.com/Tesorio/pytest-xflaky) - Flaky test quarantine
- [Non-deterministic testing examples](https://github.com/danilop/non-deterministic-software-testing)

### Research
- [Beyond Traditional Testing](https://dev.to/aws/beyond-traditional-testing-addressing-the-challenges-of-non-deterministic-software-583a)
- [AI Agent Evaluation Survey](https://arxiv.org/html/2507.21504v1)
- [Testing Practices in AI Agent Frameworks](https://arxiv.org/html/2509.19185v1)
