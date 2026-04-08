# Vault & Lifecycle Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent quest archive (Vault) and 7 lifecycle hooks that automate session management, task discipline, idle agent nudging, phase transition gates, and context compaction resilience.

**Architecture:** 7 new POSIX shell scripts in `template/.claude/hooks/` following the existing `raid-lib.sh` pattern. Each hook reads stdin JSON, checks `raid-session` + config flags, and either exits 0 (no-op) or takes action (create files, output JSON with `additionalContext`, exit 2 to block). `raid-lib.sh` is extended with new config fields. `merge-settings.js` registers the hooks. `init.js` generates new `raid.json` sections.

**Tech Stack:** POSIX bash + jq (existing pattern), Node.js for CLI changes

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `template/.claude/hooks/raid-lib.sh` | Modify | Add Vault + lifecycle config parsing |
| `template/.claude/hooks/raid-session-start.sh` | Create | SessionStart: create raid-session, offer Vault |
| `template/.claude/hooks/raid-session-end.sh` | Create | SessionEnd: draft Vault entry, cleanup |
| `template/.claude/hooks/raid-teammate-idle.sh` | Create | TeammateIdle: nudge idle agents |
| `template/.claude/hooks/raid-task-created.sh` | Create | TaskCreated: validate task subjects |
| `template/.claude/hooks/raid-task-completed.sh` | Create | TaskCompleted: block without test evidence |
| `template/.claude/hooks/raid-stop.sh` | Create | Stop: detect phase transitions |
| `template/.claude/hooks/raid-pre-compact.sh` | Create | PreCompact: backup Dungeon state |
| `src/merge-settings.js` | Modify | Register 7 new hook events |
| `src/init.js` | Modify | Add vault + lifecycle to raid.json |
| `src/remove.js` | Modify | Cleanup new hooks, Vault draft, backups |
| `tests/hooks/lifecycle.test.js` | Create | Tests for all 7 lifecycle hooks |
| `tests/cli/vault.test.js` | Create | Tests for Vault draft generation |

---

### Task 1: Extend `raid-lib.sh` with Vault and lifecycle config parsing

**Files:**
- Modify: `template/.claude/hooks/raid-lib.sh`

- [ ] **Step 1: Add lifecycle and vault config variables after the existing config parsing block**

After line 81 (after the existing config parsing section), add new variables and a second jq call for the new config fields:

```bash
# --- Lifecycle & Vault config ---
RAID_VAULT_ENABLED=true
RAID_VAULT_PATH=".claude/vault"
RAID_LIFECYCLE_SESSION=true
RAID_LIFECYCLE_NUDGE=true
RAID_LIFECYCLE_TASK_VALIDATION=true
RAID_LIFECYCLE_COMPLETION_GATE=true
RAID_LIFECYCLE_PHASE_CONFIRM=true
RAID_LIFECYCLE_COMPACT_BACKUP=true
RAID_LIFECYCLE_TEST_WINDOW=10

if [ -f ".claude/raid.json" ]; then
  _lifecycle_json=$(jq -r '
    (.raid.vault.enabled // true),
    (.raid.vault.path // ".claude/vault"),
    (.raid.lifecycle.autoSessionManagement // true),
    (.raid.lifecycle.teammateNudge // true),
    (.raid.lifecycle.taskValidation // true),
    (.raid.lifecycle.completionGate // true),
    (.raid.lifecycle.phaseTransitionConfirm // true),
    (.raid.lifecycle.compactBackup // true),
    (.raid.lifecycle.testWindowMinutes // 10)
  ' ".claude/raid.json" 2>/dev/null)

  if [ $? -eq 0 ] && [ -n "$_lifecycle_json" ]; then
    RAID_VAULT_ENABLED=$(echo "$_lifecycle_json" | sed -n '1p')
    RAID_VAULT_PATH=$(echo "$_lifecycle_json" | sed -n '2p')
    RAID_LIFECYCLE_SESSION=$(echo "$_lifecycle_json" | sed -n '3p')
    RAID_LIFECYCLE_NUDGE=$(echo "$_lifecycle_json" | sed -n '4p')
    RAID_LIFECYCLE_TASK_VALIDATION=$(echo "$_lifecycle_json" | sed -n '5p')
    RAID_LIFECYCLE_COMPLETION_GATE=$(echo "$_lifecycle_json" | sed -n '6p')
    RAID_LIFECYCLE_PHASE_CONFIRM=$(echo "$_lifecycle_json" | sed -n '7p')
    RAID_LIFECYCLE_COMPACT_BACKUP=$(echo "$_lifecycle_json" | sed -n '8p')
    RAID_LIFECYCLE_TEST_WINDOW=$(echo "$_lifecycle_json" | sed -n '9p')
  fi
fi

export RAID_VAULT_ENABLED RAID_VAULT_PATH
export RAID_LIFECYCLE_SESSION RAID_LIFECYCLE_NUDGE RAID_LIFECYCLE_TASK_VALIDATION
export RAID_LIFECYCLE_COMPLETION_GATE RAID_LIFECYCLE_PHASE_CONFIRM RAID_LIFECYCLE_COMPACT_BACKUP
export RAID_LIFECYCLE_TEST_WINDOW
```

