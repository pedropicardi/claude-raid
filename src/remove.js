'use strict';

const fs = require('fs');
const path = require('path');
const { removeRaidSettings } = require('./merge-settings');

const RAID_AGENTS = ['wizard.md', 'warrior.md', 'archer.md', 'rogue.md'];
const RAID_SKILLS = [
  'raid-protocol', 'raid-design', 'raid-implementation-plan', 'raid-implementation',
  'raid-review', 'raid-finishing', 'raid-tdd', 'raid-debugging',
  'raid-verification', 'raid-git-worktrees',
];

function rmSafe(filePath) {
  try { fs.unlinkSync(filePath); } catch {}
}

function rmDirSafe(dirPath) {
  try { fs.rmSync(dirPath, { recursive: true }); } catch {}
}

function performRemove(cwd) {
  const claudeDir = path.join(cwd, '.claude');

  for (const agent of RAID_AGENTS) {
    rmSafe(path.join(claudeDir, 'agents', agent));
  }

  const hooksDir = path.join(claudeDir, 'hooks');
  if (fs.existsSync(hooksDir)) {
    const hooks = fs.readdirSync(hooksDir).filter(f => f.startsWith('validate-') && f.endsWith('.sh'));
    for (const hook of hooks) {
      rmSafe(path.join(hooksDir, hook));
    }
  }

  for (const skill of RAID_SKILLS) {
    rmDirSafe(path.join(claudeDir, 'skills', skill));
  }

  rmSafe(path.join(claudeDir, 'raid-rules.md'));
  rmSafe(path.join(claudeDir, 'raid.json'));
  rmSafe(path.join(claudeDir, 'raid-last-test-run'));

  removeRaidSettings(cwd);

  return { success: true };
}

function run() {
  const cwd = process.cwd();
  console.log('\nclaude-raid — Removing The Raid\n');
  performRemove(cwd);
  console.log('The Raid has been removed. Your project settings have been restored.');
}

module.exports = { performRemove, run };
