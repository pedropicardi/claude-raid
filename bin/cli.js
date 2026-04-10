#!/usr/bin/env node

'use strict';

const command = process.argv[2];
const { banner, colors, header } = require('../src/ui');
const versionCheck = require('../src/version-check');

// Start non-blocking version check immediately
const showUpdateNotice = versionCheck.start();

const COMMANDS = {
  // Start a Raid quest — launches wizard with full permissions
  start: () => {
    const { spawn } = require('child_process');
    console.log('\n' + banner());
    console.log(header('Summoning the Wizard...') + '\n');
    const child = spawn('claude', ['--dangerously-skip-permissions', '--agent', 'wizard'], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => process.exit(code || 0));
  },
  // Sync local with remote after CI version bump
  sync: async () => {
    const { execSync } = require('child_process');
    console.log('\n' + banner());
    console.log(header('Syncing with remote...') + '\n');
    try {
      execSync('git pull origin main', { stdio: 'inherit' });
      console.log('');
      return require('../src/init').run();
    } catch (err) {
      console.error('  ' + colors.red('Pull failed. Resolve conflicts first.'));
      process.exit(1);
    }
  },
  // Primary commands
  summon: () => {
    if (process.argv.includes('--dry-run')) {
      console.log('\n' + banner());
      console.log(require('../src/init').dryRun(process.cwd()));
      return;
    }
    return require('../src/init').run();
  },
  update: () => require('../src/update').run(),
  dismantle: () => require('../src/remove').run(),
  heal: () => require('../src/doctor').run(),
  // Aliases (backward compat)
  init: () => {
    if (process.argv.includes('--dry-run')) {
      console.log('\n' + banner());
      console.log(require('../src/init').dryRun(process.cwd()));
      return;
    }
    return require('../src/init').run();
  },
  remove: () => require('../src/remove').run(),
  doctor: () => require('../src/doctor').run(),
};

if (!command || !COMMANDS[command]) {
  console.log('\n' + banner());
  console.log(header('Commands') + '\n');
  const cmds = [
    ['start',     'Begin the Raid (launches Wizard)'],
    ['summon',    'Summon the party into this realm'],
    ['update',    'Reforge the party\'s arsenal'],
    ['dismantle', 'Dismantle the camp and retreat'],
    ['heal',      'Diagnose wounds and prepare for battle'],
    ['sync',      'Pull latest from remote + re-summon'],
  ];
  for (const [name, desc] of cmds) {
    console.log('    ' + colors.bold(name.padEnd(12)) + desc);
  }
  console.log(header('Begin the Raid') + '\n');
  console.log('    claude-raid start\n');
  console.log(colors.dim('  github.com/pedropicardi/claude-raid') + '\n');
  process.exit(command ? 1 : 0);
}

Promise.resolve(COMMANDS[command]())
  .then(() => showUpdateNotice(colors))
  .catch((err) => {
    console.error(`\nclaude-raid: ${err.message}\n`);
    process.exit(1);
  });
