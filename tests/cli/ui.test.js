'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

function loadUi(env = {}) {
  const modPath = require.resolve('../../src/ui');
  delete require.cache[modPath];
  const origEnv = {};
  for (const [k, v] of Object.entries(env)) {
    origEnv[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const origTTY = process.stdout.isTTY;
  if (env._forceTTY !== undefined) {
    process.stdout.isTTY = env._forceTTY;
  }
  const ui = require('../../src/ui');
  for (const [k, v] of Object.entries(origEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  process.stdout.isTTY = origTTY;
  return ui;
}

describe('ui', () => {
  describe('colors (with color enabled)', () => {
    function getColors() {
      return loadUi({ NO_COLOR: undefined, _forceTTY: true }).colors;
    }

    it('amber wraps with ANSI yellow code', () => {
      const { amber } = getColors();
      assert.strictEqual(amber('hello'), '\x1b[33mhello\x1b[0m');
    });

    it('green wraps with ANSI green code', () => {
      const { green } = getColors();
      assert.strictEqual(green('hello'), '\x1b[32mhello\x1b[0m');
    });

    it('red wraps with ANSI red code', () => {
      const { red } = getColors();
      assert.strictEqual(red('hello'), '\x1b[31mhello\x1b[0m');
    });

    it('dim wraps with ANSI gray code', () => {
      const { dim } = getColors();
      assert.strictEqual(dim('hello'), '\x1b[90mhello\x1b[0m');
    });

    it('bold wraps with ANSI bold code', () => {
      const { bold } = getColors();
      assert.strictEqual(bold('hello'), '\x1b[1mhello\x1b[0m');
    });
  });

  describe('colors (NO_COLOR set)', () => {
    it('all colors return plain strings when NO_COLOR is set', () => {
      const { colors } = loadUi({ NO_COLOR: '1', _forceTTY: true });
      assert.strictEqual(colors.amber('hello'), 'hello');
      assert.strictEqual(colors.green('hello'), 'hello');
      assert.strictEqual(colors.red('hello'), 'hello');
      assert.strictEqual(colors.dim('hello'), 'hello');
      assert.strictEqual(colors.bold('hello'), 'hello');
    });
  });

  describe('stripAnsi', () => {
    it('removes ANSI codes from a string', () => {
      const { stripAnsi } = loadUi({ NO_COLOR: undefined, _forceTTY: true });
      const input = '\x1b[33mhello\x1b[0m \x1b[1mworld\x1b[0m';
      assert.strictEqual(stripAnsi(input), 'hello world');
    });
  });

  describe('banner', () => {
    it('contains block characters and box-drawing', () => {
      const { banner } = loadUi({ NO_COLOR: '1', _forceTTY: true });
      const output = banner();
      assert.ok(output.includes('██'), 'should contain block characters');
      assert.ok(output.includes('╔'), 'should contain top-left corner');
      assert.ok(output.includes('╚'), 'should contain bottom-left corner');
    });

    it('contains tagline text', () => {
      const { banner } = loadUi({ NO_COLOR: '1', _forceTTY: true });
      const output = banner();
      assert.ok(output.includes('Adversarial'), 'should contain "Adversarial"');
      assert.ok(output.includes('Claude Code'), 'should contain "Claude Code"');
    });

    it('banner uses gradient colors from amber to red', () => {
      const { banner } = loadUi({ NO_COLOR: undefined, _forceTTY: true });
      const output = banner();
      assert.ok(output.includes('\x1b[1;33m'), 'should contain bold amber');
      assert.ok(output.includes('\x1b[33m'), 'should contain amber');
      assert.ok(output.includes('\x1b[1;31m'), 'should contain bold red');
      assert.ok(output.includes('\x1b[31m'), 'should contain red');
      assert.ok(output.includes('\x1b[2;31m'), 'should contain dim red');
    });

    it('banner tagline says "development" not "warfare"', () => {
      const { banner } = loadUi({ NO_COLOR: '1', _forceTTY: true });
      const output = banner();
      assert.ok(output.includes('Adversarial multi-agent development for Claude Code'));
    });
  });

  describe('box', () => {
    it('produces box-drawing characters', () => {
      const { box } = loadUi({ NO_COLOR: '1', _forceTTY: true });
      const output = box('Test', ['line 1']);
      assert.ok(output.includes('┌'), 'should contain top-left corner');
      assert.ok(output.includes('┐'), 'should contain top-right corner');
      assert.ok(output.includes('└'), 'should contain bottom-left corner');
      assert.ok(output.includes('┘'), 'should contain bottom-right corner');
      assert.ok(output.includes('│'), 'should contain vertical bar');
    });

    it('includes title and content text', () => {
      const { box } = loadUi({ NO_COLOR: '1', _forceTTY: true });
      const output = box('My Title', ['content here', 'more content']);
      assert.ok(output.includes('My Title'), 'should contain title');
      assert.ok(output.includes('content here'), 'should contain content');
      assert.ok(output.includes('more content'), 'should contain more content');
    });

    it('auto-sizes so top and bottom borders have same length', () => {
      const { box, stripAnsi } = loadUi({ NO_COLOR: '1', _forceTTY: true });
      const output = box('Title', ['short', 'a much longer content line here']);
      const lines = output.split('\n').filter(Boolean);
      const topLen = stripAnsi(lines[0]).length;
      const bottomLen = stripAnsi(lines[lines.length - 1]).length;
      assert.strictEqual(topLen, bottomLen, 'top and bottom borders should be same length');
    });
  });

  describe('header', () => {
    it('includes sword emoji and text', () => {
      const { header } = loadUi({ NO_COLOR: '1', _forceTTY: true });
      const output = header('Battle Plan');
      assert.ok(output.includes('⚔'), 'should contain sword emoji');
      assert.ok(output.includes('Battle Plan'), 'should contain text');
    });
  });

  describe('referenceCard', () => {
    it('returns a string with How It Works and Next Step sections', () => {
      const { referenceCard } = loadUi({ NO_COLOR: '1', _forceTTY: true });
      const output = referenceCard();
      assert.ok(output.includes('How It Works'), 'should contain How It Works');
      assert.ok(output.includes('Next Step'), 'should contain Next Step');
    });

    it('contains team description', () => {
      const { referenceCard } = loadUi({ NO_COLOR: '1', _forceTTY: true });
      const output = referenceCard();
      assert.ok(output.includes('Warrior'), 'should mention Warrior');
      assert.ok(output.includes('Archer'), 'should mention Archer');
      assert.ok(output.includes('Rogue'), 'should mention Rogue');
    });

    it('contains phase descriptions', () => {
      const { referenceCard } = loadUi({ NO_COLOR: '1', _forceTTY: true });
      const output = referenceCard();
      assert.ok(output.includes('Design'), 'should contain Design');
      assert.ok(output.includes('Plan'), 'should contain Plan');
      assert.ok(output.includes('Implement'), 'should contain Implement');
      assert.ok(output.includes('Review'), 'should contain Review');
    });

    it('contains hook enforcement summary', () => {
      const { referenceCard } = loadUi({ NO_COLOR: '1', _forceTTY: true });
      const output = referenceCard();
      assert.ok(output.includes('design doc'), 'should mention design doc gate');
      assert.ok(output.includes('passing tests'), 'should mention test gate');
    });

    it('contains next step command', () => {
      const { referenceCard } = loadUi({ NO_COLOR: '1', _forceTTY: true });
      const output = referenceCard();
      assert.ok(output.includes('claude-raid start'), 'should contain entry command');
    });

    it('contains tmux controls', () => {
      const { referenceCard } = loadUi({ NO_COLOR: '1', _forceTTY: true });
      const output = referenceCard();
      assert.ok(output.includes('Click pane'), 'should contain tmux pane navigation');
      assert.ok(output.includes('Mouse wheel'), 'should contain mouse scroll');
    });

    it('contains heal command hint', () => {
      const { referenceCard } = loadUi({ NO_COLOR: '1', _forceTTY: true });
      const output = referenceCard();
      assert.ok(output.includes('claude-raid heal'), 'should mention heal command');
    });
  });
});
