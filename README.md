<div align="center">

```
   ⚔ ══════════════════════════════════════════════════════════ ⚔

       ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗
      ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝
      ██║     ██║     ███████║██║   ██║██║  ██║█████╗
      ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝
      ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗
       ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝
               ██████╗  █████╗ ██╗██████╗
               ██╔══██╗██╔══██╗██║██╔══██╗
               ██████╔╝███████║██║██║  ██║
               ██╔══██╗██╔══██║██║██║  ██║
               ██║  ██║██║  ██║██║██████╔╝
               ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═════╝

      Round-based Adversarial Intelligence Dungeon
                   for Claude Code

   ⚔ ══════════════════════════════════════════════════════════ ⚔
```

**Four AI agents. One shared dungeon. Every decision stress-tested before it ships.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)
[![Node.js 18+](https://img.shields.io/badge/node-18%2B-blue.svg)](#prerequisites)

[Quick Start](#quick-start) &bull; [How It Works](#how-it-works) &bull; [The Team](#the-team) &bull; [Configuration](#configuration) &bull; [CLI Reference](#cli-reference)

</div>

---

## Quick Start

```bash
npx claude-raid summon
```

That's it. One command installs the full system into any project.

```bash
# Preview what gets installed (no changes made)
npx claude-raid summon --dry-run

# Start a raid
tmux new-session -s raid
claude --agent wizard
```

Each agent gets its own tmux pane. Click into any pane to observe or talk to that agent directly. Describe your task and the Wizard takes over.

### Prerequisites

| Requirement | Why | Auto-configured? |
|:--|:--|:--|
| **Node.js** 18+ | Runs the installer | No |
| **Claude Code** v2.1.32+ | Agent teams support | No |
| **tmux** | Multi-pane agent display | No — `brew install tmux` |
| **jq** | Hook config parsing | Pre-installed on macOS |
| **teammateMode** | Set to `tmux` in `~/.claude.json` | Yes (wizard prompts) |

> **tmux is required for the multi-pane experience.** Each agent runs in its own pane so you can observe and interact with them independently. Without tmux, agents run in-process (single pane, cycle with `Shift+Down`).

The setup wizard checks all prerequisites during `summon` and offers to fix what it can.

---

## How It Works

You describe a task. The Wizard assesses complexity, recommends a mode, and opens the **Dungeon** — a shared artifact where agents pin verified findings throughout each phase.

```
 DESIGN            Agents explore the problem from competing angles.
                   Challenge each other's findings. Pin what survives.
                   Wizard closes when the design is battle-tested.

 PLAN              Decompose the design into testable tasks.
                   Fight over naming, ordering, coverage, compliance.
                   Pin the agreed task list.

 IMPLEMENTATION    One agent builds each task (TDD enforced).
                   The others attack the implementation directly.
                   Every task earns approval before moving on.

 REVIEW            Independent reviews against design and plan.
                   Agents fight over findings AND missing findings.
                   Critical and Important issues must be fixed.

 FINISHING         Agents debate completeness. Wizard presents
                   merge options: merge, PR, keep branch, or discard.
```

No phase is skipped. No work passes unchallenged.

---

## The Team

<table>
<tr>
<td width="25%" align="center"><h3>Wizard</h3><em>Dungeon Master</em></td>
<td width="25%" align="center"><h3>Warrior</h3><em>Stress Tester</em></td>
<td width="25%" align="center"><h3>Archer</h3><em>Pattern Seeker</em></td>
<td width="25%" align="center"><h3>Rogue</h3><em>Assumption Destroyer</em></td>
</tr>
<tr>
<td valign="top">Thinks 5 times before speaking. Opens phases, dispatches the team, observes silently, and closes with binding rulings citing Dungeon evidence. <strong>Never writes code.</strong></td>
<td valign="top">Race conditions, null input, scale, memory pressure — nothing passes unchecked. Demands evidence, proposes counter-examples, pushes until things break. Concedes instantly when proven wrong.</td>
<td valign="top">Finds what brute force misses. Naming mismatches, violated conventions, design drift. Traces ripple effects across modules through implicit contracts.</td>
<td valign="top">Thinks like a malicious user, a failing network, a corrupted database. Constructs the exact sequence of events that turns a minor oversight into a critical failure.</td>
</tr>
</table>

---

## Modes

Not every task needs all four agents. The Wizard recommends a mode based on complexity — or you can override directly.

| | Full Raid | Skirmish | Scout |
|:--|:--|:--|:--|
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

> The Wizard can escalate mid-task (Scout to Skirmish, Skirmish to Full Raid) with your approval. It cannot de-escalate without asking.

---

## The Dungeon

The Dungeon is the team's shared knowledge artifact — a curated board where agents pin verified findings during each phase.

**What goes in:** Findings that survived challenge from 2+ agents, active unresolved battles, key decisions, escalation points.

**What stays in conversation:** The back-and-forth of challenges, exploratory thinking, concessions. The conversation is the sparring ring. The Dungeon is the scoreboard.

**Lifecycle:** The Wizard creates it when opening a phase. Agents pin findings with `DUNGEON:` prefix. The Wizard archives it when closing. All Dungeon files are cleaned up when the session ends.

---

## What Gets Installed

<details>
<summary><strong>Full file tree</strong></summary>

```
.claude/
├── raid.json                        # Project config (auto-detected, editable)
├── party-rules.md                   # Party agent rules (editable)
├── dungeon-master-rules.md          # Wizard rules (editable)
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
│   ├── raid-pre-compact.sh          # Pre-compaction backup
│   ├── raid-task-created.sh         # Task subject validation
│   ├── validate-commit.sh           # Conventional commits + test gate
│   ├── validate-write-gate.sh       # Design doc before implementation
│   ├── validate-file-naming.sh      # Naming convention enforcement
│   ├── validate-no-placeholders.sh  # No TBD/TODO in specs
│   ├── validate-dungeon.sh          # Multi-agent verification on pins
│   ├── validate-browser-tests-exist.sh  # Playwright test detection
│   └── validate-browser-cleanup.sh  # Browser process cleanup
└── skills/
    ├── raid-init/                   # Quest selection and session setup
    ├── raid-canonical-protocol/     # Canonical Quest rules and signals
    ├── raid-canonical-prd/          # Phase 1: PRD creation
    ├── raid-canonical-design/       # Phase 2: Adversarial design
    ├── raid-canonical-implementation-plan/  # Phase 3: Task decomposition
    ├── raid-canonical-implementation/       # Phase 4: TDD + cross-testing
    ├── raid-canonical-review/       # Phase 5: Pinning + fixing
    ├── raid-wrap-up/                # Phase 6: Storyboard + PR
    ├── raid-tdd/                    # RED-GREEN-REFACTOR enforcement
    ├── raid-verification/           # Evidence-before-claims gate
    ├── raid-debugging/              # Root-cause investigation
    ├── raid-browser/                # Browser orchestration
    ├── raid-browser-playwright/     # Playwright test authoring
    └── raid-browser-chrome/         # Live Chrome inspection
```

</details>

Runtime files (dungeon artifacts, session state) are created during Raid sessions and cleaned up automatically.

---

## Hooks

Hooks enforce workflow discipline automatically. They only activate during Raid sessions — they never interfere with normal coding.

### Lifecycle

| Hook | Trigger | Purpose |
|:--|:--|:--|
| `raid-session-start` | SessionStart | Activates Raid workflow, checks Vault for past quests |
| `raid-session-end` | SessionEnd | Archives Dungeon, drafts Vault entry, removes session |
| `raid-pre-compact` | PreCompact | Backs up Dungeon before message compaction |
| `raid-task-created` | TaskCreated | Validates task subjects are meaningful |

### Quality Gates

| Hook | Trigger | Purpose |
|:--|:--|:--|
| `validate-commit` | PreToolUse (Bash) | Conventional commit format + test gate |
| `validate-write-gate` | PreToolUse (Write) | Blocks implementation before design doc exists |
| `validate-file-naming` | PostToolUse (Write) | Enforces naming conventions |
| `validate-no-placeholders` | PostToolUse (Write) | Blocks TBD/TODO/FIXME in specs and plans |
| `validate-dungeon` | PostToolUse (Write) | Requires 2+ agents verified on Dungeon pins |
| `validate-browser-tests-exist` | PreToolUse (Bash) | Checks Playwright tests exist before commits |
| `validate-browser-cleanup` | PostToolUse (Bash) | Verifies browser processes cleaned up |

All hooks are POSIX-compatible, read config from `raid.json`, and use `#claude-raid` markers to avoid collisions with your existing hooks. Exit code `0` = pass, `2` = block with message.

---

## Skills

14 specialized skills guide agent behavior across the workflow.

### Phase Skills

| Skill | Purpose |
|:--|:--|
| `raid-init` | Quest selection, greeting, session setup |
| `raid-canonical-protocol` | Canonical Quest rules, signals, phase gates |
| `raid-canonical-prd` | Phase 1 — PRD creation (optional) |
| `raid-canonical-design` | Phase 2 — Adversarial design exploration |
| `raid-canonical-implementation-plan` | Phase 3 — Task decomposition |
| `raid-canonical-implementation` | Phase 4 — TDD implementation + cross-testing |
| `raid-canonical-review` | Phase 5 — Pinning, fixing, black cards |
| `raid-wrap-up` | Phase 6 — Storyboard, PR, vault archival |

### Discipline Skills

| Skill | Purpose |
|:--|:--|
| `raid-tdd` | Strict RED-GREEN-REFACTOR. No production code before a failing test. |
| `raid-debugging` | Competing hypotheses in parallel. No fixes without confirmed root cause. |
| `raid-verification` | Evidence before assertions. Fresh test run required before any completion claim. |

### Browser Skills

| Skill | Purpose |
|:--|:--|
| `raid-browser` | Browser startup discovery — dev server, auth, startup steps |
| `raid-browser-playwright` | Playwright MCP test authoring with network and console assertions |
| `raid-browser-chrome` | Live browser inspection via Claude-in-Chrome MCP |

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
|:--|:--|:--|:--|
| `package.json` | JavaScript | `npm test` | `npm run lint` |
| `Cargo.toml` | Rust | `cargo test` | `cargo clippy` |
| `pyproject.toml` | Python | `pytest` / `poetry run pytest` | `ruff check .` |
| `requirements.txt` | Python | `pytest` | `ruff check .` |
| `go.mod` | Go | `go test ./...` | `go vet ./...` |

Commands are extracted from your project files (e.g., `scripts.test` in `package.json`). Package manager is auto-detected (npm, pnpm, yarn, bun, uv, poetry). Edit `raid.json` to override any value.

<details>
<summary><strong>Full configuration reference</strong></summary>

| Key | Default | Description |
|:--|:--|:--|
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

</details>

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

This enables browser-specific hooks and skills — Playwright test detection, browser process cleanup, and live inspection during reviews.

---

## CLI Reference

| Command | Alias | Purpose |
|:--|:--|:--|
| `claude-raid summon` | `init` | Install Raid into your project |
| `claude-raid update` | — | Upgrade hooks, skills, and rules to latest |
| `claude-raid dismantle` | `remove` | Remove all Raid files, restore original settings |
| `claude-raid heal` | `doctor` | Check environment health |

<details>
<summary><strong>Command details</strong></summary>

### `summon`

Installs the full Raid system. Auto-detects project type, copies agents/hooks/skills, generates `raid.json`, merges settings (with backup), and runs the setup wizard.

- Never overwrites existing files — customized agents are preserved
- Idempotent — safe to run multiple times
- `--dry-run` shows exactly what would be created without touching disk

### `update`

Upgrades hooks, skills, and rules to the latest version. Skips customized agents (warns which ones were preserved). Does not touch `raid.json`.

### `dismantle`

Removes all Raid agents, hooks, skills, and config files. Restores `settings.json` from the backup created during install.

### `heal`

Checks Node.js, Claude Code, jq, teammateMode, and split-pane support. Offers to fix missing configuration interactively.

</details>

---

## Controls

**tmux pane navigation (recommended):**

| Action | How |
|:--|:--|
| Switch to agent pane | Click the pane, or `Ctrl+B` then arrow key |
| Talk to an agent | Click their pane and type |
| View all agents | All panes visible simultaneously |

**In-process mode (no tmux):**

| Shortcut | Action |
|:--|:--|
| `Shift+Down` | Cycle through teammates |
| `Enter` | View a teammate's session |
| `Escape` | Interrupt a teammate's turn |
| `Ctrl+T` | Toggle the shared task list |

---

## Design Principles

- **Non-invasive** — Never touches your `CLAUDE.md`. Merges settings alongside your existing config with automatic backup. Clean removal restores originals.
- **Session-scoped** — Quality gate hooks only activate during Raid sessions. They never interfere with normal coding.
- **Zero dependencies** — Pure Node.js stdlib. Fast `npx` cold-start.
- **Safe by default** — Never overwrites existing files. Customized agents are always preserved.

---

## Inherited from Superpowers

Adapted from [obra/superpowers](https://github.com/obra/superpowers) by Jesse Vincent.

| Concept | How the Raid Uses It |
|:--|:--|
| HARD-GATEs | No code before design approval. No implementation before plan approval. |
| TDD Iron Law | No production code without a failing test first. Enforced in all modes. |
| Verification Iron Law | No completion claims without fresh test evidence. |
| No Placeholders | Specs and plans must contain complete content, not "TBD" or "implement later". |
| Conventional Commits | Enforced via hook: `type(scope): description`. |

**What's different:** Superpowers uses a single agent with subagent delegation. The Raid uses 4 persistent agents with adversarial cross-testing and direct interaction. Agents talk to each other, pin verified findings to a shared Dungeon, and self-organize within phases. Every decision is stress-tested from multiple angles before it passes.

---

## License

MIT

---

<div align="center">

Built for [Claude Code](https://claude.ai/claude-code).

</div>
