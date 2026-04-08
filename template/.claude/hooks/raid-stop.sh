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

# Phase ordering: name → rank for comparison
phase_rank() {
  case "$1" in
    design)         echo 1 ;;
    plan)           echo 2 ;;
    implementation) echo 3 ;;
    review)         echo 4 ;;
    finishing)      echo 5 ;;
    *)              echo 0 ;;
  esac
}

# Detect current phase from Dungeon file
# Only matches structured markers: <!-- RAID_PHASE: plan -->
DETECTED_PHASE="$STORED_PHASE"
if [ -f ".claude/raid-dungeon.md" ]; then
  BEST_RANK=0
  BEST_PHASE="$STORED_PHASE"
  for phase_name in $(grep -oE '<!-- RAID_PHASE: (design|plan|implementation|review|finishing) -->' ".claude/raid-dungeon.md" 2>/dev/null | grep -oE '(design|plan|implementation|review|finishing)'); do
    RANK=$(phase_rank "$phase_name")
    if [ "$RANK" -gt "$BEST_RANK" ]; then
      BEST_RANK=$RANK
      BEST_PHASE=$phase_name
    fi
  done
  DETECTED_PHASE="$BEST_PHASE"
fi

# Compare phases by rank
STORED_RANK=$(phase_rank "$STORED_PHASE")
DETECTED_RANK=$(phase_rank "$DETECTED_PHASE")

if [ "$DETECTED_RANK" -gt "$STORED_RANK" ] 2>/dev/null; then
  # Update raid-session with new phase name
  if command -v jq >/dev/null 2>&1; then
    jq --arg phase "$DETECTED_PHASE" '.phase = $phase' ".claude/raid-session" > ".claude/raid-session.tmp" 2>/dev/null && \
      mv ".claude/raid-session.tmp" ".claude/raid-session"
  fi

  cat <<ENDJSON
{
  "hookSpecificOutput": {
    "hookEventName": "Stop",
    "additionalContext": "Phase transition detected ($STORED_PHASE → $DETECTED_PHASE). The Wizard must confirm with the human before opening the next phase."
  }
}
ENDJSON
fi

exit 0
