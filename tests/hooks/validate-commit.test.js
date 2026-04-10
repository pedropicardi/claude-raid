const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Helper: create a temp directory with the hook and raid-lib.sh installed.
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
      JSON.stringify({ phase: 'implementation', mode: 'full', currentAgent: 'A', implementer: 'A', task: 'test' })
    );
  }

  // Create raid.json config if requested
  if (opts.config) {
    fs.writeFileSync(
      path.join(tmp, '.claude', 'raid.json'),
      JSON.stringify(opts.config)
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
    execSync(`echo '${input.replace(/'/g, "'\\''")}' | bash "${hookPath}"`, {
      cwd: tmpDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { status: 0, stderr: '' };
  } catch (err) {
    return { status: err.status, stderr: err.stderr || '' };
  }
}

/**
 * Run the hook using a temp file for input (avoids shell quoting issues with complex commands).
 */
function runHookViaFile(tmpDir, command) {
  const input = JSON.stringify({ tool_input: { command } });
  const inputFile = path.join(tmpDir, '.hook-input.json');
  fs.writeFileSync(inputFile, input);
  const hookPath = path.join(tmpDir, '.claude', 'hooks', 'validate-commit.sh');
  const stderrFile = path.join(tmpDir, '.hook-stderr.log');
  try {
    execSync(`cat "${inputFile}" | bash "${hookPath}" 2>"${stderrFile}"`, {
      cwd: tmpDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
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
    const result = runHook(tmp, 'git commit -m "update"');
    assert.strictEqual(result.status, 2);
  });

  it('allows valid conventional commit during Raid session', () => {
    const tmp = setupEnv({ raidActive: true });
    dirs.push(tmp);
    const result = runHook(tmp, 'git commit -m "feat(hooks): add new validation logic here"');
    assert.strictEqual(result.status, 0);
  });

  it('allows valid conventional commit via heredoc syntax', () => {
    const tmp = setupEnv();
    dirs.push(tmp);
    const heredocCmd = [
      'git commit -m "$(cat <<\'EOF\'',
      'feat(hooks): add consolidated commit validation logic',
      '',
      'Co-Authored-By: Claude <noreply@anthropic.com>',
      'EOF',
      ')"',
    ].join('\n');
    const result = runHookViaFile(tmp, heredocCmd);
    assert.strictEqual(result.status, 0);
  });

  it('does not false-positive on heredoc content containing git commit words', () => {
    const tmp = setupEnv();
    dirs.push(tmp);
    const cmd = [
      "cat <<'EOF' > instructions.md",
      'To save your work, run git commit -m "your message"',
      'EOF',
    ].join('\n');
    const result = runHookViaFile(tmp, cmd);
    assert.strictEqual(result.status, 0);
  });

  it('warns when commit message cannot be extracted from -m flag', () => {
    const tmp = setupEnv();
    dirs.push(tmp);
    const result = runHookViaFile(tmp, 'git commit -m $(generate_message)');
    assert.strictEqual(result.status, 0);
    assert.ok(result.stderr.includes('Could not extract'), `Expected warning about extraction, got: ${result.stderr}`);
  });

  it('allows commit when browser enabled but no playwright config file', () => {
    const tmp = setupEnv({
      raidActive: true,
      config: {
        project: { testCommand: 'exit 0' },
        browser: { enabled: true, playwrightConfig: 'playwright.config.ts' },
      },
    });
    dirs.push(tmp);
    const result = runHook(tmp, 'git commit -m "feat(hooks): add new validation logic"');
    assert.strictEqual(result.status, 0);
  });
});
