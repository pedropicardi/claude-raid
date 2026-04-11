const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Helper: create a temp directory with the hook and raid-lib.sh installed,
 * plus optional raid.json config and file content.
 */
function setupEnv(opts = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-no-placeholders-test-'));
  const hooksDir = path.join(tmp, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  // Copy hook files
  const src = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks');
  fs.copyFileSync(path.join(src, 'raid-lib.sh'), path.join(hooksDir, 'raid-lib.sh'));
  fs.copyFileSync(path.join(src, 'validate-no-placeholders.sh'), path.join(hooksDir, 'validate-no-placeholders.sh'));

  // Create raid.json config if requested
  if (opts.config) {
    fs.writeFileSync(
      path.join(tmp, '.claude', 'raid.json'),
      JSON.stringify(opts.config)
    );
  }

  // Create target file if content provided
  if (opts.filePath && opts.fileContent !== undefined) {
    const fullPath = path.join(tmp, opts.filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, opts.fileContent);
  }

  return tmp;
}

/**
 * Run the hook with a given file_path, return { status, stderr }.
 */
function runHook(tmpDir, filePath) {
  const input = JSON.stringify({ tool_input: { file_path: filePath } });
  const hookPath = path.join(tmpDir, '.claude', 'hooks', 'validate-no-placeholders.sh');
  const stderrFile = path.join(tmpDir, '.stderr-capture');
  const cmd = `echo '${input.replace(/'/g, "'\\''")}' | bash "${hookPath}" 2>"${stderrFile}"`;
  try {
    execSync(cmd, { cwd: tmpDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const stderr = fs.existsSync(stderrFile) ? fs.readFileSync(stderrFile, 'utf8') : '';
    return { status: 0, stderr };
  } catch (err) {
    const stderr = fs.existsSync(stderrFile) ? fs.readFileSync(stderrFile, 'utf8') : (err.stderr || '');
    return { status: err.status, stderr };
  }
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('validate-no-placeholders.sh', () => {
  const dirs = [];
  afterEach(() => {
    while (dirs.length) cleanup(dirs.pop());
  });

  it('ignores files outside specs/plans', () => {
    const tmp = setupEnv({
      filePath: 'src/index.js',
      fileContent: 'TODO: implement this',
    });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/index.js');
    assert.strictEqual(result.status, 0);
  });

  it('blocks TBD in spec files', () => {
    const tmp = setupEnv({
      filePath: 'docs/raid/specs/auth.md',
      fileContent: 'The auth system should TBD handle tokens.',
    });
    dirs.push(tmp);
    const result = runHook(tmp, 'docs/raid/specs/auth.md');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('tbd'), `Expected stderr to mention tbd, got: ${result.stderr}`);
  });

  it('blocks TODO in plan files', () => {
    const tmp = setupEnv({
      filePath: 'docs/raid/plans/phase-1.md',
      fileContent: 'Step 1: TODO fill in the details.',
    });
    dirs.push(tmp);
    const result = runHook(tmp, 'docs/raid/plans/phase-1.md');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('todo'), `Expected stderr to mention todo, got: ${result.stderr}`);
  });

  it('allows clean spec files', () => {
    const tmp = setupEnv({
      filePath: 'docs/raid/specs/auth.md',
      fileContent: 'The auth system uses JWT tokens for session management.\nTokens expire after 24 hours.',
    });
    dirs.push(tmp);
    const result = runHook(tmp, 'docs/raid/specs/auth.md');
    assert.strictEqual(result.status, 0);
  });

  it('blocks placeholders in dungeon phase files with absolute paths', () => {
    const tmp = setupEnv({
      filePath: '.claude/dungeon/test-quest/phases/phase-2-design.md',
      fileContent: 'DUNGEON: TBD — need to figure out the adapter pattern.',
    });
    dirs.push(tmp);
    // Claude passes absolute paths to hooks
    const absPath = path.join(tmp, '.claude/dungeon/test-quest/phases/phase-2-design.md');
    const result = runHook(tmp, absPath);
    assert.strictEqual(result.status, 2, `Expected block (exit 2) for placeholder in dungeon file, got exit ${result.status}`);
    assert.ok(result.stderr.includes('tbd'), `Expected stderr to mention tbd, got: ${result.stderr}`);
  });

  it('blocks placeholders in spoils files with absolute paths', () => {
    const tmp = setupEnv({
      filePath: '.claude/dungeon/test-quest/spoils/design.md',
      fileContent: 'The implementation should handle edge cases for all inputs.',
    });
    dirs.push(tmp);
    const absPath = path.join(tmp, '.claude/dungeon/test-quest/spoils/design.md');
    const result = runHook(tmp, absPath);
    assert.strictEqual(result.status, 2, `Expected block (exit 2) for placeholder in spoils file, got exit ${result.status}`);
    assert.ok(result.stderr.includes('handle edge cases'), `Expected stderr to mention 'handle edge cases', got: ${result.stderr}`);
  });

  it('respects custom paths from raid.json', () => {
    const tmp = setupEnv({
      config: { paths: { specs: 'custom/specs', plans: 'custom/plans' } },
      filePath: 'custom/specs/auth.md',
      fileContent: 'This section is TBD.',
    });
    dirs.push(tmp);
    const result = runHook(tmp, 'custom/specs/auth.md');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('tbd'), `Expected stderr to mention tbd, got: ${result.stderr}`);
  });
});
