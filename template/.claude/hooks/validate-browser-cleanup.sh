#!/usr/bin/env bash
# Raid quality gate: warns if browser testing ports are still occupied
# PostToolUse hook for Bash commands
# Checks portRange from .claude/raid.json
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

# Skip if no active Raid session or browser testing not enabled
if [ "$RAID_ACTIVE" != "true" ] || [ "$RAID_BROWSER_ENABLED" != "true" ]; then
  exit 0
fi

# Skip if no port range configured
if [ -z "$RAID_BROWSER_PORT_START" ] || [ -z "$RAID_BROWSER_PORT_END" ]; then
  exit 0
fi

# Check if any ports in range are still occupied
LEAKED_PORTS=""
for PORT in $(seq "$RAID_BROWSER_PORT_START" "$RAID_BROWSER_PORT_END"); do
  if lsof -i :"$PORT" > /dev/null 2>&1; then
    LEAKED_PORTS="${LEAKED_PORTS} ${PORT}"
  fi
done

if [ -n "$LEAKED_PORTS" ]; then
  MSG="Raid Quality Check:\nWARNING: Browser testing ports still in use:${LEAKED_PORTS}\nThis may indicate a failed cleanup. To free them:\n"
  for PORT in $LEAKED_PORTS; do
    MSG="${MSG}  kill \$(lsof -t -i :${PORT})\n"
  done
  raid_warn "$MSG"
fi

exit 0
