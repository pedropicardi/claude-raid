'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

function setupEnv(opts = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-browser-cleanup-'));
  const hooksDir = path.join(tmp, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  const src = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks');
  fs.copyFileSync(path.join(src, 'raid-lib.sh'), path.join(hooksDir, 'raid-lib.sh'));
  fs.copyFileSync(path.join(src, 'validate-browser-cleanup.sh'), path.join(hooksDir, 'validate-browser-cleanup.sh'));

  if (opts.raidActive) {
    fs.writeFileSync(
      path.join(tmp, '.claude', 'raid-session'),
      JSON.stringify({ phase: 'review', mode: 'full', currentAgent: 'A', implementer: 'A', task: 'test' })
    );
  }

  if (opts.config) {
    fs.writeFileSync(path.join(tmp, '.claude', 'raid.json'), JSON.stringify(opts.config));
  }

  return tmp;
}

function runHook(tmpDir) {
  const input = JSON.stringify({ tool_input: { command: 'echo hello' } });
  const hookPath = path.join(tmpDir, '.claude', 'hooks', 'validate-browser-cleanup.sh');
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

describe('validate-browser-cleanup.sh', () => {
  const dirs = [];
  afterEach(() => {
    while (dirs.length) cleanup(dirs.pop());
  });

  it('exits 0 when no raid session active', () => {
    const tmp = setupEnv();
    dirs.push(tmp);
    const result = runHook(tmp);
    assert.strictEqual(result.status, 0);
  });

  it('exits 0 when browser not enabled', () => {
    const tmp = setupEnv({
      raidActive: true,
      config: { project: {} },
    });
    dirs.push(tmp);
    const result = runHook(tmp);
    assert.strictEqual(result.status, 0);
  });

  it('exits 0 when browser enabled but no port range', () => {
    const tmp = setupEnv({
      raidActive: true,
      config: { browser: { enabled: true } },
    });
    dirs.push(tmp);
    const result = runHook(tmp);
    assert.strictEqual(result.status, 0);
  });

  it('exits 0 when browser enabled and ports are free', () => {
    // Use high port numbers unlikely to be in use
    const tmp = setupEnv({
      raidActive: true,
      config: { browser: { enabled: true, portRange: [59990, 59991] } },
    });
    dirs.push(tmp);
    const result = runHook(tmp);
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stderr, '');
  });
});
