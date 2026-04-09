'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let mergeSettings;
let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-merge-'));
  return tmpDir;
}

describe('mergeSettings', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });
  it('creates new settings.json when none exists', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
    mergeSettings(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8'));
    assert.strictEqual(settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, '1');
    assert.ok(settings.permissions.allow.includes('Read'));
    assert.ok(settings.hooks.PostToolUse.length > 0);
  });

  it('backs up existing settings.json', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), '{"existing": true}');
    mergeSettings(cwd);
    assert.ok(fs.existsSync(path.join(claudeDir, 'settings.json.pre-raid-backup')));
  });

  it('preserves existing env vars', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({
      env: { MY_VAR: 'hello' },
    }));
    mergeSettings(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
    assert.strictEqual(settings.env.MY_VAR, 'hello');
    assert.strictEqual(settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, '1');
  });

  it('unions permissions without duplicates', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({
      permissions: { allow: ['Read', 'WebFetch'] },
    }));
    mergeSettings(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
    assert.ok(settings.permissions.allow.includes('WebFetch'));
    assert.ok(settings.permissions.allow.includes('Read'));
    assert.ok(settings.permissions.allow.includes('Write'));
    const readCount = settings.permissions.allow.filter(p => p === 'Read').length;
    assert.strictEqual(readCount, 1);
  });

  it('appends raid hooks to existing hooks', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({
      hooks: {
        PostToolUse: [
          { matcher: 'Write', hooks: [{ type: 'command', command: 'echo existing' }] },
        ],
      },
    }));
    mergeSettings(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
    assert.ok(settings.hooks.PostToolUse.some(h =>
      h.hooks && h.hooks.some(hh => hh.command === 'echo existing')
    ));
    assert.ok(settings.hooks.PostToolUse.some(h =>
      h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('validate-file-naming'))
    ));
  });

  it('is idempotent — no double entries on second run', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    mergeSettings(cwd);
    mergeSettings(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
    const raidHooks = settings.hooks.PostToolUse.filter(h =>
      h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('validate-'))
    );
    assert.strictEqual(raidHooks.length, 2);
  });

  it('throws on invalid JSON in existing settings.json', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), '{invalid json,}');
    assert.throws(() => mergeSettings(cwd), /invalid JSON/);
  });

  it('wires Bash PreToolUse hooks including bash-writes gate', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
    mergeSettings(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8'));
    const bashEntry = settings.hooks.PreToolUse.find(e => e.matcher === 'Bash');
    assert.ok(bashEntry, 'should have a Bash matcher in PreToolUse');
    assert.strictEqual(bashEntry.hooks.length, 3, 'Bash matcher should have 3 hooks');
    assert.ok(bashEntry.hooks[0].command.includes('validate-bash-writes.sh'));
    assert.ok(bashEntry.hooks[1].command.includes('validate-commit.sh'));
    assert.ok(bashEntry.hooks[2].command.includes('validate-browser-tests-exist.sh'));
  });

  it('wires validate-write-gate.sh as Write|Edit PreToolUse hook', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
    mergeSettings(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8'));
    const writeEntry = settings.hooks.PreToolUse.find(e => e.matcher === 'Write|Edit');
    assert.ok(writeEntry, 'should have a Write|Edit matcher in PreToolUse');
    assert.ok(writeEntry.hooks.some(h => h.command.includes('validate-write-gate.sh')));
  });

  it('wires validate-dungeon.sh in PostToolUse', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
    mergeSettings(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8'));
    assert.ok(settings.hooks.PostToolUse.some(e =>
      e.hooks && e.hooks.some(h => h.command && h.command.includes('validate-dungeon.sh'))
    ));
  });

  it('does not wire old removed hooks', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
    mergeSettings(cwd);
    const json = fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8');
    assert.ok(!json.includes('validate-commit-message.sh'), 'should not contain validate-commit-message.sh');
    assert.ok(!json.includes('validate-tests-pass.sh'), 'should not contain validate-tests-pass.sh');
    assert.ok(!json.includes('validate-verification.sh'), 'should not contain validate-verification.sh');
    assert.ok(!json.includes('validate-phase-gate.sh'), 'should not contain validate-phase-gate.sh');
  });

  it('registers lifecycle hook events', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
    mergeSettings(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8'));
    const events = Object.keys(settings.hooks);
    for (const evt of ['SessionStart', 'SessionEnd', 'TeammateIdle', 'TaskCreated', 'TaskCompleted', 'Stop', 'PreCompact']) {
      assert.ok(events.includes(evt), `Missing hook event: ${evt}`);
    }
  });

  it('removeRaidSettings surgically removes raid entries when no backup exists', () => {
    const { removeRaidSettings } = require('../../src/merge-settings');
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    mergeSettings(cwd);
    // Delete the backup to force surgical removal path
    const backupPath = path.join(claudeDir, 'settings.json.pre-raid-backup');
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    removeRaidSettings(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
    assert.strictEqual(settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, undefined);
    assert.ok(!settings.hooks || Object.keys(settings.hooks).length === 0);
  });

  it('removeRaidSettings throws on invalid JSON when no backup exists', () => {
    const { removeRaidSettings } = require('../../src/merge-settings');
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), '{corrupt}');
    assert.throws(() => removeRaidSettings(cwd), /invalid JSON/);
  });

  it('handles non-array hook values without crashing', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({
      hooks: {
        PostToolUse: 'not-an-array',
        PreToolUse: { bad: 'object' },
      },
    }));
    // Should not throw — should replace with valid arrays
    mergeSettings(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
    assert.ok(Array.isArray(settings.hooks.PostToolUse));
    assert.ok(Array.isArray(settings.hooks.PreToolUse));
  });

  it('preserves non-raid hooks when merging', () => {
    mergeSettings = require('../../src/merge-settings').mergeSettings;
    const cwd = makeTempDir();
    const claudeDir = path.join(cwd, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    const customHook = { matcher: 'Write', hooks: [{ type: 'command', command: 'echo my-custom-hook' }] };
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({
      hooks: { PostToolUse: [customHook] },
    }));
    mergeSettings(cwd);
    mergeSettings(cwd); // Run twice to test idempotency
    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
    const customSurvived = settings.hooks.PostToolUse.some(h =>
      h.hooks && h.hooks.some(hh => hh.command === 'echo my-custom-hook')
    );
    assert.ok(customSurvived, 'Non-raid hooks must survive merge');
  });
});
