# Hooks Redesign — Phase-Aware Quality Gates

## Overview

Redesign the Raid hook system to be phase-aware, performant, and maintainable. The current 6 hooks fire redundantly, lack phase context, and miss key enforcement (read-only phases, implementer gating, Dungeon discipline). This redesign introduces a structured session file, a shared library, and consolidated/new hooks.

## Goals

- **Phase-awareness**: hooks adapt behavior based on current Raid phase
- **Performance**: eliminate redundant process spawning and JSON parsing
- **Coverage gaps**: enforce read-only phases, implementer-only writes, Dungeon entry discipline

## Structured Session File (`.claude/raid-session`)

The Wizard writes `.claude/raid-session` as JSON at Raid start and updates it on every phase transition and implementer rotation.

```json
{
  "phase": "design",
  "mode": "full",
  "currentAgent": null,
  "implementer": null,
  "task": null,
  "startedAt": "2026-04-08T14:30:00Z",
  "phaseStartedAt": "2026-04-08T14:30:00Z"
}
```

**Phase values:** `design`, `plan`, `implementation`, `review`, `finishing`

**Lifecycle:**
- Wizard creates with `phase: "design"` at Raid start
- Wizard updates `phase` + `phaseStartedAt` on each transition
- Wizard sets `implementer` + `currentAgent` + `task` when assigning implementation work
- Wizard updates `currentAgent` on agent rotation during any phase
- Wizard deletes the file when the Raid ends

**Backward compatibility:** file existence still means "Raid is active."

## Shared Library (`raid-lib.sh`)

Sourced by every hook. Parses session + config once, exposes variables and utilities.

```bash
source "$(dirname "$0")/raid-lib.sh"
```

### Variables

| Variable | Source | Value |
|----------|--------|-------|
| `RAID_ACTIVE` | session file exists | `true` / `false` |
| `RAID_PHASE` | session JSON | `design`, `plan`, `implementation`, `review`, `finishing`, or empty |
| `RAID_MODE` | session JSON | `full`, `skirmish`, `scout`, or empty |
| `RAID_IMPLEMENTER` | session JSON | agent name or empty |
| `RAID_CURRENT_AGENT` | session JSON | agent name or empty |
| `RAID_TASK` | session JSON | task ID or empty |
| `RAID_TEST_CMD` | config JSON | test command or empty |
| `RAID_NAMING` | config JSON | `kebab-case`, `snake_case`, `camelCase`, `none` |
| `RAID_MAX_DEPTH` | config JSON | integer (default 8) |
| `RAID_COMMIT_MIN_LENGTH` | config JSON | integer (default 15) |
| `RAID_SPECS_PATH` | config JSON | path (default `docs/raid/specs`) |
| `RAID_PLANS_PATH` | config JSON | path (default `docs/raid/plans`) |

### Utility Functions

- `raid_read_input` — reads stdin, extracts `FILE_PATH` and `COMMAND` from tool input JSON
- `raid_is_production_file <path>` — returns 0 if file is production code (not docs/tests/config/.claude)
- `raid_block <message>` — prints to stderr, exits 2
- `raid_warn <message>` — prints to stderr, exits 0

### Performance

Two `jq` calls max (one for session, one for config). If session file doesn't exist, skips config parsing and sets `RAID_ACTIVE=false`.

### Error Handling

If the session file exists but contains invalid JSON, `raid-lib.sh` treats it as `RAID_ACTIVE=false` and logs a warning to stderr. Hooks should never block normal work due to a corrupted session file — fail open, not closed. Same for a missing or invalid `raid.json`.

## Hook: `validate-commit.sh` (PreToolUse Bash)

Consolidates `validate-commit-message.sh`, `validate-tests-pass.sh`, and `validate-verification.sh`. Fires on `git commit` commands only.

### Check Order

1. **Message format** (always active, no session required)
   - Conventional commit format: `type(scope): description`
   - Minimum length (configurable, default 15)
   - No generic messages (`update`, `fix`, `wip`, etc.)

2. **Tests pass** (Raid-session only)
   - Runs `$RAID_TEST_CMD`, blocks if tests fail
   - Writes timestamp to `.claude/raid-last-test-run`

3. **Verification** (Raid-session only)
   - Only on commits with `complete`/`done`/`finish`/`final` in message
   - Blocks if no test run or last run >10 minutes ago

## Hook: `validate-write-gate.sh` (PreToolUse Write|Edit)

Replaces `validate-phase-gate.sh`. Phase-aware traffic controller for all Write operations to production files. Docs, tests, config, and `.claude/*` files are always allowed in every phase.

### Behavior by Phase

