# CLI Redesign — RPG Theme & Visual Overhaul

**Date:** 2026-04-08
**Status:** Approved

## Problem

The CLI output is plain, inconsistent, and doesn't match the RPG identity of the project. Commands use generic software terminology (`init`, `remove`, `doctor`) that doesn't reinforce the dungeon/party metaphor. There's no visual branding, no color system, and no consistent output formatting.

## Solution

Redesign the CLI with:
1. RPG-themed command names with backward-compatible aliases
2. 8-bit dungeon aesthetic with box-drawing and a blocky ASCII banner
3. Warm dungeon color palette (amber primary, green success, red error)
4. Strong RPG copywriting throughout all output
5. Centralized UI module for all visual output

## Command Mapping

| Old command | New command | Alias kept? | Tagline |
|-------------|-------------|-------------|---------|
| `init` | `summon` | Yes — `init` still works | "Summon the party into this realm" |
| `update` | `update` | N/A (unchanged) | "Reforge the party's arsenal" |
| `remove` | `dismantle` | Yes — `remove` still works | "Dismantle the camp and retreat" |
| `doctor` | `heal` | Yes — `doctor` still works | "Diagnose wounds and prepare for battle" |

## Visual System

### ASCII Banner

Blocky pixel-font using `█` and `░` characters inside a double-line box. Amber-colored. Displayed on every command.

```
╔══════════════════════════════════════════════════╗
║                                                  ║
║    ██████╗  █████╗ ██╗██████╗                    ║
║    ██╔══██╗██╔══██╗██║██╔══██╗                   ║
║    ██████╔╝███████║██║██║  ██║                   ║
║    ██╔══██╗██╔══██║██║██║  ██║                   ║
║    ██║  ██║██║  ██║██║██████╔╝                   ║
║    ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═════╝                  ║
║                                                  ║
║    Adversarial multi-agent warfare               ║
║    for Claude Code                               ║
║                                                  ║
╚══════════════════════════════════════════════════╝
```

### Color Palette (ANSI)

| Role | Color | ANSI | Usage |
|------|-------|------|-------|
| Primary/UI | Amber/Yellow | `\x1b[33m` | Borders, headers, banner, box chrome |
| Success | Green | `\x1b[32m` | Pass icons (✔), ready messages |
| Error | Red | `\x1b[31m` | Fail icons (✖), blockers |
| Dim/secondary | Gray | `\x1b[90m` | Hints, descriptions, tagline |
| Bold text | Bold white | `\x1b[1m` | Command names, key terms |
| Reset | — | `\x1b[0m` | After every colored span |

### Box-drawn Sections

Status checks and grouped content use box-drawing:

```
┌─── ⚔ Party Status ────────────────────┐
│                                         │
│  ✔ Node.js       v22.0.0               │
│  ✔ Claude Code   v2.3.1                │
│  ✔ teammateMode  tmux                  │
│  ✔ Split-pane    tmux                  │
│                                         │
└─────────────────────────────────────────┘
```

Box borders are amber. Content inside uses green/red for pass/fail icons, white for labels, dim for hints.

### Section Headers

Themed with sword emoji:

```
  ⚔ Summoning the Party...
  ⚔ Diagnosing Wounds...
  ⚔ Commands
```

## Architecture

### New module: `src/ui.js`

Single source of truth for all visual output. No other module should contain ANSI escape codes.

**Exports:**

- `colors` — Object with color helpers. Each returns the string wrapped in ANSI codes, or plain string if `NO_COLOR` is set or stdout is not a TTY.
  - `colors.amber(str)` — `\x1b[33m`
  - `colors.green(str)` — `\x1b[32m`
  - `colors.red(str)` — `\x1b[31m`
  - `colors.dim(str)` — `\x1b[90m`
  - `colors.bold(str)` — `\x1b[1m`

- `banner()` — Returns the full ASCII banner as a colored string.

- `box(title, lines)` — Returns a box-drawn section. `title` is the header text (e.g. "Party Status"). `lines` is an array of pre-formatted content strings. The box auto-sizes to the widest line.

- `header(text)` — Returns `  ⚔ {text}` with amber color and bold.

- `print` — Convenience wrappers that write to stdout:
  - `print.success(text)` — green `✔` + text
  - `print.fail(text)` — red `✖` + text
  - `print.info(text)` — dim `→` + text
  - `print.line(text)` — plain indented text

