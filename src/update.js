'use strict';

const fs = require('fs');
const path = require('path');
const { mergeSettings } = require('./merge-settings');

const TEMPLATE_DIR = path.join(__dirname, '..', 'template', '.claude');

function filesAreEqual(pathA, pathB) {
  try {
    return fs.readFileSync(pathA, 'utf8') === fs.readFileSync(pathB, 'utf8');
  } catch {
    return false;
  }
}

function copyForceRecursive(src, dest, skipped) {
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyForceRecursive(srcPath, destPath, skipped);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function performUpdate(cwd) {
  const claudeDir = path.join(cwd, '.claude');
  const skippedAgents = [];

  if (!fs.existsSync(path.join(claudeDir, 'raid-rules.md'))) {
    return { success: false, message: 'The Raid is not installed. Run `claude-raid init` first.', skippedAgents };
  }

  // Update agents — skip if user has customized them
  const agentsSrc = path.join(TEMPLATE_DIR, 'agents');
  const agentsDest = path.join(claudeDir, 'agents');
  if (fs.existsSync(agentsSrc)) {
    fs.mkdirSync(agentsDest, { recursive: true });
    const agents = fs.readdirSync(agentsSrc).filter(f => f.endsWith('.md'));
    for (const agent of agents) {
      const srcPath = path.join(agentsSrc, agent);
      const destPath = path.join(agentsDest, agent);
      if (fs.existsSync(destPath) && !filesAreEqual(srcPath, destPath)) {
        skippedAgents.push(agent);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // Update hooks and skills — always overwrite (these are framework code, not user content)
  for (const subdir of ['hooks', 'skills']) {
    const src = path.join(TEMPLATE_DIR, subdir);
    const dest = path.join(claudeDir, subdir);
    if (fs.existsSync(src)) {
      fs.mkdirSync(dest, { recursive: true });
      copyForceRecursive(src, dest, []);
    }
  }

  const rulesSrc = path.join(TEMPLATE_DIR, 'raid-rules.md');
  if (fs.existsSync(rulesSrc)) {
    fs.copyFileSync(rulesSrc, path.join(claudeDir, 'raid-rules.md'));
  }

  const hooksDir = path.join(claudeDir, 'hooks');
  if (fs.existsSync(hooksDir)) {
    const hooks = fs.readdirSync(hooksDir).filter(f => f.endsWith('.sh'));
    for (const hook of hooks) {
      fs.chmodSync(path.join(hooksDir, hook), 0o755);
    }
  }

  mergeSettings(cwd);

  let message = 'The Raid has been updated to the latest version.';
  if (skippedAgents.length > 0) {
    message += `\nSkipped customized agents: ${skippedAgents.join(', ')}`;
    message += '\nUse `claude-raid remove` then `claude-raid init` to reset agents.';
  }

  return { success: true, message, skippedAgents };
}

function run() {
  const cwd = process.cwd();
  console.log('\nclaude-raid — Updating The Raid\n');
  const result = performUpdate(cwd);
  console.log(result.message);
}

module.exports = { performUpdate, run };
