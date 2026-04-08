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

  it('removes raid entries from .gitignore', () => {
    init = require('../../src/init');
    remove = require('../../src/remove');
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, '.gitignore'), 'node_modules\n');
    init.install(cwd);
    const beforeContent = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8');
    assert.ok(beforeContent.includes('.claude/raid-last-test-run'));
    remove.performRemove(cwd);
    const afterContent = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8');
    assert.ok(!afterContent.includes('.claude/raid-last-test-run'));
    assert.ok(!afterContent.includes('.claude/raid-session'));
    assert.ok(afterContent.includes('node_modules'));
  });

  it('removes raid-session file', () => {
    init = require('../../src/init');
    remove = require('../../src/remove');
    const cwd = makeTempDir();
    init.install(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), 'active');
    remove.performRemove(cwd);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-session')));
  });

  it('cleans up empty raid directories', () => {
    init = require('../../src/init');
    remove = require('../../src/remove');
    const cwd = makeTempDir();
    init.install(cwd);
    remove.performRemove(cwd);
    // Raid-only directories should be removed when empty
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'agents')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'hooks')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'skills')));
    // .claude itself should still exist (may contain user files)
    assert.ok(fs.existsSync(path.join(cwd, '.claude')));
  });

  it('cleans up Dungeon files', () => {
    remove = require('../../src/remove');
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'raid-rules.md'), 'rules');
    fs.writeFileSync(path.join(claudeDir, 'raid-dungeon.md'), '# Dungeon');
    fs.writeFileSync(path.join(claudeDir, 'raid-dungeon-phase-1.md'), '# Phase 1');
    fs.writeFileSync(path.join(claudeDir, 'raid-dungeon-phase-2.md'), '# Phase 2');
    remove.performRemove(cwd);
    assert.ok(!fs.existsSync(path.join(claudeDir, 'raid-dungeon.md')), 'Should remove active Dungeon');
    assert.ok(!fs.existsSync(path.join(claudeDir, 'raid-dungeon-phase-1.md')), 'Should remove archived Dungeon');
    assert.ok(!fs.existsSync(path.join(claudeDir, 'raid-dungeon-phase-2.md')), 'Should remove archived Dungeon');
  });

  it('preserves non-empty directories after remove', () => {
    init = require('../../src/init');
    remove = require('../../src/remove');
    const cwd = makeTempDir();
    init.install(cwd);
    // Add a user file to agents dir
    fs.writeFileSync(path.join(cwd, '.claude', 'agents', 'my-agent.md'), 'custom');
    remove.performRemove(cwd);
    // agents/ should remain because it has a user file
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'agents')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'agents', 'my-agent.md')));
  });
});
