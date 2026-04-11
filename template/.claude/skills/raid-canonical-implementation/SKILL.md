---
name: raid-canonical-implementation
description: "Use when Phase 4 (Implementation) begins in a Canonical Quest, after the plan is approved and committed."
---

# Raid Implementation — Phase 4

Execute the plan. The Wizard assigns tasks strategically by domain affinity — no dice, no challengers. Agents implement with TDD, report, and move to the next task. Cross-review happens in Phase 5.

<HARD-GATE>
Do NOT implement without an approved plan. Do NOT skip TDD — it is an Iron Law. Use `raid-tdd` skill for all test-driven development. Use `raid-verification` before any completion claims.
</HARD-GATE>

## Process Flow

```dot
digraph implementation {
  "Wizard reads plan + all prior deliverables" -> "Phase recap (PRD + Design + Plan)";
  "Phase recap (PRD + Design + Plan)" -> "Step 0: Agents review plan for concerns";
  "Step 0: Agents review plan for concerns" -> "Wizard divides tasks by domain affinity";
  "Wizard divides tasks by domain affinity" -> "Wizard assigns task to agent";
  "Wizard assigns task to agent" -> "Agent implements (TDD)";
  "Agent implements (TDD)" -> "Agent writes breakdown in task section";
  "Agent writes breakdown in task section" -> "Agent flags TURN_COMPLETE";
  "Agent flags TURN_COMPLETE" -> "Wizard assigns next task" -> "More tasks?" [shape=diamond];
  "More tasks?" -> "Wizard assigns task to agent" [label="yes"];
  "More tasks?" -> "Wizard produces summary table" [label="no"];
  "Wizard produces summary table" -> "Commit + report with deliverable link";
  "Commit + report with deliverable link" -> "Ask human: Review or Wrap-up?" [shape=doublecircle];
}
```

## Step 0: Critical Plan Review

Before any implementation begins, each agent reviews the plan independently:
- Are there concerns about feasibility or missing dependencies?
- Are any steps unclear or ambiguous?
- Does the plan match the design doc?

If concerns: raise via `WIZARD:` before starting. Fix the plan first. For minor issues, the wizard fixes the plan inline and gets human approval before implementation begins. For fundamental plan flaws, return to Phase 3.

**Branch guard:** Never implement on main/master without explicit human consent. Create a feature branch first.

## Wizard Checklist

1. **Read the plan** — extract all tasks, dependencies, ordering from task files
2. **Phase recap** — summarize PRD + Design + Plan findings. Present what carries forward.
3. **Dispatch plan review** — each agent reviews the plan, raises concerns via `WIZARD:`
4. **Resolve concerns** — fix plan issues before any implementation begins
5. **Browser setup (if `browser.enabled` in raid.json)**:
   - Check if `browser.startup` exists — if null, invoke `raid-browser` startup discovery FIRST
   - Check if Playwright is installed — if not, first task becomes "scaffold Playwright"
6. **Divide tasks strategically** — see Task Division below
7. **Create task tracking** — use TaskCreate for every plan task
8. **Dispatch tasks one at a time** — see Dispatch Protocol below
9. **After all tasks complete** — review the evolution log, verify all task reports are filled, fill the Implementation Summary table, polish before presenting to human
10. **Commit** — `feat(quest-{slug}): phase 4 implementation — {summary}`
11. **Report** — link `{questDir}/phases/phase-4-implementation.md` to the human
12. **Ask human** — Review phase or straight to Wrap-up?

## Task Division — Strategic Assignment

The Wizard assigns tasks deliberately. No dice roll, no rotation — strategic domain-based assignment:

- **Group by affinity:** Tasks that touch the same files or domain go to the same agent. This gives the agent continuity and deeper context across related changes.
- **Match lens to domain:** Wizard considers which agent's lens fits the task best. Infrastructure-heavy tasks suit Warrior's structural lens. Pattern-sensitive integrations suit Archer. Security/validation tasks suit Rogue.
- **Track dependencies:** Know which tasks block which. If task 10 depends on task 3 (currently being implemented by @warrior), don't assign task 10 to @archer yet — give them a non-blocked task instead, or have them wait.

**Example reasoning:**
> *"Tasks 1-3 all modify the auth module — assigning to @warrior for context continuity. Tasks 4-5 are integration points that need pattern consistency — @archer. Tasks 6-7 involve input validation and error paths — @rogue. Task 8 depends on tasks 1-3, so it waits until @warrior finishes those."*

## Dispatch Template

One agent at a time. Dispatch carries task assignment and file pointers. TDD protocol comes from the agent's `raid-tdd` skill. Report instructions are embedded in the evolution log.

```
TURN_DISPATCH: Task {N} — {task name}.
Quest: {description}

FIRST: Read the FULL document at {questDir}/phases/phase-4-implementation.md to understand
  the structure and find your task section. Read the embedded instructions in your section.
  Then read your task spec at {questDir}/spoils/tasks/phase-3-plan-task-{NN}.md.
THEN: Implement with TDD (load raid-tdd), fill your report in your section,
  and fill Implementation Notes in the task file.
Signal TURN_COMPLETE with status when done.
```

After `TURN_COMPLETE:`, the Wizard reads the report, then assigns the next task.

## Agent Implementation Protocol (TDD)

Following `raid-tdd` strictly:
1. Write the failing test from the plan
2. Run test command from `.claude/raid.json` — verify it fails for the RIGHT reason
3. Write minimal code to pass
4. Run — verify pass
5. Run FULL test suite — verify no regressions
6. Self-review against acceptance criteria
7. Write brief implementation breakdown in the task's "Implementation Notes" section
8. Commit: `feat(scope): descriptive message`

