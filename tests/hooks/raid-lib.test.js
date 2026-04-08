'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const RAID_LIB = path.resolve(__dirname, '../../template/.claude/hooks/raid-lib.sh');

let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-lib-'));
  return tmpDir;
}

/**
 * Source raid-lib.sh from a temp directory and print exported variables.
 * Returns an object with all RAID_* env vars.
 */
function sourceLib(cwd, { stdin } = {}) {
  const script = `
    cd "${cwd}"
    source "${RAID_LIB}"
    echo "RAID_ACTIVE=$RAID_ACTIVE"
    echo "RAID_PHASE=$RAID_PHASE"
    echo "RAID_MODE=$RAID_MODE"
    echo "RAID_CURRENT_AGENT=$RAID_CURRENT_AGENT"
    echo "RAID_IMPLEMENTER=$RAID_IMPLEMENTER"
    echo "RAID_TASK=$RAID_TASK"
    echo "RAID_TEST_CMD=$RAID_TEST_CMD"
    echo "RAID_NAMING=$RAID_NAMING"
    echo "RAID_MAX_DEPTH=$RAID_MAX_DEPTH"
    echo "RAID_COMMIT_MIN_LENGTH=$RAID_COMMIT_MIN_LENGTH"
    echo "RAID_SPECS_PATH=$RAID_SPECS_PATH"
    echo "RAID_PLANS_PATH=$RAID_PLANS_PATH"
    echo "RAID_BROWSER_ENABLED=$RAID_BROWSER_ENABLED"
    echo "RAID_BROWSER_PORT_START=$RAID_BROWSER_PORT_START"
    echo "RAID_BROWSER_PORT_END=$RAID_BROWSER_PORT_END"
    echo "RAID_BROWSER_EXEC_CMD=$RAID_BROWSER_EXEC_CMD"
    echo "RAID_BROWSER_PW_CONFIG=$RAID_BROWSER_PW_CONFIG"
  `;
  const result = execSync(`bash -c '${script.replace(/'/g, "'\\''")}'`, {
    cwd,
    encoding: 'utf8',
    input: stdin,
    timeout: 5000,
  });
  const vars = {};
  for (const line of result.trim().split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0) {
      vars[line.slice(0, eq)] = line.slice(eq + 1);
    }
  }
  return vars;
}

/**
 * Source raid-lib.sh and capture stderr output.
 */
function sourceLibStderr(cwd) {
  const script = `
    cd "${cwd}"
    source "${RAID_LIB}" 2>/tmp/raid-lib-stderr
    cat /tmp/raid-lib-stderr
  `;
  return execSync(`bash -c '${script.replace(/'/g, "'\\''")}'`, {
    cwd,
    encoding: 'utf8',
    timeout: 5000,
  }).trim();
}

