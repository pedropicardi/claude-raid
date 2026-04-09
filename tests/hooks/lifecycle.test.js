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
    assert.strictEqual(session.phase, 'design');
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
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), '{"phase":"plan"}');
    const result = runHook('raid-session-start.sh', { source: 'resume', agent_type: 'wizard', session_id: 'test-789' }, cwd);
    assert.strictEqual(result.exitCode, 0);
    const session = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid-session'), 'utf8'));
    assert.strictEqual(session.phase, 'plan'); // Not overwritten
  });

  it('writes mode to raid-session when provided in input', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    const result = runHook('raid-session-start.sh', { source: 'startup', agent_type: 'wizard', session_id: 'mode-test', mode: 'skirmish' }, cwd);
    assert.strictEqual(result.exitCode, 0);
    const session = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid-session'), 'utf8'));
    assert.strictEqual(session.mode, 'skirmish');
  });

  it('defaults mode to full when not provided', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    const result = runHook('raid-session-start.sh', { source: 'startup', agent_type: 'wizard', session_id: 'default-mode' }, cwd);
    assert.strictEqual(result.exitCode, 0);
    const session = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid-session'), 'utf8'));
    assert.strictEqual(session.mode, 'full');
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

function writeSession(cwd, sessionData = {}) {
  const data = { phase: 'design', mode: 'full', currentAgent: 'wizard', ...sessionData };
  fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify(data));
}

describe('raid-teammate-idle.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it('exits 0 with additionalContext nudge when session active', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd);
    const result = runHook('raid-teammate-idle.sh', { teammate_name: 'warrior' }, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes('additionalContext'), 'should output additionalContext');
    assert.ok(result.stdout.includes('warrior') || result.stdout.includes('Unclaimed'), 'should mention agent or tasks');
  });

  it('exits 0 when no active session', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    const result = runHook('raid-teammate-idle.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
  });

  it('exits 0 when nudge disabled', () => {
    const cwd = setup();
    writeRaidConfig(cwd, { lifecycle: { teammateNudge: false } });
    writeSession(cwd);
    const result = runHook('raid-teammate-idle.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
  });
});

describe('raid-task-created.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it('allows descriptive subjects', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd);
    const result = runHook('raid-task-created.sh', { task_subject: 'Implement user authentication flow' }, cwd);
    assert.strictEqual(result.exitCode, 0);
  });

  it('blocks empty subjects', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd);
    const result = runHook('raid-task-created.sh', { task_subject: '' }, cwd);
    assert.strictEqual(result.exitCode, 2);
    assert.ok(result.stderr.includes('cannot be empty'));
  });

  it('blocks too-short subjects', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd);
    const result = runHook('raid-task-created.sh', { task_subject: 'Do stuff' }, cwd);
    assert.strictEqual(result.exitCode, 2);
    assert.ok(result.stderr.includes('too short'));
  });

  it('blocks single generic words like Fix', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd);
    // "Fix" is 3 chars so it hits the too-short gate first
    const result = runHook('raid-task-created.sh', { task_subject: 'Fix' }, cwd);
    assert.strictEqual(result.exitCode, 2);
    assert.ok(result.stderr.includes('too short'));
  });


  it('allows generic words with context', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd);
    const result = runHook('raid-task-created.sh', { task_subject: 'Fix the auth race condition' }, cwd);
    assert.strictEqual(result.exitCode, 0);
  });
});

describe('raid-task-completed.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it('allows completion when test ran recently', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'implementation' });
    const now = Math.floor(Date.now() / 1000);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-last-test-run'), String(now));
    const result = runHook('raid-task-completed.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
  });

  it('blocks when no test run file', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'implementation' });
    const result = runHook('raid-task-completed.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 2);
    assert.ok(result.stderr.includes('No test run recorded'));
  });

  it('blocks when test run is too old', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'implementation' });
    const twentyMinsAgo = Math.floor(Date.now() / 1000) - (20 * 60);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-last-test-run'), String(twentyMinsAgo));
    const result = runHook('raid-task-completed.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 2);
    assert.ok(result.stderr.includes('minutes ago'));
  });

  it('allows completion in design phase without test run', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook('raid-task-completed.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
  });

  it('allows completion in plan phase without test run', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'plan' });
    const result = runHook('raid-task-completed.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
  });

  it('still blocks in implementation phase without test run', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'implementation' });
    const result = runHook('raid-task-completed.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 2);
  });

  it('still blocks in review phase without test run', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'review' });
    const result = runHook('raid-task-completed.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 2);
  });

  it('still blocks in finishing phase without test run', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'finishing' });
    const result = runHook('raid-task-completed.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 2);
  });
});

