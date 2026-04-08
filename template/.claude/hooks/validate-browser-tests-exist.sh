#!/usr/bin/env bash
# Raid quality gate: warns if browser-facing code is committed without Playwright tests
# PreToolUse hook for Bash commands containing 'git commit'
# Checks for test files in the Playwright test directory
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/raid-lib.sh"

raid_read_input

# Only check git commit commands
if ! echo "$RAID_COMMAND" | grep -qE 'git commit'; then
  exit 0
fi

# Skip if no active Raid session or browser testing not enabled
if [ "$RAID_ACTIVE" != "true" ] || [ "$RAID_BROWSER_ENABLED" != "true" ]; then
  exit 0
fi

# Get staged files that are browser-facing code
BROWSER_FILES=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null | \
  grep -E '\.(tsx|jsx|vue|svelte)$' | \
  grep -E '^(src|app|pages|components)/' || true)

if [ -z "$BROWSER_FILES" ]; then
  exit 0
fi

# Check if any Playwright test files exist
HAS_BROWSER_TESTS=false
for DIR in tests/e2e e2e test/e2e; do
  if [ -d "$DIR" ]; then
    SPEC_COUNT=$(find "$DIR" -name '*.spec.ts' -o -name '*.spec.js' 2>/dev/null | wc -l | tr -d ' ')
    if [ "$SPEC_COUNT" -gt "0" ]; then
      HAS_BROWSER_TESTS=true
      break
    fi
  fi
done

if [ "$HAS_BROWSER_TESTS" = false ]; then
  MSG="Raid Quality Check:\nWARNING: Browser-facing code modified but no Playwright tests found.\nChanged files:\n"
  while IFS= read -r FILE; do
    MSG="${MSG}  - ${FILE}\n"
  done <<< "$BROWSER_FILES"
  MSG="${MSG}\nIf this component doesn't need browser testing, this is safe to ignore."
  raid_warn "$MSG"
fi

exit 0
