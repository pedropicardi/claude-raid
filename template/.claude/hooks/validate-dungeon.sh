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

# Normalize to relative path
_file="${RAID_FILE_PATH}"
if [[ "$_file" == /* ]]; then
  _file="${_file#"$PWD"/}"
fi

# Only check Dungeon files (quest directory structure + backward compat flat files)
case "$_file" in
  .claude/dungeon/*/phase-*.md) ;;
  .claude/dungeon/*/phases/phase-*.md) ;;
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

issues=""
current_section="unknown"

while IFS= read -r line; do
  # Skip empty lines
  [ -z "$line" ] && continue

  # Track current section from ### headers
  case "$line" in
    "### Discoveries"*) current_section="discoveries"; continue ;;
    "### Active Battles"*) current_section="battles"; continue ;;
    "### Resolved"*) current_section="resolved"; continue ;;
    "### Shared Knowledge"*) current_section="shared"; continue ;;
    "### Escalations"*) current_section="escalations"; continue ;;
  esac

  # Skip all header lines (lines starting with #)
  case "$line" in
    \#*) continue ;;
  esac

  # Only enforce prefixes in Discoveries and Active Battles sections.
  # All other sections (including evolution log content, freeform review, etc.) are allowed.
  case "$current_section" in
    discoveries|battles) ;;
    *) continue ;;
  esac

  # Layer 1: Format check — must have a recognized prefix (Discoveries + Active Battles only)
  has_prefix=false
  entry_type=""
  content_after_prefix=""

  case "$line" in
    "DUNGEON:"*|"📌 DUNGEON:"*)
      has_prefix=true
      entry_type="DUNGEON"
      content_after_prefix="${line#*DUNGEON:}"
      ;;
    "BLACKCARD:"*|"🃏 BLACKCARD:"*)
      has_prefix=true
      entry_type="BLACKCARD"
      content_after_prefix="${line#*BLACKCARD:}"
      ;;
    "UNRESOLVED:"*|"⚠️ UNRESOLVED:"*)
      has_prefix=true
      entry_type="UNRESOLVED"
      ;;
    "RESOLVED:"*|"✅ RESOLVED:"*)
      has_prefix=true
      entry_type="RESOLVED"
      ;;
    "TASK:"*|"📋 TASK:"*)
      has_prefix=true
      entry_type="TASK"
      ;;
  esac

  if [ "$has_prefix" = "false" ]; then
    issues="${issues}
  - Unrecognized prefix on line: ${line:0:60}"
    continue
  fi

  # Layer 2: Evidence check — for pinned entries and black cards
  if [ "$entry_type" = "DUNGEON" ]; then
    content_after_prefix="$(echo "$content_after_prefix" | sed 's/^[[:space:]]*//')"
    content_len=${#content_after_prefix}
    if [ "$content_len" -lt 50 ]; then
      issues="${issues}
  - Pinned entry too short. Include evidence."
    fi

    # Check that pinned entries reference at least two agents (word boundaries)
    agent_count=0
    echo "$content_after_prefix" | grep -qiw "warrior" && agent_count=$((agent_count + 1))
    echo "$content_after_prefix" | grep -qiw "archer" && agent_count=$((agent_count + 1))
    echo "$content_after_prefix" | grep -qiw "rogue" && agent_count=$((agent_count + 1))
    echo "$content_after_prefix" | grep -qiw "wizard" && agent_count=$((agent_count + 1))
    if [ "$agent_count" -lt 2 ]; then
      issues="${issues}
  - Pinned entry must reference at least 2 agents who verified it (e.g., 'verified by @Warrior and @Archer')."
    fi
  fi

  if [ "$entry_type" = "BLACKCARD" ]; then
    content_after_prefix="$(echo "$content_after_prefix" | sed 's/^[[:space:]]*//')"
    content_len=${#content_after_prefix}
    if [ "$content_len" -lt 80 ]; then
      issues="${issues}
  - Black card entry too short (${content_len} chars, minimum 80). Describe the breaking concern with evidence."
    fi
  fi

  # Layer 3: Phase consistency — TASK entries belong in plan or wrap-up phases
  if [ "$entry_type" = "TASK" ] && [ -n "${RAID_PHASE:-}" ] && [ "${RAID_PHASE}" != "plan" ] && [ "${RAID_PHASE}" != "wrap-up" ] && [ "${RAID_PHASE}" != "finishing" ]; then
    issues="${issues}
  - TASK entries belong in Plan phase, not ${RAID_PHASE}."
  fi

done < "$RAID_FILE_PATH"

# Report all issues together
if [ -n "$issues" ]; then
  raid_block "Dungeon validation failed:${issues}"
fi

exit 0
