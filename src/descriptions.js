'use strict';

// Single source of truth for file descriptions used by dry-run and install output.
// Keep descriptions under 80 chars — they appear in terminal columns.

const AGENTS = {
  'wizard.md':  'Dungeon Master — opens phases, dispatches team, closes with rulings',
  'warrior.md': 'Stress-tester — tests boundaries, load, edge cases, failure modes',
  'archer.md':  'Pattern-seeker — ripple effects, naming drift, contract violations, dependencies',
  'rogue.md':   'Assumption-destroyer — failing systems, malicious input, race conditions',
};

const HOOKS = {
  lifecycle: [
    { name: 'raid-lib.sh',            desc: 'Shared config — reads raid.json, exports quest state' },
    { name: 'raid-session-start.sh',   desc: 'Activates Raid workflow, creates quest directory' },
    { name: 'raid-session-end.sh',     desc: 'Archives quest dungeon to vault, cleans up' },
    { name: 'raid-pre-compact.sh',    desc: 'Backs up Dungeon before message compaction' },
    { name: 'raid-task-created.sh',   desc: 'Validates task subjects are meaningful' },
  ],
  gates: [
    { name: 'validate-commit.sh',              desc: 'Enforces conventional commit format' },
    { name: 'validate-write-gate.sh',          desc: 'Protects raid-session file, allows quest dir writes' },
    { name: 'validate-file-naming.sh',         desc: 'Enforces naming convention (kebab-case, etc.)' },
    { name: 'validate-no-placeholders.sh',     desc: 'Blocks TBD/TODO in specs, plans, and quest docs' },
    { name: 'validate-dungeon.sh',             desc: 'Validates dungeon entries and black cards' },
    { name: 'validate-browser-tests-exist.sh', desc: 'Checks Playwright tests exist before commits' },
    { name: 'validate-browser-cleanup.sh',     desc: 'Verifies browser processes cleaned up properly' },
  ],
  optional: [
    { name: 'rtk-bridge.sh', desc: 'Token compression via RTK (optional, opt-in)' },
  ],
};

const SKILLS = {
  // Core
  'raid-init':                            'Quest selection, greeting, raid initialization',
  // Canonical Quest chain
  'raid-canonical-protocol':              'Canonical Quest protocol and rules',
  'raid-canonical-prd':                   'Phase 1: PRD creation (optional)',
  'raid-canonical-design':                'Phase 2: adversarial design exploration',
  'raid-canonical-implementation-plan':   'Phase 3: task decomposition',
  'raid-canonical-implementation':        'Phase 4: TDD with cross-testing',
  'raid-canonical-review':                'Phase 5: pinning + fixing + black cards',
  'raid-wrap-up':                         'Phase 6: storyboard, PR, vault archival',
  // Reusable (quest-agnostic)
  'raid-tdd':                             'RED-GREEN-REFACTOR enforcement',
  'raid-verification':                    'Evidence-before-claims gate',
  'raid-debugging':                       'Root-cause investigation',
  'raid-browser':                         'Browser startup discovery',
  'raid-browser-chrome':                  'Live browser inspection',
  'raid-teambuff':                        'Emergency team retrospective + rulings',
};

const CONFIG = {
  'raid.json':                'Project settings (editable)',
  'party-rules.md':           'Party agent rules (editable)',
  'dungeon-master-rules.md':  'Wizard rules (editable)',
  'settings.json':            'Hooks merged into existing (backup created)',
};

module.exports = { AGENTS, HOOKS, SKILLS, CONFIG };
