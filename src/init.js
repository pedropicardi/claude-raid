'use strict';

const fs = require('fs');
const path = require('path');
const { detectProject } = require('./detect-project');
const { mergeSettings } = require('./merge-settings');
const { runSetup } = require('./setup');
const { banner, header, colors } = require('./ui');

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

function install(cwd) {
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

  // Generate raid.json (skip if it already exists to preserve user config)
  const raidConfigPath = path.join(claudeDir, 'raid.json');
  if (!fs.existsSync(raidConfigPath)) {
    const raidConfig = {
      project: {
        name: detected.name || path.basename(cwd),
        language: detected.language,
        packageManager: detected.packageManager || undefined,
        runCommand: detected.runCommand || undefined,
        execCommand: detected.execCommand || undefined,
        installCommand: detected.installCommand || undefined,
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
        vault: {
          path: '.claude/vault',
          enabled: true,
        },
        lifecycle: {
          autoSessionManagement: true,
          teammateNudge: true,
          taskValidation: true,
          completionGate: true,
          phaseTransitionConfirm: true,
          compactBackup: true,
          testWindowMinutes: 10,
        },
      },
    };
    Object.keys(raidConfig.project).forEach(key => {
      if (raidConfig.project[key] === undefined) {
        delete raidConfig.project[key];
      }
    });
    if (detected.browser) {
      raidConfig.browser = {
        enabled: true,
        framework: detected.browser.framework,
        devCommand: detected.browser.devCommand,
        baseUrl: `http://localhost:${detected.browser.defaultPort}`,
        defaultPort: detected.browser.defaultPort,
        portRange: [detected.browser.defaultPort + 1, detected.browser.defaultPort + 5],
        playwrightConfig: 'playwright.config.ts',
        auth: null,
        startup: null,
      };
    }
    fs.writeFileSync(raidConfigPath, JSON.stringify(raidConfig, null, 2) + '\n');
  }

  // Merge settings
  mergeSettings(cwd);

  // Add raid-last-test-run to .gitignore
  const gitignorePath = path.join(cwd, '.gitignore');
  const ignoreEntries = [
    '.claude/raid-last-test-run',
    '.claude/raid-session',
    '.claude/raid-dungeon.md',
    '.claude/raid-dungeon-phase-*',
    '.claude/raid-dungeon-backup.md',
    '.claude/raid-dungeon-phase-*-backup.md',
    '.claude/vault/.draft/',
    '.env.raid',
  ];
  if (fs.existsSync(gitignorePath)) {
    let content = fs.readFileSync(gitignorePath, 'utf8');
    const toAdd = ignoreEntries.filter(e => !content.includes(e));
    if (toAdd.length > 0) {
      const sep = content.endsWith('\n') ? '' : '\n';
      fs.appendFileSync(gitignorePath, sep + toAdd.join('\n') + '\n');
    }
  } else {
    fs.writeFileSync(gitignorePath, ignoreEntries.join('\n') + '\n');
  }

  return result;
}

async function run() {
  const cwd = process.cwd();
  console.log('\n' + banner());
  console.log(header('Summoning the Party...') + '\n');

  const result = install(cwd);

  if (result.alreadyInstalled) {
    console.log('  The party is already here. Use ' + colors.bold('claude-raid update') + ' to reforge.');
    console.log('  Proceeding with re-summon...\n');
  }

  console.log('  Realm detected: ' + colors.bold(result.detected.language));
  if (result.detected.testCommand) {
    console.log('  Battle cry:     ' + colors.bold(result.detected.testCommand));
  }
  if (result.skipped.length > 0) {
    console.log('\n  ' + colors.dim('Preserved existing scrolls:'));
    result.skipped.forEach(f => console.log('    ' + colors.dim('→ ' + path.relative(cwd, f))));
  }

  await runSetup();
}

module.exports = { install, run };
