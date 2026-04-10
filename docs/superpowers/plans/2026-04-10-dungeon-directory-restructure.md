# Dungeon Directory Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the quest dungeon directory from flat to subdirectories: `phases/`, `spoils/`, `spoils/tasks/`, and `backups/`.

**Architecture:** Update `{questDir}/` path references across 8 skill SKILL.md files, 4 hook scripts, and CLAUDE.md. Hooks scaffold subdirectories on quest creation and back up to the `backups/` folder. All changes are path string replacements — no new logic beyond `mkdir -p` calls.

**Tech Stack:** Bash (hooks), Markdown (skills), Node.js node:test (tests)

**Spec:** `docs/superpowers/specs/2026-04-10-dungeon-directory-restructure-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `template/.claude/hooks/raid-session-start.sh` | Modify | Scaffold `phases/`, `spoils/`, `spoils/tasks/` on quest creation |
| `template/.claude/hooks/raid-pre-compact.sh` | Modify | Read from `phases/`, write to `backups/` |
| `template/.claude/hooks/validate-write-gate.sh` | Modify | Allow writes to new subdirectory paths |
| `template/.claude/hooks/validate-dungeon.sh` | Modify | Match new subdirectory paths |
| `template/.claude/skills/raid-canonical-prd/SKILL.md` | Modify | `spoils/prd.md` |
| `template/.claude/skills/raid-canonical-design/SKILL.md` | Modify | `phases/`, `spoils/` paths |
| `template/.claude/skills/raid-canonical-implementation-plan/SKILL.md` | Modify | `phases/`, `spoils/tasks/` paths |
| `template/.claude/skills/raid-canonical-implementation/SKILL.md` | Modify | `phases/`, `spoils/tasks/` paths |
| `template/.claude/skills/raid-canonical-review/SKILL.md` | Modify | `phases/`, `spoils/review.md` paths |
| `template/.claude/skills/raid-wrap-up/SKILL.md` | Modify | All read paths updated |
| `template/.claude/skills/raid-canonical-protocol/SKILL.md` | Modify | Deliverables table paths |
| `template/.claude/skills/raid-teambuff/SKILL.md` | No change | Teambuff stays at quest root |
| `CLAUDE.md` | Modify | Quest Filesystem section |
| `tests/hooks/lifecycle.test.js` | Modify | Pre-compact and session-start test paths |
| `tests/hooks/validate-write-gate.test.js` | Modify | Add subdirectory write tests |
| `tests/hooks/validate-dungeon.test.js` | Modify | Update path patterns |

---

### Task 1: Update `raid-session-start.sh` to scaffold subdirectories

**Files:**
- Modify: `template/.claude/hooks/raid-session-start.sh:53-54`
- Test: `tests/hooks/lifecycle.test.js`

- [ ] **Step 1: Write failing test — session start creates subdirectories**

Add inside the `describe('raid-session-start.sh', ...)` block in `tests/hooks/lifecycle.test.js`:

```js
  it('creates phases, spoils, and spoils/tasks subdirectories in quest dir', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    runHook('raid-session-start.sh', { source: 'startup', agent_type: 'wizard', session_id: 'test-123' }, cwd);
    const session = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid-session'), 'utf8'));
    const questDir = path.join(cwd, session.questDir);
    assert.ok(fs.existsSync(path.join(questDir, 'phases')), 'phases/ should exist');
    assert.ok(fs.existsSync(path.join(questDir, 'spoils')), 'spoils/ should exist');
    assert.ok(fs.existsSync(path.join(questDir, 'spoils', 'tasks')), 'spoils/tasks/ should exist');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern="creates phases" tests/hooks/lifecycle.test.js`
Expected: FAIL — subdirectories don't exist yet.

- [ ] **Step 3: Add mkdir calls to raid-session-start.sh**

After line 54 (`mkdir -p "$QUEST_DIR"`), add:

```bash
mkdir -p "$QUEST_DIR/phases"
mkdir -p "$QUEST_DIR/spoils/tasks"
```

(This creates `spoils/` implicitly via `spoils/tasks`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern="creates phases" tests/hooks/lifecycle.test.js`
Expected: PASS

- [ ] **Step 5: Run all lifecycle tests**

Run: `node --test tests/hooks/lifecycle.test.js`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add template/.claude/hooks/raid-session-start.sh tests/hooks/lifecycle.test.js
git commit -m "feat(hooks): scaffold phases/, spoils/, spoils/tasks/ on quest creation"
```

---

### Task 2: Update `raid-pre-compact.sh` to use new paths

**Files:**
- Modify: `template/.claude/hooks/raid-pre-compact.sh:20-27`
- Test: `tests/hooks/lifecycle.test.js`

- [ ] **Step 1: Update existing pre-compact tests for new paths**

In `tests/hooks/lifecycle.test.js`, find the test `'backs up quest dir phase files and outputs additionalContext'`. Change:

Old:
```js
    fs.writeFileSync(path.join(questDir, 'phase-1-prd.md'), '# PRD');
    fs.writeFileSync(path.join(questDir, 'phase-2-design.md'), '# Design');
    const result = runHook('raid-pre-compact.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(fs.existsSync(path.join(questDir, 'phase-1-prd-backup.md')));
    assert.ok(fs.existsSync(path.join(questDir, 'phase-2-design-backup.md')));
```

New:
```js
    fs.mkdirSync(path.join(questDir, 'phases'), { recursive: true });
    fs.writeFileSync(path.join(questDir, 'phases', 'phase-2-design.md'), '# Design');
    fs.writeFileSync(path.join(questDir, 'phases', 'phase-3-plan.md'), '# Plan');
    const result = runHook('raid-pre-compact.sh', {}, cwd);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(fs.existsSync(path.join(questDir, 'backups', 'phase-2-design-backup.md')));
    assert.ok(fs.existsSync(path.join(questDir, 'backups', 'phase-3-plan-backup.md')));
```

Also update the cascade test `'does not cascade backups of backups'`. Change paths from `questDir` root to `phases/` and `backups/`:

```js
  it('does not cascade backups of backups', () => {
    const cwd = setup();
    writeRaidConfig(cwd);
    const questDir = path.join(cwd, '.claude', 'dungeon', 'test-quest');
    fs.mkdirSync(path.join(questDir, 'phases'), { recursive: true });
    fs.mkdirSync(path.join(questDir, 'backups'), { recursive: true });
    writeSession(cwd, { questDir: '.claude/dungeon/test-quest', questId: 'test-quest' });
    fs.writeFileSync(path.join(questDir, 'phases', 'phase-2-design.md'), '# Design');
    fs.writeFileSync(path.join(questDir, 'backups', 'phase-2-design-backup.md'), '# Design backup');
    runHook('raid-pre-compact.sh', {}, cwd);
    assert.ok(!fs.existsSync(path.join(questDir, 'backups', 'phase-2-design-backup-backup.md')),
      'should not create cascading backups');
    assert.ok(fs.existsSync(path.join(questDir, 'backups', 'phase-2-design-backup.md')));
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --test-name-pattern="pre-compact" tests/hooks/lifecycle.test.js`
Expected: FAIL — hook still reads from quest root.

- [ ] **Step 3: Update raid-pre-compact.sh**

Change the quest directory backup block (lines 20-27) from:

```bash
# Back up quest dungeon phase files
if [ -d "$QUEST_DIR" ]; then
  for phase_file in "$QUEST_DIR"/phase-*.md; do
    [ -f "$phase_file" ] || continue
    # Skip files that are already backups to prevent cascade
    [[ "$phase_file" == *-backup* ]] && continue
    cp "$phase_file" "${phase_file%.md}-backup.md"
    BACKED_UP=true
  done
fi
```

To:

```bash
# Back up quest dungeon phase files from phases/ to backups/
if [ -d "$QUEST_DIR/phases" ]; then
  mkdir -p "$QUEST_DIR/backups"
  for phase_file in "$QUEST_DIR"/phases/phase-*.md; do
    [ -f "$phase_file" ] || continue
    basename_file=$(basename "$phase_file")
    cp "$phase_file" "$QUEST_DIR/backups/${basename_file%.md}-backup.md"
    BACKED_UP=true
  done
fi
```

Note: the backup cascade guard (`*-backup*` skip) is no longer needed because `phases/` will never contain backup files — they live in `backups/`. But keep it as defense-in-depth if you prefer. The simpler approach: since source is `phases/` and dest is `backups/`, cascading is structurally impossible.

- [ ] **Step 4: Run pre-compact tests**

Run: `node --test --test-name-pattern="pre-compact" tests/hooks/lifecycle.test.js`
Expected: All pass.

- [ ] **Step 5: Run all lifecycle tests**

Run: `node --test tests/hooks/lifecycle.test.js`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add template/.claude/hooks/raid-pre-compact.sh tests/hooks/lifecycle.test.js
git commit -m "feat(hooks): pre-compact reads from phases/, writes to backups/"
```

---

### Task 3: Update `validate-write-gate.sh` for new paths

**Files:**
- Modify: `template/.claude/hooks/validate-write-gate.sh:37-41`
- Test: `tests/hooks/validate-write-gate.test.js`

- [ ] **Step 1: Write failing tests for subdirectory writes**

Add to the existing test file `tests/hooks/validate-write-gate.test.js`. Find the test that allows dungeon writes (the one testing `.claude/dungeon/test-quest/phase-2-design.md`). Add these tests nearby:

```js
  it('allows writes to quest dungeon phases/ subdirectory', () => {
    const tmp = setup({ phase: 'design' });
    const result = runHook(tmp, '.claude/dungeon/test-quest/phases/phase-2-design.md');
    assert.strictEqual(result.exitCode, 0);
  });

  it('allows writes to quest dungeon spoils/ subdirectory', () => {
    const tmp = setup({ phase: 'design' });
    const result = runHook(tmp, '.claude/dungeon/test-quest/spoils/design.md');
    assert.strictEqual(result.exitCode, 0);
  });

  it('allows writes to quest dungeon spoils/tasks/ subdirectory', () => {
    const tmp = setup({ phase: 'plan' });
    const result = runHook(tmp, '.claude/dungeon/test-quest/spoils/tasks/phase-3-plan-task-01.md');
    assert.strictEqual(result.exitCode, 0);
  });

  it('allows writes to quest dungeon backups/ subdirectory', () => {
    const tmp = setup({ phase: 'design' });
    const result = runHook(tmp, '.claude/dungeon/test-quest/backups/phase-2-design-backup.md');
    assert.strictEqual(result.exitCode, 0);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --test-name-pattern="allows writes to quest dungeon" tests/hooks/validate-write-gate.test.js`
Expected: New tests FAIL — the gate pattern `*.md` only matches one level deep.

- [ ] **Step 3: Update validate-write-gate.sh**

Change the quest dungeon allow block (lines 37-41) from:

```bash
# Quest dungeon dir markdown files are always allowed
case "$_file" in
  .claude/dungeon/*.md)
    exit 0
    ;;
esac
```

To:

```bash
# Quest dungeon dir markdown files are always allowed (including subdirectories)
case "$_file" in
  .claude/dungeon/*.md|.claude/dungeon/*/*.md|.claude/dungeon/*/*/*.md)
    exit 0
    ;;
esac
```

- [ ] **Step 4: Run all write-gate tests**

Run: `node --test tests/hooks/validate-write-gate.test.js`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add template/.claude/hooks/validate-write-gate.sh tests/hooks/validate-write-gate.test.js
git commit -m "feat(hooks): allow dungeon writes to subdirectories"
```

---

### Task 4: Update `validate-dungeon.sh` for new paths

**Files:**
- Modify: `template/.claude/hooks/validate-dungeon.sh:22-27`
- Test: `tests/hooks/validate-dungeon.test.js`

- [ ] **Step 1: Write failing test for phases/ subdirectory**

Add to `tests/hooks/validate-dungeon.test.js`:

```js
  it('validates phase files in phases/ subdirectory', () => {
    const tmp = setupEnv({
      session: { phase: 'design' },
      dungeonFile: '.claude/dungeon/test-quest/phases/phase-2-design.md',
      dungeonContent: '### Discoveries\n\nDUNGEON: This is a design finding verified by @Warrior and @Archer with sufficient evidence length for the hook',
    });
    const result = runHook(tmp, '.claude/dungeon/test-quest/phases/phase-2-design.md');
    assert.strictEqual(result.exitCode, 0);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern="validates phase files in phases" tests/hooks/validate-dungeon.test.js`
Expected: FAIL — case pattern doesn't match `phases/` subdirectory.

- [ ] **Step 3: Update validate-dungeon.sh case pattern**

Change lines 22-27 from:

```bash
# Only check Dungeon files (quest directory structure + backward compat flat files)
case "$_file" in
  .claude/dungeon/*/phase-*.md) ;;
  .claude/raid-dungeon.md|.claude/raid-dungeon-phase-*.md) ;;
  *) exit 0 ;;
esac
```

To:

```bash
# Only check Dungeon files (quest directory structure + backward compat flat files)
case "$_file" in
  .claude/dungeon/*/phase-*.md) ;;
  .claude/dungeon/*/phases/phase-*.md) ;;
  .claude/raid-dungeon.md|.claude/raid-dungeon-phase-*.md) ;;
  *) exit 0 ;;
esac
```

- [ ] **Step 4: Run all dungeon validation tests**

Run: `node --test tests/hooks/validate-dungeon.test.js`
Expected: All pass (old + new).

- [ ] **Step 5: Commit**

```bash
git add template/.claude/hooks/validate-dungeon.sh tests/hooks/validate-dungeon.test.js
git commit -m "feat(hooks): validate dungeon files in phases/ subdirectory"
```

---

### Task 5: Update skill files — PRD and Design

**Files:**
- Modify: `template/.claude/skills/raid-canonical-prd/SKILL.md`
- Modify: `template/.claude/skills/raid-canonical-design/SKILL.md`

- [ ] **Step 1: Update raid-canonical-prd/SKILL.md**

Read the file first. Apply these replacements:

| Old | New |
|-----|-----|
| `{questDir}/prd.md` | `{questDir}/spoils/prd.md` |

All occurrences (lines 70, 113, and any others).

- [ ] **Step 2: Update raid-canonical-design/SKILL.md**

Read the file first. Apply these replacements:

| Old | New |
|-----|-----|
| `{questDir}/prd.md` | `{questDir}/spoils/prd.md` |
| `{questDir}/design.md` | `{questDir}/spoils/design.md` |
| `{questDir}/phase-2-design.md` | `{questDir}/phases/phase-2-design.md` |

All occurrences throughout the file.

- [ ] **Step 3: Verify no stale references remain**

Run: `grep -n '{questDir}/prd.md\|{questDir}/design.md\|{questDir}/phase-2-design.md' template/.claude/skills/raid-canonical-prd/SKILL.md template/.claude/skills/raid-canonical-design/SKILL.md`
Expected: No output (all replaced).

- [ ] **Step 4: Commit**

```bash
git add template/.claude/skills/raid-canonical-prd/SKILL.md template/.claude/skills/raid-canonical-design/SKILL.md
git commit -m "feat(skills): update PRD and Design paths to phases/ and spoils/"
```

---

### Task 6: Update skill files — Plan and Implementation

**Files:**
- Modify: `template/.claude/skills/raid-canonical-implementation-plan/SKILL.md`
- Modify: `template/.claude/skills/raid-canonical-implementation/SKILL.md`

- [ ] **Step 1: Update raid-canonical-implementation-plan/SKILL.md**

Read the file first. Apply these replacements:

| Old | New |
|-----|-----|
| `{questDir}/design.md` | `{questDir}/spoils/design.md` |
| `{questDir}/phase-2-design.md` | `{questDir}/phases/phase-2-design.md` |
| `{questDir}/phase-3-plan.md` | `{questDir}/phases/phase-3-plan.md` |
| `{questDir}/phase-3-plan-task-NN.md` | `{questDir}/spoils/tasks/phase-3-plan-task-NN.md` |

All occurrences throughout the file.

- [ ] **Step 2: Update raid-canonical-implementation/SKILL.md**

Read the file first. Apply these replacements:

| Old | New |
|-----|-----|
| `{questDir}/phase-3-plan-task-NN.md` | `{questDir}/spoils/tasks/phase-3-plan-task-NN.md` |
| `{questDir}/phase-3-plan.md` | `{questDir}/phases/phase-3-plan.md` |
| `{questDir}/phase-4-implementation.md` | `{questDir}/phases/phase-4-implementation.md` |

All occurrences throughout the file.

- [ ] **Step 3: Verify no stale references remain**

Run: `grep -rn '{questDir}/phase-3-plan\|{questDir}/phase-4-implementation\|{questDir}/design.md' template/.claude/skills/raid-canonical-implementation-plan/SKILL.md template/.claude/skills/raid-canonical-implementation/SKILL.md`
Expected: No output (all replaced).

- [ ] **Step 4: Commit**

```bash
git add template/.claude/skills/raid-canonical-implementation-plan/SKILL.md template/.claude/skills/raid-canonical-implementation/SKILL.md
git commit -m "feat(skills): update Plan and Implementation paths to phases/, spoils/tasks/"
```

---

### Task 7: Update skill files — Review, Wrap-up, and Protocol

**Files:**
- Modify: `template/.claude/skills/raid-canonical-review/SKILL.md`
- Modify: `template/.claude/skills/raid-wrap-up/SKILL.md`
- Modify: `template/.claude/skills/raid-canonical-protocol/SKILL.md`

- [ ] **Step 1: Update raid-canonical-review/SKILL.md**

Read the file first. Apply these replacements:

| Old | New |
|-----|-----|
| `{questDir}/phase-5-review.md` | `{questDir}/phases/phase-5-review.md` |
| `{questDir}/review.md` | `{questDir}/spoils/review.md` |
| `{questDir}/phase-4-implementation.md` | `{questDir}/phases/phase-4-implementation.md` |

All occurrences throughout the file.

- [ ] **Step 2: Update raid-wrap-up/SKILL.md**

Read the file first. Apply these replacements:

| Old | New |
|-----|-----|
| `{questDir}/phase-6-wrap-up.md` | No change (stays at root) |
| `{questDir}/prd.md` | `{questDir}/spoils/prd.md` |
| `{questDir}/design.md` | `{questDir}/spoils/design.md` |
| `{questDir}/phase-2-design.md` | `{questDir}/phases/phase-2-design.md` |
| `{questDir}/phase-3-plan.md` | `{questDir}/phases/phase-3-plan.md` |
| `{questDir}/phase-4-implementation.md` | `{questDir}/phases/phase-4-implementation.md` |
| `{questDir}/review.md` | `{questDir}/spoils/review.md` |
| `{questDir}/phase-5-review.md` | `{questDir}/phases/phase-5-review.md` |

All occurrences throughout the file. Leave `{questDir}/phase-6-wrap-up.md` unchanged.

- [ ] **Step 3: Update raid-canonical-protocol/SKILL.md**

Read the file first. Update the deliverables table (lines 127-132):

Old:
```
| PRD | (none — wizard+human only) | `{questDir}/prd.md` |
| Design | `{questDir}/phase-2-design.md` | `{questDir}/design.md` |
| Plan | `{questDir}/phase-3-plan.md` | task files (`phase-3-plan-task-NN.md`) |
| Implementation | `{questDir}/phase-4-implementation.md` | code changes + summary table |
| Review | `{questDir}/phase-5-review.md` | `{questDir}/review.md` (fix plan) |
| Wrap Up | `{questDir}/phase-6-wrap-up.md` | PR + storyboard |
```

New:
```
| PRD | (none — wizard+human only) | `{questDir}/spoils/prd.md` |
| Design | `{questDir}/phases/phase-2-design.md` | `{questDir}/spoils/design.md` |
| Plan | `{questDir}/phases/phase-3-plan.md` | task files (`spoils/tasks/phase-3-plan-task-NN.md`) |
| Implementation | `{questDir}/phases/phase-4-implementation.md` | code changes + summary table |
| Review | `{questDir}/phases/phase-5-review.md` | `{questDir}/spoils/review.md` (fix plan) |
| Wrap Up | `{questDir}/phase-6-wrap-up.md` | PR + storyboard |
```

Also update line 170 — the phase open instruction:

Old: `Create {questDir}/phase-N-{name}.md with boilerplate`
New: `Create {questDir}/phases/phase-N-{name}.md with boilerplate`

- [ ] **Step 4: Verify no stale root-level phase/spoil references remain across all skills**

Run: `grep -rn '{questDir}/phase-[2345]-\|{questDir}/prd.md\|{questDir}/design.md\|{questDir}/review.md' template/.claude/skills/`
Expected: No output (all replaced). `{questDir}/phase-6-wrap-up.md` and `{questDir}/teambuff` references should remain.

- [ ] **Step 5: Commit**

```bash
git add template/.claude/skills/raid-canonical-review/SKILL.md template/.claude/skills/raid-wrap-up/SKILL.md template/.claude/skills/raid-canonical-protocol/SKILL.md
git commit -m "feat(skills): update Review, Wrap-up, and Protocol paths"
```

---

### Task 8: Update CLAUDE.md Quest Filesystem section

**Files:**
- Modify: `CLAUDE.md:112-131`

- [ ] **Step 1: Replace the Quest Filesystem section**

Find the section starting with `### Quest Filesystem` and the code block below it. Replace:

Old:
```
.claude/dungeon/{quest-slug}/          # Active quest artifacts
├── phase-1-prd.md                     # Phase 1 scoreboard (optional)
├── prd.md                             # PRD deliverable (optional)
├── phase-2-design.md                  # Phase 2 scoreboard
├── design.md                          # Design deliverable
├── phase-3-plan.md                    # Phase 3 scoreboard
├── phase-3-plan-task-01.md            # Individual task files (deliverable)
├── phase-4-implementation.md          # Implementation log
├── phase-5-review.md                  # Review board (optional)
├── phase-6-wrap-up.md                 # Quest storyboard
├── teambuff-01.md                     # Team retrospective reports (on-demand)
└── teambuff-rulings.md                # Active rulings from teambuffs
```

New:
```
.claude/dungeon/{quest-slug}/          # Active quest artifacts
├── phases/                            # Evolution logs (scoreboards)
│   ├── phase-2-design.md
│   ├── phase-3-plan.md
│   ├── phase-4-implementation.md
│   └── phase-5-review.md
├── spoils/                            # Polished deliverables
│   ├── prd.md
│   ├── design.md
│   ├── review.md
│   └── tasks/
│       └── phase-3-plan-task-NN.md
├── backups/                           # Pre-compact safety copies
│   └── phase-N-{name}-backup.md
├── phase-6-wrap-up.md                 # Quest storyboard
├── teambuff-NN.md                     # Team retrospective reports (on-demand)
└── teambuff-rulings.md                # Active rulings from teambuffs
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update Quest Filesystem section for new directory structure"
```

---

### Task 9: Full test suite verification

**Files:**
- No new files

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: No new failures beyond the 3 pre-existing (remove/e2e).

- [ ] **Step 2: Run a grep sweep for any missed stale paths**

Run: `grep -rn '{questDir}/phase-[2345]-\|{questDir}/prd.md\|{questDir}/design.md\|{questDir}/review.md' template/.claude/`
Expected: No output. Only `{questDir}/phase-6-wrap-up.md` and `{questDir}/teambuff` should remain at root level.

- [ ] **Step 3: Verify CLAUDE.md consistency**

Run: `grep -c 'phases/' CLAUDE.md && grep -c 'spoils/' CLAUDE.md`
Expected: Both > 0.

- [ ] **Step 4: Commit any fixes if needed**

Only if test failures were found:

```bash
git add -A && git commit -m "fix: test adjustments for dungeon directory restructure"
```
