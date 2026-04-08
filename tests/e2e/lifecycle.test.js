'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'raid-e2e-'));
}

describe('E2E: init -> update -> remove lifecycle', () => {
  it('completes the full lifecycle', async () => {
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
    const initResult = await init.install(cwd);
    assert.ok(!initResult.alreadyInstalled);
    assert.strictEqual(initResult.detected.language, 'javascript');

    // Verify files exist
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'agents', 'wizard.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'hooks', 'validate-commit-message.sh')));
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

    const updateResult = await update.performUpdate(cwd);
    assert.ok(updateResult.success);

    // raid-rules.md should be overwritten (template file)
    const rules = fs.readFileSync(path.join(cwd, '.claude', 'raid-rules.md'), 'utf8');
    assert.ok(rules.includes('Raid Team Rules'));

    // raid.json should NOT be overwritten (user config)
    const config = fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8');
    assert.ok(config.includes('"custom"'));

    // REMOVE
    await remove.performRemove(cwd);

    // Raid files gone
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'agents', 'wizard.md')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'hooks', 'validate-commit-message.sh')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'skills', 'raid-protocol')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-rules.md')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid.json')));

    // Settings restored from backup
    const restored = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8'));
    assert.strictEqual(restored.env.CUSTOM, 'value');
    assert.ok(!restored.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS);
  });
});
