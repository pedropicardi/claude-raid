'use strict';

const fs = require('fs');
const path = require('path');

const RAID_ENV = {
  CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
};

const RAID_PERMISSIONS = ['Read', 'Glob', 'Grep', 'Bash', 'Write', 'Edit'];

const RAID_HOOK_MARKER = '#claude-raid';

const RTK_HOOK_MARKER = '#claude-raid-rtk';

const RTK_HOOKS = {
  PreToolUse: [
    {
      matcher: 'Bash',
      hooks: [
        { type: 'command', command: `bash .claude/hooks/rtk-bridge.sh ${RTK_HOOK_MARKER}` },
      ],
    },
  ],
};

const RAID_HOOKS = {
  PostToolUse: [
    {
      matcher: 'Write|Edit',
      hooks: [
        { type: 'command', command: `bash .claude/hooks/validate-file-naming.sh ${RAID_HOOK_MARKER}` },
        { type: 'command', command: `bash .claude/hooks/validate-no-placeholders.sh ${RAID_HOOK_MARKER}` },
        { type: 'command', command: `bash .claude/hooks/validate-dungeon.sh ${RAID_HOOK_MARKER}` },
      ],
    },
    {
      matcher: 'Bash',
      hooks: [
        { type: 'command', command: `bash .claude/hooks/validate-browser-cleanup.sh ${RAID_HOOK_MARKER}` },
      ],
    },
  ],
  PreToolUse: [
    {
      matcher: 'Bash',
      hooks: [
        { type: 'command', command: `bash .claude/hooks/validate-commit.sh ${RAID_HOOK_MARKER}` },
        { type: 'command', command: `bash .claude/hooks/validate-browser-tests-exist.sh ${RAID_HOOK_MARKER}` },
      ],
    },
    {
      matcher: 'Write|Edit',
      hooks: [
        { type: 'command', command: `bash .claude/hooks/validate-write-gate.sh ${RAID_HOOK_MARKER}` },
      ],
    },
  ],
  SessionStart: [
    {
      hooks: [
        { type: 'command', command: `bash .claude/hooks/raid-session-start.sh ${RAID_HOOK_MARKER}` },
      ],
    },
  ],
  SessionEnd: [
    {
      matcher: 'prompt_input_exit|clear',
      hooks: [
        { type: 'command', command: `bash .claude/hooks/raid-session-end.sh ${RAID_HOOK_MARKER}` },
      ],
    },
  ],
TaskCreated: [
    {
      hooks: [
        { type: 'command', command: `bash .claude/hooks/raid-task-created.sh ${RAID_HOOK_MARKER}` },
      ],
    },
  ],
  PreCompact: [
    {
      hooks: [
        { type: 'command', command: `bash .claude/hooks/raid-pre-compact.sh ${RAID_HOOK_MARKER}` },
      ],
    },
  ],
};

function isRaidHookEntry(entry) {
  return entry.hooks && entry.hooks.some(h => h.command && h.command.includes(RAID_HOOK_MARKER));
}

function isRtkHookEntry(entry) {
  return entry.hooks && entry.hooks.some(h => h.command && h.command.includes(RTK_HOOK_MARKER));
}

function mergeSettings(cwd) {
  const settingsPath = path.join(cwd, '.claude', 'settings.json');
  let existing = {};

  if (fs.existsSync(settingsPath)) {
    const backupPath = settingsPath + '.pre-raid-backup';
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(settingsPath, backupPath);
    }
    try {
      existing = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      throw new Error(
        'Your existing .claude/settings.json contains invalid JSON. Please fix it before running claude-raid.'
      );
    }
  }

  existing.env = { ...(existing.env || {}), ...RAID_ENV };

  const existingPerms = (existing.permissions && existing.permissions.allow) || [];
  const merged = [...new Set([...existingPerms, ...RAID_PERMISSIONS])];
  existing.permissions = { ...(existing.permissions || {}), allow: merged };

  if (!existing.hooks) existing.hooks = {};

  for (const [event, raidEntries] of Object.entries(RAID_HOOKS)) {
    if (!Array.isArray(existing.hooks[event])) {
      existing.hooks[event] = [];
    }
    existing.hooks[event] = existing.hooks[event].filter(entry => !isRaidHookEntry(entry));
    existing.hooks[event].push(...raidEntries);
  }

  // RTK hooks — read raid.json to check if enabled
  const raidJsonPath = path.join(cwd, '.claude', 'raid.json');
  let rtkEnabled = false;
  try {
    const raidConfig = JSON.parse(fs.readFileSync(raidJsonPath, 'utf8'));
    rtkEnabled = raidConfig.rtk && raidConfig.rtk.enabled === true;
  } catch {
    // No raid.json or invalid — RTK stays disabled
  }

  // Strip existing RTK hooks first (clean slate for toggle behavior)
  for (const event of Object.keys(existing.hooks)) {
    existing.hooks[event] = existing.hooks[event].filter(entry => !isRtkHookEntry(entry));
  }

  // Append RTK hooks if enabled (after core hooks, ensuring last position)
  if (rtkEnabled) {
    for (const [event, rtkEntries] of Object.entries(RTK_HOOKS)) {
      if (!Array.isArray(existing.hooks[event])) {
        existing.hooks[event] = [];
      }
      existing.hooks[event].push(...rtkEntries);
    }
  }

  fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + '\n');
}

function removeRaidSettings(cwd) {
  const settingsPath = path.join(cwd, '.claude', 'settings.json');
  const backupPath = settingsPath + '.pre-raid-backup';

  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, settingsPath);
    fs.unlinkSync(backupPath);
    return;
  }

  if (!fs.existsSync(settingsPath)) return;

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    throw new Error(
      'Your .claude/settings.json contains invalid JSON. Please fix it before running claude-raid dismantle.'
    );
  }

  if (settings.env) {
    delete settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  }

  if (settings.hooks) {
    for (const event of Object.keys(settings.hooks)) {
      settings.hooks[event] = settings.hooks[event].filter(entry => !isRaidHookEntry(entry) && !isRtkHookEntry(entry));
      if (settings.hooks[event].length === 0) delete settings.hooks[event];
    }
    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

module.exports = { mergeSettings, removeRaidSettings };
