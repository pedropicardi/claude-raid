---
name: raid-wrap-up
description: "Phase 6 of Canonical Quest. Generates quest storyboard report, creates PR, archives dungeon to vault, dismisses party. No new code."
---

# Raid Wrap Up — Phase 6

The quest ends. The bard sings the tale. The treasure is committed. The party rests.

<HARD-GATE>
Do NOT write new code. This phase is about reporting, cleanup, PR creation, and archival. Agents are dismissed, not dispatched.
</HARD-GATE>

## Mode Behavior

- **Full Raid**: Wizard writes full storyboard from all phase files. Full PR with narrative.
- **Skirmish**: Wizard writes condensed storyboard. Standard PR.
- **Scout**: Wizard writes brief summary. Quick PR.

## Process Flow

```dot
digraph wrapup {
  "Wizard updates phase to wrap-up" -> "Create phase-6-wrap-up.md";
  "Create phase-6-wrap-up.md" -> "Write phase-by-phase storyboard";
  "Write phase-by-phase storyboard" -> "Cleanup temp files";
  "Cleanup temp files" -> "Verify all tests pass (fresh run)";
  "Verify all tests pass (fresh run)" -> "Tests pass?" [shape=diamond];
  "Tests pass?" -> "Fix first. Do not proceed." [label="no"];
  "Fix first. Do not proceed." -> "Verify all tests pass (fresh run)";
  "Tests pass?" -> "Present merge options" [label="yes"];
  "Present merge options" -> "Human chooses";
  "Human chooses" -> "Execute choice";
  "Execute choice" -> "Dismiss party";
  "Dismiss party" -> "Archive to vault";
  "Archive to vault" -> "Final commit + cleanup" [shape=doublecircle];
}
```

## Wizard Checklist

1. **Update raid-session** — set phase to `"wrap-up"`
2. **Create storyboard** — `{questDir}/phase-6-wrap-up.md`
3. **Write narrative** — phase-by-phase story from quest files
4. **Cleanup** — remove temp configs, debug files, stale artifacts
5. **Verify tests** — fresh full run, must pass
6. **Present options** — 4 merge choices
7. **Execute choice** — merge, PR, keep, or discard
8. **Dismiss party** — RPG flavor shutdown
9. **Archive** — move dungeon to vault
10. **Final commit** — `docs(quest-{slug}): phase 6 wrap-up — quest complete`
11. **Session cleanup** — remove `.claude/raid-session`

## Step 1: The Quest Storyboard

Create `{questDir}/phase-6-wrap-up.md` and write a phase-by-phase narrative:

```markdown
# Phase 6: Wrap Up — Quest Storyboard
## Quest: <quest name>
## Mode: <mode>

### Phase 1: PRD — Forging the Scroll
(if phase-1-prd.md exists)
- What requirements were established
- Key decisions from research

### Phase 2: Design — Charting the Map
- Architecture chosen and why
- Key trade-offs resolved
- Alternatives considered and rejected

### Phase 3: Implementation Plan — Marshaling the Forces
- Number of tasks, dependency structure
- Risk areas identified

### Phase 4: Implementation — Into the Fray
- What was built
- Challenges overcome
- Test coverage highlights

### Phase 5: Review — Inspecting the Treasure
(if phase-5-review.md exists)
- Findings pinned and resolved
- Black cards (if any)
- Fixes applied

### Summary
- Total phases completed
- Key achievements
- Known limitations
```

Read all prior phase files from the quest directory to build this narrative.

## Step 2: Cleanup

Remove temporary artifacts:
- Debug files
- Temp configs
- Stale backups in the quest directory

## Step 3: Final Verification

```
1. IDENTIFY: test command from .claude/raid.json
2. RUN: Execute the FULL test suite (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Zero failures?
   If NO → STOP. Fix first. Do not present options.
   If YES → Proceed with evidence.
```

## Step 4: Present Options

```
RULING: The quest is complete and verified.

Tests: [N] passing, 0 failures (evidence: [command output])

Options:
1. Merge back to [base-branch] locally
2. Push and create a Pull Request
3. Keep the branch as-is (handle later)
4. Discard this work

Which option?
```

**For option 2 (PR):** Create the PR with:
- **Title**: Descriptive, includes quest name
- **Body**: The phase-by-phase storyboard from the wrap-up doc

## Step 5: Execute

| Option | Actions |
|--------|---------|
| **1. Merge** | Checkout base -> pull -> merge -> run tests on merged result -> delete branch -> clean up |
| **2. PR** | Push with -u -> create PR via gh with storyboard body -> clean up |
| **3. Keep** | Report branch location. Done. |
| **4. Discard** | Require typed "discard" confirmation -> delete branch (force) -> clean up |

## Step 6: Dismiss the Party

Send shutdown to all teammates with RPG flavor:

> "The quest is done, brave engineers. The bards will sing of **{quest-name}**. Sheathe your tools — until the next adventure."

```
SendMessage(to="warrior", message={"type": "shutdown_request"})
SendMessage(to="archer", message={"type": "shutdown_request"})
SendMessage(to="rogue", message={"type": "shutdown_request"})
```

## Step 7: Archive to Vault

1. Move quest directory to vault:
   ```
   mv .claude/dungeon/{quest-slug}/ .claude/vault/{quest-slug}/
   ```
2. Update vault index at `.claude/vault/index.md`:
   ```
   | {date} | [{quest-name}]({quest-slug}/quest.md) | {mode} | {tags} |
   ```

## Step 8: Final Commit & Cleanup

1. **Commit**: `docs(quest-{slug}): phase 6 wrap-up — quest complete`
2. **Remove**: `.claude/raid-session`
3. **Session is over. No further skills to load.**

## Red Flags

| Thought | Reality |
|---------|---------|
| "Tests passed earlier, no need to re-run" | Fresh run or no claim. Always. |
| "Skip the storyboard, just make the PR" | The storyboard IS the PR body. It documents the journey. |
| "Leave the dungeon files, they might be useful" | Archive to vault. Session artifacts don't belong in the repo. |
| "Merge without testing the merged result" | Merges introduce conflicts. Test after merge. |
| "I'll write the code fix myself" | You are the Wizard. Dispatch the fix to an agent. |

## Phase Spoils

**Output**: `{questDir}/phase-6-wrap-up.md` — The complete quest narrative, phase by phase.
