'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { Readable, Writable } = require('stream');
const { runChecks, VALID_TEAMMATE_MODES, runSetup } = require('../../src/setup');
const { stripAnsi } = require('../../src/ui');

let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-setup-'));
  return tmpDir;
}

describe('setup', () => {
  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  });

  it('node check passes for v18+', () => {
    const home = makeTempDir();
    const result = runChecks({ homedir: home, exec: () => null, nodeVersion: 'v20.11.0' });
    const node = result.checks.find(c => c.id === 'node');
    assert.ok(node.ok);
    assert.ok(node.detail.includes('v20.11.0'));
    assert.ok(node.detail.includes('>= 18'));
  });

  it('node check fails for version below 18', () => {
    const home = makeTempDir();
    const result = runChecks({ homedir: home, exec: () => null, nodeVersion: 'v16.20.0' });
    const node = result.checks.find(c => c.id === 'node');
    assert.strictEqual(node.ok, false);
    assert.ok(node.hint);
    assert.ok(node.detail.includes('upgrade required'));
  });

  it('node check uses process.version by default', () => {
    const home = makeTempDir();
    const result = runChecks({ homedir: home, exec: () => null });
    const node = result.checks.find(c => c.id === 'node');
    assert.ok(node.ok);
    assert.ok(node.detail.includes('v'));
  });

  it('claude check fails when not found', () => {
    const home = makeTempDir();
    const result = runChecks({ homedir: home, exec: () => null });
    const claude = result.checks.find(c => c.id === 'claude');
    assert.strictEqual(claude.ok, false);
    assert.ok(claude.hint);
  });

  it('claude check passes with valid version', () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ teammateMode: 'tmux' }));
    const exec = (cmd) => {
      if (cmd === 'claude --version') return '2.3.1';
      if (cmd === 'command -v tmux') return '/usr/local/bin/tmux';
      return null;
    };
    const result = runChecks({ homedir: home, exec });
    const claude = result.checks.find(c => c.id === 'claude');
    assert.strictEqual(claude.ok, true);
    assert.ok(claude.detail.includes('v2.3.1'));
  });

  it('claude check fails with old version', () => {
    const home = makeTempDir();
    const exec = (cmd) => {
      if (cmd === 'claude --version') return '1.0.0';
      return null;
    };
    const result = runChecks({ homedir: home, exec });
    const claude = result.checks.find(c => c.id === 'claude');
    assert.strictEqual(claude.ok, false);
    assert.ok(claude.hint);
  });

  it('teammate-mode passes with tmux', () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ teammateMode: 'tmux' }));
    const result = runChecks({ homedir: home, exec: () => null });
    const tm = result.checks.find(c => c.id === 'teammate-mode');
    assert.strictEqual(tm.ok, true);
    assert.ok(tm.detail.includes('tmux'));
  });

  it('teammate-mode passes with in-process', () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ teammateMode: 'in-process' }));
    const result = runChecks({ homedir: home, exec: () => null });
    const tm = result.checks.find(c => c.id === 'teammate-mode');
    assert.strictEqual(tm.ok, true);
    assert.ok(tm.detail.includes('in-process'));
  });

  it('teammate-mode passes with auto', () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ teammateMode: 'auto' }));
    const result = runChecks({ homedir: home, exec: () => null });
    const tm = result.checks.find(c => c.id === 'teammate-mode');
    assert.strictEqual(tm.ok, true);
    assert.ok(tm.detail.includes('auto'));
  });

  it('teammate-mode fails when ~/.claude.json missing', () => {
    const home = makeTempDir();
    const result = runChecks({ homedir: home, exec: () => null });
    const tm = result.checks.find(c => c.id === 'teammate-mode');
    assert.strictEqual(tm.ok, false);
    assert.ok(tm.detail.includes('not found'));
    assert.strictEqual(tm.fixable, true);
  });

  it('teammate-mode fails with invalid value', () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ teammateMode: 'banana' }));
    const result = runChecks({ homedir: home, exec: () => null });
    const tm = result.checks.find(c => c.id === 'teammate-mode');
    assert.strictEqual(tm.ok, false);
    assert.strictEqual(tm.fixable, true);
  });

  it('teammate-mode fails with invalid JSON', () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), 'not json');
    const result = runChecks({ homedir: home, exec: () => null });
    const tm = result.checks.find(c => c.id === 'teammate-mode');
    assert.strictEqual(tm.ok, false);
    assert.ok(tm.detail.includes('not valid JSON'));
    assert.strictEqual(tm.fixable, false);
  });

  it('split-pane passes with tmux', () => {
    const home = makeTempDir();
    const exec = (cmd) => {
      if (cmd === 'command -v tmux') return '/usr/local/bin/tmux';
      return null;
    };
    const result = runChecks({ homedir: home, exec });
    const sp = result.checks.find(c => c.id === 'split-pane');
    assert.strictEqual(sp.ok, true);
    assert.ok(sp.detail.includes('tmux'));
  });

  it('split-pane passes with it2', () => {
    const home = makeTempDir();
    const exec = (cmd) => {
      if (cmd === 'command -v it2') return '/usr/local/bin/it2';
      return null;
    };
    const result = runChecks({ homedir: home, exec });
    const sp = result.checks.find(c => c.id === 'split-pane');
    assert.strictEqual(sp.ok, true);
    assert.ok(sp.detail.includes('it2'));
  });

  it('split-pane fails when neither found', () => {
    const home = makeTempDir();
    const result = runChecks({ homedir: home, exec: () => null });
    const sp = result.checks.find(c => c.id === 'split-pane');
    assert.strictEqual(sp.ok, false);
    assert.ok(sp.hint);
  });

  it('allOk true when all pass', () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ teammateMode: 'tmux' }));
    const exec = (cmd) => {
      if (cmd === 'claude --version') return '2.3.1';
      if (cmd === 'command -v tmux') return '/usr/local/bin/tmux';
      return null;
    };
    const result = runChecks({ homedir: home, exec });
    assert.strictEqual(result.allOk, true);
  });

  it('allOk false when any required fails', () => {
    const home = makeTempDir();
    const result = runChecks({ homedir: home, exec: () => null });
    assert.strictEqual(result.allOk, false);
  });

  it('allOk true when required pass but optional fail', () => {
    const home = makeTempDir();
    // No .claude.json (teammate-mode fails) and no tmux/it2 (split-pane fails)
    // but node and claude pass => allOk should be true
    const exec = (cmd) => {
      if (cmd === 'claude --version') return '2.3.1';
      return null;
    };
    const result = runChecks({ homedir: home, exec, nodeVersion: 'v20.0.0' });
    const tm = result.checks.find(c => c.id === 'teammate-mode');
    const sp = result.checks.find(c => c.id === 'split-pane');
    assert.strictEqual(tm.ok, false, 'teammate-mode should fail');
    assert.strictEqual(sp.ok, false, 'split-pane should fail');
    assert.strictEqual(result.allOk, true, 'allOk should be true (only required checks matter)');
  });

  it('exports VALID_TEAMMATE_MODES', () => {
    assert.deepStrictEqual(VALID_TEAMMATE_MODES, ['tmux', 'in-process', 'auto']);
  });
});

