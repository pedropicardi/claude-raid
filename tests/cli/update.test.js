'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let update, init;
let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-update-'));
  return tmpDir;
}

describe('update', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });
  it('fails if Raid is not installed', () => {
    update = require('../../src/update');
    const cwd = makeTempDir();
    const result = update.performUpdate(cwd);
    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('No party found'));
  });

  it('updates unmodified template files', () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    init.install(cwd);
    const result = update.performUpdate(cwd);
    assert.strictEqual(result.success, true);
    const content = fs.readFileSync(path.join(cwd, '.claude', 'party-rules.md'), 'utf8');
    assert.ok(content.includes('Party Rules'));
  });

  it('does not remove existing custom fields from raid.json', () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    init.install(cwd);
    const configPath = path.join(cwd, '.claude', 'raid.json');
    fs.writeFileSync(configPath, '{"custom": true}');
    update.performUpdate(cwd);
    const content = fs.readFileSync(configPath, 'utf8');
    assert.ok(content.includes('"custom"'));
  });

  it('adds browser config to existing raid.json when framework detected', () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    // Create project files that trigger browser detection
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'test-app', scripts: { test: 'jest', dev: 'next dev' } }));
    fs.writeFileSync(path.join(cwd, 'next.config.js'), 'module.exports = {}');
    fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
    init.install(cwd);
    const configPath = path.join(cwd, '.claude', 'raid.json');
    // Manually remove the browser section
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    delete config.browser;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    // Verify browser is gone
    assert.ok(!JSON.parse(fs.readFileSync(configPath, 'utf8')).browser);
    update.performUpdate(cwd);
    const updated = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.ok(updated.browser, 'browser section should be re-added');
    assert.strictEqual(updated.browser.enabled, true);
    assert.ok(updated.browser.framework, 'browser framework should be set');
  });

  it('adds packageManager to existing raid.json when missing', () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    // Create project with pnpm lock file
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'test-app', scripts: { test: 'jest' } }));
    fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
    init.install(cwd);
    const configPath = path.join(cwd, '.claude', 'raid.json');
    // Manually remove packageManager from project section
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    delete config.project.packageManager;
    delete config.project.runCommand;
    delete config.project.execCommand;
    delete config.project.installCommand;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    update.performUpdate(cwd);
    const updated = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.ok(updated.project.packageManager, 'packageManager should be re-added');
    assert.strictEqual(updated.project.packageManager, 'pnpm');
  });

  it('does not overwrite existing browser config', () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'test-app', scripts: { test: 'jest', dev: 'next dev' } }));
    fs.writeFileSync(path.join(cwd, 'next.config.js'), 'module.exports = {}');
    init.install(cwd);
    const configPath = path.join(cwd, '.claude', 'raid.json');
    // Modify browser.baseUrl to a custom value
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!config.browser) config.browser = { enabled: true, framework: 'next', baseUrl: 'http://localhost:9999', defaultPort: 9999, portRange: [10000, 10004], playwrightConfig: 'playwright.config.ts', auth: null, startup: null };
    config.browser.baseUrl = 'http://localhost:9999';
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    update.performUpdate(cwd);
    const updated = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.strictEqual(updated.browser.baseUrl, 'http://localhost:9999', 'custom baseUrl should be preserved');
  });

  it('skips customized agent files', () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    init.install(cwd);
    const agentPath = path.join(cwd, '.claude', 'agents', 'wizard.md');
    fs.writeFileSync(agentPath, 'my custom wizard');
    const result = update.performUpdate(cwd);
    assert.ok(result.skippedAgents.includes('wizard.md'));
    const content = fs.readFileSync(agentPath, 'utf8');
    assert.strictEqual(content, 'my custom wizard');
  });

  it('skips customized party-rules.md', () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    init.install(cwd);
    fs.writeFileSync(path.join(cwd, '.claude', 'party-rules.md'), 'my custom rules');
    const result = update.performUpdate(cwd);
    assert.strictEqual(result.success, true);
    assert.ok(result.message.includes('party-rules.md'));
    const content = fs.readFileSync(path.join(cwd, '.claude', 'party-rules.md'), 'utf8');
    assert.strictEqual(content, 'my custom rules');
  });

  it('includes rtk recommendation when rtk is detected but not configured', () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    init.install(cwd);
    const result = update.performUpdate(cwd, { rtkDetected: true });
    assert.ok(result.rtkHint, 'should include RTK hint');
  });

  it('does not include rtk hint when already configured', () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    init.install(cwd, { rtkEnabled: true });
    const result = update.performUpdate(cwd, { rtkDetected: true });
    assert.strictEqual(result.rtkHint, false, 'should not hint when RTK already configured');
  });

  it('does not include rtk hint when rtk not detected', () => {
    init = require('../../src/init');
    update = require('../../src/update');
    const cwd = makeTempDir();
    init.install(cwd);
    const result = update.performUpdate(cwd);
    assert.strictEqual(result.rtkHint, false, 'should not hint when RTK not detected');
  });
});
