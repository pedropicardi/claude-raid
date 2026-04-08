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
