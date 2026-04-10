const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const HOOKS_SRC = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks');

/**
 * Helper: create a temp directory with rtk-bridge.sh and raid-lib.sh installed.
 */
function setupEnv(opts = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-rtk-bridge-test-'));
  const hooksDir = path.join(tmp, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  fs.copyFileSync(path.join(HOOKS_SRC, 'raid-lib.sh'), path.join(hooksDir, 'raid-lib.sh'));
  fs.copyFileSync(path.join(HOOKS_SRC, 'rtk-bridge.sh'), path.join(hooksDir, 'rtk-bridge.sh'));

  // Write raid.json if config provided
  if (opts.config !== undefined) {
    fs.writeFileSync(
      path.join(tmp, '.claude', 'raid.json'),
      typeof opts.config === 'string' ? opts.config : JSON.stringify(opts.config)
    );
  }

  // Write raid-session if session provided
  if (opts.session) {
    fs.writeFileSync(
      path.join(tmp, '.claude', 'raid-session'),
      JSON.stringify(opts.session)
    );
  }

  return tmp;
}

/**
 * Run rtk-bridge.sh with the given input JSON.
 * Returns { status, stdout, stderr }.
 */
function runBridge(tmpDir, inputJson, envOverrides = {}) {
  const inputFile = path.join(tmpDir, '.hook-input.json');
  const stdoutFile = path.join(tmpDir, '.hook-stdout.log');
  const stderrFile = path.join(tmpDir, '.hook-stderr.log');
  fs.writeFileSync(inputFile, inputJson);

  const hookPath = path.join(tmpDir, '.claude', 'hooks', 'rtk-bridge.sh');
  const env = Object.assign({}, process.env, envOverrides);

  try {
    execSync(
      `cat "${inputFile}" | bash "${hookPath}" >"${stdoutFile}" 2>"${stderrFile}"`,
      { cwd: tmpDir, encoding: 'utf8', env, timeout: 5000 }
    );
    const stdout = fs.existsSync(stdoutFile) ? fs.readFileSync(stdoutFile, 'utf8') : '';
    const stderr = fs.existsSync(stderrFile) ? fs.readFileSync(stderrFile, 'utf8') : '';
    return { status: 0, stdout, stderr };
  } catch (err) {
    const stdout = fs.existsSync(stdoutFile) ? fs.readFileSync(stdoutFile, 'utf8') : (err.stdout || '');
    const stderr = fs.existsSync(stderrFile) ? fs.readFileSync(stderrFile, 'utf8') : (err.stderr || '');
    return { status: err.status || 1, stdout, stderr };
  }
}

/**
 * Create a fake rtk bin directory and return the path.
 * The stub cats stdin back (simulates rtk passthrough).
 */
function createFakeRtk(tmpDir) {
  const fakeBin = path.join(tmpDir, 'fake-bin');
  fs.mkdirSync(fakeBin, { recursive: true });
  fs.writeFileSync(path.join(fakeBin, 'rtk'), '#!/bin/bash\ncat\n');
  fs.chmodSync(path.join(fakeBin, 'rtk'), 0o755);
  return fakeBin;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('rtk-bridge.sh', () => {
  const dirs = [];
  afterEach(() => {
    while (dirs.length) cleanup(dirs.pop());
  });

  it('exits cleanly when rtk is not on PATH', () => {
    const tmp = setupEnv({
      config: { rtk: { enabled: true } },
    });
    dirs.push(tmp);
    const input = JSON.stringify({ tool_input: { command: 'git status' } });
    const result = runBridge(tmp, input, { PATH: '/usr/bin:/bin' });
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, '');
  });

  it('exits cleanly when RTK is disabled in raid.json', () => {
    const tmp = setupEnv({
      config: { rtk: { enabled: false } },
    });
    dirs.push(tmp);
    const fakeBin = createFakeRtk(tmp);
    const input = JSON.stringify({ tool_input: { command: 'git status' } });
    const result = runBridge(tmp, input, { PATH: `${fakeBin}:${process.env.PATH}` });
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, '');
  });

  it('exits cleanly when rtk key is missing from raid.json', () => {
    const tmp = setupEnv({
      config: { project: { testCommand: 'npm test' } },
    });
    dirs.push(tmp);
    const fakeBin = createFakeRtk(tmp);
    const input = JSON.stringify({ tool_input: { command: 'git status' } });
    const result = runBridge(tmp, input, { PATH: `${fakeBin}:${process.env.PATH}` });
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, '');
  });

  it('delegates to rtk when enabled and no bypass applies', () => {
    const tmp = setupEnv({
      config: { rtk: { enabled: true, bypass: { phases: [], commands: [] } } },
    });
    dirs.push(tmp);
    const fakeBin = createFakeRtk(tmp);
    const inputJson = JSON.stringify({ tool_input: { command: 'git status' } });
    const result = runBridge(tmp, inputJson, { PATH: `${fakeBin}:${process.env.PATH}` });
    assert.strictEqual(result.status, 0);
    // The fake rtk cats stdin back, so stdout should contain the original input
    assert.ok(result.stdout.includes('git status'), `Expected stdout to contain input JSON, got: ${result.stdout}`);
  });

  it('exits cleanly when current phase is in bypass list', () => {
    const tmp = setupEnv({
      config: { rtk: { enabled: true, bypass: { phases: ['design', 'review'], commands: [] } } },
      session: { phase: 'design', mode: 'full', currentAgent: 'A', implementer: 'A', task: 'test' },
    });
    dirs.push(tmp);
    const fakeBin = createFakeRtk(tmp);
    const input = JSON.stringify({ tool_input: { command: 'git status' } });
    const result = runBridge(tmp, input, { PATH: `${fakeBin}:${process.env.PATH}` });
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, '');
  });

  it('delegates to rtk when current phase is NOT in bypass list', () => {
    const tmp = setupEnv({
      config: { rtk: { enabled: true, bypass: { phases: ['design'], commands: [] } } },
      session: { phase: 'implementation', mode: 'full', currentAgent: 'A', implementer: 'A', task: 'test' },
    });
    dirs.push(tmp);
    const fakeBin = createFakeRtk(tmp);
    const inputJson = JSON.stringify({ tool_input: { command: 'git status' } });
    const result = runBridge(tmp, inputJson, { PATH: `${fakeBin}:${process.env.PATH}` });
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes('git status'), `Expected rtk to receive input, got: ${result.stdout}`);
  });

  it('exits cleanly when command matches a bypass prefix', () => {
    const tmp = setupEnv({
      config: { rtk: { enabled: true, bypass: { phases: [], commands: ['git', 'npm test'] } } },
    });
    dirs.push(tmp);
    const fakeBin = createFakeRtk(tmp);
    const input = JSON.stringify({ tool_input: { command: 'git commit -m "feat: something"' } });
    const result = runBridge(tmp, input, { PATH: `${fakeBin}:${process.env.PATH}` });
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, '');
  });

  it('delegates to rtk when command does not match any bypass prefix', () => {
    const tmp = setupEnv({
      config: { rtk: { enabled: true, bypass: { phases: [], commands: ['npm test'] } } },
    });
    dirs.push(tmp);
    const fakeBin = createFakeRtk(tmp);
    const inputJson = JSON.stringify({ tool_input: { command: 'cargo build --release' } });
    const result = runBridge(tmp, inputJson, { PATH: `${fakeBin}:${process.env.PATH}` });
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes('cargo build'), `Expected rtk to receive input, got: ${result.stdout}`);
  });

  it('delegates to rtk when no active session even if bypass phases are configured', () => {
    const tmp = setupEnv({
      config: { rtk: { enabled: true, bypass: { phases: ['implementation', 'design'], commands: [] } } },
      // No session file — RAID_ACTIVE will be false
    });
    dirs.push(tmp);
    const fakeBin = createFakeRtk(tmp);
    const inputJson = JSON.stringify({ tool_input: { command: 'git status' } });
    const result = runBridge(tmp, inputJson, { PATH: `${fakeBin}:${process.env.PATH}` });
    assert.strictEqual(result.status, 0);
    // Phase bypass requires RAID_ACTIVE=true; without a session, rtk should be called
    assert.ok(result.stdout.includes('git status'), `Expected rtk to receive input without active session, got: ${result.stdout}`);
  });

  it('exits cleanly (fail-open) when raid.json is malformed', () => {
    const tmp = setupEnv({
      config: 'this is not valid json {{{',
    });
    dirs.push(tmp);
    const fakeBin = createFakeRtk(tmp);
    const input = JSON.stringify({ tool_input: { command: 'git status' } });
    // With malformed JSON, RAID_RTK_ENABLED stays false → exit 0
    const result = runBridge(tmp, input, { PATH: `${fakeBin}:${process.env.PATH}` });
    assert.strictEqual(result.status, 0);
  });
});
