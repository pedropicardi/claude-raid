# Hooks Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Raid hook system to be phase-aware, performant, and maintainable — with a shared library, consolidated commit hook, write-gating by phase/implementer, and Dungeon discipline validation.

**Architecture:** A shared `raid-lib.sh` parses session + config once per hook invocation. Five focused hook scripts source it. The structured `.claude/raid-session` JSON file (managed by Wizard) is the single source of truth for phase, mode, and agent identity. `merge-settings.js` wires 3 hook entries (down from 4).

**Tech Stack:** Bash/POSIX, jq, Node.js (for merge-settings.js and tests using node:test)

---

### Task 1: Create `raid-lib.sh` shared library

**Files:**
- Create: `template/.claude/hooks/raid-lib.sh`
- Test: `tests/hooks/raid-lib.test.js`

- [ ] **Step 1: Write tests for raid-lib.sh**

Create `tests/hooks/raid-lib.test.js`. These tests invoke `raid-lib.sh` indirectly by sourcing it in a bash wrapper and checking exported variables.

```javascript
'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-lib-'));
  return tmpDir;
}

function setupRaidLib(cwd) {
  const hooksDir = path.join(cwd, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, '..', '..', 'template', '.claude', 'hooks', 'raid-lib.sh'),
    path.join(hooksDir, 'raid-lib.sh')
  );
}

function runLibCheck(cwd, envScript) {
  const script = `
    cd "${cwd}"
    ${envScript}
    source .claude/hooks/raid-lib.sh
    echo "RAID_ACTIVE=$RAID_ACTIVE"
    echo "RAID_PHASE=$RAID_PHASE"
    echo "RAID_MODE=$RAID_MODE"
    echo "RAID_IMPLEMENTER=$RAID_IMPLEMENTER"
    echo "RAID_CURRENT_AGENT=$RAID_CURRENT_AGENT"
    echo "RAID_TASK=$RAID_TASK"
    echo "RAID_TEST_CMD=$RAID_TEST_CMD"
    echo "RAID_NAMING=$RAID_NAMING"
    echo "RAID_MAX_DEPTH=$RAID_MAX_DEPTH"
    echo "RAID_COMMIT_MIN_LENGTH=$RAID_COMMIT_MIN_LENGTH"
    echo "RAID_SPECS_PATH=$RAID_SPECS_PATH"
    echo "RAID_PLANS_PATH=$RAID_PLANS_PATH"
  `;
  const output = execSync(`bash -c '${script.replace(/'/g, "'\\''")}'`, { encoding: 'utf8' });
  const vars = {};
  for (const line of output.trim().split('\n')) {
    const [key, ...rest] = line.split('=');
    vars[key] = rest.join('=');
  }
  return vars;
}

