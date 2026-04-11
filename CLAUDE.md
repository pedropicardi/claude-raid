# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

`claude-raid` is a zero-dependency npm CLI that installs an adversarial multi-agent development system into any project's `.claude/` directory. It ships agents, hooks, skills, and config files that orchestrate 4 AI agents (Wizard, Warrior, Archer, Rogue) through a quest-based workflow.

The primary workflow is the **Canonical Quest** — a 6-phase development cycle: PRD → Design → Plan → Implementation → Review → Wrap Up. The Wizard (dungeon master) orchestrates the party through round-based, adversarial phases where agents cross-test each other's work.

## Commands

```bash
# Run all tests
npm test

# Run a single test file
node --test tests/cli/init.test.js

# Run tests matching a pattern
node --test --test-name-pattern="dry run" tests/cli/init.test.js

# Test the CLI locally
node bin/cli.js summon --dry-run
```

No build step. No linter configured. No dependencies to install.

## Architecture

### CLI Entry Point

`bin/cli.js` — Routes commands to `src/` modules:

| Command | Alias | Action |
|---------|-------|--------|
| `start` | — | Opens tmux session + launches Wizard (one command does it all) |
| `summon` | `init` | Installs Raid into a project. `--dry-run` previews, `--rtk` enables token compression |
| `update` | — | Upgrades hooks/skills/rules |
| `dismantle` | `remove` | Removes Raid files |
| `heal` | `doctor` | Diagnoses prerequisites |
| `sync` | — | Git pull + re-summon |

### src/ Modules

| Module | Purpose |
|---|---|
| `init.js` | `summon` — copies `template/.claude/` into target project, generates `raid.json`, merges settings, runs setup wizard |
| `remove.js` | `dismantle` — removes Raid files (including legacy v0.1.x artifacts), restores original `settings.json` from backup |
| `update.js` | `update` — upgrades hooks/skills/rules, preserves customized agents and config |
| `doctor.js` | `heal` — checks prerequisites (Node, Claude Code, jq, tmux, teammateMode, Playwright if browser enabled) |
| `merge-settings.js` | Merges Raid hooks into existing `.claude/settings.json` using `#claude-raid` markers. Creates backup. Conditionally adds RTK hooks via `#claude-raid-rtk` marker |
| `detect-project.js` | Auto-detects language, test/lint/build commands from marker files |
| `detect-browser.js` | Detects browser frameworks (Next.js, Vite, Nuxt, Remix, SvelteKit, Angular, etc.) |
| `detect-package-manager.js` | Detects npm/pnpm/yarn/bun/uv/poetry from lock files. Returns packageManager, runCommand, execCommand, installCommand |
| `setup.js` | Interactive setup wizard — checks Node ≥18, Claude ≥2.1.32, jq, tmux, teammateMode (tmux/in-process/auto), Playwright |
| `descriptions.js` | Human-readable descriptions for agents, hooks, skills — single source of truth for CLI output |
| `ui.js` | Terminal formatting: banner, colors, headers |
| `version-check.js` | Non-blocking npm registry check for newer versions (24h cache in /tmp) |

### template/.claude/

The files copied into target projects during `summon`. This is the product:

