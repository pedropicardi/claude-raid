#!/usr/bin/env bash
# Raid quality gate: blocks placeholder text in specs and plans
# PostToolUse hook for Write and Edit operations
# Sources raid-lib.sh for config and input parsing
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

raid_read_input

if [ -z "$RAID_FILE_PATH" ]; then
  exit 0
fi

# Normalize absolute paths to relative
_file="${RAID_FILE_PATH}"
if [[ "$_file" == /* ]]; then
  _file="${_file#"$PWD"/}"
  # Handle symlink mismatch (e.g., macOS /var -> /private/var) by resolving input path
  if [[ "$_file" == /* ]] && [ -e "$_file" ]; then
    _file="$(cd "$(dirname "$_file")" && pwd -P)/$(basename "$_file")"
    _file="${_file#"$(pwd -P)"/}"
  fi
fi

# Only check files in specs or plans directories
IS_RAID_DOC=false
case "$_file" in
  "$RAID_SPECS_PATH"/*|"$RAID_PLANS_PATH"/*|.claude/dungeon/*/phases/phase-*.md|.claude/dungeon/*/spoils/*.md|.claude/dungeon/*/spoils/tasks/*.md|.claude/dungeon/*/phase-*.md) IS_RAID_DOC=true ;;
esac

if [ "$IS_RAID_DOC" = false ]; then
  exit 0
fi

# Read the actual file content (tool_output is the tool's response message, not file content)
CONTENT=""
if [ -f "$RAID_FILE_PATH" ]; then
  CONTENT=$(cat "$RAID_FILE_PATH")
fi

if [ -z "$CONTENT" ]; then
  exit 0
fi

ISSUES=""
LINE_NUM=0

# Scan for placeholder patterns (case-insensitive)
while IFS= read -r line; do
  LINE_NUM=$((LINE_NUM + 1))
  LOWER_LINE=$(echo "$line" | tr '[:upper:]' '[:lower:]')

  for PATTERN in '\btbd\b' '\btodo\b' '\bfixme\b' 'implement later' 'add appropriate' 'similar to task' 'handle edge cases' 'fill in'; do
    if echo "$LOWER_LINE" | grep -qiE "$PATTERN"; then
      ISSUES="${ISSUES}Line ${LINE_NUM}: Found '${PATTERN}' — ${line}\n"
      break
    fi
  done
done <<< "$CONTENT"

if [ -n "$ISSUES" ]; then
  printf "Raid Placeholder Check:\nBLOCKED: Placeholders found in %s:\n%b\nRemove all placeholders before proceeding.\n" "$RAID_FILE_PATH" "$ISSUES" >&2
  exit 2
fi

exit 0
