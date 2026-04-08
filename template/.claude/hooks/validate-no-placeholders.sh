#!/usr/bin/env bash
# Raid quality gate: blocks placeholder text in specs and plans
# PostToolUse hook for Write and Edit operations
# Only checks files within configured specs/plans paths
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

RAID_CONFIG=".claude/raid.json"

# Read paths from config (defaults)
SPECS_PATH="docs/raid/specs"
PLANS_PATH="docs/raid/plans"
if [ -f "$RAID_CONFIG" ]; then
  CONFIGURED_SPECS=$(jq -r '.paths.specs // empty' "$RAID_CONFIG")
  CONFIGURED_PLANS=$(jq -r '.paths.plans // empty' "$RAID_CONFIG")
  [ -n "$CONFIGURED_SPECS" ] && SPECS_PATH="$CONFIGURED_SPECS"
  [ -n "$CONFIGURED_PLANS" ] && PLANS_PATH="$CONFIGURED_PLANS"
fi

# Only check files in specs or plans directories
IS_RAID_DOC=false
case "$FILE_PATH" in
  "$SPECS_PATH"/*|"$PLANS_PATH"/*) IS_RAID_DOC=true ;;
esac

if [ "$IS_RAID_DOC" = false ]; then
  exit 0
fi

# Read the file content (from tool output if available, otherwise read the file)
CONTENT=$(echo "$INPUT" | jq -r '.tool_output // empty')
if [ -z "$CONTENT" ] && [ -f "$FILE_PATH" ]; then
  CONTENT=$(cat "$FILE_PATH")
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

  for PATTERN in "tbd" "todo" "fixme" "implement later" "add appropriate" "similar to task" "handle edge cases" "fill in"; do
    if echo "$LOWER_LINE" | grep -qi "$PATTERN"; then
      ISSUES="${ISSUES}Line ${LINE_NUM}: Found '${PATTERN}' — ${line}\n"
      break
    fi
  done
done <<< "$CONTENT"

if [ -n "$ISSUES" ]; then
  printf "Raid Placeholder Check:\nBLOCKED: Placeholders found in %s:\n%b\nRemove all placeholders before proceeding.\n" "$FILE_PATH" "$ISSUES" >&2
  exit 2
fi

exit 0
