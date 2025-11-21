# Automation Candidates

This document tracks manual test findings that should be converted to automated tests.

## Overview

When manual testing discovers reproducible issues, we should create automated regression tests to prevent recurrence. This document tracks the queue of findings pending automation.

## Pending Automation

| Finding ID | Description | Priority | Target Test Type | Assignee | Status |
|------------|-------------|----------|------------------|----------|--------|
| [example] | Calculator fails with very large numbers | High | Unit | | Pending |

## Recently Automated

| Finding ID | Description | Test File | PR | Date |
|------------|-------------|-----------|-----|------|
| | | | | |

## How to Add Items

When you discover a bug during manual testing:

1. Document the finding in `findings/` using the template
2. Mark "Automation Candidate: Yes" if applicable
3. Add an entry to this document
4. Include reproduction steps in the finding

## How to Process Items

1. Pick an item from "Pending Automation"
2. Create the automated test
3. Verify it catches the bug
4. Create a PR with the test
5. Move the item to "Recently Automated"
6. Update the finding status

## Guidelines for Automation

### Should Automate

- Reproducible bugs with clear steps
- Edge cases that are easy to set up programmatically
- Regression-prone areas
- Security-related findings

### Should NOT Automate

- One-off environmental issues
- Subjective quality concerns (use quality rubric instead)
- Issues requiring human judgment
- Timing-dependent issues that are inherently flaky

## Automation Debt Metrics

Track this monthly:

| Month | Items Added | Items Automated | Backlog Size |
|-------|-------------|-----------------|--------------|
| | | | |

## Contact

Questions about automation candidates? Contact the QA lead or add a comment to the relevant finding.
