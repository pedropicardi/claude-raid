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
    // Phase starts empty — wizard sets it after quest selection
    assert.strictEqual(session.phase, '');
  });

  it('creates quest directory on session start', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    const result = runHook('raid-session-start.sh', { source: 'startup', agent_type: 'wizard', session_id: 'test-quest-dir' }, cwd);
    assert.strictEqual(result.exitCode, 0);
    const session = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid-session'), 'utf8'));
    assert.ok(session.questDir, 'questDir should be set');
    assert.ok(session.questId, 'questId should be set');
    assert.ok(fs.existsSync(path.join(cwd, session.questDir)), 'quest directory should exist');
  });

  it('includes quest fields in session JSON', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    runHook('raid-session-start.sh', { source: 'startup', agent_type: 'wizard', session_id: 'fields-test' }, cwd);
    const session = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid-session'), 'utf8'));
    assert.strictEqual(session.questType, '');
    assert.ok(Array.isArray(session.blackCards));
    assert.strictEqual(session.phaseIteration, 1);
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

  it('creates phases, spoils, and spoils/tasks subdirectories in quest dir', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    runHook('raid-session-start.sh', { source: 'startup', agent_type: 'wizard', session_id: 'test-123' }, cwd);
    const session = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid-session'), 'utf8'));
    const questDir = path.join(cwd, session.questDir);
    assert.ok(fs.existsSync(path.join(questDir, 'phases')), 'phases/ should exist');
    assert.ok(fs.existsSync(path.join(questDir, 'spoils')), 'spoils/ should exist');
    assert.ok(fs.existsSync(path.join(questDir, 'spoils', 'tasks')), 'spoils/tasks/ should exist');
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
  const data = { phase: 'design', mode: 'full', currentAgent: 'wizard', questType: '', questId: '', questDir: '', ...sessionData };
  fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify(data));
}

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

describe('raid-pre-compact.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it('backs up quest dir phase files and outputs additionalContext', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    const questDir = path.join(cwd, '.claude', 'dungeon', 'test-quest');
    fs.mkdirSync(path.join(questDir, 'phases'), { recursive: true });
    writeSession(cwd, { questDir: '.claude/dungeon/test-quest', questId: 'test-quest' });
    fs.writeFileSync(path.join(questDir, 'phases', 'phase-2-design.md'), '# Design');
    fs.writeFileSync(path.join(questDir, 'phases', 'phase-3-plan.md'), '# Plan');
    const result = runHook('raid-pre-compact.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(fs.existsSync(path.join(questDir, 'backups', 'phase-2-design-backup.md')));
    assert.ok(fs.existsSync(path.join(questDir, 'backups', 'phase-3-plan-backup.md')));
    assert.ok(result.stdout.includes('additionalContext'));
  });

  it('backs up old flat Dungeon files (backward compat)', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon.md'), '# Dungeon');
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon-phase-1.md'), '# Phase 1');
    const result = runHook('raid-pre-compact.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'raid-dungeon-backup.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'raid-dungeon-phase-1-backup.md')));
  });

  it('does not cascade backups of backups', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    const questDir = path.join(cwd, '.claude', 'dungeon', 'test-quest');
    fs.mkdirSync(path.join(questDir, 'phases'), { recursive: true });
    fs.mkdirSync(path.join(questDir, 'backups'), { recursive: true });
    writeSession(cwd, { questDir: '.claude/dungeon/test-quest', questId: 'test-quest' });
    fs.writeFileSync(path.join(questDir, 'phases', 'phase-2-design.md'), '# Design');
    fs.writeFileSync(path.join(questDir, 'backups', 'phase-2-design-backup.md'), '# Design backup');
    runHook('raid-pre-compact.sh', {}, cwd);
    assert.ok(!fs.existsSync(path.join(questDir, 'backups', 'phase-2-design-backup-backup.md')),
      'should not create cascading backups');
    assert.ok(fs.existsSync(path.join(questDir, 'backups', 'phase-2-design-backup.md')));
  });

  it('does not cascade legacy flat dungeon backups', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon-phase-1.md'), '# Phase 1');
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon-phase-1-backup.md'), '# Phase 1 backup');
    runHook('raid-pre-compact.sh', {}, cwd);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-dungeon-phase-1-backup-backup.md')),
      'should not create cascading legacy backups');
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
    writeSession(cwd, { phase: 'design', mode: 'full', questType: 'canonical', questId: 'test-quest', questDir: '.claude/dungeon/test-quest' });
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
    assert.ok(content.includes('**Quest Type:** canonical'));
    assert.ok(content.includes('VAULT:MACHINE'));
  });

  it('copies quest dungeon to vault draft', () => {
    const cwd = setupWithGit();
    const questDir = path.join(cwd, '.claude', 'dungeon', 'test-quest');
    fs.mkdirSync(questDir, { recursive: true });
    fs.writeFileSync(path.join(questDir, 'phase-2-design.md'), '# Design');
    const result = runHook('raid-session-end.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    const draftDungeon = path.join(cwd, '.claude', 'vault', '.draft', 'dungeon');
    assert.ok(fs.existsSync(draftDungeon), 'dungeon dir should be copied to draft');
    assert.ok(fs.existsSync(path.join(draftDungeon, 'phase-2-design.md')));
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

  it('cleans up session artifacts', () => {
    const cwd = setupWithGit();
    const questDir = path.join(cwd, '.claude', 'dungeon', 'test-quest');
    fs.mkdirSync(questDir, { recursive: true });
    fs.writeFileSync(path.join(questDir, 'phase-2-design.md'), '# Design');
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-last-test-run'), '12345');
    const result = runHook('raid-session-end.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-session')), 'raid-session should be removed');
    assert.ok(!fs.existsSync(questDir), 'quest directory should be removed');
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-last-test-run')), 'raid-last-test-run should be removed');
  });

  it('cleans up old flat dungeon files (backward compat)', () => {
    const cwd = setupWithGit();
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon.md'), '# Dungeon');
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon-phase-1.md'), '# Phase 1');
    const result = runHook('raid-session-end.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-dungeon.md')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-dungeon-phase-1.md')));
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
    const result = runHook('raid-session-end.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'vault', '.draft')));
  });
});
