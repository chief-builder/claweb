# Exploratory Testing Charter: Intelligent Agent

## Session Information

| Field | Value |
|-------|-------|
| **Target** | Intelligent Agent (Claude Haiku integration) |
| **Duration** | 90 minutes |
| **Tester** | [Your Name] |
| **Date** | [YYYY-MM-DD] |

## Mission

Explore the Intelligent Agent's LLM-powered tool selection and discover edge cases where the AI makes unexpected decisions, provides incorrect results, or exhibits unusual behavior.

### Focus Areas

- [ ] Tool selection accuracy for ambiguous queries
- [ ] Multi-tool query handling
- [ ] Conversation context retention
- [ ] Error handling when tools fail
- [ ] Response quality and coherence
- [ ] Iteration count and efficiency

### Test Ideas

1. **Ambiguous tool selection**: "Add the time to my calculation" - which tool?
2. **Conflicting instructions**: "Calculate 5 + 3 but don't use the calculator"
3. **Meta-questions**: "What tools do you have access to?"
4. **Tool chaining complexity**: "Calculate 5+3, echo the result, then tell me the time"
5. **Context limits**: 10+ turn conversation, reference early messages
6. **Incorrect context assumption**: After calculation, ask "what is the capital of France?"
7. **Rapid topic switching**: Math → Time → Status → Math
8. **Vague requests**: "Help me with something" - does it ask for clarification?
9. **Impossible requests**: "Calculate the square root of -1"
10. **Long inputs**: Very long message (1000+ characters)
11. **Empty/whitespace inputs**: " " or ""
12. **Unicode edge cases**: Math in different scripts "五 + 三"
13. **Conversation reset verification**: After reset, reference previous context

## Session Notes

### Observations

| Time | Observation | Severity |
|------|-------------|----------|
| | | |

### Questions Raised

- [ ] How many iterations does it typically take for complex queries?
- [ ] Does it ever get stuck in a loop?
- [ ] How does it handle Claude API rate limits?

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
| API Calls Made | |

## Follow-up Actions

- [ ] [Fill in after session]
