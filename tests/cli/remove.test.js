'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let remove, init;

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'raid-remove-'));
}

describe('remove', () => {
  it('removes raid agent files', async () => {
    init = require('../../src/init');
    remove = require('../../src/remove');
    const cwd = makeTempDir();
    await init.install(cwd);
    await remove.performRemove(cwd);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'agents', 'wizard.md')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'agents', 'warrior.md')));
  });

  it('removes raid hooks', async () => {
    init = require('../../src/init');
    remove = require('../../src/remove');
    const cwd = makeTempDir();
    await init.install(cwd);
    await remove.performRemove(cwd);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'hooks', 'validate-file-naming.sh')));
  });

  it('removes raid skills', async () => {
    init = require('../../src/init');
    remove = require('../../src/remove');
    const cwd = makeTempDir();
    await init.install(cwd);
    await remove.performRemove(cwd);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'skills', 'raid-protocol')));
  });

  it('removes raid-rules.md and raid.json', async () => {
    init = require('../../src/init');
    remove = require('../../src/remove');
    const cwd = makeTempDir();
    await init.install(cwd);
    await remove.performRemove(cwd);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-rules.md')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid.json')));
  });

  it('restores settings.json from backup', async () => {
    init = require('../../src/init');
    remove = require('../../src/remove');
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), '{"original": true}');
    await init.install(cwd);
    await remove.performRemove(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
    assert.ok(settings.original);
  });

  it('preserves non-raid files in .claude', async () => {
    init = require('../../src/init');
    remove = require('../../src/remove');
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'my-custom-file.md'), 'keep me');
    await init.install(cwd);
    await remove.performRemove(cwd);
    assert.ok(fs.existsSync(path.join(claudeDir, 'my-custom-file.md')));
  });
});
