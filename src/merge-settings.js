'use strict';

const fs = require('fs');
const path = require('path');

const RAID_ENV = {
  CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
};

const RAID_PERMISSIONS = ['Read', 'Glob', 'Grep', 'Bash', 'Write', 'Edit'];

const RAID_HOOK_MARKER = '#claude-raid';

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
  ],
  PreToolUse: [
    {
      matcher: 'Bash',
      hooks: [
        { type: 'command', command: `bash .claude/hooks/validate-commit.sh ${RAID_HOOK_MARKER}` },
      ],
    },
    {
      matcher: 'Write',
      hooks: [
        { type: 'command', command: `bash .claude/hooks/validate-write-gate.sh ${RAID_HOOK_MARKER}` },
      ],
    },
  ],
};

function isRaidHookEntry(entry) {
  return entry.hooks && entry.hooks.some(h => h.command && h.command.includes(RAID_HOOK_MARKER));
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
    if (!existing.hooks[event]) {
      existing.hooks[event] = [];
    }
    existing.hooks[event] = existing.hooks[event].filter(entry => !isRaidHookEntry(entry));
    existing.hooks[event].push(...raidEntries);
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
      'Your .claude/settings.json contains invalid JSON. Please fix it before running claude-raid remove.'
    );
  }

  if (settings.env) {
    delete settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  }

  if (settings.hooks) {
    for (const event of Object.keys(settings.hooks)) {
      settings.hooks[event] = settings.hooks[event].filter(entry => !isRaidHookEntry(entry));
      if (settings.hooks[event].length === 0) delete settings.hooks[event];
    }
    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

module.exports = { mergeSettings, removeRaidSettings };
