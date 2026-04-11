'use strict';

const fs = require('fs');
const path = require('path');
const { detectProject } = require('./detect-project');
const { mergeSettings } = require('./merge-settings');
const { runSetup } = require('./setup');
const { banner, header, colors } = require('./ui');
const { AGENTS, HOOKS, SKILLS, CONFIG } = require('./descriptions');

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

function install(cwd, opts = {}) {
  const claudeDir = path.join(cwd, '.claude');
  const result = { skipped: [], alreadyInstalled: false, detected: null };

  // Check if already installed
  if (fs.existsSync(path.join(claudeDir, 'party-rules.md'))) {
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

  // Count copied files by category
  const agentsDir = path.join(claudeDir, 'agents');
  const hooksDir2 = path.join(claudeDir, 'hooks');
  const skillsDir = path.join(claudeDir, 'skills');
  result.counts = {
    agents: fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).length : 0,
    hooks: fs.existsSync(hooksDir2) ? fs.readdirSync(hooksDir2).filter(f => f.endsWith('.sh')).length : 0,
    skills: fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).filter(f => !f.startsWith('.')).length : 0,
  };

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
        agentEffort: 'medium',
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
    if (opts.rtkEnabled) {
      raidConfig.rtk = {
        enabled: true,
        bypass: {
          phases: [],
          commands: [],
        },
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
    '.claude/dungeon/',
    '.claude/vault/.draft/',
    '.env.raid',
  ];
  if (fs.existsSync(gitignorePath)) {
    let content = fs.readFileSync(gitignorePath, 'utf8');
    const lines = content.split('\n').map(l => l.trim());
    const toAdd = ignoreEntries.filter(e => !lines.includes(e.trim()));
    if (toAdd.length > 0) {
      const sep = content.endsWith('\n') ? '' : '\n';
      fs.appendFileSync(gitignorePath, sep + toAdd.join('\n') + '\n');
    }
  } else {
    fs.writeFileSync(gitignorePath, ignoreEntries.join('\n') + '\n');
  }

  return result;
}

async function run(opts = {}) {
  const cwd = process.cwd();
  const { bold, dim } = colors;

  console.log('\n' + banner());
  console.log(header('Summoning the Party...') + '\n');

  const result = install(cwd, opts);

  if (result.alreadyInstalled) {
    console.log('  The party is already here. Use ' + bold('claude-raid update') + ' to reforge.');
    console.log('  Proceeding with re-summon...\n');
  }

  // Detection summary
  console.log('  Realm detected: ' + bold(result.detected.language));
  if (result.detected.testCommand) {
    console.log('  Test command:   ' + bold(result.detected.testCommand));
  }
  if (result.detected.lintCommand) {
    console.log('  Lint command:   ' + bold(result.detected.lintCommand));
  }

  // Agents
  console.log('');
  console.log('  ' + header('Agents') + dim(`                                      ${result.counts.agents} files`));
  console.log('    Copied wizard.md, warrior.md, archer.md, rogue.md');
  console.log(dim('    Each agent gets its own tmux pane. Start with:'));
  console.log(dim('    claude-raid start'));

  // Hooks
  console.log('');
  console.log('  ' + header('Hooks') + dim(`                                     ${result.counts.hooks} files`));
  console.log('    Copied ' + bold(`${HOOKS.lifecycle.length} lifecycle hooks`) + ' + ' + bold(`${HOOKS.gates.length} quality gates`));
  console.log(dim('    Lifecycle hooks manage session state automatically.'));
  console.log(dim('    Quality gates block bad commits, missing tests, and'));
  console.log(dim('    placeholder text \u2014 only active during Raid sessions.'));

  // Skills
  console.log('');
  console.log('  ' + header('Skills') + dim(`                                ${result.counts.skills} folders`));
  const skillNames = Object.keys(SKILLS).join(', ');
  console.log('    ' + dim(skillNames));
  console.log(dim('    Phase-specific workflows that guide agent behavior.'));

  // Config
  console.log('');
  console.log('  ' + header('Config'));
  console.log('    Generated ' + bold('raid.json') + '          ' + dim('Project settings (editable)'));
  console.log('    Copied ' + bold('party-rules.md') + '        ' + dim('Party agent rules (editable)'));
  console.log('    Copied ' + bold('dungeon-master-rules.md') + ' ' + dim('Wizard rules (editable)'));
  console.log('    Merged ' + bold('settings.json') + '         ' + dim('Backup at .pre-raid-backup'));

  // Skipped files
  if (result.skipped.length > 0) {
    console.log('');
    console.log('  ' + dim('Preserved existing scrolls:'));
    result.skipped.forEach(f => console.log('    ' + dim('\u2192 ' + path.relative(cwd, f))));
  }

  // Setup wizard
  const setupResult = await runSetup(opts);

  // Apply RTK config if enabled interactively
  if (setupResult.actions.includes('rtk-enabled')) {
    const raidConfigPath = path.join(cwd, '.claude', 'raid.json');
    if (fs.existsSync(raidConfigPath)) {
      const config = JSON.parse(fs.readFileSync(raidConfigPath, 'utf8'));
      if (!config.rtk) {
        config.rtk = { enabled: true, bypass: { phases: [], commands: [] } };
        fs.writeFileSync(raidConfigPath, JSON.stringify(config, null, 2) + '\n');
        mergeSettings(cwd);
      }
    }
  }

  // Reference card
  const { referenceCard } = require('./ui');
  console.log('\n' + referenceCard() + '\n');
}

