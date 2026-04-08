#!/usr/bin/env bash
# Raid lifecycle hook: SessionStart
# Creates raid-session file and offers Vault access.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

# Check if lifecycle session management is enabled
if [ "$RAID_LIFECYCLE_SESSION" != "true" ]; then
  exit 0
fi

raid_read_lifecycle_input

# Parse session start fields
SOURCE=$(echo "$RAID_HOOK_INPUT" | jq -r '.source // "startup"')
AGENT_TYPE=$(echo "$RAID_HOOK_INPUT" | jq -r '.agent_type // ""')
SESSION_ID=$(echo "$RAID_HOOK_INPUT" | jq -r '.session_id // ""')

# Only activate for wizard agent type
if [ "$AGENT_TYPE" != "wizard" ]; then
  exit 0
fi

# If resuming and session already exists, no action
if [ "$SOURCE" = "resume" ] && [ -f ".claude/raid-session" ]; then
  exit 0
fi

# Create raid-session file
mkdir -p .claude
cat > .claude/raid-session <<ENDJSON
{
  "sessionId": "$SESSION_ID",
  "startedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "phase": 1
}
ENDJSON

# Check Vault for past quests
VAULT_COUNT=$(raid_vault_count)

if [ "$VAULT_COUNT" -gt 0 ] && [ "$RAID_VAULT_ENABLED" = "true" ]; then
  cat <<ENDJSON
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "The Vault contains $VAULT_COUNT past quest(s). Ask the human if the party should consult the Vault before beginning this quest."
  }
}
ENDJSON
fi

exit 0
