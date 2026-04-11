#!/usr/bin/env bash
# Raid lifecycle hook: SessionEnd
# Archives quest dungeon to Vault and cleans up session artifacts.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

# Only run during active Raid sessions
if [ "$RAID_ACTIVE" != "true" ]; then
  exit 0
fi

if [ "$RAID_LIFECYCLE_SESSION" != "true" ]; then
  exit 0
fi

# Determine quest directory
QUEST_DIR=$(raid_quest_dir)

# Create Vault draft directory
DRAFT_DIR="$RAID_VAULT_PATH/.draft"
mkdir -p "$DRAFT_DIR"

# --- Generate quest.md ---
QUEST_FILE="$DRAFT_DIR/quest.md"
CURRENT_DATE=$(date -u +%Y-%m-%d)
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

cat > "$QUEST_FILE" <<EOF
# Quest — $CURRENT_DATE

**Date:** $CURRENT_DATE
**Mode:** $RAID_MODE
**Quest Type:** $RAID_QUEST_TYPE
**Branch:** $BRANCH

## Quest Summary

[To be enriched by the Wizard before persisting]

## Key Decisions

EOF

# Extract pinned findings from quest dungeon directory
if [ -d "$QUEST_DIR" ]; then
  for phase_file in "$QUEST_DIR"/phases/phase-*.md; do
    [ -f "$phase_file" ] || continue
    { grep -E 'DUNGEON:|BLACKCARD:|UNRESOLVED:|RESOLVED:|TASK:' "$phase_file" 2>/dev/null || true; } | while IFS= read -r line; do
      echo "- $line" >> "$QUEST_FILE"
    done
  done
fi

cat >> "$QUEST_FILE" <<EOF

## Files Changed

EOF

# List changed files from git (best effort)
{ git diff --name-only "$(git rev-list --max-parents=0 HEAD 2>/dev/null || echo HEAD)" HEAD 2>/dev/null || git log --name-only --pretty=format: -5 2>/dev/null || true; } | sort -u | while IFS= read -r f; do
  [ -n "$f" ] && echo "- $f" >> "$QUEST_FILE"
done

cat >> "$QUEST_FILE" <<'EOF'

---
<!-- VAULT:MACHINE -->

```json
{
  "quest": "",
  "date": "",
  "mode": "",
  "questType": "",
  "tags": [],
  "patterns": [],
  "filesChanged": []
}
```
EOF

# --- Copy quest dungeon to vault draft ---
if [ -d "$QUEST_DIR" ]; then
  cp -r "$QUEST_DIR" "$DRAFT_DIR/dungeon/"
fi

# --- Copy specs and plans ---
if [ -d "$RAID_SPECS_PATH" ]; then
  SPEC_FILE=$({ ls -t "$RAID_SPECS_PATH"/*.md 2>/dev/null || true; } | head -1)
  if [ -n "$SPEC_FILE" ]; then
    cp "$SPEC_FILE" "$DRAFT_DIR/spec.md"
  fi
fi

if [ -d "$RAID_PLANS_PATH" ]; then
  PLAN_FILE=$({ ls -t "$RAID_PLANS_PATH"/*.md 2>/dev/null || true; } | head -1)
  if [ -n "$PLAN_FILE" ]; then
    cp "$PLAN_FILE" "$DRAFT_DIR/plan.md"
  fi
fi

# --- Cleanup session artifacts ---
rm -f .claude/raid-session
rm -rf "$QUEST_DIR"
rm -f .claude/raid-last-test-run

# Backward compat: clean up old flat dungeon files if they exist
rm -f .claude/raid-dungeon.md
rm -f .claude/raid-dungeon-phase-*.md
rm -f .claude/raid-dungeon-backup.md
rm -f .claude/raid-dungeon-phase-*-backup.md

# --- Output additionalContext ---
cat <<ENDJSON
{
  "hookSpecificOutput": {
    "hookEventName": "SessionEnd",
    "additionalContext": "A quest record has been drafted at $DRAFT_DIR/. Ask the human: persist this quest to the Vault, or forget it? If persisted, review and enrich quest.md (fill in the summary, tags, and machine data) before finalizing. To persist: rename .draft/ to a descriptive directory name and add an entry to $RAID_VAULT_PATH/index.md. To forget: delete .draft/ and any remaining specs/plans in docs/raid/."
  }
}
ENDJSON

exit 0
