#!/usr/bin/env bash
# Raid quality gate: validates commit messages follow conventional format
# PreToolUse hook for Bash commands containing 'git commit'
# Cross-platform: uses grep -E (not grep -P)
set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only check git commit commands
if ! echo "$COMMAND" | grep -qE 'git commit'; then
  exit 0
fi

# Extract commit message — handle both -m "msg" and heredoc patterns
# Try -m flag first (handles both single and double quotes)
MSG=""
if echo "$COMMAND" | grep -qE -- '-m '; then
  # Extract message after -m, handling quotes
  # First try double-quoted: -m "..."
  MSG=$(echo "$COMMAND" | sed -n 's/.*-m "\([^"]*\)".*/\1/p' | head -1)
  # If empty, try single-quoted: -m '...'
  if [ -z "$MSG" ]; then
    MSG=$(echo "$COMMAND" | sed -n "s/.*-m '\\([^']*\\)'.*/\\1/p" | head -1)
  fi
fi

# Try heredoc pattern: -m "$(cat <<'EOF' ... EOF )"
if [ -z "$MSG" ]; then
  MSG=$(echo "$COMMAND" | sed -n 's/.*cat <<.*//;n;s/^ *//;p' | head -1)
fi

# If still no message found, might be using editor — allow it
if [ -z "$MSG" ]; then
  exit 0
fi

# For heredoc/multiline, only check the first line
MSG=$(echo "$MSG" | head -1)

RAID_CONFIG=".claude/raid.json"
ISSUES=""

# Check 1: Conventional commit format
if ! echo "$MSG" | grep -qE '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .+'; then
  ISSUES="${ISSUES}COMMIT: Message must follow 'type(scope): description' format.\n"
  ISSUES="${ISSUES}  Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert\n"
  ISSUES="${ISSUES}  Got: '$MSG'\n"
fi

# Check 2: Minimum length (default 15, configurable)
MIN_LENGTH=15
if [ -f "$RAID_CONFIG" ]; then
  CONFIGURED_MIN=$(jq -r '.conventions.commitMinLength // empty' "$RAID_CONFIG")
  if [ -n "$CONFIGURED_MIN" ]; then
    MIN_LENGTH="$CONFIGURED_MIN"
  fi
fi

MSG_LENGTH=${#MSG}
if [ "$MSG_LENGTH" -lt "$MIN_LENGTH" ]; then
  ISSUES="${ISSUES}COMMIT: Message too short (${MSG_LENGTH} chars, minimum ${MIN_LENGTH}).\n"
fi

# Check 3: No generic messages
LOWER_MSG=$(echo "$MSG" | tr '[:upper:]' '[:lower:]')
case "$LOWER_MSG" in
  update|fix|change|modify|edit|wip|temp|test|stuff|things|misc)
    ISSUES="${ISSUES}COMMIT: Message is too generic. Describe WHAT changed and WHY.\n"
    ;;
esac

if [ -n "$ISSUES" ]; then
  printf "Raid Commit Quality Check:\n%b" "$ISSUES" >&2
  exit 2
fi

exit 0