describe('raid-lib.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('sets RAID_ACTIVE=false when no session file exists', () => {
    const cwd = makeTempDir();
    setupRaidLib(cwd);
    const vars = runLibCheck(cwd, '');
    assert.strictEqual(vars.RAID_ACTIVE, 'false');
    assert.strictEqual(vars.RAID_PHASE, '');
  });

  it('parses structured session file', () => {
    const cwd = makeTempDir();
    setupRaidLib(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'implementation',
      mode: 'full',
      currentAgent: 'warrior',
      implementer: 'warrior',
      task: 'add-auth',
    }));
    const vars = runLibCheck(cwd, '');
    assert.strictEqual(vars.RAID_ACTIVE, 'true');
    assert.strictEqual(vars.RAID_PHASE, 'implementation');
    assert.strictEqual(vars.RAID_MODE, 'full');
    assert.strictEqual(vars.RAID_CURRENT_AGENT, 'warrior');
    assert.strictEqual(vars.RAID_IMPLEMENTER, 'warrior');
    assert.strictEqual(vars.RAID_TASK, 'add-auth');
  });

  it('reads config values from raid.json', () => {
    const cwd = makeTempDir();
    setupRaidLib(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), '{"phase":"design","mode":"full"}');
    fs.writeFileSync(path.join(cwd, '.claude', 'raid.json'), JSON.stringify({
      project: { testCommand: 'npm test' },
      paths: { specs: 'custom/specs', plans: 'custom/plans' },
      conventions: { fileNaming: 'kebab-case', maxDepth: 5, commitMinLength: 20 },
    }));
    const vars = runLibCheck(cwd, '');
    assert.strictEqual(vars.RAID_TEST_CMD, 'npm test');
    assert.strictEqual(vars.RAID_SPECS_PATH, 'custom/specs');
    assert.strictEqual(vars.RAID_PLANS_PATH, 'custom/plans');
    assert.strictEqual(vars.RAID_NAMING, 'kebab-case');
    assert.strictEqual(vars.RAID_MAX_DEPTH, '5');
    assert.strictEqual(vars.RAID_COMMIT_MIN_LENGTH, '20');
  });

  it('uses defaults when raid.json is missing', () => {
    const cwd = makeTempDir();
    setupRaidLib(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), '{"phase":"design","mode":"full"}');
    const vars = runLibCheck(cwd, '');
    assert.strictEqual(vars.RAID_NAMING, 'none');
    assert.strictEqual(vars.RAID_MAX_DEPTH, '8');
    assert.strictEqual(vars.RAID_COMMIT_MIN_LENGTH, '15');
    assert.strictEqual(vars.RAID_SPECS_PATH, 'docs/raid/specs');
    assert.strictEqual(vars.RAID_PLANS_PATH, 'docs/raid/plans');
  });

  it('treats invalid session JSON as RAID_ACTIVE=false', () => {
    const cwd = makeTempDir();
    setupRaidLib(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), '{corrupt json}');
    const vars = runLibCheck(cwd, '');
    assert.strictEqual(vars.RAID_ACTIVE, 'false');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/hooks/raid-lib.test.js`
Expected: FAIL — `raid-lib.sh` does not exist yet.

- [ ] **Step 3: Write `raid-lib.sh`**

```bash
#!/usr/bin/env bash
# Raid shared library — sourced by all hook scripts
# Parses .claude/raid-session and .claude/raid.json once

RAID_ACTIVE=false
RAID_PHASE=""
RAID_MODE=""
RAID_IMPLEMENTER=""
RAID_CURRENT_AGENT=""
RAID_TASK=""
RAID_TEST_CMD=""
RAID_NAMING="none"
RAID_MAX_DEPTH=8
RAID_COMMIT_MIN_LENGTH=15
RAID_SPECS_PATH="docs/raid/specs"
RAID_PLANS_PATH="docs/raid/plans"

RAID_SESSION_FILE=".claude/raid-session"
RAID_CONFIG_FILE=".claude/raid.json"

# --- Parse session file ---
if [ -f "$RAID_SESSION_FILE" ]; then
  _RAID_SESSION=$(jq -r '.' "$RAID_SESSION_FILE" 2>/dev/null)
  if [ $? -eq 0 ] && [ -n "$_RAID_SESSION" ] && [ "$_RAID_SESSION" != "null" ]; then
    RAID_ACTIVE=true
    RAID_PHASE=$(echo "$_RAID_SESSION" | jq -r '.phase // empty')
    RAID_MODE=$(echo "$_RAID_SESSION" | jq -r '.mode // empty')
    RAID_IMPLEMENTER=$(echo "$_RAID_SESSION" | jq -r '.implementer // empty')
    RAID_CURRENT_AGENT=$(echo "$_RAID_SESSION" | jq -r '.currentAgent // empty')
    RAID_TASK=$(echo "$_RAID_SESSION" | jq -r '.task // empty')
  else
    echo "raid-lib: WARNING — .claude/raid-session contains invalid JSON, treating as inactive" >&2
  fi
fi

# --- Parse config file (only if session is active) ---
if [ "$RAID_ACTIVE" = true ] && [ -f "$RAID_CONFIG_FILE" ]; then
  _RAID_CONFIG=$(jq -r '.' "$RAID_CONFIG_FILE" 2>/dev/null)
  if [ $? -eq 0 ] && [ -n "$_RAID_CONFIG" ] && [ "$_RAID_CONFIG" != "null" ]; then
    _val=$(echo "$_RAID_CONFIG" | jq -r '.project.testCommand // empty')
    [ -n "$_val" ] && RAID_TEST_CMD="$_val"
    _val=$(echo "$_RAID_CONFIG" | jq -r '.conventions.fileNaming // empty')
    [ -n "$_val" ] && RAID_NAMING="$_val"
    _val=$(echo "$_RAID_CONFIG" | jq -r '.conventions.maxDepth // empty')
    [ -n "$_val" ] && RAID_MAX_DEPTH="$_val"
    _val=$(echo "$_RAID_CONFIG" | jq -r '.conventions.commitMinLength // empty')
    [ -n "$_val" ] && RAID_COMMIT_MIN_LENGTH="$_val"
    _val=$(echo "$_RAID_CONFIG" | jq -r '.paths.specs // empty')
    [ -n "$_val" ] && RAID_SPECS_PATH="$_val"
    _val=$(echo "$_RAID_CONFIG" | jq -r '.paths.plans // empty')
    [ -n "$_val" ] && RAID_PLANS_PATH="$_val"
  fi
elif [ "$RAID_ACTIVE" = false ] && [ -f "$RAID_CONFIG_FILE" ]; then
  # Even outside Raid sessions, some hooks need config (file-naming, commit-message)
  _RAID_CONFIG=$(jq -r '.' "$RAID_CONFIG_FILE" 2>/dev/null)
  if [ $? -eq 0 ] && [ -n "$_RAID_CONFIG" ] && [ "$_RAID_CONFIG" != "null" ]; then
    _val=$(echo "$_RAID_CONFIG" | jq -r '.project.testCommand // empty')
    [ -n "$_val" ] && RAID_TEST_CMD="$_val"
    _val=$(echo "$_RAID_CONFIG" | jq -r '.conventions.fileNaming // empty')
    [ -n "$_val" ] && RAID_NAMING="$_val"
    _val=$(echo "$_RAID_CONFIG" | jq -r '.conventions.maxDepth // empty')
    [ -n "$_val" ] && RAID_MAX_DEPTH="$_val"
    _val=$(echo "$_RAID_CONFIG" | jq -r '.conventions.commitMinLength // empty')
    [ -n "$_val" ] && RAID_COMMIT_MIN_LENGTH="$_val"
    _val=$(echo "$_RAID_CONFIG" | jq -r '.paths.specs // empty')
    [ -n "$_val" ] && RAID_SPECS_PATH="$_val"
    _val=$(echo "$_RAID_CONFIG" | jq -r '.paths.plans // empty')
    [ -n "$_val" ] && RAID_PLANS_PATH="$_val"
  fi
fi

# --- Utility: read hook input from stdin ---
RAID_INPUT=""
RAID_FILE_PATH=""
RAID_COMMAND=""

raid_read_input() {
  RAID_INPUT=$(cat)
  RAID_FILE_PATH=$(echo "$RAID_INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')
  RAID_COMMAND=$(echo "$RAID_INPUT" | jq -r '.tool_input.command // empty')
}

# --- Utility: check if file is production code ---
raid_is_production_file() {
  local filepath="$1"
  local basename
  basename=$(basename "$filepath")

  case "$filepath" in
    docs/*|test/*|tests/*|.claude/*) return 1 ;;
    *.test.*|*.spec.*|*_test.*|*_spec.*) return 1 ;;
    *.json|*.yml|*.yaml|*.toml|*.md|*.lock) return 1 ;;
    *.config.*|*.rc|.gitignore|Makefile|Dockerfile) return 1 ;;
  esac

  return 0
}

# --- Utility: block with message ---
raid_block() {
  printf "Raid Quality Check:\n%s\n" "$1" >&2
  exit 2
}

# --- Utility: warn with message ---
raid_warn() {
  printf "Raid Quality Check:\n%s\n" "$1" >&2
  exit 0
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/hooks/raid-lib.test.js`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add template/.claude/hooks/raid-lib.sh tests/hooks/raid-lib.test.js
git commit -m "feat(hooks): add raid-lib.sh shared library with session and config parsing"
```

---

### Task 2: Create `validate-commit.sh` (consolidated commit hook)

**Files:**
- Create: `template/.claude/hooks/validate-commit.sh`
- Test: `tests/hooks/validate-commit.test.js`
- Remove (later, in Task 6): `template/.claude/hooks/validate-commit-message.sh`, `template/.claude/hooks/validate-tests-pass.sh`, `template/.claude/hooks/validate-verification.sh`

- [ ] **Step 1: Write tests for validate-commit.sh**

Create `tests/hooks/validate-commit.test.js`:

```javascript
'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-commit-'));
  return tmpDir;
}

function setupHooks(cwd) {
  const hooksDir = path.join(cwd, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  const templateHooks = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks');
  fs.copyFileSync(path.join(templateHooks, 'raid-lib.sh'), path.join(hooksDir, 'raid-lib.sh'));
  fs.copyFileSync(path.join(templateHooks, 'validate-commit.sh'), path.join(hooksDir, 'validate-commit.sh'));
  fs.chmodSync(path.join(hooksDir, 'validate-commit.sh'), 0o755);
}

function runHook(cwd, toolInput) {
  const input = JSON.stringify({ tool_input: toolInput });
  try {
    const output = execSync(
      `echo '${input.replace(/'/g, "'\\''")}' | bash .claude/hooks/validate-commit.sh`,
      { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return { code: 0, stdout: output, stderr: '' };
  } catch (err) {
    return { code: err.status, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

describe('validate-commit.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('passes through non-git-commit commands', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    const result = runHook(cwd, { command: 'npm install' });
    assert.strictEqual(result.code, 0);
  });

  it('blocks non-conventional commit messages', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    const result = runHook(cwd, { command: 'git commit -m "bad message here"' });
    assert.strictEqual(result.code, 2);
    assert.ok(result.stderr.includes('type(scope): description'));
  });

  it('allows valid conventional commit messages', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    const result = runHook(cwd, { command: 'git commit -m "feat(auth): add login endpoint"' });
    assert.strictEqual(result.code, 0);
  });

  it('blocks messages shorter than minimum length', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    const result = runHook(cwd, { command: 'git commit -m "fix: x"' });
    assert.strictEqual(result.code, 2);
    assert.ok(result.stderr.includes('too short'));
  });

  it('blocks generic messages', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    const result = runHook(cwd, { command: 'git commit -m "update"' });
    assert.strictEqual(result.code, 2);
    assert.ok(result.stderr.includes('generic'));
  });

  it('blocks commit during Raid session if tests fail', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'implementation', mode: 'full',
    }));
    fs.writeFileSync(path.join(cwd, '.claude', 'raid.json'), JSON.stringify({
      project: { testCommand: 'exit 1' },
    }));
    const result = runHook(cwd, { command: 'git commit -m "feat(auth): add login endpoint"' });
    assert.strictEqual(result.code, 2);
    assert.ok(result.stderr.includes('Tests failed'));
  });

  it('blocks completion commit without recent test run', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'implementation', mode: 'full',
    }));
    fs.writeFileSync(path.join(cwd, '.claude', 'raid.json'), JSON.stringify({
      project: { testCommand: 'exit 0' },
    }));
    const result = runHook(cwd, { command: 'git commit -m "feat(auth): complete login system"' });
    // Tests pass (exit 0) so test-run timestamp is written, then verification checks it.
    // Since tests just ran, this should pass.
    assert.strictEqual(result.code, 0);
  });

  it('blocks completion commit when test run is stale', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'implementation', mode: 'full',
    }));
    fs.writeFileSync(path.join(cwd, '.claude', 'raid.json'), JSON.stringify({
      project: { testCommand: 'exit 0' },
    }));
    // Write a stale timestamp (20 minutes ago)
    const staleTime = Math.floor(Date.now() / 1000) - 1200;
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-last-test-run'), String(staleTime));
    // Use a test command that does NOT run (so timestamp stays stale)
    fs.writeFileSync(path.join(cwd, '.claude', 'raid.json'), JSON.stringify({
      project: { testCommand: '' },
    }));
    const result = runHook(cwd, { command: 'git commit -m "feat(auth): final login system"' });
    assert.strictEqual(result.code, 2);
    assert.ok(result.stderr.includes('minutes ago'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/hooks/validate-commit.test.js`
Expected: FAIL — `validate-commit.sh` does not exist.

- [ ] **Step 3: Write `validate-commit.sh`**

```bash
#!/usr/bin/env bash
# Raid quality gate: consolidated commit validation
# PreToolUse hook for Bash — checks message format, tests, verification
set -euo pipefail

source "$(dirname "$0")/raid-lib.sh"
raid_read_input

# Only check git commit commands
if ! echo "$RAID_COMMAND" | grep -qE 'git commit'; then
  exit 0
fi

# Extract commit message — handle -m "msg" and -m 'msg' and heredoc
MSG=""
if echo "$RAID_COMMAND" | grep -qE -- '-m '; then
  MSG=$(echo "$RAID_COMMAND" | sed -n 's/.*-m "\([^"]*\)".*/\1/p' | head -1)
  if [ -z "$MSG" ]; then
    MSG=$(echo "$RAID_COMMAND" | sed -n "s/.*-m '\\([^']*\\)'.*/\\1/p" | head -1)
  fi
fi

if [ -z "$MSG" ]; then
  MSG=$(echo "$RAID_COMMAND" | sed -n 's/.*cat <<.*//;n;s/^ *//;p' | head -1)
fi

# No message found (editor mode) — allow
if [ -z "$MSG" ]; then
  exit 0
fi

# For heredoc/multiline, check first line only
MSG=$(echo "$MSG" | head -1)

ISSUES=""

# --- Check 1: Conventional commit format (always active) ---
if ! echo "$MSG" | grep -qE '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .+'; then
  ISSUES="${ISSUES}COMMIT: Message must follow 'type(scope): description' format.\n"
  ISSUES="${ISSUES}  Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert\n"
  ISSUES="${ISSUES}  Got: '$MSG'\n"
fi

# --- Check 2: Minimum length (always active) ---
MSG_LENGTH=${#MSG}
if [ "$MSG_LENGTH" -lt "$RAID_COMMIT_MIN_LENGTH" ]; then
  ISSUES="${ISSUES}COMMIT: Message too short (${MSG_LENGTH} chars, minimum ${RAID_COMMIT_MIN_LENGTH}).\n"
fi

# --- Check 3: No generic messages (always active) ---
LOWER_MSG=$(echo "$MSG" | tr '[:upper:]' '[:lower:]')
case "$LOWER_MSG" in
  update|fix|change|modify|edit|wip|temp|test|stuff|things|misc)
    ISSUES="${ISSUES}COMMIT: Message is too generic. Describe WHAT changed and WHY.\n"
    ;;
esac

# Bail early if format issues found
if [ -n "$ISSUES" ]; then
  printf "Raid Commit Quality Check:\n%b" "$ISSUES" >&2
  exit 2
fi

# --- Check 4: Tests pass (Raid-session only) ---
if [ "$RAID_ACTIVE" = true ] && [ -n "$RAID_TEST_CMD" ]; then
  if ! eval "$RAID_TEST_CMD" > /dev/null 2>&1; then
    printf "Raid Quality Check:\nTESTS: Tests failed. Fix before committing.\nCommand: %s\n" "$RAID_TEST_CMD" >&2
    exit 2
  fi
  # Write timestamp for verification check
  mkdir -p .claude
  date +%s > .claude/raid-last-test-run
fi

# --- Check 5: Verification — completion claims need fresh test evidence (Raid-session only) ---
if [ "$RAID_ACTIVE" = true ]; then
  HAS_COMPLETION=false
  for WORD in "complete" "done" "finish" "final"; do
    if echo "$LOWER_MSG" | grep -qiw "$WORD"; then
      HAS_COMPLETION=true
      break
    fi
  done

  if [ "$HAS_COMPLETION" = true ]; then
    TIMESTAMP_FILE=".claude/raid-last-test-run"
    MAX_AGE=600

    if [ ! -f "$TIMESTAMP_FILE" ]; then
      printf "Raid Verification Check:\nBLOCKED: Commit claims completion but no test run evidence found.\nRun tests before claiming work is complete.\n" >&2
      exit 2
    fi

    LAST_RUN=$(cat "$TIMESTAMP_FILE")
    NOW=$(date +%s)
    AGE=$((NOW - LAST_RUN))

    if [ "$AGE" -gt "$MAX_AGE" ]; then
      printf "Raid Verification Check:\nBLOCKED: Last test run was %d minutes ago. Run tests again before claiming completion.\n" "$((AGE / 60))" >&2
      exit 2
    fi
  fi
fi

exit 0
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/hooks/validate-commit.test.js`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add template/.claude/hooks/validate-commit.sh tests/hooks/validate-commit.test.js
git commit -m "feat(hooks): add consolidated validate-commit.sh replacing 3 separate hooks"
```

---

### Task 3: Create `validate-write-gate.sh` (phase-aware write controller)

**Files:**
- Create: `template/.claude/hooks/validate-write-gate.sh`
- Test: `tests/hooks/validate-write-gate.test.js`
- Remove (later, in Task 6): `template/.claude/hooks/validate-phase-gate.sh`

- [ ] **Step 1: Write tests for validate-write-gate.sh**

Create `tests/hooks/validate-write-gate.test.js`:

```javascript
'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-wgate-'));
  return tmpDir;
}

function setupHooks(cwd) {
  const hooksDir = path.join(cwd, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  const templateHooks = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks');
  fs.copyFileSync(path.join(templateHooks, 'raid-lib.sh'), path.join(hooksDir, 'raid-lib.sh'));
  fs.copyFileSync(path.join(templateHooks, 'validate-write-gate.sh'), path.join(hooksDir, 'validate-write-gate.sh'));
  fs.chmodSync(path.join(hooksDir, 'validate-write-gate.sh'), 0o755);
}

function runHook(cwd, toolInput) {
  const input = JSON.stringify({ tool_input: toolInput });
  try {
    const output = execSync(
      `echo '${input.replace(/'/g, "'\\''")}' | bash .claude/hooks/validate-write-gate.sh`,
      { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return { code: 0, stdout: output, stderr: '' };
  } catch (err) {
    return { code: err.status, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

describe('validate-write-gate.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('allows all writes when no Raid session active', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    const result = runHook(cwd, { file_path: 'src/auth/login.ts' });
    assert.strictEqual(result.code, 0);
  });

  it('blocks production file writes during design phase', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'design', mode: 'full',
    }));
    const result = runHook(cwd, { file_path: 'src/auth/login.ts' });
    assert.strictEqual(result.code, 2);
    assert.ok(result.stderr.includes('Read-only'));
  });

  it('allows doc writes during design phase', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'design', mode: 'full',
    }));
    const result = runHook(cwd, { file_path: 'docs/raid/specs/auth-design.md' });
    assert.strictEqual(result.code, 0);
  });

  it('allows test file writes during design phase', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'design', mode: 'full',
    }));
    const result = runHook(cwd, { file_path: 'tests/auth/login.test.ts' });
    assert.strictEqual(result.code, 0);
  });

  it('blocks production file writes during review phase', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'review', mode: 'full',
    }));
    const result = runHook(cwd, { file_path: 'src/auth/login.ts' });
    assert.strictEqual(result.code, 2);
    assert.ok(result.stderr.includes('Read-only'));
  });

  it('allows implementer to write production files during implementation', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'implementation', mode: 'full',
      currentAgent: 'warrior', implementer: 'warrior',
    }));
    const result = runHook(cwd, { file_path: 'src/auth/login.ts' });
    assert.strictEqual(result.code, 0);
  });

  it('blocks non-implementer from writing production files during implementation', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'implementation', mode: 'full',
      currentAgent: 'archer', implementer: 'warrior',
    }));
    const result = runHook(cwd, { file_path: 'src/auth/login.ts' });
    assert.strictEqual(result.code, 2);
    assert.ok(result.stderr.includes('warrior'));
  });

  it('skips implementer check in scout mode', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'implementation', mode: 'scout',
      currentAgent: 'warrior', implementer: '',
    }));
    const result = runHook(cwd, { file_path: 'src/auth/login.ts' });
    assert.strictEqual(result.code, 0);
  });

  it('warns instead of blocking during review in skirmish mode', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'review', mode: 'skirmish',
    }));
    const result = runHook(cwd, { file_path: 'src/auth/login.ts' });
    assert.strictEqual(result.code, 0);
    assert.ok(result.stderr.includes('WARNING'));
  });

  it('allows .claude file writes in any phase', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'design', mode: 'full',
    }));
    const result = runHook(cwd, { file_path: '.claude/raid-dungeon.md' });
    assert.strictEqual(result.code, 0);
  });

  it('blocks production files during plan phase', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'plan', mode: 'full',
    }));
    const result = runHook(cwd, { file_path: 'src/auth/login.ts' });
    assert.strictEqual(result.code, 2);
  });

  it('blocks production files during finishing phase', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'finishing', mode: 'full',
    }));
    const result = runHook(cwd, { file_path: 'src/auth/login.ts' });
    assert.strictEqual(result.code, 2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/hooks/validate-write-gate.test.js`
Expected: FAIL — `validate-write-gate.sh` does not exist.

- [ ] **Step 3: Write `validate-write-gate.sh`**

```bash
#!/usr/bin/env bash
# Raid quality gate: phase-aware write controller
# PreToolUse hook for Write operations
# Blocks production file writes outside implementation phase
# Enforces implementer-only writes during implementation
set -euo pipefail

source "$(dirname "$0")/raid-lib.sh"
raid_read_input

if [ -z "$RAID_FILE_PATH" ]; then
  exit 0
fi

# No active Raid session — allow everything
if [ "$RAID_ACTIVE" = false ]; then
  exit 0
fi

# Check if this is a production file
if ! raid_is_production_file "$RAID_FILE_PATH"; then
  exit 0
fi

# Phase-based enforcement
case "$RAID_PHASE" in
  design|plan)
    raid_block "BLOCKED: Read-only phase ($RAID_PHASE). No implementation code allowed.\nFile: $RAID_FILE_PATH"
    ;;

  implementation)
    # Scout mode: no implementer check (only 1 agent)
    if [ "$RAID_MODE" = "scout" ]; then
      exit 0
    fi
    # Check if current agent is the implementer
    if [ -n "$RAID_IMPLEMENTER" ] && [ -n "$RAID_CURRENT_AGENT" ] && [ "$RAID_CURRENT_AGENT" != "$RAID_IMPLEMENTER" ]; then
      raid_block "BLOCKED: Only $RAID_IMPLEMENTER writes production code this task.\nCurrent agent: $RAID_CURRENT_AGENT\nFile: $RAID_FILE_PATH"
    fi
    ;;

  review)
    if [ "$RAID_MODE" = "skirmish" ]; then
      raid_warn "WARNING: Read-only phase (review). File fixes should go through implementation.\nFile: $RAID_FILE_PATH"
    else
      raid_block "BLOCKED: Read-only phase (review). File fixes go through implementation.\nFile: $RAID_FILE_PATH"
    fi
    ;;

  finishing)
    raid_block "BLOCKED: Finishing phase. No new code.\nFile: $RAID_FILE_PATH"
    ;;

  *)
    # Unknown phase — allow (fail open)
    exit 0
    ;;
