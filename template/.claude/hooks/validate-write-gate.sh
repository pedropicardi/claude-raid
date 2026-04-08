#!/usr/bin/env bash
# Raid write gate: phase-aware controller for Write operations
# PreToolUse hook — blocks or allows writes based on current Raid phase, mode, and agent role.
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

# Non-production files (docs, tests, config, .claude) are always allowed
if ! raid_is_production_file "$RAID_FILE_PATH"; then
  exit 0
fi

# --- Phase-based enforcement on production files ---

case "${RAID_PHASE:-}" in
  design)
    raid_block "Read-only phase (design). No implementation code allowed."
    ;;
  plan)
    raid_block "Read-only phase (plan). No implementation code allowed."
    ;;
  implementation)
    # Scout mode: skip implementer check
    if [ "$RAID_MODE" = "scout" ]; then
      exit 0
    fi
    # Only the designated implementer may write production code
    if [ "$RAID_CURRENT_AGENT" != "$RAID_IMPLEMENTER" ]; then
      raid_block "Only ${RAID_IMPLEMENTER} writes production code this task."
    fi
    exit 0
    ;;
  review)
    if [ "$RAID_MODE" = "skirmish" ]; then
      raid_warn "Read-only phase (review). File fixes go through implementation."
    fi
    raid_block "Read-only phase (review). File fixes go through implementation."
    ;;
  finishing)
    raid_block "Finishing phase. No new code."
    ;;
  *)
    # Unknown or empty phase — fail open
    exit 0
    ;;
esac
