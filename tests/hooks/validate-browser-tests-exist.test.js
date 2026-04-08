'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

function setupEnv(opts = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-browser-tests-'));
  const hooksDir = path.join(tmp, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  const src = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks');
  fs.copyFileSync(path.join(src, 'raid-lib.sh'), path.join(hooksDir, 'raid-lib.sh'));
  fs.copyFileSync(path.join(src, 'validate-browser-tests-exist.sh'), path.join(hooksDir, 'validate-browser-tests-exist.sh'));

  if (opts.raidActive) {
    fs.writeFileSync(
      path.join(tmp, '.claude', 'raid-session'),
      JSON.stringify({ phase: 'implementation', mode: 'full', currentAgent: 'A', implementer: 'A', task: 'test' })
    );
  }

  if (opts.config) {
    fs.writeFileSync(path.join(tmp, '.claude', 'raid.json'), JSON.stringify(opts.config));
  }

  // Init as git repo for staged file checks
  if (opts.gitRepo) {
    execSync('git init', { cwd: tmp, stdio: 'pipe' });
    execSync('git config user.email "test@test.com" && git config user.name "Test"', { cwd: tmp, stdio: 'pipe' });
  }

  return tmp;
}

function runHook(tmpDir, command) {
  const input = JSON.stringify({ tool_input: { command } });
  const hookPath = path.join(tmpDir, '.claude', 'hooks', 'validate-browser-tests-exist.sh');
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

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('validate-browser-tests-exist.sh', () => {
  const dirs = [];
  afterEach(() => {
    while (dirs.length) cleanup(dirs.pop());
  });

  it('exits 0 for non-commit commands', () => {
    const tmp = setupEnv();
    dirs.push(tmp);
    const result = runHook(tmp, 'git push origin main');
    assert.strictEqual(result.status, 0);
  });

  it('exits 0 when no raid session', () => {
    const tmp = setupEnv();
    dirs.push(tmp);
    const result = runHook(tmp, 'git commit -m "feat: something"');
    assert.strictEqual(result.status, 0);
  });

  it('exits 0 when browser not enabled', () => {
    const tmp = setupEnv({
      raidActive: true,
      config: { project: {} },
    });
    dirs.push(tmp);
    const result = runHook(tmp, 'git commit -m "feat: something"');
    assert.strictEqual(result.status, 0);
  });

  it('exits 0 when browser enabled but no browser-facing files staged', () => {
    const tmp = setupEnv({
      raidActive: true,
      config: { browser: { enabled: true } },
      gitRepo: true,
    });
    dirs.push(tmp);
    // Stage a non-browser file
    fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'src', 'utils.js'), 'module.exports = {}');
    execSync('git add src/utils.js', { cwd: tmp, stdio: 'pipe' });
    const result = runHook(tmp, 'git commit -m "feat: add utils module here"');
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stderr, '');
  });
});
