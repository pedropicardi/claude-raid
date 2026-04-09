# claude-raid

```ansi
[33m  ⚔ ═══════════════════════════════════════════════════════ ⚔[0m

[1;33m      ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗[0m
[1;33m     ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝[0m
[33m     ██║     ██║     ███████║██║   ██║██║  ██║█████╗  [0m
[33m     ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝  [0m
[33m     ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗[0m
[1;31m      ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝[0m
[1;31m              ██████╗  █████╗ ██╗██████╗ [0m
[1;31m              ██╔══██╗██╔══██╗██║██╔══██╗[0m
[31m              ██████╔╝███████║██║██║  ██║[0m
[31m              ██╔══██╗██╔══██║██║██║  ██║[0m
[31m              ██║  ██║██║  ██║██║██████╔╝[0m
[2;31m              ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═════╝ [0m

[90m      Adversarial multi-agent development for Claude Code[0m

[33m  ⚔ ═══════════════════════════════════════════════════════ ⚔[0m
```

Four AI agents work through a strict 4-phase workflow where every design decision, implementation choice, and code review is stress-tested by competing perspectives before it ships.

Built for [Claude Code](https://claude.ai/claude-code). Zero dependencies. One command to install.

Adapted from [obra/superpowers](https://github.com/obra/superpowers) by Jesse Vincent.

---

## Quick Start

```bash
# Install into any project
npx claude-raid summon

# Preview what gets installed (no changes made)
npx claude-raid summon --dry-run

# Start a tmux session, then start the Raid
tmux new-session -s raid
claude --agent wizard
```

Each agent gets its own tmux pane. You can click into any pane to talk directly to that agent. Describe your task and the Wizard takes over.

### Prerequisites

| Requirement | Why | Auto-configured? |
|---|---|---|
| **Node.js** 18+ | Runs the installer | No |
| **Claude Code** v2.1.32+ | Agent teams support | No |
| **tmux** | Multi-pane agent display | No — `brew install tmux` |
| **jq** | Hook config parsing | Pre-installed on macOS |
| **teammateMode** | Set to `tmux` in `~/.claude.json` | Yes (wizard prompts) |

**tmux is required for the multi-pane experience.** Each agent runs in its own pane so you can observe and interact with them independently. Without tmux, agents run in-process (single pane, cycle with Shift+Down).

The setup wizard checks all of these during `summon` and offers to fix what it can.

---

## How It Works

You describe a task. The Wizard assesses complexity, recommends a mode, and opens the Dungeon — a shared knowledge artifact where agents pin verified findings throughout each phase.

```
Phase 1: DESIGN          Agents explore the problem from competing angles.
                          Challenge each other's findings. Pin what survives.
                          Wizard closes when the design is battle-tested.

Phase 2: PLAN             Decompose the design into testable tasks.
                          Fight over naming, ordering, coverage, compliance.
                          Pin the agreed task list.

Phase 3: IMPLEMENTATION   One agent builds each task (TDD enforced).
                          The others attack the implementation directly.
                          Every task earns approval before moving on.

Phase 4: REVIEW           Independent reviews against design and plan.
                          Agents fight over findings AND missing findings.
                          Critical and Important issues must be fixed.

         FINISHING        Agents debate completeness. Wizard presents
                          merge options: merge, PR, keep branch, or discard.
```

No phase is skipped. No work passes unchallenged.

---

## The Team

### Wizard — Dungeon Master

Thinks 5 times before speaking. Opens phases, dispatches the team with precise angles, observes silently (90% of the time), and closes each phase with a binding ruling citing Dungeon evidence. The Wizard doesn't write code — it ensures the process produces the best possible outcome.

### Warrior — Stress Tester

Rips things apart. Race conditions, null input, scale, memory pressure — nothing passes unchecked. Demands evidence, proposes counter-examples, and pushes until things break. Concedes instantly when proven wrong.

### Archer — Pattern Seeker

Finds what brute force misses. Naming mismatches, violated conventions, design drift. Traces ripple effects — changing X in module A silently breaks Y in module C through an implicit contract in Z. Every finding includes the exact location and the exact consequence.

### Rogue — Assumption Destroyer

Thinks like a malicious user, a failing network, a corrupted database, a race condition at 3 AM. Constructs the exact sequence of events that turns a minor oversight into a critical failure. Every finding is a concrete attack scenario, not a theoretical concern.

---

## Modes

Not every task needs all four agents. The Wizard recommends a mode based on complexity, or you can override directly.

| | Full Raid | Skirmish | Scout |
|---|---|---|---|
| **Agents** | 3 + Wizard | 2 + Wizard | 1 + Wizard |
| **Design** | Full adversarial | Lightweight | Inline |
| **Planning** | Full adversarial | Merged with design | Inline |
| **Implementation** | 1 builds, 2 attack | 1 builds, 1 attacks | 1 builds, Wizard reviews |
| **Review** | 3 independent reviews | 1 review + Wizard | Wizard only |
| **TDD** | Enforced | Enforced | Enforced |

**When to use each:**

- **Full Raid** — Architecture decisions, security-critical code, major refactors, cross-layer changes
- **Skirmish** — Medium features, non-trivial bugfixes, multi-file changes
- **Scout** — Config changes, documentation, single-file fixes

Override the Wizard's recommendation: *"Full Raid this"*, *"Skirmish this bugfix"*, *"Scout this"*.

The Wizard can escalate mid-task (Scout to Skirmish, Skirmish to Full Raid) with your approval. It cannot de-escalate without asking.

---

## The Dungeon

The Dungeon (`.claude/raid-dungeon.md`) is the team's shared knowledge artifact — a curated board where agents pin verified findings during each phase.

**What goes in:** Findings that survived challenge from 2+ agents, active unresolved battles, key decisions, escalation points.

**What stays in conversation:** The back-and-forth of challenges and roasts, exploratory thinking, concessions. The conversation is the sparring ring. The Dungeon is the scoreboard.

**Lifecycle:** Wizard creates it when opening a phase, agents pin findings with `DUNGEON:` prefix, Wizard archives it when closing (`raid-dungeon-phase-N.md`), and all Dungeon files are cleaned up when the session ends.

Agents interact directly — `@Name` mentions, building on each other's discoveries, roasting weak analysis. The Wizard observes silently, intervening only on destructive loops, drift, deadlock, or misinformation.

---

## What Gets Installed

```
.claude/
├── raid.json                        # Project config (auto-detected, editable)
├── raid-rules.md                    # 17 team rules across 3 pillars (editable)
├── settings.json                    # Hooks merged with existing (backup created)
├── agents/
│   ├── wizard.md                    # Dungeon master
│   ├── warrior.md                   # Stress tester
│   ├── archer.md                    # Pattern seeker
│   └── rogue.md                     # Assumption destroyer
├── hooks/
│   ├── raid-lib.sh                  # Shared config and session state
│   ├── raid-session-start.sh        # Session activation
│   ├── raid-session-end.sh          # Archive and cleanup
│   ├── raid-stop.sh                 # Phase transition backup
│   ├── raid-pre-compact.sh          # Pre-compaction backup
│   ├── raid-task-created.sh         # Task subject validation
│   ├── raid-task-completed.sh       # Test evidence gate
│   ├── raid-teammate-idle.sh        # Idle agent nudge
│   ├── validate-commit.sh           # Conventional commits + test gate
│   ├── validate-write-gate.sh       # Design doc before implementation
│   ├── validate-file-naming.sh      # Naming convention enforcement
│   ├── validate-no-placeholders.sh  # No TBD/TODO in specs
│   ├── validate-dungeon.sh          # Multi-agent verification on pins
│   ├── validate-browser-tests-exist.sh  # Playwright test detection
│   └── validate-browser-cleanup.sh  # Browser process cleanup
└── skills/
    ├── raid-protocol/               # Session lifecycle and team rules
    ├── raid-design/                 # Phase 1: adversarial exploration
    ├── raid-implementation-plan/    # Phase 2: task decomposition
    ├── raid-implementation/         # Phase 3: TDD with direct challenge
    ├── raid-review/                 # Phase 4: independent review + fighting
    ├── raid-finishing/              # Completeness debate + merge options
    ├── raid-tdd/                    # RED-GREEN-REFACTOR enforcement
    ├── raid-debugging/              # Root-cause investigation
    ├── raid-verification/           # Evidence-before-claims gate
    ├── raid-git-worktrees/          # Isolated workspace creation
    ├── raid-browser/                # Browser startup discovery
    ├── raid-browser-playwright/     # Playwright test authoring
    └── raid-browser-chrome/         # Live browser inspection
```

Dungeon files (`raid-dungeon.md`, `raid-dungeon-phase-*.md`) and session state (`raid-session`) are created at runtime during Raid sessions and cleaned up automatically.

---

## Hooks

Hooks enforce workflow discipline automatically. They split into two categories:

### Lifecycle Hooks

Manage session state without manual intervention. These activate and deactivate as sessions begin and end.

| Hook | Trigger | Purpose |
|---|---|---|
| **raid-session-start** | SessionStart | Activates Raid workflow, checks Vault for past quests |
| **raid-session-end** | SessionEnd | Archives Dungeon, drafts Vault entry, removes session |
| **raid-stop** | Stop | Backs up Dungeon on phase transitions |
| **raid-pre-compact** | PreCompact | Backs up Dungeon before message compaction |
| **raid-task-created** | TaskCreated | Validates task subjects are meaningful |
| **raid-task-completed** | TaskCompleted | Blocks task completion without test evidence |
| **raid-teammate-idle** | TeammateIdle | Nudges idle agents to participate |

### Quality Gates

Enforce code standards and workflow compliance. Quality gates only activate during Raid sessions — they won't interfere with normal coding.

| Hook | Trigger | Purpose |
|---|---|---|
| **validate-commit** | PreToolUse (Bash) | Conventional commit format + test gate before commits |
| **validate-write-gate** | PreToolUse (Write) | Blocks implementation files before design doc exists |
| **validate-file-naming** | PostToolUse (Write) | Enforces naming convention (kebab-case, snake_case, etc.) |
| **validate-no-placeholders** | PostToolUse (Write) | Blocks TBD/TODO/FIXME in specs and plans |
| **validate-dungeon** | PostToolUse (Write) | Requires 2+ agents verified on Dungeon pins |
| **validate-browser-tests-exist** | PreToolUse (Bash) | Checks Playwright tests exist before commits |
| **validate-browser-cleanup** | PostToolUse (Bash) | Verifies browser processes cleaned up properly |

All hooks are POSIX-compatible, read configuration from `raid.json`, and use `#claude-raid` markers to avoid collisions with your existing hooks.

**Exit codes:** `0` = pass, `2` = block with message (agent sees the error and must fix it).

---

## Skills

13 specialized skills guide agent behavior at each stage of the workflow.

### Phase Skills

| Skill | Purpose |
|---|---|
| **raid-protocol** | Master orchestration. Session lifecycle, team composition, modes, rules, reference tables. Loaded at session start. |
| **raid-design** | Phase 1. Agents independently explore from assigned angles, challenge findings, pin discoveries. Produces a battle-tested design spec. |
| **raid-implementation-plan** | Phase 2. Decompose design into testable tasks. Agents debate naming, ordering, coverage, compliance. |
| **raid-implementation** | Phase 3. One implements (TDD), others attack. Rotate implementer per task. No task passes without all issues resolved. |
| **raid-review** | Phase 4. Independent reviews against design and plan. Issues classified as Critical (must fix), Important (must fix), or Minor (note). |
| **raid-finishing** | Completeness debate. Agents argue whether work is done. Four merge options: merge, PR, keep branch, discard. |

### Discipline Skills

| Skill | Purpose |
|---|---|
| **raid-tdd** | Strict RED-GREEN-REFACTOR. No production code before a failing test. Challengers attack test quality. |
| **raid-debugging** | Competing hypotheses in parallel. No fixes without confirmed root cause. 3+ failed fixes triggers architecture rethink. |
| **raid-verification** | Evidence before assertions. Fresh test run required. Forbidden phrases without evidence: "done", "working", "fixed". |
| **raid-git-worktrees** | Isolated workspace creation with safety verification and clean test baseline. |

### Browser Skills

| Skill | Purpose |
|---|---|
| **raid-browser** | Browser startup discovery. Detects dev server, auth requirements, startup steps. |
| **raid-browser-playwright** | Playwright MCP test authoring with network and console assertions. |
| **raid-browser-chrome** | Live browser inspection via Claude-in-Chrome MCP. Angle-driven investigation. |

---

## Team Rules

17 non-negotiable rules organized into 3 pillars. Stored in `.claude/raid-rules.md` (editable).

### Pillar 1: Intellectual Honesty

Every claim has evidence you gathered yourself. If you haven't read the code or run the command this turn, you don't know what it says. Never fabricate evidence, certainty, or findings.

### Pillar 2: Zero Ego Collaboration

When proven wrong, concede instantly. Defend with evidence, never with authority. A teammate catching your mistake is a gift. Build on each other's work — the best findings come from combining perspectives.

### Pillar 3: Discipline and Efficiency

Maximum effort on every task. Every interaction carries work forward. Agents talk directly to each other — the Wizard is not a relay. Escalate to the Wizard only after you've tried to resolve it yourself.

---

## Configuration

`claude-raid summon` auto-detects your project and generates `.claude/raid.json`:

```json
{
  "project": {
    "name": "my-project",
    "language": "typescript",
    "testCommand": "npm test",
    "lintCommand": "npm run lint",
    "buildCommand": "npm run build"
  },
  "paths": {
    "specs": "docs/raid/specs",
    "plans": "docs/raid/plans",
    "worktrees": ".worktrees"
  },
  "conventions": {
    "fileNaming": "kebab-case",
    "commits": "conventional"
  },
  "raid": {
    "defaultMode": "full",
    "vault": { "path": ".claude/vault", "enabled": true },
    "lifecycle": {
      "autoSessionManagement": true,
      "testWindowMinutes": 10
    }
  }
}
```

### Auto-Detection

| Marker File | Language | Test Command | Lint Command |
|---|---|---|---|
| `package.json` | JavaScript | `npm test` | `npm run lint` |
| `Cargo.toml` | Rust | `cargo test` | `cargo clippy` |
| `pyproject.toml` | Python | `pytest` / `poetry run pytest` | `ruff check .` |
| `requirements.txt` | Python | `pytest` | `ruff check .` |
| `go.mod` | Go | `go test ./...` | `go vet ./...` |

Commands are extracted from your project files (e.g., `scripts.test` in `package.json`). Package manager is auto-detected (npm, pnpm, yarn, bun, uv, poetry). Edit `raid.json` to override any value.

### Configuration Reference

| Key | Default | Description |
|---|---|---|
| `project.testCommand` | auto-detected | Command to run tests |
| `project.lintCommand` | auto-detected | Command to run linting |
| `project.buildCommand` | auto-detected | Command to build |
| `paths.specs` | `docs/raid/specs` | Design spec output directory |
| `paths.plans` | `docs/raid/plans` | Implementation plan output directory |
| `paths.worktrees` | `.worktrees` | Git worktree directory |
| `conventions.fileNaming` | `none` | `kebab-case`, `snake_case`, `camelCase`, or `none` |
| `conventions.commits` | `conventional` | Commit message format |
| `conventions.commitMinLength` | `15` | Minimum commit message length |
| `conventions.maxDepth` | `8` | Maximum file nesting depth |
| `raid.defaultMode` | `full` | Default mode: `full`, `skirmish`, `scout` |
| `raid.lifecycle.testWindowMinutes` | `10` | Max age (minutes) of test run for verification |

### Browser Testing

When a browser framework is detected (Next.js, Vite, Angular, etc.), a `browser` section is added to `raid.json`:

```json
{
  "browser": {
    "enabled": true,
    "framework": "next",
    "devCommand": "npm run dev",
    "baseUrl": "http://localhost:3000",
    "defaultPort": 3000,
    "playwrightConfig": "playwright.config.ts"
  }
}
```

This enables browser-specific hooks and skills — Playwright test detection, browser process cleanup, and live browser inspection during reviews.

---

## CLI Commands

| Command | Purpose |
|---|---|
| `claude-raid summon` | Install Raid into your project |
| `claude-raid summon --dry-run` | Preview what would be installed |
| `claude-raid update` | Upgrade hooks, skills, and rules to latest version |
| `claude-raid dismantle` | Remove all Raid files, restore original settings |
| `claude-raid heal` | Check environment health, show reference card |

Old names (`init`, `remove`, `doctor`) still work as aliases.

### `summon`

Installs the full Raid system into your project. Auto-detects project type, copies agents/hooks/skills, generates `raid.json`, merges settings (with backup), and runs the setup wizard.

- Never overwrites existing files — customized agents are preserved
- Idempotent — safe to run multiple times
- `--dry-run` shows exactly what would be created without touching disk

### `update`

Upgrades hooks, skills, and `raid-rules.md` to the latest version. Skips customized agents (warns which ones were preserved). Does not touch `raid.json` — your project config stays intact.

### `dismantle`

Removes all Raid agents, hooks, skills, and config files. Restores `settings.json` from the backup created during install. Preserves non-Raid files in `.claude/`.

### `heal`

Checks Node.js, Claude Code, jq, teammateMode, and split-pane support. Offers to fix missing configuration interactively. Shows the "How It Works" reference card with modes, phases, hook enforcement, and controls.

---

## Controls

**tmux pane navigation (recommended):**

| Action | How |
|---|---|
| **Switch to agent pane** | Click the pane, or `Ctrl+B` then arrow key |
| **Talk to an agent** | Click their pane and type |
| **View all agents** | All panes visible simultaneously |

**In-process mode (no tmux):**

| Shortcut | Action |
|---|---|
| **Shift+Down** | Cycle through teammates |
| **Enter** | View a teammate's session |
| **Escape** | Interrupt a teammate's turn |
| **Ctrl+T** | Toggle the shared task list |

### Starting a Raid session

```bash
# Always start tmux first for multi-pane
tmux new-session -s raid

# Then start the Wizard inside tmux
claude --agent wizard
```

The Wizard creates a team and spawns agents — each gets its own tmux pane automatically. If you're not inside tmux, agents fall back to in-process mode (single pane).

---

## Non-Invasive Design

The Raid is a tool in your toolkit, not your project's operating system.

- **Never touches your `CLAUDE.md`** — your project instructions stay yours
- **Merges settings** alongside your existing config, with automatic backup
- **Won't overwrite** existing agents, hooks, or skills that share a name
- **Session-scoped hooks** — workflow hooks only activate during Raid sessions, never during normal coding
- **Clean removal** restores your original `settings.json` from backup
- **Zero npm dependencies** — pure Node.js stdlib, fast `npx` cold-start

---

## Inherited from Superpowers

The Raid inherits and adapts the [Superpowers](https://github.com/obra/superpowers) behavioral harness:

| Concept | How the Raid Uses It |
|---|---|
| HARD-GATEs | No code before design approval. No implementation before plan approval. |
| TDD Iron Law | No production code without a failing test first. Enforced in all modes. |
| Verification Iron Law | No completion claims without fresh test evidence. |
| No Placeholders | Specs and plans must contain complete content, not "TBD" or "implement later". |
| Conventional Commits | Enforced via hook: `type(scope): description`. |

**What's different:** Superpowers uses a single agent with subagent delegation. The Raid uses 4 agents in an agent team with adversarial cross-testing, direct interaction, and collaborative learning. Agents talk to each other (not through the Wizard), pin verified findings to a shared Dungeon, and self-organize within phases. Every decision is stress-tested from multiple angles before it passes.

---

## License

MIT
