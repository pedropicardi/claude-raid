'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

let tmpDir;

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-lifecycle-'));
  const hooksDir = path.join(tmpDir, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  const templateHooks = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks');
  for (const f of fs.readdirSync(templateHooks)) {
    fs.copyFileSync(path.join(templateHooks, f), path.join(hooksDir, f));
    fs.chmodSync(path.join(hooksDir, f), 0o755);
  }
  return tmpDir;
}

function runHook(hookName, stdinObj, cwd) {
  const stdinStr = JSON.stringify(stdinObj);
  try {
    const stdout = execSync(
      `printf '%s' '${stdinStr.replace(/'/g, "'\\''")}' | bash .claude/hooks/${hookName}`,
      { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    return { exitCode: err.status, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

function writeRaidConfig(cwd, raidOverrides = {}) {
  const config = {
    project: { testCommand: 'echo ok' },
    paths: { specs: 'docs/raid/specs', plans: 'docs/raid/plans' },
    conventions: { fileNaming: 'none' },
    raid: {
      defaultMode: 'full',
      vault: { path: '.claude/vault', enabled: true },
      lifecycle: {
        autoSessionManagement: true,
        teammateNudge: true,
        taskValidation: true,
        completionGate: true,
        phaseTransitionConfirm: true,
        compactBackup: true,
        testWindowMinutes: 10,
      },
      ...raidOverrides,
    },
  };
  fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.claude', 'raid.json'), JSON.stringify(config, null, 2));
}

function writeVaultIndex(cwd, entries) {
  const vaultPath = path.join(cwd, '.claude', 'vault');
  fs.mkdirSync(vaultPath, { recursive: true });
  let md = '# Raid Vault\n\n| Date | Quest | Mode | Tags |\n|------|-------|------|------|\n';
  for (const e of entries) {
    md += `| ${e.date} | [${e.name}](${e.slug}/quest.md) | ${e.mode} | ${e.tags} |\n`;
  }
  fs.writeFileSync(path.join(vaultPath, 'index.md'), md);
}

describe('raid-session-start.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it('creates raid-session file for wizard agent', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    const result = runHook('raid-session-start.sh', { source: 'startup', agent_type: 'wizard', session_id: 'test-123' }, cwd);
    assert.strictEqual(result.exitCode, 0);
    const sessionFile = path.join(cwd, '.claude', 'raid-session');
    assert.ok(fs.existsSync(sessionFile));
    const session = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    assert.strictEqual(session.sessionId, 'test-123');
    assert.strictEqual(session.phase, 1);
  });

  it('does nothing for non-wizard agent types', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    const result = runHook('raid-session-start.sh', { source: 'startup', agent_type: 'warrior', session_id: 'test-456' }, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-session')));
  });

  it('skips on resume when session exists', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), '{"phase":2}');
    const result = runHook('raid-session-start.sh', { source: 'resume', agent_type: 'wizard', session_id: 'test-789' }, cwd);
    assert.strictEqual(result.exitCode, 0);
    const session = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid-session'), 'utf8'));
    assert.strictEqual(session.phase, 2); // Not overwritten
  });

  it('outputs additionalContext when Vault has entries', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeVaultIndex(cwd, [{ date: '2026-04-01', name: 'Auth', slug: '2026-04-01-auth', mode: 'Full Raid', tags: 'auth' }]);
    const result = runHook('raid-session-start.sh', { source: 'startup', agent_type: 'wizard', session_id: 'v-test' }, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes('additionalContext'));
    assert.ok(result.stdout.includes('1 past quest'));
  });

  it('no Vault context when Vault empty', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    const result = runHook('raid-session-start.sh', { source: 'startup', agent_type: 'wizard', session_id: 'no-vault' }, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(!result.stdout.includes('additionalContext'));
  });

  it('exits 0 silently when lifecycle disabled', () => {
    const cwd = setup();
    writeRaidConfig(cwd, { lifecycle: { autoSessionManagement: false } });
    const result = runHook('raid-session-start.sh', { source: 'startup', agent_type: 'wizard', session_id: 'dis' }, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-session')));
  });
});
