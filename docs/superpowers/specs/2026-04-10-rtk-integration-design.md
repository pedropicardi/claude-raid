# RTK Integration Design — Opt-In Token Compression

**Date:** 2026-04-10
**Status:** Approved

## Overview

Integrate RTK (Rust Token Killer) as an optional, opt-in token compression layer for claude-raid. RTK is a CLI proxy that compresses Bash command output before it reaches the AI agent context window, achieving 60-90% savings on common operations (git, ls, grep, test runners).

RTK is never required. When enabled, Raid controls when and whether RTK runs through a bridge script that respects phase-aware and command-aware bypass rules configured in `raid.json`.

## Config Shape — `raid.json`

When RTK is enabled during `summon`, a new top-level `rtk` key is added:

```json
{
  "rtk": {
    "enabled": true,
    "bypass": {
      "phases": [],
      "commands": []
    }
  }
}
```

- `enabled`: `true` when user opts in (via `--rtk` flag or interactive prompt). `false` or absent when not.
- `bypass.phases`: array of phase names (e.g. `["implementation", "review"]`) where RTK is disabled. Empty = RTK active in all phases.
- `bypass.commands`: array of command prefixes (e.g. `["cargo test", "pytest -v"]`) that skip RTK. Empty = RTK compresses everything.

When RTK is not opted in, the `rtk` key is omitted entirely from `raid.json`.

Default: RTK on for everything. Users opt out of specific phases or commands, not opt in.

## Bridge Script — `rtk-bridge.sh`

New file at `template/.claude/hooks/rtk-bridge.sh`. Sources `raid-lib.sh` for session state, reads `raid.json` for RTK config. Target: ~30 lines.

### Logic Flow

1. Check if `rtk` command exists on PATH — if not, exit cleanly (no rewrite, no error)
2. Read `rtk.enabled` from `raid.json` — if false/missing, exit cleanly
3. If Raid session is active, check `RAID_PHASE` against `bypass.phases` — if current phase is bypassed, exit cleanly
4. Extract the command being executed from the hook input (stdin JSON), check against `bypass.commands` — if prefix matches, exit cleanly
5. All checks pass: delegate to `rtk hook claude` (pass through stdin, return its stdout as the `updatedInput` response)

### Key Behaviors