Also add a new utility function for lifecycle hooks that read stdin JSON differently from tool hooks:

```bash
# Read stdin JSON from Claude lifecycle hook input. Sets RAID_HOOK_INPUT as raw JSON.
raid_read_lifecycle_input() {
  RAID_HOOK_INPUT=$(cat)
  export RAID_HOOK_INPUT
}

# Count Vault entries by counting table rows in index.md
raid_vault_count() {
  local index="$RAID_VAULT_PATH/index.md"
  if [ ! -f "$index" ]; then
    echo 0
    return
  fi
  # Count lines that start with | and contain a date (YYYY-MM-DD), skip header
  grep -cE '^\| [0-9]{4}-' "$index" 2>/dev/null || echo 0
}
```

- [ ] **Step 2: Run existing hook tests to verify no regressions**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: All existing tests still pass

- [ ] **Step 3: Commit**

```bash
git add template/.claude/hooks/raid-lib.sh
git commit -m "feat(hooks): extend raid-lib with vault and lifecycle config parsing"
```

---

### Task 2: Create `raid-session-start.sh`

**Files:**
- Create: `template/.claude/hooks/raid-session-start.sh`
- Test: `tests/hooks/lifecycle.test.js`

- [ ] **Step 1: Write the hook script**

```bash
#!/usr/bin/env bash
# Raid lifecycle hook: SessionStart
# Creates raid-session file and offers Vault access.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

# Check if lifecycle session management is enabled
if [ "$RAID_LIFECYCLE_SESSION" != "true" ]; then
  exit 0
fi

raid_read_lifecycle_input

# Parse session start fields
SOURCE=$(echo "$RAID_HOOK_INPUT" | jq -r '.source // "startup"')
AGENT_TYPE=$(echo "$RAID_HOOK_INPUT" | jq -r '.agent_type // ""')
SESSION_ID=$(echo "$RAID_HOOK_INPUT" | jq -r '.session_id // ""')

# Only activate for wizard agent type
if [ "$AGENT_TYPE" != "wizard" ]; then
  exit 0
fi

# If resuming and session already exists, no action
if [ "$SOURCE" = "resume" ] && [ -f ".claude/raid-session" ]; then
  exit 0
fi

# Create raid-session file
mkdir -p .claude
cat > .claude/raid-session <<ENDJSON
{
  "sessionId": "$SESSION_ID",
  "startedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "phase": 1
}
ENDJSON

# Check Vault for past quests
VAULT_COUNT=$(raid_vault_count)

if [ "$VAULT_COUNT" -gt 0 ] && [ "$RAID_VAULT_ENABLED" = "true" ]; then
  cat <<ENDJSON
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "The Vault contains $VAULT_COUNT past quest(s). Ask the human if the party should consult the Vault before beginning this quest."
  }
}
ENDJSON
fi

exit 0
```

- [ ] **Step 2: Make it executable**

```bash
chmod 755 template/.claude/hooks/raid-session-start.sh
```

- [ ] **Step 3: Write tests**

Create `tests/hooks/lifecycle.test.js`:

```js
'use strict';

const { describe, it, afterEach, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

let tmpDir;

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-lifecycle-'));
  // Copy hooks to temp dir
  const hooksDir = path.join(tmpDir, '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  const templateHooks = path.join(__dirname, '..', '..', 'template', '.claude', 'hooks');
  for (const f of fs.readdirSync(templateHooks)) {
    fs.copyFileSync(path.join(templateHooks, f), path.join(hooksDir, f));
    fs.chmodSync(path.join(hooksDir, f), 0o755);
  }
  return tmpDir;
}

function runHook(hookName, stdinJson, cwd) {
  try {
    const result = execSync(
      `echo '${JSON.stringify(stdinJson).replace(/'/g, "'\\''")}' | bash .claude/hooks/${hookName}`,
      { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return { exitCode: 0, stdout: result, stderr: '' };
  } catch (err) {
    return { exitCode: err.status, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
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

function writeVaultIndex(cwd, entries) {
  const vaultDir = path.join(cwd, '.claude', 'vault');
  fs.mkdirSync(vaultDir, { recursive: true });
  let content = '# Raid Vault\n\n| Date | Quest | Mode | Tags |\n|------|-------|------|------|\n';
  for (const e of entries) {
    content += `| ${e.date} | [${e.name}](${e.slug}/quest.md) | ${e.mode} | ${e.tags} |\n`;
  }
  fs.writeFileSync(path.join(vaultDir, 'index.md'), content);
}

describe('raid-session-start.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it('creates raid-session file for wizard agent', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    const input = { source: 'startup', agent_type: 'wizard', session_id: 'test-123' };
    const result = runHook('raid-session-start.sh', input, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'raid-session')));
    const session = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid-session'), 'utf8'));
    assert.strictEqual(session.sessionId, 'test-123');
    assert.strictEqual(session.phase, 1);
  });

  it('does nothing for non-wizard agent types', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    const input = { source: 'startup', agent_type: 'warrior', session_id: 'test-456' };
    const result = runHook('raid-session-start.sh', input, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-session')));
  });

  it('skips on resume when session exists', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), '{"phase":2}');
    const input = { source: 'resume', agent_type: 'wizard', session_id: 'test-789' };
    const result = runHook('raid-session-start.sh', input, cwd);
    assert.strictEqual(result.exitCode, 0);
    // Session file should NOT be overwritten
    const session = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid-session'), 'utf8'));
    assert.strictEqual(session.phase, 2);
  });

  it('outputs additionalContext when Vault has entries', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    writeVaultIndex(cwd, [
      { date: '2026-04-01', name: 'Auth', slug: '2026-04-01-auth', mode: 'Full Raid', tags: 'auth' },
    ]);
    const input = { source: 'startup', agent_type: 'wizard', session_id: 'test-v' };
    const result = runHook('raid-session-start.sh', input, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes('additionalContext'));
    assert.ok(result.stdout.includes('1 past quest'));
  });

  it('exits 0 silently when lifecycle disabled', () => {
    const cwd = setup();
    writeRaidConfig(cwd, { lifecycle: { autoSessionManagement: false } });
    const input = { source: 'startup', agent_type: 'wizard', session_id: 'test-dis' };
    const result = runHook('raid-session-start.sh', input, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-session')));
  });
});
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/hooks/lifecycle.test.js`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add template/.claude/hooks/raid-session-start.sh tests/hooks/lifecycle.test.js
git commit -m "feat(hooks): add SessionStart lifecycle hook with Vault detection"
```

