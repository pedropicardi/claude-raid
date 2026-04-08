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
  // Use a wrapper that captures stderr to a file so we can read it even on exit 0
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
    assert.ok(result.stderr.includes('design'), `Expected stderr to mention design, got: ${result.stderr}`);
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

  it('blocks production file writes during review phase', () => {
    const tmp = setupEnv({ session: { phase: 'review', mode: 'full' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('review'), `Expected stderr to mention review, got: ${result.stderr}`);
  });

  it('allows implementer to write production files during implementation', () => {
    const tmp = setupEnv({ session: { phase: 'implementation', mode: 'full', currentAgent: 'A', implementer: 'A' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 0);
  });

  it('blocks non-implementer from writing production files during implementation', () => {
    const tmp = setupEnv({ session: { phase: 'implementation', mode: 'full', currentAgent: 'B', implementer: 'A' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('A'), `Expected stderr to mention implementer name, got: ${result.stderr}`);
  });

  it('skips implementer check in scout mode', () => {
    const tmp = setupEnv({ session: { phase: 'implementation', mode: 'scout', currentAgent: 'B', implementer: 'A' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 0);
  });

  it('warns instead of blocking during review in skirmish mode', () => {
    const tmp = setupEnv({ session: { phase: 'review', mode: 'skirmish' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 0);
    assert.ok(result.stderr.includes('review'), `Expected stderr warning to mention review, got: ${result.stderr}`);
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
    assert.ok(result.stderr.includes('plan'), `Expected stderr to mention plan, got: ${result.stderr}`);
  });

  it('blocks production files during finishing phase', () => {
    const tmp = setupEnv({ session: { phase: 'finishing', mode: 'full' } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.toLowerCase().includes('finishing'), `Expected stderr to mention finishing, got: ${result.stderr}`);
  });
});
