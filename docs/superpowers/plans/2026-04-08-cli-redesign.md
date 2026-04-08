# CLI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the CLI with RPG-themed commands, 8-bit dungeon visual aesthetic, warm amber color palette, and strong copywriting.

**Architecture:** New `src/ui.js` module centralizes all ANSI colors, the ASCII banner, and box-drawing helpers. All command modules (`init.js`, `update.js`, `remove.js`, `doctor.js`, `setup.js`) import from `ui.js` for their output. `bin/cli.js` adds new command names with old ones as aliases.

**Tech Stack:** Node.js stdlib only (ANSI escape codes, no chalk/kleur)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/ui.js` | Create | Colors, banner, box-drawing, themed print helpers |
| `tests/cli/ui.test.js` | Create | Tests for colors, banner, box, NO_COLOR support |
| `bin/cli.js` | Modify | New command names + aliases, themed help screen |
| `src/setup.js` | Modify | Use ui.js colors in formatChecks and runSetup |
| `src/init.js` | Modify | RPG-themed output in run() |
| `src/update.js` | Modify | RPG-themed output in run() |
| `src/remove.js` | Modify | RPG-themed output in run() |
| `src/doctor.js` | Modify | RPG-themed output in run(), boxed reference sections |
| `tests/cli/setup.test.js` | Modify | Add stripAnsi helper, update output assertions |

---

### Task 1: Create `src/ui.js` — colors, banner, box, print helpers

**Files:**
- Create: `src/ui.js`
- Create: `tests/cli/ui.test.js`

- [ ] **Step 1: Write failing tests for ui.js**

```js
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// We need to re-require ui.js with different env vars, so use a helper
function loadUi(env = {}) {
  // Clear cached module
  const modPath = require.resolve('../../src/ui');
  delete require.cache[modPath];

  const origEnv = {};
  for (const [k, v] of Object.entries(env)) {
    origEnv[k] = process.env[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }

  const ui = require('../../src/ui');

  // Restore env
  for (const [k, v] of Object.entries(origEnv)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }

  return ui;
}

describe('ui', () => {
  it('colors.amber wraps string with ANSI yellow', () => {
    const ui = loadUi({ NO_COLOR: undefined });
    const result = ui.colors.amber('hello');
    assert.ok(result.includes('\x1b[33m'));
    assert.ok(result.includes('hello'));
    assert.ok(result.includes('\x1b[0m'));
  });

  it('colors.green wraps string with ANSI green', () => {
    const ui = loadUi({ NO_COLOR: undefined });
    const result = ui.colors.green('ok');
    assert.ok(result.includes('\x1b[32m'));
  });

  it('colors.red wraps string with ANSI red', () => {
    const ui = loadUi({ NO_COLOR: undefined });
    const result = ui.colors.red('err');
    assert.ok(result.includes('\x1b[31m'));
  });

  it('colors.dim wraps string with ANSI gray', () => {
    const ui = loadUi({ NO_COLOR: undefined });
    const result = ui.colors.dim('hint');
    assert.ok(result.includes('\x1b[90m'));
  });

  it('colors.bold wraps string with ANSI bold', () => {
    const ui = loadUi({ NO_COLOR: undefined });
    const result = ui.colors.bold('strong');
    assert.ok(result.includes('\x1b[1m'));
  });

  it('colors return plain strings when NO_COLOR is set', () => {
    const ui = loadUi({ NO_COLOR: '1' });
    assert.strictEqual(ui.colors.amber('hello'), 'hello');
    assert.strictEqual(ui.colors.green('hello'), 'hello');
    assert.strictEqual(ui.colors.red('hello'), 'hello');
    assert.strictEqual(ui.colors.dim('hello'), 'hello');
    assert.strictEqual(ui.colors.bold('hello'), 'hello');
  });

  it('banner returns string containing block characters', () => {
    const ui = loadUi({ NO_COLOR: '1' });
    const b = ui.banner();
    assert.ok(b.includes('██'));
    assert.ok(b.includes('╔'));
    assert.ok(b.includes('╚'));
  });

  it('banner contains tagline', () => {
    const ui = loadUi({ NO_COLOR: '1' });
    const b = ui.banner();
    assert.ok(b.includes('Adversarial'));
    assert.ok(b.includes('Claude Code'));
  });

  it('box draws borders around content', () => {
    const ui = loadUi({ NO_COLOR: '1' });
    const result = ui.box('Title', ['  line one', '  line two']);
    assert.ok(result.includes('┌'));
    assert.ok(result.includes('┐'));
    assert.ok(result.includes('└'));
    assert.ok(result.includes('┘'));
    assert.ok(result.includes('Title'));
    assert.ok(result.includes('line one'));
    assert.ok(result.includes('line two'));
  });

  it('box auto-sizes to widest content line', () => {
    const ui = loadUi({ NO_COLOR: '1' });
    const result = ui.box('T', ['  short', '  this is a longer line']);
    const lines = result.split('\n');
    const topLine = lines[0];
    const bottomLine = lines[lines.length - 1] || lines[lines.length - 2];
    // top and bottom borders should be the same width
    assert.strictEqual(topLine.length, bottomLine.length);
  });

  it('header includes sword emoji and text', () => {
    const ui = loadUi({ NO_COLOR: '1' });
    const h = ui.header('Battle Plan');
    assert.ok(h.includes('⚔'));
    assert.ok(h.includes('Battle Plan'));
  });

  it('stripAnsi removes ANSI codes', () => {
    const ui = loadUi({ NO_COLOR: undefined });
    const colored = ui.colors.amber('hello');
    assert.strictEqual(ui.stripAnsi(colored), 'hello');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/cli/ui.test.js`
Expected: FAIL — `Cannot find module '../../src/ui'`

- [ ] **Step 3: Implement `src/ui.js`**

```js
'use strict';

// --- Color support detection (evaluated once at load) ---

const useColor = !process.env.NO_COLOR && !!process.stdout.isTTY;

function wrap(code) {
  if (!useColor) return (str) => str;
  return (str) => `\x1b[${code}m${str}\x1b[0m`;
}

const colors = {
  amber: wrap('33'),
  green: wrap('32'),
  red: wrap('31'),
  dim: wrap('90'),
  bold: wrap('1'),
};

// --- Strip ANSI (for testing) ---

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// --- Banner ---

const BANNER_ART = [
  '    ██████╗  █████╗ ██╗██████╗ ',
  '    ██╔══██╗██╔══██╗██║██╔══██╗',
  '    ██████╔╝███████║██║██║  ██║',
  '    ██╔══██╗██╔══██║██║██║  ██║',
  '    ██║  ██║██║  ██║██║██████╔╝',
  '    ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═════╝ ',
];

const TAGLINE_1 = '    Adversarial multi-agent warfare';
const TAGLINE_2 = '    for Claude Code';

function banner() {
  const maxWidth = Math.max(
    ...BANNER_ART.map(l => l.length),
    TAGLINE_1.length,
    TAGLINE_2.length,
  );
  const boxWidth = maxWidth + 6;
  const top = colors.amber('╔' + '═'.repeat(boxWidth) + '╗');
  const bot = colors.amber('╚' + '═'.repeat(boxWidth) + '╗');
  const empty = colors.amber('║') + ' '.repeat(boxWidth) + colors.amber('║');

  const artLines = BANNER_ART.map(l =>
    colors.amber('║') + '  ' + colors.amber(l) + ' '.repeat(boxWidth - l.length - 2) + colors.amber('║')
  );
  const tag1 = colors.amber('║') + '  ' + colors.dim(TAGLINE_1) + ' '.repeat(boxWidth - TAGLINE_1.length - 2) + colors.amber('║');
  const tag2 = colors.amber('║') + '  ' + colors.dim(TAGLINE_2) + ' '.repeat(boxWidth - TAGLINE_2.length - 2) + colors.amber('║');

  return [
    top,
    empty,
    ...artLines,
    empty,
    tag1,
    tag2,
    empty,
    bot,
  ].join('\n');
}

// --- Box ---

function box(title, contentLines) {
  const titleStr = ' ⚔ ' + title + ' ';
  const minWidth = Math.max(
    titleStr.length + 4,
    ...contentLines.map(l => stripAnsi(l).length + 4),
  );
  const width = minWidth;

  const topBar = colors.amber('┌─── ⚔ ' + title + ' ' + '─'.repeat(Math.max(0, width - titleStr.length - 3)) + '┐');
  const botBar = colors.amber('└' + '─'.repeat(width) + '┘');
  const emptyLine = colors.amber('│') + ' '.repeat(width) + colors.amber('│');

  const lines = contentLines.map(l => {
    const plainLen = stripAnsi(l).length;
    const pad = Math.max(0, width - plainLen);
    return colors.amber('│') + l + ' '.repeat(pad) + colors.amber('│');
  });

  return [topBar, emptyLine, ...lines, emptyLine, botBar].join('\n');
}

// --- Header ---

function header(text) {
  return '\n  ' + colors.amber(colors.bold('⚔ ' + text));
}

// --- Print helpers ---

const print = {
  success: (text) => console.log('  ' + colors.green('✔') + ' ' + text),
  fail: (text) => console.log('  ' + colors.red('✖') + ' ' + text),
  info: (text) => console.log('  ' + colors.dim('→') + ' ' + text),
  line: (text) => console.log('  ' + text),
};

module.exports = { colors, banner, box, header, print, stripAnsi };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/cli/ui.test.js`
Expected: All tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests PASS (no regressions)

- [ ] **Step 6: Commit**

```bash
git add src/ui.js tests/cli/ui.test.js
git commit -m "feat(ui): add color system, ASCII banner, box-drawing, and print helpers"
```

---

### Task 2: Rewire `bin/cli.js` — new commands, aliases, themed help

**Files:**
- Modify: `bin/cli.js`

- [ ] **Step 1: Rewrite `bin/cli.js`**

```js
#!/usr/bin/env node

'use strict';

const command = process.argv[2];
const { banner, colors, header } = require('../src/ui');

const COMMANDS = {
  // Primary commands
  summon: () => require('../src/init').run(),
  update: () => require('../src/update').run(),
  dismantle: () => require('../src/remove').run(),
  heal: () => require('../src/doctor').run(),
  // Aliases (backward compat)
  init: () => require('../src/init').run(),
  remove: () => require('../src/remove').run(),
  doctor: () => require('../src/doctor').run(),
};

if (!command || !COMMANDS[command]) {
  console.log('\n' + banner());
  console.log(header('Commands') + '\n');
  console.log('    ' + colors.bold('summon') + '      Summon the party into this realm');
  console.log('    ' + colors.bold('update') + '      Reforge the party\'s arsenal');
  console.log('    ' + colors.bold('dismantle') + '   Dismantle the camp and retreat');
  console.log('    ' + colors.bold('heal') + '        Diagnose wounds and prepare for battle');
  console.log(header('Begin the Raid') + '\n');
  console.log('    claude --agent wizard\n');
  console.log(colors.dim('  github.com/pedropicardi/claude-raid') + '\n');
  process.exit(command ? 1 : 0);
}

Promise.resolve(COMMANDS[command]()).catch((err) => {
  console.error(`\nclaude-raid: ${err.message}\n`);
  process.exit(1);
});
```

- [ ] **Step 2: Manual smoke test**

Run: `node bin/cli.js`
Expected: Amber banner, themed help with command list, sword headers

Run: `node bin/cli.js summon` (from temp dir — will fail on missing dir, but shows banner)
Run: `node bin/cli.js init` (alias still works)

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add bin/cli.js
git commit -m "feat(cli): add RPG command names with aliases and themed help screen"
```

---

### Task 3: Add `stripAnsi` helper to setup tests and wire colors into `formatChecks`

**Files:**
- Modify: `src/setup.js`
- Modify: `tests/cli/setup.test.js`

- [ ] **Step 1: Update setup.test.js to import stripAnsi and update formatChecks test**

At the top of `tests/cli/setup.test.js`, add the import:

```js
const { stripAnsi } = require('../../src/ui');
```

Update the `formatChecks renders icons and hints` test:

```js
  it('formatChecks renders icons and hints', () => {
    const checks = [
      { id: 'node', ok: true, label: 'Node.js', detail: 'v20.0.0' },
      { id: 'claude', ok: false, label: 'Claude Code', detail: 'not found', hint: 'Install it' },
    ];
    const out = stripAnsi(formatChecks(checks));
    assert.ok(out.includes('✔'));
    assert.ok(out.includes('✖'));
    assert.ok(out.includes('→ Install it'));
  });
```

- [ ] **Step 2: Run tests to verify baseline passes**

Run: `node --test tests/cli/setup.test.js`
Expected: PASS (stripAnsi is a no-op on uncolored strings from the current formatChecks)

- [ ] **Step 3: Update `formatChecks` in `src/setup.js` to use colors**

Add at the top of `src/setup.js`:

```js
const { colors } = require('./ui');
```

Replace the `formatChecks` function:

```js
function formatChecks(checks) {
  const lines = [];
  const maxLabel = Math.max(...checks.map(c => c.label.length));

  for (const check of checks) {
    const icon = check.ok ? colors.green('✔') : colors.red('✖');
    const pad = ' '.repeat(maxLabel - check.label.length + 2);
    lines.push(`  ${icon} ${check.label}${pad}${check.detail}`);
    if (check.hint) {
      lines.push(`    ${colors.dim('→')} ${colors.dim(check.hint)}`);
    }
  }
  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/cli/setup.test.js`
Expected: All PASS (stripAnsi handles the new colors)

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/setup.js tests/cli/setup.test.js
git commit -m "feat(setup): add ANSI colors to check output"
```

---

### Task 4: Theme `runSetup` with box-drawing and RPG copy

**Files:**
- Modify: `src/setup.js`

- [ ] **Step 1: Update `runSetup` to use box and header**

Add to the import at the top of `src/setup.js`:

```js
const { colors, box, header } = require('./ui');
```

Replace the output sections in `runSetup` (lines 247-300). The new `runSetup` function body from the `isInteractive` check onward:

```js
async function runSetup(opts = {}) {
  const homedir = opts.homedir || os.homedir();
  const exec = opts.exec || tryExec;
  const stdin = opts.stdin || process.stdin;
  const stdout = opts.stdout || process.stdout;
  const actions = [];

  let { checks, allOk } = runChecks({ homedir, exec });

  const isInteractive = !!stdin.isTTY;

  // Non-interactive: print all checks in a box and return
  if (!isInteractive) {
    const allLines = checks.map(c => formatCheckLine(c));
    stdout.write('\n' + box('Party Status', allLines) + '\n');
    return { checks, allOk, actions: [] };
  }

  // Interactive: print initial checks (not split-pane yet)
  const initialChecks = checks.filter(c => c.id !== 'split-pane');
  const initialLines = initialChecks.map(c => formatCheckLine(c));
  stdout.write('\n' + box('Party Status', initialLines) + '\n');

  // Handle teammate-mode fix
  const tmCheck = checks.find(c => c.id === 'teammate-mode');
  let selectedMode = null;

  if (!tmCheck.ok && tmCheck.fixable) {
    stdout.write('\n  Choose your formation:\n\n');
    for (const item of MODE_MENU) {
      stdout.write(`    ${colors.amber(item.key + ')')} ${colors.bold(item.value.padEnd(12))} ${colors.dim(item.desc)}\n`);
    }
    const choice = await ask('\n  Pick [1/2/3]: ', stdin, stdout);
    const picked = MODE_MENU.find(m => m.key === choice);
    if (picked) {
      const confirm = await ask(`  Write teammateMode: "${colors.bold(picked.value)}" to ~/.claude.json? [Y/n] `, stdin, stdout);
      if (confirm.toLowerCase() !== 'n') {
        writeTeammateMode(homedir, picked.value);
        tmCheck.ok = true;
        tmCheck.detail = picked.value;
        delete tmCheck.hint;
        delete tmCheck.fixable;
        actions.push('teammate-mode');
        selectedMode = picked.value;
        stdout.write('  ' + colors.green('✔') + ' Updated ~/.claude.json\n');
      }
    }
  } else if (tmCheck.ok) {
    selectedMode = tmCheck.detail;
  }

  // Handle split-pane check
  const splitPane = checks.find(c => c.id === 'split-pane');
  if (selectedMode === 'in-process') {
    splitPane.ok = true;
    splitPane.detail = 'not needed (in-process mode)';
    delete splitPane.hint;
  }

  stdout.write('\n  ' + formatCheckLine(splitPane) + '\n');

  // Recalculate allOk (required checks only: node + claude)
  const REQUIRED_IDS = ['node', 'claude'];
  allOk = checks.filter(c => REQUIRED_IDS.includes(c.id)).every(c => c.ok);

  if (checks.every(c => c.ok)) {
    stdout.write('\n  ' + colors.green('The party is assembled.') + ' Your quest awaits.\n');
    stdout.write('\n    claude --agent wizard\n');
  }

  return { checks, allOk, actions };
}
```

Also add a helper function `formatCheckLine` (private, above `runSetup`):

```js
function formatCheckLine(check) {
  const icon = check.ok ? colors.green('✔') : colors.red('✖');
  const line = `  ${icon} ${check.label}  ${check.detail}`;
  if (check.hint) {
    return line + '\n' + `    ${colors.dim('→')} ${colors.dim(check.hint)}`;
  }
  return line;
}
```

- [ ] **Step 2: Update runSetup tests for new output patterns**

In `tests/cli/setup.test.js`, update the `skips split-pane check when in-process selected` test to also check for 'not needed':

```js
  it('skips split-pane check when in-process selected', async () => {
    const home = makeTempDir();
    const stdin = mockStdin(['2', 'y']);
    const stdout = mockStdout();
    const exec = (cmd) => {
      if (cmd === 'claude --version') return '2.3.1';
      return null;
    };

    const result = await runSetup({ homedir: home, exec, stdin, stdout });

    const sp = result.checks.find(c => c.id === 'split-pane');
    assert.strictEqual(sp.ok, true);
    assert.ok(sp.detail.includes('not needed'));
  });
```

(This test should still pass since the logic hasn't changed, only the output formatting.)

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/setup.js tests/cli/setup.test.js
git commit -m "feat(setup): theme runSetup with box-drawing and RPG copy"
```

---

### Task 5: Theme `src/init.js` — RPG output

**Files:**
- Modify: `src/init.js`

- [ ] **Step 1: Update `run()` with themed output**

Add import at top:

```js
const { banner, header, colors } = require('./ui');
```

Replace `run()`:

```js
async function run() {
  const cwd = process.cwd();
  console.log('\n' + banner());
  console.log(header('Summoning the Party...') + '\n');

  const result = install(cwd);

  if (result.alreadyInstalled) {
    console.log('  The party is already here. Use ' + colors.bold('claude-raid update') + ' to reforge.');
    console.log('  Proceeding with re-summon...\n');
  }

  console.log('  Realm detected: ' + colors.bold(result.detected.language));
  if (result.detected.testCommand) {
    console.log('  Battle cry:     ' + colors.bold(result.detected.testCommand));
  }
  if (result.skipped.length > 0) {
    console.log('\n  ' + colors.dim('Preserved existing scrolls:'));
    result.skipped.forEach(f => console.log('    ' + colors.dim('→ ' + path.relative(cwd, f))));
  }

  await runSetup();
}
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests PASS (init tests use `install()` directly, not `run()`)

- [ ] **Step 3: Commit**

```bash
git add src/init.js
git commit -m "feat(init): theme summon command with RPG copy and banner"
```

---

### Task 6: Theme `src/update.js` — RPG output

**Files:**
- Modify: `src/update.js`

- [ ] **Step 1: Update `run()` with themed output**

Add import at top:

```js
const { banner, header, colors } = require('./ui');
```

Replace `run()`:

```js
function run() {
  const cwd = process.cwd();
  console.log('\n' + banner());
  console.log(header('Reforging the Arsenal...') + '\n');

  const result = performUpdate(cwd);

  if (!result.success) {
    console.log('  ' + colors.red('✖') + ' No party found. Run ' + colors.bold('claude-raid summon') + ' first.');
    return;
  }

  console.log('  ' + colors.green('✔') + ' The party\'s arsenal has been reforged.');
  if (result.skippedAgents.length > 0) {
    console.log('  ' + colors.dim('Preserved customized warriors: ' + result.skippedAgents.join(', ')));
  }
}
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/update.js
git commit -m "feat(update): theme update command with RPG copy and banner"
```

---

### Task 7: Theme `src/remove.js` — RPG output

**Files:**
- Modify: `src/remove.js`

- [ ] **Step 1: Update `run()` with themed output**

Add import at top:

```js
const { banner, colors } = require('./ui');
```

Replace `run()`:

```js
function run() {
  const cwd = process.cwd();
  console.log('\n' + banner());
  console.log('');
  performRemove(cwd);
  console.log('  ' + colors.green('✔') + ' The camp has been dismantled.');
  console.log('  ' + colors.dim('Your realm has been restored to its former state.') + '\n');
}
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/remove.js
git commit -m "feat(remove): theme dismantle command with RPG copy and banner"
```

---

### Task 8: Theme `src/doctor.js` — RPG output with boxed reference sections

**Files:**
- Modify: `src/doctor.js`

- [ ] **Step 1: Rewrite `src/doctor.js` with themed output**

```js
'use strict';

const { runChecks, runSetup } = require('./setup');
const { banner, box, header, colors } = require('./ui');

function diagnose(opts) {
  return runChecks(opts);
}

async function run() {
  console.log('\n' + banner());
  console.log(header('Diagnosing Wounds...') + '\n');

  const result = await runSetup();

  if (!result.allOk && !process.stdin.isTTY) {
    process.exitCode = 1;
  }

  if (result.checks.every(c => c.ok)) {
    console.log('\n  ' + colors.green('The party is battle-ready.'));
  }

  const quickStart = box('Quick Start', [
    '  In-process mode (any terminal):',
    '    ' + colors.bold('claude --agent wizard'),
    '',
    '  Split-pane mode (tmux):',
    '    ' + colors.bold('tmux new-session -s raid'),
    '    ' + colors.bold('claude --agent wizard --teammate-mode tmux'),
  ]);
  console.log('\n' + quickStart);

  const controls = box('Controls', [
    '  ' + colors.bold('Shift+Down') + '    Cycle through teammates',
    '  ' + colors.bold('Enter') + '         View a teammate\'s session',
    '  ' + colors.bold('Escape') + '        Interrupt a teammate\'s turn',
    '  ' + colors.bold('Ctrl+T') + '        Toggle the shared task list',
    '  ' + colors.bold('Click pane') + '    Interact directly (split-pane)',
  ]);
  console.log('\n' + controls);

  const modes = box('Raid Modes', [
    '  ' + colors.bold('Full Raid') + '     Warrior + Archer + Rogue (3 agents)',
    '  ' + colors.bold('Skirmish') + '      2 agents, lightweight',
    '  ' + colors.bold('Scout') + '         Wizard solo review',
    '',
    '  The Wizard recommends a mode based on task',
    '  complexity. You confirm before agents spawn.',
  ]);
  console.log('\n' + modes + '\n');
}

module.exports = { diagnose, run };
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 3: Smoke test doctor output**

Run: `node bin/cli.js heal`
Expected: Banner, themed header, status box, reference sections in boxes

Run: `echo "" | node bin/cli.js heal`
Expected: Same but no prompts, non-interactive

- [ ] **Step 4: Commit**

```bash
git add src/doctor.js
git commit -m "feat(doctor): theme heal command with boxed reference sections"
```

---

### Task 9: Final integration test

**Files:**
- All modified files

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 2: Smoke test all commands**

```bash
node bin/cli.js
node bin/cli.js heal
echo "" | node bin/cli.js heal
node bin/cli.js summon  # (from a temp dir with package.json)
node bin/cli.js update
node bin/cli.js dismantle
```

Expected: All show amber banner, themed copy, consistent box formatting

- [ ] **Step 3: Test aliases**

```bash
node bin/cli.js init    # alias for summon
node bin/cli.js remove  # alias for dismantle
node bin/cli.js doctor  # alias for heal
```

Expected: All work identically to their primary command names

- [ ] **Step 4: Test NO_COLOR**

```bash
NO_COLOR=1 node bin/cli.js
NO_COLOR=1 node bin/cli.js heal
```

Expected: Same output structure, no ANSI codes in output

- [ ] **Step 5: Verify non-interactive exit code**

```bash
echo "" | node bin/cli.js heal; echo "Exit: $?"
```

Expected: Exit 0 if required checks pass, Exit 1 if they fail
