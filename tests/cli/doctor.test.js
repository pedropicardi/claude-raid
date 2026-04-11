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

  it('heal output includes How It Works and Next Step', () => {
    const { referenceCard } = require('../../src/ui');
    const card = referenceCard();
    assert.ok(card.includes('How It Works'), 'referenceCard should have How It Works');
    assert.ok(card.includes('Next Step'), 'referenceCard should have Next Step');
    assert.ok(card.includes('claude-raid start'), 'referenceCard should have entry command');
  });

  it('checks include all eight IDs', () => {
    const home = makeTempDir();
    const result = runChecks({ homedir: home, exec: () => null });
    const ids = result.checks.map(c => c.id);
    assert.deepStrictEqual(ids, ['platform', 'node', 'claude', 'jq', 'teammate-mode', 'split-pane', 'playwright', 'rtk']);
  });
});
