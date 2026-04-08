---
name: raid-verification
description: "Use before claiming any work is complete, fixed, or passing. No completion claims without fresh verification evidence. Challengers verify independently. No subagents."
---

# Raid Verification — Evidence Before Claims

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating its spirit.**

## Mode Behavior

- **Full Raid**: Triple verification — implementer + 2 challengers verify independently.
- **Skirmish**: Double verification — implementer + 1 challenger.
- **Scout**: Single verification + Wizard confirms.

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command THIS turn, you cannot claim it passes.

## The Gate Function

```
BEFORE claiming any status:
1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
   Test command from .claude/raid.json
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   If NO -> state actual status with evidence
   If YES -> state claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## Forbidden Phrases Without Evidence

- "Done", "Complete", "Fixed", "Working", "Passing"
- "Should work", "Probably fine", "Looks correct"

Replace with: `[command] output shows [evidence]. [Claim].`

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Agent said success" | Verify independently |
| "Partial check is enough" | Partial proves nothing |
