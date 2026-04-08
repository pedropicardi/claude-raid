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
    assert.ok(result.message.includes('No party found'));
  });

  it('updates unmodified template files', () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    init.install(cwd);
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

  it('skips customized agent files', () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    init.install(cwd);
    const agentPath = path.join(cwd, '.claude', 'agents', 'wizard.md');
    fs.writeFileSync(agentPath, 'my custom wizard');
    const result = update.performUpdate(cwd);
    assert.ok(result.skippedAgents.includes('wizard.md'));
    const content = fs.readFileSync(agentPath, 'utf8');
    assert.strictEqual(content, 'my custom wizard');
  });

  it('skips customized raid-rules.md', () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    init.install(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-rules.md'), 'my custom rules');
    const result = update.performUpdate(cwd);
    assert.strictEqual(result.success, true);
    assert.ok(result.message.includes('raid-rules.md'));
    const content = fs.readFileSync(path.join(cwd, '.claude', 'raid-rules.md'), 'utf8');
    assert.strictEqual(content, 'my custom rules');
  });
});
