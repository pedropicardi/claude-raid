# Setup Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the doctor command into an interactive setup wizard and integrate it into init, so one command handles full onboarding.

**Architecture:** New `src/setup.js` module owns all check logic and interactive prompts. `doctor.js` and `init.js` become thin wrappers. Node's built-in `readline` handles user input with no new dependencies.

**Tech Stack:** Node.js stdlib (fs, path, os, readline)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/setup.js` | Create | Shared setup engine: checks, prompts, config writes |
| `src/doctor.js` | Modify | Thin wrapper calling `setup.runSetup()` + appending reference sections |
| `src/init.js` | Modify | Call `setup.runSetup()` after install |
| `bin/cli.js` | Modify | Pass `--no-interactive` flag through to doctor/init |
| `tests/cli/setup.test.js` | Create | Unit tests for the setup engine |
| `tests/cli/doctor.test.js` | Modify | Update imports to use setup.js |
| `tests/cli/init.test.js` | Modify | Test that init calls setup |
| `README.md` | Modify | Replace Requirements with Getting Started |

---

### Task 1: Create `src/setup.js` — check functions

**Files:**
- Create: `src/setup.js`
- Test: `tests/cli/setup.test.js`

- [ ] **Step 1: Write failing tests for check functions**

```js
'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { runChecks } = require('../../src/setup');

let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-setup-'));
  return tmpDir;
}

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

