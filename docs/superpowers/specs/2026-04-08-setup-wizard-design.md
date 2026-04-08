# Setup Wizard Design

**Date:** 2026-04-08
**Status:** Approved

## Problem

Prerequisites for running claude-raid are not well documented and are disconnected from the onboarding flow. Users install via `npx claude-raid init`, then may never run `claude-raid doctor`, hitting cryptic failures when they try `claude --agent wizard`. The doctor command itself is too rigid (only accepts `teammateMode: "tmux"`) and doesn't reflect the full range of valid configurations from the official Claude Code agent teams documentation.

## Solution

Turn the doctor command into an interactive setup wizard that detects missing configuration and offers to fix it with user confirmation. Integrate this wizard into the `init` command as a post-install step so that one command handles the full onboarding: install + diagnose + fix.

## Architecture

### New module: `src/setup.js`

Shared engine used by both `init` and `doctor`. Exports:

- **`runChecks(opts)`** — Runs all prerequisite checks. Returns `{ checks, allOk }`. Pure logic, no interactive I/O. Accepts `{ homedir, exec }` for testability.
- **`runSetup(opts)`** — Runs checks, then interactively prompts to fix issues. Accepts `{ stdin, stdout, homedir, exec }`. Returns `{ checks, allOk, actions }` where `actions` is an array of what was changed.
- **`formatChecks(checks)`** — Display formatting for check results.

### Check tiers

| Tier | Check ID | Label | Required? | Auto-fixable? |
|------|----------|-------|-----------|---------------|
| Required | `node` | Node.js | Yes | No — guide: install from nodejs.org |
| Required | `claude` | Claude Code | Yes | No — guide: `npm install -g @anthropic-ai/claude-code` |
| Recommended | `teammate-mode` | teammateMode | No | Yes — write/merge into `~/.claude.json` |
| Optional | `split-pane` | Split-pane support | No | No — guide: install tmux or iTerm2 `it2` CLI |

### teammateMode logic

Valid values: `"tmux"`, `"in-process"`, `"auto"`.

When `teammateMode` is missing or invalid:

1. Present numbered menu:
   ```
   Which teammate display mode do you want?

     1. tmux        — split panes, see all agents at once (requires tmux/iTerm2)
     2. in-process  — all in one terminal, cycle with Shift+Down
     3. auto        — split panes if available, otherwise in-process

   >
   ```
2. Confirm: `Write teammateMode: "<choice>" to ~/.claude.json? [Y/n]`
3. On confirm: read existing `~/.claude.json` (or `{}`), merge `teammateMode`, write back.
4. On decline: print the manual command and continue.

When the user picks `tmux` or `auto`, run the split-pane check. When they pick `in-process`, skip it and mark split-pane as `"not needed (in-process mode)"`.

### Split-pane check

Passes if **either** is found:
- `tmux` in PATH
- `it2` CLI in PATH (iTerm2)

If neither is found and the user selected `tmux` or `auto`:
- Warn (not block) with install instructions for both options
- Suggest switching to `in-process` if they don't want to install either

### Non-interactive mode

When stdin is not a TTY (piped, CI) or `--no-interactive` flag is passed:
- Skip all prompts
- Print check results and hints only (current doctor behavior)
- Exit with code 1 if any required check fails, 0 otherwise

## Changes to existing files

### `src/doctor.js`

Becomes a thin wrapper:
- `diagnose()` calls `setup.runChecks()`
- `run()` calls `setup.runSetup()` in interactive mode
- Remove all check functions (moved to setup.js)
- Keep the `run()` export and Quick Start / Navigating Teammates / Raid Modes output sections

### `src/init.js`

After the install step (copy files, merge settings, update gitignore):
- Call `setup.runSetup()` to run the interactive wizard
- The existing "Run `claude-raid doctor`" message is replaced by the inline setup output

### `bin/cli.js`

No changes needed — `doctor` and `init` commands already dispatch to their respective `run()` functions.

## Output format

### init (after install section)

```
claude-raid — Installing The Raid

Detected: typescript
Test command: npm test

─── Setup ───────────────────────────────────

  ✔ Node.js         v22.0.0
  ✔ Claude Code     v2.3.1
  ✖ teammateMode    not set in ~/.claude.json

  Which teammate display mode do you want?

    1. tmux        — split panes, see all agents at once (requires tmux/iTerm2)
    2. in-process  — all in one terminal, cycle with Shift+Down
    3. auto        — split panes if available, otherwise in-process

  > 2

  Write teammateMode: "in-process" to ~/.claude.json? [Y/n] y
  ✔ Updated ~/.claude.json

  ✔ Split-pane      not needed (in-process mode)

─── Ready ───────────────────────────────────

  Start a Raid:  claude --agent wizard

```

### doctor (standalone)

Same check + prompt flow, plus the existing Quick Start, Navigating Teammates, and Raid Modes sections appended after.

### Non-interactive (piped/CI)

```
claude-raid doctor — Environment Check

─── Prerequisites ───────────────────────────

  ✔ Node.js         v22.0.0
  ✔ Claude Code     v2.3.1
  ✖ teammateMode    not set in ~/.claude.json
    → Add "teammateMode": "tmux" (or "in-process" or "auto") to ~/.claude.json
  ✖ Split-pane      tmux not found, it2 not found
    → brew install tmux (or use in-process mode)
```

## Test plan

### `tests/cli/setup.test.js` (new)

- `runChecks` returns correct results for each check (mock exec, homedir)
- `runChecks` accepts `"tmux"`, `"in-process"`, `"auto"` as valid teammateMode values
- `runChecks` detects `it2` CLI as valid split-pane support
- `runSetup` in non-interactive mode skips prompts
- `runSetup` with mocked stdin simulates user selecting each mode option
- `runSetup` writes teammateMode to `~/.claude.json` on confirmation
- `runSetup` preserves existing `~/.claude.json` content when merging
- `runSetup` handles missing `~/.claude.json` (creates new)
- `runSetup` handles invalid JSON in `~/.claude.json` (reports error, doesn't crash)
- Split-pane check skipped when user selects in-process
- Split-pane check passes with tmux only, it2 only, or both

### `tests/cli/doctor.test.js` (update)

- Update existing tests to work with new setup.js imports
- Doctor `run()` still produces expected output format

### `tests/cli/init.test.js` (update)

- Init calls setup after install (verify setup output appears)
- Init works in non-interactive mode (piped stdin)

## README changes

Replace the current "Requirements" section with a "Getting Started" section:

```markdown
## Getting Started

### 1. Install

\`\`\`bash
npx claude-raid init
\`\`\`

The installer auto-detects your project, copies agents/skills/hooks, and walks
you through environment setup.

### 2. Prerequisites

The setup wizard checks these automatically:

| Requirement | Why | Auto-configured? |
|---|---|---|
| **Claude Code** v2.1.32+ | Agent teams support | No — install/update manually |
| **Node.js** 18+ | Runs the installer | No — install manually |
| **teammateMode** in `~/.claude.json` | Display mode for agent sessions | Yes — wizard prompts you |
| **tmux** or **iTerm2** | Split-pane mode (optional) | No — install manually |

`jq` is required for hooks (pre-installed on macOS, `apt install jq` on Linux).

The experimental agent teams flag (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`)
is set automatically in your project's `.claude/settings.json` during install.

### 3. Run

\`\`\`bash
claude --agent wizard
\`\`\`

Re-check your environment anytime:

\`\`\`bash
npx claude-raid doctor
\`\`\`
```
