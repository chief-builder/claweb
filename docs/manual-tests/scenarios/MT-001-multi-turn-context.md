# Manual Test Scenario: MT-001

## Metadata

| Field | Value |
|-------|-------|
| **ID** | MT-001 |
| **Title** | Multi-Turn Conversation Context Retention |
| **Component** | intelligent-agent |
| **Complexity** | Medium |
| **Automation Status** | Partial automation (basic cases automated) |
| **Last Executed** | |
| **Last Result** | |

## Description

Verifies that the Intelligent Agent correctly maintains conversation context across multiple turns, including references to previous calculations, implicit context, and explicit memory requests.

## Prerequisites

- [ ] Server is built: `npm run build`
- [ ] ANTHROPIC_API_KEY is set in environment
- [ ] No other agent instances running

## Test Steps

### Step 1: Start Agent and Perform Initial Calculation

**Action**:
```bash
npm run agent:intelligent
# Then enter: "Calculate 50 plus 30"
```

**Expected**: Agent returns response containing "80"

**Actual**:

---

### Step 2: Reference Previous Result Implicitly

**Action**: Enter: "Now multiply that by 2"

**Expected**: Agent understands "that" refers to 80, returns response containing "160"

**Actual**:

---

### Step 3: Reference Previous Result Explicitly

**Action**: Enter: "What was my first calculation result?"

**Expected**: Agent recalls and mentions "80" from the first calculation

**Actual**:

---

### Step 4: Perform Unrelated Query

**Action**: Enter: "What time is it?"

**Expected**: Agent provides current time without losing conversation context

**Actual**:

---

### Step 5: Return to Math Context

**Action**: Enter: "Add 20 to my last calculation result"

**Expected**: Agent understands last calculation was 160, returns response containing "180"

**Actual**:

---

### Step 6: Test Context After 5+ Turns

**Action**: Enter: "Remind me of all the calculations we did"

**Expected**: Agent summarizes: 50+30=80, 80*2=160, 160+20=180

**Actual**:

---

### Step 7: Test Context Reset

**Action**:
1. Note the current conversation state
2. Restart the agent (Ctrl+C, then `npm run agent:intelligent`)
3. Enter: "What was my last calculation?"

**Expected**: Agent does not have context from previous session, responds appropriately

**Actual**:

---

## Expected Final State

Agent demonstrates reliable context retention within a session and appropriate context isolation between sessions.

## Pass Criteria

- [ ] Implicit references ("that", "it") correctly resolved
- [ ] Explicit memory queries return accurate information
- [ ] Context preserved across topic changes (time query)
- [ ] Multi-turn history accurately summarized
- [ ] Session isolation verified (no cross-session context leak)

## Test Execution Record

| Date | Tester | Result | Notes |
|------|--------|--------|-------|
| | | | |

## Notes

- If the agent fails to maintain context, check for conversation history truncation
- Claude API rate limits may affect test execution
- Consider testing with different calculation complexities
