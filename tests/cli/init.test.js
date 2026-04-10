'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let init;
let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-init-'));
  return tmpDir;
}

describe('init', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });
  it('creates .claude directory if absent', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    init.install(cwd);
    assert.ok(fs.existsSync(path.join(cwd, '.claude')));
  });

  it('copies agent files', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    init.install(cwd);
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'agents', 'wizard.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'agents', 'warrior.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'agents', 'archer.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'agents', 'rogue.md')));
  });

  it('copies hook files and makes them executable', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    init.install(cwd);
    const hookPath = path.join(cwd, '.claude', 'hooks', 'validate-file-naming.sh');
    assert.ok(fs.existsSync(hookPath));
    const stats = fs.statSync(hookPath);
    assert.ok(stats.mode & 0o111, 'Hook should be executable');
  });

  it('copies skill files', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    init.install(cwd);
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'skills', 'raid-canonical-protocol', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'skills', 'raid-tdd', 'SKILL.md')));
  });

  it('copies party-rules.md and dungeon-master-rules.md', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    init.install(cwd);
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'party-rules.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'dungeon-master-rules.md')));
  });

  it('generates raid.json', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
    init.install(cwd);
    const config = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8'));
    assert.strictEqual(config.project.language, 'javascript');
    assert.strictEqual(config.project.testCommand, 'npm test');
  });

  it('merges settings.json', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    init.install(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8'));
    assert.strictEqual(settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, '1');
  });

  it('does not overwrite existing agent files', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const agentDir = path.join(cwd, '.claude', 'agents');
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, 'wizard.md'), 'custom wizard');
    const result = init.install(cwd);
    const content = fs.readFileSync(path.join(agentDir, 'wizard.md'), 'utf8');
    assert.strictEqual(content, 'custom wizard');
    assert.ok(result.skipped.length > 0);
  });

  it('detects existing raid installation', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'party-rules.md'), '# Rules');
    const result = init.install(cwd);
    assert.ok(result.alreadyInstalled);
  });

  it('adds Dungeon directory to .gitignore', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    init.install(cwd);
    const gitignore = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('.claude/dungeon/'), 'Should include .claude/dungeon/');
  });

  it('install returns result without running setup (setup is async in run())', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const result = init.install(cwd);
    assert.ok(result.detected);
    assert.ok(!result.setupResult);
  });

  it('does not overwrite existing raid.json on re-install', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    init.install(cwd);
    const configPath = path.join(cwd, '.claude', 'raid.json');
    fs.writeFileSync(configPath, '{"custom": "user-config"}');
    init.install(cwd);
    const content = fs.readFileSync(configPath, 'utf8');
    assert.ok(content.includes('"custom"'));
  });

  it('generates raid.json with packageManager fields', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
    fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
    init.install(cwd);
    const config = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8'));
    assert.strictEqual(config.project.packageManager, 'pnpm');
    assert.strictEqual(config.project.runCommand, 'pnpm');
    assert.strictEqual(config.project.execCommand, 'pnpm dlx');
    assert.strictEqual(config.project.installCommand, 'pnpm add');
  });

  it('generates raid.json with browser section when framework detected', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'vitest' } }));
    fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
    fs.writeFileSync(path.join(cwd, 'next.config.js'), 'module.exports = {}');
    init.install(cwd);
    const config = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8'));
    assert.strictEqual(config.browser.enabled, true);
    assert.strictEqual(config.browser.framework, 'next');
    assert.strictEqual(config.browser.devCommand, 'pnpm dev');
    assert.strictEqual(config.browser.defaultPort, 3000);
    assert.strictEqual(config.browser.baseUrl, 'http://localhost:3000');
    assert.deepStrictEqual(config.browser.portRange, [3001, 3005]);
    assert.strictEqual(config.browser.playwrightConfig, 'playwright.config.ts');
    assert.strictEqual(config.browser.auth, null);
    assert.strictEqual(config.browser.startup, null);
  });

  it('omits browser section when no framework detected', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
    init.install(cwd);
    const config = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8'));
    assert.strictEqual(config.browser, undefined);
  });

  it('generates raid.json with vault and lifecycle config', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    init.install(cwd);
    const config = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8'));
    assert.ok(config.raid.vault, 'vault section should exist');
    assert.strictEqual(config.raid.vault.enabled, true);
    assert.strictEqual(config.raid.vault.path, '.claude/vault');
    assert.ok(config.raid.lifecycle, 'lifecycle section should exist');
    assert.strictEqual(config.raid.lifecycle.autoSessionManagement, true);
    assert.strictEqual(config.raid.lifecycle.testWindowMinutes, 10);
  });

  it('adds .env.raid to .gitignore', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    init.install(cwd);
    const gitignore = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('.env.raid'));
  });

  it('install returns categorized copy counts', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const result = init.install(cwd);
    assert.ok(typeof result.counts === 'object', 'should have counts');
    assert.ok(typeof result.counts.agents === 'number', 'should count agents');
    assert.ok(typeof result.counts.hooks === 'number', 'should count hooks');
    assert.ok(typeof result.counts.skills === 'number', 'should count skills');
    assert.ok(result.counts.agents > 0, 'should have copied agents');
    assert.ok(result.counts.hooks > 0, 'should have copied hooks');
    assert.ok(result.counts.skills > 0, 'should have copied skills');
  });

  it('writes rtk section to raid.json when rtkEnabled option is true', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    init.install(cwd, { rtkEnabled: true });
    const config = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8'));
    assert.ok(config.rtk, 'raid.json should have rtk section');
    assert.strictEqual(config.rtk.enabled, true);
    assert.deepStrictEqual(config.rtk.bypass.phases, []);
    assert.deepStrictEqual(config.rtk.bypass.commands, []);
  });

  it('does not write rtk section to raid.json without rtkEnabled option', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    init.install(cwd);
    const config = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8'));
    assert.strictEqual(config.rtk, undefined, 'raid.json should not have rtk section');
  });

  it('does not duplicate .gitignore entries when comment contains entry substring', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    // Create .gitignore with a comment that contains the substring "raid-session"
    fs.writeFileSync(path.join(cwd, '.gitignore'), '# ignore raid-session related files\n');
    init.install(cwd);
    const gitignore = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8');
    const lines = gitignore.split('\n').filter(l => l.trim() === '.claude/raid-session');
    assert.strictEqual(lines.length, 1, 'Should add the actual entry even when comment contains substring');
  });
});

