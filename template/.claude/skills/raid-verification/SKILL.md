---
name: raid-verification
description: "Use before claiming any work is complete, fixed, or passing. No completion claims without fresh verification evidence. Challengers verify independently. No subagents."
---

# Raid Verification — Evidence Before Claims

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating its spirit.**

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command THIS turn, you cannot claim it passes.

## Mode Behavior

- **Full Raid**: Triple verification — implementer + 2 challengers verify independently.
- **Skirmish**: Double verification — implementer + 1 challenger.
- **Scout**: Single verification + Wizard confirms.

## The Gate Function

```
BEFORE claiming any status:
1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
   Use test command from .claude/raid.json
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   If NO → state actual status with evidence
   If YES → state claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

This gate applies to EVERY status claim: "tests pass", "bug fixed", "feature complete", "regression resolved", "no issues found."

## Common Failures

| Claim | Requires | NOT Sufficient |
|-------|----------|----------------|
| "Tests pass" | Test command output: 0 failures | Previous run, "should pass", changed code without re-running |
| "Bug fixed" | Reproduce original symptom: now passes | Code changed, assumed fixed |
| "No regressions" | Full test suite: all pass | Running only new tests |
| "Feature complete" | All acceptance criteria verified with evidence | Self-assessment without running tests |
| "Regression test works" | Red-green cycle verified | Test passes once without seeing it fail |

## Forbidden Phrases Without Evidence

These phrases are NEVER allowed without preceding verification output:

- "Done", "Complete", "Fixed", "Working", "Passing"
- "Should work", "Probably fine", "Looks correct"
- "Great!", "Perfect!", "All good!"

Replace with: `[command] output shows [evidence]. [Claim].`

Example:
- Bad: "Tests pass."
- Good: "`npm test` output: 31 passing, 0 failing. Tests pass."

## Raid Triple Verification

The implementer's claim is NOT sufficient. The Wizard requires:

1. **Implementer verifies** — runs tests, reports with evidence (command + output)
2. **Challenger 1 verifies independently** — runs same tests, confirms output matches
3. **Challenger 2 verifies adversarially** — runs tests PLUS tries to break it with edge cases

Only after all required verifications confirm does the Wizard accept.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification. "Should" is not evidence. |
| "I'm confident" | Confidence ≠ evidence. Confident people ship bugs too. |
| "Just this once" | Every "just this once" is a bug waiting to ship. No exceptions. |
| "Agent said success" | Verify independently. Reports lie — run the command yourself. |
| "Partial check is enough" | Partial verification proves nothing about the whole. Run the full suite. |
| "Different words so rule doesn't apply" | Spirit over letter. If you're claiming status without evidence, you're violating this. |
| "I already verified earlier" | Earlier is not now. Code may have changed. Fresh run required. |

## Red Flags

| Thought | Reality |
|---------|---------|
| "I just ran the tests, they should still pass" | "Should" is not evidence. Run again. |
| "The fix is obvious, it definitely works" | Obvious fixes break in non-obvious ways. Verify. |
| "I don't need to verify a one-line change" | One-line changes cause production outages. Verify. |
| Expressing satisfaction before verification | Satisfaction is not evidence. Run the command first. |
| "Let me just commit and verify after" | Committing before verification = shipping unverified code. |

## Why This Matters

From real-world failure patterns:
- Undefined functions shipped because "tests pass" was claimed without running
- Missing requirements deployed because "feature complete" was asserted without checking spec
- Hours wasted because "fixed" was reported without reproducing the original bug
- Trust broken because claims weren't backed by evidence

Every one of these was avoidable with: run the command, read the output, THEN claim.

Run the command. Read the output. THEN claim the result. Non-negotiable.
