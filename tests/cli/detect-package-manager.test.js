'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let detectPackageManager;
let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-pkg-mgr-'));
  return tmpDir;
}

describe('detectPackageManager', () => {
  beforeEach(() => {
    detectPackageManager = require('../../src/detect-package-manager').detectPackageManager;
  });

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects pnpm from pnpm-lock.yaml', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
    const result = detectPackageManager(cwd, 'javascript');
    assert.strictEqual(result.packageManager, 'pnpm');
    assert.strictEqual(result.runCommand, 'pnpm');
    assert.strictEqual(result.execCommand, 'pnpm dlx');
    assert.strictEqual(result.installCommand, 'pnpm add');
  });

  it('detects yarn from yarn.lock', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'yarn.lock'), '');
    const result = detectPackageManager(cwd, 'javascript');
    assert.strictEqual(result.packageManager, 'yarn');
    assert.strictEqual(result.runCommand, 'yarn');
    assert.strictEqual(result.execCommand, 'yarn dlx');
    assert.strictEqual(result.installCommand, 'yarn add');
  });

  it('detects bun from bun.lockb', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'bun.lockb'), '');
    const result = detectPackageManager(cwd, 'javascript');
    assert.strictEqual(result.packageManager, 'bun');
    assert.strictEqual(result.runCommand, 'bun');
    assert.strictEqual(result.execCommand, 'bunx');
    assert.strictEqual(result.installCommand, 'bun add');
  });

  it('detects bun from bun.lock', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'bun.lock'), '');
    const result = detectPackageManager(cwd, 'javascript');
    assert.strictEqual(result.packageManager, 'bun');
    assert.strictEqual(result.runCommand, 'bun');
    assert.strictEqual(result.execCommand, 'bunx');
    assert.strictEqual(result.installCommand, 'bun add');
  });

  it('detects npm from package-lock.json', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package-lock.json'), '{}');
    const result = detectPackageManager(cwd, 'javascript');
    assert.strictEqual(result.packageManager, 'npm');
    assert.strictEqual(result.runCommand, 'npm run');
    assert.strictEqual(result.execCommand, 'npx');
    assert.strictEqual(result.installCommand, 'npm install');
  });

  it('detects uv from uv.lock', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'uv.lock'), '');
    const result = detectPackageManager(cwd, 'python');
    assert.strictEqual(result.packageManager, 'uv');
    assert.strictEqual(result.runCommand, 'uv run');
    assert.strictEqual(result.execCommand, 'uvx');
    assert.strictEqual(result.installCommand, 'uv add');
  });

  it('detects poetry from poetry.lock', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'poetry.lock'), '');
    const result = detectPackageManager(cwd, 'python');
    assert.strictEqual(result.packageManager, 'poetry');
    assert.strictEqual(result.runCommand, 'poetry run');
    assert.strictEqual(result.execCommand, 'poetry run');
    assert.strictEqual(result.installCommand, 'poetry add');
  });

  it('falls back to npm defaults for javascript with no lockfile', () => {
    const cwd = makeTempDir();
    const result = detectPackageManager(cwd, 'javascript');
    assert.strictEqual(result.packageManager, 'npm');
    assert.strictEqual(result.runCommand, 'npm run');
    assert.strictEqual(result.execCommand, 'npx');
    assert.strictEqual(result.installCommand, 'npm install');
  });

  it('falls back to pip defaults for python with no lockfile', () => {
    const cwd = makeTempDir();
    const result = detectPackageManager(cwd, 'python');
    assert.strictEqual(result.packageManager, 'pip');
    assert.strictEqual(result.runCommand, 'python -m');
    assert.strictEqual(result.execCommand, 'python -m');
    assert.strictEqual(result.installCommand, 'pip install');
  });

  it('returns null for rust', () => {
    const cwd = makeTempDir();
    const result = detectPackageManager(cwd, 'rust');
    assert.strictEqual(result, null);
  });

  it('returns null for go', () => {
    const cwd = makeTempDir();
    const result = detectPackageManager(cwd, 'go');
    assert.strictEqual(result, null);
  });

  it('pnpm wins over npm when both lockfiles exist', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
    fs.writeFileSync(path.join(cwd, 'package-lock.json'), '{}');
    const result = detectPackageManager(cwd, 'javascript');
    assert.strictEqual(result.packageManager, 'pnpm');
  });
});
