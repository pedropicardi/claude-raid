#!/usr/bin/env bash
# Raid lifecycle hook: Stop
# Detects phase transitions and injects human confirmation gate.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

if [ "$RAID_ACTIVE" != "true" ]; then
  exit 0
fi

if [ "$RAID_LIFECYCLE_PHASE_CONFIRM" != "true" ]; then
  exit 0
fi

STORED_PHASE="$RAID_PHASE"

# Detect current phase from Dungeon file
DETECTED_PHASE="$STORED_PHASE"
if [ -f ".claude/raid-dungeon.md" ]; then
  HIGHEST=$(grep -oiE '(phase|PHASE)\s+[0-9]+' ".claude/raid-dungeon.md" 2>/dev/null | grep -oE '[0-9]+' | sort -rn | head -1)
  if [ -n "$HIGHEST" ]; then
    DETECTED_PHASE="$HIGHEST"
  fi
fi

# If phase advanced, update session and inject confirmation
if [ -n "$DETECTED_PHASE" ] && [ -n "$STORED_PHASE" ] && [ "$DETECTED_PHASE" -gt "$STORED_PHASE" ] 2>/dev/null; then
  # Update raid-session with new phase
  if command -v jq >/dev/null 2>&1; then
    jq --argjson phase "$DETECTED_PHASE" '.phase = $phase' ".claude/raid-session" > ".claude/raid-session.tmp" 2>/dev/null && \
      mv ".claude/raid-session.tmp" ".claude/raid-session"
  fi

  cat <<ENDJSON
{
  "hookSpecificOutput": {
    "hookEventName": "Stop",
    "additionalContext": "Phase transition detected (Phase $STORED_PHASE → Phase $DETECTED_PHASE). The Wizard must confirm with the human before opening the next phase."
  }
}
ENDJSON
fi

exit 0
