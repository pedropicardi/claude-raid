'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { execSync } = require('child_process');
const { colors, box, header } = require('./ui');

// --- Helpers (private) ---

function tryExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function parseVersion(str) {
  const match = str && str.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return { major: +match[1], minor: +match[2], patch: +match[3] };
}

function versionGte(v, min) {
  if (v.major !== min.major) return v.major > min.major;
  if (v.minor !== min.minor) return v.minor > min.minor;
  return v.patch >= min.patch;
}

// --- Constants ---

const MIN_NODE = { major: 18, minor: 0, patch: 0 };
const MIN_CLAUDE = { major: 2, minor: 1, patch: 32 };
const VALID_TEAMMATE_MODES = ['tmux', 'in-process', 'auto'];
const REQUIRED_IDS = ['node', 'claude'];

// --- Check functions (private) ---

function checkNode(nodeVersion) {
  const v = nodeVersion || process.version;
  const ver = parseVersion(v);
  if (!ver) {
    return {
      id: 'node',
      ok: false,
      label: 'Node.js',
      detail: `unknown version: ${v}`,
      hint: 'Node.js >= 18 is required',
    };
  }
  const ok = versionGte(ver, MIN_NODE);
  const tag = `v${ver.major}.${ver.minor}.${ver.patch}`;
  return {
    id: 'node',
    ok,
    label: 'Node.js',
    detail: ok
      ? `${tag} (>= ${MIN_NODE.major} required)`
      : `${tag} — upgrade required (>= ${MIN_NODE.major})`,
    hint: ok ? undefined : 'Upgrade Node.js to version 18 or later',
  };
}

function checkClaude(exec) {
  const raw = exec('claude --version');
  if (!raw) {
    return {
      id: 'claude',
      ok: false,
      label: 'Claude Code',
      detail: 'not found',
      hint: 'Install: npm install -g @anthropic-ai/claude-code',
    };
  }
  const ver = parseVersion(raw);
  if (!ver) {
    return {
      id: 'claude',
      ok: false,
      label: 'Claude Code',
      detail: `unknown version: ${raw}`,
      hint: 'Expected semver from "claude --version"',
    };
  }
  const ok = versionGte(ver, MIN_CLAUDE);
  const tag = `v${ver.major}.${ver.minor}.${ver.patch}`;
  return {
    id: 'claude',
    ok,
    label: 'Claude Code',
    detail: ok
      ? `${tag} (≥ ${MIN_CLAUDE.major}.${MIN_CLAUDE.minor}.${MIN_CLAUDE.patch} required)`
      : `${tag} — update required (≥ ${MIN_CLAUDE.major}.${MIN_CLAUDE.minor}.${MIN_CLAUDE.patch})`,
    hint: ok ? undefined : 'Update: npm update -g @anthropic-ai/claude-code',
  };
}

function checkTeammateMode(homedir) {
  const configPath = path.join(homedir, '.claude.json');
  if (!fs.existsSync(configPath)) {
    return {
      id: 'teammate-mode',
      ok: false,
      label: 'teammateMode',
      detail: 'not set — ~/.claude.json not found',
      hint: 'Create ~/.claude.json with: { "teammateMode": "tmux" }',
      fixable: true,
    };
  }
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {
      id: 'teammate-mode',
      ok: false,
      label: 'teammateMode',
      detail: '~/.claude.json is not valid JSON',
      hint: 'Fix the JSON syntax, then add: "teammateMode": "tmux"',
      fixable: false,
    };
  }
  if (VALID_TEAMMATE_MODES.includes(config.teammateMode)) {
    return {
      id: 'teammate-mode',
      ok: true,
      label: 'teammateMode',
      detail: config.teammateMode,
    };
  }
  return {
    id: 'teammate-mode',
    ok: false,
    label: 'teammateMode',
    detail: config.teammateMode
      ? `set to "${config.teammateMode}" (expected one of: ${VALID_TEAMMATE_MODES.join(', ')})`
      : 'not set in ~/.claude.json',
    hint: `Add "teammateMode": "tmux" to ~/.claude.json`,
    fixable: true,
  };
}

function checkSplitPane(exec) {
  const tmux = exec('command -v tmux');
  const it2 = exec('command -v it2');

  if (tmux || it2) {
    const available = [tmux && 'tmux', it2 && 'it2'].filter(Boolean).join(', ');
    return {
      id: 'split-pane',
      ok: true,
      label: 'Split-pane',
      detail: `available: ${available}`,
    };
  }
  return {
    id: 'split-pane',
    ok: false,
    label: 'Split-pane',
    detail: 'no split-pane tool found',
    hint: process.platform === 'darwin'
      ? 'Install tmux: brew install tmux'
      : 'Install tmux via your package manager (apt, dnf, brew, etc.)',
  };
}

