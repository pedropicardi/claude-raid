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
});
