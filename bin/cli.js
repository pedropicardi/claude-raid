#!/usr/bin/env node

'use strict';

const command = process.argv[2];

const COMMANDS = {
  init: () => require('../src/init').run(),
  update: () => require('../src/update').run(),
  remove: () => require('../src/remove').run(),
};

if (!command || !COMMANDS[command]) {
  console.log(`
claude-raid — Adversarial multi-agent development for Claude Code

Usage:
  claude-raid init     Install The Raid into the current project
  claude-raid update   Update to the latest version
  claude-raid remove   Uninstall The Raid

Learn more: https://github.com/pedropicardi/claude-raid
`);
  process.exit(command ? 1 : 0);
}

COMMANDS[command]();
