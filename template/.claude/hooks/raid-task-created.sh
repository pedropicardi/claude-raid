#!/usr/bin/env bash
# Raid lifecycle hook: TaskCreated
# Validates task subjects are descriptive enough.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

if [ "$RAID_ACTIVE" != "true" ]; then
  exit 0
fi

if [ "$RAID_LIFECYCLE_TASK_VALIDATION" != "true" ]; then
  exit 0
fi

raid_read_lifecycle_input

SUBJECT=$(echo "$RAID_HOOK_INPUT" | jq -r '.task_subject // ""')

if [ -z "$SUBJECT" ]; then
  raid_block "Task subject cannot be empty."
fi

if [ "${#SUBJECT}" -lt 10 ]; then
  raid_block "Task subject too short (${#SUBJECT} chars). Be more descriptive (min 10 chars)."
fi

FIRST_WORD=$(echo "$SUBJECT" | awk '{print tolower($1)}')
WORD_COUNT=$(echo "$SUBJECT" | wc -w | tr -d ' ')

if [ "$WORD_COUNT" -le 1 ]; then
  case "$FIRST_WORD" in
    fix|update|task|do|change|add|remove|delete)
      raid_block "Task subject '$SUBJECT' is too generic. Describe what specifically needs to be done."
      ;;
  esac
fi

exit 0