```
template/.claude/
├── agents/
│   ├── wizard.md          # Dungeon master — orchestrator, never implements
│   ├── warrior.md         # Stress-tester — edge cases, load, failure modes
│   ├── archer.md          # Pattern-seeker — ripple effects, naming drift
│   └── rogue.md           # Assumption-destroyer — adversarial scenarios
├── hooks/
│   ├── raid-lib.sh                  # Shared library — session/config parsing, RAID_* exports
│   ├── raid-session-start.sh        # Creates raid-session + quest directory
│   ├── raid-session-end.sh          # Archives quest dungeon to vault, cleanup
│   ├── raid-pre-compact.sh          # Backs up dungeon before context compaction
│   ├── raid-task-created.sh         # Validates task subjects are meaningful
│   ├── validate-commit.sh           # Conventional commit format enforcement
│   ├── validate-write-gate.sh       # Protects session files, allows quest dir writes
│   ├── validate-dungeon.sh          # Validates dungeon entries + BLACKCARD: prefix
│   ├── validate-file-naming.sh      # Enforces naming conventions
│   ├── validate-no-placeholders.sh  # Blocks TBD/TODO in specs, plans, quest docs
│   ├── validate-browser-tests-exist.sh  # Warns if browser code lacks Playwright tests
│   ├── validate-browser-cleanup.sh  # Verifies browser processes cleaned up
│   └── rtk-bridge.sh               # Token compression bridge to RTK (fail-open, opt-in)
├── skills/
│   ├── raid-init/                          # Quest selection, greeting, session setup
│   ├── raid-canonical-protocol/            # Canonical Quest rules, signals, phase gates
│   ├── raid-canonical-prd/                 # Phase 1: PRD creation (optional)
│   ├── raid-canonical-design/              # Phase 2: Adversarial design exploration
│   ├── raid-canonical-implementation-plan/ # Phase 3: Task decomposition
│   ├── raid-canonical-implementation/      # Phase 4: TDD implementation + cross-testing
│   ├── raid-canonical-review/              # Phase 5: Pinning + fixing + black cards (optional)
│   ├── raid-wrap-up/                       # Phase 6: Storyboard, PR, vault archival
│   ├── raid-tdd/                           # RED-GREEN-REFACTOR enforcement (reusable)
│   ├── raid-verification/                  # Evidence-before-claims gate (reusable)
│   ├── raid-debugging/                     # Root-cause investigation (reusable)
│   ├── raid-browser/                       # Browser orchestration infrastructure (conditional)
│   ├── raid-browser-chrome/                # Live Chrome inspection (conditional)
│   └── raid-teambuff/                      # Emergency team retrospective + rulings (reusable)
├── party-rules.md              # Party agent rules (editable by user)
└── dungeon-master-rules.md     # Wizard rules (editable by user)
```

### Skill Organization

Skills are organized into categories:

- **Core:** `raid-init` — always loaded, handles quest selection and session setup
- **Protocol:** `raid-canonical-protocol` — phase lifecycle rules, transition gates, signals
- **Canonical Quest chain (6):** `raid-canonical-prd` through `raid-wrap-up` — phase-specific skills that chain: prd → design → plan → implementation → review → wrap-up
- **Reusable (6):** `raid-tdd`, `raid-verification`, `raid-debugging`, `raid-browser`, `raid-browser-chrome`, `raid-teambuff` — quest-type agnostic, invoked within phases as needed

### Quest Filesystem

```
.claude/dungeon/{quest-slug}/          # Active quest artifacts
├── phases/                            # Evolution logs (scoreboards)
│   ├── phase-2-design.md
│   ├── phase-3-plan.md
│   ├── phase-4-implementation.md
│   └── phase-5-review.md
├── spoils/                            # Polished deliverables
│   ├── prd.md
│   ├── design.md
│   ├── review.md
│   └── tasks/
│       └── phase-3-plan-task-NN.md
├── backups/                           # Pre-compact safety copies
│   └── phase-N-{name}-backup.md
├── phase-6-wrap-up.md                 # Quest storyboard
├── teambuff-NN.md                     # Team retrospective reports (on-demand)
└── teambuff-rulings.md                # Active rulings from teambuffs

.claude/vault/{quest-slug}/            # Archived completed quests
.claude/vault/.draft/                  # Staging area before vault archival
.claude/raid-session                   # Active session state (JSON)
.claude/raid.json                      # Project config (editable)
```

### Session State

`.claude/raid-session` tracks active quest state:

```json
{
  "sessionId": "uuid",
  "startedAt": "ISO-8601-UTC",
  "phase": "prd|design|plan|implementation|review|wrap-up",
  "mode": "full|skirmish|scout",
  "questType": "canonical",
  "questId": "YYYYMMDD-quest-slug",
  "questDir": ".claude/dungeon/quest-slug",
  "blackCards": [],
  "phaseIteration": 1
}
```

Additional fields set during quest execution: `currentAgent`, `implementer`, `task`, `currentRound`, `maxRounds`, `turnOrder`, `currentTurnIndex`.

### Hook System

