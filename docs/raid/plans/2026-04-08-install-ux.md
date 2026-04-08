# Install UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `summon` CLI output so first-time users understand what got installed and how the system works — with dry-run preview, phased install output, and post-install reference cards.

**Architecture:** Three changes layered on the existing `src/init.js` + `src/ui.js` + `src/doctor.js` stack. A shared descriptions map (`src/descriptions.js`) provides file-level descriptions used by both dry-run and install output. The `banner()` function gets a gradient redesign. A new `referenceCard()` function in `src/ui.js` renders the "How It Works" and "Next Step" boxes, shared between `summon` and `heal`.

**Tech Stack:** Node.js stdlib, ANSI-16 colors, node:test

---

### Task 1: Add gradient banner to `src/ui.js`

**Files:**
- Modify: `src/ui.js:25-63` (replace `banner()` function)
- Modify: `src/ui.js:1-19` (add `dimRed` color)
- Test: `tests/cli/ui.test.js`

- [ ] **Step 1: Write the failing test for the new gradient banner**

Add tests that verify the gradient uses distinct ANSI codes across lines:

```javascript
it('banner uses gradient colors from amber to red', () => {
  const { banner } = loadUi({ NO_COLOR: undefined, _forceTTY: true });
  const output = banner();
  // Bold amber at top
  assert.ok(output.includes('\x1b[1;33m'), 'should contain bold amber');
  // Amber in middle
  assert.ok(output.includes('\x1b[33m'), 'should contain amber');
  // Bold red at transition
  assert.ok(output.includes('\x1b[1;31m'), 'should contain bold red');
  // Red in lower section
  assert.ok(output.includes('\x1b[31m'), 'should contain red');
  // Dim red at bottom
  assert.ok(output.includes('\x1b[2;31m'), 'should contain dim red');
});

it('banner tagline says "development" not "warfare"', () => {
  const { banner } = loadUi({ NO_COLOR: '1', _forceTTY: true });
  const output = banner();
  assert.ok(output.includes('Adversarial multi-agent development for Claude Code'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --test-name-pattern="banner uses gradient|banner tagline says"`
Expected: FAIL — current banner uses only `boldAmber` and `boldRed`, no gradient. Tagline says "warfare".

- [ ] **Step 3: Add `dimRed` color and rewrite `banner()` with gradient**

In `src/ui.js`, add `dimRed` to the colors object:

```javascript
const colors = {
  amber: wrap('33'),
  green: wrap('32'),
  red: wrap('31'),
  dim: wrap('90'),
  bold: wrap('1'),
  boldAmber: wrap('1;33'),
  boldRed: wrap('1;31'),
  dimRed: wrap('2;31'),
};
```

Replace the `banner()` function:

```javascript
function banner() {
  const { amber, boldAmber, boldRed, red, dimRed, dim } = colors;
  const rule = amber('  \u2694 \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 \u2694');

  const claudeArt = [
    '     \u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557      \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557   \u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557',
    '    \u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u2588\u2588\u2551     \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d',
    '    \u2588\u2588\u2551     \u2588\u2588\u2551     \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557  ',
    '    \u2588\u2588\u2551     \u2588\u2588\u2551     \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255d  ',
    '    \u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551  \u2588\u2588\u2551\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557',
    '     \u255a\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d',
  ];

  const raidArt = [
    '              \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557 ',
    '              \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557',
    '              \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551',
    '              \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551',
    '              \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d',
    '              \u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u255d ',
  ];

  const tagline = '      Adversarial multi-agent development for Claude Code';

  // Gradient: bold amber → amber → bold red → red → dim red
  const gradient = [
    boldAmber,  // claudeArt[0]
    boldAmber,  // claudeArt[1]
    amber,      // claudeArt[2]
    amber,      // claudeArt[3]
    amber,      // claudeArt[4]
    boldRed,    // claudeArt[5]
    boldRed,    // raidArt[0]
    boldRed,    // raidArt[1]
    red,        // raidArt[2]
    red,        // raidArt[3]
    red,        // raidArt[4]
    dimRed,     // raidArt[5]
  ];

  const artLines = [...claudeArt, ...raidArt];
  const coloredArt = artLines.map((line, i) => gradient[i](line));

  const lines = [
    '',
    rule,
    '',
    ...coloredArt,
    '',
    dim(tagline),
    '',
    rule,
    '',
  ];

  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --test-name-pattern="banner"`
