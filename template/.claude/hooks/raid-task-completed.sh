#!/usr/bin/env bash
# Raid lifecycle hook: TaskCompleted
# Blocks task completion if tests haven't run recently.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

if [ "$RAID_ACTIVE" != "true" ]; then
  exit 0
fi

if [ "$RAID_LIFECYCLE_COMPLETION_GATE" != "true" ]; then
  exit 0
fi

TEST_RUN_FILE=".claude/raid-last-test-run"

if [ ! -f "$TEST_RUN_FILE" ]; then
  raid_block "Tests must pass before marking a task complete. No test run recorded — run your test command first."
fi

LAST_RUN=$(cat "$TEST_RUN_FILE" 2>/dev/null | tr -d '[:space:]')
NOW=$(date +%s)
WINDOW=$((RAID_LIFECYCLE_TEST_WINDOW * 60))
# Guard against corrupted/non-numeric timestamp
case "$LAST_RUN" in
  ''|*[!0-9]*) raid_block "Tests must pass before marking a task complete. Test run timestamp is invalid — run your test command first." ;;
esac
AGE=$((NOW - LAST_RUN))

if [ "$AGE" -gt "$WINDOW" ]; then
  MINS_AGO=$((AGE / 60))
  raid_block "Tests last ran $MINS_AGO minutes ago (window is $RAID_LIFECYCLE_TEST_WINDOW min). Run tests again before marking this task complete."
fi

exit 0