function dryRun(cwd) {
  const detected = detectProject(cwd);
  const lines = [];

  lines.push(header('Dry Run — nothing will be written') + '\n');

  // Realm
  lines.push('  Realm detected: ' + colors.bold(detected.language));
  if (detected.testCommand) {
    lines.push('  Test command:   ' + colors.bold(detected.testCommand));
  }
  if (detected.lintCommand) {
    lines.push('  Lint command:   ' + colors.bold(detected.lintCommand));
  }
  lines.push('');

  // Helper: check if a file already exists
  const claudeDir = path.join(cwd, '.claude');
  function tag(relPath) {
    const full = path.join(claudeDir, relPath);
    return fs.existsSync(full) ? ' ' + colors.dim('(preserved)') : '';
  }

  // Agents
  lines.push(header('Agents') + '\n');
  for (const [file, desc] of Object.entries(AGENTS)) {
    lines.push('  ' + colors.bold(file.padEnd(14)) + desc + tag('agents/' + file));
  }
  lines.push('');

  // Hooks — Lifecycle
  lines.push(header('Hooks — Lifecycle') + '\n');
  for (const h of HOOKS.lifecycle) {
    lines.push('  ' + colors.bold(h.name.padEnd(28)) + h.desc + tag('hooks/' + h.name));
  }
  lines.push('');

  // Hooks — Quality Gates
  lines.push(header('Hooks — Quality Gates') + '\n');
  for (const h of HOOKS.gates) {
    lines.push('  ' + colors.bold(h.name.padEnd(36)) + h.desc + tag('hooks/' + h.name));
  }
  lines.push('');

  // Hooks — Optional
  if (HOOKS.optional && HOOKS.optional.length > 0) {
    lines.push(header('Hooks \u2014 Optional') + '\n');
    for (const h of HOOKS.optional) {
      lines.push('  ' + colors.bold(h.name.padEnd(28)) + h.desc + tag('hooks/' + h.name));
    }
    lines.push('');
  }

  // Skills
  lines.push(header('Skills') + '\n');
  for (const [folder, desc] of Object.entries(SKILLS)) {
    lines.push('  ' + colors.bold(folder.padEnd(28)) + desc + tag('skills/' + folder));
  }
  lines.push('');

  // Config
  lines.push(header('Config') + '\n');
  for (const [file, desc] of Object.entries(CONFIG)) {
    lines.push('  ' + colors.bold(file.padEnd(20)) + desc + tag(file));
  }
  lines.push('');

  // .gitignore
  lines.push(header('.gitignore entries') + '\n');
  const ignoreEntries = [
    '.claude/raid-last-test-run',
    '.claude/raid-session',
    '.claude/dungeon/',
    '.claude/vault/.draft/',
    '.env.raid',
  ];
  for (const entry of ignoreEntries) {
    lines.push('  ' + colors.dim(entry));
  }
  lines.push('');

  lines.push('  Run without --dry-run to summon.');

  return lines.join('\n');
}

module.exports = { install, run, dryRun };