---

### Task 3: Create `raid-session-end.sh`

**Files:**
- Create: `template/.claude/hooks/raid-session-end.sh`
- Modify: `tests/hooks/lifecycle.test.js`

- [ ] **Step 1: Write the hook script**

```bash
#!/usr/bin/env bash
# Raid lifecycle hook: SessionEnd
# Drafts a Vault entry from session artifacts and prompts persist/forget.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

# Only run during active Raid sessions
if [ "$RAID_ACTIVE" != "true" ]; then
  exit 0
fi

if [ "$RAID_LIFECYCLE_SESSION" != "true" ]; then
  exit 0
fi

# Create Vault draft directory
DRAFT_DIR="$RAID_VAULT_PATH/.draft"
mkdir -p "$DRAFT_DIR/dungeon-phases"

# --- Generate quest.md from Dungeon files ---
QUEST_FILE="$DRAFT_DIR/quest.md"

# Extract session metadata
SESSION_DATE=$(echo "$RAID_HOOK_INPUT" 2>/dev/null | jq -r '.session_id // ""' || echo "")
CURRENT_DATE=$(date -u +%Y-%m-%d)
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

cat > "$QUEST_FILE" <<EOF
# Quest — $CURRENT_DATE

**Date:** $CURRENT_DATE
**Mode:** $RAID_MODE
**Branch:** $BRANCH

## Quest Summary

[To be enriched by the Wizard before persisting]

## Key Decisions

EOF

# Extract pinned findings from Dungeon
if [ -f ".claude/raid-dungeon.md" ]; then
  grep -E '📌|DUNGEON:|FINDING:|DECISION:' ".claude/raid-dungeon.md" 2>/dev/null | while IFS= read -r line; do
    echo "- $line" >> "$QUEST_FILE"
  done
fi

cat >> "$QUEST_FILE" <<EOF

## Files Changed

EOF

# List changed files from git
git diff --name-only HEAD~5 HEAD 2>/dev/null | while IFS= read -r f; do
  echo "- $f" >> "$QUEST_FILE"
done

cat >> "$QUEST_FILE" <<'EOF'

---
<!-- VAULT:MACHINE -->

```json
{
  "quest": "",
  "date": "",
  "mode": "",
  "tags": [],
  "patterns": [],
  "filesChanged": []
}
```
EOF

# --- Copy specs and plans ---
if [ -d "$RAID_SPECS_PATH" ]; then
  SPEC_FILE=$(ls -t "$RAID_SPECS_PATH"/*.md 2>/dev/null | head -1)
  if [ -n "$SPEC_FILE" ]; then
    cp "$SPEC_FILE" "$DRAFT_DIR/spec.md"
  fi
fi

if [ -d "$RAID_PLANS_PATH" ]; then
  PLAN_FILE=$(ls -t "$RAID_PLANS_PATH"/*.md 2>/dev/null | head -1)
  if [ -n "$PLAN_FILE" ]; then
    cp "$PLAN_FILE" "$DRAFT_DIR/plan.md"
  fi
fi

# --- Copy Dungeon phase archives ---
for phase_file in .claude/raid-dungeon-phase-*.md; do
  [ -f "$phase_file" ] || continue
  cp "$phase_file" "$DRAFT_DIR/dungeon-phases/"
done

# --- Cleanup session artifacts ---
rm -f .claude/raid-session
rm -f .claude/raid-dungeon.md
rm -f .claude/raid-dungeon-phase-*.md
rm -f .claude/raid-dungeon-backup.md
rm -f .claude/raid-dungeon-phase-*-backup.md
rm -f .claude/raid-last-test-run

# --- Output additionalContext ---
cat <<ENDJSON
{
  "hookSpecificOutput": {
    "hookEventName": "SessionEnd",
    "additionalContext": "A quest record has been drafted at $DRAFT_DIR/. Ask the human: persist this quest to the Vault, or forget it? If persisted, review and enrich quest.md (fill in the summary, tags, and machine data) before finalizing. To persist: rename .draft/ to a descriptive directory name (e.g. $CURRENT_DATE-<slug>/) and add an entry to $RAID_VAULT_PATH/index.md. To forget: delete .draft/ and any remaining specs/plans in docs/raid/."
  }
}
ENDJSON

exit 0
```

