#!/usr/bin/env bash
# Raid write gate: phase-aware controller for Write operations
# PreToolUse hook — blocks or allows writes based on current Raid phase, mode, and agent role.
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$HOOK_DIR/raid-lib.sh"

raid_read_input

# No file path — nothing to gate
if [ -z "${RAID_FILE_PATH:-}" ]; then
  exit 0
fi

# No active session — allow everything
if [ "$RAID_ACTIVE" = "false" ]; then
  exit 0
fi

# Protect enforcement-critical files from direct agent writes.
# Hooks and Wizard use Bash-level operations (jq redirect, rm) for these files,
# so blocking Write/Edit doesn't break legitimate callers.
_protected_file="${RAID_FILE_PATH}"
# Normalize: resolve .., //, symlinks on PWD, then strip prefix (prevents traversal bypasses)
if [[ "$_protected_file" != /* ]]; then
  _protected_file="$PWD/$_protected_file"
fi
_protected_file=$(echo "$_protected_file" | sed 's|//\{1,\}|/|g' | while read -r _p; do
  while echo "$_p" | grep -q '/[^/][^/]*/\.\./'; do
    _p=$(echo "$_p" | sed 's|/[^/][^/]*/\.\./|/|')
  done
  echo "$_p"
done)
# Strip PWD prefix — try both logical and physical PWD (macOS: /var → /private/var)
_physical_pwd=$(cd "$PWD" && pwd -P)
_protected_file="${_protected_file#"$PWD"/}"
_protected_file="${_protected_file#"$_physical_pwd"/}"
# Also resolve /private prefix mismatch: input may use /var but shell resolves to /private/var
if [[ "$_protected_file" == /* ]] && [[ -n "$_physical_pwd" ]]; then
  _logical_pwd="${_physical_pwd#/private}"
  _protected_file="${_protected_file#"$_logical_pwd"/}"
fi
case "$_protected_file" in
  .claude/raid-session|.claude/raid-last-test-run)
    raid_block "File '${_protected_file}' is protected. It is managed by hooks and the Wizard."
    ;;
esac

# Non-production files (docs, tests, config, .claude) are always allowed
if ! raid_is_production_file "$RAID_FILE_PATH"; then
  exit 0
fi

# --- Phase-based enforcement on production files ---

case "${RAID_PHASE:-}" in
  design)
    raid_block "Read-only phase (design). No implementation code allowed."
    ;;
  plan)
    raid_block "Read-only phase (plan). No implementation code allowed."
    ;;
  implementation)
    # Scout mode: skip implementer check
    if [ "$RAID_MODE" = "scout" ]; then
      exit 0
    fi
    # Only the designated implementer may write production code
    if [ "$RAID_CURRENT_AGENT" != "$RAID_IMPLEMENTER" ]; then
      raid_block "Only ${RAID_IMPLEMENTER} writes production code this task."
    fi
    exit 0
    ;;
  review)
    raid_block "Read-only phase (review). File fixes go through implementation."
    ;;
  finishing)
    raid_block "Finishing phase. No new code."
    ;;
  "")
    # Empty phase during session bootstrap — allow with warning
    raid_warn "Session active but phase is empty — allowing writes during bootstrap."
    ;;
  *)
    # Unknown phase — fail closed
    raid_block "Unknown phase '${RAID_PHASE}'. Cannot determine write permissions."
    ;;
esac
