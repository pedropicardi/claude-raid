# RTK Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in RTK token compression to claude-raid, controlled via `raid.json` config and a bridge hook script.

**Architecture:** RTK integration flows through three layers: (1) `raid.json` stores the `rtk` config, (2) `merge-settings.js` writes/removes an RTK PreToolUse hook with an independent `#claude-raid-rtk` marker, (3) `rtk-bridge.sh` checks config + bypass rules before delegating to `rtk hook claude`. CLI commands (`summon`, `update`, `dismantle`, `heal`) each get RTK-aware behavior.

**Tech Stack:** Node.js (CommonJS), Bash, jq, node:test + node:assert

**Spec:** `docs/superpowers/specs/2026-04-10-rtk-integration-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `template/.claude/hooks/rtk-bridge.sh` | Create | Bridge script — checks RTK config, bypass rules, delegates to `rtk hook claude` |
| `template/.claude/hooks/raid-lib.sh` | Modify | Add `RAID_RTK_*` exports from `raid.json` RTK config |
| `src/merge-settings.js` | Modify | Add `RTK_HOOK_MARKER`, `RTK_HOOKS`, `isRtkHookEntry`, RTK-aware merge/remove |
| `src/init.js` | Modify | Accept `--rtk` flag, write `rtk` section to `raid.json` |
| `src/setup.js` | Modify | Add `checkRtk`, interactive RTK prompt |
| `src/update.js` | Modify | RTK migration hint when detected but not configured |
| `src/descriptions.js` | Modify | Add `HOOKS.optional` with `rtk-bridge.sh` |
| `src/ui.js` | Modify | RTK line in reference card |
| `bin/cli.js` | Modify | Pass `--rtk` flag through to `init.run()` |
| `tests/hooks/rtk-bridge.test.js` | Create | Bridge script tests |
| `tests/cli/merge-settings.test.js` | Modify | RTK hook merge/remove/ordering tests |
| `tests/cli/init.test.js` | Modify | `--rtk` flag and `raid.json` RTK section tests |
| `tests/cli/setup.test.js` | Modify | `checkRtk` tests |
| `tests/cli/update.test.js` | Modify | RTK migration hint tests |

---

### Task 1: Add RTK config parsing to `raid-lib.sh`

**Files:**
- Modify: `template/.claude/hooks/raid-lib.sh:66-145`

- [ ] **Step 1: Add RTK default variables after the existing browser defaults (line ~76)**

Add these lines after `RAID_BROWSER_PW_CONFIG=""` (line 75) and before `RAID_VAULT_ENABLED=true` (line 76):

```bash
RAID_RTK_ENABLED=false
RAID_RTK_BYPASS_PHASES=""
RAID_RTK_BYPASS_COMMANDS=""
```

- [ ] **Step 2: Add RTK fields to the jq config extraction (inside the existing jq call at line ~88)**

Add these three fields to the jq object, after the `lifecycleTestWindow` line (line 109):

```bash
    rtkEnabled: (.rtk.enabled // false),
    rtkBypassPhases: (.rtk.bypass.phases // []),
    rtkBypassCommands: (.rtk.bypass.commands // [])
```

- [ ] **Step 3: Add RTK variable extraction after the existing config extractions (after line ~133)**

Add after the `RAID_LIFECYCLE_TEST_WINDOW` extraction:

```bash
    RAID_RTK_ENABLED=$(echo "$_config_json" | jq -r '.rtkEnabled')
    RAID_RTK_BYPASS_PHASES=$(echo "$_config_json" | jq -c '.rtkBypassPhases')
    RAID_RTK_BYPASS_COMMANDS=$(echo "$_config_json" | jq -c '.rtkBypassCommands')
```

- [ ] **Step 4: Add RTK exports to the export block (after line ~145)**

Add to the export line block:

```bash
export RAID_RTK_ENABLED RAID_RTK_BYPASS_PHASES RAID_RTK_BYPASS_COMMANDS
```

- [ ] **Step 5: Run existing tests to verify no regression**

Run: `node --test tests/hooks/`
Expected: All existing hook tests pass.

- [ ] **Step 6: Commit**

```bash
git add template/.claude/hooks/raid-lib.sh
git commit -m "feat(hooks): add RTK config parsing to raid-lib.sh"
```

---

### Task 2: Create `rtk-bridge.sh`

**Files:**
- Create: `template/.claude/hooks/rtk-bridge.sh`

- [ ] **Step 1: Write the bridge script**

```bash
#!/usr/bin/env bash
# rtk-bridge.sh — Token compression bridge to RTK.
# Delegates to `rtk hook claude` unless bypassed by config or phase.
# Fail-open: if anything goes wrong, exit 0 (original command runs uncompressed).

set -euo pipefail

# Source raid-lib for session state + config
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

# 1. Check if rtk binary exists
if ! command -v rtk >/dev/null 2>&1; then
  exit 0
fi

# 2. Check if RTK is enabled in raid.json
if [ "$RAID_RTK_ENABLED" != "true" ]; then
  exit 0
fi

# 3. Read stdin (hook input JSON) — we need it for bypass checks and to pass to rtk
INPUT=$(cat)

# 4. Phase bypass — if active session and current phase is in bypass list
if [ "$RAID_ACTIVE" = "true" ] && [ -n "$RAID_PHASE" ] && [ "$RAID_RTK_BYPASS_PHASES" != "[]" ]; then
  if echo "$RAID_RTK_BYPASS_PHASES" | jq -e --arg p "$RAID_PHASE" 'index($p) != null' >/dev/null 2>&1; then
    exit 0
  fi
fi

# 5. Command bypass — check if command prefix matches any bypass entry
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
if [ -n "$COMMAND" ] && [ "$RAID_RTK_BYPASS_COMMANDS" != "[]" ]; then
  while IFS= read -r prefix; do
    if [ -n "$prefix" ] && [[ "$COMMAND" == "$prefix"* ]]; then
      exit 0
    fi
  done < <(echo "$RAID_RTK_BYPASS_COMMANDS" | jq -r '.[]' 2>/dev/null)
fi

# 6. All checks passed — delegate to rtk
echo "$INPUT" | rtk hook claude 2>/dev/null || exit 0
```

- [ ] **Step 2: Verify the script is syntactically valid**

Run: `bash -n template/.claude/hooks/rtk-bridge.sh`
Expected: No output (no syntax errors).

- [ ] **Step 3: Commit**

```bash
git add template/.claude/hooks/rtk-bridge.sh
git commit -m "feat(hooks): add rtk-bridge.sh for token compression"
```

---

### Task 3: Write `rtk-bridge.sh` tests

**Files:**
- Create: `tests/hooks/rtk-bridge.test.js`

- [ ] **Step 1: Write the test file**

```js
'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const BRIDGE_SCRIPT = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks', 'rtk-bridge.sh');

let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-rtk-bridge-'));
  return tmpDir;
}

function setupRaidFiles(cwd, opts = {}) {
  const claudeDir = path.join(cwd, '.claude');
  fs.mkdirSync(path.join(claudeDir, 'hooks'), { recursive: true });

  // Copy raid-lib.sh
  const libSrc = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks', 'raid-lib.sh');
  fs.copyFileSync(libSrc, path.join(claudeDir, 'hooks', 'raid-lib.sh'));

  // Copy rtk-bridge.sh
  fs.copyFileSync(BRIDGE_SCRIPT, path.join(claudeDir, 'hooks', 'rtk-bridge.sh'));
  fs.chmodSync(path.join(claudeDir, 'hooks', 'rtk-bridge.sh'), 0o755);

  // Write raid.json
  const raidConfig = opts.raidJson || {};
  fs.writeFileSync(path.join(claudeDir, 'raid.json'), JSON.stringify(raidConfig, null, 2));

  // Write raid-session if provided
  if (opts.session) {
    fs.writeFileSync(path.join(claudeDir, 'raid-session'), JSON.stringify(opts.session));
  }
}

function runBridge(cwd, input, opts = {}) {
  const env = {
    ...process.env,
    PATH: (opts.rtkOnPath === false)
      ? process.env.PATH.split(':').filter(p => !p.includes('rtk')).join(':')
      : process.env.PATH,
  };

  // If we need to simulate rtk not being on PATH, prepend a dir with no rtk
  if (opts.rtkOnPath === false) {
    // Create a fake PATH with only basic tools
    const fakeBin = path.join(cwd, 'fake-bin');
    fs.mkdirSync(fakeBin, { recursive: true });
    env.PATH = `/usr/bin:/bin:${fakeBin}`;
  }

  // If we need to simulate rtk being available, create a stub
  if (opts.rtkOnPath !== false) {
    const fakeBin = path.join(cwd, 'fake-bin');
    fs.mkdirSync(fakeBin, { recursive: true });
    const rtkStub = path.join(fakeBin, 'rtk');
    const rtkOutput = opts.rtkOutput || '{"updatedInput": {"command": "rtk git status"}}';
    fs.writeFileSync(rtkStub, `#!/bin/bash\ncat\n`);
    fs.chmodSync(rtkStub, 0o755);
    env.PATH = `${fakeBin}:${env.PATH}`;
  }

  const inputJson = JSON.stringify(input || { tool_input: { command: 'git status' } });

  try {
    const result = execSync(
      `cd "${cwd}" && echo '${inputJson.replace(/'/g, "'\\''")}' | bash .claude/hooks/rtk-bridge.sh`,
      { encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 }
    );
    return { exitCode: 0, stdout: result.trim() };
  } catch (err) {
    return { exitCode: err.status, stdout: (err.stdout || '').trim(), stderr: (err.stderr || '').trim() };
  }
}

describe('rtk-bridge.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it('exits cleanly when rtk is not on PATH', () => {
    const cwd = makeTempDir();
    setupRaidFiles(cwd, { raidJson: { rtk: { enabled: true } } });
    const result = runBridge(cwd, null, { rtkOnPath: false });
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout, '');
  });

  it('exits cleanly when rtk.enabled is false', () => {
    const cwd = makeTempDir();
    setupRaidFiles(cwd, { raidJson: { rtk: { enabled: false } } });
    const result = runBridge(cwd, null);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout, '');
  });

  it('exits cleanly when rtk key is missing from raid.json', () => {
    const cwd = makeTempDir();
    setupRaidFiles(cwd, { raidJson: { project: { name: 'test' } } });
    const result = runBridge(cwd, null);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout, '');
  });

  it('delegates to rtk when enabled with no bypass', () => {
    const cwd = makeTempDir();
    setupRaidFiles(cwd, { raidJson: { rtk: { enabled: true, bypass: { phases: [], commands: [] } } } });
    const result = runBridge(cwd, { tool_input: { command: 'git status' } });
    assert.strictEqual(result.exitCode, 0);
    // The stub rtk just cats stdin back, so we should see the input JSON
    assert.ok(result.stdout.includes('git status'));
  });

  it('bypasses when current phase is in bypass list', () => {
    const cwd = makeTempDir();
    setupRaidFiles(cwd, {
      raidJson: { rtk: { enabled: true, bypass: { phases: ['implementation', 'review'], commands: [] } } },
      session: { phase: 'implementation', mode: 'full', questType: 'canonical', questId: 'test-quest', questDir: '.claude/dungeon/test-quest' },
    });
    const result = runBridge(cwd, { tool_input: { command: 'git status' } });
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout, '');
  });

  it('does not bypass when current phase is NOT in bypass list', () => {
    const cwd = makeTempDir();
    setupRaidFiles(cwd, {
      raidJson: { rtk: { enabled: true, bypass: { phases: ['review'], commands: [] } } },
      session: { phase: 'design', mode: 'full', questType: 'canonical', questId: 'test-quest', questDir: '.claude/dungeon/test-quest' },
    });
    const result = runBridge(cwd, { tool_input: { command: 'git status' } });
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes('git status'));
  });

  it('bypasses when command prefix matches bypass list', () => {
    const cwd = makeTempDir();
    setupRaidFiles(cwd, {
      raidJson: { rtk: { enabled: true, bypass: { phases: [], commands: ['cargo test', 'pytest'] } } },
    });
    const result = runBridge(cwd, { tool_input: { command: 'cargo test -- --nocapture' } });
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout, '');
  });

  it('does not bypass when command does not match bypass list', () => {
    const cwd = makeTempDir();
    setupRaidFiles(cwd, {
      raidJson: { rtk: { enabled: true, bypass: { phases: [], commands: ['cargo test'] } } },
    });
    const result = runBridge(cwd, { tool_input: { command: 'git status' } });
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes('git status'));
  });

  it('still delegates when no active session but RTK enabled', () => {
    const cwd = makeTempDir();
    setupRaidFiles(cwd, {
      raidJson: { rtk: { enabled: true, bypass: { phases: ['implementation'], commands: [] } } },
      // No session file — bypass.phases should be ignored
    });
    const result = runBridge(cwd, { tool_input: { command: 'git status' } });
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes('git status'));
  });

  it('exits cleanly on malformed raid.json (fail-open)', () => {
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(path.join(claudeDir, 'hooks'), { recursive: true });
    const libSrc = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks', 'raid-lib.sh');
    fs.copyFileSync(libSrc, path.join(claudeDir, 'hooks', 'raid-lib.sh'));
    fs.copyFileSync(BRIDGE_SCRIPT, path.join(claudeDir, 'hooks', 'rtk-bridge.sh'));
    fs.chmodSync(path.join(claudeDir, 'hooks', 'rtk-bridge.sh'), 0o755);
    fs.writeFileSync(path.join(claudeDir, 'raid.json'), '{corrupt json!!!}');
    const result = runBridge(cwd, null);
    assert.strictEqual(result.exitCode, 0);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `node --test tests/hooks/rtk-bridge.test.js`
Expected: All 9 tests pass. (Some may need adjustments based on `jq` availability in test env.)

- [ ] **Step 3: Commit**

```bash
git add tests/hooks/rtk-bridge.test.js
git commit -m "test(hooks): add rtk-bridge.sh tests"
```

---

### Task 4: Add RTK hook to `merge-settings.js`

**Files:**
- Modify: `src/merge-settings.js:1-154`

- [ ] **Step 1: Write failing test — RTK hook appended when enabled**

Add to `tests/cli/merge-settings.test.js`:

```js
  it('appends RTK hook when rtk.enabled is true in raid.json', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'raid.json'), JSON.stringify({
      rtk: { enabled: true, bypass: { phases: [], commands: [] } },
    }));
    mergeSettings(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
    const rtkHook = settings.hooks.PreToolUse.find(e =>
      e.hooks && e.hooks.some(h => h.command && h.command.includes('#claude-raid-rtk'))
    );
    assert.ok(rtkHook, 'RTK hook should be present in PreToolUse');
    assert.ok(rtkHook.hooks[0].command.includes('rtk-bridge.sh'));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern="appends RTK hook" tests/cli/merge-settings.test.js`
Expected: FAIL — no RTK hook logic yet.

- [ ] **Step 3: Write failing test — no RTK hook when disabled**

Add to `tests/cli/merge-settings.test.js`:

```js
  it('does not add RTK hook when rtk.enabled is false', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'raid.json'), JSON.stringify({
      rtk: { enabled: false },
    }));
    mergeSettings(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
    const rtkHook = (settings.hooks.PreToolUse || []).find(e =>
      e.hooks && e.hooks.some(h => h.command && h.command.includes('#claude-raid-rtk'))
    );
    assert.strictEqual(rtkHook, undefined, 'RTK hook should not be present');
  });
```

- [ ] **Step 4: Write failing test — RTK hook ordering (after core hooks)**

Add to `tests/cli/merge-settings.test.js`:

```js
  it('places RTK hook after core Raid PreToolUse hooks', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'raid.json'), JSON.stringify({
      rtk: { enabled: true, bypass: { phases: [], commands: [] } },
    }));
    mergeSettings(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
    const preToolUse = settings.hooks.PreToolUse;
    const rtkIndex = preToolUse.findIndex(e =>
      e.hooks && e.hooks.some(h => h.command && h.command.includes('#claude-raid-rtk'))
    );
    const lastCoreIndex = preToolUse.reduce((max, e, i) => {
      if (e.hooks && e.hooks.some(h => h.command && h.command.includes('#claude-raid') && !h.command.includes('#claude-raid-rtk'))) {
        return i;
      }
      return max;
    }, -1);
    assert.ok(rtkIndex > lastCoreIndex, `RTK hook (index ${rtkIndex}) must come after last core hook (index ${lastCoreIndex})`);
  });
```

- [ ] **Step 5: Write failing test — RTK hook stripped on toggle-off**

Add to `tests/cli/merge-settings.test.js`:

```js
  it('strips RTK hook when rtk.enabled is toggled off', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    // First merge with RTK enabled
    fs.writeFileSync(path.join(claudeDir, 'raid.json'), JSON.stringify({
      rtk: { enabled: true, bypass: { phases: [], commands: [] } },
    }));
    mergeSettings(cwd);
    // Toggle off
    fs.writeFileSync(path.join(claudeDir, 'raid.json'), JSON.stringify({
      rtk: { enabled: false },
    }));
    mergeSettings(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
    const rtkHook = (settings.hooks.PreToolUse || []).find(e =>
      e.hooks && e.hooks.some(h => h.command && h.command.includes('#claude-raid-rtk'))
    );
    assert.strictEqual(rtkHook, undefined, 'RTK hook should be removed after toggle-off');
  });
```

- [ ] **Step 6: Write failing test — removeRaidSettings strips RTK hooks**

Add to `tests/cli/merge-settings.test.js`:

```js
  it('removeRaidSettings strips both raid and rtk hooks', () => {
    const { removeRaidSettings } = require('../../src/merge-settings');
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'raid.json'), JSON.stringify({
      rtk: { enabled: true, bypass: { phases: [], commands: [] } },
    }));
    mergeSettings(cwd);
    // Delete backup to force surgical removal
    const backupPath = path.join(claudeDir, 'settings.json.pre-raid-backup');
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    removeRaidSettings(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
    const json = JSON.stringify(settings);
    assert.ok(!json.includes('#claude-raid-rtk'), 'RTK hooks should be removed');
    assert.ok(!json.includes('#claude-raid'), 'Core raid hooks should be removed');
  });
```

- [ ] **Step 7: Run all new tests to confirm they fail**

Run: `node --test --test-name-pattern="RTK|rtk" tests/cli/merge-settings.test.js`
Expected: All 5 new tests FAIL.

- [ ] **Step 8: Implement RTK hook support in `merge-settings.js`**

Add after `RAID_HOOK_MARKER` (line 12):

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

Add after `isRaidHookEntry` (line 78):

```js
function isRtkHookEntry(entry) {
  return entry.hooks && entry.hooks.some(h => h.command && h.command.includes(RTK_HOOK_MARKER));
}
```

In `mergeSettings`, after the core hooks loop (after line 113), add:

```js
  // RTK hooks — read raid.json to check if enabled
  const raidJsonPath = path.join(cwd, '.claude', 'raid.json');
  let rtkEnabled = false;
  try {
    const raidConfig = JSON.parse(fs.readFileSync(raidJsonPath, 'utf8'));
    rtkEnabled = raidConfig.rtk && raidConfig.rtk.enabled === true;
  } catch {
    // No raid.json or invalid — RTK stays disabled
  }

  // Strip existing RTK hooks first (clean slate for toggle behavior)
  for (const event of Object.keys(existing.hooks)) {
    existing.hooks[event] = existing.hooks[event].filter(entry => !isRtkHookEntry(entry));
  }

  // Append RTK hooks if enabled (after core hooks, ensuring last position)
  if (rtkEnabled) {
    for (const [event, rtkEntries] of Object.entries(RTK_HOOKS)) {
      if (!Array.isArray(existing.hooks[event])) {
        existing.hooks[event] = [];
      }
      existing.hooks[event].push(...rtkEntries);
    }
  }
```

In `removeRaidSettings`, in the surgical removal path (line 143), change the filter to also strip RTK hooks:

```js
      settings.hooks[event] = settings.hooks[event].filter(entry => !isRaidHookEntry(entry) && !isRtkHookEntry(entry));
```

- [ ] **Step 9: Run all merge-settings tests**

Run: `node --test tests/cli/merge-settings.test.js`
Expected: All tests pass (existing + 5 new RTK tests).

- [ ] **Step 10: Commit**

```bash
git add src/merge-settings.js tests/cli/merge-settings.test.js
git commit -m "feat(merge-settings): add RTK hook with independent marker"
```

---

### Task 5: Add `checkRtk` to `setup.js`

**Files:**
- Modify: `src/setup.js:39-403`
- Modify: `tests/cli/setup.test.js`

- [ ] **Step 1: Write failing test — checkRtk passes when installed**

Add to `tests/cli/setup.test.js`:

```js
  it('rtk check passes when rtk is installed', () => {
    const home = makeTempDir();
    const result = runChecks({
      homedir: home,
      exec: (cmd) => {
        if (cmd === 'command -v rtk') return '/usr/local/bin/rtk';
        if (cmd === 'rtk --version') return '0.15.2';
        return null;
      },
    });
    const rtk = result.checks.find(c => c.id === 'rtk');
    assert.ok(rtk, 'rtk check should exist');
    assert.ok(rtk.ok);
    assert.ok(rtk.detail.includes('0.15.2'));
  });
```

- [ ] **Step 2: Write failing test — checkRtk reports not installed**

Add to `tests/cli/setup.test.js`:

```js
  it('rtk check reports not installed when missing', () => {
    const home = makeTempDir();
    const result = runChecks({
      homedir: home,
      exec: (cmd) => {
        if (cmd === 'command -v rtk') return null;
        return null;
      },
    });
    const rtk = result.checks.find(c => c.id === 'rtk');
    assert.ok(rtk, 'rtk check should exist');
    assert.strictEqual(rtk.ok, false);
    assert.ok(rtk.detail.includes('not installed'));
    assert.ok(rtk.hint);
  });
```

- [ ] **Step 3: Write failing test — RTK not in REQUIRED_IDS**

Add to `tests/cli/setup.test.js`:

```js
  it('missing rtk does not fail allOk', () => {
    const home = makeTempDir();
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ teammateMode: 'tmux' }));
    const result = runChecks({
      homedir: home,
      exec: (cmd) => {
        if (cmd === 'claude --version') return '2.1.32';
        if (cmd === 'command -v jq') return '/usr/bin/jq';
        if (cmd === 'command -v tmux') return '/usr/bin/tmux';
        if (cmd === 'command -v rtk') return null;
        return null;
      },
      nodeVersion: 'v20.11.0',
    });
    assert.ok(result.allOk, 'allOk should be true even with rtk missing');
  });
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `node --test --test-name-pattern="rtk" tests/cli/setup.test.js`
Expected: All 3 FAIL.

- [ ] **Step 5: Implement `checkRtk` in `setup.js`**

Add after `checkJq` function (after line 217):

```js
function checkRtk(exec) {
  const found = exec('command -v rtk');
  if (!found) {
    return {
      id: 'rtk',
      ok: false,
      label: 'RTK',
      detail: 'not installed (optional — reduces context usage by 60-90%)',
      hint: 'Install: curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh',
    };
  }
  const raw = exec('rtk --version');
  const ver = parseVersion(raw);
  const tag = ver ? `v${ver.major}.${ver.minor}.${ver.patch}` : (raw || 'unknown').trim();
  return {
    id: 'rtk',
    ok: true,
    label: 'RTK',
    detail: `${tag} — token compression available`,
  };
}
```

Add `checkRtk(exec)` to the `checks` array in `runChecks` (line 316), after `checkPlaywright`:

```js
    checkRtk(exec),
```

`REQUIRED_IDS` stays `['node', 'claude', 'jq']` — no change needed.

- [ ] **Step 6: Run all setup tests**

Run: `node --test tests/cli/setup.test.js`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/setup.js tests/cli/setup.test.js
git commit -m "feat(setup): add checkRtk health check"
```

---

### Task 6: Add `--rtk` flag and interactive prompt to `summon`

**Files:**
- Modify: `bin/cli.js:70-76`
- Modify: `src/init.js:35-162`
- Modify: `src/setup.js` (interactive prompt)
- Modify: `tests/cli/init.test.js`

- [ ] **Step 1: Write failing test — `--rtk` flag writes rtk section to raid.json**

Add to `tests/cli/init.test.js`:

```js
  it('writes rtk section to raid.json when rtkEnabled option is true', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    init.install(cwd, { rtkEnabled: true });
    const config = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8'));
    assert.ok(config.rtk, 'raid.json should have rtk section');
    assert.strictEqual(config.rtk.enabled, true);
    assert.deepStrictEqual(config.rtk.bypass.phases, []);
    assert.deepStrictEqual(config.rtk.bypass.commands, []);
  });
```

- [ ] **Step 2: Write failing test — no rtk section without flag**

Add to `tests/cli/init.test.js`:

```js
  it('does not write rtk section to raid.json without rtkEnabled option', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    init.install(cwd);
    const config = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8'));
    assert.strictEqual(config.rtk, undefined, 'raid.json should not have rtk section');
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test --test-name-pattern="rtk" tests/cli/init.test.js`
Expected: Both FAIL.

- [ ] **Step 4: Modify `install()` in `init.js` to accept options**

Change the `install` function signature from `function install(cwd)` to `function install(cwd, opts = {})`.

After the browser config block (after line 133) and before `fs.writeFileSync(raidConfigPath, ...)` (line 134), add:

```js
    if (opts.rtkEnabled) {
      raidConfig.rtk = {
        enabled: true,
        bypass: {
          phases: [],
          commands: [],
        },
      };
    }
```

- [ ] **Step 5: Wire `--rtk` flag in `bin/cli.js`**

In the `summon` command handler (line 70), modify the non-dry-run branch:

```js
  summon: () => {
    if (process.argv.includes('--dry-run')) {
      console.log('\n' + banner());
      console.log(require('../src/init').dryRun(process.cwd()));
      return;
    }
    const rtkFlag = process.argv.includes('--rtk');
    return require('../src/init').run({ rtkEnabled: rtkFlag });
  },
```

Do the same for the `init` alias.

Modify `run()` in `init.js` to accept and pass options:

```js
async function run(opts = {}) {
```

Pass `opts` through to `install`:

```js
  const result = install(cwd, opts);
```

- [ ] **Step 6: Add interactive RTK prompt to `setup.js`**

In `runSetup`, after the teammateMode handling block (after the split-pane check, around line 391), add:

```js
  // RTK prompt — only if RTK is on PATH and not already configured via --rtk
  const rtkCheck = checks.find(c => c.id === 'rtk');
  if (rtkCheck && rtkCheck.ok && !opts.rtkEnabled) {
    const rtkConfirm = await ask('\n  RTK detected — enable token compression? [Y/n] ', stdin, stdout);
    if (rtkConfirm.toLowerCase() !== 'n') {
      actions.push('rtk-enabled');
    }
  }
```

Update `runSetup` signature to accept `opts`:

```js
async function runSetup(opts = {}) {
```

In `init.js` `run()`, pass opts through to `runSetup`:

```js
  const setupResult = await runSetup(opts);
```

Then after `runSetup`, check if RTK was enabled interactively and update `raid.json`:

```js
  if (setupResult.actions.includes('rtk-enabled') || opts.rtkEnabled) {
    const raidConfigPath = path.join(cwd, '.claude', 'raid.json');
    if (fs.existsSync(raidConfigPath)) {
      const config = JSON.parse(fs.readFileSync(raidConfigPath, 'utf8'));
      if (!config.rtk) {
        config.rtk = { enabled: true, bypass: { phases: [], commands: [] } };
        fs.writeFileSync(raidConfigPath, JSON.stringify(config, null, 2) + '\n');
        mergeSettings(cwd); // Re-merge to pick up RTK hook
      }
    }
  }
```

- [ ] **Step 7: Run all init and setup tests**

Run: `node --test tests/cli/init.test.js && node --test tests/cli/setup.test.js`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add bin/cli.js src/init.js src/setup.js tests/cli/init.test.js
git commit -m "feat(summon): add --rtk flag and interactive RTK prompt"
```

---

### Task 7: Add RTK migration hint to `update.js`

**Files:**
- Modify: `src/update.js:34-162`
- Modify: `tests/cli/update.test.js`

- [ ] **Step 1: Write failing test — prints recommendation when RTK detected but not configured**

Add to `tests/cli/update.test.js`:

```js
  it('includes rtk recommendation when rtk is detected but not configured', () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    init.install(cwd);
    const result = update.performUpdate(cwd, { rtkDetected: true });
    assert.ok(result.rtkHint, 'should include RTK hint');
  });
```

- [ ] **Step 2: Write failing test — no hint when RTK already configured**

Add to `tests/cli/update.test.js`:

```js
  it('does not include rtk hint when already configured', () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    init.install(cwd, { rtkEnabled: true });
    const result = update.performUpdate(cwd, { rtkDetected: true });
    assert.strictEqual(result.rtkHint, false, 'should not hint when RTK already configured');
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test --test-name-pattern="rtk" tests/cli/update.test.js`
Expected: Both FAIL.

- [ ] **Step 4: Implement RTK hint in `performUpdate`**

Change `performUpdate` signature to accept opts:

```js
function performUpdate(cwd, opts = {}) {
```

After the `mergeSettings(cwd)` call (line 145), add:

```js
  // RTK hint — if RTK is detected but not configured in raid.json
  let rtkHint = false;
  if (opts.rtkDetected) {
    const raidConfigPath = path.join(claudeDir, 'raid.json');
    if (fs.existsSync(raidConfigPath)) {
      try {
        const raidConfig = JSON.parse(fs.readFileSync(raidConfigPath, 'utf8'));
        if (!raidConfig.rtk) {
          rtkHint = true;
        }
      } catch {}
    }
  }
```

Add `rtkHint` to the return object:

```js
  return { success: true, message, skippedAgents, migratedFields, rtkHint };
```

In the `run()` function, detect RTK and pass it through:

```js
function run() {
  const cwd = process.cwd();
  const { execSync } = require('child_process');
  let rtkDetected = false;
  try { execSync('command -v rtk', { stdio: 'pipe' }); rtkDetected = true; } catch {}

  console.log('\n' + banner());
  console.log(header('Reforging the Arsenal...') + '\n');

  const result = performUpdate(cwd, { rtkDetected });
```

After the existing output, add:

```js
  if (result.rtkHint) {
    console.log('  ' + colors.dim('Tip: RTK detected — add "rtk": { "enabled": true } to raid.json'));
    console.log('  ' + colors.dim('or re-run summon with --rtk to enable token compression.'));
  }
```

- [ ] **Step 5: Run all update tests**

Run: `node --test tests/cli/update.test.js`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/update.js tests/cli/update.test.js
git commit -m "feat(update): add RTK migration hint when detected but not configured"
```

---

### Task 8: Update `descriptions.js` and `ui.js`

**Files:**
- Modify: `src/descriptions.js:13-30`
- Modify: `src/ui.js:120-176`

- [ ] **Step 1: Add `HOOKS.optional` to `descriptions.js`**

Add after the `gates` array (after line 29):

```js
  optional: [
    { name: 'rtk-bridge.sh', desc: 'Token compression via RTK (optional, opt-in)' },
  ],
```

- [ ] **Step 2: Add RTK line to reference card in `ui.js`**

In the `referenceCard()` function, add after the "Config" line (line 145) in the `howItWorks` content array:

```js
    '  RTK:     ' + colors.bold('.claude/raid.json → rtk') + '  ' + colors.dim('opt-in token compression'),
```

- [ ] **Step 3: Run existing tests to verify no regression**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/descriptions.js src/ui.js
git commit -m "feat(ui): add RTK to descriptions and reference card"
```

---

### Task 9: Update `init.js` dry-run output for RTK

**Files:**
- Modify: `src/init.js:232-307`

- [ ] **Step 1: Write failing test — dry run shows RTK hook section**

Add to `tests/cli/init.test.js`:

```js
  it('dry run shows RTK optional hooks section', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const output = init.dryRun(cwd);
    assert.ok(output.includes('rtk-bridge.sh'), 'dry run should mention rtk-bridge.sh');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern="dry run shows RTK" tests/cli/init.test.js`
Expected: FAIL.

- [ ] **Step 3: Add optional hooks section to `dryRun`**

In the `dryRun` function, after the Skills section (after line 282) and before the Config section, add:

```js
  // Optional Hooks
  const { HOOKS: hookDescs } = require('./descriptions');
  if (hookDescs.optional && hookDescs.optional.length > 0) {
    lines.push(header('Hooks — Optional') + '\n');
    for (const h of hookDescs.optional) {
      lines.push('  ' + colors.bold(h.name.padEnd(28)) + h.desc + tag('hooks/' + h.name));
    }
    lines.push('');
  }
```

- [ ] **Step 4: Run all init tests**

Run: `node --test tests/cli/init.test.js`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/init.js tests/cli/init.test.js
git commit -m "feat(init): show RTK optional hooks in dry-run output"
```

---

### Task 10: Full integration test

**Files:**
- No new files — run existing e2e + all unit tests

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass (existing ~294 + ~20 new RTK tests).

- [ ] **Step 2: Manual smoke test — summon with --rtk in a temp dir**

```bash
cd $(mktemp -d) && git init && npm init -y && node /path/to/the-raid/bin/cli.js summon --rtk --dry-run
```

Verify RTK hook appears in output.

- [ ] **Step 3: Manual smoke test — summon with --rtk (actual install)**

```bash
cd $(mktemp -d) && git init && npm init -y && node /path/to/the-raid/bin/cli.js summon --rtk
```

Verify:
- `raid.json` has `rtk` section with `enabled: true`
- `settings.json` has `#claude-raid-rtk` hook in PreToolUse
- `rtk-bridge.sh` exists and is executable
- RTK hook comes after core Raid hooks in `settings.json`

- [ ] **Step 4: Commit any test fixes**

Only if needed:

```bash
git add -A && git commit -m "fix: integration test adjustments for RTK"
```