Expected: All banner tests PASS (including existing ones — block characters and tagline).

- [ ] **Step 5: Visually verify the gradient in the terminal**

Run: `node -e "require('./src/ui').banner()" | head -20` — should not work since `banner()` returns a string. Instead:

Run: `node -e "console.log(require('./src/ui').banner())"`
Expected: Smooth amber-to-red gradient visible in terminal.

- [ ] **Step 6: Commit**

```bash
git add src/ui.js tests/cli/ui.test.js
git commit -m "feat(ui): redesign banner with amber-to-red gradient

Applies a 5-tone vertical gradient: bold amber → amber → bold red →
red → dim red. Updates tagline to 'development' from 'warfare'."
```

---

### Task 2: Create descriptions map in `src/descriptions.js`

**Files:**
- Create: `src/descriptions.js`
- Test: `tests/cli/descriptions.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { AGENTS, HOOKS, SKILLS, CONFIG } = require('../../src/descriptions');

describe('descriptions', () => {
  it('exports AGENTS with 4 entries', () => {
    assert.strictEqual(Object.keys(AGENTS).length, 4);
    assert.ok(AGENTS['wizard.md']);
    assert.ok(AGENTS['warrior.md']);
    assert.ok(AGENTS['archer.md']);
    assert.ok(AGENTS['rogue.md']);
  });

  it('exports HOOKS split into lifecycle and gates', () => {
    assert.ok(Array.isArray(HOOKS.lifecycle));
    assert.ok(Array.isArray(HOOKS.gates));
    assert.ok(HOOKS.lifecycle.length > 0);
    assert.ok(HOOKS.gates.length > 0);
    // Each entry has name and desc
    for (const h of [...HOOKS.lifecycle, ...HOOKS.gates]) {
      assert.ok(h.name, 'hook should have name');
      assert.ok(h.desc, 'hook should have desc');
    }
  });

  it('exports SKILLS with 13 entries', () => {
    assert.strictEqual(Object.keys(SKILLS).length, 13);
    assert.ok(SKILLS['raid-protocol']);
    assert.ok(SKILLS['raid-tdd']);
  });

  it('exports CONFIG with 3 entries', () => {
    assert.strictEqual(Object.keys(CONFIG).length, 3);
    assert.ok(CONFIG['raid.json']);
    assert.ok(CONFIG['raid-rules.md']);
    assert.ok(CONFIG['settings.json']);
  });

  it('all descriptions are non-empty strings under 80 chars', () => {
    const allDescs = [
      ...Object.values(AGENTS),
      ...HOOKS.lifecycle.map(h => h.desc),
      ...HOOKS.gates.map(h => h.desc),
      ...Object.values(SKILLS),
      ...Object.values(CONFIG),
    ];
    for (const d of allDescs) {
      assert.strictEqual(typeof d, 'string');
      assert.ok(d.length > 0, 'description should not be empty');
      assert.ok(d.length <= 80, `description too long (${d.length}): "${d}"`);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="descriptions"`
Expected: FAIL — `Cannot find module '../../src/descriptions'`

- [ ] **Step 3: Create `src/descriptions.js`**

