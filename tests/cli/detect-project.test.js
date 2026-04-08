'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let detectProject;
let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-detect-'));
  return tmpDir;
}

describe('detectProject', () => {
  beforeEach(() => {
    detectProject = require('../../src/detect-project').detectProject;
  });

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects Node.js project from package.json', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({
      scripts: { test: 'jest', lint: 'eslint .', build: 'tsc' },
    }));
    const result = detectProject(cwd);
    assert.strictEqual(result.language, 'javascript');
    assert.strictEqual(result.testCommand, 'npm test');
    assert.strictEqual(result.lintCommand, 'npm run lint');
    assert.strictEqual(result.buildCommand, 'npm run build');
  });

  it('detects Rust project from Cargo.toml', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'Cargo.toml'), '[package]\nname = "myapp"');
    const result = detectProject(cwd);
    assert.strictEqual(result.language, 'rust');
    assert.strictEqual(result.testCommand, 'cargo test');
  });

  it('detects Python project from pyproject.toml', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'pyproject.toml'), '[tool.pytest]');
    const result = detectProject(cwd);
    assert.strictEqual(result.language, 'python');
  });

  it('detects Go project from go.mod', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'go.mod'), 'module example.com/myapp');
    const result = detectProject(cwd);
    assert.strictEqual(result.language, 'go');
    assert.strictEqual(result.testCommand, 'go test ./...');
  });

  it('returns unknown for unrecognized projects', () => {
    const cwd = makeTempDir();
    const result = detectProject(cwd);
    assert.strictEqual(result.language, 'unknown');
    assert.strictEqual(result.testCommand, '');
  });

  it('detects multiple languages and lists all', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), '{}');
    fs.writeFileSync(path.join(cwd, 'pyproject.toml'), '');
    const result = detectProject(cwd);
    assert.ok(Array.isArray(result.detected));
    assert.ok(result.detected.length >= 2);
  });

  it('handles unreadable pyproject.toml gracefully', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'pyproject.toml'), '');
    fs.chmodSync(path.join(cwd, 'pyproject.toml'), 0o000);
    const result = detectProject(cwd);
    assert.strictEqual(result.language, 'python');
    assert.strictEqual(result.testCommand, 'pytest');
    // Restore permissions for cleanup
    fs.chmodSync(path.join(cwd, 'pyproject.toml'), 0o644);
  });

  it('detects package manager from pnpm-lock.yaml', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({
      scripts: { test: 'jest', lint: 'eslint .', build: 'tsc' },
    }));
    fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
    const result = detectProject(cwd);
    assert.strictEqual(result.packageManager, 'pnpm');
    assert.strictEqual(result.runCommand, 'pnpm');
    assert.strictEqual(result.testCommand, 'pnpm test');
  });

  it('detects package manager from yarn.lock', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({
      scripts: { test: 'jest' },
    }));
    fs.writeFileSync(path.join(cwd, 'yarn.lock'), '');
    const result = detectProject(cwd);
    assert.strictEqual(result.packageManager, 'yarn');
    assert.strictEqual(result.testCommand, 'yarn test');
  });

  it('falls back to npm when no lockfile', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({
      scripts: { test: 'jest' },
    }));
    const result = detectProject(cwd);
    assert.strictEqual(result.packageManager, 'npm');
    assert.strictEqual(result.testCommand, 'npm test');
  });

  it('detects browser framework alongside language', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({
      scripts: { test: 'jest', dev: 'next dev' },
    }));
    fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
    fs.writeFileSync(path.join(cwd, 'next.config.js'), 'module.exports = {}');
    const result = detectProject(cwd);
    assert.ok(result.browser, 'browser should be detected');
    assert.strictEqual(result.browser.detected, true);
    assert.strictEqual(result.browser.framework, 'next');
    assert.strictEqual(result.browser.devCommand, 'pnpm dev');
  });

  it('returns browser as null when no framework', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({
      scripts: { test: 'jest' },
    }));
    const result = detectProject(cwd);
    assert.strictEqual(result.browser, null);
  });

  it('detects uv for python projects', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'pyproject.toml'), '[tool.pytest]');
    fs.writeFileSync(path.join(cwd, 'uv.lock'), '');
    const result = detectProject(cwd);
    assert.strictEqual(result.packageManager, 'uv');
    assert.strictEqual(result.testCommand, 'uv run pytest');
  });

  it('detects Django browser framework for Python', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'pyproject.toml'), '[tool.pytest]');
    fs.writeFileSync(path.join(cwd, 'manage.py'), '#!/usr/bin/env python');
    const result = detectProject(cwd);
    assert.ok(result.browser, 'browser should be detected');
    assert.strictEqual(result.browser.framework, 'django');
  });

  it('includes package manager in each detected entry for multi-language', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
    fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
    fs.writeFileSync(path.join(cwd, 'pyproject.toml'), '[tool.pytest]');
    fs.writeFileSync(path.join(cwd, 'uv.lock'), '');
    const result = detectProject(cwd);
    const jsEntry = result.detected.find((e) => e.language === 'javascript');
    const pyEntry = result.detected.find((e) => e.language === 'python');
    assert.ok(jsEntry, 'should have JS entry');
    assert.ok(pyEntry, 'should have Python entry');
    assert.strictEqual(jsEntry.packageManager, 'pnpm');
    assert.strictEqual(pyEntry.packageManager, 'uv');
  });

  it('does not add packageManager for rust or go', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'Cargo.toml'), '[package]\nname = "myapp"');
    const result = detectProject(cwd);
    assert.strictEqual(result.language, 'rust');
    assert.strictEqual(result.packageManager, undefined);
  });
});