esac
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/hooks/validate-write-gate.test.js`
Expected: All 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add template/.claude/hooks/validate-write-gate.sh tests/hooks/validate-write-gate.test.js
git commit -m "feat(hooks): add phase-aware validate-write-gate.sh with implementer gating"
```

---

### Task 4: Create `validate-dungeon.sh` (Dungeon discipline)

**Files:**
- Create: `template/.claude/hooks/validate-dungeon.sh`
- Test: `tests/hooks/validate-dungeon.test.js`

- [ ] **Step 1: Write tests for validate-dungeon.sh**

Create `tests/hooks/validate-dungeon.test.js`:

```javascript
'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-dungeon-'));
  return tmpDir;
}

function setupHooks(cwd) {
  const hooksDir = path.join(cwd, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  const templateHooks = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks');
  fs.copyFileSync(path.join(templateHooks, 'raid-lib.sh'), path.join(hooksDir, 'raid-lib.sh'));
  fs.copyFileSync(path.join(templateHooks, 'validate-dungeon.sh'), path.join(hooksDir, 'validate-dungeon.sh'));
  fs.chmodSync(path.join(hooksDir, 'validate-dungeon.sh'), 0o755);
}

function runHook(cwd, toolInput) {
  const input = JSON.stringify({ tool_input: toolInput });
  try {
    const output = execSync(
      `echo '${input.replace(/'/g, "'\\''")}' | bash .claude/hooks/validate-dungeon.sh`,
      { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return { code: 0, stdout: output, stderr: '' };
  } catch (err) {
    return { code: err.status, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

describe('validate-dungeon.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ignores non-dungeon files', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'design', mode: 'full',
    }));
    const result = runHook(cwd, { file_path: 'src/auth/login.ts' });
    assert.strictEqual(result.code, 0);
  });

  it('ignores dungeon writes when no Raid session', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon.md'), '📌 DUNGEON: some finding with evidence in src/auth.ts showing the pattern');
    const result = runHook(cwd, { file_path: '.claude/raid-dungeon.md' });
    assert.strictEqual(result.code, 0);
  });

  it('allows valid pinned entry with evidence', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'design', mode: 'full',
    }));
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon.md'),
      '📌 DUNGEON: Auth middleware in src/auth/middleware.ts uses stateless JWT validation which prevents session revocation — confirmed by reading the verify() call at line 42');
    const result = runHook(cwd, { file_path: '.claude/raid-dungeon.md' });
    assert.strictEqual(result.code, 0);
  });

  it('blocks entries without recognized prefix', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'design', mode: 'full',
    }));
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon.md'),
      'This is just a bare text entry without proper formatting');
    const result = runHook(cwd, { file_path: '.claude/raid-dungeon.md' });
    assert.strictEqual(result.code, 2);
    assert.ok(result.stderr.includes('prefix'));
  });

  it('blocks pinned entries that are too short', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'design', mode: 'full',
    }));
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon.md'),
      '📌 DUNGEON: auth is bad');
    const result = runHook(cwd, { file_path: '.claude/raid-dungeon.md' });
    assert.strictEqual(result.code, 2);
    assert.ok(result.stderr.includes('evidence'));
  });

  it('blocks TASK entries during design phase', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'design', mode: 'full',
    }));
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon.md'),
      '📋 TASK: Implement the auth middleware with JWT validation and session management support');
    const result = runHook(cwd, { file_path: '.claude/raid-dungeon.md' });
    assert.strictEqual(result.code, 2);
    assert.ok(result.stderr.includes('Plan phase'));
  });

  it('allows TASK entries during plan phase', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'plan', mode: 'full',
    }));
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon.md'),
      '📋 TASK: Implement the auth middleware with JWT validation and session management support');
    const result = runHook(cwd, { file_path: '.claude/raid-dungeon.md' });
    assert.strictEqual(result.code, 0);
  });

  it('allows all prefixes during finishing phase', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'finishing', mode: 'full',
    }));
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon.md'),
      '📋 TASK: Summary of completed auth middleware task with all tests passing and code reviewed');
    const result = runHook(cwd, { file_path: '.claude/raid-dungeon.md' });
    assert.strictEqual(result.code, 0);
  });

  it('validates raid-dungeon-phase-N.md files too', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'design', mode: 'full',
    }));
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon-phase-1.md'),
      'bare text without prefix should be blocked for proper formatting');
    const result = runHook(cwd, { file_path: '.claude/raid-dungeon-phase-1.md' });
    assert.strictEqual(result.code, 2);
  });

  it('allows UNRESOLVED entries in any non-finishing phase', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({
      phase: 'implementation', mode: 'full',
    }));
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon.md'),
      '⚠️ UNRESOLVED: Whether to use stateless or stateful sessions — Warrior favors stateless, Rogue argues revocation');
    const result = runHook(cwd, { file_path: '.claude/raid-dungeon.md' });
    assert.strictEqual(result.code, 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/hooks/validate-dungeon.test.js`
Expected: FAIL — `validate-dungeon.sh` does not exist.

- [ ] **Step 3: Write `validate-dungeon.sh`**

```bash
#!/usr/bin/env bash
# Raid quality gate: validates Dungeon entry format, evidence, and phase consistency
# PostToolUse hook for Write and Edit operations
set -euo pipefail

source "$(dirname "$0")/raid-lib.sh"
raid_read_input

if [ -z "$RAID_FILE_PATH" ]; then
  exit 0
fi

# Only check Dungeon files
case "$RAID_FILE_PATH" in
  .claude/raid-dungeon.md|.claude/raid-dungeon-phase-*.md) ;;
  *) exit 0 ;;
