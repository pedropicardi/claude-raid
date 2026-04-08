# claude-raid

Adversarial multi-agent development system for [Claude Code](https://claude.ai/code).

Four agents — Wizard, Warrior, Archer, Rogue — work through a strict 4-phase workflow where every decision, implementation, and review is stress-tested by competing agents who learn from each other's mistakes.

Adapted from [obra/superpowers](https://github.com/obra/superpowers).

## Quick Start

```bash
# Install into your project
npx claude-raid init

# Start The Raid
claude --agent wizard

# With split panes (recommended)
claude --agent wizard --teammate-mode tmux
```

## Modes

| Mode | Agents | When to Use |
|------|--------|-------------|
| **Full Raid** | 3 | Complex features, architecture, security, major refactors |
| **Skirmish** | 2 | Medium features, multi-file changes, non-trivial bugfixes |
| **Scout** | 1 | Simple bugfixes, config changes, docs |

The Wizard recommends a mode based on your task. You can override with "Full Raid this", "Skirmish this", or "Scout this".

TDD is enforced in all modes.

## The Team

**Wizard** (purple) — Lead coordinator. Thinks 3-4-5 times before speaking. Observes 90%, acts 10%. Delivers binding rulings.

**Warrior** (red) — Aggressive explorer. Charges in, rips things apart, stress-tests to destruction. Relentless, not rude.

**Archer** (green) — Precision pattern-seeker. Finds hidden connections, naming drift, and consistency gaps that brute force misses.

**Rogue** (orange) — Adversarial assumption-destroyer. Thinks like an attacker, a failing network, a race condition at 3 AM.

## The Workflow

```
Phase 1: DESIGN ──────── Explore, fight, learn, produce spec
Phase 2: PLAN ─────────── Decompose, cross-test, produce plan
Phase 3: IMPLEMENT ────── One builds, others attack, rotate
Phase 4: REVIEW ────────── Independent reviews, cross-tested
         |
     FINISHING ────────── Debate completeness, merge
```

## Requirements

- [Claude Code](https://claude.ai/code) v2.1.32+
- Node.js 18+ (for installation only)
- `jq` (for hooks — usually pre-installed on macOS/Linux)

## Configuration

After installation, edit `.claude/raid.json`:

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

## Customization

- **Team rules**: Edit `.claude/raid-rules.md` to add project-specific rules
- **Configuration**: Edit `.claude/raid.json` for paths, commands, conventions
- **Default mode**: Set `raid.defaultMode` to `full`, `skirmish`, or `scout`

## Commands

```bash
npx claude-raid init      # Install into current project
npx claude-raid update    # Update agents, skills, hooks to latest
npx claude-raid remove    # Uninstall and restore settings
```

## What Gets Installed

```
.claude/
├── raid.json               # Project config (auto-generated, editable)
├── raid-rules.md           # Team rules (editable)
├── settings.json           # Merged with your existing settings
├── agents/                 # Wizard, Warrior, Archer, Rogue
├── hooks/                  # 6 quality gate hooks
└── skills/                 # 10 raid skills
```

Your existing `.claude/settings.json` is backed up to `.claude/settings.json.pre-raid-backup`. Your `CLAUDE.md` is never touched.

## Non-Invasive

The Raid is a tool in your toolkit, not your project's operating system:

- Never touches your `CLAUDE.md`
- Merges settings alongside your existing config (with backup)
- Won't overwrite existing agents, hooks, or skills with the same name
- Clean removal restores your original settings

## Credits

Adapted from [obra/superpowers](https://github.com/obra/superpowers) by Jesse Vincent.

## License

MIT
