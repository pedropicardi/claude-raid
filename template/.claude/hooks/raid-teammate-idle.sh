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

echo "Unclaimed tasks remain on the board. Pick up the next available task and report your plan before starting." >&2
exit 2
