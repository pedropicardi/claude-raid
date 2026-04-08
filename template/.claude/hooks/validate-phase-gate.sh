#!/usr/bin/env bash
# Raid quality gate: blocks implementation without a design doc
# PreToolUse hook for Write operations
# Reads mode and paths from .claude/raid.json
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

RAID_CONFIG=".claude/raid.json"

# Skip if no config (Raid not initialized)
if [ ! -f "$RAID_CONFIG" ]; then
  exit 0
fi

# Skip if no active Raid session — don't block normal work
# The Wizard creates .claude/raid-session when a Raid starts
if [ ! -f ".claude/raid-session" ]; then
  exit 0
fi

# Read mode and specs path
MODE=$(jq -r '.raid.defaultMode // "full"' "$RAID_CONFIG")
SPECS_PATH=$(jq -r '.paths.specs // "docs/raid/specs"' "$RAID_CONFIG")

# Scout mode: no phase gate
if [ "$MODE" = "scout" ]; then
  exit 0
fi

# Skip checks for non-implementation files
# Allow: docs, tests, config files, raid files, markdown
case "$FILE_PATH" in
  docs/*|test/*|tests/*|*.test.*|*.spec.*|*_test.*|*_spec.*) exit 0 ;;
  .claude/*|*.json|*.yml|*.yaml|*.toml|*.md|*.lock) exit 0 ;;
  *.config.*|*.rc|.gitignore|Makefile|Dockerfile) exit 0 ;;
esac

# Check if any design doc exists in specs path
if [ -d "$SPECS_PATH" ]; then
  DOC_COUNT=$(find "$SPECS_PATH" -name "*.md" -type f 2>/dev/null | head -1)
  if [ -n "$DOC_COUNT" ]; then
    exit 0
  fi
fi

# No design doc found
if [ "$MODE" = "full" ]; then
  printf "Raid Phase Gate:\nBLOCKED: No design doc found in %s.\nCreate a design doc before writing implementation code.\nUse 'raid-design' skill or set mode to 'scout' in .claude/raid.json.\n" "$SPECS_PATH" >&2
  exit 2
fi

# Skirmish mode: warn only
printf "Raid Phase Gate:\nWARNING: No design doc found in %s. Consider creating one.\n" "$SPECS_PATH" >&2
exit 0
