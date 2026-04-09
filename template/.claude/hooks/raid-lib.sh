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
  _session_json=$(jq -r '{
    phase: (.phase // ""),
    mode: (.mode // ""),
    currentAgent: (.currentAgent // ""),
    implementer: (.implementer // ""),
    task: (.task // "")
  }' ".claude/raid-session" 2>/dev/null)

  _jq_rc=$?
  if [ "$_jq_rc" -eq 0 ] && [ -n "$_session_json" ]; then
    RAID_ACTIVE=true
    RAID_PHASE=$(echo "$_session_json" | jq -r '.phase')
    RAID_MODE=$(echo "$_session_json" | jq -r '.mode')
    RAID_CURRENT_AGENT=$(echo "$_session_json" | jq -r '.currentAgent')
    RAID_IMPLEMENTER=$(echo "$_session_json" | jq -r '.implementer')
    RAID_TASK=$(echo "$_session_json" | jq -r '.task')
  else
    RAID_ACTIVE=false
    # Only warn if file has content (empty file is a transient state during phase transitions)
    if [ -s ".claude/raid-session" ]; then
      echo "raid-lib: warning: .claude/raid-session contains invalid JSON" >&2
    fi
  fi
fi

# --- Config parsing (single jq call, output as JSON object for safe extraction) ---
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
RAID_VAULT_ENABLED=true
RAID_VAULT_PATH=".claude/vault"
RAID_LIFECYCLE_SESSION=true
RAID_LIFECYCLE_NUDGE=true
RAID_LIFECYCLE_TASK_VALIDATION=true
RAID_LIFECYCLE_COMPLETION_GATE=true
RAID_LIFECYCLE_PHASE_CONFIRM=true
RAID_LIFECYCLE_COMPACT_BACKUP=true
RAID_LIFECYCLE_TEST_WINDOW=10

if [ -f ".claude/raid.json" ]; then
  _config_json=$(jq -r '{
    testCmd: (.project.testCommand // ""),
    naming: (.conventions.fileNaming // "none"),
    maxDepth: (.conventions.maxDepth // 8),
    commitMinLength: (.conventions.commitMinLength // 15),
    specsPath: (.paths.specs // "docs/raid/specs"),
    plansPath: (.paths.plans // "docs/raid/plans"),
    browserEnabled: (.browser.enabled // false),
    browserPortStart: (.browser.portRange[0] // ""),
    browserPortEnd: (.browser.portRange[1] // ""),
    execCmd: (.project.execCommand // "npx"),
    pwConfig: (.browser.playwrightConfig // ""),
    vaultEnabled: (if .raid.vault.enabled == null then true else .raid.vault.enabled end),
    vaultPath: (.raid.vault.path // ".claude/vault"),
    lifecycleSession: (if .raid.lifecycle.autoSessionManagement == null then true else .raid.lifecycle.autoSessionManagement end),
    lifecycleNudge: (if .raid.lifecycle.teammateNudge == null then true else .raid.lifecycle.teammateNudge end),
    lifecycleTaskValidation: (if .raid.lifecycle.taskValidation == null then true else .raid.lifecycle.taskValidation end),
    lifecycleCompletionGate: (if .raid.lifecycle.completionGate == null then true else .raid.lifecycle.completionGate end),
    lifecyclePhaseConfirm: (if .raid.lifecycle.phaseTransitionConfirm == null then true else .raid.lifecycle.phaseTransitionConfirm end),
    lifecycleCompactBackup: (if .raid.lifecycle.compactBackup == null then true else .raid.lifecycle.compactBackup end),
    lifecycleTestWindow: (.raid.lifecycle.testWindowMinutes // 10)
  }' ".claude/raid.json" 2>/dev/null)

  if [ $? -eq 0 ] && [ -n "$_config_json" ]; then
    RAID_TEST_CMD=$(echo "$_config_json" | jq -r '.testCmd')
    RAID_NAMING=$(echo "$_config_json" | jq -r '.naming')
    RAID_MAX_DEPTH=$(echo "$_config_json" | jq -r '.maxDepth')
    RAID_COMMIT_MIN_LENGTH=$(echo "$_config_json" | jq -r '.commitMinLength')
    RAID_SPECS_PATH=$(echo "$_config_json" | jq -r '.specsPath')
    RAID_PLANS_PATH=$(echo "$_config_json" | jq -r '.plansPath')
    RAID_BROWSER_ENABLED=$(echo "$_config_json" | jq -r '.browserEnabled')
    RAID_BROWSER_PORT_START=$(echo "$_config_json" | jq -r '.browserPortStart')
    RAID_BROWSER_PORT_END=$(echo "$_config_json" | jq -r '.browserPortEnd')
    RAID_BROWSER_EXEC_CMD=$(echo "$_config_json" | jq -r '.execCmd')
    RAID_BROWSER_PW_CONFIG=$(echo "$_config_json" | jq -r '.pwConfig')
    RAID_VAULT_ENABLED=$(echo "$_config_json" | jq -r '.vaultEnabled')
    RAID_VAULT_PATH=$(echo "$_config_json" | jq -r '.vaultPath')
    RAID_LIFECYCLE_SESSION=$(echo "$_config_json" | jq -r '.lifecycleSession')
    RAID_LIFECYCLE_NUDGE=$(echo "$_config_json" | jq -r '.lifecycleNudge')
    RAID_LIFECYCLE_TASK_VALIDATION=$(echo "$_config_json" | jq -r '.lifecycleTaskValidation')
    RAID_LIFECYCLE_COMPLETION_GATE=$(echo "$_config_json" | jq -r '.lifecycleCompletionGate')
    RAID_LIFECYCLE_PHASE_CONFIRM=$(echo "$_config_json" | jq -r '.lifecyclePhaseConfirm')
    RAID_LIFECYCLE_COMPACT_BACKUP=$(echo "$_config_json" | jq -r '.lifecycleCompactBackup')
    RAID_LIFECYCLE_TEST_WINDOW=$(echo "$_config_json" | jq -r '.lifecycleTestWindow')
  fi
fi

export RAID_ACTIVE RAID_PHASE RAID_MODE RAID_CURRENT_AGENT RAID_IMPLEMENTER RAID_TASK
export RAID_TEST_CMD RAID_NAMING RAID_MAX_DEPTH RAID_COMMIT_MIN_LENGTH RAID_SPECS_PATH RAID_PLANS_PATH
export RAID_BROWSER_ENABLED RAID_BROWSER_PORT_START RAID_BROWSER_PORT_END RAID_BROWSER_EXEC_CMD RAID_BROWSER_PW_CONFIG
export RAID_VAULT_ENABLED RAID_VAULT_PATH
export RAID_LIFECYCLE_SESSION RAID_LIFECYCLE_NUDGE RAID_LIFECYCLE_TASK_VALIDATION
export RAID_LIFECYCLE_COMPLETION_GATE RAID_LIFECYCLE_PHASE_CONFIRM RAID_LIFECYCLE_COMPACT_BACKUP
export RAID_LIFECYCLE_TEST_WINDOW

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
  # Normalize absolute paths to relative (Claude passes absolute paths)
  if [[ "$file" == /* ]]; then
    file="${file#"$PWD"/}"
  fi
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

# Update a field in the raid-session JSON file.
# Usage: raid_session_set <key> <value>
raid_session_set() {
  local key="$1" value="$2"
  if [ ! -f ".claude/raid-session" ]; then
    return 1
  fi
  if ! command -v jq >/dev/null 2>&1; then
    return 1
  fi
  jq --arg k "$key" --arg v "$value" '.[$k] = $v' ".claude/raid-session" > ".claude/raid-session.tmp" 2>/dev/null && \
    mv ".claude/raid-session.tmp" ".claude/raid-session"
}

# Read stdin JSON from Claude lifecycle hook input. Sets RAID_HOOK_INPUT as raw JSON.
raid_read_lifecycle_input() {
  RAID_HOOK_INPUT=$(cat)
  export RAID_HOOK_INPUT
}

# Count Vault entries by counting table rows in index.md
raid_vault_count() {
  local index="$RAID_VAULT_PATH/index.md"
  if [ ! -f "$index" ]; then
    echo 0
    return
  fi
  # Count lines that start with | and contain a date (YYYY-MM-DD), skip header
  grep -cE '^\| [0-9]{4}-' "$index" 2>/dev/null || echo 0
}