Hooks use `#claude-raid` markers in command strings so `merge-settings.js` can identify and update them without touching user hooks. The merge logic:
1. Reads existing `settings.json`
2. Backs up to `settings.json.pre-raid-backup`
3. Appends Raid hooks per trigger category, deduplicating by marker
4. Adds Raid-specific env vars (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1'`) and permissions (Read, Glob, Grep, Bash, Write, Edit, Write(.claude/**), Edit(.claude/**))

RTK hooks use a separate `#claude-raid-rtk` marker and are only added when `raid.json` has `rtk.enabled === true`.

Hook trigger mapping:

| Trigger | Matcher | Hooks |
|---------|---------|-------|
| PostToolUse | Write\|Edit | validate-file-naming, validate-no-placeholders, validate-dungeon |
| PostToolUse | Bash | validate-browser-cleanup |
| PreToolUse | Bash | validate-commit, validate-browser-tests-exist |
| PreToolUse | Write\|Edit | validate-write-gate |
| PreToolUse (RTK) | Bash | rtk-bridge |
| SessionStart | — | raid-session-start |
| SessionEnd | prompt_input_exit\|clear | raid-session-end |
| TaskCreated | — | raid-task-created |
| PreCompact | — | raid-pre-compact |

All hooks source `raid-lib.sh` for shared session/config parsing. Exit code `2` = block with message.

### raid-lib.sh Exports

The shared library parses `raid-session` and `raid.json`, exporting `RAID_*` variables used by all hooks:

- **Session:** `RAID_ACTIVE`, `RAID_PHASE`, `RAID_MODE`, `RAID_QUEST_ID`, `RAID_QUEST_DIR`, etc.
- **Config:** `RAID_TEST_CMD`, `RAID_NAMING` (default "none"), `RAID_MAX_DEPTH` (default 8), `RAID_COMMIT_MIN_LENGTH` (default 15)
- **Browser:** `RAID_BROWSER_ENABLED`, `RAID_BROWSER_PORT_START/END`, `RAID_BROWSER_EXEC_CMD`, `RAID_BROWSER_PW_CONFIG`
- **Lifecycle:** `RAID_LIFECYCLE_*` flags for each lifecycle toggle
- **RTK:** `RAID_RTK_ENABLED`, `RAID_RTK_BYPASS_PHASES`, `RAID_RTK_BYPASS_COMMANDS`
- **Utilities:** `raid_block()`, `raid_warn()`, `raid_session_set()`, `raid_is_production_file()`, `raid_quest_dir()`, `raid_vault_count()`

### tests/

- `tests/cli/` — Unit tests for each `src/` module. Tests create temp directories and verify file operations.
- `tests/hooks/` — Tests for shell hook scripts. Run hooks via `child_process.execSync` with controlled env vars and fixture files.
- `tests/e2e/` — Full lifecycle test: summon → verify files → update → verify preservation → dismantle → verify cleanup.

All tests use Node.js built-in `node:test` and `node:assert`. No test framework dependencies. Currently 325 tests.

## Key Concepts

| Term | Meaning |
|------|---------|
| **Quest** | A session — one full thread from greeting to PR |
| **Dungeon** | Session artifacts directory — phase-based markdown files |
| **Vault** | Archived dungeons from completed quests |
| **Party** | The agent team (Warrior, Archer, Rogue) |
| **Black Card** | High-concern finding that blocks progress, requires human decision |
| **Phase Spoils** | Mandatory output of each phase: a detailed markdown report |
| **Pin** | A verified finding that survived challenge from 2+ agents |

## Key Design Decisions

- **CommonJS** (`"type": "commonjs"`) — not ESM
- **Zero dependencies** — stdlib only, for fast `npx` cold-start
- **Never overwrites existing files** — `copyRecursive` skips files that already exist in the target
- **Settings merge, not replace** — existing user hooks are preserved alongside Raid hooks
- **Session-scoped activation** — quality gate hooks check for active Raid session before enforcing rules
- **Round-based interaction** — agents work in parallel, flag completion, then cross-test. No mid-thinking interruptions.
- **Question chain** — agents → wizard → human. Agents never ask the human directly.
- **Wizard never implements** — dispatches, observes, digests, rules. The party writes code.
- **Phase commits** — wizard commits at every phase transition with quest name + phase + summary
- **Fail-open RTK bridge** — if RTK binary is missing or errors, the hook exits 0 and the command runs uncompressed
- **Legacy cleanup** — `remove.js` handles both v0.2.x (dungeon/vault structure) and v0.1.x (flat raid-dungeon-* files)