describe('raid-lib.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  describe('session parsing', () => {
    it('sets RAID_ACTIVE=false when no session file exists', () => {
      const cwd = makeTempDir();
      fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
      const vars = sourceLib(cwd);
      assert.strictEqual(vars.RAID_ACTIVE, 'false');
      assert.strictEqual(vars.RAID_PHASE, '');
      assert.strictEqual(vars.RAID_MODE, '');
    });

    it('parses structured session file', () => {
      const cwd = makeTempDir();
      fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
      const session = {
        phase: 'implementation',
        mode: 'full',
        currentAgent: 'warrior',
        implementer: 'archer',
        task: 'Build the login page',
      };
      fs.writeFileSync(
        path.join(cwd, '.claude', 'raid-session'),
        JSON.stringify(session)
      );
      const vars = sourceLib(cwd);
      assert.strictEqual(vars.RAID_ACTIVE, 'true');
      assert.strictEqual(vars.RAID_PHASE, 'implementation');
      assert.strictEqual(vars.RAID_MODE, 'full');
      assert.strictEqual(vars.RAID_CURRENT_AGENT, 'warrior');
      assert.strictEqual(vars.RAID_IMPLEMENTER, 'archer');
      assert.strictEqual(vars.RAID_TASK, 'Build the login page');
    });

    it('treats invalid session JSON as RAID_ACTIVE=false', () => {
      const cwd = makeTempDir();
      fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
      fs.writeFileSync(
        path.join(cwd, '.claude', 'raid-session'),
        'not valid json {{'
      );
      const vars = sourceLib(cwd);
      assert.strictEqual(vars.RAID_ACTIVE, 'false');
    });

    it('warns to stderr on invalid session JSON', () => {
      const cwd = makeTempDir();
      fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
      fs.writeFileSync(
        path.join(cwd, '.claude', 'raid-session'),
        'not valid json {{'
      );
      const stderr = sourceLibStderr(cwd);
      assert.ok(
        stderr.includes('raid-session'),
        `Expected stderr to mention raid-session, got: ${stderr}`
      );
    });
  });

  describe('config parsing', () => {
    it('reads config values from raid.json', () => {
      const cwd = makeTempDir();
      fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
      const config = {
        project: {
          testCommand: 'npm test',
        },
        paths: {
          specs: 'custom/specs',
          plans: 'custom/plans',
        },
        conventions: {
          fileNaming: 'kebab-case',
          commitMinLength: 20,
          maxDepth: 5,
        },
      };
      fs.writeFileSync(
        path.join(cwd, '.claude', 'raid.json'),
        JSON.stringify(config)
      );
      const vars = sourceLib(cwd);
      assert.strictEqual(vars.RAID_TEST_CMD, 'npm test');
      assert.strictEqual(vars.RAID_SPECS_PATH, 'custom/specs');
      assert.strictEqual(vars.RAID_PLANS_PATH, 'custom/plans');
      assert.strictEqual(vars.RAID_NAMING, 'kebab-case');
      assert.strictEqual(vars.RAID_MAX_DEPTH, '5');
      assert.strictEqual(vars.RAID_COMMIT_MIN_LENGTH, '20');
    });

    it('uses defaults when raid.json is missing', () => {
      const cwd = makeTempDir();
      fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
      const vars = sourceLib(cwd);
      assert.strictEqual(vars.RAID_NAMING, 'none');
      assert.strictEqual(vars.RAID_MAX_DEPTH, '8');
      assert.strictEqual(vars.RAID_COMMIT_MIN_LENGTH, '15');
      assert.strictEqual(vars.RAID_SPECS_PATH, 'docs/raid/specs');
      assert.strictEqual(vars.RAID_PLANS_PATH, 'docs/raid/plans');
      assert.strictEqual(vars.RAID_TEST_CMD, '');
    });

    it('reads browser config from raid.json', () => {
      const cwd = makeTempDir();
      fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
      const config = {
        browser: {
          enabled: true,
          portRange: [3001, 3005],
          playwrightConfig: 'playwright.config.ts',
        },
        project: {
          execCommand: 'pnpm dlx',
        },
      };
      fs.writeFileSync(path.join(cwd, '.claude', 'raid.json'), JSON.stringify(config));
      const vars = sourceLib(cwd);
      assert.strictEqual(vars.RAID_BROWSER_ENABLED, 'true');
      assert.strictEqual(vars.RAID_BROWSER_PORT_START, '3001');
      assert.strictEqual(vars.RAID_BROWSER_PORT_END, '3005');
      assert.strictEqual(vars.RAID_BROWSER_EXEC_CMD, 'pnpm dlx');
      assert.strictEqual(vars.RAID_BROWSER_PW_CONFIG, 'playwright.config.ts');
    });

    it('defaults browser config when not in raid.json', () => {
      const cwd = makeTempDir();
      fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
      fs.writeFileSync(path.join(cwd, '.claude', 'raid.json'), '{}');
      const vars = sourceLib(cwd);
      assert.strictEqual(vars.RAID_BROWSER_ENABLED, 'false');
      assert.strictEqual(vars.RAID_BROWSER_PORT_START, '');
      assert.strictEqual(vars.RAID_BROWSER_PORT_END, '');
      assert.strictEqual(vars.RAID_BROWSER_EXEC_CMD, 'npx');
      assert.strictEqual(vars.RAID_BROWSER_PW_CONFIG, '');
    });

    it('parses config even when RAID_ACTIVE=false', () => {
      const cwd = makeTempDir();
      fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
      // No session file, but config exists
      const config = {
        conventions: { fileNaming: 'camelCase' },
      };
      fs.writeFileSync(
        path.join(cwd, '.claude', 'raid.json'),
        JSON.stringify(config)
      );
      const vars = sourceLib(cwd);
      assert.strictEqual(vars.RAID_ACTIVE, 'false');
      assert.strictEqual(vars.RAID_NAMING, 'camelCase');
    });
  });

  describe('utility functions', () => {
    it('raid_read_input extracts RAID_FILE_PATH and RAID_COMMAND from stdin JSON', () => {
      const cwd = makeTempDir();
      fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
      const input = JSON.stringify({
        tool_input: {
          file_path: '/src/index.js',
          command: 'git commit -m "test"',
        },
      });
      const inputFile = path.join(cwd, 'hook-input.json');
      fs.writeFileSync(inputFile, input);
      const scriptFile = path.join(cwd, 'test-read-input.sh');
      fs.writeFileSync(scriptFile, `#!/usr/bin/env bash
cd "${cwd}"
source "${RAID_LIB}"
raid_read_input < "${inputFile}"
echo "RAID_FILE_PATH=$RAID_FILE_PATH"
echo "RAID_COMMAND=$RAID_COMMAND"
`);
      fs.chmodSync(scriptFile, 0o755);
      const result = execSync(`bash "${scriptFile}"`, {
        cwd,
        encoding: 'utf8',
        timeout: 5000,
      });
      assert.ok(result.includes('RAID_FILE_PATH=/src/index.js'));
      assert.ok(result.includes('RAID_COMMAND=git commit -m "test"'));
    });

    it('raid_is_production_file returns 0 for production code', () => {
      const cwd = makeTempDir();
      fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
      const script = `
        cd "${cwd}"
        source "${RAID_LIB}"
        if raid_is_production_file "src/app.js"; then echo "YES"; else echo "NO"; fi
        if raid_is_production_file "tests/app.test.js"; then echo "YES"; else echo "NO"; fi
        if raid_is_production_file "docs/readme.md"; then echo "YES"; else echo "NO"; fi
        if raid_is_production_file ".claude/settings.json"; then echo "YES"; else echo "NO"; fi
        if raid_is_production_file "lib/utils.ts"; then echo "YES"; else echo "NO"; fi
      `;
      const result = execSync(`bash -c '${script.replace(/'/g, "'\\''")}'`, {
        cwd,
        encoding: 'utf8',
        timeout: 5000,
      });
      const lines = result.trim().split('\n');
      assert.strictEqual(lines[0], 'YES', 'src/app.js should be production');
      assert.strictEqual(lines[1], 'NO', 'tests/app.test.js should not be production');
      assert.strictEqual(lines[2], 'NO', 'docs/readme.md should not be production');
      assert.strictEqual(lines[3], 'NO', '.claude/settings.json should not be production');
      assert.strictEqual(lines[4], 'YES', 'lib/utils.ts should be production');
    });

    it('raid_block prints to stderr and exits 2', () => {
      const cwd = makeTempDir();
      fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
      const script = `
        cd "${cwd}"
        source "${RAID_LIB}"
        raid_block "Something went wrong"
      `;
      try {
        execSync(`bash -c '${script.replace(/'/g, "'\\''")}'`, {
          cwd,
          encoding: 'utf8',
          timeout: 5000,
        });
        assert.fail('Should have exited with code 2');
      } catch (err) {
        assert.strictEqual(err.status, 2);
        assert.ok(err.stderr.includes('Something went wrong'));
      }
    });

    it('raid_warn prints to stderr and exits 0', () => {
      const cwd = makeTempDir();
      fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
      const script = `
        cd "${cwd}"
        source "${RAID_LIB}"
        raid_warn "Just a heads up"
      `;
      const result = execSync(`bash -c '${script.replace(/'/g, "'\\''")}'`, {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });
      // exit 0 means no error thrown
      // stderr check:
      // Re-run to capture stderr
      const script2 = `
        cd "${cwd}"
        source "${RAID_LIB}"
        raid_warn "Just a heads up" 2>&1
      `;
      const result2 = execSync(`bash -c '${script2.replace(/'/g, "'\\''")}'`, {
        cwd,
        encoding: 'utf8',
        timeout: 5000,
      });
      assert.ok(result2.includes('Just a heads up'));
    });
  });
});
