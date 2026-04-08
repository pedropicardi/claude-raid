---
name: raid-implementation
description: "Phase 3 of Raid protocol. Execute the plan task by task with adversarial cross-validation. One agent implements, two attack. Rotate. TDD enforced. No subagents."
---

# Raid Implementation — Phase 3

One builds, two attack. Rotate. Every implementation earns its approval.

<HARD-GATE>
Do NOT implement without an approved plan (except Scout mode). Do NOT skip TDD. Do NOT let any implementation pass unchallenged. Do NOT use subagents. Use `raid-tdd` skill for all test-driven development. Use `raid-verification` before any completion claims.
</HARD-GATE>

## Mode Behavior

- **Full Raid**: 1 implements, 2 challenge. Rotate implementer across tasks.
- **Skirmish**: 1 implements, 1 challenges. Swap roles each task.
- **Scout**: 1 agent implements. Wizard reviews. Self-challenge ruthlessly.

TDD is enforced in ALL modes.

## Wizard Checklist

1. **Read the plan** — extract all tasks, dependencies, ordering
2. **Set up worktree** — use `raid-git-worktrees` for isolation (optional)
3. **Assign first task** — one implementer, challengers based on mode
4. **Run the gauntlet** — implement -> challenge -> fix -> approve per task
5. **Track progress** — use TaskCreate/TaskUpdate. Mark complete only after Wizard ruling
6. **After all tasks** — invoke `raid-review`

## The Implementation Gauntlet (per task)

### Step 1: Wizard Assigns
One agent implements. Others prepare to attack. **Rotate the implementer** across tasks — use TaskCreate to track assignments and ensure no agent implements twice in a row.

### Step 2: Implementer Executes (TDD)
Following `raid-tdd` strictly:
1. Write the failing test from the plan
2. Run test command from `.claude/raid.json` — verify it fails for the RIGHT reason
3. Write minimal code to pass
4. Run — verify pass
5. Run FULL test suite — verify no regressions
6. Self-review against acceptance criteria
7. Commit: `feat(scope): descriptive message`

**Status:** DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED

### Step 3: Challengers Attack
Each challenger independently:
1. Reads ACTUAL CODE (not the implementer's report — reports lie)
2. Verifies against task spec line by line
3. Checks against design doc requirements
4. Tries to break it — edge cases, failure scenarios, adversarial inputs
5. Checks test quality — do tests prove correctness or just confirm happy path?
6. Checks naming consistency and file structure
7. Presents findings with evidence

### Step 4: Implementer Responds
Defend with evidence or concede immediately. Fix conceded issues. Re-run all tests.

### Step 5: Wizard Rules
⚡ WIZARD RULING: Task N [approved | needs fixes]

## Quality Gates Per Task

- [ ] Tests written BEFORE implementation (TDD)
- [ ] Tests fail for the right reason
- [ ] Tests pass after implementation
- [ ] Full test suite passes (no regressions)
- [ ] Challengers reviewed the actual code
- [ ] All challenges addressed (fixed or defended with evidence)
- [ ] Implementation matches task spec (nothing more, nothing less)
- [ ] Naming follows established patterns
- [ ] Code committed with descriptive message

## Red Flags

**Never:** Implement without a failing test first. Skip cross-testing. Proceed with unfixed challenges. Trust the implementer's self-report. Skip the full test suite between tasks.

**Always:** Rotate the implementer role. Read actual code, not reports. Fix issues immediately. Commit after each task. Run the full test suite.