**`NO_COLOR` support:** Respect the [no-color.org](https://no-color.org/) convention. If `process.env.NO_COLOR` is set (any value) or `process.stdout.isTTY` is falsy, all color functions return the input string unchanged. This is checked once at module load, not per-call.

### Changes to existing modules

**`bin/cli.js`:**
- Command map adds `summon`, `dismantle`, `heal` as primary commands
- `init`, `remove`, `doctor` kept as aliases pointing to same handlers
- Help screen uses `banner()` + themed command list
- Help screen shows primary command names with taglines

**`src/init.js` → `run()`:**
- Print banner
- Print `header('Summoning the Party...')`
- "Realm detected: {language}" / "Battle cry: {testCommand}"
- Setup wizard uses `box('Party Status', ...)` instead of plain `formatChecks`
- Final message: "The party is assembled. Your quest awaits." + `claude --agent wizard`
- Re-install message: "The party is already here. Use `claude-raid update` to reforge."

**`src/update.js` → `run()`:**
- Print banner
- Success: "The party's arsenal has been reforged."
- Skipped agents: "Preserved customized warriors: {list}"
- Not installed: "No party found. Run `claude-raid summon` first."

**`src/remove.js` → `run()`:**
- Print banner
- "The camp has been dismantled. Your realm has been restored to its former state."

**`src/doctor.js` → `run()`:**
- Print banner
- Print `header('Diagnosing Wounds...')`
- Setup wizard with themed boxes
- All-pass: "The party is battle-ready."
- Reference sections use box formatting with themed headers

**`src/setup.js`:**
- `formatChecks` uses `colors.green`/`colors.red` for icons, `colors.dim` for hints
- `runSetup` uses `box()` for the status section
- Interactive prompts use `colors.amber` for menu options, `colors.bold` for selected values
- "Ready" section: `header` + themed message instead of plain text

### Test changes

**New: `tests/cli/ui.test.js`:**
- `banner()` returns a string containing "RAID" (or the block characters)
- `box()` produces correct box-drawing characters and auto-sizes
- `colors.*` functions wrap strings with ANSI codes when colors enabled
- `colors.*` functions return plain strings when `NO_COLOR` is set
- `header()` includes the sword emoji
- `print.success/fail/info` produce correct icons

**Update: `tests/cli/setup.test.js`:**
- Strip ANSI codes when asserting on output content (add a `stripAnsi` helper)
- Existing assertions still work after color is added

**Update: `tests/cli/doctor.test.js`:**
- No functional changes expected (tests use `diagnose()` which is pure logic)

**Update: `tests/cli/init.test.js`:**
- No functional changes expected (tests use `install()` which is pure logic)

## Per-Command Output

### `claude-raid` (no args) or `claude-raid help`

```
[banner in amber]

  ⚔ Commands

    summon      Summon the party into this realm
    update      Reforge the party's arsenal
    dismantle   Dismantle the camp and retreat
    heal        Diagnose wounds and prepare for battle

  ⚔ Begin the Raid

    claude --agent wizard

  github.com/pedropicardi/claude-raid
```

### `claude-raid summon`

```
[banner]

  ⚔ Summoning the Party...

  Realm detected: typescript
  Battle cry:     npm test

┌─── ⚔ Party Status ────────────────────┐
│                                         │
│  ✔ Node.js       v22.0.0               │
│  ✔ Claude Code   v2.3.1                │
│  ✔ teammateMode  tmux                  │
│  ✔ Split-pane    tmux                  │
│                                         │
└─────────────────────────────────────────┘

  The party is assembled. Your quest awaits.

    claude --agent wizard
```

### `claude-raid update`

```
[banner]

  ⚔ Reforging the Arsenal...

  The party's arsenal has been reforged.
  Preserved customized warriors: warrior.md
```

### `claude-raid dismantle`

```
[banner]

  The camp has been dismantled.
  Your realm has been restored to its former state.
```

### `claude-raid heal`

```
[banner]

  ⚔ Diagnosing Wounds...

┌─── ⚔ Party Status ────────────────────┐
│                                         │
│  ✔ Node.js       v22.0.0               │
│  ✔ Claude Code   v2.3.1                │
│  ✖ teammateMode  not set               │
│    → Add "teammateMode" to ~/.claude.json│
│                                         │
└─────────────────────────────────────────┘

  [interactive mode menu if needed]

  The party is battle-ready.

┌─── ⚔ Quick Start ─────────────────────┐
│                                         │
│  In-process mode (any terminal):        │
│    claude --agent wizard                │
│                                         │
│  Split-pane mode (tmux):               │
│    tmux new-session -s raid             │
│    claude --agent wizard                │
│                                         │
└─────────────────────────────────────────┘

┌─── ⚔ Controls ────────────────────────┐
│                                         │
│  Shift+Down  Cycle through teammates    │
│  Enter       View a teammate's session  │
│  Escape      Interrupt a teammate       │
│  Ctrl+T      Toggle the task list       │
│  Click pane  Interact (split-pane)      │
│                                         │
└─────────────────────────────────────────┘
```
