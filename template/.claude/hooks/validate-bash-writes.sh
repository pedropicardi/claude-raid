#!/usr/bin/env bash
# Raid Bash write-gate: intercepts file-writing Bash commands
# PreToolUse hook for Bash operations — defense-in-depth layer.
# Detects: redirects (> >>), tee, sed -i, cp, mv, curl -o,
# and scripting language writes (python3/node/ruby/perl).
# Protects .claude/raid-session and .claude/raid-last-test-run from all Bash writes.
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$HOOK_DIR/raid-lib.sh"

raid_read_input

# No command — nothing to gate
if [ -z "${RAID_COMMAND:-}" ]; then
  exit 0
fi

# No active session — allow everything
if [ "$RAID_ACTIVE" = "false" ]; then
  exit 0
fi

# --- Extract target file paths from known write patterns ---

# Collects candidate target paths from the command string.
# This is regex heuristics on a Bash command — it catches the 90% case,
# not arbitrary scripting. Defense in depth, not a security boundary.
_targets=()

_cmd="$RAID_COMMAND"

# Pattern 1: Redirects — command > file, command >> file
# Matches: > path, >> path (with optional whitespace)
while IFS= read -r _match; do
  [ -n "$_match" ] && _targets+=("$_match")
done < <(echo "$_cmd" | grep -oE '>{1,2}\s*[^ |;&)]+' | sed 's/^>*[[:space:]]*//')

# Pattern 2: tee [-a] file [file...]
while IFS= read -r _match; do
  [ -n "$_match" ] && _targets+=("$_match")
done < <(echo "$_cmd" | grep -oE 'tee\s+(-a\s+)?[^ |;&)]+' | sed 's/^tee\s\+\(-a\s\+\)\?//' | sed 's/^tee[[:space:]]*\(-a[[:space:]]*\)\{0,1\}//')

# Pattern 3: sed -i[suffix] 's/.../.../g' file
while IFS= read -r _match; do
  [ -n "$_match" ] && _targets+=("$_match")
done < <(echo "$_cmd" | grep -oE "sed\s+-i[^ ]*\s+'[^']*'\s+[^ |;&)]+" | rev | cut -d' ' -f1 | rev)

# Pattern 4: cp source target (last arg is target)
while IFS= read -r _match; do
  [ -n "$_match" ] && _targets+=("$_match")
done < <(echo "$_cmd" | grep -oE 'cp\s+(-[a-zA-Z]+\s+)*[^ |;&)]+\s+[^ |;&)]+' | rev | cut -d' ' -f1 | rev)

# Pattern 5: mv source target (last arg is target)
while IFS= read -r _match; do
  [ -n "$_match" ] && _targets+=("$_match")
done < <(echo "$_cmd" | grep -oE 'mv\s+(-[a-zA-Z]+\s+)*[^ |;&)]+\s+[^ |;&)]+' | rev | cut -d' ' -f1 | rev)

# Pattern 6: curl -o file / curl --output file
while IFS= read -r _match; do
  [ -n "$_match" ] && _targets+=("$_match")
done < <(echo "$_cmd" | grep -oE 'curl\s+.*-o\s+[^ |;&)]+' | grep -oE '\-o\s+[^ |;&)]+' | sed 's/^-o[[:space:]]*//')

# Pattern 7: Scripting language inline writes — extract quoted paths
# python3 -c "open('path', 'w')..."
while IFS= read -r _match; do
  [ -n "$_match" ] && _targets+=("$_match")
done < <(echo "$_cmd" | grep -oE "python3?\s+-c\s+['\"].*['\"]" | grep -oE "open\(['\"][^'\"]+['\"]" | sed "s/^open(['\"]//;s/['\"]$//")

# node -e "fs.writeFileSync('path', ...)"
while IFS= read -r _match; do
  [ -n "$_match" ] && _targets+=("$_match")
done < <(echo "$_cmd" | grep -oE "node\s+-e\s+['\"].*['\"]" | grep -oE "writeFileSync\(['\"][^'\"]+['\"]" | sed "s/^writeFileSync(['\"]//;s/['\"]$//")

# ruby -e "File.write('path', ...)"
while IFS= read -r _match; do
  [ -n "$_match" ] && _targets+=("$_match")
done < <(echo "$_cmd" | grep -oE "ruby\s+-e\s+['\"].*['\"]" | grep -oE "File\.write\(['\"][^'\"]+['\"]" | sed "s/^File\.write(['\"]//;s/['\"]$//")

# perl -e 'open(F,">path")...'
while IFS= read -r _match; do
  [ -n "$_match" ] && _targets+=("$_match")
done < <(echo "$_cmd" | grep -oE "perl\s+-e\s+['\"].*['\"]" | grep -oE '>[^"'\'']+['\''"]' | sed "s/^>//;s/['\"]$//")

# No write targets detected — allow
if [ ${#_targets[@]} -eq 0 ]; then
  exit 0
fi

# --- Check each target ---

for _target in "${_targets[@]}"; do
  # Normalize path: resolve .., //, and strip absolute prefix
  _norm="$_target"
  # Convert to absolute for uniform handling
  if [[ "$_norm" != /* ]]; then
    _norm="$PWD/$_norm"
  fi
  # Collapse // and resolve /dir/../ components (portable — no GNU sed labels)
  _norm=$(echo "$_norm" | sed 's|//\{1,\}|/|g' | while read -r _p; do
    # Iteratively resolve ../ until none remain
    while echo "$_p" | grep -q '/[^/][^/]*/\.\./'; do
      _p=$(echo "$_p" | sed 's|/[^/][^/]*/\.\./|/|')
    done
    echo "$_p"
  done)
  # Strip PWD prefix to get relative path
  _norm="${_norm#"$PWD"/}"

  # Check 1: Protected files — always blocked during active session
  case "$_norm" in
    .claude/raid-session|.claude/raid-last-test-run)
      raid_block "File '${_norm}' is protected. It is managed by hooks and the Wizard."
      ;;
  esac

  # Check 2: Non-production files — always allowed
  if ! raid_is_production_file "$_norm"; then
    continue
  fi

  # Check 3: Phase-based enforcement on production files
  case "${RAID_PHASE:-}" in
    design)
      raid_block "Bash write to production file '${_norm}' blocked. Read-only phase (design)."
      ;;
    plan)
      raid_block "Bash write to production file '${_norm}' blocked. Read-only phase (plan)."
      ;;
    implementation)
      # Scout mode: skip implementer check
      if [ "$RAID_MODE" = "scout" ]; then
        continue
      fi
      # Only the designated implementer may write production code via Bash
      if [ -n "$RAID_IMPLEMENTER" ] && [ "$RAID_CURRENT_AGENT" != "$RAID_IMPLEMENTER" ]; then
        raid_block "Bash write to production file '${_norm}' blocked. Only ${RAID_IMPLEMENTER} writes production code this task."
      fi
      continue
      ;;
    review)
      raid_block "Bash write to production file '${_norm}' blocked. Read-only phase (review)."
      ;;
    finishing)
      raid_block "Bash write to production file '${_norm}' blocked. Finishing phase."
      ;;
    "")
      # Bootstrap — allow with warning (consistent with write-gate)
      raid_warn "Session active but phase is empty — allowing Bash writes during bootstrap."
      ;;
    *)
      raid_block "Bash write to production file '${_norm}' blocked. Unknown phase '${RAID_PHASE}'."
      ;;
  esac
done

exit 0
