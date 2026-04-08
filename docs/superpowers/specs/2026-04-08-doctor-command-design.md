# Design: `claude-raid doctor` Command

## Summary

Add a `claude-raid doctor` command that checks prerequisites and prints a styled quick-start guide for running Raid sessions with Claude Code agent teams. Trim `init` output to point to `doctor` instead of inlining the guide.

## Motivation

The current `init` output dumps a few lines about how to start. Users need more: prerequisite validation (tmux, Claude Code version, teammate mode config) and a clear reference for tmux navigation, agent team commands, and Raid modes. A separate `doctor` command keeps `init` clean and lets users re-run diagnostics anytime.

## New Files

### `src/doctor.js`

Exports `run()` (CLI entry) and `diagnose(opts)` (testable core).

#### `diagnose(opts)`

Accepts `{ homedir }` (defaults to `os.homedir()`). Returns:

```js
{
  checks: [
    { id: 'node', ok: true, label: 'Node.js', detail: 'v22.0.0' },
    { id: 'claude', ok: true, label: 'Claude Code', detail: 'v2.3.1 (≥ 2.1.32 required)' },
    { id: 'tmux', ok: true, label: 'tmux', detail: 'installed' },
    { id: 'teammate-mode', ok: false, label: 'teammateMode', detail: 'not set in ~/.claude.json' },
  ],
  allOk: false,
}
```

**Checks performed:**

1. **Node.js** — `process.version`, always passes (we're already running).
2. **Claude Code** — `execSync('claude --version')`, parse semver, require ≥ 2.1.32. If not found: `ok: false`, detail includes install hint.
3. **tmux** — `execSync('which tmux')`. If not found: `ok: false`, detail: `not installed → brew install tmux`.
4. **teammateMode** — Read `~/.claude.json`, check for `"teammateMode": "tmux"`. If missing: `ok: false`, detail includes the fix command.

Each check uses try/catch around execSync so a missing binary produces a clean failure, never a crash.

#### `run()`

Calls `diagnose()`, then prints styled output to stdout:

```
claude-raid doctor — Environment & Quick Start

─── Prerequisites ───────────────────────────────

  ✔ Node.js          v22.0.0
  ✔ Claude Code       v2.3.1 (≥ 2.1.32 required)
  ✔ tmux              installed
  ✖ teammateMode      not set in ~/.claude.json
    → Add "teammateMode": "tmux" to ~/.claude.json

─── Quick Start ─────────────────────────────────

  In-process mode (any terminal):

    claude --agent wizard

  Split-pane mode (tmux):

    tmux new-session -s raid
    claude --agent wizard --teammate-mode tmux

─── Navigating Teammates ────────────────────────

  Shift+Down    Cycle through teammates
  Enter         View a teammate's session
  Escape        Interrupt a teammate's turn
  Ctrl+T        Toggle the shared task list
  Click pane    Interact directly (split-pane mode)

─── Raid Modes ──────────────────────────────────

  Full Raid     Warrior + Archer + Rogue (3 agents)
  Skirmish      2 agents, lightweight
  Scout         Wizard solo review

  The Wizard recommends a mode based on task
  complexity. You confirm before agents spawn.
```

**Styling rules:**
- Section headers use `───` box-drawing characters.
- `✔` for passing checks, `✖` for failing ones.
- Fix hints indented with `→` on the line below the failing check.
- No colors/ANSI codes — works in any terminal, including piped output.

## Modified Files

### `bin/cli.js`

Add `doctor` to the `COMMANDS` map:

```js
const COMMANDS = {
  init: () => require('../src/init').run(),
  update: () => require('../src/update').run(),
  remove: () => require('../src/remove').run(),
  doctor: () => require('../src/doctor').run(),
};
```

Update the help text to include `claude-raid doctor`.

### `src/init.js`

Replace the current guide block in `run()` with a shorter message:

```
The Raid is installed.

  Run 'claude-raid doctor' for setup guide and environment check.
```

The `install()` function is not modified.

## New Test File

### `tests/cli/doctor.test.js`

Tests for the `diagnose()` function:

- Returns `ok: true` for node check (always true since we're running in Node).
- Returns `ok: false` for Claude Code when `claude` binary not found (mock execSync or test in isolated env).
- Returns `ok: false` for tmux when `which tmux` fails.
- Returns `ok: false` for teammateMode when `~/.claude.json` doesn't exist.
- Returns `ok: true` for teammateMode when `~/.claude.json` has `"teammateMode": "tmux"`.
- `allOk` reflects all checks passing.

`diagnose()` accepts `{ homedir }` to allow testing without touching the real home directory. Version-check commands are called via a helper that can be overridden in tests.

## What Does NOT Change

- `install()` in `src/init.js` — no functional changes.
- All existing tests pass unchanged.
- No new dependencies — only Node built-ins (`child_process`, `os`, `fs`, `path`).
- Template files, hooks, skills, agents — untouched.

## Edge Cases

- **Claude Code not installed**: check fails gracefully, prints install guidance.
- **tmux not installed**: check fails, prints `brew install tmux` (macOS) hint.
- **`~/.claude.json` doesn't exist**: teammateMode check fails, prints the fix.
- **`~/.claude.json` exists but is invalid JSON**: teammateMode check fails with parse error hint.
- **Running in CI/pipe**: no ANSI codes, output is plain text with unicode box characters.
