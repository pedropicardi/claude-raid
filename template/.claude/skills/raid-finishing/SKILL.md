---
name: raid-finishing
description: "Use after Phase 4 review is approved. Agents debate whether the work truly covers all tasks and requirements before presenting merge options. Verifies tests, presents options, cleans up."
---

# Raid Finishing — Complete the Development Branch

Debate completeness. Verify. Present options. Execute. Clean up.

**Violating the letter of this process is violating its spirit.**

## Mode Behavior

- **Full Raid**: All 3 agents debate completeness independently. Full verification.
- **Skirmish**: 1 agent + Wizard verify completeness.
- **Scout**: Wizard verifies alone.

## Wizard Checklist

1. **Dispatch completeness debate** — agents argue whether it's truly done
2. **Wizard rules on completeness** — only proceed if ruling is "complete"
3. **Verify all tests pass** — full suite, fresh run using test command from `.claude/raid.json`
4. **Present options** — exactly 4 choices
5. **Execute choice** — merge, PR, keep, or discard
6. **Clean up worktree** — if applicable

## Step 1: The Completeness Debate

**📡 DISPATCH:**

> **Warrior**: Review against the plan. Every task completed? Every acceptance criterion met? Every test passing?
>
> **Archer**: Review against the design doc. Every requirement covered? Naming consistent? File structure clean?
>
> **Rogue**: Adversarial angle. What did we miss? What edge case is untested? What will break in production?

⚡ WIZARD RULING: [Complete | Incomplete — return to Phase 3/4]

## Step 2: Present Options

```
⚡ WIZARD RULING: Implementation complete and verified.

Options:
1. Merge back to [base-branch] locally
2. Push and create a Pull Request
3. Keep the branch as-is (handle later)
4. Discard this work

Which option?
```

## Red Flags

- Never proceed with failing tests
- Never merge without testing the merged result
- Never delete work without explicit confirmation
- Never skip the completeness debate