**Browser tasks (if `browser.enabled` and task involves browser-facing code):**
- BOOT app on assigned port before browser TDD (invoke `raid-browser`)
- Use Playwright MCP tools while authoring tests
- CLEANUP after task is complete (or on failure)

Signal `TURN_COMPLETE:` with status: **DONE** | **DONE_WITH_CONCERNS** | **NEEDS_CONTEXT** | **BLOCKED**

## Handling Agent Status

| Status | Action |
|--------|--------|
| **DONE** | Wizard reads breakdown, assigns next task |
| **DONE_WITH_CONCERNS** | Read concerns. If correctness: address before next task. If observations: note and proceed. |
| **NEEDS_CONTEXT** | Provide missing information. Re-dispatch same task. |
| **BLOCKED** | 1) Context → provide more. 2) Too complex → break into subtasks. 3) Plan wrong → fix plan. |

## When to STOP Executing

STOP implementing immediately when:
- Missing dependency not covered in plan
- Test fails for unexpected reason (not the expected "right" failure)
- Instruction is ambiguous — two valid interpretations exist
- Verification fails repeatedly (2+ times on same step)
- Implementation diverges significantly from plan

**Ask via `WIZARD:` rather than guessing.** The Wizard escalates to the human if needed.

## Evolution Log Template

Scaffold `{questDir}/phases/phase-4-implementation.md`. Wizard pre-fills one task slot per plan task with the assigned agent's name:

```markdown
# Phase 4: Implementation — Evolution Log

## Quest: [quest description]
## Quest Type: Canonical Quest

## References
- PRD: `{questDir}/spoils/prd.md` (if exists)
- Design: `{questDir}/spoils/design.md`
- Tasks: `{questDir}/spoils/tasks/phase-3-plan-task-*.md`

## Quest Goal
<!-- Wizard writes 2-3 lines: what the implementation aims to deliver,
     total task count, and the division strategy (which agent gets which domain) -->

## Task Assignment

<!-- Wizard fills this table after dividing tasks by domain affinity -->

| Task | Agent | Domain | Blocked By | Status |
|------|-------|--------|------------|--------|

---

## Task Reports

### Task 1: [Name] — @{assigned agent}

<!-- @{agent}: After completing this task, fill in the sections below.
     Sign your report. Be concise — this is a report, not a narrative.
     Also fill the Implementation Notes section in the Phase 3 task file.
     Update the Task Assignment table status to "complete" when done. -->

**Status:** pending | in_progress | complete | blocked
**Files Changed:**
<!-- List every file created or modified, with action:
     - `src/auth/handler.ts` (created)
     - `src/middleware.ts` (modified L45-60) -->

**Summary:**
<!-- 1-3 sentences: what was built, key decisions made, test count.
     Reference the task file for full spec. -->

**Commit:** `feat(scope): message`

**Deviations from Plan:**
<!-- If you deviated from the task spec, explain WHAT and WHY.
     If none: "None — implemented as specified." -->

---

<!-- Wizard pre-scaffolds one slot per task with the assigned agent's name -->

---

## Implementation Summary

<!-- Wizard fills this after ALL tasks are complete.
     This is the phase deliverable — a table of all changes. -->

| File | Change | Why | Task | Agent |
|------|--------|-----|------|-------|

---

## Writing Guidance
- Sign all work: `@{name}`
- Be concise — report what happened, not how you felt about it
- Every deviation from plan must be explained
- Update the Task Assignment table as you go
- If blocked: flag WIZARD: immediately, don't wait
```

## Quality Gates Per Task

- [ ] Tests written BEFORE implementation (TDD)
- [ ] Tests fail for the right reason
- [ ] Tests pass after implementation
- [ ] Full test suite passes (no regressions)
- [ ] Implementation matches task spec
- [ ] Naming follows established patterns
- [ ] Implementation breakdown written in task section
- [ ] Code committed with descriptive message

## Red Flags

| Thought | Reality |
|---------|---------|
| "This task is simple, skip TDD" | TDD is an Iron Law. No exceptions. |
| "Let me review my teammate's code" | No cross-review during implementation. That's Phase 5. |
| "I'll implement tasks in whatever order" | Wizard assigns strategically. Follow the assignment. |
| "I'll batch commits across tasks" | One commit per task. Atomic changes. |
| "The plan is wrong, I'll improvise" | Flag to Wizard via WIZARD:. Don't improvise. |

## Escalation

- **3+ attempts on one task:** Question whether the task spec or design is wrong.
- **Agent repeatedly blocked:** The plan may need revision.
- **Tests can't be written:** The design may not be testable. Return to Phase 2.

---

## Phase Transition

When all tasks are complete and committed:

1. Update raid-session phase via Bash:
   ```bash
   jq '.phase="review"' .claude/raid-session > .claude/raid-session.tmp && mv .claude/raid-session.tmp .claude/raid-session
   ```
2. **Commit:** `feat(quest-{slug}): phase 4 implementation — {summary}`
3. **Report:** Link `{questDir}/phases/phase-4-implementation.md` and summary table to the human.
4. **Ask human:** "Shall we inspect the treasure? (Review phase) Or proceed directly to wrap-up?"
5. If review → **Load `raid-canonical-review` and begin Phase 5**
6. If skip → **Load `raid-wrap-up` and begin Phase 6**

## Phase Spoils

**Two outputs:**
- `{questDir}/phases/phase-4-implementation.md` — Evolution log with per-task breakdowns
- Code changes committed with descriptive messages + summary table of all changed files