// --- Interactive helpers (private) ---

const MODE_MENU = [
  { key: '1', value: 'tmux', desc: 'split panes, see all agents at once (requires tmux/iTerm2)' },
  { key: '2', value: 'in-process', desc: 'all in one terminal, cycle with Shift+Down' },
  { key: '3', value: 'auto', desc: 'split panes if available, otherwise in-process' },
];

function ask(question, stdin, stdout) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: stdin, output: stdout, terminal: false });
    rl.question(question, (answer) => {
      rl.close();
      resolve((answer || '').trim());
    });
  });
}

function writeTeammateMode(homedir, mode) {
  const configPath = path.join(homedir, '.claude.json');
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      config = {};
    }
  }
  config.teammateMode = mode;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

// --- Formatting helper (private) ---

function formatCheckLine(check) {
  const icon = check.ok ? colors.green('✔') : colors.red('✖');
  const lines = [`  ${icon} ${check.label}  ${check.detail}`];
  if (check.hint) {
    lines.push(`    ${colors.dim('→')} ${colors.dim(check.hint)}`);
  }
  return lines;
}

// --- Exports ---

function runChecks(opts = {}) {
  const homedir = opts.homedir || os.homedir();
  const exec = opts.exec || tryExec;

  const nodeVersion = opts.nodeVersion || undefined;

  const checks = [
    checkNode(nodeVersion),
    checkClaude(exec),
    checkTeammateMode(homedir),
    checkSplitPane(exec),
  ];

  return {
    checks,
    allOk: checks.filter(c => REQUIRED_IDS.includes(c.id)).every(c => c.ok),
  };
}

async function runSetup(opts = {}) {
  const homedir = opts.homedir || os.homedir();
  const exec = opts.exec || tryExec;
  const stdin = opts.stdin || process.stdin;
  const stdout = opts.stdout || process.stdout;
  const actions = [];

  let { checks, allOk } = runChecks({ homedir, exec });

  const isInteractive = !!stdin.isTTY;

  // Non-interactive: print all checks in a box and return
  if (!isInteractive) {
    const allLines = checks.flatMap(c => formatCheckLine(c));
    stdout.write('\n' + box('Party Status', allLines) + '\n');
    return { checks, allOk, actions: [] };
  }

  // Interactive: print initial checks (not split-pane yet)
  const initialChecks = checks.filter(c => c.id !== 'split-pane');
  const initialLines = initialChecks.flatMap(c => formatCheckLine(c));
  stdout.write('\n' + box('Party Status', initialLines) + '\n');

  // Handle teammate-mode fix
  const tmCheck = checks.find(c => c.id === 'teammate-mode');
  let selectedMode = null;

  if (!tmCheck.ok && tmCheck.fixable) {
    stdout.write('\n  Choose your formation:\n\n');
    for (const item of MODE_MENU) {
      stdout.write(`    ${colors.amber(item.key + ')')} ${colors.bold(item.value.padEnd(12))} ${colors.dim(item.desc)}\n`);
    }
    const choice = await ask('\n  Pick [1/2/3]: ', stdin, stdout);
    const picked = MODE_MENU.find(m => m.key === choice);
    if (picked) {
      const confirm = await ask(`  Write teammateMode: "${colors.bold(picked.value)}" to ~/.claude.json? [Y/n] `, stdin, stdout);
      if (confirm.toLowerCase() !== 'n') {
        writeTeammateMode(homedir, picked.value);
        tmCheck.ok = true;
        tmCheck.detail = picked.value;
        delete tmCheck.hint;
        delete tmCheck.fixable;
        actions.push('teammate-mode');
        selectedMode = picked.value;
        stdout.write('  ' + colors.green('✔') + ' Updated ~/.claude.json\n');
      }
    }
  } else if (tmCheck.ok) {
    selectedMode = tmCheck.detail;
  }

  // Handle split-pane check
  const splitPane = checks.find(c => c.id === 'split-pane');
  if (selectedMode === 'in-process') {
    splitPane.ok = true;
    splitPane.detail = 'not needed (in-process mode)';
    delete splitPane.hint;
  }

  stdout.write('\n  ' + formatCheckLine(splitPane).join('\n  ') + '\n');

  // Recalculate allOk (required checks only: node + claude)

  allOk = checks.filter(c => REQUIRED_IDS.includes(c.id)).every(c => c.ok);

  if (checks.every(c => c.ok)) {
    stdout.write('\n  ' + colors.green('The party is assembled.') + ' Your quest awaits.\n');
    stdout.write('\n    claude --agent wizard\n');
  }

  return { checks, allOk, actions };
}

module.exports = { runChecks, VALID_TEAMMATE_MODES, runSetup };
