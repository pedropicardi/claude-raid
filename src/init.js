'use strict';

const fs = require('fs');
const path = require('path');
const { detectProject } = require('./detect-project');
const { mergeSettings } = require('./merge-settings');

const TEMPLATE_DIR = path.join(__dirname, '..', 'template', '.claude');

function copyRecursive(src, dest, skipped) {
  if (!fs.existsSync(src)) return;

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath, skipped);
    } else {
      if (fs.existsSync(destPath)) {
        skipped.push(destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

async function install(cwd) {
  const claudeDir = path.join(cwd, '.claude');
  const result = { skipped: [], alreadyInstalled: false, detected: null };

  // Check if already installed
  if (fs.existsSync(path.join(claudeDir, 'raid-rules.md'))) {
    result.alreadyInstalled = true;
  }

  // Create .claude directory
  fs.mkdirSync(claudeDir, { recursive: true });

  // Detect project
  const detected = detectProject(cwd);
  result.detected = detected;

  // Copy template files (agents, hooks, skills, raid-rules.md)
  copyRecursive(TEMPLATE_DIR, claudeDir, result.skipped);

  // Make hooks executable
  const hooksDir = path.join(claudeDir, 'hooks');
  if (fs.existsSync(hooksDir)) {
    const hooks = fs.readdirSync(hooksDir).filter(f => f.endsWith('.sh'));
    for (const hook of hooks) {
      const hookPath = path.join(hooksDir, hook);
      fs.chmodSync(hookPath, 0o755);
    }
  }

  // Generate raid.json
  const raidConfig = {
    project: {
      name: detected.name || path.basename(cwd),
      language: detected.language,
      testCommand: detected.testCommand || '',
      lintCommand: detected.lintCommand || '',
      buildCommand: detected.buildCommand || '',
    },
    paths: {
      specs: 'docs/raid/specs',
      plans: 'docs/raid/plans',
      worktrees: '.worktrees',
    },
    conventions: {
      fileNaming: 'none',
      commits: 'conventional',
    },
    raid: {
      defaultMode: 'full',
    },
  };
  fs.writeFileSync(
    path.join(claudeDir, 'raid.json'),
    JSON.stringify(raidConfig, null, 2) + '\n'
  );

  // Merge settings
  mergeSettings(cwd);

  // Add raid-last-test-run to .gitignore
  const gitignorePath = path.join(cwd, '.gitignore');
  const ignoreEntry = '.claude/raid-last-test-run';
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    if (!content.includes(ignoreEntry)) {
      fs.appendFileSync(gitignorePath, '\n' + ignoreEntry + '\n');
    }
  } else {
    fs.writeFileSync(gitignorePath, ignoreEntry + '\n');
  }

  return result;
}

async function run() {
  const cwd = process.cwd();
  console.log('\nclaude-raid — Installing The Raid\n');

  const result = await install(cwd);

  if (result.alreadyInstalled) {
    console.log('The Raid is already installed. Use `claude-raid update` to update.');
    console.log('Proceeding with re-install...\n');
  }

  console.log(`Detected: ${result.detected.language}`);
  if (result.detected.testCommand) {
    console.log(`Test command: ${result.detected.testCommand}`);
  }
  if (result.skipped.length > 0) {
    console.log(`\nSkipped (existing files):`);
    result.skipped.forEach(f => console.log(`  - ${path.relative(cwd, f)}`));
  }

  console.log(`
The Raid is installed. Start with:

  claude --agent wizard

Or with tmux split panes:

  claude --agent wizard --teammate-mode tmux

Configuration: .claude/raid.json (edit to customize)
Team rules: .claude/raid-rules.md (editable)
`);
}

module.exports = { install, run };
