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
MODE=$(echo "$RAID_HOOK_INPUT" | jq -r '.mode // "full"')

# Only activate for wizard agent type
if [ "$AGENT_TYPE" != "wizard" ]; then
  exit 0
fi

# If resuming and session already exists, no action
if [ "$SOURCE" = "resume" ] && [ -f ".claude/raid-session" ]; then
  exit 0
fi

# Create raid-session file — use jq to safely encode values
mkdir -p .claude
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
jq -n --arg sid "$SESSION_ID" --arg ts "$STARTED_AT" --arg mode "$MODE" \
  '{ sessionId: $sid, startedAt: $ts, phase: "design", mode: $mode }' > .claude/raid-session

# Offer Vault context if entries exist
if [ "$RAID_VAULT_ENABLED" = "true" ]; then
  VAULT_COUNT=$(raid_vault_count)
  if [ "$VAULT_COUNT" -gt 0 ] 2>/dev/null; then
    echo "{\"additionalContext\": \"${VAULT_COUNT} past quest(s) in Vault at ${RAID_VAULT_PATH}/index.md — review for prior decisions and patterns.\"}"
  fi
fi

exit 0
