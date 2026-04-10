# Dungeon Directory Restructure Design

**Date:** 2026-04-10
**Status:** Approved

## Overview

Restructure the quest dungeon directory from a flat layout (all files at root) into organized subdirectories: `phases/` for evolution logs (scoreboards), `spoils/` for polished deliverables, `spoils/tasks/` for task assignment files, and `backups/` for pre-compact safety copies. Meta files (storyboard, teambuff) remain at quest root.

## Problem

Production dungeons accumulate many files in a flat directory — phase scoreboards, deliverables, backup cascades, task files, meta files — making it hard to navigate. Phase evolution logs and polished outputs are visually indistinguishable.

## New Directory Structure

```
{questDir}/
├── phases/                          # Evolution logs (scoreboards)
│   ├── phase-2-design.md
│   ├── phase-3-plan.md
│   ├── phase-4-implementation.md
│   └── phase-5-review.md
├── spoils/                          # Polished deliverables
│   ├── prd.md
│   ├── design.md
│   ├── review.md
│   └── tasks/
│       ├── phase-3-plan-task-01.md
│       ├── phase-3-plan-task-02.md
│       └── ...
├── backups/                         # Pre-compact safety copies
│   ├── phase-2-design-backup.md
│   └── ...
├── phase-6-wrap-up.md               # Quest storyboard (root)
├── teambuff-NN.md                   # Retrospective reports (root)
└── teambuff-rulings.md              # Active rulings (root)
```

- Phase 1 (PRD) has no scoreboard — the deliverable goes to `spoils/prd.md`
- `review.md` is a new spoil: Phase 5 should extract a clean fix plan deliverable from `phase-5-review.md`, same pattern as design extracts `design.md` from `phase-2-design.md`
- Storyboard and teambuff files stay at quest root — they're quest-level meta, not phase artifacts

## Skill File Changes

Every skill that writes or reads `{questDir}/` paths needs path updates:

| Skill | Old Path | New Path |
|-------|----------|----------|
| `raid-canonical-prd` | `{questDir}/prd.md` | `{questDir}/spoils/prd.md` |
| `raid-canonical-design` | `{questDir}/phase-2-design.md` | `{questDir}/phases/phase-2-design.md` |
| `raid-canonical-design` | `{questDir}/design.md` | `{questDir}/spoils/design.md` |
| `raid-canonical-design` | reads `{questDir}/prd.md` | reads `{questDir}/spoils/prd.md` |
| `raid-canonical-implementation-plan` | `{questDir}/phase-3-plan.md` | `{questDir}/phases/phase-3-plan.md` |
| `raid-canonical-implementation-plan` | `{questDir}/phase-3-plan-task-NN.md` | `{questDir}/spoils/tasks/phase-3-plan-task-NN.md` |
| `raid-canonical-implementation-plan` | reads `{questDir}/design.md` | reads `{questDir}/spoils/design.md` |
| `raid-canonical-implementation-plan` | reads `{questDir}/phase-2-design.md` | reads `{questDir}/phases/phase-2-design.md` |
| `raid-canonical-implementation` | `{questDir}/phase-4-implementation.md` | `{questDir}/phases/phase-4-implementation.md` |
| `raid-canonical-implementation` | reads task files from `{questDir}/` | reads from `{questDir}/spoils/tasks/` |
| `raid-canonical-implementation` | reads `{questDir}/phase-3-plan.md` | reads `{questDir}/phases/phase-3-plan.md` |
| `raid-canonical-review` | `{questDir}/phase-5-review.md` | `{questDir}/phases/phase-5-review.md` |
| `raid-canonical-review` | `{questDir}/review.md` (new spoil) | `{questDir}/spoils/review.md` |
| `raid-canonical-review` | reads `{questDir}/phase-4-implementation.md` | reads `{questDir}/phases/phase-4-implementation.md` |
| `raid-wrap-up` | `{questDir}/phase-6-wrap-up.md` | `{questDir}/phase-6-wrap-up.md` (unchanged) |
| `raid-wrap-up` | reads all phase/spoil files | updated paths throughout |
| `raid-canonical-protocol` | phase deliverables table | updated paths in table |
| `raid-teambuff` | `{questDir}/teambuff-NN.md` | `{questDir}/teambuff-NN.md` (unchanged) |

Cross-references between skills must also be updated (e.g., design skill reading PRD, implementation reading plan).

## Hook Changes

### `raid-session-start.sh`
- After creating `{questDir}`, also create `phases/`, `spoils/`, `spoils/tasks/` subdirectories via `mkdir -p`
- `backups/` is created lazily by `raid-pre-compact.sh` when needed

### `raid-pre-compact.sh`
- Old: copies `{questDir}/phase-*.md` to `{questDir}/phase-*-backup.md`
- New: copies `{questDir}/phases/phase-*.md` to `{questDir}/backups/phase-*-backup.md`
- Creates `{questDir}/backups/` via `mkdir -p` before copying
- Backup cascade fix (`*-backup*` skip guard) carries over

### `validate-write-gate.sh`
- Add patterns for new subdirectories: `.claude/dungeon/*/phases/*.md`, `.claude/dungeon/*/spoils/*.md`, `.claude/dungeon/*/spoils/tasks/*.md`, `.claude/dungeon/*/backups/*.md`

### `validate-dungeon.sh`
- Update `case` patterns to match new subdirectory paths

### `raid-session-end.sh`
- No change needed — copies `{questDir}` recursively to vault, subdirectories archive naturally

## Test Changes

### `tests/hooks/lifecycle.test.js`
- Pre-compact tests: write phase files in `phases/`, assert backups in `backups/`
- Session-start tests: verify `phases/`, `spoils/`, `spoils/tasks/` created
- Session-end tests: verify recursive archive works with subdirectories

### `tests/hooks/validate-write-gate.test.js`
- Add cases for writes to `phases/`, `spoils/`, `spoils/tasks/`, `backups/`

### `tests/hooks/validate-dungeon.test.js`
- Update patterns for new subdirectory paths

## Files Changed

| File | Change |
|------|--------|
| `template/.claude/skills/raid-canonical-protocol/SKILL.md` | Update deliverables table paths |
| `template/.claude/skills/raid-canonical-prd/SKILL.md` | `spoils/prd.md` |
| `template/.claude/skills/raid-canonical-design/SKILL.md` | `phases/`, `spoils/` paths |
| `template/.claude/skills/raid-canonical-implementation-plan/SKILL.md` | `phases/`, `spoils/tasks/` paths |
| `template/.claude/skills/raid-canonical-implementation/SKILL.md` | `phases/`, `spoils/tasks/` paths |
| `template/.claude/skills/raid-canonical-review/SKILL.md` | `phases/`, `spoils/review.md` paths |
| `template/.claude/skills/raid-wrap-up/SKILL.md` | All read paths updated |
| `template/.claude/hooks/raid-session-start.sh` | Scaffold subdirectories |
| `template/.claude/hooks/raid-pre-compact.sh` | Read from `phases/`, write to `backups/` |
| `template/.claude/hooks/validate-write-gate.sh` | Add subdirectory patterns |
| `template/.claude/hooks/validate-dungeon.sh` | Update case patterns |
| `tests/hooks/lifecycle.test.js` | Update paths in pre-compact, session-start, session-end tests |
| `tests/hooks/validate-write-gate.test.js` | Add subdirectory write tests |
| `tests/hooks/validate-dungeon.test.js` | Update pattern tests |
| `CLAUDE.md` | Update "Quest Filesystem" section to reflect new structure |
