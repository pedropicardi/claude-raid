'use strict';

const { runChecks, runSetup } = require('./setup');
const { banner, box, header, colors } = require('./ui');

function diagnose(opts) {
  return runChecks(opts);
}

async function run() {
  console.log('\n' + banner());
  console.log(header('Diagnosing Wounds...') + '\n');

  const result = await runSetup();

  if (!result.allOk && !process.stdin.isTTY) {
    process.exitCode = 1;
  }

  const quickStart = box('Quick Start', [
    '  In-process mode (any terminal):',
    '    ' + colors.bold('claude --agent wizard'),
    '',
    '  Split-pane mode (tmux):',
    '    ' + colors.bold('tmux new-session -s raid'),
    '    ' + colors.bold('claude --agent wizard --teammate-mode tmux'),
  ]);
  console.log('\n' + quickStart);

  const controls = box('Controls', [
    '  ' + colors.bold('Shift+Down') + '    Cycle through teammates',
    '  ' + colors.bold('Enter') + '         View a teammate\'s session',
    '  ' + colors.bold('Escape') + '        Interrupt a teammate\'s turn',
    '  ' + colors.bold('Ctrl+T') + '        Toggle the shared task list',
    '  ' + colors.bold('Click pane') + '    Interact directly (split-pane)',
  ]);
  console.log('\n' + controls);

  const modes = box('Raid Modes', [
    '  ' + colors.bold('Full Raid') + '     Warrior + Archer + Rogue (3 agents)',
    '  ' + colors.bold('Skirmish') + '      2 agents, lightweight',
    '  ' + colors.bold('Scout') + '         Wizard solo review',
    '',
    '  The Wizard recommends a mode based on task',
    '  complexity. You confirm before agents spawn.',
  ]);
  console.log('\n' + modes + '\n');
}

module.exports = { diagnose, run };