```javascript
'use strict';

// Single source of truth for file descriptions used by dry-run and install output.
// Keep descriptions under 80 chars — they appear in terminal columns.

const AGENTS = {
  'wizard.md':  'Dungeon master — opens phases, dispatches team, closes with rulings',
  'warrior.md': 'Stress-tester — breaks things under load, edge cases, pressure',
  'archer.md':  'Pattern-seeker — traces ripple effects, naming drift, contract violations',
  'rogue.md':   'Assumption-destroyer — thinks like a failing system, malicious input',
};

const HOOKS = {
  lifecycle: [
    { name: 'raid-lib.sh',            desc: 'Shared config — reads raid.json, exports session state' },
    { name: 'raid-session-start.sh',   desc: 'Activates Raid workflow when session begins' },
    { name: 'raid-session-end.sh',     desc: 'Archives Dungeon, cleans up when session ends' },
    { name: 'raid-stop.sh',           desc: 'Backs up Dungeon on phase transitions' },
    { name: 'raid-pre-compact.sh',    desc: 'Backs up Dungeon before message compaction' },
    { name: 'raid-task-created.sh',   desc: 'Validates task subjects are meaningful' },
    { name: 'raid-task-completed.sh', desc: 'Blocks task completion without test evidence' },
    { name: 'raid-teammate-idle.sh',  desc: 'Nudges idle agents to participate' },
  ],
  gates: [
    { name: 'validate-commit.sh',              desc: 'Enforces conventional commits + test gate' },
    { name: 'validate-write-gate.sh',          desc: 'Blocks implementation before design doc exists' },
    { name: 'validate-file-naming.sh',         desc: 'Enforces naming convention (kebab-case, etc.)' },
    { name: 'validate-no-placeholders.sh',     desc: 'Blocks TBD/TODO in specs and plans' },
    { name: 'validate-dungeon.sh',             desc: 'Requires multi-agent verification on pins' },
    { name: 'validate-browser-tests-exist.sh', desc: 'Checks Playwright tests exist before commits' },
    { name: 'validate-browser-cleanup.sh',     desc: 'Verifies browser processes cleaned up properly' },
  ],
};

const SKILLS = {
  'raid-protocol':            'Session lifecycle and team rules',
  'raid-design':              'Phase 1: adversarial exploration',
  'raid-implementation-plan': 'Phase 2: task decomposition',
  'raid-implementation':      'Phase 3: TDD with direct challenge',
  'raid-review':              'Phase 4: independent review + fighting',
  'raid-finishing':           'Completeness debate + merge options',
  'raid-tdd':                 'RED-GREEN-REFACTOR enforcement',
  'raid-debugging':           'Root-cause investigation',
  'raid-verification':        'Evidence-before-claims gate',
  'raid-git-worktrees':       'Isolated workspace creation',
  'raid-browser':             'Browser startup discovery',
  'raid-browser-playwright':  'Playwright test authoring',
  'raid-browser-chrome':      'Live browser inspection',
};

const CONFIG = {
  'raid.json':      'Project settings (editable)',
  'raid-rules.md':  '17 team rules (editable)',
  'settings.json':  'Hooks merged into existing (backup created)',
};

module.exports = { AGENTS, HOOKS, SKILLS, CONFIG };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --test-name-pattern="descriptions"`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/descriptions.js tests/cli/descriptions.test.js
git commit -m "feat: add file descriptions map for install output

