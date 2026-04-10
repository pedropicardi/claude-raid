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
| `start` | — | Launches `claude --dangerously-skip-permissions --agent wizard` |
| `summon` | `init` | Installs Raid into a project |
| `update` | — | Upgrades hooks/skills/rules |
| `dismantle` | `remove` | Removes Raid files |
| `heal` | `doctor` | Diagnoses prerequisites |
| `sync` | — | Git pull + re-summon |

### src/ Modules

| Module | Purpose |
|---|---|
| `init.js` | `summon` — copies `template/.claude/` into target project, generates `raid.json`, merges settings, runs setup wizard |
| `remove.js` | `dismantle` — removes Raid files, restores original `settings.json` from backup |
| `update.js` | `update` — upgrades hooks/skills/rules, preserves customized agents and config |
| `doctor.js` | `heal` — checks prerequisites (Node, Claude Code, jq, tmux, teammateMode) |
| `merge-settings.js` | Merges Raid hooks into existing `.claude/settings.json` using `#claude-raid` markers. Creates backup. |
| `detect-project.js` | Auto-detects language, test/lint/build commands from marker files |
| `detect-browser.js` | Detects browser frameworks (Next.js, Vite, Angular, etc.) |
| `detect-package-manager.js` | Detects npm/pnpm/yarn/bun/uv/poetry from lock files |
| `setup.js` | Interactive setup wizard (teammateMode, tmux detection) |
| `descriptions.js` | Human-readable descriptions for agents, hooks, skills — single source of truth for CLI output |
| `ui.js` | Terminal formatting: banner, colors, headers |
| `version-check.js` | Non-blocking npm registry check for newer versions |

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
│   └── validate-browser-cleanup.sh  # Verifies browser processes cleaned up
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
│   └── raid-browser-chrome/                # Live Chrome inspection (conditional)
├── party-rules.md              # Party agent rules (editable by user)
└── dungeon-master-rules.md     # Wizard rules (editable by user)
```

### Skill Organization

Skills are organized into three categories:

- **Core:** `raid-init` — always loaded, handles quest selection and session setup
- **Canonical Quest chain (7):** `raid-canonical-*` + `raid-wrap-up` — phase-specific skills that chain: init → prd → design → plan → implementation → review → wrap-up
- **Reusable (5):** `raid-tdd`, `raid-verification`, `raid-debugging`, `raid-browser`, `raid-browser-chrome` — quest-type agnostic, invoked within phases as needed

### Quest Filesystem

```
.claude/dungeon/{quest-slug}/          # Active quest artifacts
├── phase-1-prd.md                     # PRD document (optional)
├── phase-2-design.md                  # Design specification
├── phase-3-plan.md                    # Task index
├── phase-3-plan-task-01.md            # Individual task files
├── phase-4-implementation.md          # Implementation log
├── phase-5-review.md                  # Review board (optional)
└── phase-6-wrap-up.md                 # Quest storyboard

.claude/vault/{quest-slug}/            # Archived completed quests
.claude/raid-session                   # Active session state (JSON)
.claude/raid.json                      # Project config (editable)
```

### Session State

`.claude/raid-session` tracks active quest state:

```json
{
  "sessionId": "uuid",
  "phase": "prd|design|plan|implementation|review|wrap-up",
  "mode": "full|skirmish|scout",
  "questType": "canonical",
  "questId": "quest-slug",
  "questDir": ".claude/dungeon/quest-slug",
  "blackCards": [],
  "phaseIteration": 1
}
```

### Hook System

Hooks use `#claude-raid` markers in command strings so `merge-settings.js` can identify and update them without touching user hooks. The merge logic:
1. Reads existing `settings.json`
2. Backs up to `settings.json.pre-raid-backup`
3. Appends Raid hooks per trigger category, deduplicating by marker
4. Adds Raid-specific env vars and permissions

All hooks source `raid-lib.sh` for shared session/config parsing. Exit code `2` = block with message.

### tests/

- `tests/cli/` — Unit tests for each `src/` module. Tests create temp directories and verify file operations.
- `tests/hooks/` — Tests for shell hook scripts. Run hooks via `child_process.execSync` with controlled env vars and fixture files.
- `tests/e2e/` — Full lifecycle test: summon → verify files → update → verify preservation → dismantle → verify cleanup.

All tests use Node.js built-in `node:test` and `node:assert`. No test framework dependencies. Currently 294 tests.

## Key Concepts

| Term | Meaning |
|------|---------|
| **Quest** | A session — one full thread from greeting to PR |
| **Dungeon** | Session artifacts directory — phase-based markdown files |
| **Vault** | Archived dungeons from completed quests |
| **Party** | The agent team (Warrior, Archer, Rogue) |
| **Black Card** | High-concern finding that blocks progress, requires human decision |
| **Phase Spoils** | Mandatory output of each phase: a detailed markdown report |

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
