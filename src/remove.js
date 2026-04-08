'use strict';

const fs = require('fs');
const path = require('path');
const { removeRaidSettings } = require('./merge-settings');
const { banner, header, colors } = require('./ui');

const RAID_AGENTS = ['wizard.md', 'warrior.md', 'archer.md', 'rogue.md'];
const RAID_SKILLS = [
  'raid-protocol', 'raid-design', 'raid-implementation-plan', 'raid-implementation',
  'raid-review', 'raid-finishing', 'raid-tdd', 'raid-debugging',
  'raid-verification', 'raid-git-worktrees',
  'raid-browser', 'raid-browser-playwright', 'raid-browser-chrome',
];

function rmSafe(filePath) {
  try { fs.unlinkSync(filePath); } catch {}
}

function rmDirSafe(dirPath) {
  try { fs.rmSync(dirPath, { recursive: true }); } catch {}
}

function rmDirIfEmpty(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath);
    if (entries.length === 0) fs.rmdirSync(dirPath);
  } catch {}
}

function performRemove(cwd) {
  const claudeDir = path.join(cwd, '.claude');

  for (const agent of RAID_AGENTS) {
    rmSafe(path.join(claudeDir, 'agents', agent));
  }

  const hooksDir = path.join(claudeDir, 'hooks');
  if (fs.existsSync(hooksDir)) {
    const hooks = fs.readdirSync(hooksDir).filter(f =>
      (f.startsWith('validate-') || f.startsWith('raid-')) && f.endsWith('.sh')
    );
    for (const hook of hooks) {
      rmSafe(path.join(hooksDir, hook));
    }
  }

  for (const skill of RAID_SKILLS) {
    rmDirSafe(path.join(claudeDir, 'skills', skill));
  }

  // Clean up empty directories
  rmDirIfEmpty(path.join(claudeDir, 'agents'));
  rmDirIfEmpty(path.join(claudeDir, 'hooks'));
  rmDirIfEmpty(path.join(claudeDir, 'skills'));

  rmSafe(path.join(claudeDir, 'raid-rules.md'));
  rmSafe(path.join(claudeDir, 'raid.json'));
  rmSafe(path.join(claudeDir, 'raid-last-test-run'));
  rmSafe(path.join(claudeDir, 'raid-session'));

  // Clean up Dungeon files
  rmSafe(path.join(claudeDir, 'raid-dungeon.md'));
  if (fs.existsSync(claudeDir)) {
    const dungeonFiles = fs.readdirSync(claudeDir).filter(f => f.startsWith('raid-dungeon-phase-'));
    for (const file of dungeonFiles) {
      rmSafe(path.join(claudeDir, file));
    }
  }

  // Clean up Dungeon backups
  rmSafe(path.join(claudeDir, 'raid-dungeon-backup.md'));
  if (fs.existsSync(claudeDir)) {
    const backupFiles = fs.readdirSync(claudeDir).filter(f => f.startsWith('raid-dungeon-phase-') && f.endsWith('-backup.md'));
    for (const file of backupFiles) {
      rmSafe(path.join(claudeDir, file));
    }
  }

  // Clean up Vault draft
  rmDirSafe(path.join(claudeDir, 'vault', '.draft'));

  removeRaidSettings(cwd);

  // Clean .gitignore entries
  const gitignorePath = path.join(cwd, '.gitignore');
  const raidIgnoreEntries = [
    '.claude/raid-last-test-run', '.claude/raid-session',
    '.claude/raid-dungeon.md', '.claude/raid-dungeon-phase-*',
    '.claude/raid-dungeon-backup.md', '.claude/raid-dungeon-phase-*-backup.md',
    '.claude/vault/.draft/',
    '.env.raid',
  ];
  if (fs.existsSync(gitignorePath)) {
    const lines = fs.readFileSync(gitignorePath, 'utf8').split('\n');
    const filtered = lines.filter(line => !raidIgnoreEntries.includes(line.trim()));
    // Remove trailing blank lines caused by removal
    while (filtered.length > 0 && filtered[filtered.length - 1] === '') {
      filtered.pop();
    }
    fs.writeFileSync(gitignorePath, filtered.join('\n') + '\n');
  }

  return { success: true };
}

function run() {
  const cwd = process.cwd();
  console.log('\n' + banner());
  console.log(header('Dismantling the Camp...') + '\n');
  performRemove(cwd);
  console.log('  ' + colors.green('✔') + ' The camp has been dismantled.');
  console.log('  ' + colors.dim('Your realm has been restored to its former state.') + '\n');
}

module.exports = { performRemove, run };