esac

# Skip if no active Raid session
if [ "$RAID_ACTIVE" = false ]; then
  exit 0
fi

# Read the actual file content
if [ ! -f "$RAID_FILE_PATH" ]; then
  exit 0
fi

CONTENT=$(cat "$RAID_FILE_PATH")
if [ -z "$CONTENT" ]; then
  exit 0
fi

ISSUES=""
LINE_NUM=0

while IFS= read -r line; do
  LINE_NUM=$((LINE_NUM + 1))

  # Skip empty lines and markdown headers
  stripped=$(echo "$line" | sed 's/^[[:space:]]*//')
  if [ -z "$stripped" ] || echo "$stripped" | grep -qE '^#'; then
    continue
  fi

  # --- Check 1: Format — must have a recognized prefix ---
  HAS_PREFIX=false
  ENTRY_TYPE=""

  if echo "$line" | grep -q '📌 DUNGEON:'; then
    HAS_PREFIX=true
    ENTRY_TYPE="DUNGEON"
  elif echo "$line" | grep -q '⚠️ UNRESOLVED:'; then
    HAS_PREFIX=true
    ENTRY_TYPE="UNRESOLVED"
  elif echo "$line" | grep -q '✅ RESOLVED:'; then
    HAS_PREFIX=true
    ENTRY_TYPE="RESOLVED"
  elif echo "$line" | grep -q '📋 TASK:'; then
    HAS_PREFIX=true
    ENTRY_TYPE="TASK"
  fi

  if [ "$HAS_PREFIX" = false ]; then
    ISSUES="${ISSUES}Line ${LINE_NUM}: Missing recognized prefix (📌 DUNGEON: / ⚠️ UNRESOLVED: / ✅ RESOLVED: / 📋 TASK:)\n"
    continue
  fi

  # --- Check 2: Evidence — pinned entries need substance ---
  if [ "$ENTRY_TYPE" = "DUNGEON" ]; then
    # Strip the prefix to get the content
    ENTRY_CONTENT=$(echo "$line" | sed 's/.*📌 DUNGEON://')
    ENTRY_LENGTH=${#ENTRY_CONTENT}

    if [ "$ENTRY_LENGTH" -lt 50 ]; then
      ISSUES="${ISSUES}Line ${LINE_NUM}: Pinned entry too short (${ENTRY_LENGTH} chars). Include evidence (file paths, code patterns, reasoning).\n"
    fi
  fi

  # --- Check 3: Phase consistency ---
  case "$RAID_PHASE" in
    design|implementation|review)
      if [ "$ENTRY_TYPE" = "TASK" ]; then
        ISSUES="${ISSUES}Line ${LINE_NUM}: 📋 TASK entries belong in the Plan phase, not $RAID_PHASE.\n"
      fi
      ;;
    plan)
      # All types allowed in plan phase
      ;;
    finishing)
      # All types allowed in finishing phase
      ;;
  esac