- [ ] **Step 2: Make it executable**

```bash
chmod 755 template/.claude/hooks/raid-session-end.sh
```

- [ ] **Step 3: Write tests — append to `tests/hooks/lifecycle.test.js`**

```js
describe('raid-session-end.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it('generates Vault draft from active session', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    // Create active session
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({ phase: 3, mode: 'full' }));
    // Create Dungeon file
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon.md'), '# Dungeon\n📌 Important finding');
    // Create a spec
    const specsDir = path.join(cwd, 'docs', 'raid', 'specs');
    fs.mkdirSync(specsDir, { recursive: true });
    fs.writeFileSync(path.join(specsDir, 'spec.md'), '# Spec');
    // Init git for diff
    execSync('git init && git add -A && git commit -m "init" --allow-empty', { cwd, stdio: 'pipe' });

    const result = runHook('raid-session-end.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);

    // Draft should exist
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'vault', '.draft', 'quest.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'vault', '.draft', 'spec.md')));

    // Session artifacts should be cleaned up
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-session')));
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'raid-dungeon.md')));

    // Should output additionalContext
    assert.ok(result.stdout.includes('additionalContext'));
    assert.ok(result.stdout.includes('persist'));
  });

  it('does nothing when no active session', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    const result = runHook('raid-session-end.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'vault', '.draft')));
  });
});
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/hooks/lifecycle.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add template/.claude/hooks/raid-session-end.sh tests/hooks/lifecycle.test.js
git commit -m "feat(hooks): add SessionEnd lifecycle hook with Vault draft generation"
```

---

### Task 4: Create `raid-teammate-idle.sh`

**Files:**
- Create: `template/.claude/hooks/raid-teammate-idle.sh`
- Modify: `tests/hooks/lifecycle.test.js`

- [ ] **Step 1: Write the hook script**

```bash
#!/usr/bin/env bash
# Raid lifecycle hook: TeammateIdle
# Nudges idle agents to pick up unclaimed tasks.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

# Only run during active Raid sessions
if [ "$RAID_ACTIVE" != "true" ]; then
  exit 0
fi

if [ "$RAID_LIFECYCLE_NUDGE" != "true" ]; then
  exit 0
fi

# Exit 2 to send the teammate back to work with a nudge message
echo "Unclaimed tasks remain on the board. Pick up the next available task and report your plan before starting." >&2
exit 2
```

- [ ] **Step 2: Make executable and write tests**

```bash
chmod 755 template/.claude/hooks/raid-teammate-idle.sh
```

Tests to append:

```js
describe('raid-teammate-idle.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it('exits 2 with nudge when session active', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({ phase: 2, mode: 'full' }));
    const result = runHook('raid-teammate-idle.sh', { teammate_name: 'warrior' }, cwd);
    assert.strictEqual(result.exitCode, 2);
    assert.ok(result.stderr.includes('Unclaimed tasks'));
  });

  it('exits 0 when no active session', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    const result = runHook('raid-teammate-idle.sh', { teammate_name: 'warrior' }, cwd);
    assert.strictEqual(result.exitCode, 0);
  });

  it('exits 0 when nudge disabled', () => {
    const cwd = setup();
    writeRaidConfig(cwd, { lifecycle: { teammateNudge: false } });
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({ phase: 2, mode: 'full' }));
    const result = runHook('raid-teammate-idle.sh', { teammate_name: 'warrior' }, cwd);
    assert.strictEqual(result.exitCode, 0);
  });
});
```

- [ ] **Step 3: Run tests and commit**

Run: `node --test tests/hooks/lifecycle.test.js`
Expected: All PASS

```bash
git add template/.claude/hooks/raid-teammate-idle.sh tests/hooks/lifecycle.test.js
git commit -m "feat(hooks): add TeammateIdle lifecycle hook for agent nudging"
```

---

### Task 5: Create `raid-task-created.sh`

**Files:**
- Create: `template/.claude/hooks/raid-task-created.sh`
- Modify: `tests/hooks/lifecycle.test.js`

- [ ] **Step 1: Write the hook script**

