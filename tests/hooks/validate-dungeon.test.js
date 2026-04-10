const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Helper: create a temp directory with the hook and raid-lib.sh installed,
 * plus optional raid-session and dungeon file content.
 */
function setupEnv(opts = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-dungeon-test-'));
  const hooksDir = path.join(tmp, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  // Copy hook files
  const src = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks');
  fs.copyFileSync(path.join(src, 'raid-lib.sh'), path.join(hooksDir, 'raid-lib.sh'));
  fs.copyFileSync(path.join(src, 'validate-dungeon.sh'), path.join(hooksDir, 'validate-dungeon.sh'));

  // Create raid-session if requested
  if (opts.session) {
    fs.writeFileSync(
      path.join(tmp, '.claude', 'raid-session'),
      JSON.stringify({
        phase: opts.session.phase || '',
        mode: opts.session.mode || 'full',
        currentAgent: opts.session.currentAgent || 'A',
        implementer: opts.session.implementer || 'A',
        task: opts.session.task || 'test',
      })
    );
  }

  // Create dungeon file if requested
  if (opts.dungeonFile && opts.dungeonContent != null) {
    const dungeonPath = path.join(tmp, opts.dungeonFile);
    fs.mkdirSync(path.dirname(dungeonPath), { recursive: true });
    fs.writeFileSync(dungeonPath, opts.dungeonContent);
  }

  return tmp;
}

/**
 * Run the hook with a given file_path, return { status, stderr }.
 */
function runHook(tmpDir, filePath) {
  const input = JSON.stringify({ tool_input: { file_path: filePath } });
  const hookPath = path.join(tmpDir, '.claude', 'hooks', 'validate-dungeon.sh');
  const stderrFile = path.join(tmpDir, '.stderr-capture');
  const cmd = `echo '${input.replace(/'/g, "'\\''")}' | bash "${hookPath}" 2>"${stderrFile}"`;
  try {
    execSync(cmd, { cwd: tmpDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const stderr = fs.existsSync(stderrFile) ? fs.readFileSync(stderrFile, 'utf8') : '';
    return { status: 0, stderr };
  } catch (err) {
    const stderr = fs.existsSync(stderrFile) ? fs.readFileSync(stderrFile, 'utf8') : (err.stderr || '');
    return { status: err.status, stderr };
  }
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('validate-dungeon.sh', () => {
  const dirs = [];
  afterEach(() => {
    while (dirs.length) cleanup(dirs.pop());
  });

  it('ignores non-dungeon files', () => {
    const tmp = setupEnv({
      session: { phase: 'design' },
    });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 0);
  });

  it('ignores dungeon writes when no Raid session', () => {
    const content = '# Dungeon\n\n📌 DUNGEON: Found critical architecture flaw in the authentication module that bypasses token validation\n';
    const tmp = setupEnv({
      dungeonFile: '.claude/raid-dungeon.md',
      dungeonContent: content,
    });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-dungeon.md');
    assert.strictEqual(result.status, 0);
  });

  it('allows valid pinned entry with evidence', () => {
    const content = '# Dungeon\n\n📌 DUNGEON: Found critical architecture flaw in the authentication module that bypasses token validation entirely — verified by @Warrior and @Archer\n';
    const tmp = setupEnv({
      session: { phase: 'design' },
      dungeonFile: '.claude/raid-dungeon.md',
      dungeonContent: content,
    });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-dungeon.md');
    assert.strictEqual(result.status, 0);
  });

  it('blocks entries without recognized prefix', () => {
    const content = '# Dungeon\n\n### Discoveries\n\nThis line has no valid prefix and should be blocked\n';
    const tmp = setupEnv({
      session: { phase: 'design' },
      dungeonFile: '.claude/raid-dungeon.md',
      dungeonContent: content,
    });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-dungeon.md');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('prefix'), `Expected stderr to mention prefix, got: ${result.stderr}`);
  });

  it('blocks pinned entries that are too short', () => {
    const content = '# Dungeon\n\n### Discoveries\n\n📌 DUNGEON: Too short entry here\n';
    const tmp = setupEnv({
      session: { phase: 'design' },
      dungeonFile: '.claude/raid-dungeon.md',
      dungeonContent: content,
    });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-dungeon.md');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('too short') || result.stderr.includes('Include evidence'), `Expected stderr to mention short entry, got: ${result.stderr}`);
  });

  it('blocks TASK entries during design phase', () => {
    const content = '# Dungeon\n\n### Discoveries\n\n📋 TASK: Implement the authentication module with proper token validation and error handling\n';
    const tmp = setupEnv({
      session: { phase: 'design' },
      dungeonFile: '.claude/raid-dungeon.md',
      dungeonContent: content,
    });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-dungeon.md');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('TASK') || result.stderr.includes('plan'), `Expected stderr to mention TASK or plan phase, got: ${result.stderr}`);
  });

  it('allows TASK entries during plan phase', () => {
    const content = '# Dungeon\n\n📋 TASK: Implement the authentication module with proper token validation and error handling\n';
    const tmp = setupEnv({
      session: { phase: 'plan' },
      dungeonFile: '.claude/raid-dungeon.md',
      dungeonContent: content,
    });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-dungeon.md');
    assert.strictEqual(result.status, 0);
  });

  it('allows all prefixes during finishing phase', () => {
    const content = [
      '# Dungeon',
      '',
      '### Discoveries',
      '',
      '📌 DUNGEON: Found critical architecture flaw in the authentication module — verified by @Warrior and @Rogue',
      '⚠️ UNRESOLVED: The caching layer does not invalidate properly on user deletion events in the system',
      '✅ RESOLVED: Fixed the race condition in the WebSocket handler that caused duplicate message delivery',
      '📋 TASK: Clean up the temporary migration scripts and remove deprecated API endpoints from the codebase',
    ].join('\n') + '\n';
    const tmp = setupEnv({
      session: { phase: 'finishing' },
      dungeonFile: '.claude/raid-dungeon.md',
      dungeonContent: content,
    });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-dungeon.md');
    assert.strictEqual(result.status, 0);
  });

  it('validates raid-dungeon-phase-N.md files too', () => {
    const content = '# Phase 2 Dungeon\n\n### Discoveries\n\nThis line has no valid prefix\n';
    const tmp = setupEnv({
      session: { phase: 'implementation' },
      dungeonFile: '.claude/raid-dungeon-phase-2.md',
      dungeonContent: content,
    });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-dungeon-phase-2.md');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('prefix'), `Expected stderr to mention prefix, got: ${result.stderr}`);
  });

  it('allows UNRESOLVED entries in any non-finishing phase', () => {
    const content = '# Dungeon\n\n⚠️ UNRESOLVED: The caching layer does not invalidate properly on user deletion events in the system\n';
    const tmp = setupEnv({
      session: { phase: 'implementation' },
      dungeonFile: '.claude/raid-dungeon.md',
      dungeonContent: content,
    });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-dungeon.md');
    assert.strictEqual(result.status, 0);
  });

  it('allows freeform text under ### Resolved section', () => {
    const content = [
      '# Dungeon',
      '### Discoveries',
      '📌 DUNGEON: Found critical architecture flaw in the authentication module that bypasses token validation — verified by @Warrior and @Archer',
      '### Resolved',
      '- The race condition was fixed by adding a mutex lock around the shared state',
      '- Warrior conceded after Archer showed the lock ordering was correct',
    ].join('\n') + '\n';
    const tmp = setupEnv({
      session: { phase: 'design' },
      dungeonFile: '.claude/raid-dungeon.md',
      dungeonContent: content,
    });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-dungeon.md');
    assert.strictEqual(result.status, 0);
  });

  it('allows freeform text under ### Shared Knowledge section', () => {
    const content = [
      '# Dungeon',
      '### Shared Knowledge',
      '- The test suite uses node:test runner, not jest',
      '- All hooks source raid-lib.sh for shared config',
    ].join('\n') + '\n';
    const tmp = setupEnv({
      session: { phase: 'design' },
      dungeonFile: '.claude/raid-dungeon.md',
      dungeonContent: content,
    });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-dungeon.md');
    assert.strictEqual(result.status, 0);
  });

  it('allows freeform text under ### Escalations section', () => {
    const content = [
      '# Dungeon',
      '### Escalations',
      'WIZARD: Need clarification on whether the browser hook should block or warn',
    ].join('\n') + '\n';
    const tmp = setupEnv({
      session: { phase: 'design' },
      dungeonFile: '.claude/raid-dungeon.md',
      dungeonContent: content,
    });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-dungeon.md');
    assert.strictEqual(result.status, 0);
  });

  it('still blocks unrecognized prefixes under ### Discoveries', () => {
    const content = [
      '# Dungeon',
      '### Discoveries',
      'This line has no valid prefix and should be blocked',
    ].join('\n') + '\n';
    const tmp = setupEnv({
      session: { phase: 'design' },
      dungeonFile: '.claude/raid-dungeon.md',
      dungeonContent: content,
    });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-dungeon.md');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('prefix'), `Expected stderr to mention prefix, got: ${result.stderr}`);
  });

  it('validates phase files in phases/ subdirectory', () => {
    const tmp = setupEnv({
      session: { phase: 'design' },
      dungeonFile: '.claude/dungeon/test-quest/phases/phase-2-design.md',
      dungeonContent: '### Discoveries\n\nDUNGEON: This is a design finding verified by @Warrior and @Archer with sufficient evidence length for the hook',
    });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/dungeon/test-quest/phases/phase-2-design.md');
    assert.strictEqual(result.status, 0);
  });

  it('still blocks unrecognized prefixes under ### Active Battles', () => {
    const content = [
      '# Dungeon',
      '### Active Battles',
      'Random text without a prefix here',
    ].join('\n') + '\n';
    const tmp = setupEnv({
      session: { phase: 'design' },
      dungeonFile: '.claude/raid-dungeon.md',
      dungeonContent: content,
    });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-dungeon.md');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('prefix'), `Expected stderr to mention prefix, got: ${result.stderr}`);
  });
});