Single source of truth for agent, hook, skill, and config descriptions
used by dry-run preview and phased install output."
```

---

### Task 3: Add `referenceCard()` to `src/ui.js`

**Files:**
- Modify: `src/ui.js` (add `referenceCard()` function and export it)
- Test: `tests/cli/ui.test.js`

- [ ] **Step 1: Write the failing test**

Add to `tests/cli/ui.test.js`:

```javascript
describe('referenceCard', () => {
  it('returns a string with How It Works and Next Step sections', () => {
    const { referenceCard } = loadUi({ NO_COLOR: '1', _forceTTY: true });
    const output = referenceCard();
    assert.ok(output.includes('How It Works'), 'should contain How It Works');
    assert.ok(output.includes('Next Step'), 'should contain Next Step');
  });

  it('contains mode descriptions', () => {
    const { referenceCard } = loadUi({ NO_COLOR: '1', _forceTTY: true });
    const output = referenceCard();
    assert.ok(output.includes('Full Raid'), 'should contain Full Raid');
    assert.ok(output.includes('Skirmish'), 'should contain Skirmish');
    assert.ok(output.includes('Scout'), 'should contain Scout');
  });

  it('contains phase descriptions', () => {
    const { referenceCard } = loadUi({ NO_COLOR: '1', _forceTTY: true });
    const output = referenceCard();
    assert.ok(output.includes('Design'), 'should contain Design');
    assert.ok(output.includes('Plan'), 'should contain Plan');
    assert.ok(output.includes('Implement'), 'should contain Implement');
    assert.ok(output.includes('Review'), 'should contain Review');
  });

  it('contains hook enforcement summary', () => {
    const { referenceCard } = loadUi({ NO_COLOR: '1', _forceTTY: true });
    const output = referenceCard();
    assert.ok(output.includes('design doc'), 'should mention design doc gate');
    assert.ok(output.includes('passing tests'), 'should mention test gate');
  });

  it('contains next step command', () => {
    const { referenceCard } = loadUi({ NO_COLOR: '1', _forceTTY: true });
    const output = referenceCard();
    assert.ok(output.includes('claude --agent wizard'), 'should contain entry command');
  });

  it('contains controls section', () => {
    const { referenceCard } = loadUi({ NO_COLOR: '1', _forceTTY: true });
    const output = referenceCard();
    assert.ok(output.includes('Shift+Down'), 'should contain Shift+Down');
    assert.ok(output.includes('Ctrl+T'), 'should contain Ctrl+T');
  });

  it('contains heal command hint', () => {
    const { referenceCard } = loadUi({ NO_COLOR: '1', _forceTTY: true });
    const output = referenceCard();
    assert.ok(output.includes('claude-raid heal'), 'should mention heal command');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --test-name-pattern="referenceCard"`
Expected: FAIL — `referenceCard` is not exported from `ui.js`.

- [ ] **Step 3: Implement `referenceCard()` in `src/ui.js`**

Add before `module.exports`:

```javascript
function referenceCard() {
  const howItWorks = box('How It Works', [
    '  You describe a task. The Wizard assesses complexity and',
    '  recommends a mode:',
    '',
    '  ' + colors.bold('Full Raid') + '    3 agents attack from competing angles',
    '  ' + colors.bold('Skirmish') + '     2 agents, lighter process',
    '  ' + colors.bold('Scout') + '        1 agent + Wizard review',
    '',
    '  Every task flows through 4 phases:',
    '',
    '  1. ' + colors.bold('Design') + '     Agents explore and challenge the approach',
    '  2. ' + colors.bold('Plan') + '       Agents decompose into testable tasks',
    '  3. ' + colors.bold('Implement') + '  One builds (TDD), others attack',
    '  4. ' + colors.bold('Review') + '     Independent reviews, fight over findings',
    '',
    '  Hooks enforce discipline automatically:',
    '  ' + colors.dim('\u2022') + ' No implementation without a design doc',
    '  ' + colors.dim('\u2022') + ' No commits without passing tests',
    '  ' + colors.dim('\u2022') + ' No completion claims without fresh test evidence',
    '  ' + colors.dim('\u2022') + ' Conventional commit messages required',
    '',
    '  ' + colors.dim('Hooks only activate during Raid sessions \u2014 they won\'t'),
    '  ' + colors.dim('interfere with normal coding outside of a Raid.'),
    '',
    '  Config:  ' + colors.bold('.claude/raid.json') + '       ' + colors.dim('project settings'),
    '  Rules:   ' + colors.bold('.claude/raid-rules.md') + '   ' + colors.dim('editable team rules'),
  ]);

  const nextStep = box('Next Step', [
    '  ' + colors.bold('claude --agent wizard'),
    '',
    '  Describe your task and the Wizard takes over.',
    '  ' + colors.dim('Tip: start with a small task (bugfix, config change) to'),
    '  ' + colors.dim('see the workflow before tackling something complex.'),
    '',
    '  ' + colors.bold('Controls'),
    '  ' + colors.bold('Shift+Down') + '    Cycle through teammates',
    '  ' + colors.bold('Enter') + '         View a teammate\'s session',
    '  ' + colors.bold('Escape') + '        Interrupt a teammate\'s turn',
    '  ' + colors.bold('Ctrl+T') + '        Toggle the shared task list',
    '',
    '  Review this anytime:  ' + colors.bold('claude-raid heal'),
  ]);

  return howItWorks + '\n' + nextStep;
}
```

Add `referenceCard` to `module.exports`:

```javascript
module.exports = { colors, banner, box, header, stripAnsi, referenceCard };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --test-name-pattern="referenceCard"`
Expected: All PASS.

- [ ] **Step 5: Visually verify in terminal**

Run: `node -e "console.log(require('./src/ui').referenceCard())"`
Expected: Two styled boxes with correct content and alignment.

- [ ] **Step 6: Commit**

```bash
git add src/ui.js tests/cli/ui.test.js
git commit -m "feat(ui): add referenceCard for post-install and heal output

Two-box layout: 'How It Works' (modes, phases, hooks) and 'Next Step'
(entry command, controls, heal hint). Shared between summon and heal."
```

---

### Task 4: Add `--dry-run` flag to CLI and implement `dryRun()`

**Files:**
- Modify: `bin/cli.js` (parse `--dry-run` flag)
- Modify: `src/init.js` (add `dryRun()` function, export it)
- Test: `tests/cli/init.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tests/cli/init.test.js`:

```javascript
describe('dryRun', () => {
  it('does not create any files', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
    const output = init.dryRun(cwd);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude')), '.claude should not be created');
    assert.ok(typeof output === 'string', 'should return output string');
  });

  it('includes detected language', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
    const output = init.dryRun(cwd);
    assert.ok(output.includes('javascript'), 'should include detected language');
  });

  it('includes agent descriptions', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const output = init.dryRun(cwd);
    assert.ok(output.includes('wizard.md'), 'should list wizard');
    assert.ok(output.includes('warrior.md'), 'should list warrior');
    assert.ok(output.includes('archer.md'), 'should list archer');
    assert.ok(output.includes('rogue.md'), 'should list rogue');
  });

  it('includes hook descriptions', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const output = init.dryRun(cwd);
    assert.ok(output.includes('validate-commit.sh'), 'should list commit hook');
    assert.ok(output.includes('raid-session-start.sh'), 'should list session start');
  });

  it('includes skill descriptions', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const output = init.dryRun(cwd);
    assert.ok(output.includes('raid-protocol'), 'should list protocol skill');
    assert.ok(output.includes('raid-tdd'), 'should list tdd skill');
  });

  it('notes existing files as preserved', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const agentDir = path.join(cwd, '.claude', 'agents');
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, 'wizard.md'), 'custom');
    const output = init.dryRun(cwd);
    assert.ok(output.includes('preserved') || output.includes('skip'), 'should note preserved files');
  });

  it('ends with install instruction', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const output = init.dryRun(cwd);
    assert.ok(output.includes('Run without --dry-run to install'), 'should end with install hint');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --test-name-pattern="dryRun"`
Expected: FAIL — `init.dryRun is not a function`

- [ ] **Step 3: Implement `dryRun()` in `src/init.js`**

Add at the top of `src/init.js` after existing requires:

```javascript
const { AGENTS, HOOKS, SKILLS, CONFIG } = require('./descriptions');
```

Add the `dryRun` function before `install()`:

```javascript
function dryRun(cwd) {
  const detected = detectProject(cwd);
  const lines = [];
  const { bold, dim, amber } = colors;

  lines.push('');
  lines.push(header('Dry Run') + dim(' — nothing will be written'));
  lines.push('');
  lines.push('  Realm detected: ' + bold(detected.language));
  if (detected.testCommand) lines.push('  Test command:   ' + bold(detected.testCommand));
  if (detected.lintCommand) lines.push('  Lint command:   ' + bold(detected.lintCommand));
  lines.push('');
  lines.push('  Would create/modify:');

  // Check for existing files
  const claudeDir = path.join(cwd, '.claude');
  function exists(rel) {
    return fs.existsSync(path.join(claudeDir, rel));
  }

  // Agents
  lines.push('');
  lines.push('  ' + header('Agents') + dim('                                      4 files'));
  for (const [file, desc] of Object.entries(AGENTS)) {
    const tag = exists(path.join('agents', file)) ? dim(' (preserved)') : '';
    lines.push('    ' + bold(file.padEnd(15)) + dim(desc) + tag);
  }

  // Hooks
  const allHooks = [...HOOKS.lifecycle, ...HOOKS.gates];
  lines.push('');
  lines.push('  ' + header('Hooks') + dim(`                                     ${allHooks.length} files`));
  lines.push('');
  lines.push('    ' + dim('Lifecycle'));
  for (const h of HOOKS.lifecycle) {
    const tag = exists(path.join('hooks', h.name)) ? dim(' (preserved)') : '';
    lines.push('    ' + bold(h.name.padEnd(30)) + dim(h.desc) + tag);
  }
  lines.push('');
  lines.push('    ' + dim('Quality gates'));
  for (const h of HOOKS.gates) {
    const tag = exists(path.join('hooks', h.name)) ? dim(' (preserved)') : '';
    lines.push('    ' + bold(h.name.padEnd(30)) + dim(h.desc) + tag);
  }

  // Skills
  lines.push('');
  const skillCount = Object.keys(SKILLS).length;
  lines.push('  ' + header('Skills') + dim(`                                ${skillCount} folders`));
  for (const [name, desc] of Object.entries(SKILLS)) {
    const tag = exists(path.join('skills', name)) ? dim(' (preserved)') : '';
    lines.push('    ' + bold(name.padEnd(25)) + dim(desc) + tag);
  }

  // Config
  lines.push('');
  lines.push('  ' + header('Config'));
  const configActions = [
    [bold('raid.json'), exists('raid.json') ? dim('preserved (existing config)') : dim(CONFIG['raid.json'])],
    [bold('raid-rules.md'), dim(CONFIG['raid-rules.md'])],
    [bold('settings.json'), dim(CONFIG['settings.json'])],
  ];
  for (const [name, desc] of configActions) {
    lines.push('    ' + name.padEnd(15) + '  ' + desc);
  }

  // .gitignore
  lines.push('');
  lines.push('  ' + dim('.gitignore entries added:'));
  lines.push('    ' + dim('.claude/raid-session, .claude/raid-dungeon*, .claude/vault/.draft/'));

  lines.push('');
  lines.push('  Run without --dry-run to install.');
  lines.push('');

  return lines.join('\n');
}
```

Update `module.exports` at the bottom:

```javascript
module.exports = { install, run, dryRun };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --test-name-pattern="dryRun"`
Expected: All PASS.

- [ ] **Step 5: Wire `--dry-run` in `bin/cli.js`**

In `bin/cli.js`, replace the summon command entry:

```javascript
const COMMANDS = {
  // Primary commands
  summon: () => {
    if (process.argv.includes('--dry-run')) {
      console.log('\n' + banner());
      console.log(require('../src/init').dryRun(process.cwd()));
      return;
    }
    return require('../src/init').run();
  },
  update: () => require('../src/update').run(),
  dismantle: () => require('../src/remove').run(),
  heal: () => require('../src/doctor').run(),
  // Aliases (backward compat)
  init: () => {
    if (process.argv.includes('--dry-run')) {
      console.log('\n' + banner());
      console.log(require('../src/init').dryRun(process.cwd()));
      return;
    }
    return require('../src/init').run();
  },
  remove: () => require('../src/remove').run(),
  doctor: () => require('../src/doctor').run(),
};
```

- [ ] **Step 6: Visually verify dry-run output**

Run: `node bin/cli.js summon --dry-run`
Expected: Full preview output with gradient banner, categorized files, descriptions, no files created.

- [ ] **Step 7: Commit**

```bash
git add bin/cli.js src/init.js tests/cli/init.test.js
git commit -m "feat(cli): add summon --dry-run preview

Shows exactly what would be installed without touching disk. Groups
output into Agents, Hooks (lifecycle + gates), Skills, and Config
with 1-line descriptions per file."
```

---

### Task 5: Restructure `run()` with phased install output

**Files:**
- Modify: `src/init.js:154-178` (rewrite `run()` function)

- [ ] **Step 1: Write the failing test**

Add to `tests/cli/init.test.js`:

```javascript
it('install returns categorized copy counts', () => {
  init = require('../../src/init');
  const cwd = makeTempDir();
  const result = init.install(cwd);
  assert.ok(typeof result.counts === 'object', 'should have counts');
  assert.ok(typeof result.counts.agents === 'number', 'should count agents');
  assert.ok(typeof result.counts.hooks === 'number', 'should count hooks');
  assert.ok(typeof result.counts.skills === 'number', 'should count skills');
  assert.ok(result.counts.agents > 0, 'should have copied agents');
  assert.ok(result.counts.hooks > 0, 'should have copied hooks');
  assert.ok(result.counts.skills > 0, 'should have copied skills');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="categorized copy counts"`
Expected: FAIL — `result.counts` is undefined.

- [ ] **Step 3: Add categorized counts to `install()`**

In the `install()` function, after `copyRecursive(TEMPLATE_DIR, claudeDir, result.skipped)`, add counting logic:

```javascript
  // Count copied files by category
  const agentsDir = path.join(claudeDir, 'agents');
  const hooksDir = path.join(claudeDir, 'hooks');
  const skillsDir = path.join(claudeDir, 'skills');
  result.counts = {
    agents: fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).length : 0,
    hooks: fs.existsSync(hooksDir) ? fs.readdirSync(hooksDir).filter(f => f.endsWith('.sh')).length : 0,
    skills: fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).filter(f => !f.startsWith('.')).length : 0,
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="categorized copy counts"`
Expected: PASS.

- [ ] **Step 5: Rewrite `run()` with phased output**

Replace the `run()` function in `src/init.js`:

```javascript
async function run() {
  const cwd = process.cwd();
  const { bold, dim } = colors;

  console.log('\n' + banner());
  console.log(header('Summoning the Party...') + '\n');

  const result = install(cwd);

  if (result.alreadyInstalled) {
    console.log('  The party is already here. Use ' + bold('claude-raid update') + ' to reforge.');
    console.log('  Proceeding with re-summon...\n');
  }

  // Detection summary
  console.log('  Realm detected: ' + bold(result.detected.language) + );
  if (result.detected.testCommand) {
    console.log('  Test command:   ' + bold(result.detected.testCommand));
  }
  if (result.detected.lintCommand) {
    console.log('  Lint command:   ' + bold(result.detected.lintCommand));
  }

  // Agents
  console.log('');
  console.log('  ' + header('Agents') + dim(`                                      ${result.counts.agents} files`));
  console.log('    Copied wizard.md, warrior.md, archer.md, rogue.md');
  console.log(dim('    AI teammates that challenge each other\'s work from'));
  console.log(dim('    competing angles. Start a session with: claude --agent wizard'));

  // Hooks
  console.log('');
  console.log('  ' + header('Hooks') + dim(`                                     ${result.counts.hooks} files`));
  console.log('    Copied ' + bold(`${HOOKS.lifecycle.length} lifecycle hooks`) + ' + ' + bold(`${HOOKS.gates.length} quality gates`));
  console.log(dim('    Lifecycle hooks manage session state automatically.'));
  console.log(dim('    Quality gates block bad commits, missing tests, and'));
  console.log(dim('    placeholder text \u2014 only active during Raid sessions.'));

  // Skills
  console.log('');
  console.log('  ' + header('Skills') + dim(`                                ${result.counts.skills} folders`));
  const skillNames = Object.keys(SKILLS).join(', ');
  console.log('    ' + dim(skillNames));
  console.log(dim('    Phase-specific workflows that guide agent behavior.'));

  // Config
  console.log('');
  console.log('  ' + header('Config'));
  console.log('    Generated ' + bold('raid.json') + '          ' + dim('Project settings (editable)'));
  console.log('    Copied ' + bold('raid-rules.md') + '         ' + dim('17 team rules (editable)'));
  console.log('    Merged ' + bold('settings.json') + '         ' + dim('Backup at .pre-raid-backup'));

  // Skipped files
  if (result.skipped.length > 0) {
    console.log('');
    console.log('  ' + dim('Preserved existing scrolls:'));
    result.skipped.forEach(f => console.log('    ' + dim('\u2192 ' + path.relative(cwd, f))));
  }

  // Setup wizard
  const { referenceCard } = require('./ui');
  await runSetup();

  // Reference card
  console.log('\n' + referenceCard() + '\n');
}
```

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: All 257+ tests PASS. Existing init tests should still pass since `install()` return shape is backward-compatible (new `counts` field is additive).

- [ ] **Step 7: Visually verify the full summon output**

Run: `node bin/cli.js summon --dry-run` in a test directory (use dry-run to avoid modifying current project).
Expected: Clean phased output with sections, descriptions, breathing room.

- [ ] **Step 8: Commit**

```bash
git add src/init.js tests/cli/init.test.js
git commit -m "feat(cli): restructure summon output into phased sections

Groups install output into Agents, Hooks, Skills, and Config sections
with file counts and plain-language explanations. Adds post-install
reference card with How It Works and Next Step."
```

---

### Task 6: Update `heal` command to use shared reference card

**Files:**
- Modify: `src/doctor.js` (replace 3 boxes with `referenceCard()`)
- Test: `tests/cli/doctor.test.js`

- [ ] **Step 1: Write the failing test**

Add to `tests/cli/doctor.test.js`:

```javascript
it('heal output includes How It Works and Next Step', () => {
  const { referenceCard } = require('../../src/ui');
  const card = referenceCard();
  assert.ok(card.includes('How It Works'), 'referenceCard should have How It Works');
  assert.ok(card.includes('Next Step'), 'referenceCard should have Next Step');
  assert.ok(card.includes('claude --agent wizard'), 'referenceCard should have entry command');
});
```

- [ ] **Step 2: Run test to verify it passes (already passes from Task 3)**

Run: `npm test -- --test-name-pattern="heal output includes"`
Expected: PASS (referenceCard already exists from Task 3).

- [ ] **Step 3: Replace boxes in `src/doctor.js`**

Replace the `run()` function:

```javascript
async function run() {
  const { referenceCard } = require('./ui');

  console.log('\n' + banner());
  console.log(header('Diagnosing Wounds...') + '\n');

  const result = await runSetup();

  if (!result.allOk && !process.stdin.isTTY) {
    process.exitCode = 1;
  }

  console.log('\n' + referenceCard() + '\n');
}
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests PASS. The doctor test that checks `diagnose` still works since it uses `runChecks` directly.

- [ ] **Step 5: Visually verify heal output**

Run: `node bin/cli.js heal`
Expected: Party Status checks followed by the shared reference card (How It Works + Next Step).

- [ ] **Step 6: Commit**

```bash
git add src/doctor.js tests/cli/doctor.test.js
git commit -m "refactor(heal): replace 3 info boxes with shared reference card

Consolidates Quick Start, Controls, and Raid Modes into the shared
How It Works + Next Step reference card from ui.js."
```

---

### Task 7: Final integration verification

**Files:**
- No new files — verification only

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests PASS, no regressions.

- [ ] **Step 2: Verify dry-run output end-to-end**

Run: `node bin/cli.js summon --dry-run`
Expected: Gradient banner, categorized preview, clean alignment, no files touched.

- [ ] **Step 3: Verify heal output end-to-end**

Run: `node bin/cli.js heal`
Expected: Party Status + shared reference card (How It Works + Next Step).

- [ ] **Step 4: Verify the gradient banner renders correctly**

Run: `node -e "console.log(require('./src/ui').banner())"`
Expected: Smooth amber-to-red gradient, "development" tagline.

- [ ] **Step 5: Verify NO_COLOR support**

Run: `NO_COLOR=1 node bin/cli.js summon --dry-run`
Expected: Same content, no ANSI escape codes in output.

- [ ] **Step 6: Commit any fixes, then tag**

If any fixes were needed, commit them. Then verify clean state:

```bash
git status
npm test
```
