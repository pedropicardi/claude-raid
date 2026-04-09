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
