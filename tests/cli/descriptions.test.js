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
    for (const h of [...HOOKS.lifecycle, ...HOOKS.gates]) {
      assert.ok(h.name, 'hook should have name');
      assert.ok(h.desc, 'hook should have desc');
    }
  });

  it('exports SKILLS with 13 entries', () => {
    assert.strictEqual(Object.keys(SKILLS).length, 13);
    assert.ok(SKILLS['raid-canonical-protocol']);
    assert.ok(SKILLS['raid-tdd']);
    assert.ok(SKILLS['raid-init']);
    assert.ok(SKILLS['raid-canonical-prd']);
    assert.ok(SKILLS['raid-wrap-up']);
  });

  it('exports CONFIG with 4 entries', () => {
    assert.strictEqual(Object.keys(CONFIG).length, 4);
    assert.ok(CONFIG['raid.json']);
    assert.ok(CONFIG['party-rules.md']);
    assert.ok(CONFIG['dungeon-master-rules.md']);
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
