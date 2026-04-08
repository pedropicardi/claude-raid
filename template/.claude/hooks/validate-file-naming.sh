#!/usr/bin/env bash
# Raid quality gate: validates file naming conventions
# PostToolUse hook for Write and Edit operations
# Reads conventions from .claude/raid.json
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

RAID_CONFIG=".claude/raid.json"
ISSUES=""

# Read naming convention from config (default: none)
NAMING="none"
if [ -f "$RAID_CONFIG" ]; then
  NAMING=$(jq -r '.conventions.fileNaming // "none"' "$RAID_CONFIG")
fi

BASENAME=$(basename "$FILE_PATH")

# Check 1: No spaces in filenames (always enforced)
if echo "$BASENAME" | grep -qE '[[:space:]]'; then
  ISSUES="${ISSUES}NAMING: File '$BASENAME' contains spaces. Use hyphens or underscores.\n"
fi

# Check 2: Naming convention (if configured)
if [ "$NAMING" != "none" ]; then
  # Strip extension for naming check
  NAME_PART=$(echo "$BASENAME" | sed 's/\.[^.]*$//')

  case "$NAMING" in
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

# Check 3: Directory depth (default max 8)
MAX_DEPTH=8
if [ -f "$RAID_CONFIG" ]; then
  CONFIGURED_DEPTH=$(jq -r '.conventions.maxDepth // empty' "$RAID_CONFIG")
  if [ -n "$CONFIGURED_DEPTH" ]; then
    MAX_DEPTH="$CONFIGURED_DEPTH"
  fi
fi

DEPTH=$(echo "$FILE_PATH" | awk -F'/' '{print NF}')
if [ "$DEPTH" -gt "$MAX_DEPTH" ]; then
  ISSUES="${ISSUES}STRUCTURE: File at depth $DEPTH ($FILE_PATH). Maximum is $MAX_DEPTH.\n"
fi

if [ -n "$ISSUES" ]; then
  printf "Raid Quality Check:\n%b" "$ISSUES" >&2
  exit 2
fi

exit 0