done <<< "$CONTENT"

if [ -n "$ISSUES" ]; then
  printf "Raid Dungeon Discipline Check:\n%b" "$ISSUES" >&2
  exit 2
fi

exit 0
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/hooks/validate-dungeon.test.js`
Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add template/.claude/hooks/validate-dungeon.sh tests/hooks/validate-dungeon.test.js
git commit -m "feat(hooks): add validate-dungeon.sh for entry format, evidence, and phase consistency"
```

---

### Task 5: Refactor existing hooks to source `raid-lib.sh`

**Files:**
- Modify: `template/.claude/hooks/validate-file-naming.sh`
- Modify: `template/.claude/hooks/validate-no-placeholders.sh`
- Test: `tests/hooks/validate-file-naming.test.js`
- Test: `tests/hooks/validate-no-placeholders.test.js`

- [ ] **Step 1: Write tests for refactored validate-file-naming.sh**

Create `tests/hooks/validate-file-naming.test.js`:

```javascript
'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-naming-'));
  return tmpDir;
}

function setupHooks(cwd) {
  const hooksDir = path.join(cwd, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  const templateHooks = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks');
  fs.copyFileSync(path.join(templateHooks, 'raid-lib.sh'), path.join(hooksDir, 'raid-lib.sh'));
  fs.copyFileSync(path.join(templateHooks, 'validate-file-naming.sh'), path.join(hooksDir, 'validate-file-naming.sh'));
  fs.chmodSync(path.join(hooksDir, 'validate-file-naming.sh'), 0o755);
}

function runHook(cwd, toolInput) {
  const input = JSON.stringify({ tool_input: toolInput });
  try {
    const output = execSync(
      `echo '${input.replace(/'/g, "'\\''")}' | bash .claude/hooks/validate-file-naming.sh`,
      { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return { code: 0, stdout: output, stderr: '' };
  } catch (err) {
    return { code: err.status, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

describe('validate-file-naming.sh (refactored)', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('blocks filenames with spaces', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    const result = runHook(cwd, { file_path: 'src/my file.ts' });
    assert.strictEqual(result.code, 2);
    assert.ok(result.stderr.includes('spaces'));
  });

  it('allows valid kebab-case when configured', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid.json'), JSON.stringify({
      conventions: { fileNaming: 'kebab-case' },
    }));
    const result = runHook(cwd, { file_path: 'src/my-component.ts' });
    assert.strictEqual(result.code, 0);
  });

  it('blocks non-kebab-case when configured', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid.json'), JSON.stringify({
      conventions: { fileNaming: 'kebab-case' },
    }));
    const result = runHook(cwd, { file_path: 'src/myComponent.ts' });
    assert.strictEqual(result.code, 2);
    assert.ok(result.stderr.includes('kebab-case'));
  });

  it('blocks files exceeding max depth', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid.json'), JSON.stringify({
      conventions: { maxDepth: 3 },
    }));
    const result = runHook(cwd, { file_path: 'a/b/c/d/deep.ts' });
    assert.strictEqual(result.code, 2);
    assert.ok(result.stderr.includes('depth'));
  });

  it('allows files within max depth', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    const result = runHook(cwd, { file_path: 'src/auth/login.ts' });
    assert.strictEqual(result.code, 0);
  });
});
```

- [ ] **Step 2: Write tests for refactored validate-no-placeholders.sh**

Create `tests/hooks/validate-no-placeholders.test.js`:

```javascript
'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-placeholder-'));
  return tmpDir;
}

