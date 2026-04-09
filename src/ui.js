'use strict';

// Color support detection (evaluated once at module load)
const noColor = ('NO_COLOR' in process.env) || !process.stdout.isTTY;

function wrap(code) {
  if (noColor) return (str) => str;
  return (str) => `\x1b[${code}m${str}\x1b[0m`;
}

const colors = {
  amber: wrap('33'),
  green: wrap('32'),
  red: wrap('31'),
  dim: wrap('90'),
  bold: wrap('1'),
  boldAmber: wrap('1;33'),
  boldRed: wrap('1;31'),
  dimRed: wrap('2;31'),
};

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function banner() {
  const { amber, boldAmber, boldRed, red, dimRed, dim } = colors;
  const rule = amber('  ⚔ ═══════════════════════════════════════════════════════ ⚔');

  const claudeArt = [
    '      ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗',
    '     ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝',
    '     ██║     ██║     ███████║██║   ██║██║  ██║█████╗  ',
    '     ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝  ',
    '     ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗',
    '      ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝',
  ];

  const raidArt = [
    '              ██████╗  █████╗ ██╗██████╗ ',
    '              ██╔══██╗██╔══██╗██║██╔══██╗',
    '              ██████╔╝███████║██║██║  ██║',
    '              ██╔══██╗██╔══██║██║██║  ██║',
    '              ██║  ██║██║  ██║██║██████╔╝',
    '              ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═════╝ ',
  ];

  // 5-tone vertical gradient: boldAmber -> amber -> boldRed -> red -> dimRed
  // Lines 1-2 (CLAUDE top): boldAmber
  // Lines 3-5 (CLAUDE bottom + transition): amber
  // Line 6 (CLAUDE/RAID boundary): boldRed
  // Lines 7-8 (RAID top): boldRed
  // Lines 9-11 (RAID middle): red
  // Line 12 (RAID bottom): dimRed
  const gradientColors = [
    boldAmber, boldAmber,       // claudeArt[0-1]
    amber, amber, amber,        // claudeArt[2-4]
    boldRed,                    // claudeArt[5]
    boldRed, boldRed,           // raidArt[0-1]
    red, red, red,              // raidArt[2-4]
    dimRed,                     // raidArt[5]
  ];

  const allArt = [...claudeArt, ...raidArt];
  const tagline = '      Adversarial multi-agent development for Claude Code';

  const lines = [
    '',
    rule,
    '',
    ...allArt.map((l, i) => gradientColors[i](l)),
    '',
    dim(tagline),
    '',
    rule,
    '',
  ];

  return lines.join('\n');
}

function box(title, contentLines) {
  const { amber } = colors;
  const PADDING = 2; // left padding inside box
  const titleStr = ` \u2694 ${title} `;

  // Calculate width: fit widest content + padding on both sides, or title
  let maxContent = 0;
  for (const line of contentLines) {
    const w = stripAnsi(line).length;
    if (w > maxContent) maxContent = w;
  }
  const innerWidth = Math.max(maxContent + PADDING * 2, titleStr.length + 4);
  // Top border: ┌─── ⚔ Title ───...─┐
  const titleDashesAfter = innerWidth - titleStr.length - 3;
  const topBorder = amber('┌') + amber('───') + titleStr + amber('─'.repeat(Math.max(0, titleDashesAfter))) + amber('┐');

  // Bottom border
  const botBorder = amber('└') + amber('─'.repeat(innerWidth)) + amber('┘');

  // Empty line
  const emptyLine = amber('│') + ' '.repeat(innerWidth) + amber('│');

  const lines = [topBorder, emptyLine];
  for (const content of contentLines) {
    const visLen = stripAnsi(content).length;
    const rightPad = innerWidth - PADDING - visLen;
    lines.push(amber('│') + ' '.repeat(PADDING) + content + ' '.repeat(Math.max(0, rightPad)) + amber('│'));
  }
  lines.push(emptyLine, botBorder);

  return lines.join('\n');
}

function header(text) {
  const { amber, bold } = colors;
  return `  ${amber(bold(`\u2694 ${text}`))}`;
}

function referenceCard() {
  const howItWorks = box('How It Works', [
    '  You describe a task. The Wizard assesses complexity and',
    '  recommends a mode:',
    '',
    '  ' + colors.bold('Full Raid') + '    3 agents attack from competing angles',
    '  ' + colors.bold('Skirmish') + '     2 agents, lighter process',
    '  ' + colors.bold('Scout') + '        1 agent + Wizard review',
    '',
    '  Every task flows through 4 phases:',
    '',
    '  1. ' + colors.bold('Design') + '     Agents explore and challenge the approach',
    '  2. ' + colors.bold('Plan') + '       Agents decompose into testable tasks',
    '  3. ' + colors.bold('Implement') + '  One builds (TDD), others attack',
    '  4. ' + colors.bold('Review') + '     Independent reviews, fight over findings',
    '',
    '  Hooks enforce discipline automatically:',
    '  ' + colors.dim('\u2022') + ' No implementation without a design doc',
    '  ' + colors.dim('\u2022') + ' No commits without passing tests',
    '  ' + colors.dim('\u2022') + ' No completion claims without fresh test evidence',
    '  ' + colors.dim('\u2022') + ' Conventional commit messages required',
    '',
    '  ' + colors.dim('Hooks only activate during Raid sessions \u2014 they won\'t'),
    '  ' + colors.dim('interfere with normal coding outside of a Raid.'),
    '',
    '  Config:  ' + colors.bold('.claude/raid.json') + '       ' + colors.dim('project settings'),
    '  Rules:   ' + colors.bold('.claude/raid-rules.md') + '   ' + colors.dim('editable team rules'),
  ]);

  const nextStep = box('Next Step', [
    '  ' + colors.bold('tmux new-session -s raid'),
    '  ' + colors.bold('claude --agent wizard'),
    '',
    '  ' + colors.dim('Start tmux first, then the Wizard inside it.'),
    '  ' + colors.dim('Each agent gets its own tmux pane automatically.'),
    '  ' + colors.dim('Click any pane to talk to that agent directly.'),
    '',
    '  ' + colors.dim('Tip: start with a small task (bugfix, config change) to'),
    '  ' + colors.dim('see the workflow before tackling something complex.'),
    '',
    '  ' + colors.bold('Controls') + '  ' + colors.dim('(tmux)'),
    '  Click pane      Switch to an agent',
    '  Ctrl+B + arrow  Navigate between panes',
    '',
    '  ' + colors.bold('Controls') + '  ' + colors.dim('(in-process, no tmux)'),
    '  Shift+Down      Cycle through teammates',
    '  Ctrl+T          Toggle the shared task list',
    '',
    '  Review this anytime:  ' + colors.bold('claude-raid heal'),
  ]);

  return howItWorks + '\n' + nextStep;
}

module.exports = { colors, banner, box, header, stripAnsi, referenceCard };
