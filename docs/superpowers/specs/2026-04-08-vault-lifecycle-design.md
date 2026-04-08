# Raid Vault & Lifecycle Automation

**Date:** 2026-04-08
**Status:** Approved

## Problem

Raid sessions are ephemeral. When a quest ends, Dungeon files, design specs, and implementation plans are either left scattered in `docs/` or cleaned up entirely. There's no persistent memory across sessions — the party forgets everything. Additionally, the Raid only uses 2 of Claude Code's 26 hook events (PreToolUse/PostToolUse), missing major automation opportunities for session management, task discipline, and long-session resilience.

## Solution

Two interconnected features:

1. **Raid Vault** — A persistent quest archive where completed sessions can be preserved with all their artifacts (specs, plans, Dungeon phases, quest summary). Human chooses persist or forget at session end. Wizard asks permission before loading past quests.

2. **Lifecycle Hooks** — 7 new Claude Code hook integrations that automate session management, enforce task discipline, nudge idle agents, protect against context compaction, and inject human confirmation gates at phase transitions.

## Vault

### Structure

Each persisted quest becomes a directory in `.claude/vault/`:

```
.claude/vault/
├── index.md                             # One-line-per-quest table
├── 2026-04-08-auth-refactor/
│   ├── quest.md                         # Summary + machine-readable data
│   ├── spec.md                          # Design spec (moved from docs/raid/specs/)
│   ├── plan.md                          # Implementation plan (moved from docs/raid/plans/)
│   └── dungeon-phases/
│       ├── phase-1.md
│       ├── phase-2.md
│       ├── phase-3.md
│       └── phase-4.md
└── 2026-04-10-api-pagination/
    ├── quest.md
    ├── spec.md
    └── plan.md
```

### Quest file format (`quest.md`)

```markdown
# Auth Module Refactor

**Date:** 2026-04-08
**Mode:** Full Raid
**Agents:** Wizard, Warrior, Archer, Rogue
**Branch:** feat/auth-refactor

## Quest Summary

[Human-readable narrative of what was built and why]

## Key Decisions

- [Decision 1 with rationale]
- [Decision 2 with rationale]

## Findings That Survived

- [Finding, agent who found it, phase]

## Files Changed

- [List of files created/modified]

---
<!-- VAULT:MACHINE -->

```json
{
  "quest": "auth-refactor",
  "date": "2026-04-08",
  "mode": "full",
  "tags": ["auth", "security", "jwt"],
  "patterns": [
    { "type": "decision", "summary": "...", "files": ["..."] },
    { "type": "bug", "summary": "...", "agent": "warrior", "phase": 1 }
  ],
  "filesChanged": ["src/auth/jwt.ts", "src/auth/middleware.ts"]
}
```
```

### Index file (`index.md`)

```markdown
# Raid Vault

| Date | Quest | Mode | Tags |
|------|-------|------|------|
| 2026-04-08 | [Auth Refactor](2026-04-08-auth-refactor/quest.md) | Full Raid | auth, security, jwt |
| 2026-04-10 | [API Pagination](2026-04-10-api-pagination/quest.md) | Skirmish | api, pagination |
```

### What gets persisted vs. forgotten

**On persist:**
- Design spec moves from `docs/raid/specs/` to `vault/<quest>/spec.md`
- Implementation plan moves from `docs/raid/plans/` to `vault/<quest>/plan.md`
- Dungeon phase archives move to `vault/<quest>/dungeon-phases/`
- Generated `quest.md` (summary + machine data) saved
- `index.md` updated with new entry

**On forget:**
- Draft entry deleted
- Specs and plans in `docs/raid/` deleted
- Dungeon files deleted
- Clean slate

### Vault access flow

**Session start:**
1. `raid-session-start.sh` hook detects Vault entries exist
2. Injects `additionalContext`: "The Vault holds N past quests. Ask the human if the party should consult the Vault."
3. Wizard asks the human
4. If yes: Wizard reads `index.md`, shows table, asks which quest to load
5. If no: Wizard proceeds without Vault context

**Session end:**
1. `raid-session-end.sh` hook generates `.claude/vault/.draft/` directory with quest.md, copies specs/plans/dungeons
2. Injects `additionalContext`: "Quest record drafted. Ask the human: persist to the Vault, or forget?"
3. Wizard asks the human
4. If persist: Wizard renames `.draft/` to final name, updates `index.md`
5. If forget: Wizard deletes `.draft/` and all session artifacts