function setupHooks(cwd) {
  const hooksDir = path.join(cwd, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  const templateHooks = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks');
  fs.copyFileSync(path.join(templateHooks, 'raid-lib.sh'), path.join(hooksDir, 'raid-lib.sh'));
  fs.copyFileSync(path.join(templateHooks, 'validate-no-placeholders.sh'), path.join(hooksDir, 'validate-no-placeholders.sh'));
  fs.chmodSync(path.join(hooksDir, 'validate-no-placeholders.sh'), 0o755);
}

function runHook(cwd, toolInput) {
  const input = JSON.stringify({ tool_input: toolInput });
  try {
    const output = execSync(
      `echo '${input.replace(/'/g, "'\\''")}' | bash .claude/hooks/validate-no-placeholders.sh`,
      { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return { code: 0, stdout: output, stderr: '' };
  } catch (err) {
    return { code: err.status, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

describe('validate-no-placeholders.sh (refactored)', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ignores files outside specs/plans', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    const srcFile = path.join(cwd, 'src', 'auth.ts');
    fs.mkdirSync(path.dirname(srcFile), { recursive: true });
    fs.writeFileSync(srcFile, 'TODO: implement later');
    const result = runHook(cwd, { file_path: 'src/auth.ts' });
    assert.strictEqual(result.code, 0);
  });

  it('blocks TBD in spec files', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    const specFile = path.join(cwd, 'docs', 'raid', 'specs', 'auth.md');
    fs.mkdirSync(path.dirname(specFile), { recursive: true });
    fs.writeFileSync(specFile, '# Auth Design\n\nTBD: figure out session handling');
    const result = runHook(cwd, { file_path: 'docs/raid/specs/auth.md' });
    assert.strictEqual(result.code, 2);
    assert.ok(result.stderr.includes('tbd'));
  });

  it('blocks TODO in plan files', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    const planFile = path.join(cwd, 'docs', 'raid', 'plans', 'auth.md');
    fs.mkdirSync(path.dirname(planFile), { recursive: true });
    fs.writeFileSync(planFile, '# Auth Plan\n\nTODO: add test cases');
    const result = runHook(cwd, { file_path: 'docs/raid/plans/auth.md' });
    assert.strictEqual(result.code, 2);
  });

  it('allows clean spec files', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    const specFile = path.join(cwd, 'docs', 'raid', 'specs', 'auth.md');
    fs.mkdirSync(path.dirname(specFile), { recursive: true });
    fs.writeFileSync(specFile, '# Auth Design\n\nUse JWT with RSA-256 signatures.');
    const result = runHook(cwd, { file_path: 'docs/raid/specs/auth.md' });
    assert.strictEqual(result.code, 0);
  });

  it('respects custom paths from raid.json', () => {
    const cwd = makeTempDir();
    setupHooks(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid.json'), JSON.stringify({
      paths: { specs: 'custom/specs', plans: 'custom/plans' },
    }));
    const specFile = path.join(cwd, 'custom', 'specs', 'auth.md');
    fs.mkdirSync(path.dirname(specFile), { recursive: true });
    fs.writeFileSync(specFile, '# Auth\n\nTBD: something');
    const result = runHook(cwd, { file_path: 'custom/specs/auth.md' });
    assert.strictEqual(result.code, 2);
  });
});
```

- [ ] **Step 3: Run both test files to verify they fail**

Run: `node --test tests/hooks/validate-file-naming.test.js tests/hooks/validate-no-placeholders.test.js`
Expected: FAIL — the hooks still use old inline parsing, not `raid-lib.sh`.

- [ ] **Step 4: Rewrite `validate-file-naming.sh` to source `raid-lib.sh`**

Replace `template/.claude/hooks/validate-file-naming.sh` with:

```bash
#!/usr/bin/env bash
# Raid quality gate: validates file naming conventions
# PostToolUse hook for Write and Edit operations
set -euo pipefail

