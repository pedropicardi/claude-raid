#!/usr/bin/env bash
# Raid quality gate: validates file naming conventions
# PostToolUse hook for Write and Edit operations
# Sources raid-lib.sh for config and input parsing
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

raid_read_input

if [ -z "$RAID_FILE_PATH" ]; then
  exit 0
fi

ISSUES=""
BASENAME=$(basename "$RAID_FILE_PATH")

# Check 1: No spaces in filenames (always enforced)
if echo "$BASENAME" | grep -qE '[[:space:]]'; then
  ISSUES="${ISSUES}NAMING: File '$BASENAME' contains spaces. Use hyphens or underscores.\n"
fi

# Check 2: Naming convention (if configured)
if [ "$RAID_NAMING" != "none" ]; then
  # Strip extension for naming check
  NAME_PART=$(echo "$BASENAME" | sed 's/\.[^.]*$//')

  case "$RAID_NAMING" in
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

# Check 3: Directory depth (normalize absolute paths to relative first)
_depth_path="$RAID_FILE_PATH"
if [[ "$_depth_path" == /* ]]; then
  _depth_path="${_depth_path#"$PWD"/}"
fi
DEPTH=$(echo "$_depth_path" | awk -F'/' '{print NF}')
if [ "$DEPTH" -gt "$RAID_MAX_DEPTH" ]; then
  ISSUES="${ISSUES}STRUCTURE: File at depth $DEPTH ($RAID_FILE_PATH). Maximum is $RAID_MAX_DEPTH.\n"
fi

if [ -n "$ISSUES" ]; then
  printf "Raid Quality Check:\n%b" "$ISSUES" >&2
  exit 2
fi

exit 0
