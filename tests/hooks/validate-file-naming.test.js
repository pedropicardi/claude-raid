const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Helper: create a temp directory with the hook and raid-lib.sh installed,
 * plus optional raid.json config.
 */
function setupEnv(opts = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-file-naming-test-'));
  const hooksDir = path.join(tmp, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  // Copy hook files
  const src = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks');
  fs.copyFileSync(path.join(src, 'raid-lib.sh'), path.join(hooksDir, 'raid-lib.sh'));
  fs.copyFileSync(path.join(src, 'validate-file-naming.sh'), path.join(hooksDir, 'validate-file-naming.sh'));

  // Create raid.json config if requested
  if (opts.config) {
    fs.writeFileSync(
      path.join(tmp, '.claude', 'raid.json'),
      JSON.stringify(opts.config)
    );
  }

  return tmp;
}

/**
 * Run the hook with a given file_path, return { status, stderr }.
 */
function runHook(tmpDir, filePath) {
  const input = JSON.stringify({ tool_input: { file_path: filePath } });
  const hookPath = path.join(tmpDir, '.claude', 'hooks', 'validate-file-naming.sh');
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

describe('validate-file-naming.sh', () => {
  const dirs = [];
  afterEach(() => {
    while (dirs.length) cleanup(dirs.pop());
  });

  it('blocks filenames with spaces', () => {
    const tmp = setupEnv();
    dirs.push(tmp);
    const result = runHook(tmp, 'src/my file.js');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('spaces'), `Expected stderr to mention spaces, got: ${result.stderr}`);
  });

  it('allows valid kebab-case when configured', () => {
    const tmp = setupEnv({ config: { conventions: { fileNaming: 'kebab-case' } } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/my-component.js');
    assert.strictEqual(result.status, 0);
  });

  it('blocks non-kebab-case when configured', () => {
    const tmp = setupEnv({ config: { conventions: { fileNaming: 'kebab-case' } } });
    dirs.push(tmp);
    const result = runHook(tmp, 'src/myComponent.js');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('kebab-case'), `Expected stderr to mention kebab-case, got: ${result.stderr}`);
  });

  it('blocks files exceeding max depth', () => {
    const tmp = setupEnv({ config: { conventions: { maxDepth: 3 } } });
    dirs.push(tmp);
    // depth 4: a/b/c/d.js (4 parts)
    const result = runHook(tmp, 'a/b/c/d.js');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('depth'), `Expected stderr to mention depth, got: ${result.stderr}`);
  });

  it('allows files within max depth', () => {
    const tmp = setupEnv({ config: { conventions: { maxDepth: 3 } } });
    dirs.push(tmp);
    // depth 3: a/b/c.js (3 parts)
    const result = runHook(tmp, 'a/b/c.js');
    assert.strictEqual(result.status, 0);
  });
});