## Lifecycle Hooks

### Hook map

| Hook Event | Script | Action | Auto/Human |
|---|---|---|---|
| SessionStart | `raid-session-start.sh` | Create `raid-session`, offer Vault access | Auto + Human gate |
| SessionEnd | `raid-session-end.sh` | Draft Vault entry, ask persist/forget, cleanup | Auto + Human gate |
| TeammateIdle | `raid-teammate-idle.sh` | Nudge idle agents to pick up unclaimed tasks | Auto |
| TaskCreated | `raid-task-created.sh` | Validate task subject (not empty, not generic) | Auto (block) |
| TaskCompleted | `raid-task-completed.sh` | Block completion if tests haven't run recently | Auto (block) |
| Stop | `raid-stop.sh` | Detect phase transitions, inject human confirmation gate | Auto + Human gate |
| PreCompact | `raid-pre-compact.sh` | Backup Dungeon state before context compaction | Auto |

### Hook details

#### `raid-session-start.sh`

Reads stdin JSON for `session_id` and `source` (startup/resume).

- If `source === "resume"` and `raid-session` exists: no action (session continuing)
- If new session: creates `.claude/raid-session` with `{ "sessionId": "...", "startedAt": "...", "phase": 1 }`
- Checks `.claude/vault/index.md` for entries
- If Vault has entries: outputs JSON with `additionalContext` — "The Vault contains N past quests. Ask the human if they want to consult the Vault before beginning."
- If no Vault: no additional context

Only activates when running as agent type "wizard" (checks `agent_type` from stdin).

#### `raid-session-end.sh`

Only runs during Raid sessions (checks `raid-session` exists).

- Reads Dungeon files (`.claude/raid-dungeon.md`, `.claude/raid-dungeon-phase-*.md`)
- Reads specs from `docs/raid/specs/` and plans from `docs/raid/plans/`
- Creates `.claude/vault/.draft/` directory:
  - Generates `quest.md` from Dungeon content (best-effort extraction of findings, decisions)
  - Copies spec files to `.draft/spec.md`
  - Copies plan files to `.draft/plan.md`
  - Copies Dungeon phase archives to `.draft/dungeon-phases/`
- Outputs `additionalContext`: "A quest record has been drafted at .claude/vault/.draft/. Ask the human: persist this quest to the Vault, or forget it? If persisted, the Wizard should review and enrich quest.md before finalizing."
- Cleans up: removes `raid-session`, `raid-dungeon.md`, `raid-dungeon-phase-*.md`, `raid-last-test-run`

#### `raid-teammate-idle.sh`

Only runs during Raid sessions.

- Reads `teammate_name` from stdin JSON
- Exits with code 2 + stderr message: "Unclaimed tasks remain on the board. Pick up the next available task and report your plan before starting." — this sends the agent back to work
- Exits with code 0 if it cannot determine task state (fails open)

#### `raid-task-created.sh`

Only runs during Raid sessions.

- Reads `task_subject` from stdin JSON
- Validates:
  - Not empty
  - Not too short (< 10 characters)
  - Doesn't start with generic words alone ("fix", "update", "task", "do") without descriptive context
- Exit 2 with feedback message if invalid, exit 0 if valid

#### `raid-task-completed.sh`

Only runs during Raid sessions.

- Reads `raid-last-test-run` timestamp from `.claude/raid-last-test-run`
- Reads `testWindowMinutes` from `raid.json` (default: 10)
- If no test run file or timestamp older than window: exit 2 with "Tests must pass before marking a task complete. Run the test command first."
- Exit 0 to allow completion

#### `raid-stop.sh`

Only runs during Raid sessions.

- Reads current phase from `.claude/raid-session` JSON
- Reads Dungeon file for phase transition markers (looks for "## Phase N" headings or "PHASE N" markers)
- If detected phase > stored phase:
  - Updates `.claude/raid-session` with new phase number
  - Outputs `additionalContext`: "Phase transition detected (Phase {old} → Phase {new}). The Wizard must confirm with the human before opening the next phase."
- Otherwise: exit 0, no context

#### `raid-pre-compact.sh`

Only runs during Raid sessions.

