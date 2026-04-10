#!/usr/bin/env bash
# Raid quality gate: commit message format validation
# PreToolUse hook for Bash commands containing 'git commit'
# Validates conventional commit format and message length.
# Test execution gating is handled by the skill layer (raid-verification).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

raid_read_input

# Only check git commit commands (match command position, not heredoc content)
if ! echo "$RAID_COMMAND" | grep -qE '(^|;|&&|\|\|)\s*git\s+commit\b'; then
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
  _heredoc_delim=$(echo "$RAID_COMMAND" | grep -oE "<<-?'?\"?([A-Za-z_]+)'?\"?" | head -1 | sed "s/<<-\?['\"]*//" | sed "s/['\"]//g" || true)
  if [ -n "$_heredoc_delim" ]; then
    MSG=$(echo "$RAID_COMMAND" | sed -n "/<<.*${_heredoc_delim}/,/^[[:space:]]*${_heredoc_delim}/{ /<<.*${_heredoc_delim}/d; /^[[:space:]]*${_heredoc_delim}/d; p; }" | head -1 | sed 's/^[[:space:]]*//' || true)
  fi
fi

# If no message found, warn but allow
if [ -z "$MSG" ]; then
  if echo "$RAID_COMMAND" | grep -qE -- '-m |<<'; then
    raid_warn "COMMIT: Could not extract commit message for validation."
  fi
  exit 0
fi

# Use first line only
MSG=$(echo "$MSG" | head -1)

# ============================================================
# Conventional commit format
# ============================================================

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

exit 0
