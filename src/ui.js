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
};

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function banner() {
  const { amber, boldAmber, boldRed, dim } = colors;
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

  const tagline = '      Adversarial multi-agent warfare for Claude Code';

  const lines = [
    '',
    rule,
    '',
    ...claudeArt.map(l => boldAmber(l)),
    ...raidArt.map(l => boldRed(l)),
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
  const totalWidth = innerWidth + 2; // +2 for border chars

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

const print = {
  success(text) { console.log(`  ${colors.green('✔')} ${text}`); },
  fail(text) { console.log(`  ${colors.red('✖')} ${text}`); },
  info(text) { console.log(`  ${colors.dim('→')} ${text}`); },
  line(text) { console.log(`  ${text}`); },
};

module.exports = { colors, banner, box, header, print, stripAnsi };
