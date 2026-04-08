#!/usr/bin/env bash
# Raid lifecycle hook: PreCompact
# Backs up Dungeon state before context compaction.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

if [ "$RAID_ACTIVE" != "true" ]; then
  exit 0
fi

if [ "$RAID_LIFECYCLE_COMPACT_BACKUP" != "true" ]; then
  exit 0
fi

BACKED_UP=false

if [ -f ".claude/raid-dungeon.md" ]; then
  cp ".claude/raid-dungeon.md" ".claude/raid-dungeon-backup.md"
  BACKED_UP=true
fi

for phase_file in .claude/raid-dungeon-phase-*.md; do
  [ -f "$phase_file" ] || continue
  cp "$phase_file" "${phase_file%.md}-backup.md"
  BACKED_UP=true
done

if [ "$BACKED_UP" = "true" ]; then
  cat <<ENDJSON
{
  "hookSpecificOutput": {
    "hookEventName": "PreCompact",
    "additionalContext": "Dungeon state backed up before compaction. If critical findings were lost, check raid-dungeon-backup.md and raid-dungeon-phase-*-backup.md."
  }
}
ENDJSON
fi

exit 0
