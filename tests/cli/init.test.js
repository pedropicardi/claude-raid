'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let init;

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'raid-init-'));
}

describe('init', () => {
  it('creates .claude directory if absent', async () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    await init.install(cwd);
    assert.ok(fs.existsSync(path.join(cwd, '.claude')));
  });

  it('copies agent files', async () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    await init.install(cwd);
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'agents', 'wizard.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'agents', 'warrior.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'agents', 'archer.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'agents', 'rogue.md')));
  });

  it('copies hook files and makes them executable', async () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    await init.install(cwd);
    const hookPath = path.join(cwd, '.claude', 'hooks', 'validate-file-naming.sh');
    assert.ok(fs.existsSync(hookPath));
    const stats = fs.statSync(hookPath);
    assert.ok(stats.mode & 0o111, 'Hook should be executable');
  });

  it('copies skill files', async () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    await init.install(cwd);
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'skills', 'raid-protocol', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'skills', 'raid-tdd', 'SKILL.md')));
  });

  it('copies raid-rules.md', async () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    await init.install(cwd);
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'raid-rules.md')));
  });

  it('generates raid.json', async () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
    await init.install(cwd);
    const config = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8'));
    assert.strictEqual(config.project.language, 'javascript');
    assert.strictEqual(config.project.testCommand, 'npm test');
  });

  it('merges settings.json', async () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    await init.install(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8'));
    assert.strictEqual(settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, '1');
  });

  it('does not overwrite existing agent files', async () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const agentDir = path.join(cwd, '.claude', 'agents');
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, 'wizard.md'), 'custom wizard');
    const result = await init.install(cwd);
    const content = fs.readFileSync(path.join(agentDir, 'wizard.md'), 'utf8');
    assert.strictEqual(content, 'custom wizard');
    assert.ok(result.skipped.length > 0);
  });

  it('detects existing raid installation', async () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'raid-rules.md'), '# Rules');
    const result = await init.install(cwd);
    assert.ok(result.alreadyInstalled);
  });
});
