#!/usr/bin/env bash
# Raid quality gate: consolidated commit validation hook
# PreToolUse hook for Bash commands containing 'git commit'
# Consolidates: validate-commit-message.sh, validate-tests-pass.sh, validate-verification.sh
# Cross-platform: uses grep -E (not grep -P)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

raid_read_input

# Only check git commit commands
if ! echo "$RAID_COMMAND" | grep -qE 'git commit'; then
  exit 0
fi

# --- Extract commit message ---
MSG=""
if echo "$RAID_COMMAND" | grep -qE -- '-m '; then
  # Try double-quoted: -m "..."
  MSG=$(echo "$RAID_COMMAND" | sed -n 's/.*-m "\([^"]*\)".*/\1/p' | head -1)
  # Try single-quoted: -m '...'
  if [ -z "$MSG" ]; then
    MSG=$(echo "$RAID_COMMAND" | sed -n "s/.*-m '\\([^']*\\)'.*/\\1/p" | head -1)
  fi
fi

# Try heredoc pattern
if [ -z "$MSG" ]; then
  MSG=$(echo "$RAID_COMMAND" | sed -n 's/.*cat <<.*//;n;s/^ *//;p' | head -1)
fi

# If no message found (editor mode), allow
if [ -z "$MSG" ]; then
  exit 0
fi

# Use first line only for checks
MSG=$(echo "$MSG" | head -1)

# ============================================================
# Check 1: Message format (always active, no session required)
# ============================================================

# Conventional commit format
if ! echo "$MSG" | grep -qE '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .+'; then
  raid_block "COMMIT: Message must follow conventional commit format (type(scope): description). Got: '$MSG'"
fi

# Minimum length
MIN_LENGTH="${RAID_COMMIT_MIN_LENGTH:-15}"
MSG_LENGTH=${#MSG}
if [ "$MSG_LENGTH" -lt "$MIN_LENGTH" ]; then
  raid_block "COMMIT: Message too short (${MSG_LENGTH} chars, minimum ${MIN_LENGTH})."
fi

# Block generic messages
LOWER_MSG=$(echo "$MSG" | tr '[:upper:]' '[:lower:]')
case "$LOWER_MSG" in
  update|fix|change|modify|edit|wip|temp|test|stuff|things|misc)
    raid_block "COMMIT: Message is too generic. Describe WHAT changed and WHY."
    ;;
esac

# ============================================================
# Check 2: Tests pass (Raid-session only)
# ============================================================

if [ "$RAID_ACTIVE" = "true" ] && [ -n "$RAID_TEST_CMD" ]; then
  # TRUST: RAID_TEST_CMD comes from project-local raid.json — user-controlled, not untrusted input
  set +e
  (eval "$RAID_TEST_CMD") > /dev/null 2>&1
  _test_rc=$?
  set -e
  if [ "$_test_rc" -ne 0 ]; then
    raid_block "TESTS: Tests failed. Fix before committing. Command: $RAID_TEST_CMD"
  fi
  # Run browser tests if enabled and Playwright is installed
  if [ "$RAID_BROWSER_ENABLED" = "true" ] && [ -n "$RAID_BROWSER_PW_CONFIG" ] && [ -f "$RAID_BROWSER_PW_CONFIG" ]; then
    set +e
    ($RAID_BROWSER_EXEC_CMD playwright test --reporter=list) > /dev/null 2>&1
    _pw_rc=$?
    set -e
    if [ "$_pw_rc" -ne 0 ]; then
      raid_block "BROWSER TESTS: Playwright tests failed. Fix before committing. Command: $RAID_BROWSER_EXEC_CMD playwright test"
    fi
  fi

  # Write timestamp on success (only when ALL tests pass — unit AND browser)
  mkdir -p .claude
  date +%s > .claude/raid-last-test-run
fi

# ============================================================
# Check 3: Verification (Raid-session only, completion commits)
# ============================================================

if [ "$RAID_ACTIVE" = "true" ]; then
  HAS_COMPLETION=false
  for WORD in "complete" "done" "finish" "final"; do
    if echo "$LOWER_MSG" | grep -qiw "$WORD"; then
      HAS_COMPLETION=true
      break
    fi
  done

  if [ "$HAS_COMPLETION" = "true" ]; then
    TIMESTAMP_FILE=".claude/raid-last-test-run"
    MAX_AGE=600

    if [ ! -f "$TIMESTAMP_FILE" ]; then
      raid_block "VERIFICATION: Commit claims completion but no test run evidence found. Run tests before claiming work is complete."
    fi

    LAST_RUN=$(cat "$TIMESTAMP_FILE")
    NOW=$(date +%s)
    AGE=$((NOW - LAST_RUN))

    if [ "$AGE" -gt "$MAX_AGE" ]; then
      raid_block "VERIFICATION: Last test run was $((AGE / 60)) minutes ago. Run tests again before claiming completion."
    fi
  fi
fi

exit 0