source "$(dirname "$0")/raid-lib.sh"
raid_read_input

if [ -z "$RAID_FILE_PATH" ]; then
  exit 0
fi

BASENAME=$(basename "$RAID_FILE_PATH")
ISSUES=""

# Check 1: No spaces in filenames (always enforced)
if echo "$BASENAME" | grep -qE '[[:space:]]'; then
  ISSUES="${ISSUES}NAMING: File '$BASENAME' contains spaces. Use hyphens or underscores.\n"
fi

# Check 2: Naming convention (if configured)
if [ "$RAID_NAMING" != "none" ]; then
  NAME_PART=$(echo "$BASENAME" | sed 's/\.[^.]*$//')

  case "$RAID_NAMING" in
    kebab-case)
      if ! echo "$NAME_PART" | grep -qE '^[a-z0-9]+(-[a-z0-9]+)*$'; then
        ISSUES="${ISSUES}NAMING: File '$BASENAME' does not follow kebab-case convention.\n"
      fi
      ;;
    snake_case)
      if ! echo "$NAME_PART" | grep -qE '^[a-z0-9]+(_[a-z0-9]+)*$'; then
        ISSUES="${ISSUES}NAMING: File '$BASENAME' does not follow snake_case convention.\n"
      fi
      ;;
    camelCase)
      if ! echo "$NAME_PART" | grep -qE '^[a-z][a-zA-Z0-9]*$'; then
        ISSUES="${ISSUES}NAMING: File '$BASENAME' does not follow camelCase convention.\n"
      fi
      ;;
  esac
fi

# Check 3: Directory depth
DEPTH=$(echo "$RAID_FILE_PATH" | awk -F'/' '{print NF}')
if [ "$DEPTH" -gt "$RAID_MAX_DEPTH" ]; then
  ISSUES="${ISSUES}STRUCTURE: File at depth $DEPTH ($RAID_FILE_PATH). Maximum is $RAID_MAX_DEPTH.\n"
fi

if [ -n "$ISSUES" ]; then
  printf "Raid Quality Check:\n%b" "$ISSUES" >&2
  exit 2
fi

exit 0
```

- [ ] **Step 5: Rewrite `validate-no-placeholders.sh` to source `raid-lib.sh`**

Replace `template/.claude/hooks/validate-no-placeholders.sh` with:

```bash
#!/usr/bin/env bash
# Raid quality gate: blocks placeholder text in specs and plans
# PostToolUse hook for Write and Edit operations
set -euo pipefail

source "$(dirname "$0")/raid-lib.sh"
raid_read_input

if [ -z "$RAID_FILE_PATH" ]; then
  exit 0
fi

