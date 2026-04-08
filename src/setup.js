'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

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

const MIN_CLAUDE = { major: 2, minor: 1, patch: 32 };
const VALID_TEAMMATE_MODES = ['tmux', 'in-process', 'auto'];

// --- Check functions (private) ---

function checkNode() {
  const v = process.version;
  return { id: 'node', ok: true, label: 'Node.js', detail: v };
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

// --- Exports ---

function runChecks(opts = {}) {
  const homedir = opts.homedir || os.homedir();
  const exec = opts.exec || tryExec;

  const checks = [
    checkNode(),
    checkClaude(exec),
    checkTeammateMode(homedir),
    checkSplitPane(exec),
  ];

  return {
    checks,
    allOk: checks.every(c => c.ok),
  };
}

function formatChecks(checks) {
  const lines = [];
  const maxLabel = Math.max(...checks.map(c => c.label.length));

  for (const check of checks) {
    const icon = check.ok ? '✔' : '✖';
    const pad = ' '.repeat(maxLabel - check.label.length + 2);
    lines.push(`  ${icon} ${check.label}${pad}${check.detail}`);
    if (check.hint) {
      lines.push(`    → ${check.hint}`);
    }
  }
  return lines.join('\n');
}

module.exports = { runChecks, formatChecks, VALID_TEAMMATE_MODES };
