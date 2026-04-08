'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { diagnose } = require('../../src/doctor');

let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-doctor-'));
  return tmpDir;
}

describe('doctor', () => {
  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  });

  it('node check always passes', () => {
    const home = makeTempDir();
    const result = diagnose({ homedir: home, exec: () => null });
    const node = result.checks.find(c => c.id === 'node');
    assert.ok(node.ok);
    assert.ok(node.detail.startsWith('v'));
  });

  it('claude check fails when binary not found', () => {
    const home = makeTempDir();
    const result = diagnose({ homedir: home, exec: () => null });
    const claude = result.checks.find(c => c.id === 'claude');
    assert.strictEqual(claude.ok, false);
    assert.ok(claude.hint);
  });

  it('claude check passes with valid version', () => {
    const home = makeTempDir();
    const exec = (cmd) => {
      if (cmd === 'claude --version') return '2.3.1';
      return null;
    };
    const result = diagnose({ homedir: home, exec });
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
    const result = diagnose({ homedir: home, exec });
    const claude = result.checks.find(c => c.id === 'claude');
    assert.strictEqual(claude.ok, false);
    assert.ok(claude.hint);
  });

  it('tmux check fails when not installed', () => {
    const home = makeTempDir();
    const result = diagnose({ homedir: home, exec: () => null });
    const tmux = result.checks.find(c => c.id === 'tmux');
    assert.strictEqual(tmux.ok, false);
    assert.ok(tmux.detail.includes('not installed'));
  });

  it('tmux check passes when installed', () => {
    const home = makeTempDir();
    const exec = (cmd) => {
      if (cmd === 'command -v tmux') return '/usr/local/bin/tmux';
      return null;
    };
    const result = diagnose({ homedir: home, exec });
    const tmux = result.checks.find(c => c.id === 'tmux');
    assert.strictEqual(tmux.ok, true);
  });

  it('teammateMode fails when ~/.claude.json missing', () => {
    const home = makeTempDir();
    const result = diagnose({ homedir: home, exec: () => null });
    const tm = result.checks.find(c => c.id === 'teammate-mode');
    assert.strictEqual(tm.ok, false);
    assert.ok(tm.detail.includes('not found'));
  });

  it('teammateMode fails when not set', () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({}));
    const result = diagnose({ homedir: home, exec: () => null });
    const tm = result.checks.find(c => c.id === 'teammate-mode');
    assert.strictEqual(tm.ok, false);
    assert.ok(tm.detail.includes('not set'));
  });

  it('teammateMode passes when set to tmux', () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ teammateMode: 'tmux' }));
    const result = diagnose({ homedir: home, exec: () => null });
    const tm = result.checks.find(c => c.id === 'teammate-mode');
    assert.strictEqual(tm.ok, true);
  });

  it('teammateMode fails with invalid JSON', () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), 'not json');
    const result = diagnose({ homedir: home, exec: () => null });
    const tm = result.checks.find(c => c.id === 'teammate-mode');
    assert.strictEqual(tm.ok, false);
    assert.ok(tm.detail.includes('not valid JSON'));
  });

  it('allOk is true when all checks pass', () => {
    const home = makeTempDir();
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ teammateMode: 'tmux' }));
    const exec = (cmd) => {
      if (cmd === 'claude --version') return '2.3.1';
      if (cmd === 'command -v tmux') return '/usr/local/bin/tmux';
      return null;
    };
    const result = diagnose({ homedir: home, exec });
    assert.strictEqual(result.allOk, true);
  });

  it('allOk is false when any check fails', () => {
    const home = makeTempDir();
    const result = diagnose({ homedir: home, exec: () => null });
    assert.strictEqual(result.allOk, false);
  });
});
