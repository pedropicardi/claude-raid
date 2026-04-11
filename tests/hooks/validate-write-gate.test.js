const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Helper: create a temp directory with the hook and raid-lib.sh installed,
 * plus optional raid-session to control phase/mode/agent.
 */
function setupEnv(opts = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-write-gate-test-'));
  const hooksDir = path.join(tmp, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  // Copy hook files
  const src = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks');
  fs.copyFileSync(path.join(src, 'raid-lib.sh'), path.join(hooksDir, 'raid-lib.sh'));
  fs.copyFileSync(path.join(src, 'validate-write-gate.sh'), path.join(hooksDir, 'validate-write-gate.sh'));

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
        questType: opts.session.questType || '',
        questId: opts.session.questId || '',
        questDir: opts.session.questDir || '',
      })
    );
  }

  return tmp;
}

/**
 * Run the hook with a given file_path, return { status, stderr }.
 */
function runHook(tmpDir, filePath) {
  const input = JSON.stringify({ tool_input: { file_path: filePath } });
  const hookPath = path.join(tmpDir, '.claude', 'hooks', 'validate-write-gate.sh');
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

describe('validate-write-gate.sh', () => {
  const dirs = [];
  afterEach(() => {
    while (dirs.length) cleanup(dirs.pop());
  });

  it('allows all writes when no Raid session active', () => {
    const tmp = setupEnv(); // no session
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 0);
  });

  it('blocks production file writes during design phase', () => {
    const tmp = setupEnv({ session: { phase: 'design', mode: 'full' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.toLowerCase().includes('design'), `Expected stderr to mention design, got: ${result.stderr}`);
  });

  it('allows doc writes during design phase', () => {
    const tmp = setupEnv({ session: { phase: 'design', mode: 'full' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'docs/architecture.md');
    assert.strictEqual(result.status, 0);
  });

  it('allows test file writes during design phase', () => {
    const tmp = setupEnv({ session: { phase: 'design', mode: 'full' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'tests/hooks/validate-write-gate.test.js');
    assert.strictEqual(result.status, 0);
  });

  it('allows production file writes during review phase (skill layer controls)', () => {
    const tmp = setupEnv({ session: { phase: 'review', mode: 'full' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 0);
  });

  it('allows implementer to write production files during implementation', () => {
    const tmp = setupEnv({ session: { phase: 'implementation', mode: 'full', currentAgent: 'A', implementer: 'A' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 0);
  });

  it('allows any agent to write production files during implementation (skill layer controls)', () => {
    const tmp = setupEnv({ session: { phase: 'implementation', mode: 'full', currentAgent: 'B', implementer: 'A' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 0);
  });

  it('allows production writes during implementation in scout mode', () => {
    const tmp = setupEnv({ session: { phase: 'implementation', mode: 'scout', currentAgent: 'B', implementer: 'A' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 0);
  });

  it('allows production writes during review in skirmish mode (skill layer controls)', () => {
    const tmp = setupEnv({ session: { phase: 'review', mode: 'skirmish' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 0);
  });

  it('allows production writes during implementation when no implementer set', () => {
    const tmp = setupEnv({ session: { phase: 'implementation', mode: 'full', currentAgent: '', implementer: '' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 0);
  });

  it('allows production writes during review when mode is empty', () => {
    const tmp = setupEnv({ session: { phase: 'review', mode: '' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 0);
  });

  it('allows .claude file writes in any phase', () => {
    const tmp = setupEnv({ session: { phase: 'design', mode: 'full' } });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/settings.json');
    assert.strictEqual(result.status, 0);
  });

  it('blocks production files during plan phase', () => {
    const tmp = setupEnv({ session: { phase: 'plan', mode: 'full' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.toLowerCase().includes('plan'), `Expected stderr to mention plan, got: ${result.stderr}`);
  });

  it('blocks production files during prd phase', () => {
    const tmp = setupEnv({ session: { phase: 'prd', mode: 'full' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.toLowerCase().includes('prd'), `Expected stderr to mention prd, got: ${result.stderr}`);
  });

  it('blocks production files during wrap-up phase', () => {
    const tmp = setupEnv({ session: { phase: 'wrap-up', mode: 'full' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.toLowerCase().includes('wrap-up'), `Expected stderr to mention wrap-up, got: ${result.stderr}`);
  });

  it('blocks production files on unknown phase (fail-closed)', () => {
    const tmp = setupEnv({ session: { phase: 'xyzzy', mode: 'full' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.toLowerCase().includes('unknown'), `Expected stderr to mention unknown, got: ${result.stderr}`);
  });

  it('allows writes on empty phase during session bootstrap', () => {
    const tmp = setupEnv({ session: { phase: '', mode: 'full' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 0);
  });

  it('blocks writes to .claude/raid-session during active session', () => {
    const tmp = setupEnv({ session: { phase: 'implementation', mode: 'full', currentAgent: 'A', implementer: 'A' } });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-session');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('protected'), `Expected stderr to mention protected, got: ${result.stderr}`);
  });

  it('blocks writes to .claude/raid-last-test-run during active session', () => {
    const tmp = setupEnv({ session: { phase: 'implementation', mode: 'full', currentAgent: 'A', implementer: 'A' } });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-last-test-run');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('protected'), `Expected stderr to mention protected, got: ${result.stderr}`);
  });

  it('allows writes to .claude/raid-session when no active session', () => {
    const tmp = setupEnv(); // no session
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-session');
    assert.strictEqual(result.status, 0);
  });

  it('allows writes to other .claude files during active session', () => {
    const tmp = setupEnv({ session: { phase: 'implementation', mode: 'full', currentAgent: 'A', implementer: 'A' } });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/raid-dungeon.md');
    assert.strictEqual(result.status, 0);
  });

  it('allows writes to quest dungeon directory during any phase', () => {
    const tmp = setupEnv({ session: { phase: 'design', mode: 'full' } });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/dungeon/test-quest/phase-2-design.md');
    assert.strictEqual(result.status, 0);
  });

  it('allows writes to quest dungeon phases/ subdirectory', () => {
    const tmp = setupEnv({ session: { phase: 'design', mode: 'full' } });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/dungeon/test-quest/phases/phase-2-design.md');
    assert.strictEqual(result.status, 0);
  });

  it('allows writes to quest dungeon spoils/ subdirectory', () => {
    const tmp = setupEnv({ session: { phase: 'design', mode: 'full' } });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/dungeon/test-quest/spoils/design.md');
    assert.strictEqual(result.status, 0);
  });

  it('allows writes to quest dungeon spoils/tasks/ subdirectory', () => {
    const tmp = setupEnv({ session: { phase: 'plan', mode: 'full' } });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/dungeon/test-quest/spoils/tasks/phase-3-plan-task-01.md');
    assert.strictEqual(result.status, 0);
  });

  it('allows writes to quest dungeon backups/ subdirectory', () => {
    const tmp = setupEnv({ session: { phase: 'design', mode: 'full' } });
    dirs.push(tmp);
    const result = runHook(tmp, '.claude/dungeon/test-quest/backups/phase-2-design-backup.md');
    assert.strictEqual(result.status, 0);
  });
});