```bash
#!/usr/bin/env bash
# Raid lifecycle hook: TaskCreated
# Validates task subjects are descriptive enough.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

if [ "$RAID_ACTIVE" != "true" ]; then
  exit 0
fi

if [ "$RAID_LIFECYCLE_TASK_VALIDATION" != "true" ]; then
  exit 0
fi

raid_read_lifecycle_input

SUBJECT=$(echo "$RAID_HOOK_INPUT" | jq -r '.task_subject // ""')

# Validate not empty
if [ -z "$SUBJECT" ]; then
  raid_block "Task subject cannot be empty."
fi

# Validate minimum length
if [ "${#SUBJECT}" -lt 10 ]; then
  raid_block "Task subject too short (${#SUBJECT} chars). Be more descriptive (min 10 chars)."
fi

# Validate not starting with generic words alone
FIRST_WORD=$(echo "$SUBJECT" | awk '{print tolower($1)}')
WORD_COUNT=$(echo "$SUBJECT" | wc -w | tr -d ' ')

if [ "$WORD_COUNT" -le 1 ]; then
  case "$FIRST_WORD" in
    fix|update|task|do|change|add|remove|delete)
      raid_block "Task subject '$SUBJECT' is too generic. Describe what specifically needs to be done."
      ;;
  esac
fi

exit 0
```

- [ ] **Step 2: Make executable and write tests**

```bash
chmod 755 template/.claude/hooks/raid-task-created.sh
```

Tests:

```js
describe('raid-task-created.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it('allows descriptive task subjects', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({ phase: 3, mode: 'full' }));
    const result = runHook('raid-task-created.sh', { task_subject: 'Implement JWT token refresh endpoint' }, cwd);
    assert.strictEqual(result.exitCode, 0);
  });

  it('blocks empty subjects', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({ phase: 3, mode: 'full' }));
    const result = runHook('raid-task-created.sh', { task_subject: '' }, cwd);
    assert.strictEqual(result.exitCode, 2);
    assert.ok(result.stderr.includes('cannot be empty'));
  });

  it('blocks too-short subjects', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({ phase: 3, mode: 'full' }));
    const result = runHook('raid-task-created.sh', { task_subject: 'Do thing' }, cwd);
    assert.strictEqual(result.exitCode, 2);
    assert.ok(result.stderr.includes('too short'));
  });

  it('blocks single generic words', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({ phase: 3, mode: 'full' }));
    const result = runHook('raid-task-created.sh', { task_subject: 'Fix' }, cwd);
    assert.strictEqual(result.exitCode, 2);
    assert.ok(result.stderr.includes('too generic'));
  });

  it('allows generic words with context', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({ phase: 3, mode: 'full' }));
    const result = runHook('raid-task-created.sh', { task_subject: 'Fix the authentication race condition' }, cwd);
    assert.strictEqual(result.exitCode, 0);
  });
});
```

- [ ] **Step 3: Run tests and commit**

Run: `node --test tests/hooks/lifecycle.test.js`
Expected: All PASS

```bash
git add template/.claude/hooks/raid-task-created.sh tests/hooks/lifecycle.test.js
git commit -m "feat(hooks): add TaskCreated lifecycle hook for task subject validation"
```

---

### Task 6: Create `raid-task-completed.sh`

**Files:**
- Create: `template/.claude/hooks/raid-task-completed.sh`
- Modify: `tests/hooks/lifecycle.test.js`

- [ ] **Step 1: Write the hook script**

```bash
#!/usr/bin/env bash
# Raid lifecycle hook: TaskCompleted
# Blocks task completion if tests haven't run recently.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

if [ "$RAID_ACTIVE" != "true" ]; then
  exit 0
fi

if [ "$RAID_LIFECYCLE_COMPLETION_GATE" != "true" ]; then
  exit 0
fi

TEST_RUN_FILE=".claude/raid-last-test-run"

if [ ! -f "$TEST_RUN_FILE" ]; then
  raid_block "Tests must pass before marking a task complete. No test run recorded — run your test command first."
fi

LAST_RUN=$(cat "$TEST_RUN_FILE" 2>/dev/null | tr -d '[:space:]')
NOW=$(date +%s)
WINDOW=$((RAID_LIFECYCLE_TEST_WINDOW * 60))
AGE=$((NOW - LAST_RUN))

if [ "$AGE" -gt "$WINDOW" ]; then
  MINS_AGO=$((AGE / 60))
  raid_block "Tests last ran $MINS_AGO minutes ago (window is $RAID_LIFECYCLE_TEST_WINDOW min). Run tests again before marking this task complete."
fi

exit 0
```

- [ ] **Step 2: Make executable and write tests**

```bash
chmod 755 template/.claude/hooks/raid-task-completed.sh
```

Tests:

