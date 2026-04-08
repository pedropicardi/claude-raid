#!/usr/bin/env bash
# Raid lifecycle hook: TeammateIdle
# Nudges idle agents to pick up unclaimed tasks.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

if [ "$RAID_ACTIVE" != "true" ]; then
  exit 0
fi

if [ "$RAID_LIFECYCLE_NUDGE" != "true" ]; then
  exit 0
fi

raid_read_lifecycle_input
TEAMMATE=$(echo "$RAID_HOOK_INPUT" | jq -r '.teammate_name // "Agent"')

cat <<ENDJSON
{
  "hookSpecificOutput": {
    "hookEventName": "TeammateIdle",
    "additionalContext": "$TEAMMATE: Unclaimed tasks remain on the board. Pick up the next available task and report your plan before starting."
  }
}
ENDJSON
exit 0
