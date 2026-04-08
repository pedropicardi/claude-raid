'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let detectBrowser;
let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-detect-browser-'));
  return tmpDir;
}

describe('detectBrowser', () => {
  beforeEach(() => {
    detectBrowser = require('../../src/detect-browser').detectBrowser;
  });

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects Next.js from next.config.js', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'next.config.js'), 'module.exports = {}');
    const result = detectBrowser(cwd, 'pnpm');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.framework, 'next');
    assert.strictEqual(result.devCommand, 'pnpm dev');
    assert.strictEqual(result.defaultPort, 3000);
  });

  it('detects Next.js from next.config.mjs', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'next.config.mjs'), 'export default {}');
    const result = detectBrowser(cwd, 'pnpm');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.framework, 'next');
    assert.strictEqual(result.devCommand, 'pnpm dev');
    assert.strictEqual(result.defaultPort, 3000);
  });

  it('detects Next.js from next.config.ts with npm run command', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'next.config.ts'), 'export default {}');
    const result = detectBrowser(cwd, 'npm run');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.framework, 'next');
    assert.strictEqual(result.devCommand, 'npm run dev');
    assert.strictEqual(result.defaultPort, 3000);
  });

  it('detects Vite from vite.config.ts with yarn command', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'vite.config.ts'), 'export default {}');
    const result = detectBrowser(cwd, 'yarn');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.framework, 'vite');
    assert.strictEqual(result.devCommand, 'yarn dev');
    assert.strictEqual(result.defaultPort, 5173);
  });

  it('detects Vite from vite.config.js with bun command', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'vite.config.js'), 'export default {}');
    const result = detectBrowser(cwd, 'bun');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.framework, 'vite');
    assert.strictEqual(result.devCommand, 'bun dev');
    assert.strictEqual(result.defaultPort, 5173);
  });

  it('detects Angular from angular.json', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'angular.json'), '{}');
    const result = detectBrowser(cwd, 'npm run');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.framework, 'angular');
    assert.strictEqual(result.devCommand, 'npm run start');
    assert.strictEqual(result.defaultPort, 4200);
  });

  it('detects SvelteKit from svelte.config.js', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'svelte.config.js'), 'export default {}');
    const result = detectBrowser(cwd, 'pnpm');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.framework, 'svelte');
    assert.strictEqual(result.devCommand, 'pnpm dev');
    assert.strictEqual(result.defaultPort, 5173);
  });

  it('detects Nuxt from nuxt.config.ts', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'nuxt.config.ts'), 'export default defineNuxtConfig({})');
    const result = detectBrowser(cwd, 'pnpm');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.framework, 'nuxt');
    assert.strictEqual(result.devCommand, 'pnpm dev');
    assert.strictEqual(result.defaultPort, 3000);
  });

  it('detects Remix from remix.config.js', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'remix.config.js'), 'module.exports = {}');
    const result = detectBrowser(cwd, 'npm run');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.framework, 'remix');
    assert.strictEqual(result.devCommand, 'npm run dev');
    assert.strictEqual(result.defaultPort, 3000);
  });

  it('detects Remix from app/root.tsx', () => {
    const cwd = makeTempDir();
    fs.mkdirSync(path.join(cwd, 'app'));
    fs.writeFileSync(path.join(cwd, 'app', 'root.tsx'), 'export default function Root() {}');
    const result = detectBrowser(cwd, 'npm run');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.framework, 'remix');
    assert.strictEqual(result.devCommand, 'npm run dev');
    assert.strictEqual(result.defaultPort, 3000);
  });

  it('detects Astro from astro.config.mjs', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'astro.config.mjs'), 'export default {}');
    const result = detectBrowser(cwd, 'pnpm');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.framework, 'astro');
    assert.strictEqual(result.devCommand, 'pnpm dev');
    assert.strictEqual(result.defaultPort, 4321);
  });

  it('detects Gatsby from gatsby-config.js', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'gatsby-config.js'), 'module.exports = {}');
    const result = detectBrowser(cwd, 'npm run');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.framework, 'gatsby');
    assert.strictEqual(result.devCommand, 'npm run develop');
    assert.strictEqual(result.defaultPort, 8000);
  });

  it('detects Django from manage.py', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'manage.py'), '#!/usr/bin/env python');
    const result = detectBrowser(cwd, 'pnpm');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.framework, 'django');
    assert.strictEqual(result.devCommand, 'python manage.py runserver');
    assert.strictEqual(result.defaultPort, 8000);
  });

  it('detects Webpack SPA from webpack.config.js + index.html', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'webpack.config.js'), 'module.exports = {}');
    fs.writeFileSync(path.join(cwd, 'index.html'), '<!DOCTYPE html>');
    const result = detectBrowser(cwd, 'npm run');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.framework, 'webpack');
    assert.strictEqual(result.devCommand, 'npm run dev');
    assert.strictEqual(result.defaultPort, 8080);
  });

  it('does NOT detect webpack without index.html', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'webpack.config.js'), 'module.exports = {}');
    const result = detectBrowser(cwd, 'npm run');
    assert.strictEqual(result, null);
  });

  it('returns null when no framework detected', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), '{}');
    const result = detectBrowser(cwd, 'npm run');
    assert.strictEqual(result, null);
  });

  it('detects Yew/Leptos from trunk.toml', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'trunk.toml'), '[build]');
    const result = detectBrowser(cwd, 'pnpm');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.framework, 'trunk');
    assert.strictEqual(result.devCommand, 'trunk serve');
    assert.strictEqual(result.defaultPort, 8080);
  });

  it('first match wins when multiple frameworks exist', () => {
    const cwd = makeTempDir();
    // next.config.js comes before vite.config.ts in detection order
    fs.writeFileSync(path.join(cwd, 'next.config.js'), 'module.exports = {}');
    fs.writeFileSync(path.join(cwd, 'vite.config.ts'), 'export default {}');
    const result = detectBrowser(cwd, 'pnpm');
    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.framework, 'next');
  });
});
