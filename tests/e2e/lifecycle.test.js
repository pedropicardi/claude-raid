'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-e2e-'));
  return tmpDir;
}

describe('E2E: init -> update -> remove lifecycle', () => {
  const { afterEach } = require('node:test');
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });
  it('completes the full lifecycle', () => {
    const init = require('../../src/init');
    const update = require('../../src/update');
    const remove = require('../../src/remove');

    const cwd = makeTempDir();

    // Simulate a Node.js project with existing settings
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({
      name: 'test-project',
      scripts: { test: 'echo ok' },
    }));
    fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(cwd, '.claude', 'settings.json'), JSON.stringify({
      env: { CUSTOM: 'value' },
      permissions: { allow: ['Read', 'WebFetch'] },
    }));

    // INIT
    const initResult = init.install(cwd);
    assert.ok(!initResult.alreadyInstalled);
    assert.strictEqual(initResult.detected.language, 'javascript');

    // Verify files exist
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'agents', 'wizard.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'hooks', 'validate-commit.sh')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'hooks', 'raid-lib.sh')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'hooks', 'validate-write-gate.sh')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'hooks', 'validate-dungeon.sh')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'skills', 'raid-protocol', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'raid-rules.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'raid.json')));

    // Verify settings merged correctly
    const settings = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8'));
    assert.strictEqual(settings.env.CUSTOM, 'value');
    assert.strictEqual(settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, '1');
    assert.ok(settings.permissions.allow.includes('WebFetch'));
    assert.ok(settings.permissions.allow.includes('Write'));

    // Verify backup exists
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'settings.json.pre-raid-backup')));

    // UPDATE
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-rules.md'), 'modified by user');
    fs.writeFileSync(path.join(cwd, '.claude', 'raid.json'), '{"custom": "config"}');

    const updateResult = update.performUpdate(cwd);
    assert.ok(updateResult.success);

    // raid-rules.md should be preserved when customized
    const rules = fs.readFileSync(path.join(cwd, '.claude', 'raid-rules.md'), 'utf8');
    assert.strictEqual(rules, 'modified by user');
    assert.ok(updateResult.message.includes('raid-rules.md'));

    // raid.json should NOT be overwritten (user config)
    const config = fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8');
    assert.ok(config.includes('"custom"'));

    // RE-INSTALL should preserve raid.json
    init.install(cwd);
    const configAfterReinstall = fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8');
    assert.ok(configAfterReinstall.includes('"custom"'), 'raid.json should be preserved on re-install');

    // REMOVE
    remove.performRemove(cwd);

    // Raid files gone
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'agents', 'wizard.md')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'hooks', 'validate-commit.sh')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'hooks', 'raid-lib.sh')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'skills', 'raid-protocol')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-rules.md')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid.json')));

    // Empty raid directories cleaned up
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'agents')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'hooks')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'skills')));

    // Settings restored from backup
    const restored = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8'));
    assert.strictEqual(restored.env.CUSTOM, 'value');
    assert.ok(!restored.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS);
  });

  it('handles browser-enabled projects through lifecycle', () => {
    const init = require('../../src/init');
    const update = require('../../src/update');
    const remove = require('../../src/remove');

    const cwd = makeTempDir();

    // Simulate a Next.js project with pnpm
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({
      name: 'test-nextjs',
      scripts: { test: 'echo ok', dev: 'next dev' },
    }));
    fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
    fs.writeFileSync(path.join(cwd, 'next.config.js'), 'module.exports = {}');

    // INIT
    const initResult = init.install(cwd);
    assert.strictEqual(initResult.detected.packageManager, 'pnpm');
    assert.strictEqual(initResult.detected.browser.framework, 'next');

    // Verify raid.json has browser section
    const config = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8'));
    assert.strictEqual(config.browser.enabled, true);
    assert.strictEqual(config.browser.framework, 'next');
    assert.strictEqual(config.browser.devCommand, 'pnpm dev');
    assert.strictEqual(config.project.packageManager, 'pnpm');

    // Verify .env.raid in .gitignore
    const gitignore = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('.env.raid'));

    // Verify browser skills exist
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'skills', 'raid-browser', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'skills', 'raid-browser-playwright', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'skills', 'raid-browser-chrome', 'SKILL.md')));

    // Verify browser hooks exist
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'hooks', 'validate-browser-cleanup.sh')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'hooks', 'validate-browser-tests-exist.sh')));

    // Verify settings has browser hook entries
    const settings = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8'));
    const postBashHook = settings.hooks.PostToolUse.find(e => e.matcher === 'Bash');
    assert.ok(postBashHook, 'Should have Bash PostToolUse matcher');
    assert.ok(postBashHook.hooks.some(h => h.command.includes('validate-browser-cleanup')));

    // UPDATE — remove browser config, verify it gets re-added
    const configPath = path.join(cwd, '.claude', 'raid.json');
    const existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    delete existingConfig.browser;
    fs.writeFileSync(configPath, JSON.stringify(existingConfig));

    update.performUpdate(cwd);

    const updatedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.strictEqual(updatedConfig.browser.enabled, true);
    assert.strictEqual(updatedConfig.browser.framework, 'next');

    // REMOVE
    remove.performRemove(cwd);

    // Browser skills cleaned up
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'skills', 'raid-browser')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'skills', 'raid-browser-playwright')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'skills', 'raid-browser-chrome')));

    // Browser hooks cleaned up
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'hooks', 'validate-browser-cleanup.sh')));

    // Empty directories cleaned up
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'skills')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'hooks')));
  });
});
