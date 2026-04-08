'use strict';

const { runChecks, runSetup, formatChecks } = require('./setup');

function diagnose(opts) {
  return runChecks(opts);
}

const REFERENCE_SECTIONS = `
─── Quick Start ───────────────────────────────────

  In-process mode (any terminal):

    claude --agent wizard

  Split-pane mode (tmux):

    tmux new-session -s raid
    claude --agent wizard --teammate-mode tmux

─── Navigating Teammates ──────────────────────────

  Shift+Down    Cycle through teammates
  Enter         View a teammate's session
  Escape        Interrupt a teammate's turn
  Ctrl+T        Toggle the shared task list
  Click pane    Interact directly (split-pane mode)

─── Raid Modes ────────────────────────────────────

  Full Raid     Warrior + Archer + Rogue (3 agents)
  Skirmish      2 agents, lightweight
  Scout         Wizard solo review

  The Wizard recommends a mode based on task
  complexity. You confirm before agents spawn.
`;

async function run() {
  console.log('\nclaude-raid doctor — Environment & Quick Start\n');
  await runSetup();
  console.log(REFERENCE_SECTIONS);
}

module.exports = { diagnose, run };
