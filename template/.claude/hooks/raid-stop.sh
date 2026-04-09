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

# Phase transitions are managed by the Wizard via raid_session_set().
# No automatic detection needed — the Wizard explicitly updates the session.

exit 0
