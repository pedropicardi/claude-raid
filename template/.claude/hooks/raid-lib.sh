#!/usr/bin/env bash
# raid-lib.sh — Shared library sourced by all Raid hooks
# Parses session state and config, exports RAID_* variables and utility functions.
# Performance: max 2 jq calls (session + config).

# --- Session parsing ---
RAID_ACTIVE=false
RAID_PHASE=""
RAID_MODE=""
RAID_CURRENT_AGENT=""
RAID_IMPLEMENTER=""
RAID_TASK=""

if [ -f ".claude/raid-session" ]; then
  _session_json=$(jq -r '
    .phase // "",
    .mode // "",
    .currentAgent // "",
    .implementer // "",
    .task // ""
  ' ".claude/raid-session" 2>/dev/null)

  _jq_rc=$?
  if [ "$_jq_rc" -eq 0 ] && [ -n "$_session_json" ]; then
    RAID_ACTIVE=true
    RAID_PHASE=$(echo "$_session_json" | sed -n '1p')
    RAID_MODE=$(echo "$_session_json" | sed -n '2p')
    RAID_CURRENT_AGENT=$(echo "$_session_json" | sed -n '3p')
    RAID_IMPLEMENTER=$(echo "$_session_json" | sed -n '4p')
    RAID_TASK=$(echo "$_session_json" | sed -n '5p')
  else
    RAID_ACTIVE=false
    # Only warn if file has content (empty file is a transient state during phase transitions)
    if [ -s ".claude/raid-session" ]; then
      echo "raid-lib: warning: .claude/raid-session contains invalid JSON" >&2
    fi
  fi
fi

# --- Config parsing (single jq call for all config + browser fields) ---
RAID_TEST_CMD=""
RAID_NAMING="none"
RAID_MAX_DEPTH=8
RAID_COMMIT_MIN_LENGTH=15
RAID_SPECS_PATH="docs/raid/specs"
RAID_PLANS_PATH="docs/raid/plans"
RAID_BROWSER_ENABLED=false
RAID_BROWSER_PORT_START=""
RAID_BROWSER_PORT_END=""
RAID_BROWSER_EXEC_CMD=""
RAID_BROWSER_PW_CONFIG=""

if [ -f ".claude/raid.json" ]; then
  _config_json=$(jq -r '
    (.project.testCommand // ""),
    (.conventions.fileNaming // "none"),
    (.conventions.maxDepth // 8),
    (.conventions.commitMinLength // 15),
    (.paths.specs // "docs/raid/specs"),
    (.paths.plans // "docs/raid/plans"),
    (.browser.enabled // false),
    (.browser.portRange[0] // ""),
    (.browser.portRange[1] // ""),
    (.project.execCommand // "npx"),
    (.browser.playwrightConfig // "")
  ' ".claude/raid.json" 2>/dev/null)

  if [ $? -eq 0 ] && [ -n "$_config_json" ]; then
    RAID_TEST_CMD=$(echo "$_config_json" | sed -n '1p')
    RAID_NAMING=$(echo "$_config_json" | sed -n '2p')
    RAID_MAX_DEPTH=$(echo "$_config_json" | sed -n '3p')
    RAID_COMMIT_MIN_LENGTH=$(echo "$_config_json" | sed -n '4p')
    RAID_SPECS_PATH=$(echo "$_config_json" | sed -n '5p')
    RAID_PLANS_PATH=$(echo "$_config_json" | sed -n '6p')
    RAID_BROWSER_ENABLED=$(echo "$_config_json" | sed -n '7p')
    RAID_BROWSER_PORT_START=$(echo "$_config_json" | sed -n '8p')
    RAID_BROWSER_PORT_END=$(echo "$_config_json" | sed -n '9p')
    RAID_BROWSER_EXEC_CMD=$(echo "$_config_json" | sed -n '10p')
    RAID_BROWSER_PW_CONFIG=$(echo "$_config_json" | sed -n '11p')
  fi
fi

export RAID_ACTIVE RAID_PHASE RAID_MODE RAID_CURRENT_AGENT RAID_IMPLEMENTER RAID_TASK
export RAID_TEST_CMD RAID_NAMING RAID_MAX_DEPTH RAID_COMMIT_MIN_LENGTH RAID_SPECS_PATH RAID_PLANS_PATH
export RAID_BROWSER_ENABLED RAID_BROWSER_PORT_START RAID_BROWSER_PORT_END RAID_BROWSER_EXEC_CMD RAID_BROWSER_PW_CONFIG

# --- Utility functions ---

# Read stdin JSON from Claude hook input. Sets RAID_FILE_PATH and RAID_COMMAND.
raid_read_input() {
  local _input
  _input=$(cat)
  RAID_FILE_PATH=$(echo "$_input" | jq -r '.tool_input.file_path // .tool_input.path // empty')
  RAID_COMMAND=$(echo "$_input" | jq -r '.tool_input.command // empty')
  export RAID_FILE_PATH RAID_COMMAND
}

# Returns 0 if file is production code (not test, doc, config, or .claude).
raid_is_production_file() {
  local file="$1"
  case "$file" in
    tests/*|test/*|*.test.*|*.spec.*|*_test.*|*_spec.*) return 1 ;;
    docs/*|*.md) return 1 ;;
    .claude/*|*.json|*.yml|*.yaml|*.toml|*.lock) return 1 ;;
    *.config.*|*.rc|.gitignore|Makefile|Dockerfile) return 1 ;;
  esac
  return 0
}

# Print message to stderr and exit 2 (block the action).
raid_block() {
  printf "%s\n" "$*" >&2
  exit 2
}

# Print message to stderr and exit 0 (warn but allow).
raid_warn() {
  printf "%s\n" "$*" >&2
  exit 0
}
