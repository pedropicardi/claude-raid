'use strict';

const fs = require('fs');
const path = require('path');
const { mergeSettings } = require('./merge-settings');
const { detectProject } = require('./detect-project');
const { banner, header, colors } = require('./ui');

const TEMPLATE_DIR = path.join(__dirname, '..', 'template', '.claude');

function filesAreEqual(pathA, pathB) {
  try {
    return fs.readFileSync(pathA, 'utf8') === fs.readFileSync(pathB, 'utf8');
  } catch {
    return false;
  }
}

function copyForceRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyForceRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function performUpdate(cwd) {
  const claudeDir = path.join(cwd, '.claude');
  const skippedAgents = [];

  // Accept either new or legacy rules file as proof of installation
  if (!fs.existsSync(path.join(claudeDir, 'party-rules.md')) && !fs.existsSync(path.join(claudeDir, 'raid-rules.md'))) {
    return { success: false, message: 'No party found. Run `claude-raid summon` first.', skippedAgents };
  }

  // Update agents — skip if user has customized them
  const agentsSrc = path.join(TEMPLATE_DIR, 'agents');
  const agentsDest = path.join(claudeDir, 'agents');
  if (fs.existsSync(agentsSrc)) {
    fs.mkdirSync(agentsDest, { recursive: true });
    const agents = fs.readdirSync(agentsSrc).filter(f => f.endsWith('.md'));
    for (const agent of agents) {
      const srcPath = path.join(agentsSrc, agent);
      const destPath = path.join(agentsDest, agent);
      if (fs.existsSync(destPath) && !filesAreEqual(srcPath, destPath)) {
        skippedAgents.push(agent);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // Update hooks and skills — always overwrite (these are framework code, not user content)
  for (const subdir of ['hooks', 'skills']) {
    const src = path.join(TEMPLATE_DIR, subdir);
    const dest = path.join(claudeDir, subdir);
    if (fs.existsSync(src)) {
      fs.mkdirSync(dest, { recursive: true });
      copyForceRecursive(src, dest);
    }
  }

  // Migrate legacy raid-rules.md -> party-rules.md
  const legacyRules = path.join(claudeDir, 'raid-rules.md');
  const partyRulesDest = path.join(claudeDir, 'party-rules.md');
  if (fs.existsSync(legacyRules) && !fs.existsSync(partyRulesDest)) {
    fs.renameSync(legacyRules, partyRulesDest);
  }
  // Clean up legacy file if both exist
  if (fs.existsSync(legacyRules) && fs.existsSync(partyRulesDest)) {
    try { fs.unlinkSync(legacyRules); } catch {}
  }

  // Update rules files — skip if user has customized them
  const rulesFiles = ['party-rules.md', 'dungeon-master-rules.md'];
  const skippedRulesFiles = [];
  for (const rulesFile of rulesFiles) {
    const rulesSrc = path.join(TEMPLATE_DIR, rulesFile);
    const rulesDest = path.join(claudeDir, rulesFile);
    if (fs.existsSync(rulesSrc)) {
      if (fs.existsSync(rulesDest) && !filesAreEqual(rulesSrc, rulesDest)) {
        skippedRulesFiles.push(rulesFile);
      } else {
        fs.copyFileSync(rulesSrc, rulesDest);
      }
    }
  }

  const hooksDir = path.join(claudeDir, 'hooks');
  if (fs.existsSync(hooksDir)) {
    const hooks = fs.readdirSync(hooksDir).filter(f => f.endsWith('.sh'));
    for (const hook of hooks) {
      fs.chmodSync(path.join(hooksDir, hook), 0o755);
    }
  }

  // Migrate existing raid.json — add missing browser/packageManager fields
  const raidConfigPath = path.join(claudeDir, 'raid.json');
  const migratedFields = [];
  if (fs.existsSync(raidConfigPath)) {
    let config;
    try {
      config = JSON.parse(fs.readFileSync(raidConfigPath, 'utf8'));
    } catch {
      config = null;
    }
    if (config !== null) {
      const detected = detectProject(cwd);
      // Add packageManager fields if missing
      if (detected.packageManager && config.project && !config.project.packageManager) {
        config.project.packageManager = detected.packageManager;
        if (detected.runCommand) config.project.runCommand = detected.runCommand;
        if (detected.execCommand) config.project.execCommand = detected.execCommand;
        if (detected.installCommand) config.project.installCommand = detected.installCommand;
        migratedFields.push('packageManager');
      }
      // Add browser section if detected and missing
      if (detected.browser && !config.browser) {
        config.browser = {
          enabled: true,
          framework: detected.browser.framework,
          devCommand: detected.browser.devCommand,
          baseUrl: `http://localhost:${detected.browser.defaultPort}`,
          defaultPort: detected.browser.defaultPort,
          portRange: [detected.browser.defaultPort + 1, detected.browser.defaultPort + 5],
          playwrightConfig: 'playwright.config.ts',
          auth: null,
          startup: null,
        };
        migratedFields.push('browser');
      }
      if (migratedFields.length > 0) {
        fs.writeFileSync(raidConfigPath, JSON.stringify(config, null, 2) + '\n');
      }
    }
  }

  mergeSettings(cwd);

  let message = 'The Raid has been updated to the latest version.';
  if (migratedFields.length > 0) {
    message += `\nMigrated raid.json: added ${migratedFields.join(', ')}`;
  }
  if (skippedAgents.length > 0) {
    message += `\nSkipped customized agents: ${skippedAgents.join(', ')}`;
  }
  if (skippedRulesFiles.length > 0) {
    message += '\nSkipped customized ' + skippedRulesFiles.join(', ');
  }
  if (skippedAgents.length > 0 || skippedRulesFiles.length > 0) {
    message += '\nUse `claude-raid dismantle` then `claude-raid summon` to reset.';
  }

  return { success: true, message, skippedAgents, migratedFields };
}

function run() {
  const cwd = process.cwd();
  console.log('\n' + banner());
  console.log(header('Reforging the Arsenal...') + '\n');

  const result = performUpdate(cwd);

  if (!result.success) {
    console.log('  ' + colors.red('✖') + ' No party found. Run ' + colors.bold('claude-raid summon') + ' first.');
    return;
  }

  console.log('  ' + colors.green('✔') + ' The party\'s arsenal has been reforged.');
  if (result.skippedAgents.length > 0) {
    console.log('  ' + colors.dim('Preserved customized warriors: ' + result.skippedAgents.join(', ')));
  }
}

module.exports = { performUpdate, run };
