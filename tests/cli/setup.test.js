'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { runChecks, formatChecks, VALID_TEAMMATE_MODES } = require('../../src/setup');

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

  it('node check always passes', () => {
    const home = makeTempDir();
    const result = runChecks({ homedir: home, exec: () => null });
    const node = result.checks.find(c => c.id === 'node');
    assert.ok(node.ok);
    assert.ok(node.detail.startsWith('v'));
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

  it('formatChecks renders icons and hints', () => {
    const checks = [
      { id: 'node', ok: true, label: 'Node.js', detail: 'v20.0.0' },
      { id: 'claude', ok: false, label: 'Claude Code', detail: 'not found', hint: 'Install it' },
    ];
    const out = formatChecks(checks);
    assert.ok(out.includes('✔'));
    assert.ok(out.includes('✖'));
    assert.ok(out.includes('→ Install it'));
  });

  it('exports VALID_TEAMMATE_MODES', () => {
    assert.deepStrictEqual(VALID_TEAMMATE_MODES, ['tmux', 'in-process', 'auto']);
  });
});
