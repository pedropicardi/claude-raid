---
name: raid-git-worktrees
description: "Use when starting Raid implementation that needs isolation. Creates isolated git worktree with safety verification and clean test baseline."
---

# Raid Git Worktrees — Isolated Workspaces

Systematic directory selection + safety verification = reliable isolation.

## Directory Selection Priority

1. Check worktrees path from `.claude/raid.json` (default: `.worktrees/`) -> use it (verify ignored)
2. Check CLAUDE.md for preference -> use it
3. Ask the user

## Safety

```bash
# Verify directory is gitignored before creating
git check-ignore -q [worktrees-path] 2>/dev/null
```

If NOT ignored: add to `.gitignore`, commit, then proceed.

## Creation

```bash
WORKTREE_PATH=$(jq -r '.paths.worktrees // ".worktrees"' .claude/raid.json)
git worktree add "$WORKTREE_PATH/$BRANCH_NAME" -b "$BRANCH_NAME"
cd "$WORKTREE_PATH/$BRANCH_NAME"

# Auto-detect and install deps
[ -f package.json ] && npm install
[ -f Cargo.toml ] && cargo build
[ -f requirements.txt ] && pip install -r requirements.txt
[ -f pyproject.toml ] && poetry install
[ -f go.mod ] && go mod download

# Verify clean baseline — run test command from .claude/raid.json
TEST_CMD=$(jq -r '.project.testCommand // empty' .claude/raid.json)
[ -n "$TEST_CMD" ] && eval "$TEST_CMD"
```

## Report

```
Worktree ready at [path]
Tests passing ([N] tests, 0 failures)
Ready for Raid implementation
```

If tests fail: report failures, ask whether to proceed or investigate.

**Never** create worktree without verifying it's gitignored. **Never** skip baseline test verification. **Never** proceed with failing tests without asking.
