# Exploratory Testing Charter: Simple Agent

## Session Information

| Field | Value |
|-------|-------|
| **Target** | Simple Agent (rule-based pattern matching) |
| **Duration** | 60 minutes |
| **Tester** | [Your Name] |
| **Date** | [YYYY-MM-DD] |

## Mission

Explore the Simple Agent's pattern matching capabilities and find edge cases where the rule-based routing fails or produces unexpected results.

### Focus Areas

- [ ] Math operation detection accuracy
- [ ] Edge cases in number extraction
- [ ] Fallback behavior for ambiguous inputs
- [ ] Workflow execution reliability
- [ ] Error handling and recovery

### Test Ideas

1. **Ambiguous math operations**: "add 5 and subtract 3" - which operation wins?
2. **No numbers in math query**: "calculate the sum" - what happens?
3. **Mixed language**: "calculate cinco plus three" - number extraction fails?
4. **Very large numbers**: "calculate 999999999999999999 + 1" - overflow?
5. **Negative numbers in text**: "calculate minus five plus three"
6. **Floating point in text**: "calculate one point five plus two point five"
7. **Special characters**: "calculate 5+3" vs "calculate 5 + 3"
8. **Time keywords in non-time context**: "time to calculate 5 + 5"
9. **Status keyword in non-status context**: "what is the status of 5 + 5"
10. **Rapid consecutive commands**: Execute 10 tasks quickly

## Session Notes

### Observations

| Time | Observation | Severity |
|------|-------------|----------|
| | | |

### Questions Raised

- [ ] How does the agent handle queries with multiple valid patterns?
- [ ] What is the maximum number extraction capability?

## Findings Summary

### Bugs Found

| ID | Description | Severity | Reproducible | Automation Candidate |
|----|-------------|----------|--------------|---------------------|
| | | | | |

### Areas Needing More Testing

- [ ] [Fill in during session]

### Positive Observations

- [Fill in during session]

## Session Metrics

| Metric | Value |
|--------|-------|
| Duration | |
| Bugs Found | |
| Automation Candidates | |
| Coverage Gaps Identified | |

## Follow-up Actions

- [ ] [Fill in after session]