```js
describe('raid-task-completed.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it('allows completion when tests ran recently', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({ phase: 3, mode: 'full' }));
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-last-test-run'), String(Math.floor(Date.now() / 1000)));
    const result = runHook('raid-task-completed.sh', { task_subject: 'Done' }, cwd);
    assert.strictEqual(result.exitCode, 0);
  });

  it('blocks when no test run recorded', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({ phase: 3, mode: 'full' }));
    const result = runHook('raid-task-completed.sh', { task_subject: 'Done' }, cwd);
    assert.strictEqual(result.exitCode, 2);
    assert.ok(result.stderr.includes('No test run recorded'));
  });

  it('blocks when test run is too old', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({ phase: 3, mode: 'full' }));
    // Write a timestamp from 20 minutes ago
    const old = Math.floor(Date.now() / 1000) - 1200;
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-last-test-run'), String(old));
    const result = runHook('raid-task-completed.sh', { task_subject: 'Done' }, cwd);
    assert.strictEqual(result.exitCode, 2);
    assert.ok(result.stderr.includes('minutes ago'));
  });
});
```

- [ ] **Step 3: Run tests and commit**

Run: `node --test tests/hooks/lifecycle.test.js`
Expected: All PASS

```bash
git add template/.claude/hooks/raid-task-completed.sh tests/hooks/lifecycle.test.js
git commit -m "feat(hooks): add TaskCompleted lifecycle hook for test evidence gate"
```

---

### Task 7: Create `raid-stop.sh`

**Files:**
- Create: `template/.claude/hooks/raid-stop.sh`
- Modify: `tests/hooks/lifecycle.test.js`

- [ ] **Step 1: Write the hook script**

```bash
#!/usr/bin/env bash
# Raid lifecycle hook: Stop
# Detects phase transitions and injects human confirmation gate.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

if [ "$RAID_ACTIVE" != "true" ]; then
  exit 0
fi

if [ "$RAID_LIFECYCLE_PHASE_CONFIRM" != "true" ]; then
  exit 0
fi

STORED_PHASE="$RAID_PHASE"

# Detect current phase from Dungeon file
DETECTED_PHASE="$STORED_PHASE"
if [ -f ".claude/raid-dungeon.md" ]; then
  # Look for highest "Phase N" or "PHASE N" marker
  HIGHEST=$(grep -oiE '(phase|PHASE)\s+[0-9]+' ".claude/raid-dungeon.md" 2>/dev/null | grep -oE '[0-9]+' | sort -rn | head -1)
  if [ -n "$HIGHEST" ]; then
    DETECTED_PHASE="$HIGHEST"
  fi
fi

# If phase advanced, update session and inject confirmation
if [ -n "$DETECTED_PHASE" ] && [ -n "$STORED_PHASE" ] && [ "$DETECTED_PHASE" -gt "$STORED_PHASE" ] 2>/dev/null; then
  # Update raid-session with new phase
  jq --argjson phase "$DETECTED_PHASE" '.phase = $phase' ".claude/raid-session" > ".claude/raid-session.tmp" 2>/dev/null && \
    mv ".claude/raid-session.tmp" ".claude/raid-session"

  cat <<ENDJSON
{
  "hookSpecificOutput": {
    "hookEventName": "Stop",
    "additionalContext": "Phase transition detected (Phase $STORED_PHASE → Phase $DETECTED_PHASE). The Wizard must confirm with the human before opening the next phase."
  }
}
ENDJSON
fi

exit 0
```

- [ ] **Step 2: Make executable and write tests**

```bash
chmod 755 template/.claude/hooks/raid-stop.sh
```

Tests:

```js
describe('raid-stop.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it('detects phase transition and outputs confirmation', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({ phase: 1, mode: 'full' }));
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon.md'), '# Dungeon\n## Phase 2\nSome findings');
    const result = runHook('raid-stop.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes('Phase 1'));
    assert.ok(result.stdout.includes('Phase 2'));
    // Session should be updated
    const session = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid-session'), 'utf8'));
    assert.strictEqual(session.phase, 2);
  });

  it('does nothing when phase unchanged', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({ phase: 2, mode: 'full' }));
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon.md'), '# Dungeon\n## Phase 2\nStill in phase 2');
    const result = runHook('raid-stop.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout.trim(), '');
  });
});
```

- [ ] **Step 3: Run tests and commit**

Run: `node --test tests/hooks/lifecycle.test.js`
Expected: All PASS

```bash
git add template/.claude/hooks/raid-stop.sh tests/hooks/lifecycle.test.js
git commit -m "feat(hooks): add Stop lifecycle hook for phase transition detection"
```

---

### Task 8: Create `raid-pre-compact.sh`

**Files:**
- Create: `template/.claude/hooks/raid-pre-compact.sh`
- Modify: `tests/hooks/lifecycle.test.js`

- [ ] **Step 1: Write the hook script**