| Phase | Production files | Docs/tests/config | `.claude/*` |
|-------|-----------------|-------------------|-------------|
| **Design** | BLOCK | Allow | Allow |
| **Plan** | BLOCK | Allow | Allow |
| **Implementation** | Allow if `currentAgent == implementer`, block others | Allow | Allow |
| **Review** | BLOCK | Allow | Allow |
| **Finishing** | BLOCK | Allow | Allow |
| **No session** | Allow | Allow | Allow |

### Mode Modifiers

- **Scout**: no implementer check in implementation (only 1 agent)
- **Skirmish**: review phase is a warning instead of a block

### File Classification

Uses `raid_is_production_file` from shared lib. Non-production file patterns: `docs/*`, `test/*`, `tests/*`, `*.test.*`, `*.spec.*`, `*_test.*`, `*_spec.*`, `.claude/*`, `*.json`, `*.yml`, `*.yaml`, `*.toml`, `*.md`, `*.lock`, `*.config.*`, `*.rc`, `.gitignore`, `Makefile`, `Dockerfile`.

## Hook: `validate-file-naming.sh` (PostToolUse Write|Edit)

Same behavior as current. Refactored to source `raid-lib.sh` for `$RAID_NAMING` and `$RAID_MAX_DEPTH`. Always active (no session check).

- Blocks filenames with spaces
- Enforces naming convention if configured
- Blocks files beyond max directory depth

## Hook: `validate-dungeon.sh` (PostToolUse Write|Edit)

New hook. Fires only on writes to `raid-dungeon.md` or `raid-dungeon-phase-*.md`. Raid-session only.

### Three Validation Layers

**1. Format check** — every entry must start with a recognized prefix:
- `📌 DUNGEON:` — pinned finding
- `⚠️ UNRESOLVED:` — open battle
- `✅ RESOLVED:` — settled dispute
- `📋 TASK:` — task definition (Phase 2)

**2. Evidence check** — pinned entries (`📌 DUNGEON:`) must contain substantive evidence:
- Blocks entries under 50 characters
- Blocks entries under 50 characters (insufficient evidence)

**3. Phase consistency** — entry types must match the current phase:

| Phase | Allowed prefixes |
|-------|-----------------|
| **Design** | `📌 DUNGEON:`, `⚠️ UNRESOLVED:`, `✅ RESOLVED:` |
| **Plan** | `📌 DUNGEON:`, `📋 TASK:`, `⚠️ UNRESOLVED:`, `✅ RESOLVED:` |
| **Implementation** | `📌 DUNGEON:`, `⚠️ UNRESOLVED:`, `✅ RESOLVED:` |
| **Review** | `📌 DUNGEON:`, `⚠️ UNRESOLVED:`, `✅ RESOLVED:` |
| **Finishing** | All prefixes allowed (summary phase) |

## Hook: `validate-no-placeholders.sh` (PostToolUse Write|Edit)

Same behavior as current. Refactored to source `raid-lib.sh` for `$RAID_SPECS_PATH` and `$RAID_PLANS_PATH`. Only checks files in specs/plans directories.

Scans for: `tbd`, `todo`, `fixme`, `implement later`, `add appropriate`, `similar to task`, `handle edge cases`, `fill in`.

## Hook Wiring (`merge-settings.js`)

| Event | Matcher | Hooks |
|-------|---------|-------|
| **PreToolUse** | `Bash` | `validate-commit.sh` |
| **PreToolUse** | `Write\|Edit` | `validate-write-gate.sh` |
| **PostToolUse** | `Write\|Edit` | `validate-file-naming.sh`, `validate-no-placeholders.sh`, `validate-dungeon.sh` |

## File Changes

**Removed:**
- `validate-commit-message.sh`
- `validate-tests-pass.sh`
- `validate-verification.sh`
- `validate-phase-gate.sh`

**Added:**
- `raid-lib.sh` (shared library)
- `validate-commit.sh` (consolidated commit checks)
- `validate-write-gate.sh` (phase-aware write controller)
- `validate-dungeon.sh` (Dungeon entry discipline)

**Modified:**
- `validate-file-naming.sh` (source raid-lib)
- `validate-no-placeholders.sh` (source raid-lib)
- `merge-settings.js` (new wiring)

**Net:** 6 hook scripts + 0 lib → 5 hook scripts + 1 shared lib

## Wizard Agent Prompt Updates

The Wizard agent (`wizard.md`) needs updates to manage the structured session file:
- Write JSON to `.claude/raid-session` on Raid start
- Update `phase` + `phaseStartedAt` on each phase transition
- Set `implementer` + `currentAgent` + `task` when assigning implementation
- Update `currentAgent` on rotation
- Delete file on Raid end

## Testing

- Unit tests for `raid-lib.sh` (parsing, variable exposure, utility functions)
- Unit tests for each hook (per-phase behavior, edge cases)
- Update existing tests in `tests/cli/` for new file names and wiring
- Update `merge-settings.js` tests for new hook configuration
- E2E lifecycle test: init → verify new hooks exist → remove → verify cleanup