- **Fail-open**: if `rtk` binary is missing, `raid.json` is unreadable, or anything unexpected happens, the hook exits cleanly — original command runs uncompressed. Never blocks execution.
- **No-session behavior**: if there's no active Raid session but `rtk.enabled` is true in `raid.json`, RTK still runs. Bypass rules just don't apply (no phase to check against).
- **Performance**: one `jq` call to read RTK config from `raid.json` (piggybacks on `raid-lib.sh`'s existing config parse). Target: <15ms overhead.

## Hook Registration — `merge-settings.js`

New constant alongside existing `RAID_HOOKS`:

```js
const RTK_HOOK_MARKER = '#claude-raid-rtk';

const RTK_HOOKS = {
  PreToolUse: [
    {
      matcher: 'Bash',
      hooks: [
        { type: 'command', command: `bash .claude/hooks/rtk-bridge.sh ${RTK_HOOK_MARKER}` },
      ],
    },
  ],
};
```

### Merge Behavior

The `mergeSettings` function gets a new step after writing core Raid hooks:

1. Read `raid.json` to check if `rtk.enabled` is true
2. If enabled: append `RTK_HOOKS` entries to `settings.json`, after all core Raid hooks (ensuring last position)
3. If not enabled: strip any existing `#claude-raid-rtk` entries (clean removal on toggle-off)

The `removeRaidSettings` function also strips `#claude-raid-rtk` entries during `dismantle`.

A new helper `isRtkHookEntry(entry)` mirrors `isRaidHookEntry` but checks for the RTK marker.

### Ordering Guarantee

Core Raid PreToolUse hooks (`validate-commit.sh`, `validate-browser-tests-exist.sh`) are written first, then RTK's bridge hook is appended. Validation sees the original command, RTK rewrites last.

## CLI Integration

### `summon` (`init.js`)

- New `--rtk` flag: forces RTK integration on, skips the interactive prompt
- Interactive flow (in `setup.js`): after the teammateMode setup, if `rtk` is detected on PATH and `--rtk` wasn't passed, prompt: "RTK detected — enable token compression? [Y/n]"
- If enabled: write the `rtk` section to `raid.json`, `mergeSettings` picks it up and writes the hook
- If not detected and no `--rtk` flag: no prompt, no `rtk` key in `raid.json`
- Dry run (`--dry-run`): shows RTK hook in the output if `rtk` is detected

### `update` (`update.js`)

- Re-reads `raid.json` on every update — if `rtk.enabled` was toggled since last summon, `mergeSettings` adds or removes the RTK hook accordingly
- Migration hint: if user installs RTK after initial summon and runs `claude-raid update`, print a recommendation message if `rtk` key is absent from `raid.json` and `rtk` is detected on PATH: "RTK detected — add `\"rtk\": { \"enabled\": true }` to raid.json or re-run summon with --rtk". No interactive prompt — `update` stays non-interactive.
- `rtk-bridge.sh` gets overwritten on update like all hook files (framework code, not user content)

### `dismantle` (`remove.js`)

- `removeRaidSettings` strips both `#claude-raid` and `#claude-raid-rtk` hooks
- `rtk-bridge.sh` gets deleted along with all other hook files
- `raid.json` gets deleted entirely (existing behavior), so RTK config goes with it

## Health Check — `doctor.js` / `setup.js`

### New `checkRtk(exec)` Function

- Runs `command -v rtk` to detect presence
- If found, runs `rtk --version` to get version string
- Returns an optional check (not in `REQUIRED_IDS`, never blocks `allOk`)

Check result states:
- Installed: `"✔ RTK  v0.15.2 — token compression available"`
- Not installed: `"○ RTK  not installed (optional — reduces context usage by 60-90%)"`
  - Hint: `"Install: curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh"`

Placement: after the playwright check — required checks first, optional enhancements last.

### Reference Card

When RTK is detected but not enabled:
> "Tip: RTK detected — run claude-raid update to enable token compression"

When enabled:
> "RTK: enabled — compressing Bash output (bypass in raid.json)"

## Descriptions — `descriptions.js`

New `HOOKS.optional` array:

```js
optional: [
  { name: 'rtk-bridge.sh', desc: 'Token compression via RTK (optional, opt-in)' },
]
```

Shown in `summon` and `dry-run` output under a separate "Hooks — Optional" section, only when RTK is enabled. Dry run shows `(will install)` or `(skipped — RTK not detected)`.

## Test Coverage

### `tests/hooks/rtk-bridge.test.js` (new)

- RTK not on PATH: exits cleanly, no rewrite
- RTK disabled in `raid.json`: exits cleanly
- RTK enabled, no bypass: delegates to `rtk hook claude`
- Phase bypass: current phase in bypass list, exits cleanly
- Phase bypass: current phase NOT in bypass list, delegates
- Command bypass: matching prefix, exits cleanly
- Command bypass: non-matching command, delegates
- No active Raid session + RTK enabled: still delegates
- Malformed `raid.json`: fail-open, exits cleanly

### `tests/cli/merge-settings.test.js` (extend)

- RTK enabled: `#claude-raid-rtk` hook appended after core hooks
- RTK disabled: no RTK hook in output
- RTK toggled off: existing `#claude-raid-rtk` entries stripped
- RTK hook ordering: appears after all `#claude-raid` PreToolUse entries
- `removeRaidSettings` strips both markers

### `tests/cli/init.test.js` (extend)

- `--rtk` flag: `raid.json` gets `rtk` section, hook is registered
- No RTK on system, no flag: no `rtk` key in `raid.json`
- Dry run with RTK detected: shows RTK hook in output

### `tests/cli/setup.test.js` (extend)

- `checkRtk` returns ok when installed
- `checkRtk` returns not-ok with install hint when missing
- Not in `REQUIRED_IDS` — missing RTK doesn't fail `allOk`

### `tests/cli/update.test.js` (extend)

- RTK toggled on in `raid.json` between summon and update: hook added
- RTK toggled off in `raid.json`: hook removed
- `rtk-bridge.sh` overwritten on update
- RTK detected but not configured: prints recommendation message

## Files Changed

| File | Change |
|------|--------|
| `template/.claude/hooks/rtk-bridge.sh` | **New** — bridge script |
| `src/merge-settings.js` | Add `RTK_HOOK_MARKER`, `RTK_HOOKS`, `isRtkHookEntry`, RTK-aware merge/remove logic |
| `src/init.js` | Accept `--rtk` flag, write `rtk` section to `raid.json` |
| `src/setup.js` | Add `checkRtk`, interactive RTK prompt after teammateMode |
| `src/update.js` | Migration prompt for RTK when detected but not configured |
| `src/descriptions.js` | Add `HOOKS.optional` with `rtk-bridge.sh` |
| `src/ui.js` | RTK line in reference card |
| `src/doctor.js` | No changes needed (delegates to `setup.js`) |
| `bin/cli.js` | Parse `--rtk` flag for summon command |
| `tests/hooks/rtk-bridge.test.js` | **New** — bridge script tests |
| `tests/cli/merge-settings.test.js` | Extend — RTK hook merge/remove/ordering |
| `tests/cli/init.test.js` | Extend — `--rtk` flag, `raid.json` RTK section |
| `tests/cli/setup.test.js` | Extend — `checkRtk` |
| `tests/cli/update.test.js` | Extend — RTK toggle migration |
