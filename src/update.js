'use strict';

const fs = require('fs');
const path = require('path');
const { mergeSettings } = require('./merge-settings');

const TEMPLATE_DIR = path.join(__dirname, '..', 'template', '.claude');

function copyForceRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyForceRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function performUpdate(cwd) {
  const claudeDir = path.join(cwd, '.claude');

  if (!fs.existsSync(path.join(claudeDir, 'raid-rules.md'))) {
    return { success: false, message: 'The Raid is not installed. Run `claude-raid init` first.' };
  }

  for (const subdir of ['agents', 'hooks', 'skills']) {
    const src = path.join(TEMPLATE_DIR, subdir);
    const dest = path.join(claudeDir, subdir);
    if (fs.existsSync(src)) {
      fs.mkdirSync(dest, { recursive: true });
      copyForceRecursive(src, dest);
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

  return { success: true, message: 'The Raid has been updated to the latest version.' };
}

async function run() {
  const cwd = process.cwd();
  console.log('\nclaude-raid — Updating The Raid\n');
  const result = await performUpdate(cwd);
  console.log(result.message);
}

module.exports = { performUpdate, run };
