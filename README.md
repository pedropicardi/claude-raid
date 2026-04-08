# claude-raid

**Adversarial multi-agent development system for [Claude Code](https://claude.ai/code).**

Four agents -- Wizard, Warrior, Archer, Rogue -- work through a strict 4-phase workflow where every decision, implementation, and review is stress-tested by competing agents who learn from each other's mistakes and push every finding to its edges.

Adapted from [obra/superpowers](https://github.com/obra/superpowers) by Jesse Vincent.

---

## Quick Start

```bash
npx claude-raid init
claude --agent wizard
```

That's it. The installer auto-detects your project type, generates configuration, and merges with your existing Claude Code setup. Nothing is overwritten.

For split-pane mode (recommended for watching agents interact):

```bash
claude --agent wizard --teammate-mode tmux
```

## How It Works

You describe your task. The Wizard assesses complexity, recommends a mode, and orchestrates the team through a 4-phase workflow:

```
Phase 1: DESIGN          All agents explore from different angles.
                          They fight, learn from mistakes, push to edges.
                          Output: battle-tested design specification.

Phase 2: PLAN             Agents decompose the design into tasks.
                          They cross-test for compliance, naming consistency,
                          test coverage, and ordering.
                          Output: implementation plan with TDD steps.

Phase 3: IMPLEMENTATION   One agent implements each task. The others attack.
                          Rotate. TDD enforced. Every task earns approval.

Phase 4: REVIEW           Independent reviews from every angle.
                          Cross-tested. Issues categorized by severity.
                          Critical and Important must be fixed.

         FINISHING        Agents debate completeness against the spec.
                          Wizard presents merge options.
```

Every phase follows the same pattern: Wizard dispatches with different angles, agents explore independently, agents cross-test and challenge each other, Wizard synthesizes and delivers a binding ruling. No phase is skipped. No work passes unchallenged.

## The Team

### Wizard (Lead)

Purple. Model: Opus 4.6. Observes 90%, acts 10%.

The Wizard doesn't write code -- it thinks. Every response has been turned over 3, 4, 5 times before a single word is committed. It reads the full prompt three times, identifies the real problem beneath the stated one, maps the blast radius, and only then dispatches the team with precise angles.

It detects destructive loops, enforces efficiency, ensures agents learn from each other, and delivers binding rulings. When the team disagrees, the Wizard lets friction produce truth -- but intervenes when the dispute stops being productive.

### Warrior

Red. Aggressive thoroughness. Stress-tests to destruction.

The Warrior doesn't skim -- it rips things apart. When other agents present findings, its first instinct is: *"Where is this wrong?"* It demands evidence, proposes counter-examples, and pushes until things break. Race conditions, null input, scale, memory pressure -- nothing passes unchecked. But it fights smart: every move counts, and it concedes instantly when proven wrong.

**Signals:** `🔍 FINDING:` / `⚔️ CHALLENGE:` / `✅ CONCEDE:`

### Archer

Green. Precision over brute force. Pattern recognition.

The Archer finds what brute force misses. It spots naming mismatches, violated conventions, and design drift. It traces ripple effects -- changing X in module A silently breaks Y in module C through an implicit contract in Z. It checks consistency with existing codebase patterns, not just correctness in isolation. Every finding includes the exact location and the exact consequence.

**Signals:** `🎯 FINDING:` / `🏹 CHALLENGE:` / `✅ CONCEDE:`

### Rogue

Orange. Adversarial mindset. Assumption destroyer.

The Rogue thinks like a malicious user, a failing network, a corrupted database, a race condition at 3 AM. *"This will never be null."* Oh really? *"Users won't do that."* Watch me. It constructs the exact sequence of events that turns a minor oversight into a critical failure. Every finding is a concrete attack scenario, not a theoretical concern.

**Signals:** `💀 FINDING:` / `🗡️ CHALLENGE:` / `✅ CONCEDE:`

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

13 non-negotiable rules that every agent follows, stored in `.claude/raid-rules.md`:

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

## Non-Invasive Design

The Raid is a tool in your toolkit, not your project's operating system.

- **Never touches your `CLAUDE.md`** -- your project instructions stay yours
- **Merges settings** alongside your existing config, with automatic backup
- **Won't overwrite** existing agents, hooks, or skills that share a name
- **Session-scoped hooks** -- workflow hooks only activate during Raid sessions (`.claude/raid-session`), never during normal coding
- **Clean removal** restores your original `settings.json` from backup
- **Zero npm dependencies** -- pure Node.js stdlib, fast `npx` cold-start

## Requirements

- [Claude Code](https://claude.ai/code) v2.1.32+
- Node.js 18+ (for installation only -- the installed files are language-agnostic)
- `jq` (for hooks -- pre-installed on macOS, available via `apt install jq` on Linux)

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

**What's different:** Superpowers uses a single agent with subagent delegation. The Raid uses 4 agents in an agent team with adversarial cross-testing, competitive exploration, and collaborative learning. Every decision is stress-tested from multiple angles before it passes.

## License

MIT
