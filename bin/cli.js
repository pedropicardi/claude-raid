#!/usr/bin/env node

'use strict';

const command = process.argv[2];
const { banner, colors, header } = require('../src/ui');
const versionCheck = require('../src/version-check');

// Start non-blocking version check immediately
const showUpdateNotice = versionCheck.start();

const COMMANDS = {
  // Primary commands
  summon: () => require('../src/init').run(),
  update: () => require('../src/update').run(),
  dismantle: () => require('../src/remove').run(),
  heal: () => require('../src/doctor').run(),
  // Aliases (backward compat)
  init: () => require('../src/init').run(),
  remove: () => require('../src/remove').run(),
  doctor: () => require('../src/doctor').run(),
};

if (!command || !COMMANDS[command]) {
  console.log('\n' + banner());
  console.log(header('Commands') + '\n');
  const cmds = [
    ['summon',    'Summon the party into this realm'],
    ['update',    'Reforge the party\'s arsenal'],
    ['dismantle', 'Dismantle the camp and retreat'],
    ['heal',      'Diagnose wounds and prepare for battle'],
  ];
  for (const [name, desc] of cmds) {
    console.log('    ' + colors.bold(name.padEnd(12)) + desc);
  }
  console.log(header('Begin the Raid') + '\n');
  console.log('    claude --agent wizard\n');
  console.log(colors.dim('  github.com/pedropicardi/claude-raid') + '\n');
  process.exit(command ? 1 : 0);
}

Promise.resolve(COMMANDS[command]())
  .then(() => showUpdateNotice(colors))
  .catch((err) => {
    console.error(`\nclaude-raid: ${err.message}\n`);
    process.exit(1);
  });