describe('raid-pre-compact.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it('backs up Dungeon files and outputs additionalContext', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon.md'), '# Dungeon');
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon-phase-1.md'), '# Phase 1');
    const result = runHook('raid-pre-compact.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'raid-dungeon-backup.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'raid-dungeon-phase-1-backup.md')));
    assert.ok(result.stdout.includes('additionalContext'));
  });

  it('does nothing when no Dungeon files exist', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd);
    const result = runHook('raid-pre-compact.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout.trim(), '');
  });
});

describe('raid-session-end.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  function setupWithGit() {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 1, mode: 'full' });
    execSync('git init && git add -A && git commit -m "init" --allow-empty', { cwd, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@test.com', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@test.com' } });
    return cwd;
  }

  it('generates Vault draft directory with quest.md from active session', () => {
    const cwd = setupWithGit();
    const result = runHook('raid-session-end.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    const draftDir = path.join(cwd, '.claude', 'vault', '.draft');
    assert.ok(fs.existsSync(draftDir), 'draft directory should exist');
    const questFile = path.join(draftDir, 'quest.md');
    assert.ok(fs.existsSync(questFile), 'quest.md should exist');
    const content = fs.readFileSync(questFile, 'utf8');
    assert.ok(content.includes('# Quest'));
    assert.ok(content.includes('**Mode:** full'));
    assert.ok(content.includes('VAULT:MACHINE'));
  });

  it('copies spec file to draft when specs exist', () => {
    const cwd = setupWithGit();
    const specsDir = path.join(cwd, 'docs', 'raid', 'specs');
    fs.mkdirSync(specsDir, { recursive: true });
    fs.writeFileSync(path.join(specsDir, 'my-spec.md'), '# Spec Content');
    const result = runHook('raid-session-end.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    const draftSpec = path.join(cwd, '.claude', 'vault', '.draft', 'spec.md');
    assert.ok(fs.existsSync(draftSpec), 'spec.md should be copied to draft');
    assert.strictEqual(fs.readFileSync(draftSpec, 'utf8'), '# Spec Content');
  });

  it('copies Dungeon phase archives to draft', () => {
    const cwd = setupWithGit();
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon-phase-1.md'), '# Phase 1');
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon-phase-2.md'), '# Phase 2');
    const result = runHook('raid-session-end.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    const phasesDir = path.join(cwd, '.claude', 'vault', '.draft', 'dungeon-phases');
    assert.ok(fs.existsSync(path.join(phasesDir, 'raid-dungeon-phase-1.md')));
    assert.ok(fs.existsSync(path.join(phasesDir, 'raid-dungeon-phase-2.md')));
  });

  it('cleans up session artifacts', () => {
    const cwd = setupWithGit();
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon.md'), '# Dungeon');
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-last-test-run'), '12345');
    const result = runHook('raid-session-end.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-session')), 'raid-session should be removed');
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-dungeon.md')), 'raid-dungeon.md should be removed');
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-last-test-run')), 'raid-last-test-run should be removed');
  });

  it('outputs additionalContext with persist/forget instructions', () => {
    const cwd = setupWithGit();
    const result = runHook('raid-session-end.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes('additionalContext'));
    assert.ok(result.stdout.includes('persist'));
    assert.ok(result.stdout.includes('forget'));
  });

  it('does nothing when no active session', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    execSync('git init && git add -A && git commit -m "init" --allow-empty', { cwd, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@test.com', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@test.com' } });
    // No writeSession — no active session
    const result = runHook('raid-session-end.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'vault', '.draft')));
  });
});

describe('raid-stop.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it('exits 0 with no output when session active', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design', mode: 'full' });
    const result = runHook('raid-stop.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout.trim(), '');
  });

  it('exits 0 when no active session', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    const result = runHook('raid-stop.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout.trim(), '');
  });

  it('does not modify raid-session', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design', mode: 'full' });
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon.md'), '# Dungeon\n\nSome content.');
    runHook('raid-stop.sh', {}, cwd);
    const session = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid-session'), 'utf8'));
    assert.strictEqual(session.phase, 'design');
  });
});
