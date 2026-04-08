'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let update, init;

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'raid-update-'));
}

describe('update', () => {
  it('fails if Raid is not installed', async () => {
    update = require('../../src/update');
    const cwd = makeTempDir();
    const result = await update.performUpdate(cwd);
    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('not installed'));
  });

  it('updates template files', async () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    await init.install(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-rules.md'), 'old content');
    const result = await update.performUpdate(cwd);
    assert.strictEqual(result.success, true);
    const content = fs.readFileSync(path.join(cwd, '.claude', 'raid-rules.md'), 'utf8');
    assert.ok(content.includes('Raid Team Rules'));
  });

  it('does not touch raid.json', async () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    await init.install(cwd);
    const configPath = path.join(cwd, '.claude', 'raid.json');
    fs.writeFileSync(configPath, '{"custom": true}');
    await update.performUpdate(cwd);
    const content = fs.readFileSync(configPath, 'utf8');
    assert.ok(content.includes('"custom"'));
  });
});
