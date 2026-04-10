#!/usr/bin/env bash
# rtk-bridge.sh — Token compression bridge to RTK.
# Delegates to `rtk hook claude` unless bypassed by config or phase.
# Fail-open: if anything goes wrong, exit 0 (original command runs uncompressed).

set -euo pipefail

# Source raid-lib for session state + config
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

# 1. Check if rtk binary exists
if ! command -v rtk >/dev/null 2>&1; then
  exit 0
fi

# 2. Check if RTK is enabled in raid.json
if [ "$RAID_RTK_ENABLED" != "true" ]; then
  exit 0
fi

# 3. Read stdin (hook input JSON) — we need it for bypass checks and to pass to rtk
INPUT=$(cat)

# 4. Phase bypass — if active session and current phase is in bypass list
if [ "$RAID_ACTIVE" = "true" ] && [ -n "$RAID_PHASE" ] && [ "$RAID_RTK_BYPASS_PHASES" != "[]" ]; then
  if echo "$RAID_RTK_BYPASS_PHASES" | jq -e --arg p "$RAID_PHASE" 'index($p) != null' >/dev/null 2>&1; then
    exit 0
  fi
fi

# 5. Command bypass — check if command prefix matches any bypass entry
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
if [ -n "$COMMAND" ] && [ "$RAID_RTK_BYPASS_COMMANDS" != "[]" ]; then
  while IFS= read -r prefix; do
    if [ -n "$prefix" ] && [[ "$COMMAND" == "$prefix"* ]]; then
      exit 0
    fi
  done < <(echo "$RAID_RTK_BYPASS_COMMANDS" | jq -r '.[]' 2>/dev/null)
fi

# 6. All checks passed — delegate to rtk
echo "$INPUT" | rtk hook claude 2>/dev/null || exit 0