describe('dryRun', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('does not create any files', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
    const output = init.dryRun(cwd);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude')), '.claude should not be created');
    assert.ok(typeof output === 'string', 'should return output string');
  });

  it('includes detected language', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
    const output = init.dryRun(cwd);
    assert.ok(output.includes('javascript'), 'should include detected language');
  });

  it('includes agent descriptions', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const output = init.dryRun(cwd);
    assert.ok(output.includes('wizard.md'), 'should list wizard');
    assert.ok(output.includes('warrior.md'), 'should list warrior');
    assert.ok(output.includes('archer.md'), 'should list archer');
    assert.ok(output.includes('rogue.md'), 'should list rogue');
  });

  it('includes hook descriptions', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const output = init.dryRun(cwd);
    assert.ok(output.includes('validate-commit.sh'), 'should list commit hook');
    assert.ok(output.includes('raid-session-start.sh'), 'should list session start');
  });

  it('includes skill descriptions', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const output = init.dryRun(cwd);
    assert.ok(output.includes('raid-canonical-protocol'), 'should list protocol skill');
    assert.ok(output.includes('raid-tdd'), 'should list tdd skill');
  });

  it('notes existing files as preserved', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const agentDir = path.join(cwd, '.claude', 'agents');
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, 'wizard.md'), 'custom');
    const output = init.dryRun(cwd);
    assert.ok(output.includes('preserved') || output.includes('skip'), 'should note preserved files');
  });

  it('ends with install instruction', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const output = init.dryRun(cwd);
    assert.ok(output.includes('Run without --dry-run to install'), 'should end with install hint');
  });

  it('dry run shows RTK optional hooks section', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    const output = init.dryRun(cwd);
    assert.ok(output.includes('rtk-bridge.sh'), 'dry run should mention rtk-bridge.sh');
  });
});