- Copies `.claude/raid-dungeon.md` to `.claude/raid-dungeon-backup.md`
- Copies all `.claude/raid-dungeon-phase-*.md` to `.claude/raid-dungeon-phase-*-backup.md`
- Outputs `additionalContext`: "Dungeon state backed up before compaction. If critical findings were lost, check raid-dungeon-backup.md."

### Settings.json integration

`mergeSettings` registers all 7 new hooks alongside existing PreToolUse/PostToolUse hooks. All use the `#claude-raid` marker for identification and clean removal.

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{ "type": "command", "command": "bash .claude/hooks/raid-session-start.sh #claude-raid" }]
    }],
    "SessionEnd": [{
      "matcher": "prompt_input_exit|clear",
      "hooks": [{ "type": "command", "command": "bash .claude/hooks/raid-session-end.sh #claude-raid" }]
    }],
    "TeammateIdle": [{
      "hooks": [{ "type": "command", "command": "bash .claude/hooks/raid-teammate-idle.sh #claude-raid" }]
    }],
    "TaskCreated": [{
      "hooks": [{ "type": "command", "command": "bash .claude/hooks/raid-task-created.sh #claude-raid" }]
    }],
    "TaskCompleted": [{
      "hooks": [{ "type": "command", "command": "bash .claude/hooks/raid-task-completed.sh #claude-raid" }]
    }],
    "Stop": [{
      "hooks": [{ "type": "command", "command": "bash .claude/hooks/raid-stop.sh #claude-raid" }]
    }],
    "PreCompact": [{
      "hooks": [{ "type": "command", "command": "bash .claude/hooks/raid-pre-compact.sh #claude-raid" }]
    }]
  }
}
```

### Configuration

New `raid.json` fields:

```json
{
  "raid": {
    "defaultMode": "full",
    "vault": {
      "path": ".claude/vault",
      "enabled": true
    },
    "lifecycle": {
      "autoSessionManagement": true,
      "teammateNudge": true,
      "taskValidation": true,
      "completionGate": true,
      "phaseTransitionConfirm": true,
      "compactBackup": true,
      "testWindowMinutes": 10
    }
  }
}
```

Each lifecycle flag is checked by its respective hook on every invocation. If disabled, the hook exits 0 immediately. All default to `true`.

Vault can be disabled entirely with `vault.enabled: false`.

### Changes to existing files

| File | Change |
|---|---|
| `src/merge-settings.js` | Add 7 new hook event registrations to `RAID_HOOKS` |
| `src/init.js` | Add `vault` and `lifecycle` sections to generated `raid.json` |
| `src/remove.js` | Add cleanup of Vault `.draft/` dir, `raid-session`, backup files. Add new hook scripts to removal list. |
| `src/update.js` | Overwrite new hook scripts (framework code, same as existing hooks) |
| `template/.claude/hooks/` | 7 new shell scripts |
| `.gitignore` additions | `.claude/vault/.draft/`, `.claude/raid-dungeon-backup.md`, `.claude/raid-dungeon-phase-*-backup.md` |

### Test plan

**New: `tests/cli/vault.test.js`**
- Vault index generation (create, update, parse)
- Quest directory structure (spec, plan, dungeon-phases present after persist)
- Forget flow (all artifacts deleted)
- Draft generation from Dungeon files

**New: `tests/hooks/lifecycle.test.js`**
- `raid-session-start.sh`: creates raid-session, detects Vault entries, outputs additionalContext
- `raid-session-end.sh`: generates draft, cleans up session files
- `raid-teammate-idle.sh`: exits 2 when tasks remain, exits 0 when all done
- `raid-task-created.sh`: blocks empty/generic subjects, allows good ones
- `raid-task-completed.sh`: blocks when no recent test run, allows when fresh
- `raid-stop.sh`: detects phase transitions, updates session file
- `raid-pre-compact.sh`: creates backup files
- All hooks: exit 0 immediately when raid-session doesn't exist (not in a Raid)
- All hooks: exit 0 immediately when respective config flag is disabled

**Update: `tests/cli/merge-settings.test.js`**
- Verify new hook events are registered

**Update: `tests/cli/init.test.js`**
- Verify `vault` and `lifecycle` sections in generated `raid.json`

**Update: `tests/cli/remove.test.js`**
- Verify new hooks are removed, Vault draft cleaned up
