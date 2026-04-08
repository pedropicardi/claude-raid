#!/usr/bin/env bash
# Raid quality gate: blocks completion claims without recent test evidence
# PreToolUse hook for Bash commands containing 'git commit'
# Checks for .claude/raid-last-test-run timestamp (written by validate-tests-pass.sh)
set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only check git commit commands
if ! echo "$COMMAND" | grep -qE 'git commit'; then
  exit 0
fi

# Extract commit message
MSG=""
if echo "$COMMAND" | grep -qE -- '-m '; then
  MSG=$(echo "$COMMAND" | sed -n 's/.*-m "\([^"]*\)".*/\1/p' | head -1)
  if [ -z "$MSG" ]; then
    MSG=$(echo "$COMMAND" | sed -n "s/.*-m '\\([^']*\\)'.*/\\1/p" | head -1)
  fi
fi

# Try heredoc
if [ -z "$MSG" ]; then
  MSG=$(echo "$COMMAND" | sed -n 's/.*cat <<.*//;n;s/^ *//;p' | head -1)
fi

if [ -z "$MSG" ]; then
  exit 0
fi

# Check if message claims completion
LOWER_MSG=$(echo "$MSG" | tr '[:upper:]' '[:lower:]')
HAS_COMPLETION=false
for WORD in "complete" "done" "finish" "final"; do
  if echo "$LOWER_MSG" | grep -qiw "$WORD"; then
    HAS_COMPLETION=true
    break
  fi
done

if [ "$HAS_COMPLETION" = false ]; then
  exit 0
fi

# Check for recent test run
TIMESTAMP_FILE=".claude/raid-last-test-run"
MAX_AGE=600  # 10 minutes in seconds

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

exit 0
