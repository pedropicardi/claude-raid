'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let remove, init;
let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-remove-'));
  return tmpDir;
}

describe('remove', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });
  it('removes raid agent files', () => {
    init = require('../../src/init');
    remove = require('../../src/remove');
    const cwd = makeTempDir();
    init.install(cwd);
    remove.performRemove(cwd);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'agents', 'wizard.md')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'agents', 'warrior.md')));
  });

  it('removes raid hooks', () => {
    init = require('../../src/init');
    remove = require('../../src/remove');
    const cwd = makeTempDir();
    init.install(cwd);
    remove.performRemove(cwd);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'hooks', 'validate-file-naming.sh')));
  });

  it('removes raid skills', () => {
    init = require('../../src/init');
    remove = require('../../src/remove');
    const cwd = makeTempDir();
    init.install(cwd);
    remove.performRemove(cwd);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'skills', 'raid-protocol')));
  });

  it('removes raid-rules.md and raid.json', () => {
    init = require('../../src/init');
    remove = require('../../src/remove');
    const cwd = makeTempDir();
    init.install(cwd);
    remove.performRemove(cwd);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-rules.md')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid.json')));
  });

  it('restores settings.json from backup', () => {
    init = require('../../src/init');
    remove = require('../../src/remove');
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), '{"original": true}');
    init.install(cwd);
    remove.performRemove(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
    assert.ok(settings.original);
  });

  it('preserves non-raid files in .claude', () => {
    init = require('../../src/init');
    remove = require('../../src/remove');
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'my-custom-file.md'), 'keep me');
    init.install(cwd);
    remove.performRemove(cwd);
    assert.ok(fs.existsSync(path.join(claudeDir, 'my-custom-file.md')));
  });
});