describe('runChecks', () => {
  it('node check always passes', () => {
    const home = makeTempDir();
    const result = runChecks({ homedir: home, exec: () => null });
    const node = result.checks.find(c => c.id === 'node');
    assert.strictEqual(node.ok, true);
    assert.ok(node.detail.startsWith('v'));
  });

  it('claude check fails when not found', () => {
    const home = makeTempDir();
    const result = runChecks({ homedir: home, exec: () => null });
    const claude = result.checks.find(c => c.id === 'claude');
    assert.strictEqual(claude.ok, false);
    assert.strictEqual(claude.hint, 'Install: npm install -g @anthropic-ai/claude-code');
  });

  it('claude check passes with valid version', () => {
    const home = makeTempDir();
    const exec = (cmd) => cmd === 'claude --version' ? '2.3.1' : null;
    const result = runChecks({ homedir: home, exec });
    const claude = result.checks.find(c => c.id === 'claude');
    assert.strictEqual(claude.ok, true);
  });

  it('claude check fails with old version', () => {
    const home = makeTempDir();
    const exec = (cmd) => cmd === 'claude --version' ? '1.0.0' : null;
    const result = runChecks({ homedir: home, exec });
    const claude = result.checks.find(c => c.id === 'claude');
    assert.strictEqual(claude.ok, false);
    assert.ok(claude.hint.includes('Update'));
  });

  it('teammate-mode passes with tmux', () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ teammateMode: 'tmux' }));
    const result = runChecks({ homedir: home, exec: () => null });
    const tm = result.checks.find(c => c.id === 'teammate-mode');
    assert.strictEqual(tm.ok, true);
  });

  it('teammate-mode passes with in-process', () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ teammateMode: 'in-process' }));
    const result = runChecks({ homedir: home, exec: () => null });
    const tm = result.checks.find(c => c.id === 'teammate-mode');
    assert.strictEqual(tm.ok, true);
  });

  it('teammate-mode passes with auto', () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ teammateMode: 'auto' }));
    const result = runChecks({ homedir: home, exec: () => null });
    const tm = result.checks.find(c => c.id === 'teammate-mode');
    assert.strictEqual(tm.ok, true);
  });

  it('teammate-mode fails when missing', () => {
    const home = makeTempDir();
    const result = runChecks({ homedir: home, exec: () => null });
    const tm = result.checks.find(c => c.id === 'teammate-mode');
    assert.strictEqual(tm.ok, false);
  });

  it('teammate-mode fails with invalid value', () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ teammateMode: 'invalid' }));
    const result = runChecks({ homedir: home, exec: () => null });
    const tm = result.checks.find(c => c.id === 'teammate-mode');
    assert.strictEqual(tm.ok, false);
  });

  it('teammate-mode fails with invalid JSON', () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), 'not json');
    const result = runChecks({ homedir: home, exec: () => null });
    const tm = result.checks.find(c => c.id === 'teammate-mode');
    assert.strictEqual(tm.ok, false);
    assert.ok(tm.detail.includes('not valid JSON'));
  });

  it('split-pane passes with tmux', () => {
    const home = makeTempDir();
    const exec = (cmd) => cmd === 'command -v tmux' ? '/usr/local/bin/tmux' : null;
    const result = runChecks({ homedir: home, exec });
    const sp = result.checks.find(c => c.id === 'split-pane');
    assert.strictEqual(sp.ok, true);
    assert.ok(sp.detail.includes('tmux'));
  });

  it('split-pane passes with it2', () => {
    const home = makeTempDir();
    const exec = (cmd) => cmd === 'command -v it2' ? '/usr/local/bin/it2' : null;
    const result = runChecks({ homedir: home, exec });
    const sp = result.checks.find(c => c.id === 'split-pane');
    assert.strictEqual(sp.ok, true);
    assert.ok(sp.detail.includes('iTerm2'));
  });

  it('split-pane fails when neither found', () => {
    const home = makeTempDir();
    const result = runChecks({ homedir: home, exec: () => null });
    const sp = result.checks.find(c => c.id === 'split-pane');
    assert.strictEqual(sp.ok, false);
  });

  it('allOk is true when all checks pass', () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ teammateMode: 'tmux' }));
    const exec = (cmd) => {
      if (cmd === 'claude --version') return '2.3.1';
      if (cmd === 'command -v tmux') return '/usr/local/bin/tmux';
      return null;
    };
    const result = runChecks({ homedir: home, exec });
    assert.strictEqual(result.allOk, true);
  });

  it('allOk is false when any required check fails', () => {
    const home = makeTempDir();
    const result = runChecks({ homedir: home, exec: () => null });
    assert.strictEqual(result.allOk, false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/cli/setup.test.js`
Expected: FAIL — `Cannot find module '../../src/setup'`

- [ ] **Step 3: Implement check functions in `src/setup.js`**

```js
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function tryExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function parseVersion(str) {
  const match = str && str.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return { major: +match[1], minor: +match[2], patch: +match[3] };
}

function versionGte(v, min) {
  if (v.major !== min.major) return v.major > min.major;
  if (v.minor !== min.minor) return v.minor > min.minor;
  return v.patch >= min.patch;
}

const MIN_CLAUDE = { major: 2, minor: 1, patch: 32 };
const VALID_TEAMMATE_MODES = ['tmux', 'in-process', 'auto'];

function checkNode() {
  return { id: 'node', ok: true, label: 'Node.js', detail: process.version };
}

function checkClaude(exec) {
  const raw = exec('claude --version');
  if (!raw) {
    return {
      id: 'claude',
      ok: false,
      label: 'Claude Code',
      detail: 'not found',
      hint: 'Install: npm install -g @anthropic-ai/claude-code',
    };
  }
  const ver = parseVersion(raw);
  if (!ver) {
    return {
      id: 'claude',
      ok: false,
      label: 'Claude Code',
      detail: `unknown version: ${raw}`,
      hint: 'Expected semver from "claude --version"',
    };
  }
  const ok = versionGte(ver, MIN_CLAUDE);
  const tag = `v${ver.major}.${ver.minor}.${ver.patch}`;
  return {
    id: 'claude',
    ok,
    label: 'Claude Code',
    detail: ok
      ? `${tag} (>= ${MIN_CLAUDE.major}.${MIN_CLAUDE.minor}.${MIN_CLAUDE.patch} required)`
      : `${tag} — update required (>= ${MIN_CLAUDE.major}.${MIN_CLAUDE.minor}.${MIN_CLAUDE.patch})`,
    hint: ok ? undefined : 'Update: npm update -g @anthropic-ai/claude-code',
  };
}

function checkTeammateMode(homedir) {
  const configPath = path.join(homedir, '.claude.json');
  if (!fs.existsSync(configPath)) {
    return {
      id: 'teammate-mode',
      ok: false,
      label: 'teammateMode',
      detail: 'not set — ~/.claude.json not found',
      hint: 'Add "teammateMode": "tmux" (or "in-process" or "auto") to ~/.claude.json',
      fixable: true,
    };
  }
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {
      id: 'teammate-mode',
      ok: false,
      label: 'teammateMode',
      detail: '~/.claude.json is not valid JSON',
      hint: 'Fix the JSON syntax, then add "teammateMode"',
      fixable: false,
    };
  }
  if (VALID_TEAMMATE_MODES.includes(config.teammateMode)) {
    return {
      id: 'teammate-mode',
      ok: true,
      label: 'teammateMode',
      detail: config.teammateMode,
    };
  }
  return {
    id: 'teammate-mode',
    ok: false,
    label: 'teammateMode',
    detail: config.teammateMode
      ? `"${config.teammateMode}" is not valid (use: tmux, in-process, auto)`
      : 'not set in ~/.claude.json',
    hint: 'Add "teammateMode": "tmux" (or "in-process" or "auto") to ~/.claude.json',
    fixable: true,
  };
}

function checkSplitPane(exec) {
  const hasTmux = !!exec('command -v tmux');
  const hasIt2 = !!exec('command -v it2');

  if (hasTmux && hasIt2) {
    return { id: 'split-pane', ok: true, label: 'Split-pane', detail: 'tmux + iTerm2' };
  }
  if (hasTmux) {
    return { id: 'split-pane', ok: true, label: 'Split-pane', detail: 'tmux' };
  }
  if (hasIt2) {
    return { id: 'split-pane', ok: true, label: 'Split-pane', detail: 'iTerm2 (it2)' };
  }
  return {
    id: 'split-pane',
    ok: false,
    label: 'Split-pane',
    detail: 'not available (tmux and it2 not found)',
    hint: process.platform === 'darwin'
      ? 'Install: brew install tmux (or use in-process mode)'
      : 'Install tmux via your package manager (or use in-process mode)',
  };
}

function runChecks(opts = {}) {
  const homedir = opts.homedir || os.homedir();
  const exec = opts.exec || tryExec;

  const checks = [
    checkNode(),
    checkClaude(exec),
    checkTeammateMode(homedir),
    checkSplitPane(exec),
  ];

  return {
    checks,
    allOk: checks.every(c => c.ok),
  };
}

function formatChecks(checks) {
  const lines = [];
  const maxLabel = Math.max(...checks.map(c => c.label.length));

  for (const check of checks) {
    const icon = check.ok ? '\u2714' : '\u2716';
    const pad = ' '.repeat(maxLabel - check.label.length + 2);
    lines.push(`  ${icon} ${check.label}${pad}${check.detail}`);
    if (check.hint) {
      lines.push(`    \u2192 ${check.hint}`);
    }
  }
  return lines.join('\n');
}

module.exports = { runChecks, formatChecks, VALID_TEAMMATE_MODES };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/cli/setup.test.js`
Expected: All 15 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/setup.js tests/cli/setup.test.js
git commit -m "feat(setup): add shared check engine with split-pane and teammateMode support"
```

---

### Task 2: Add interactive prompts to `src/setup.js`

**Files:**
- Modify: `src/setup.js`
- Test: `tests/cli/setup.test.js`

- [ ] **Step 1: Write failing tests for `runSetup` interactive flow**

Append to `tests/cli/setup.test.js`:

```js
const { runSetup, formatChecks } = require('../../src/setup');
const { Readable, Writable } = require('stream');

function mockStdin(inputs) {
  const lines = [...inputs];
  const readable = new Readable({
    read() {
      if (lines.length > 0) {
        setTimeout(() => this.push(lines.shift() + '\n'), 10);
      } else {
        setTimeout(() => this.push(null), 10);
      }
    },
  });
  readable.isTTY = true;
  return readable;
}

function mockStdout() {
  let output = '';
  const writable = new Writable({
    write(chunk, encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  writable.columns = 80;
  writable.getOutput = () => output;
  return writable;
}

describe('runSetup — interactive', () => {
  it('prompts for teammateMode and writes to ~/.claude.json', async () => {
    const home = makeTempDir();
    const exec = (cmd) => {
      if (cmd === 'claude --version') return '2.3.1';
      if (cmd === 'command -v tmux') return '/usr/local/bin/tmux';
      return null;
    };
    const stdin = mockStdin(['2', 'y']);
    const stdout = mockStdout();

    const result = await runSetup({ homedir: home, exec, stdin, stdout });

    const config = JSON.parse(fs.readFileSync(path.join(home, '.claude.json'), 'utf8'));
    assert.strictEqual(config.teammateMode, 'in-process');
    assert.ok(result.actions.includes('teammate-mode'));
  });

  it('preserves existing ~/.claude.json content', async () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ existingKey: 'value' }));
    const exec = (cmd) => {
      if (cmd === 'claude --version') return '2.3.1';
      if (cmd === 'command -v tmux') return '/usr/local/bin/tmux';
      return null;
    };
    const stdin = mockStdin(['1', 'y']);
    const stdout = mockStdout();

    await runSetup({ homedir: home, exec, stdin, stdout });

    const config = JSON.parse(fs.readFileSync(path.join(home, '.claude.json'), 'utf8'));
    assert.strictEqual(config.existingKey, 'value');
    assert.strictEqual(config.teammateMode, 'tmux');
  });

  it('skips prompts when not interactive', async () => {
    const home = makeTempDir();
    const exec = (cmd) => {
      if (cmd === 'claude --version') return '2.3.1';
      return null;
    };
    const stdin = mockStdin([]);
    stdin.isTTY = false;
    const stdout = mockStdout();

    const result = await runSetup({ homedir: home, exec, stdin, stdout });

    assert.deepStrictEqual(result.actions, []);
  });

  it('does not write config when user declines', async () => {
    const home = makeTempDir();
    const exec = (cmd) => {
      if (cmd === 'claude --version') return '2.3.1';
      return null;
    };
    const stdin = mockStdin(['1', 'n']);
    const stdout = mockStdout();

    await runSetup({ homedir: home, exec, stdin, stdout });

    assert.ok(!fs.existsSync(path.join(home, '.claude.json')));
  });

  it('skips split-pane check when in-process selected', async () => {
    const home = makeTempDir();
    const exec = (cmd) => {
      if (cmd === 'claude --version') return '2.3.1';
      return null;
    };
    const stdin = mockStdin(['2', 'y']);
    const stdout = mockStdout();

    const result = await runSetup({ homedir: home, exec, stdin, stdout });

    const sp = result.checks.find(c => c.id === 'split-pane');
    assert.ok(sp.detail.includes('not needed'));
  });

  it('skips prompts when all checks pass', async () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ teammateMode: 'tmux' }));
    const exec = (cmd) => {
      if (cmd === 'claude --version') return '2.3.1';
      if (cmd === 'command -v tmux') return '/usr/local/bin/tmux';
      return null;
    };
    const stdin = mockStdin([]);
    const stdout = mockStdout();

    const result = await runSetup({ homedir: home, exec, stdin, stdout });

    assert.deepStrictEqual(result.actions, []);
    assert.strictEqual(result.allOk, true);
  });
});

describe('formatChecks', () => {
  it('formats passing checks with checkmark', () => {
    const output = formatChecks([{ ok: true, label: 'Node.js', detail: 'v22.0.0' }]);
    assert.ok(output.includes('\u2714'));
    assert.ok(output.includes('v22.0.0'));
  });

  it('formats failing checks with X and hint', () => {
    const output = formatChecks([{ ok: false, label: 'Claude Code', detail: 'not found', hint: 'Install it' }]);
    assert.ok(output.includes('\u2716'));
    assert.ok(output.includes('Install it'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/cli/setup.test.js`
Expected: FAIL — `runSetup is not a function`

- [ ] **Step 3: Implement `runSetup` and `ask` helper in `src/setup.js`**

Add to `src/setup.js` before `module.exports`:

```js
const readline = require('readline');

function ask(question, stdin, stdout) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

const MODE_MENU = [
  { key: '1', value: 'tmux', desc: 'split panes, see all agents at once (requires tmux/iTerm2)' },
  { key: '2', value: 'in-process', desc: 'all in one terminal, cycle with Shift+Down' },
  { key: '3', value: 'auto', desc: 'split panes if available, otherwise in-process' },
];

function writeTeammateMode(homedir, mode) {
  const configPath = path.join(homedir, '.claude.json');
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      // If JSON is invalid, start fresh
      config = {};
    }
  }
  config.teammateMode = mode;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

async function runSetup(opts = {}) {
  const homedir = opts.homedir || os.homedir();
  const exec = opts.exec || tryExec;
  const stdin = opts.stdin || process.stdin;
  const stdout = opts.stdout || process.stdout;
  const interactive = stdin.isTTY !== false;

  const result = runChecks({ homedir, exec });
  const actions = [];

  // Print initial checks (node + claude + teammate-mode, but not split-pane yet)
  const initialChecks = result.checks.filter(c => c.id !== 'split-pane');
  stdout.write('\n\u2500\u2500\u2500 Setup \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n');
  stdout.write(formatChecks(initialChecks) + '\n');

  const tmCheck = result.checks.find(c => c.id === 'teammate-mode');
  let selectedMode = null;

  // Interactive teammate-mode fix
  if (!tmCheck.ok && tmCheck.fixable !== false && interactive) {
    stdout.write('\n  Which teammate display mode do you want?\n\n');
    for (const opt of MODE_MENU) {
      stdout.write(`    ${opt.key}. ${opt.value.padEnd(12)} \u2014 ${opt.desc}\n`);
    }
    stdout.write('\n');

    const choice = await ask('  > ', stdin, stdout);
    const picked = MODE_MENU.find(m => m.key === choice);

    if (picked) {
      const confirm = await ask(`  Write teammateMode: "${picked.value}" to ~/.claude.json? [Y/n] `, stdin, stdout);
      if (confirm.toLowerCase() !== 'n') {
        writeTeammateMode(homedir, picked.value);
        stdout.write('  \u2714 Updated ~/.claude.json\n');
        tmCheck.ok = true;
        tmCheck.detail = picked.value;
        delete tmCheck.hint;
        actions.push('teammate-mode');
        selectedMode = picked.value;
      }
    }
  } else if (tmCheck.ok) {
    selectedMode = tmCheck.detail;
  }

  // Split-pane check — skip if in-process
  const spCheck = result.checks.find(c => c.id === 'split-pane');
  if (selectedMode === 'in-process') {
    spCheck.ok = true;
    spCheck.detail = 'not needed (in-process mode)';
    delete spCheck.hint;
  }

  stdout.write('\n' + formatChecks([spCheck]) + '\n');

  // Ready section
  const allOk = result.checks.every(c => c.ok);
  if (allOk) {
    stdout.write('\n\u2500\u2500\u2500 Ready \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n');
    stdout.write('  Start a Raid:  claude --agent wizard\n\n');
  }

  return { checks: result.checks, allOk, actions };
}
```

Update `module.exports`:

```js
module.exports = { runChecks, runSetup, formatChecks, VALID_TEAMMATE_MODES };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/cli/setup.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/setup.js tests/cli/setup.test.js
git commit -m "feat(setup): add interactive runSetup with teammateMode prompt and split-pane detection"
```

---

### Task 3: Rewire `src/doctor.js` to use `src/setup.js`

**Files:**
- Modify: `src/doctor.js`
- Modify: `tests/cli/doctor.test.js`

- [ ] **Step 1: Update doctor tests to import from setup.js**

Replace the contents of `tests/cli/doctor.test.js`:

```js
'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { runChecks } = require('../../src/setup');

let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-doctor-'));
  return tmpDir;
}

describe('doctor (via setup)', () => {
  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  });

  it('diagnose delegates to runChecks', () => {
    const { diagnose } = require('../../src/doctor');
    const home = makeTempDir();
    const result = diagnose({ homedir: home, exec: () => null });
    assert.ok(Array.isArray(result.checks));
    assert.strictEqual(typeof result.allOk, 'boolean');
  });

  it('checks include all four IDs', () => {
    const home = makeTempDir();
    const result = runChecks({ homedir: home, exec: () => null });
    const ids = result.checks.map(c => c.id);
    assert.deepStrictEqual(ids, ['node', 'claude', 'teammate-mode', 'split-pane']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/cli/doctor.test.js`
Expected: FAIL — `diagnose` still returns old check IDs (has `tmux` instead of `split-pane`)

- [ ] **Step 3: Rewrite `src/doctor.js` as thin wrapper**

```js
'use strict';

const { runChecks, runSetup, formatChecks } = require('./setup');

function diagnose(opts) {
  return runChecks(opts);
}

const REFERENCE_SECTIONS = `
\u2500\u2500\u2500 Quick Start \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  In-process mode (any terminal):

    claude --agent wizard

  Split-pane mode (tmux):

    tmux new-session -s raid
    claude --agent wizard --teammate-mode tmux

\u2500\u2500\u2500 Navigating Teammates \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  Shift+Down    Cycle through teammates
  Enter         View a teammate's session
  Escape        Interrupt a teammate's turn
  Ctrl+T        Toggle the shared task list
  Click pane    Interact directly (split-pane mode)

\u2500\u2500\u2500 Raid Modes \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  Full Raid     Warrior + Archer + Rogue (3 agents)
  Skirmish      2 agents, lightweight
  Scout         Wizard solo review

  The Wizard recommends a mode based on task
  complexity. You confirm before agents spawn.
`;

async function run() {
  console.log('\nclaude-raid doctor \u2014 Environment & Quick Start\n');
  await runSetup();
  console.log(REFERENCE_SECTIONS);
}

module.exports = { diagnose, run };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/cli/doctor.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/doctor.js tests/cli/doctor.test.js
git commit -m "refactor(doctor): rewire to use shared setup engine"
```

---

### Task 4: Integrate setup into `src/init.js`

**Files:**
- Modify: `src/init.js`
- Modify: `tests/cli/init.test.js`

- [ ] **Step 1: Write failing test for init calling setup**

Add to `tests/cli/init.test.js`:

```js
  it('install returns result without running setup (setup is async in run())', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const result = init.install(cwd);
    // install is synchronous — setup is only called in run()
    assert.ok(result.detected);
    assert.ok(!result.setupResult);
  });
```

- [ ] **Step 2: Run test to verify it passes** (baseline — install doesn't change yet)

Run: `node --test tests/cli/init.test.js`
Expected: PASS

- [ ] **Step 3: Update `src/init.js` to call setup in `run()`**

Replace the `run()` function in `src/init.js`:

```js
const { runSetup } = require('./setup');

async function run() {
  const cwd = process.cwd();
  console.log('\nclaude-raid \u2014 Installing The Raid\n');

  const result = install(cwd);

  if (result.alreadyInstalled) {
    console.log('The Raid is already installed. Use `claude-raid update` to update.');
    console.log('Proceeding with re-install...\n');
  }

  console.log(`Detected: ${result.detected.language}`);
  if (result.detected.testCommand) {
    console.log(`Test command: ${result.detected.testCommand}`);
  }
  if (result.skipped.length > 0) {
    console.log(`\nSkipped (existing files):`);
    result.skipped.forEach(f => console.log(`  - ${path.relative(cwd, f)}`));
  }

  console.log(`
Configuration:  .claude/raid.json (edit to customize)
Team rules:     .claude/raid-rules.md (editable)`);

  await runSetup();
}

module.exports = { install, run };
```

- [ ] **Step 4: Update `bin/cli.js` to handle async run()**

Replace `bin/cli.js`:

```js
#!/usr/bin/env node

'use strict';

const command = process.argv[2];

const COMMANDS = {
  init: () => require('../src/init').run(),
  update: () => require('../src/update').run(),
  remove: () => require('../src/remove').run(),
  doctor: () => require('../src/doctor').run(),
};

if (!command || !COMMANDS[command]) {
  console.log(`
claude-raid \u2014 Adversarial multi-agent development for Claude Code

Usage:
  claude-raid init     Install The Raid into the current project
  claude-raid update   Update to the latest version
  claude-raid remove   Uninstall The Raid
  claude-raid doctor   Check prerequisites and show quick start guide

Learn more: https://github.com/pedropicardi/claude-raid
`);
  process.exit(command ? 1 : 0);
}

Promise.resolve(COMMANDS[command]()).catch((err) => {
  console.error(`\nclaude-raid: ${err.message}\n`);
  process.exit(1);
});
```

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/init.js bin/cli.js tests/cli/init.test.js
git commit -m "feat(init): integrate setup wizard as post-install step"
```

---

### Task 5: Update README — Getting Started section

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace Requirements section with Getting Started**

Replace the `## Requirements` section (lines 321-325) with:

```markdown
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
```

- [ ] **Step 2: Remove the old Quick Start section** (lines 11-18)

The Getting Started section now covers this. Remove the old Quick Start to avoid duplication.

- [ ] **Step 3: Run tests to verify nothing broke**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: replace Requirements with Getting Started setup guide"
```

---

### Task 6: Final integration test

**Files:**
- All modified files

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 2: Manual smoke test of doctor**

Run: `node bin/cli.js doctor`
Expected: Shows check results, prompts for teammateMode if not set, shows reference sections

- [ ] **Step 3: Manual smoke test of init** (in a temp directory)

```bash
cd $(mktemp -d)
git init
echo '{"scripts":{"test":"jest"}}' > package.json
node /Users/pedropicardi/.superset/projects/the-raid/bin/cli.js init
```

Expected: Installs files, then runs setup wizard inline

- [ ] **Step 4: Verify non-interactive mode**

```bash
echo "" | node /Users/pedropicardi/.superset/projects/the-raid/bin/cli.js doctor
```

Expected: Shows checks without prompts, no hanging
