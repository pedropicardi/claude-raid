# claude-raid

**Adversarial multi-agent development system for [Claude Code](https://claude.ai/code).**

Four agents -- Wizard, Warrior, Archer, Rogue -- work through a strict 4-phase workflow where every decision, implementation, and review is stress-tested by competing agents who learn from each other's mistakes and push every finding to its edges.

Adapted from [obra/superpowers](https://github.com/obra/superpowers) by Jesse Vincent.

---

## Getting Started

### 1. Install

```bash
npx claude-raid init
```

The installer auto-detects your project, copies agents/skills/hooks, and walks you through environment setup.

### 2. Prerequisites

The setup wizard checks these automatically:

| Requirement | Why | Auto-configured? |
|---|---|---|
| **Claude Code** v2.1.32+ | Agent teams support | No — install/update manually |
| **Node.js** 18+ | Runs the installer | No — install manually |
| **teammateMode** in `~/.claude.json` | Display mode for agent sessions | Yes — wizard prompts you |
| **tmux** or **iTerm2** | Split-pane mode (optional) | No — install manually |

`jq` is required for hooks (pre-installed on macOS, `apt install jq` on Linux).

The experimental agent teams flag (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`) is set automatically in your project's `.claude/settings.json` during install.

### 3. Run

```bash
claude --agent wizard
```

Re-check your environment anytime:

```bash
npx claude-raid doctor
```

## How It Works

You describe your task. The Wizard assesses complexity, recommends a mode, and opens the Dungeon:

```
Phase 1: DESIGN          Wizard opens the Dungeon, dispatches with angles.
                          Agents explore freely, challenge each other directly,
                          roast weak findings, build on discoveries.
                          Verified findings pinned to the Dungeon.
                          Wizard closes when design is battle-tested.

Phase 2: PLAN             Agents decompose the design into tasks.
                          They fight directly over compliance, naming,
                          test coverage, and ordering.
                          Agreed tasks pinned to the Dungeon.

Phase 3: IMPLEMENTATION   One agent implements each task. The others attack
                          directly — and attack each other's reviews too.
                          TDD enforced. Every task earns approval.

Phase 4: REVIEW           Independent reviews, then agents fight over findings
                          AND missing findings. Issues pinned by severity.
                          Critical and Important must be fixed.

         FINISHING        Agents debate completeness directly.
                          Wizard presents merge options. Dungeon cleaned up.
```

Every phase follows the same pattern: Wizard opens the Dungeon and dispatches with angles, agents self-organize and interact directly (challenge, roast, build on each other's work), pin verified findings to the Dungeon, and the Wizard closes with a binding ruling. No phase is skipped. No work passes unchallenged.

## The Team

### Wizard (Dungeon Master)

Purple. Model: Opus 4.6. Observes 90%, acts 10%.

The Wizard doesn't write code -- it thinks. Every response has been turned over 3, 4, 5 times before a single word is committed. It reads the full prompt three times, identifies the real problem beneath the stated one, maps the blast radius, and only then opens the Dungeon and dispatches the team with precise angles.

After dispatch, the Wizard goes silent. Agents own the phase -- they interact directly, challenge each other, build on discoveries, and pin verified findings to the Dungeon. The Wizard watches, intervening only on destructive loops, drift, deadlock, laziness, ego, or misinformation. When the phase objective is met, the Wizard closes with a binding ruling citing Dungeon evidence.

### Warrior

Red. Aggressive thoroughness. Stress-tests to destruction.

The Warrior doesn't skim -- it rips things apart. When @Archer or @Rogue present findings, its first instinct is: *"Where is this wrong?"* It demands evidence, proposes counter-examples, and pushes until things break. Race conditions, null input, scale, memory pressure -- nothing passes unchecked. It builds on teammates' discoveries and roasts weak analysis. Every move counts, and it concedes instantly when proven wrong.

**Signals:** `🔍 FINDING:` / `⚔️ CHALLENGE:` / `🔥 ROAST:` / `🔗 BUILDING ON @Name:` / `📌 DUNGEON:` / `🆘 WIZARD:` / `✅ CONCEDE:`

### Archer

Green. Precision over brute force. Pattern recognition.

The Archer finds what brute force misses. It spots naming mismatches, violated conventions, and design drift. It traces ripple effects -- changing X in module A silently breaks Y in module C through an implicit contract in Z. It challenges @Warrior and @Rogue from unexpected angles, building on their discoveries with surgical precision. Every finding includes the exact location and the exact consequence.

**Signals:** `🎯 FINDING:` / `🏹 CHALLENGE:` / `🔥 ROAST:` / `🔗 BUILDING ON @Name:` / `📌 DUNGEON:` / `🆘 WIZARD:` / `✅ CONCEDE:`

### Rogue

Orange. Adversarial mindset. Assumption destroyer.

The Rogue thinks like a malicious user, a failing network, a corrupted database, a race condition at 3 AM. *"This will never be null."* Oh really? *"Users won't do that."* Watch me. It constructs the exact sequence of events that turns a minor oversight into a critical failure. It weaponizes @Warrior and @Archer's findings to build nastier scenarios. Every finding is a concrete attack scenario, not a theoretical concern.

**Signals:** `💀 FINDING:` / `🗡️ CHALLENGE:` / `🔥 ROAST:` / `🔗 BUILDING ON @Name:` / `📌 DUNGEON:` / `🆘 WIZARD:` / `✅ CONCEDE:`

## Modes

Not every task needs all four agents. The Wizard recommends a mode based on complexity, or you can specify one directly.

| | Full Raid | Skirmish | Scout |
|---|---|---|---|
| **Agents** | 3 | 2 | 1 |
| **Design phase** | Full adversarial | Lightweight | Skip (inline) |
| **Plan phase** | Full adversarial | Merged with design | Skip (inline) |
| **Implementation** | 1 builds, 2 attack | 1 builds, 1 attacks | 1 builds, Wizard reviews |
| **Review** | 3 independent reviews | 1 review + Wizard | Wizard only |
| **TDD** | **Enforced** | **Enforced** | **Enforced** |
| **Verification** | Triple | Double | Single + Wizard |

**When to use:**

- **Full Raid** -- Complex features, architecture decisions, critical security reviews, major refactors, cross-layer changes
- **Skirmish** -- Medium features, non-trivial bugfixes, multi-file changes
- **Scout** -- Simple bugfixes, config changes, documentation, single-file changes

Override the Wizard's recommendation: *"Full Raid this"*, *"Skirmish this bugfix"*, *"Scout this"*.

The Wizard can escalate mid-task (Scout to Skirmish, Skirmish to Full Raid) with your approval. It cannot de-escalate without asking.

**TDD is non-negotiable in all modes.** No production code without a failing test first.

## The Dungeon

The Dungeon (`.claude/raid-dungeon.md`) is the team's shared knowledge artifact -- a curated board where agents pin verified findings during each phase.

**What goes in the Dungeon:** Findings that survived challenge, active unresolved battles, shared knowledge verified by 2+ agents, key decisions, escalation points.

**What stays in conversation:** The back-and-forth of challenges and roasts, exploratory thinking, concessions. The conversation is the sparring ring. The Dungeon is the scoreboard.

**Lifecycle:** Wizard creates the Dungeon when opening a phase, agents pin findings with `📌 DUNGEON:`, Wizard archives it when closing (`.claude/raid-dungeon-phase-N.md`), and agents can reference archived Dungeons from prior phases. All Dungeon files are cleaned up when the session ends.

**Direct interaction:** Agents talk to each other directly (`@Name`), build on discoveries (`🔗 BUILDING ON @Name:`), roast weak analysis (`🔥 ROAST:`), and escalate to the Wizard only when genuinely stuck (`🆘 WIZARD:`). The Wizard observes silently and intervenes only on destructive loops, drift, deadlock, laziness, ego, or misinformation.

## Skills

10 specialized skills guide agent behavior at each stage:

| Skill | When It's Used | What It Does |
|---|---|---|
| `raid-protocol` | Session start | Establishes workflow, modes, team rules, reference tables. The Wizard's operating manual. |
| `raid-design` | Phase 1 | Read-only exploration. Agents cover performance, robustness, testability, edge cases, architecture, DRY. Produces design specification. |
| `raid-implementation-plan` | Phase 2 | Collaborative decomposition with compliance testing. Every requirement gets a task, every task gets tests, naming is consistent, ordering is correct. |
| `raid-implementation` | Phase 3 | One implements, others attack, rotate. Task tracking via Claude Code's built-in system. Implementer rotation enforced. |
| `raid-review` | Phase 4 | Independent reviews against design doc and plan. Issues classified as Critical (must fix), Important (must fix), or Minor (note). |
| `raid-finishing` | After Phase 4 | Completeness debate. Tests verified. Four options: merge, PR, keep branch, discard. |
| `raid-tdd` | During implementation | Strict RED-GREEN-REFACTOR. Challengers attack test quality. Rationalization table prevents shortcuts. |
| `raid-debugging` | On bugs | Competing hypotheses in parallel. No fixes without root cause. 3+ failed fixes triggers architecture discussion. |
| `raid-verification` | Before completion claims | Evidence before assertions. Fresh test run required. Forbidden phrases without evidence: "done", "working", "fixed". |
| `raid-git-worktrees` | Before implementation | Isolated workspace with safety verification and clean test baseline. |

## Hooks

6 quality gates enforced automatically. All hooks are POSIX-compatible (work on macOS and Linux), read configuration from `.claude/raid.json`, and use `#claude-raid` markers so they never collide with your existing hooks.

Hooks that enforce workflow discipline (phase-gate, test-pass, verification) only activate during Raid sessions -- they won't interfere with normal coding outside of a Raid.

| Hook | Trigger | What It Does |
|---|---|---|
| **validate-file-naming.sh** | After Write/Edit | Enforces configured naming convention (kebab-case, snake_case, camelCase). Always blocks spaces in filenames. Blocks files nested deeper than configured max depth (default 8). |
| **validate-commit-message.sh** | Before Bash (git commit) | Enforces conventional commit format: `type(scope): description`. Blocks messages shorter than 15 characters. Blocks generic messages (update, fix, wip). Handles heredoc and quoted commit messages. |
| **validate-tests-pass.sh** | Before Bash (git commit) | Runs your test command before allowing commits. Writes a timestamp to `.claude/raid-last-test-run` on success (used by the verification hook). Only active during Raid sessions. |
| **validate-phase-gate.sh** | Before Write | Blocks writing implementation files when no design doc exists in the specs path. Full Raid: blocks. Skirmish: warns. Scout: skips. Only active during Raid sessions. |
| **validate-no-placeholders.sh** | After Write/Edit | Scans specs and plans for placeholder text: TBD, TODO, FIXME, "implement later", "add appropriate", "similar to Task", "handle edge cases". Blocks with line numbers. |
| **validate-verification.sh** | Before Bash (git commit) | Blocks commits that claim completion ("complete", "done", "final") unless tests were run within the last 10 minutes. Enforces the verification Iron Law. Only active during Raid sessions. |

### Hook exit codes

- `0` -- pass, no issues
- `2` -- block with message (agent sees the error and must fix it)

## Team Rules

17 non-negotiable rules that every agent follows, stored in `.claude/raid-rules.md`:

1. **No subagents** -- agent teams only
2. **No laziness** -- every challenge carries evidence
3. **No trust without verification** -- verify independently, reports lie
4. **Learn from mistakes** -- yours and others'
5. **Make every move count** -- no endless disputes
6. **Share knowledge** -- competitors but a team
7. **No ego** -- evidence or concede, instantly
8. **Stay active** -- all assigned agents participate
9. **Wizard is the human interface** -- agents ask the Wizard, Wizard asks you
10. **Wizard is impartial** -- judges by evidence, not source
11. **Wizard observes 90%, acts 10%** -- speaks when 90% confident
12. **Maximum effort, always**
13. **No hallucination** -- say "I don't know" when uncertain
14. **Dungeon discipline** -- only pin verified findings, don't spam
15. **Direct engagement** -- address agents by name, build on each other's work
16. **Escalate wisely** -- pull the Wizard only when genuinely stuck
17. **Roast with evidence** -- every critique carries proof

Edit this file to add project-specific rules. Updates via `claude-raid update` will overwrite it, so keep a backup if you've customized it.

## Configuration

`npx claude-raid init` auto-detects your project and generates `.claude/raid.json`:

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
    "defaultMode": "full"
  }
}
```

### Auto-detected languages

| Marker File | Language | Test Command | Lint Command | Build Command |
|---|---|---|---|---|
| `package.json` | JavaScript | `npm test` | `npm run lint` | `npm run build` |
| `Cargo.toml` | Rust | `cargo test` | `cargo clippy` | `cargo build` |
| `pyproject.toml` | Python | `pytest` / `poetry run pytest` | `ruff check .` | `python -m build` / `poetry build` |
| `requirements.txt` | Python | `pytest` | `ruff check .` | -- |
| `go.mod` | Go | `go test ./...` | `go vet ./...` | `go build ./...` |

Commands are auto-detected from your project files (e.g., `scripts.test` in `package.json`). Edit `raid.json` to override.

### Configuration reference

| Key | Default | Description |
|---|---|---|
| `project.testCommand` | auto-detected | Command to run tests |
| `project.lintCommand` | auto-detected | Command to run linting |
| `project.buildCommand` | auto-detected | Command to build |
| `paths.specs` | `docs/raid/specs` | Where design specs are saved |
| `paths.plans` | `docs/raid/plans` | Where implementation plans are saved |
| `paths.worktrees` | `.worktrees` | Where git worktrees are created |
| `conventions.fileNaming` | `none` | Naming convention: `kebab-case`, `snake_case`, `camelCase`, `none` |
| `conventions.commits` | `conventional` | Commit format |
| `conventions.commitMinLength` | `15` | Minimum commit message length |
| `conventions.maxDepth` | `8` | Maximum file nesting depth |
| `raid.defaultMode` | `full` | Default mode: `full`, `skirmish`, `scout` |

## CLI Commands

```bash
npx claude-raid init      # Install into current project
npx claude-raid update    # Update agents, skills, hooks (preserves raid.json)
npx claude-raid remove    # Uninstall and restore original settings
```

### `init`

- Creates `.claude/` if absent
- Auto-detects project type and generates `raid.json`
- Copies agents, hooks, skills, and `raid-rules.md`
- Merges settings into existing `settings.json` (with backup)
- Makes hooks executable
- Adds session files to `.gitignore`
- **Never overwrites** existing files with the same name

### `update`

- Overwrites hooks, skills, and `raid-rules.md` with latest versions
- **Skips customized agents** (warns you which ones were preserved)
- Does **not** touch `raid.json` (your project config)
- Re-runs settings merge to add any new hooks

### `remove`

- Removes all Raid agents, hooks, skills, and config files
- Restores `settings.json` from backup (if backup exists)
- Preserves non-Raid files in `.claude/`

## What Gets Installed

```
.claude/
├── raid.json                        # Project config (auto-generated, editable)
├── raid-rules.md                    # Team rules (editable)
├── settings.json                    # Merged with existing (backup at .pre-raid-backup)
├── agents/
│   ├── wizard.md                    # Lead coordinator
│   ├── warrior.md                   # Aggressive explorer
│   ├── archer.md                    # Precision pattern-seeker
│   └── rogue.md                     # Adversarial assumption-destroyer
├── hooks/
│   ├── validate-file-naming.sh      # Naming conventions
│   ├── validate-commit-message.sh   # Conventional commits
│   ├── validate-tests-pass.sh       # Test gate before commits
│   ├── validate-phase-gate.sh       # Design doc before implementation
│   ├── validate-no-placeholders.sh  # No TBD/TODO in specs
│   └── validate-verification.sh     # Test evidence before completion
└── skills/
    ├── raid-protocol/               # Master orchestration
    ├── raid-design/                 # Phase 1
    ├── raid-implementation-plan/    # Phase 2
    ├── raid-implementation/         # Phase 3
    ├── raid-review/                 # Phase 4
    ├── raid-finishing/              # Completeness + merge
    ├── raid-tdd/                    # Test-driven development
    ├── raid-debugging/              # Root cause analysis
    ├── raid-verification/           # Evidence before claims
    └── raid-git-worktrees/          # Isolated workspaces
```

**Note:** Dungeon files (`.claude/raid-dungeon.md`, `.claude/raid-dungeon-phase-*.md`) are created at runtime during Raid sessions, not during installation. They are session artifacts and are automatically cleaned up.

## Non-Invasive Design

The Raid is a tool in your toolkit, not your project's operating system.

- **Never touches your `CLAUDE.md`** -- your project instructions stay yours
- **Merges settings** alongside your existing config, with automatic backup
- **Won't overwrite** existing agents, hooks, or skills that share a name
- **Session-scoped hooks** -- workflow hooks only activate during Raid sessions (`.claude/raid-session`), never during normal coding
- **Clean removal** restores your original `settings.json` from backup
- **Zero npm dependencies** -- pure Node.js stdlib, fast `npx` cold-start

## Inherited from Superpowers

The Raid inherits and adapts the [Superpowers](https://github.com/obra/superpowers) behavioral harness:

| Concept | How The Raid Uses It |
|---|---|
| HARD-GATEs | No code before design approval. No implementation before plan approval. |
| TDD Iron Law | No production code without a failing test first. Enforced in all modes. |
| Verification Iron Law | No completion claims without fresh test evidence. |
| No Placeholders | Plans must contain complete code, not "TBD" or "implement later". |
| Red Flags / Rationalization tables | Built into TDD, debugging, and verification skills. |
| YAGNI / DRY | Remove unnecessary features. Don't duplicate logic. |
| Conventional commits | Enforced via hook: `type(scope): description`. |

**What's different:** Superpowers uses a single agent with subagent delegation. The Raid uses 4 agents in an agent team with adversarial cross-testing, competitive exploration, and collaborative learning. Agents interact directly with each other (not through the Wizard), pin verified findings to a shared Dungeon, and self-organize within phases. The Wizard observes 90%, acts 10% -- opening and closing phases, but never mediating every exchange. Every decision is stress-tested from multiple angles before it passes.

## License

MIT