# Only check files in specs or plans directories
IS_RAID_DOC=false
case "$RAID_FILE_PATH" in
  "$RAID_SPECS_PATH"/*|"$RAID_PLANS_PATH"/*) IS_RAID_DOC=true ;;
esac

if [ "$IS_RAID_DOC" = false ]; then
  exit 0
fi

# Read the actual file content
CONTENT=""
if [ -f "$RAID_FILE_PATH" ]; then
  CONTENT=$(cat "$RAID_FILE_PATH")
fi

if [ -z "$CONTENT" ]; then
  exit 0
fi

ISSUES=""
LINE_NUM=0

while IFS= read -r line; do
  LINE_NUM=$((LINE_NUM + 1))
  LOWER_LINE=$(echo "$line" | tr '[:upper:]' '[:lower:]')

  for PATTERN in "tbd" "todo" "fixme" "implement later" "add appropriate" "similar to task" "handle edge cases" "fill in"; do
    if echo "$LOWER_LINE" | grep -qi "$PATTERN"; then
      ISSUES="${ISSUES}Line ${LINE_NUM}: Found '${PATTERN}' — ${line}\n"
      break
    fi
  done
done <<< "$CONTENT"

if [ -n "$ISSUES" ]; then
  printf "Raid Placeholder Check:\nBLOCKED: Placeholders found in %s:\n%b\nRemove all placeholders before proceeding.\n" "$RAID_FILE_PATH" "$ISSUES" >&2
  exit 2
fi

exit 0
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test tests/hooks/validate-file-naming.test.js tests/hooks/validate-no-placeholders.test.js`
Expected: All 10 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add template/.claude/hooks/validate-file-naming.sh template/.claude/hooks/validate-no-placeholders.sh tests/hooks/validate-file-naming.test.js tests/hooks/validate-no-placeholders.test.js
git commit -m "refactor(hooks): rewrite file-naming and no-placeholders hooks to source raid-lib.sh"
```

---

### Task 6: Update `merge-settings.js` and remove old hooks

**Files:**
- Modify: `src/merge-settings.js`
- Remove: `template/.claude/hooks/validate-commit-message.sh`
- Remove: `template/.claude/hooks/validate-tests-pass.sh`
- Remove: `template/.claude/hooks/validate-verification.sh`
- Remove: `template/.claude/hooks/validate-phase-gate.sh`
- Modify: `tests/cli/merge-settings.test.js`

- [ ] **Step 1: Write updated tests for merge-settings.js**

Update `tests/cli/merge-settings.test.js` — add tests for new wiring, update existing tests that reference old hook names:

```javascript
// Add to existing describe block:

it('wires validate-commit.sh as single Bash PreToolUse hook', () => {
  mergeSettings = require('../../src/merge-settings').mergeSettings;
  const cwd = makeTempDir();
  fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
  mergeSettings(cwd);
  const settings = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8'));
  const bashHooks = settings.hooks.PreToolUse.find(h => h.matcher === 'Bash');
  assert.ok(bashHooks);
  assert.strictEqual(bashHooks.hooks.length, 1);
  assert.ok(bashHooks.hooks[0].command.includes('validate-commit.sh'));
});

it('wires validate-write-gate.sh as Write PreToolUse hook', () => {
  mergeSettings = require('../../src/merge-settings').mergeSettings;
  const cwd = makeTempDir();
  fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
  mergeSettings(cwd);
  const settings = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8'));
  const writeHooks = settings.hooks.PreToolUse.find(h => h.matcher === 'Write');
  assert.ok(writeHooks);
  assert.ok(writeHooks.hooks[0].command.includes('validate-write-gate.sh'));
});

it('wires validate-dungeon.sh in PostToolUse', () => {
  mergeSettings = require('../../src/merge-settings').mergeSettings;
  const cwd = makeTempDir();
  fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
  mergeSettings(cwd);
  const settings = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8'));
  const postHooks = settings.hooks.PostToolUse.find(h =>
    h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('validate-dungeon.sh'))
  );
  assert.ok(postHooks);
});

it('does not wire old removed hooks', () => {
  mergeSettings = require('../../src/merge-settings').mergeSettings;
  const cwd = makeTempDir();
  fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
  mergeSettings(cwd);
  const raw = fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8');
  assert.ok(!raw.includes('validate-commit-message.sh'));
  assert.ok(!raw.includes('validate-tests-pass.sh'));
  assert.ok(!raw.includes('validate-verification.sh'));
  assert.ok(!raw.includes('validate-phase-gate.sh'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/cli/merge-settings.test.js`
Expected: New tests FAIL (old wiring still in place).

- [ ] **Step 3: Update `merge-settings.js` with new hook wiring**

Replace the `RAID_HOOKS` constant in `src/merge-settings.js`:

```javascript
const RAID_HOOKS = {
  PostToolUse: [
    {
      matcher: 'Write|Edit',
      hooks: [
        { type: 'command', command: `bash .claude/hooks/validate-file-naming.sh ${RAID_HOOK_MARKER}` },
        { type: 'command', command: `bash .claude/hooks/validate-no-placeholders.sh ${RAID_HOOK_MARKER}` },
        { type: 'command', command: `bash .claude/hooks/validate-dungeon.sh ${RAID_HOOK_MARKER}` },
      ],
    },
  ],
  PreToolUse: [
    {
      matcher: 'Bash',
      hooks: [
        { type: 'command', command: `bash .claude/hooks/validate-commit.sh ${RAID_HOOK_MARKER}` },
      ],
    },
    {
      matcher: 'Write',
      hooks: [
        { type: 'command', command: `bash .claude/hooks/validate-write-gate.sh ${RAID_HOOK_MARKER}` },
      ],
    },
  ],
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/cli/merge-settings.test.js`
Expected: All tests PASS (update the existing `validate-file-naming` reference test if needed — it should still find `validate-file-naming` in PostToolUse).

- [ ] **Step 5: Delete old hook files**

```bash
rm template/.claude/hooks/validate-commit-message.sh
rm template/.claude/hooks/validate-tests-pass.sh
rm template/.claude/hooks/validate-verification.sh
rm template/.claude/hooks/validate-phase-gate.sh
```

- [ ] **Step 6: Commit**

```bash
git add src/merge-settings.js tests/cli/merge-settings.test.js
git add template/.claude/hooks/
git commit -m "refactor(hooks): update wiring to new hook set, remove 4 old hooks"
```

---

### Task 7: Update `remove.js` and `init.js` for new hook files

**Files:**
- Modify: `src/remove.js` (needs to know about `raid-lib.sh`)
- Modify: `tests/e2e/lifecycle.test.js`

- [ ] **Step 1: Update E2E lifecycle test**

In `tests/e2e/lifecycle.test.js`, update the hook existence check:

```javascript
// Replace this line:
assert.ok(fs.existsSync(path.join(cwd, '.claude', 'hooks', 'validate-commit-message.sh')));
// With:
assert.ok(fs.existsSync(path.join(cwd, '.claude', 'hooks', 'validate-commit.sh')));
assert.ok(fs.existsSync(path.join(cwd, '.claude', 'hooks', 'raid-lib.sh')));
assert.ok(fs.existsSync(path.join(cwd, '.claude', 'hooks', 'validate-write-gate.sh')));
assert.ok(fs.existsSync(path.join(cwd, '.claude', 'hooks', 'validate-dungeon.sh')));
```

Also update the removal check:

```javascript
// Replace this line:
assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'hooks', 'validate-commit-message.sh')));
// With:
assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'hooks', 'validate-commit.sh')));
assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'hooks', 'raid-lib.sh')));
```

- [ ] **Step 2: Run E2E test to verify it fails**

Run: `node --test tests/e2e/lifecycle.test.js`
Expected: FAIL — old hook names referenced.

- [ ] **Step 3: Update `remove.js` to handle `raid-lib.sh`**

The current `remove.js` removes all `validate-*.sh` files in the hooks directory. This already covers the new hooks. We only need to add `raid-lib.sh` removal. In `src/remove.js`, add after the validate hooks removal loop:

```javascript
// Add after the validate-*.sh removal loop:
rmSafe(path.join(hooksDir, 'raid-lib.sh'));
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/remove.js tests/e2e/lifecycle.test.js
git commit -m "fix(cli): update remove.js and E2E tests for new hook file names"
```

---

### Task 8: Run full test suite and verify

**Files:** None (verification only)

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`
Expected: All tests PASS across all test files.

- [ ] **Step 2: Verify template hooks directory contents**

Run: `ls -la template/.claude/hooks/`
Expected files:
```
raid-lib.sh
validate-commit.sh
validate-dungeon.sh
validate-file-naming.sh
validate-no-placeholders.sh
validate-write-gate.sh
```

No old files: `validate-commit-message.sh`, `validate-tests-pass.sh`, `validate-verification.sh`, `validate-phase-gate.sh`

- [ ] **Step 3: Verify hooks are executable**

Run: `file template/.claude/hooks/*.sh`
Expected: All show as shell scripts.

- [ ] **Step 4: Commit any remaining changes**

If any fixups were needed:
```bash
git add -A
git commit -m "chore(hooks): final cleanup after hooks redesign"
```
