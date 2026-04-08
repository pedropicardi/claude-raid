const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Helper: create a temp directory with the hook and raid-lib.sh installed,
 * plus optional raid-session and raid.json config files.
 */
function setupEnv(opts = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-commit-test-'));
  const hooksDir = path.join(tmp, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  // Copy hook files
  const src = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks');
  fs.copyFileSync(path.join(src, 'raid-lib.sh'), path.join(hooksDir, 'raid-lib.sh'));
  fs.copyFileSync(path.join(src, 'validate-commit.sh'), path.join(hooksDir, 'validate-commit.sh'));

  // Create raid-session if requested
  if (opts.raidActive) {
    fs.writeFileSync(
      path.join(tmp, '.claude', 'raid-session'),
      JSON.stringify({ phase: 'implementation', mode: 'adversarial', currentAgent: 'A', implementer: 'A', task: 'test' })
    );
  }

  // Create raid.json config if requested
  if (opts.config) {
    fs.writeFileSync(
      path.join(tmp, '.claude', 'raid.json'),
      JSON.stringify(opts.config)
    );
  }

  // Create stale or fresh timestamp file if requested
  if (opts.lastTestRun !== undefined) {
    fs.writeFileSync(
      path.join(tmp, '.claude', 'raid-last-test-run'),
      String(opts.lastTestRun)
    );
  }

  return tmp;
}

/**
 * Run the hook with a given command string, return { status, stderr }.
 */
function runHook(tmpDir, command) {
  const input = JSON.stringify({ tool_input: { command } });
  const hookPath = path.join(tmpDir, '.claude', 'hooks', 'validate-commit.sh');
  try {
    const stdout = execSync(`echo '${input.replace(/'/g, "'\\''")}' | bash "${hookPath}"`, {
      cwd: tmpDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { status: 0, stderr: '' };
  } catch (err) {
    return { status: err.status, stderr: err.stderr || '' };
  }
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('validate-commit.sh', () => {
  const dirs = [];
  afterEach(() => {
    while (dirs.length) cleanup(dirs.pop());
  });

  it('passes through non-git-commit commands', () => {
    const tmp = setupEnv();
    dirs.push(tmp);
    const result = runHook(tmp, 'git push origin main');
    assert.strictEqual(result.status, 0);
  });

  it('blocks non-conventional commit messages', () => {
    const tmp = setupEnv();
    dirs.push(tmp);
    const result = runHook(tmp, 'git commit -m "added some stuff to the codebase"');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('format'), `Expected stderr to mention format, got: ${result.stderr}`);
  });

  it('allows valid conventional commit messages', () => {
    const tmp = setupEnv();
    dirs.push(tmp);
    const result = runHook(tmp, 'git commit -m "feat(hooks): add consolidated commit validation"');
    assert.strictEqual(result.status, 0);
  });

  it('blocks messages shorter than minimum length', () => {
    const tmp = setupEnv();
    dirs.push(tmp);
    const result = runHook(tmp, 'git commit -m "fix: ok"');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('short'), `Expected stderr to mention short, got: ${result.stderr}`);
  });

  it('blocks generic messages like "update"', () => {
    const tmp = setupEnv();
    dirs.push(tmp);
    // Bare "update" hits format check first (not conventional), which is correct — it's blocked
    const result = runHook(tmp, 'git commit -m "update"');
    assert.strictEqual(result.status, 2);
  });

  it('blocks commit during Raid session if tests fail', () => {
    const tmp = setupEnv({
      raidActive: true,
      config: { project: { testCommand: 'exit 1' } },
    });
    dirs.push(tmp);
    const result = runHook(tmp, 'git commit -m "feat(hooks): add new validation logic here"');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.toLowerCase().includes('test'), `Expected stderr to mention test, got: ${result.stderr}`);
  });

  it('allows completion commit when tests just passed', () => {
    const now = Math.floor(Date.now() / 1000);
    const tmp = setupEnv({
      raidActive: true,
      config: { project: { testCommand: 'exit 0' } },
    });
    dirs.push(tmp);
    // The hook should run tests (exit 0 = pass), write timestamp, then verification check should pass
    const result = runHook(tmp, 'git commit -m "feat(hooks): complete the validation pipeline"');
    assert.strictEqual(result.status, 0);

    // Verify timestamp was written
    const tsFile = path.join(tmp, '.claude', 'raid-last-test-run');
    assert.ok(fs.existsSync(tsFile), 'Expected raid-last-test-run to be written');
  });

  it('blocks completion commit when test run timestamp is stale (>10 min old)', () => {
    const staleTimestamp = Math.floor(Date.now() / 1000) - 700; // 700 seconds ago
    const tmp = setupEnv({
      raidActive: true,
      config: { project: { testCommand: '' } }, // no test cmd so test-run check uses existing file
      lastTestRun: staleTimestamp,
    });
    dirs.push(tmp);
    const result = runHook(tmp, 'git commit -m "feat(hooks): complete the final validation"');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.toLowerCase().includes('test'), `Expected stderr to mention test, got: ${result.stderr}`);
  });
});