// --- helpers for runSetup tests ---

function mockStdin(inputs) {
  const lines = [...inputs];
  const readable = new Readable({
    read() {
      if (lines.length > 0) {
        setTimeout(() => this.push(lines.shift() + '\n'), 10);
      } else {
        setTimeout(() => this.push(null), 10);
      }
    },
  });
  readable.isTTY = true;
  return readable;
}

function mockStdout() {
  let output = '';
  const writable = new Writable({
    write(chunk, encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  writable.columns = 80;
  writable.getOutput = () => output;
  return writable;
}

function allPassExec(cmd) {
  if (cmd === 'claude --version') return '2.3.1';
  if (cmd === 'command -v tmux') return '/usr/local/bin/tmux';
  return null;
}

describe('runSetup', () => {
  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  });

  it('prompts for teammateMode and writes to ~/.claude.json', async () => {
    const home = makeTempDir();
    const stdin = mockStdin(['2', 'y']);
    const stdout = mockStdout();
    const exec = allPassExec;

    const result = await runSetup({ homedir: home, exec, stdin, stdout });

    const config = JSON.parse(fs.readFileSync(path.join(home, '.claude.json'), 'utf8'));
    assert.strictEqual(config.teammateMode, 'in-process');
    assert.ok(result.actions.includes('teammate-mode'));
  });

  it('preserves existing ~/.claude.json content', async () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ existingKey: 'value' }));
    const stdin = mockStdin(['1', 'y']);
    const stdout = mockStdout();
    // Make teammate-mode fail by writing invalid value first
    // Actually the existing file has no teammateMode, so it will fail with fixable
    // Wait - existingKey: 'value' has no teammateMode, so it will be fixable
    // But let's make sure: checkTeammateMode reads the file, finds no valid teammateMode
    // Actually it does have a config but teammateMode is undefined, so it goes to the last return
    // which sets fixable: true. But wait, we need to remove the existing file's teammateMode
    // to trigger the prompt. The file has { existingKey: 'value' } with no teammateMode, good.

    const result = await runSetup({ homedir: home, exec: allPassExec, stdin, stdout });

    const config = JSON.parse(fs.readFileSync(path.join(home, '.claude.json'), 'utf8'));
    assert.strictEqual(config.existingKey, 'value');
    assert.strictEqual(config.teammateMode, 'tmux');
  });

  it('skips prompts when not interactive', async () => {
    const home = makeTempDir();
    const stdin = mockStdin([]);
    stdin.isTTY = false;
    const stdout = mockStdout();

    const result = await runSetup({ homedir: home, exec: allPassExec, stdin, stdout });

    assert.deepStrictEqual(result.actions, []);
  });

  it('does not write config when user declines', async () => {
    const home = makeTempDir();
    const stdin = mockStdin(['1', 'n']);
    const stdout = mockStdout();

    const result = await runSetup({ homedir: home, exec: allPassExec, stdin, stdout });

    assert.strictEqual(fs.existsSync(path.join(home, '.claude.json')), false);
  });

  it('skips split-pane check when in-process selected', async () => {
    const home = makeTempDir();
    const stdin = mockStdin(['2', 'y']);
    const stdout = mockStdout();
    // exec that has NO tmux/it2 so split-pane would normally fail
    const exec = (cmd) => {
      if (cmd === 'claude --version') return '2.3.1';
      return null;
    };

    const result = await runSetup({ homedir: home, exec, stdin, stdout });

    const sp = result.checks.find(c => c.id === 'split-pane');
    assert.strictEqual(sp.ok, true);
    assert.ok(sp.detail.includes('not needed'));
  });

  it('skips prompts when all checks pass', async () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ teammateMode: 'tmux' }));
    const stdin = mockStdin([]);
    const stdout = mockStdout();

    const result = await runSetup({ homedir: home, exec: allPassExec, stdin, stdout });

    assert.deepStrictEqual(result.actions, []);
  });
});
