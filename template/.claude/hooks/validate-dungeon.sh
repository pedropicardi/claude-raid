#!/usr/bin/env bash
# Raid dungeon discipline: validates Dungeon entry format, evidence, and phase consistency
# PostToolUse hook for Write|Edit operations on Dungeon files.
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$HOOK_DIR/raid-lib.sh"

raid_read_input

# No file path — nothing to validate
if [ -z "${RAID_FILE_PATH:-}" ]; then
  exit 0
fi

# Only check Dungeon files
case "$RAID_FILE_PATH" in
  */.claude/raid-dungeon.md|*/.claude/raid-dungeon-phase-*.md) ;;
  .claude/raid-dungeon.md|.claude/raid-dungeon-phase-*.md) ;;
  *) exit 0 ;;
esac

# No active session — skip validation
if [ "$RAID_ACTIVE" = "false" ]; then
  exit 0
fi

# Read the actual file content
if [ ! -f "$RAID_FILE_PATH" ]; then
  exit 0
fi

issues=()

while IFS= read -r line; do
  # Skip empty lines
  [ -z "$line" ] && continue

  # Skip header lines (lines starting with #)
  case "$line" in
    \#*) continue ;;
  esac

  # Layer 1: Format check — must have a recognized prefix
  has_prefix=false
  entry_type=""
  content_after_prefix=""

  case "$line" in
    "📌 DUNGEON:"*)
      has_prefix=true
      entry_type="DUNGEON"
      content_after_prefix="${line#📌 DUNGEON:}"
      ;;
    "⚠️ UNRESOLVED:"*)
      has_prefix=true
      entry_type="UNRESOLVED"
      ;;
    "✅ RESOLVED:"*)
      has_prefix=true
      entry_type="RESOLVED"
      ;;
    "📋 TASK:"*)
      has_prefix=true
      entry_type="TASK"
      ;;
  esac

  if [ "$has_prefix" = "false" ]; then
    issues+=("Unrecognized prefix on line: ${line:0:60}")
    continue
  fi

  # Layer 2: Evidence check — only for pinned entries
  if [ "$entry_type" = "DUNGEON" ]; then
    # Strip leading whitespace from content after prefix
    content_after_prefix="$(echo "$content_after_prefix" | sed 's/^[[:space:]]*//')"
    content_len=${#content_after_prefix}
    if [ "$content_len" -lt 50 ]; then
      issues+=("Pinned entry too short. Include evidence.")
    fi

    # Check that pinned entries reference at least two agents (survived challenge)
    agent_count=0
    echo "$content_after_prefix" | grep -qi "warrior" && agent_count=$((agent_count + 1))
    echo "$content_after_prefix" | grep -qi "archer" && agent_count=$((agent_count + 1))
    echo "$content_after_prefix" | grep -qi "rogue" && agent_count=$((agent_count + 1))
    echo "$content_after_prefix" | grep -qi "wizard" && agent_count=$((agent_count + 1))
    if [ "$agent_count" -lt 2 ]; then
      issues+=("Pinned entry must reference at least 2 agents who verified it (e.g., 'verified by @Warrior and @Archer').")
    fi
  fi

  # Layer 3: Phase consistency
  if [ "$entry_type" = "TASK" ]; then
    case "${RAID_PHASE:-}" in
      design|implementation|review)
        issues+=("TASK entries belong in Plan phase, not ${RAID_PHASE}.")
        ;;
    esac
  fi

done < "$RAID_FILE_PATH"

# Report all issues together
if [ ${#issues[@]} -gt 0 ]; then
  msg="Dungeon validation failed:"
  for issue in "${issues[@]}"; do
    msg="$msg
  - $issue"
  done
  raid_block "$msg"
fi

exit 0
