---
name: raid-implementation-plan
description: "Phase 2 of Raid protocol. Agents create the plan together and test each other for full compliance with the design, test coverage, naming consistency, and file system patterns."
---

# Raid Implementation Plan — Phase 2

Break the design into bite-sized, battle-tested tasks through collaborative adversarial decomposition.

<HARD-GATE>
Do NOT start implementation until the plan is approved by the Wizard and committed to git. All assigned agents participate in plan creation AND review. No subagents.
</HARD-GATE>

## Mode Behavior

- **Full Raid**: All 3 agents decompose independently, then build the plan together. Full plan doc.
- **Skirmish**: 2 agents. Plan is combined with the design doc into one lightweight document.
- **Scout**: Skip this skill. Wizard creates inline tasks directly. No plan doc needed.

## Wizard Checklist

1. **Read the approved design doc** — every requirement, every constraint
2. **Dispatch decomposition** — agents decompose independently
3. **Observe the collaborative fight** — agents test each other's plans for compliance
4. **Synthesize** — merge the best elements
5. **Write the plan doc** — save to plans path from `.claude/raid.json` (default: `docs/raid/plans/YYYY-MM-DD-<feature>-plan.md`)
6. **Adversarial plan review** — agents attack the written plan
7. **Wizard ruling** — final plan approval
8. **Commit** — `docs(plan): <feature> implementation plan`
9. **Transition** — invoke `raid-implementation`

## Collaborative Plan Creation

After independent decomposition, agents build together:

1. **Compare decompositions** — where they agree (high confidence) and disagree (needs discussion)
2. **Test compliance with design** — every agent verifies the plan covers every requirement. Line by line. No gaps.
3. **Test naming consistency** — all names consistent with each other, the codebase, and the design doc
4. **Test file system consistency** — file paths follow project structure, module organization clean
5. **Test coverage** — every task has tests covering failure paths and edge cases
6. **Test ordering** — dependencies correct, build won't break between commits
7. **Learn from disagreements** — resolutions reveal better approaches

## Plan Document Header

```markdown
# [Feature Name] Implementation Plan

**Design Doc:** `[path to spec]`
**Goal:** [One sentence]
**Architecture:** [2-3 sentences]
**Tech Stack:** [Key technologies]
**Naming Conventions:** [Patterns used]
**File Structure:** [Where new files go]
**Test Command:** [from .claude/raid.json]
```

## Task Structure

Each task follows TDD. Test command from `.claude/raid.json`:

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.ext`
- Modify: `exact/path/to/existing.ext`
- Test: `tests/exact/path/to/test.ext`

**Acceptance Criteria:**
- [ ] [Specific, verifiable criterion]
- [ ] All tests pass
- [ ] No regressions
- [ ] Naming follows established patterns

**Steps:**
- [ ] Step 1: Write the failing test
- [ ] Step 2: Run test, verify it fails
- [ ] Step 3: Write minimal implementation
- [ ] Step 4: Run test, verify it passes
- [ ] Step 5: Commit
````

## No Placeholders — Ever

Never write: "TBD", "TODO", "implement later", "Add appropriate error handling", "Write tests for the above", "Similar to Task N", "Handle edge cases".

**Violating the letter of the "no placeholders" rule is violating its spirit.**

## Self-Review

1. **Spec coverage:** Every requirement has a task?
2. **Placeholder scan:** TBD, TODO, vague descriptions?
3. **Type/name consistency:** Signatures match across tasks?
4. **File structure consistency:** Paths follow conventions?
5. **Test quality:** Every task has tests? Failure paths covered?
6. **Ordering:** Each task buildable and commitable independently?

After self-review: Wizard delivers ruling and commits.