```bash
#!/usr/bin/env bash
# Raid lifecycle hook: PreCompact
# Backs up Dungeon state before context compaction.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

if [ "$RAID_ACTIVE" != "true" ]; then
  exit 0
fi

if [ "$RAID_LIFECYCLE_COMPACT_BACKUP" != "true" ]; then
  exit 0
fi

BACKED_UP=false

if [ -f ".claude/raid-dungeon.md" ]; then
  cp ".claude/raid-dungeon.md" ".claude/raid-dungeon-backup.md"
  BACKED_UP=true
fi

for phase_file in .claude/raid-dungeon-phase-*.md; do
  [ -f "$phase_file" ] || continue
  cp "$phase_file" "${phase_file%.md}-backup.md"
  BACKED_UP=true
done

if [ "$BACKED_UP" = "true" ]; then
  cat <<ENDJSON
{
  "hookSpecificOutput": {
    "hookEventName": "PreCompact",
    "additionalContext": "Dungeon state backed up before compaction. If critical findings were lost, check raid-dungeon-backup.md and raid-dungeon-phase-*-backup.md."
  }
}
ENDJSON
fi

exit 0
```

- [ ] **Step 2: Make executable and write tests**

```bash
chmod 755 template/.claude/hooks/raid-pre-compact.sh
```

Tests:

```js
describe('raid-pre-compact.sh', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it('backs up Dungeon files', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({ phase: 2, mode: 'full' }));
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon.md'), '# Dungeon content');
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-dungeon-phase-1.md'), '# Phase 1');
    const result = runHook('raid-pre-compact.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'raid-dungeon-backup.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.claude', 'raid-dungeon-phase-1-backup.md')));
    assert.ok(result.stdout.includes('additionalContext'));
  });

  it('does nothing when no Dungeon files exist', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'raid-session'), JSON.stringify({ phase: 1, mode: 'full' }));
    const result = runHook('raid-pre-compact.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout.trim(), '');
  });
});
```

- [ ] **Step 3: Run tests and commit**

Run: `node --test tests/hooks/lifecycle.test.js`
Expected: All PASS

```bash
git add template/.claude/hooks/raid-pre-compact.sh tests/hooks/lifecycle.test.js
git commit -m "feat(hooks): add PreCompact lifecycle hook for Dungeon backup"
```

---

### Task 9: Register lifecycle hooks in `merge-settings.js`

**Files:**
- Modify: `src/merge-settings.js`
- Modify: `tests/cli/merge-settings.test.js`

- [ ] **Step 1: Add lifecycle hook entries to `RAID_HOOKS`**

Add these entries to the `RAID_HOOKS` object in `src/merge-settings.js`, after the existing `PreToolUse` entry:

```js
  SessionStart: [
    {
      hooks: [
        { type: 'command', command: `bash .claude/hooks/raid-session-start.sh ${RAID_HOOK_MARKER}` },
      ],
    },
  ],
  SessionEnd: [
    {
      matcher: 'prompt_input_exit|clear',
      hooks: [
        { type: 'command', command: `bash .claude/hooks/raid-session-end.sh ${RAID_HOOK_MARKER}` },
      ],
    },
  ],
  TeammateIdle: [
    {
      hooks: [
        { type: 'command', command: `bash .claude/hooks/raid-teammate-idle.sh ${RAID_HOOK_MARKER}` },
      ],
    },
  ],
  TaskCreated: [
    {
      hooks: [
        { type: 'command', command: `bash .claude/hooks/raid-task-created.sh ${RAID_HOOK_MARKER}` },
      ],
    },
  ],
  TaskCompleted: [
    {
      hooks: [
        { type: 'command', command: `bash .claude/hooks/raid-task-completed.sh ${RAID_HOOK_MARKER}` },
      ],
    },
  ],
  Stop: [
    {
      hooks: [
        { type: 'command', command: `bash .claude/hooks/raid-stop.sh ${RAID_HOOK_MARKER}` },
      ],
    },
  ],
  PreCompact: [
    {
      hooks: [
        { type: 'command', command: `bash .claude/hooks/raid-pre-compact.sh ${RAID_HOOK_MARKER}` },
      ],
    },
  ],
```

- [ ] **Step 2: Add test to verify new hooks are registered**

Add to `tests/cli/merge-settings.test.js`:

```js
  it('registers lifecycle hook events', () => {
    // Run mergeSettings and check the output
    const cwd = makeTempDir();
    mergeSettings(cwd);
    const settings = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8'));
    const events = Object.keys(settings.hooks);
    assert.ok(events.includes('SessionStart'));
    assert.ok(events.includes('SessionEnd'));
    assert.ok(events.includes('TeammateIdle'));
    assert.ok(events.includes('TaskCreated'));
    assert.ok(events.includes('TaskCompleted'));
    assert.ok(events.includes('Stop'));
    assert.ok(events.includes('PreCompact'));
  });
```

- [ ] **Step 3: Run tests and commit**

Run: `npm test`
Expected: All PASS

```bash
git add src/merge-settings.js tests/cli/merge-settings.test.js
git commit -m "feat(settings): register 7 lifecycle hooks in merge-settings"
```

---

### Task 10: Update `raid.json` generation in `init.js`

**Files:**
- Modify: `src/init.js`
- Modify: `tests/cli/init.test.js`

- [ ] **Step 1: Add vault and lifecycle to `raidConfig`**

In `src/init.js`, update the `raidConfig` object inside `install()` to add `vault` and `lifecycle` inside the `raid` section:

