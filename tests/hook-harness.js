'use strict';

const { execSync } = require('child_process');
const path = require('path');

const HOOKS_DIR = path.join(__dirname, '..', 'template', '.claude', 'hooks');

/**
 * Run a hook with mock input and optional raid.json config.
 * @param {string} hookName - e.g. 'validate-file-naming.sh'
 * @param {object} input - The JSON input to pipe to the hook
 * @param {object} [options]
 * @param {string} [options.cwd] - Working directory (defaults to a temp dir)
 * @param {object} [options.raidConfig] - Content for .claude/raid.json
 * @returns {{ exitCode: number, stderr: string, stdout: string }}
 */
function runHook(hookName, input, options = {}) {
  const hookPath = path.join(HOOKS_DIR, hookName);
  const cwd = options.cwd || process.cwd();

  // Write raid.json if provided
  if (options.raidConfig) {
    const fs = require('fs');
    const configDir = path.join(cwd, '.claude');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'raid.json'),
      JSON.stringify(options.raidConfig, null, 2)
    );
  }

  const inputJson = JSON.stringify(input);

  try {
    const stdout = execSync(`echo '${inputJson.replace(/'/g, "'\\''")}' | bash "${hookPath}"`, {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stderr: '', stdout };
  } catch (err) {
    return {
      exitCode: err.status,
      stderr: err.stderr || '',
      stdout: err.stdout || '',
    };
  }
}

module.exports = { runHook, HOOKS_DIR };
