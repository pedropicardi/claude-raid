#!/usr/bin/env bash
# Raid write gate: protects enforcement-critical files from direct agent writes.
# Phase-aware code enforcement is handled by the skill layer.
# PreToolUse hook — blocks writes to protected files only.
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$HOOK_DIR/raid-lib.sh"

raid_read_input

# No file path — nothing to gate
if [ -z "${RAID_FILE_PATH:-}" ]; then
  exit 0
fi

# No active session — allow everything
if [ "$RAID_ACTIVE" = "false" ]; then
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

# Protect enforcement-critical files from direct agent writes.
# Hooks and Wizard use Bash-level operations (jq redirect, rm) for these files.
case "$_file" in
  .claude/raid-session|.claude/raid-last-test-run)
    raid_block "File '${_file}' is protected. It is managed by hooks and the Wizard."
    ;;
esac

# Quest dungeon dir markdown files are always allowed (including subdirectories)
case "$_file" in
  .claude/dungeon/*.md|.claude/dungeon/*/*.md|.claude/dungeon/*/*/*.md)
    exit 0
    ;;
esac

# Phase-based enforcement on production files
# Only block production code in non-implementation phases
if raid_is_production_file "$RAID_FILE_PATH"; then
  case "${RAID_PHASE:-}" in
    prd)
      raid_block "PRD phase. No implementation code allowed."
      ;;
    design)
      raid_block "Design phase. No implementation code allowed."
      ;;
    plan)
      raid_block "Plan phase. No implementation code allowed."
      ;;
    wrap-up)
      raid_block "Wrap-up phase. No new code."
      ;;
    implementation|review)
      # Allow — skill layer handles implementer/fixing enforcement
      exit 0
      ;;
    "")
      # Empty phase during session bootstrap — allow
      exit 0
      ;;
    *)
      raid_block "Unknown phase '${RAID_PHASE}'. Cannot determine write permissions."
      ;;
  esac
fi