```js
      raid: {
        defaultMode: 'full',
        vault: {
          path: '.claude/vault',
          enabled: true,
        },
        lifecycle: {
          autoSessionManagement: true,
          teammateNudge: true,
          taskValidation: true,
          completionGate: true,
          phaseTransitionConfirm: true,
          compactBackup: true,
          testWindowMinutes: 10,
        },
      },
```

- [ ] **Step 2: Add gitignore entries for Vault draft and backups**

Update the `ignoreEntries` array in `install()` to add:

```js
  const ignoreEntries = [
    '.claude/raid-last-test-run',
    '.claude/raid-session',
    '.claude/raid-dungeon.md',
    '.claude/raid-dungeon-phase-*',
    '.claude/raid-dungeon-backup.md',
    '.claude/raid-dungeon-phase-*-backup.md',
    '.claude/vault/.draft/',
  ];
```

- [ ] **Step 3: Add test for new raid.json sections**

Add to `tests/cli/init.test.js`:

```js
  it('generates raid.json with vault and lifecycle config', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    init.install(cwd);
    const config = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8'));
    assert.ok(config.raid.vault);
    assert.strictEqual(config.raid.vault.enabled, true);
    assert.strictEqual(config.raid.vault.path, '.claude/vault');
    assert.ok(config.raid.lifecycle);
    assert.strictEqual(config.raid.lifecycle.autoSessionManagement, true);
    assert.strictEqual(config.raid.lifecycle.testWindowMinutes, 10);
  });
```

- [ ] **Step 4: Run tests and commit**

Run: `npm test`
Expected: All PASS

```bash
git add src/init.js tests/cli/init.test.js
git commit -m "feat(init): add vault and lifecycle config to generated raid.json"
```

---

### Task 11: Update `remove.js` for lifecycle cleanup

**Files:**
- Modify: `src/remove.js`

- [ ] **Step 1: Add new hook scripts to removal and cleanup Vault draft + backups**

Add the lifecycle hook names to the hook removal logic. In `performRemove()`, after the existing hooks cleanup section, add removal of the new scripts:

```js
  // Remove lifecycle hooks
  const lifecycleHooks = [
    'raid-session-start.sh', 'raid-session-end.sh', 'raid-teammate-idle.sh',
    'raid-task-created.sh', 'raid-task-completed.sh', 'raid-stop.sh', 'raid-pre-compact.sh',
  ];
  for (const hook of lifecycleHooks) {
    rmSafe(path.join(hooksDir, hook));
  }
```

Add cleanup of Vault draft and backup files:

```js
  // Clean up Vault draft
  rmDirSafe(path.join(claudeDir, 'vault', '.draft'));

  // Clean up Dungeon backups
  rmSafe(path.join(claudeDir, 'raid-dungeon-backup.md'));
  if (fs.existsSync(claudeDir)) {
    const backupFiles = fs.readdirSync(claudeDir).filter(f => f.startsWith('raid-dungeon-phase-') && f.endsWith('-backup.md'));
    for (const file of backupFiles) {
      rmSafe(path.join(claudeDir, file));
    }
  }
```

Also add new gitignore entries to `raidIgnoreEntries`:

```js
  const raidIgnoreEntries = [
    '.claude/raid-last-test-run', '.claude/raid-session',
    '.claude/raid-dungeon.md', '.claude/raid-dungeon-phase-*',
    '.claude/raid-dungeon-backup.md', '.claude/raid-dungeon-phase-*-backup.md',
    '.claude/vault/.draft/',
  ];
```

- [ ] **Step 2: Run tests and commit**

Run: `npm test`
Expected: All PASS

```bash
git add src/remove.js
git commit -m "feat(remove): cleanup lifecycle hooks, Vault draft, and Dungeon backups"
```

---

### Task 12: Final integration test

**Files:**
- All modified files

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 2: Verify hook installation**

```bash
cd $(mktemp -d) && git init
echo '{"scripts":{"test":"echo ok"}}' > package.json
node /path/to/the-raid/bin/cli.js summon
cat .claude/settings.json | jq '.hooks | keys'
```

Expected: Should list `SessionStart`, `SessionEnd`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`, `Stop`, `PreCompact` alongside existing `PreToolUse`, `PostToolUse`

- [ ] **Step 3: Verify raid.json config**

```bash
cat .claude/raid.json | jq '.raid.vault, .raid.lifecycle'
```

Expected: Both sections present with all default values

- [ ] **Step 4: Smoke test SessionStart hook**

```bash
echo '{"source":"startup","agent_type":"wizard","session_id":"test"}' | bash .claude/hooks/raid-session-start.sh
cat .claude/raid-session
```

Expected: `raid-session` file created with phase 1

- [ ] **Step 5: Smoke test PreCompact hook**

```bash
echo "# Test Dungeon" > .claude/raid-dungeon.md
echo '{}' | bash .claude/hooks/raid-pre-compact.sh
ls .claude/raid-dungeon-backup.md
```

Expected: Backup file created
