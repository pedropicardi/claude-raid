'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let update, init;
let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-update-'));
  return tmpDir;
}

describe('update', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });
  it('fails if Raid is not installed', () => {
    update = require('../../src/update');
    const cwd = makeTempDir();
    const result = update.performUpdate(cwd);
    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('not installed'));
  });

  it('updates template files', () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    init.install(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-rules.md'), 'old content');
    const result = update.performUpdate(cwd);
    assert.strictEqual(result.success, true);
    const content = fs.readFileSync(path.join(cwd, '.claude', 'raid-rules.md'), 'utf8');
    assert.ok(content.includes('Raid Team Rules'));
  });

  it('does not touch raid.json', () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    init.install(cwd);
    const configPath = path.join(cwd, '.claude', 'raid.json');
    fs.writeFileSync(configPath, '{"custom": true}');
    update.performUpdate(cwd);
    const content = fs.readFileSync(configPath, 'utf8');
    assert.ok(content.includes('"custom"'));
  });
});
