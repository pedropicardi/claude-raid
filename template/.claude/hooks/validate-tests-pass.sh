#!/usr/bin/env bash
# Raid quality gate: runs tests before allowing commits
# PreToolUse hook for Bash commands containing 'git commit'
# Reads test command from .claude/raid.json
set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only check git commit commands
if ! echo "$COMMAND" | grep -qE 'git commit'; then
  exit 0
fi

RAID_CONFIG=".claude/raid.json"

# Read test command from config
TEST_CMD=""
if [ -f "$RAID_CONFIG" ]; then
  TEST_CMD=$(jq -r '.project.testCommand // empty' "$RAID_CONFIG")
fi

# No test command configured — warn but allow
if [ -z "$TEST_CMD" ]; then
  exit 0
fi

# Run tests
if ! eval "$TEST_CMD" > /dev/null 2>&1; then
  printf "Raid Quality Check:\nTESTS: Tests failed. Fix before committing.\nCommand: %s\n" "$TEST_CMD" >&2
  exit 2
fi

# Write timestamp for verification hook
mkdir -p .claude
date +%s > .claude/raid-last-test-run

exit 0
