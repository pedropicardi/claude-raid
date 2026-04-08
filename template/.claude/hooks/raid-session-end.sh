#!/usr/bin/env bash
# Raid lifecycle hook: SessionEnd
# Drafts a Vault entry from session artifacts and prompts persist/forget.
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

# Create Vault draft directory
DRAFT_DIR="$RAID_VAULT_PATH/.draft"
mkdir -p "$DRAFT_DIR/dungeon-phases"

# --- Generate quest.md ---
QUEST_FILE="$DRAFT_DIR/quest.md"
CURRENT_DATE=$(date -u +%Y-%m-%d)
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

cat > "$QUEST_FILE" <<EOF
# Quest — $CURRENT_DATE

**Date:** $CURRENT_DATE
**Mode:** $RAID_MODE
**Branch:** $BRANCH

## Quest Summary

[To be enriched by the Wizard before persisting]

## Key Decisions

EOF

# Extract pinned findings from Dungeon
if [ -f ".claude/raid-dungeon.md" ]; then
  { grep -E 'DUNGEON:|FINDING:|DECISION:' ".claude/raid-dungeon.md" 2>/dev/null || true; } | while IFS= read -r line; do
    echo "- $line" >> "$QUEST_FILE"
  done
fi

cat >> "$QUEST_FILE" <<EOF

## Files Changed

EOF

# List changed files from git (best effort)
{ git diff --name-only HEAD~5 HEAD 2>/dev/null || true; } | while IFS= read -r f; do
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
  "tags": [],
  "patterns": [],
  "filesChanged": []
}
```
EOF

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

# --- Copy Dungeon phase archives ---
for phase_file in .claude/raid-dungeon-phase-*.md; do
  [ -f "$phase_file" ] || continue
  cp "$phase_file" "$DRAFT_DIR/dungeon-phases/"
done

# --- Cleanup session artifacts ---
rm -f .claude/raid-session
rm -f .claude/raid-dungeon.md
rm -f .claude/raid-dungeon-phase-*.md
rm -f .claude/raid-dungeon-backup.md
rm -f .claude/raid-dungeon-phase-*-backup.md
rm -f .claude/raid-last-test-run

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
