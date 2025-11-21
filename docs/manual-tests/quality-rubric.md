# Agent Response Quality Rubric

## Overview

This rubric provides a standardized framework for evaluating the quality of agent responses during manual testing and quality reviews. Use this when conducting periodic quality assessments.

## Evaluation Process

1. Select 20 random conversations from recent usage
2. For each response, score using the criteria below
3. Calculate averages per criterion and overall
4. Identify patterns in low-scoring areas
5. Create improvement tickets for systematic issues

## Scoring Scale

| Score | Description |
|-------|-------------|
| 1 | Completely fails the criterion |
| 2 | Partially meets, major issues |
| 3 | Adequately meets the criterion |
| 4 | Exceeds expectations |
| 5 | Exceptional, exemplary |

## Evaluation Criteria

### 1. Correctness (Weight: 30%)

**Question**: Is the response factually accurate and does it correctly use tools?

| Score | Description |
|-------|-------------|
| 1 | Wrong answer, incorrect tool usage, or factual errors |
| 2 | Partially correct but with significant errors |
| 3 | Correct answer with minor imprecisions |
| 4 | Fully correct with accurate tool usage |
| 5 | Perfect accuracy with additional helpful context |

**Examples**:
- Score 1: "5 + 5 = 11" or used wrong tool
- Score 3: Correct answer but didn't show work
- Score 5: Correct answer, showed calculation, mentioned edge cases

---

### 2. Helpfulness (Weight: 25%)

**Question**: Does the response fully address the user's needs?

| Score | Description |
|-------|-------------|
| 1 | Completely unhelpful, ignores the request |
| 2 | Addresses part of the request, misses key elements |
| 3 | Addresses the request adequately |
| 4 | Fully addresses request, anticipates follow-ups |
| 5 | Exceptional help, proactively provides related info |

**Examples**:
- Score 1: Responds to wrong question entirely
- Score 3: Answers the question directly
- Score 5: Answers, explains reasoning, suggests next steps

---

### 3. Clarity (Weight: 20%)

**Question**: Is the response easy to understand?

| Score | Description |
|-------|-------------|
| 1 | Incomprehensible or severely confusing |
| 2 | Difficult to understand, requires re-reading |
| 3 | Clear enough, could be more concise |
| 4 | Clear and well-structured |
| 5 | Exceptionally clear, perfectly formatted |

**Examples**:
- Score 1: Garbled output or contradictory statements
- Score 3: Understandable but verbose
- Score 5: Concise, well-formatted, uses appropriate structure

---

### 4. Tone (Weight: 10%)

**Question**: Is the tone appropriate for the context?

| Score | Description |
|-------|-------------|
| 1 | Inappropriate (rude, condescending, or offensive) |
| 2 | Awkward or overly robotic |
| 3 | Neutral and acceptable |
| 4 | Friendly and professional |
| 5 | Perfectly calibrated to context |

**Examples**:
- Score 1: "That's a stupid question" or overly casual
- Score 3: Neutral, gets the job done
- Score 5: Warm but professional, matches user's communication style

---

### 5. Tool Transparency (Weight: 15%)

**Question**: Does the agent clearly communicate what actions it took?

| Score | Description |
|-------|-------------|
| 1 | Hides actions, user is confused about what happened |
| 2 | Mentions tools but unclear about process |
| 3 | Adequately explains actions taken |
| 4 | Clear about tools used and why |
| 5 | Perfect transparency, educational about the process |

**Examples**:
- Score 1: Returns result with no explanation of how
- Score 3: "I calculated 5 + 5 = 10"
- Score 5: "I used the calculator tool with add operation on 5 and 5, which returned 10"

---

## Evaluation Form

### Response Information

| Field | Value |
|-------|-------|
| Response ID | |
| Date | |
| Query Type | [calculation / time / status / multi-tool / other] |
| Agent Type | [simple / intelligent / oauth] |

### Scores

| Criterion | Weight | Score (1-5) | Weighted Score |
|-----------|--------|-------------|----------------|
| Correctness | 30% | | |
| Helpfulness | 25% | | |
| Clarity | 20% | | |
| Tone | 10% | | |
| Tool Transparency | 15% | | |
| **Total** | 100% | | |

### Comments

**Strengths**:

**Areas for Improvement**:

**Notable Issues**:

---

## Aggregated Scoring Template

Use this to track scores across multiple responses:

| Response # | Correctness | Helpfulness | Clarity | Tone | Transparency | Overall |
|------------|-------------|-------------|---------|------|--------------|---------|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| ... | | | | | | |
| **Average** | | | | | | |

## Quality Thresholds

| Overall Score | Rating | Action |
|---------------|--------|--------|
| 4.5 - 5.0 | Excellent | Document best practices |
| 3.5 - 4.4 | Good | Minor improvements needed |
| 2.5 - 3.4 | Acceptable | Identify improvement areas |
| 1.5 - 2.4 | Needs Work | Immediate attention required |
| 1.0 - 1.4 | Critical | Escalate to development team |

## Review Schedule

| Review Type | Frequency | Sample Size |
|-------------|-----------|-------------|
| Quick spot check | Weekly | 5 responses |
| Full quality review | Monthly | 20 responses |
| Deep dive (per criterion) | Quarterly | 50 responses |
