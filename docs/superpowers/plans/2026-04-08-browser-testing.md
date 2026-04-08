# Browser Testing Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser testing capabilities to The Raid — Playwright MCP for automated TDD, Claude-in-Chrome for live adversarial inspection — with package manager detection, browser framework detection, and three new skills.

**Architecture:** Extend `detect-project.js` with two new detection layers (package manager, browser framework). Update `init.js` to generate browser config in `raid.json`. Create three new skill files (`raid-browser`, `raid-browser-playwright`, `raid-browser-chrome`) as SKILL.md templates. Modify five existing skills with browser-aware conditional sections.

**Tech Stack:** Node.js (CommonJS), Node built-in test runner, Playwright MCP, Claude-in-Chrome MCP

---

## File Map

### New Files
- `src/detect-package-manager.js` — Package manager detection logic
- `src/detect-browser.js` — Browser framework detection logic
- `template/.claude/skills/raid-browser/SKILL.md` — Core browser orchestration skill
- `template/.claude/skills/raid-browser-playwright/SKILL.md` — Playwright TDD skill
- `template/.claude/skills/raid-browser-chrome/SKILL.md` — Chrome inspection skill
- `tests/cli/detect-package-manager.test.js` — Package manager detection tests
- `tests/cli/detect-browser.test.js` — Browser framework detection tests

### Modified Files
- `src/detect-project.js` — Import and integrate package manager + browser detection
- `src/init.js` — Generate browser config in `raid.json`, add `.env.raid` to `.gitignore`
- `tests/cli/detect-project.test.js` — Update tests for new detection fields
- `tests/cli/init.test.js` — Add tests for browser config generation
- `template/.claude/skills/raid-tdd/SKILL.md` — Add browser test decision point
- `template/.claude/skills/raid-implementation/SKILL.md` — Add browser boot/cleanup around tasks
- `template/.claude/skills/raid-review/SKILL.md` — Add browser inspection phase
- `template/.claude/skills/raid-verification/SKILL.md` — Include browser tests in "tests pass"
- `template/.claude/skills/raid-finishing/SKILL.md` — Add browser cleanup verification

---

## Task 1: Package Manager Detection

**Files:**
- Create: `src/detect-package-manager.js`
- Create: `tests/cli/detect-package-manager.test.js`

- [ ] **Step 1: Write failing tests for package manager detection**

```javascript
// tests/cli/detect-package-manager.test.js
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let detectPackageManager;
let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-pm-'));
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

  it('falls back to npm for javascript when no lockfile found', () => {
    const cwd = makeTempDir();
    const result = detectPackageManager(cwd, 'javascript');
    assert.strictEqual(result.packageManager, 'npm');
    assert.strictEqual(result.runCommand, 'npm run');
  });

  it('falls back to pip for python when no lockfile found', () => {
    const cwd = makeTempDir();
    const result = detectPackageManager(cwd, 'python');
    assert.strictEqual(result.packageManager, 'pip');
    assert.strictEqual(result.runCommand, 'python -m');
    assert.strictEqual(result.installCommand, 'pip install');
  });

  it('returns null for non-JS/Python languages', () => {
    const cwd = makeTempDir();
    const result = detectPackageManager(cwd, 'rust');
    assert.strictEqual(result, null);
  });

  it('returns null for go', () => {
    const cwd = makeTempDir();
    const result = detectPackageManager(cwd, 'go');
    assert.strictEqual(result, null);
  });

  it('prioritizes lockfiles over fallback (pnpm-lock.yaml over npm fallback)', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
    fs.writeFileSync(path.join(cwd, 'package-lock.json'), '{}');
    const result = detectPackageManager(cwd, 'javascript');
    assert.strictEqual(result.packageManager, 'pnpm');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/cli/detect-package-manager.test.js`
Expected: FAIL — `Cannot find module '../../src/detect-package-manager'`

- [ ] **Step 3: Write the implementation**

```javascript
// src/detect-package-manager.js
'use strict';

const fs = require('fs');
const path = require('path');

const JS_LOCKFILES = [
  { file: 'pnpm-lock.yaml', manager: 'pnpm', run: 'pnpm', exec: 'pnpm dlx', install: 'pnpm add' },
  { file: 'yarn.lock', manager: 'yarn', run: 'yarn', exec: 'yarn dlx', install: 'yarn add' },
  { file: 'bun.lockb', manager: 'bun', run: 'bun', exec: 'bunx', install: 'bun add' },
  { file: 'bun.lock', manager: 'bun', run: 'bun', exec: 'bunx', install: 'bun add' },
  { file: 'package-lock.json', manager: 'npm', run: 'npm run', exec: 'npx', install: 'npm install' },
];

const PY_LOCKFILES = [
  { file: 'uv.lock', manager: 'uv', run: 'uv run', exec: 'uvx', install: 'uv add' },
  { file: 'poetry.lock', manager: 'poetry', run: 'poetry run', exec: 'poetry run', install: 'poetry add' },
];

const FALLBACKS = {
  javascript: { packageManager: 'npm', runCommand: 'npm run', execCommand: 'npx', installCommand: 'npm install' },
  python: { packageManager: 'pip', runCommand: 'python -m', execCommand: 'python -m', installCommand: 'pip install' },
};

function detectPackageManager(cwd, language) {
  let lockfiles;
  if (language === 'javascript') {
    lockfiles = JS_LOCKFILES;
  } else if (language === 'python') {
    lockfiles = PY_LOCKFILES;
  } else {
    return null;
  }

  for (const entry of lockfiles) {
    if (fs.existsSync(path.join(cwd, entry.file))) {
      return {
        packageManager: entry.manager,
        runCommand: entry.run,
        execCommand: entry.exec,
        installCommand: entry.install,
      };
    }
  }

  return FALLBACKS[language] || null;
}

module.exports = { detectPackageManager };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/cli/detect-package-manager.test.js`
Expected: All 12 tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All existing tests still pass, no regressions

- [ ] **Step 6: Commit**

```bash
git add src/detect-package-manager.js tests/cli/detect-package-manager.test.js
git commit -m "feat(detect): add package manager detection for JS and Python projects"
```

---

## Task 2: Browser Framework Detection

**Files:**
- Create: `src/detect-browser.js`
- Create: `tests/cli/detect-browser.test.js`

- [ ] **Step 1: Write failing tests for browser framework detection**

```javascript
// tests/cli/detect-browser.test.js
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let detectBrowser;
let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-browser-'));
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
    assert.strictEqual(result.framework, 'next');
    assert.strictEqual(result.devCommand, 'pnpm dev');
    assert.strictEqual(result.defaultPort, 3000);
    assert.strictEqual(result.detected, true);
  });

  it('detects Next.js from next.config.mjs', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'next.config.mjs'), 'export default {}');
    const result = detectBrowser(cwd, 'pnpm');
    assert.strictEqual(result.framework, 'next');
  });

  it('detects Next.js from next.config.ts', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'next.config.ts'), 'export default {}');
    const result = detectBrowser(cwd, 'npm run');
    assert.strictEqual(result.framework, 'next');
    assert.strictEqual(result.devCommand, 'npm run dev');
  });

  it('detects Vite from vite.config.ts', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'vite.config.ts'), '');
    const result = detectBrowser(cwd, 'yarn');
    assert.strictEqual(result.framework, 'vite');
    assert.strictEqual(result.devCommand, 'yarn dev');
    assert.strictEqual(result.defaultPort, 5173);
  });

  it('detects Vite from vite.config.js', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'vite.config.js'), '');
    const result = detectBrowser(cwd, 'bun');
    assert.strictEqual(result.framework, 'vite');
    assert.strictEqual(result.devCommand, 'bun dev');
  });

  it('detects Angular from angular.json', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'angular.json'), '{}');
    const result = detectBrowser(cwd, 'npm run');
    assert.strictEqual(result.framework, 'angular');
    assert.strictEqual(result.defaultPort, 4200);
  });

  it('detects SvelteKit from svelte.config.js', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'svelte.config.js'), '');
    const result = detectBrowser(cwd, 'pnpm');
    assert.strictEqual(result.framework, 'svelte');
    assert.strictEqual(result.defaultPort, 5173);
  });

  it('detects Nuxt from nuxt.config.ts', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'nuxt.config.ts'), '');
    const result = detectBrowser(cwd, 'pnpm');
    assert.strictEqual(result.framework, 'nuxt');
    assert.strictEqual(result.defaultPort, 3000);
  });

  it('detects Remix from remix.config.js', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'remix.config.js'), '');
    const result = detectBrowser(cwd, 'npm run');
    assert.strictEqual(result.framework, 'remix');
    assert.strictEqual(result.defaultPort, 3000);
  });

  it('detects Remix from app/root.tsx', () => {
    const cwd = makeTempDir();
    fs.mkdirSync(path.join(cwd, 'app'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'app', 'root.tsx'), '');
    const result = detectBrowser(cwd, 'npm run');
    assert.strictEqual(result.framework, 'remix');
  });

  it('detects Astro from astro.config.mjs', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'astro.config.mjs'), '');
    const result = detectBrowser(cwd, 'pnpm');
    assert.strictEqual(result.framework, 'astro');
    assert.strictEqual(result.defaultPort, 4321);
  });

  it('detects Gatsby from gatsby-config.js', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'gatsby-config.js'), '');
    const result = detectBrowser(cwd, 'npm run');
    assert.strictEqual(result.framework, 'gatsby');
    assert.strictEqual(result.defaultPort, 8000);
  });

  it('detects Django from manage.py', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'manage.py'), '#!/usr/bin/env python');
    const result = detectBrowser(cwd, 'python -m');
    assert.strictEqual(result.framework, 'django');
    assert.strictEqual(result.devCommand, 'python manage.py runserver');
    assert.strictEqual(result.defaultPort, 8000);
  });

  it('detects Webpack SPA from webpack.config.js + index.html', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'webpack.config.js'), '');
    fs.writeFileSync(path.join(cwd, 'index.html'), '<html></html>');
    const result = detectBrowser(cwd, 'npm run');
    assert.strictEqual(result.framework, 'webpack');
    assert.strictEqual(result.defaultPort, 8080);
  });

  it('does NOT detect webpack without index.html', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'webpack.config.js'), '');
    const result = detectBrowser(cwd, 'npm run');
    assert.strictEqual(result, null);
  });

  it('returns null when no framework detected', () => {
    const cwd = makeTempDir();
    const result = detectBrowser(cwd, 'npm run');
    assert.strictEqual(result, null);
  });

  it('detects Yew/Leptos from trunk.toml', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'trunk.toml'), '');
    const result = detectBrowser(cwd, 'cargo');
    assert.strictEqual(result.framework, 'trunk');
    assert.strictEqual(result.devCommand, 'trunk serve');
    assert.strictEqual(result.defaultPort, 8080);
  });

  it('returns first match when multiple frameworks exist', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'next.config.js'), '');
    fs.writeFileSync(path.join(cwd, 'vite.config.ts'), '');
    const result = detectBrowser(cwd, 'pnpm');
    assert.strictEqual(result.framework, 'next');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/cli/detect-browser.test.js`
Expected: FAIL — `Cannot find module '../../src/detect-browser'`

- [ ] **Step 3: Write the implementation**

```javascript
// src/detect-browser.js
'use strict';

const fs = require('fs');
const path = require('path');

// Frameworks detected by a single config file.
// Order matters — first match wins.
const SINGLE_FILE_FRAMEWORKS = [
  { files: ['next.config.js', 'next.config.mjs', 'next.config.ts'], framework: 'next', dev: '{run} dev', port: 3000 },
  { files: ['nuxt.config.ts', 'nuxt.config.js'], framework: 'nuxt', dev: '{run} dev', port: 3000 },
  { files: ['remix.config.js', 'remix.config.ts'], framework: 'remix', dev: '{run} dev', port: 3000 },
  { files: ['svelte.config.js', 'svelte.config.ts'], framework: 'svelte', dev: '{run} dev', port: 5173 },
  { files: ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'], framework: 'vite', dev: '{run} dev', port: 5173 },
  { files: ['angular.json'], framework: 'angular', dev: '{run} start', port: 4200 },
  { files: ['astro.config.mjs', 'astro.config.js', 'astro.config.ts'], framework: 'astro', dev: '{run} dev', port: 4321 },
  { files: ['gatsby-config.js', 'gatsby-config.ts'], framework: 'gatsby', dev: '{run} develop', port: 8000 },
  { files: ['manage.py'], framework: 'django', dev: 'python manage.py runserver', port: 8000 },
  { files: ['trunk.toml'], framework: 'trunk', dev: 'trunk serve', port: 8080 },
];

// Frameworks requiring multiple files to confirm.
const MULTI_FILE_FRAMEWORKS = [
  { files: ['webpack.config.js', 'index.html'], framework: 'webpack', dev: '{run} dev', port: 8080 },
];

// Frameworks detected by a directory + file combo.
const DIR_FILE_FRAMEWORKS = [
  { dir: 'app', file: 'root.tsx', framework: 'remix', dev: '{run} dev', port: 3000 },
];

function detectBrowser(cwd, runCommand) {
  // Check single-file frameworks (first match wins)
  for (const entry of SINGLE_FILE_FRAMEWORKS) {
    for (const file of entry.files) {
      if (fs.existsSync(path.join(cwd, file))) {
        return {
          detected: true,
          framework: entry.framework,
          devCommand: entry.dev.replace('{run}', runCommand),
          defaultPort: entry.port,
        };
      }
    }
  }

  // Check multi-file frameworks (all files must exist)
  for (const entry of MULTI_FILE_FRAMEWORKS) {
    const allExist = entry.files.every(f => fs.existsSync(path.join(cwd, f)));
    if (allExist) {
      return {
        detected: true,
        framework: entry.framework,
        devCommand: entry.dev.replace('{run}', runCommand),
        defaultPort: entry.port,
      };
    }
  }

  // Check dir+file frameworks
  for (const entry of DIR_FILE_FRAMEWORKS) {
    if (fs.existsSync(path.join(cwd, entry.dir, entry.file))) {
      return {
        detected: true,
        framework: entry.framework,
        devCommand: entry.dev.replace('{run}', runCommand),
        defaultPort: entry.port,
      };
    }
  }

  return null;
}

module.exports = { detectBrowser };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/cli/detect-browser.test.js`
Expected: All 18 tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass, no regressions

- [ ] **Step 6: Commit**

```bash
git add src/detect-browser.js tests/cli/detect-browser.test.js
git commit -m "feat(detect): add browser framework detection for web projects"
```

---

## Task 3: Integrate Detection Layers into `detect-project.js`

**Files:**
- Modify: `src/detect-project.js`
- Modify: `tests/cli/detect-project.test.js`

- [ ] **Step 1: Write failing tests for integrated detection**

Add these tests to the existing `tests/cli/detect-project.test.js`:

```javascript
  it('detects package manager from pnpm-lock.yaml', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'vitest' } }));
    fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
    const result = detectProject(cwd);
    assert.strictEqual(result.packageManager, 'pnpm');
    assert.strictEqual(result.runCommand, 'pnpm');
    assert.strictEqual(result.execCommand, 'pnpm dlx');
    assert.strictEqual(result.installCommand, 'pnpm add');
    assert.strictEqual(result.testCommand, 'pnpm test');
  });

  it('detects package manager from yarn.lock', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
    fs.writeFileSync(path.join(cwd, 'yarn.lock'), '');
    const result = detectProject(cwd);
    assert.strictEqual(result.packageManager, 'yarn');
    assert.strictEqual(result.testCommand, 'yarn test');
  });

  it('falls back to npm when no lockfile exists', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
    const result = detectProject(cwd);
    assert.strictEqual(result.packageManager, 'npm');
    assert.strictEqual(result.testCommand, 'npm test');
  });

  it('detects browser framework alongside language', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'vitest', dev: 'next dev' } }));
    fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
    fs.writeFileSync(path.join(cwd, 'next.config.js'), 'module.exports = {}');
    const result = detectProject(cwd);
    assert.strictEqual(result.browser.detected, true);
    assert.strictEqual(result.browser.framework, 'next');
    assert.strictEqual(result.browser.devCommand, 'pnpm dev');
    assert.strictEqual(result.browser.defaultPort, 3000);
  });

  it('returns browser as null when no framework detected', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), '{}');
    const result = detectProject(cwd);
    assert.strictEqual(result.browser, null);
  });

  it('detects uv for python projects', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'pyproject.toml'), '[project]');
    fs.writeFileSync(path.join(cwd, 'uv.lock'), '');
    const result = detectProject(cwd);
    assert.strictEqual(result.language, 'python');
    assert.strictEqual(result.packageManager, 'uv');
    assert.strictEqual(result.testCommand, 'uv run pytest');
  });

  it('detects Django browser framework for Python projects', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'pyproject.toml'), '[project]');
    fs.writeFileSync(path.join(cwd, 'manage.py'), '#!/usr/bin/env python');
    const result = detectProject(cwd);
    assert.strictEqual(result.language, 'python');
    assert.strictEqual(result.browser.framework, 'django');
  });

  it('includes package manager info in each detected entry for multi-language', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), '{}');
    fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
    fs.writeFileSync(path.join(cwd, 'pyproject.toml'), '');
    fs.writeFileSync(path.join(cwd, 'uv.lock'), '');
    const result = detectProject(cwd);
    assert.ok(result.detected.length >= 2);
    const jsEntry = result.detected.find(d => d.language === 'javascript');
    const pyEntry = result.detected.find(d => d.language === 'python');
    assert.strictEqual(jsEntry.packageManager, 'pnpm');
    assert.strictEqual(pyEntry.packageManager, 'uv');
  });

  it('does not add packageManager for rust or go', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'Cargo.toml'), '[package]\nname = "app"');
    const result = detectProject(cwd);
    assert.strictEqual(result.language, 'rust');
    assert.strictEqual(result.packageManager, undefined);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/cli/detect-project.test.js`
Expected: FAIL — new tests fail because `detectProject` doesn't return `packageManager` or `browser` fields yet

- [ ] **Step 3: Update `detect-project.js` to integrate both detection layers**

```javascript
// src/detect-project.js
'use strict';

const fs = require('fs');
const path = require('path');
const { detectPackageManager } = require('./detect-package-manager');
const { detectBrowser } = require('./detect-browser');

const DETECTORS = [
  {
    file: 'package.json',
    language: 'javascript',
    detect(cwd, pm) {
      const pkgPath = path.join(cwd, 'package.json');
      const run = pm ? pm.runCommand : 'npm run';
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const scripts = pkg.scripts || {};
        return {
          language: 'javascript',
          testCommand: scripts.test ? `${run} test` : '',
          lintCommand: scripts.lint ? `${run} lint` : '',
          buildCommand: scripts.build ? `${run} build` : '',
          name: pkg.name || path.basename(cwd),
        };
      } catch {
        return { language: 'javascript', testCommand: '', lintCommand: '', buildCommand: '', name: path.basename(cwd) };
      }
    },
  },
  {
    file: 'Cargo.toml',
    language: 'rust',
    detect(cwd) {
      return {
        language: 'rust',
        testCommand: 'cargo test',
        lintCommand: 'cargo clippy',
        buildCommand: 'cargo build',
        name: path.basename(cwd),
      };
    },
  },
  {
    file: 'pyproject.toml',
    language: 'python',
    detect(cwd, pm) {
      const run = pm ? pm.runCommand : null;
      try {
        const content = fs.readFileSync(path.join(cwd, 'pyproject.toml'), 'utf8');
        const usesPoetry = content.includes('[tool.poetry]');
        if (run) {
          return {
            language: 'python',
            testCommand: `${run} pytest`,
            lintCommand: `${run} ruff check .`,
            buildCommand: pm.packageManager === 'poetry' ? 'poetry build' : `${run} python -m build`,
            name: path.basename(cwd),
          };
        }
        return {
          language: 'python',
          testCommand: usesPoetry ? 'poetry run pytest' : 'pytest',
          lintCommand: usesPoetry ? 'poetry run ruff check .' : 'ruff check .',
          buildCommand: usesPoetry ? 'poetry build' : 'python -m build',
          name: path.basename(cwd),
        };
      } catch {
        return { language: 'python', testCommand: 'pytest', lintCommand: 'ruff check .', buildCommand: 'python -m build', name: path.basename(cwd) };
      }
    },
  },
  {
    file: 'requirements.txt',
    language: 'python',
    detect(cwd, pm) {
      const run = pm ? pm.runCommand : null;
      if (run) {
        return {
          language: 'python',
          testCommand: `${run} pytest`,
          lintCommand: `${run} ruff check .`,
          buildCommand: '',
          name: path.basename(cwd),
        };
      }
      return {
        language: 'python',
        testCommand: 'pytest',
        lintCommand: 'ruff check .',
        buildCommand: '',
        name: path.basename(cwd),
      };
    },
  },
  {
    file: 'go.mod',
    language: 'go',
    detect(cwd) {
      return {
        language: 'go',
        testCommand: 'go test ./...',
        lintCommand: 'go vet ./...',
        buildCommand: 'go build ./...',
        name: path.basename(cwd),
      };
    },
  },
];

function detectProject(cwd) {
  const detected = [];

  for (const detector of DETECTORS) {
    if (fs.existsSync(path.join(cwd, detector.file))) {
      const pm = detectPackageManager(cwd, detector.language);
      const result = detector.detect(cwd, pm);
      if (pm) {
        result.packageManager = pm.packageManager;
        result.runCommand = pm.runCommand;
        result.execCommand = pm.execCommand;
        result.installCommand = pm.installCommand;
      }
      detected.push(result);
    }
  }

  if (detected.length === 0) {
    return {
      language: 'unknown',
      testCommand: '',
      lintCommand: '',
      buildCommand: '',
      name: path.basename(cwd),
      browser: null,
      detected: [],
    };
  }

  const primary = detected[0];
  primary.detected = detected;

  // Browser detection — use primary language's run command
  const runCmd = primary.runCommand || 'npm run';
  primary.browser = detectBrowser(cwd, runCmd);

  return primary;
}

module.exports = { detectProject };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/cli/detect-project.test.js`
Expected: All tests pass (old + new)

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass, no regressions

- [ ] **Step 6: Commit**

```bash
git add src/detect-project.js tests/cli/detect-project.test.js
git commit -m "feat(detect): integrate package manager and browser detection into detectProject"
```

---

## Task 4: Update `init.js` to Generate Browser Config

**Files:**
- Modify: `src/init.js`
- Modify: `tests/cli/init.test.js`

- [ ] **Step 1: Write failing tests for browser config in raid.json**

Add these tests to `tests/cli/init.test.js`:

```javascript
  it('generates raid.json with packageManager fields', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
    fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
    init.install(cwd);
    const config = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8'));
    assert.strictEqual(config.project.packageManager, 'pnpm');
    assert.strictEqual(config.project.runCommand, 'pnpm');
    assert.strictEqual(config.project.execCommand, 'pnpm dlx');
    assert.strictEqual(config.project.installCommand, 'pnpm add');
  });

  it('generates raid.json with browser section when framework detected', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'vitest' } }));
    fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '');
    fs.writeFileSync(path.join(cwd, 'next.config.js'), 'module.exports = {}');
    init.install(cwd);
    const config = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8'));
    assert.strictEqual(config.browser.enabled, true);
    assert.strictEqual(config.browser.framework, 'next');
    assert.strictEqual(config.browser.devCommand, 'pnpm dev');
    assert.strictEqual(config.browser.defaultPort, 3000);
    assert.strictEqual(config.browser.baseUrl, 'http://localhost:3000');
    assert.deepStrictEqual(config.browser.portRange, [3001, 3005]);
    assert.strictEqual(config.browser.playwrightConfig, 'playwright.config.ts');
    assert.strictEqual(config.browser.auth, null);
    assert.strictEqual(config.browser.startup, null);
  });

  it('omits browser section when no framework detected', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
    init.install(cwd);
    const config = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'raid.json'), 'utf8'));
    assert.strictEqual(config.browser, undefined);
  });

  it('adds .env.raid to .gitignore', () => {
    init = require('../../src/init');
    const cwd = makeTempDir();
    init.install(cwd);
    const gitignore = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('.env.raid'));
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/cli/init.test.js`
Expected: FAIL — new tests fail because `init.js` doesn't generate `packageManager` or `browser` fields

- [ ] **Step 3: Update `init.js` to include browser config and package manager fields**

In `src/init.js`, update the raid.json generation block (around line 65-86):

Replace the `raidConfig` object construction with:

```javascript
    const raidConfig = {
      project: {
        name: detected.name || path.basename(cwd),
        language: detected.language,
        packageManager: detected.packageManager || undefined,
        runCommand: detected.runCommand || undefined,
        execCommand: detected.execCommand || undefined,
        installCommand: detected.installCommand || undefined,
        testCommand: detected.testCommand || '',
        lintCommand: detected.lintCommand || '',
        buildCommand: detected.buildCommand || '',
      },
      paths: {
        specs: 'docs/raid/specs',
        plans: 'docs/raid/plans',
        worktrees: '.worktrees',
      },
      conventions: {
        fileNaming: 'none',
        commits: 'conventional',
      },
      raid: {
        defaultMode: 'full',
      },
    };

    // Add browser section if framework detected
    if (detected.browser) {
      raidConfig.browser = {
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
    }
```

Also add `.env.raid` to the `ignoreEntries` array (around line 94):

```javascript
  const ignoreEntries = ['.claude/raid-last-test-run', '.claude/raid-session', '.claude/raid-dungeon.md', '.claude/raid-dungeon-phase-*', '.env.raid'];
```

Clean `undefined` values from `project` before writing (to keep JSON clean for languages without package managers):

```javascript
    // Remove undefined values from project
    Object.keys(raidConfig.project).forEach(key => {
      if (raidConfig.project[key] === undefined) {
        delete raidConfig.project[key];
      }
    });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/cli/init.test.js`
Expected: All tests pass (old + new)

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass, no regressions

- [ ] **Step 6: Commit**

```bash
git add src/init.js tests/cli/init.test.js
git commit -m "feat(init): generate browser config and package manager fields in raid.json"
```

---

## Task 5: Create `raid-browser` Skill (Core Orchestration)

**Files:**
- Create: `template/.claude/skills/raid-browser/SKILL.md`

- [ ] **Step 1: Write the skill file**

```markdown
---
name: raid-browser
description: "Core browser orchestration: startup discovery, boot/cleanup lifecycle, port isolation, pre-flight checks (auth, test subject clarity). Shared infrastructure for raid-browser-playwright and raid-browser-chrome."
---

# Raid Browser — Core Orchestration

Shared infrastructure for browser testing. Handles startup discovery, boot/cleanup lifecycle, port isolation, and pre-flight checks.

**This skill is invoked by `raid-browser-playwright` and `raid-browser-chrome` — not directly by users.**

## The Iron Laws

```
1. EVERY BOOT HAS A MATCHING CLEANUP — leaked processes are never acceptable
2. EVERY BROWSER SESSION STARTS WITH PRE-FLIGHT — no vague "test the app"
3. STARTUP RECIPE IS DISCOVERED ONCE, CODIFIED FOREVER — investigate, verify, write to raid.json
```

## Pre-Flight Checks (MANDATORY before every browser session)

### 1. Test Subject Clarity (HARD GATE)

Before ANY browser action, the agent MUST state exactly what they're testing:

```
📋 BROWSER TEST SUBJECT:
- Feature: "<specific feature name>"
- Scope: "<what interactions/flows are being tested>"
- Success criteria: "<what 'working' looks like>"
- Out of scope: "<what we're NOT testing>"
```

If the agent cannot clearly state the test subject, the Wizard asks the user:

```
⚡ WIZARD → USER: "What specific user flow should we verify in the browser?

Examples:
- 'User can complete checkout with a credit card'
- 'Admin dashboard loads data tables correctly'
- 'Search filters update results in real-time'"
```

**No vague subjects.** "Test the app" or "check if it works" are not valid subjects.

### 2. Authentication Check

The agent investigates auth requirements by reading:
- Auth middleware, login pages, session config, protected routes
- `.env.example` for auth-related variables
- README for auth setup instructions

If auth is required and no credentials exist in `raid.json` under `browser.auth`:

```
⚡ WIZARD → USER: "This app requires authentication. I need:
  1. Test user credentials (email/password) or a method to create them
  2. Are there different roles to test? (admin, user, guest)
  3. Is there a seed script that creates test users?

  Credentials will be stored in .env.raid (gitignored)."
```

Auth config in `raid.json` (credentials reference env vars from `.env.raid`):

```json
"auth": {
  "required": true,
  "method": "cookie-session",
  "loginUrl": "/login",
  "credentials": {
    "default": { "email": "$RAID_TEST_EMAIL", "password": "$RAID_TEST_PASSWORD" },
    "admin": { "email": "$RAID_ADMIN_EMAIL", "password": "$RAID_ADMIN_PASSWORD" }
  },
  "seedCommand": "{runCommand} db:seed-test-users"
}
```

### 3. Route/Page Discovery

After boot, before testing, the agent maps relevant pages:
- What URLs are involved in this feature?
- What's the expected navigation flow?
- Loading states, redirects, client-side routing?

Pin to Dungeon as verified context for all agents.

## Startup Discovery Protocol

Invoked when `browser.startup` is `null` in `raid.json`. The Wizard assigns one agent to investigate.

### Investigation Steps

1. **Read project config** — `package.json` scripts, `.env.example`, `.env.local.example`, `docker-compose.yml`, `wrangler.toml`, `vercel.json`, `netlify.toml`, `Procfile`
2. **Read README** — "Getting Started", "Development", "Running locally" sections
3. **Map runtime topology** — identify every process needed:
   - Primary dev server (the detected framework)
   - API servers / backend processes
   - Edge workers (Cloudflare Workers, Vercel Edge, etc.)
   - Databases (Postgres, MySQL, Redis, SQLite)
   - Message queues, search engines, etc.
   - Seed/migration scripts that must run first
4. **Identify environment variables** — which need to differ per instance (DB names, ports), which are shared (API keys)
5. **Test the recipe** — boot on a non-default port, run health check, tear down
6. **Pin to Dungeon** — `📌 DUNGEON: Startup recipe verified — [full recipe details]`
7. **Write to `raid.json`** — populate `browser.startup`

### Challengers Attack the Recipe

- Is the cleanup complete? What if a service crashes mid-boot?
- Does it handle port conflicts?
- What about stale PID files?
- Does the DB migration run idempotently?

### Startup Recipe Format (in `raid.json`)

```json
"startup": {
  "env": { "DATABASE_URL": "postgresql://localhost:5432/test_{{PORT}}" },
  "services": [
    { "name": "db", "command": "docker compose up -d postgres" },
    { "name": "edge", "command": "wrangler dev --port {{EDGE_PORT}}" },
    { "name": "app", "command": "{devCommand} --port {{PORT}}" }
  ],
  "readyCheck": "curl -s http://localhost:{{PORT}}/api/health",
  "cleanup": ["kill {{PID}}", "docker compose down"]
}
```

Template variables `{{PORT}}`, `{{EDGE_PORT}}`, `{{PID}}` are resolved per-agent at runtime.

## Boot/Cleanup Lifecycle

### BOOT(agentId, port)

```
1. Resolve template variables from portRange assignment
2. Set per-instance environment variables
3. Start services in declared order (respecting dependencies)
4. Wait for readyCheck to pass (timeout: 60s, retry every 2s)
5. Record all PIDs for this agent
6. Return { pids, port, baseUrl }

If any service fails to start:
  → Kill all already-started services
  → Report failure with service logs
  → Do NOT proceed to testing
```

### CLEANUP(agentId)

```
1. Kill all PIDs tracked for this agent (SIGTERM first)
2. Wait 5s for graceful shutdown
3. SIGKILL any remaining processes
4. Run cleanup commands from startup config
5. Verify all assigned ports are released (lsof -i :PORT)
6. Remove any temp files/DBs created for this instance

If cleanup fails:
  → Report which ports/processes are still alive
  → Wizard escalates to user immediately
```

## Port Allocation

Read `portRange` from `raid.json` (e.g., `[3001, 3005]`).

| Mode | Agents | Port Assignment |
|---|---|---|
| Full Raid (Phase 3) | 1 implementer | portRange[0] |
| Full Raid (Phase 4) | 3 challengers | portRange[0], portRange[0]+1, portRange[0]+2 |
| Skirmish | 2 agents | portRange[0], portRange[0]+1 |
| Scout | 1 agent | portRange[0] |

## When Startup Recipe Fails

If the existing `browser.startup` recipe fails on boot:

1. Don't retry blindly — investigate what changed
2. Read error logs from failed services
3. Check if dependencies changed (new env vars, new services, port conflicts)
4. Update the recipe in `raid.json`
5. Re-test the updated recipe
6. Pin to Dungeon: `📌 DUNGEON: Startup recipe updated — [reason for change]`
```

- [ ] **Step 2: Verify skill file exists and is well-formed**

Run: `cat template/.claude/skills/raid-browser/SKILL.md | head -5`
Expected: Shows the frontmatter with `name: raid-browser`

- [ ] **Step 3: Run full test suite (no regressions)**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
mkdir -p template/.claude/skills/raid-browser
git add template/.claude/skills/raid-browser/SKILL.md
git commit -m "feat(skills): add raid-browser core orchestration skill"
```

---

## Task 6: Create `raid-browser-playwright` Skill (Automated Test Authoring)

**Files:**
- Create: `template/.claude/skills/raid-browser-playwright/SKILL.md`

- [ ] **Step 1: Write the skill file**

```markdown
---
name: raid-browser-playwright
description: "Playwright MCP automated browser test authoring. Extends TDD RED-GREEN-REFACTOR with .spec.ts files. Console + network assertions mandatory. Invoked from raid-tdd and raid-implementation during Phase 3."
---

# Raid Browser Playwright — Automated Test Authoring

Write browser tests as part of TDD. Use Playwright MCP to explore, then encode verified interactions into durable `.spec.ts` files.

<HARD-GATE>
Do NOT write browser tests without invoking `raid-browser` pre-flight first. Do NOT skip console/network assertions. Do NOT write tests without watching them fail first (TDD RED step). No subagents.
</HARD-GATE>

## When to Write Browser Tests vs Unit Tests

Not every task needs a browser test. The implementer decides and states reasoning. Challengers attack this decision.

| Write Browser Test | Write Unit Test Only |
|---|---|
| New user-facing flow (signup, checkout) | Pure utility function |
| UI interaction (drag-drop, modal, form) | API endpoint logic |
| Client-side routing / navigation | Data transformation |
| Visual state changes (loading, error, empty) | Business rule validation |
| Integration between frontend and API | Database queries |

**If unsure:** Write the browser test. It's easier to remove an unnecessary test than to find a bug in production.

## Browser TDD Cycle

### RED (browser)

1. Write Playwright test file: `tests/e2e/<feature>.spec.ts`
2. Test describes **user behavior**, not implementation:
   - Navigate to page
   - Interact (click, type, select, drag)
   - Assert visible outcome (text appears, redirect happens, element state changes)
3. Include mandatory infrastructure assertions (see below)
4. Run test → **MUST fail**
5. Verify it fails for the **RIGHT reason** (page/element missing — not test syntax error)

### GREEN (browser)

1. Implement the feature code
2. Run Playwright test → **MUST pass**
3. Run full test suite (unit + browser) → all green

### REFACTOR

1. Clean up implementation and test code
2. Re-run all tests → still green

## Using Playwright MCP During Test Authoring

While writing the test, the implementer explores interactively to understand the current state and find correct selectors:

| Tool | Purpose |
|---|---|
| `browser_navigate` | Load the page, see what's there |
| `browser_snapshot` | Get DOM state, find correct selectors |
| `browser_click` / `browser_fill_form` | Test interactions manually first |
| `browser_console_messages` | Check for errors during interaction |
| `browser_network_requests` | Verify API calls, check payloads |
| `browser_take_screenshot` | Capture visual state for evidence |

**The MCP tools are the exploratory scratchpad. The `.spec.ts` file is the durable artifact.**

Encode what you verified interactively into the test file. The test must run headlessly in CI without MCP tools.

## Mandatory Assertions

Every browser test file MUST include at least:

### 1. Console-Clean Assertion

```typescript
test('no console errors during <feature> flow', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // ... perform the feature flow ...

  expect(errors).toEqual([]);
});
```

### 2. Network-Health Assertion

```typescript
test('API calls succeed during <feature> flow', async ({ page }) => {
  const failures: string[] = [];
  page.on('response', response => {
    if (response.status() >= 400) {
      failures.push(`${response.status()} ${response.url()}`);
    }
  });

  // ... perform the feature flow ...

  expect(failures).toEqual([]);
});
```

**Missing either of these is an automatic challenge from any reviewer.**

## Selector Best Practices

| Prefer | Avoid | Why |
|---|---|---|
| `data-testid="submit-btn"` | `button.btn-primary` | CSS classes change for styling reasons |
| `getByRole('button', { name: 'Submit' })` | `#submit` | Accessible and resilient |
| `getByText('Welcome back')` | `.header > div:nth-child(2)` | Structural selectors break on layout changes |

## Challenger Attacks on Browser Tests (Phase 3)

**Warrior attacks:**
- "You only tested the happy path — what happens with network failure?"
- "No test for rapid double-submit on the form"
- "What about a 10,000-character input in the name field?"
- "You didn't test with JavaScript disabled / slow network"

**Archer attacks:**
- "Your selector `button[type=submit]` is fragile — use `data-testid`"
- "No assertion on console errors — the feature works but throws warnings"
- "Missing network assertion — you don't verify the POST payload"
- "Tested at desktop width only — what about mobile viewport?"

**Rogue attacks:**
- "What happens if the user is already logged in and hits /register?"
- "No test for XSS in the input fields"
- "What if the API returns 200 but with an error body?"
- "Race condition: what if the user navigates away during submission?"

**Each challenger BOOTS their own app instance** (on their own port via `raid-browser`), runs the tests independently, and verifies they pass without flakiness.

## Running Browser Tests

Use the test command from `.claude/raid.json`:
- Read `project.execCommand` (e.g., `pnpm dlx`, `npx`, `bunx`)
- Run: `{execCommand} playwright test`
- For a specific test: `{execCommand} playwright test tests/e2e/<feature>.spec.ts`

## Test File Organization

```
tests/
  e2e/
    <feature-name>.spec.ts       # One file per feature/flow
    auth/
      login.spec.ts              # Group related flows in directories
      registration.spec.ts
```

## Red Flags

| Thought | Reality |
|---------|---------|
| "The feature is too simple for a browser test" | Simple features break in the browser. If it's user-facing, test it. |
| "I'll add console assertions later" | Later never comes. Add them now. |
| "The unit tests cover this" | Unit tests don't catch hydration mismatches, missing CSS, broken routing. |
| "I tested it manually with MCP tools" | Manual verification isn't reproducible. Write the `.spec.ts`. |
| "Selectors are fine, they work" | They work today. Will they work after a CSS refactor? Use `data-testid`. |
```

- [ ] **Step 2: Verify skill file exists and is well-formed**

Run: `cat template/.claude/skills/raid-browser-playwright/SKILL.md | head -5`
Expected: Shows the frontmatter with `name: raid-browser-playwright`

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
mkdir -p template/.claude/skills/raid-browser-playwright
git add template/.claude/skills/raid-browser-playwright/SKILL.md
git commit -m "feat(skills): add raid-browser-playwright automated test authoring skill"
```

---

## Task 7: Create `raid-browser-chrome` Skill (Live Inspection)

**Files:**
- Create: `template/.claude/skills/raid-browser-chrome/SKILL.md`

- [ ] **Step 1: Write the skill file**

```markdown
---
name: raid-browser-chrome
description: "Claude-in-Chrome live adversarial browser inspection. Angle-driven with minimum coverage gates. Each agent runs own isolated instance. GIF/screenshot evidence required. Invoked from raid-review during Phase 4."
---

# Raid Browser Chrome — Live Adversarial Inspection

Challengers open a real Chrome browser and do adversarial exploratory testing. Each challenger gets their own isolated app instance. Find what automated tests missed.

<HARD-GATE>
Do NOT start inspection without invoking `raid-browser` pre-flight first. Do NOT skip minimum coverage gates. Do NOT share browser instances between agents. Every finding MUST include evidence (GIF, screenshot, console/network output). No subagents.
</HARD-GATE>

## Session Lifecycle Per Challenger

```
1. BOOT(agentId, assignedPort)     ← from raid-browser
2. PRE-FLIGHT(feature)             ← state subject, check auth, discover routes
3. LOGIN (if auth required)        ← fill credentials, verify logged in
4. MINIMUM GATES                   ← console, network, page loads (mandatory)
5. ANGLE-DRIVEN INSPECTION         ← Warrior/Archer/Rogue specific
6. REPORT                          ← findings + evidence pinned to Dungeon
7. CLEANUP(agentId)                ← kill everything
```

## Login Automation (if auth required)

```
1. navigate → loginUrl from raid.json
2. form_input → fill credentials (resolved from .env.raid)
3. click → submit button
4. read_page → verify logged in (check for dashboard, user menu, etc.)

If login fails → pin as CRITICAL finding, skip inspection:
📌 DUNGEON [CRITICAL]: Login failed — cannot test authenticated flows
```

## Minimum Coverage Gates (MANDATORY for every challenger)

Before angle-driven inspection, every challenger MUST complete these checks:

| Check | Tool | Look For |
|---|---|---|
| Console errors | `read_console_messages` | Errors, unhandled promise rejections, deprecation warnings |
| Network failures | `read_network_requests` | 4xx/5xx responses, failed fetches, CORS errors, unexpectedly large payloads |
| Page loads | `navigate` + `read_page` | All relevant pages render without blank screens, hydration mismatches, or missing content |

**Only after ALL gates pass does the challenger proceed to their angle.**

If a gate fails, pin the finding immediately — don't wait for angle inspection.

## Angle-Driven Inspection

### Warrior — Stress & Breakage

Break things. Find what crashes under pressure.

- **Rapid interactions** — click buttons multiple times fast, submit forms repeatedly
- **Large inputs** — paste huge text blocks, upload oversized files, fill numbers with extreme values
- **Navigation abuse** — back/forward rapidly, refresh during submission, deep-link to mid-flow pages
- **Viewport stress** — `resize_window` to mobile (375px), tablet (768px), ultra-wide (1920px) during interactions

Evidence format:
```
⚔️ CHALLENGE: Double-clicking "Place Order" submits two orders.
Console: "Unhandled rejection: duplicate key constraint"
Network: Two POST /api/orders — first returned 201, second returned 500
[GIF: warrior-double-submit.gif]
```

### Archer — Precision, Visual Consistency & Spec Compliance

Every pixel matters. Every pattern must be consistent.

- **Cross-page visual consistency** — same components styled identically across pages? Same button styles, spacing, typography?
- **Design system compliance** — correct tokens, spacing values, color variables?
- **State visual coverage** — hover, focus, active, disabled, loading, error, empty states all visible and correct?
- **Responsive check** — screenshot at 375px (mobile), 768px (tablet), 1280px (desktop), 1920px (ultra-wide) using `resize_window`
- **Dark mode / theme consistency** — if the app supports themes, check both
- **Tab order and keyboard navigation** — complete the flow without a mouse
- **Network efficiency** — redundant API calls? Missing caching? Overfetching data?

Evidence format:
```
🏹 CHALLENGE: Search results page makes 3 identical GET /api/products calls on load.
Network: Duplicate requests at 0ms, 50ms, 120ms — useEffect re-render bug.
Console: "Warning: Cannot update a component while rendering a different component"
[Screenshot: archer-duplicate-fetches.png]
```

### Rogue — Adversarial & Security

Think like an attacker. Find what the developers assumed couldn't happen.

- **XSS probing** — type in every input field:
  - `<script>alert('xss')</script>`
  - `"><img src=x onerror=alert(1)>`
  - `javascript:alert(document.cookie)`
- **Auth boundary testing** — navigate to admin routes as regular user, access other users' data by changing URL IDs
- **API manipulation** — use `javascript_tool` to replay network requests with modified payloads, changed IDs, missing auth headers
- **State corruption** — open multiple tabs, perform conflicting actions simultaneously
- **Data leak inspection** — check network responses for fields that shouldn't be exposed (passwords, tokens, internal IDs, other users' data)

Evidence format:
```
🗡️ CHALLENGE: Changing /api/users/15 to /api/users/16 returns another user's full profile including email and phone.
IDOR vulnerability — no server-side ownership check.
[Screenshot: rogue-idor-leak.png]
```

## Severity Classification

| Finding | Severity |
|---|---|
| Crash, security vulnerability, data loss | **Critical** |
| Layout broken — overlapping, overflowing, hidden elements | **Critical** |
| Broken feature, wrong behavior, missing error handling | **Important** |
| Visual inconsistency — different spacing/colors/fonts across same feature | **Important** |
| Responsive breakage — feature unusable at common breakpoints | **Important** |
| Misalignment with design spec / design doc | **Important** |
| Animation/transition glitch — janky, missing, wrong | **Important** |
| Console warning (non-error) | **Minor** |
| Minor polish — 1px off on a non-primary element | **Minor** |

**Critical and Important block merge. Minor is noted for future.**

## Evidence Requirements

| Severity | Required Evidence |
|---|---|
| Critical | GIF recording of the flow + console log + network request detail |
| Important | Screenshot + console or network detail |
| Minor | Screenshot or console excerpt |

### Evidence Tools

| Tool | Use For |
|---|---|
| `gif_creator` | Record multi-step interaction flows — capture extra frames before/after actions |
| `read_page` / `get_page_text` | Capture DOM state |
| `read_console_messages` | Capture console output — use `pattern` param to filter noise |
| `read_network_requests` | Capture API traffic, payloads, response codes |
| `javascript_tool` | Custom checks: localStorage, cookies, JS state, replay requests |
| `resize_window` | Test responsive behavior at specific widths |

## Cross-Challenger Verification

After all challengers report, they cross-verify findings on their own instances:

- **Can reproduce + confirm:** `🔗 BUILDING ON @Warrior: Confirmed double-submit on port 3002. Also affects payment endpoint.`
- **Cannot reproduce:** `⚔️ CHALLENGE: Could not reproduce @Warrior's double-submit on port 3002. Tried 10 rapid clicks, all debounced. Possible race condition — flaky or env-specific?`
- **Find it's worse:** `🔗 BUILDING ON @Rogue: The IDOR on /api/users also works on /api/orders — any authenticated user can read any order.`

## Dungeon Pinning

```
📌 DUNGEON [CRITICAL]: IDOR vulnerability on /api/users/:id — no ownership check
📌 DUNGEON [IMPORTANT]: Button padding 16px on /settings, 12px on /profile — visual inconsistency
📌 DUNGEON [IMPORTANT]: No loading state on search results — blank screen for 2s on slow network
📌 DUNGEON [MINOR]: Console warning "act() not wrapped" on search page — React testing artifact
```

## Cleanup Iron Law

After inspection completes (or crashes):

```
1. Close all Chrome tabs opened for this agent's URL
2. Kill dev server process on assigned port
3. Kill auxiliary services (edge workers, DB containers, etc.)
4. Verify port is released: lsof -i :{PORT}
5. Remove temp data (test DB, uploaded files, seeded data)

If cleanup fails:
  → Report exactly which ports/processes are still alive
  → Wizard escalates to user IMMEDIATELY
  → Never leave leaked processes on the developer's machine
```

## Red Flags

| Thought | Reality |
|---------|---------|
| "Console warnings are always Minor" | Warnings can indicate real bugs (memory leaks, state issues). Investigate first. |
| "Visual consistency is just polish" | Inconsistent UI erodes user trust. It's Important severity. |
| "I checked the happy path, that's enough" | The happy path is what the developer already tested. Your job is to break it. |
| "I can share a browser with another agent" | Own instance or you corrupt each other's state. No sharing. |
| "Cleanup can wait until the end" | Clean up YOUR instance when YOU'RE done. Don't leave it for others. |
| "Screenshots are optional for Important findings" | No evidence = no finding. Always capture proof. |
```

- [ ] **Step 2: Verify skill file exists and is well-formed**

Run: `cat template/.claude/skills/raid-browser-chrome/SKILL.md | head -5`
Expected: Shows the frontmatter with `name: raid-browser-chrome`

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
mkdir -p template/.claude/skills/raid-browser-chrome
git add template/.claude/skills/raid-browser-chrome/SKILL.md
git commit -m "feat(skills): add raid-browser-chrome live adversarial inspection skill"
```

---

## Task 8: Modify `raid-tdd` Skill — Browser Test Decision Point

**Files:**
- Modify: `template/.claude/skills/raid-tdd/SKILL.md`

- [ ] **Step 1: Read the current file**

Read `template/.claude/skills/raid-tdd/SKILL.md` to confirm current state.

- [ ] **Step 2: Add browser-aware section after "Red-Green-Refactor"**

Insert the following section after the "REFACTOR — Clean Up" subsection (after line 79) and before "Adversarial Test Review":

```markdown
## Browser-Aware TDD (when `browser.enabled` in raid.json)

### Deciding Test Type

Before writing the test, decide: is this a unit test or a browser test?

| Write Browser Test | Write Unit Test Only |
|---|---|
| New user-facing flow (signup, checkout) | Pure utility function |
| UI interaction (drag-drop, modal, form) | API endpoint logic |
| Client-side routing / navigation | Data transformation |
| Visual state changes (loading, error, empty) | Business rule validation |
| Integration between frontend and API | Database queries |

- **If both:** Write the unit test FIRST, then the browser test
- **State your reasoning** — challengers will attack this decision
- **When unsure:** Write the browser test. Better to have it and not need it.

### Browser TDD Cycle

Follow the same RED-GREEN-REFACTOR discipline but with Playwright:

1. **RED:** Write `.spec.ts` with user behavior assertions + console/network checks
2. **Verify RED:** Run `{execCommand} playwright test` — must fail for the RIGHT reason
3. **GREEN:** Implement feature → test passes
4. **Verify GREEN:** Run FULL suite (unit + browser) → all green
5. **REFACTOR:** Clean up → re-run all

Use `raid-browser-playwright` for detailed guidance. Invoke `raid-browser` for pre-flight and boot.

### "Tests pass" = Unit AND Browser Tests

When claiming tests pass, both must pass:
- Unit: test command from `raid.json`
- Browser: `{execCommand} playwright test`
```

- [ ] **Step 3: Add browser-specific attack questions to Adversarial Test Review**

After the existing 5 adversarial review questions (after line 89), add:

```markdown

**Browser-specific attacks (when `browser.enabled`):**

6. **This is a user-facing feature but you only wrote unit tests — where's the browser test?** If the user interacts with it in a browser, it needs a browser test.
7. **Your browser test checks the DOM but doesn't assert on console errors or network health.** Infrastructure assertions are mandatory.
8. **You tested at desktop width only — what about mobile?** Responsive behavior is Important severity.
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add template/.claude/skills/raid-tdd/SKILL.md
git commit -m "feat(skills): add browser-aware TDD section to raid-tdd skill"
```

---

## Task 9: Modify `raid-implementation` Skill — Browser Boot/Cleanup

**Files:**
- Modify: `template/.claude/skills/raid-implementation/SKILL.md`

- [ ] **Step 1: Read the current file**

Read `template/.claude/skills/raid-implementation/SKILL.md` to confirm current state.

- [ ] **Step 2: Add browser setup to Wizard Checklist**

After item 3 in the Wizard Checklist ("Set up worktree"), add:

```markdown
4. **Browser setup (if `browser.enabled` in raid.json)**:
   - Check if `browser.startup` exists — if null, invoke `raid-browser` startup discovery FIRST
   - Check if Playwright is installed — if not, first task becomes "scaffold Playwright"
   - Assign port from `browser.portRange` to implementer
```

Renumber subsequent items (old 4-7 become 5-8).

- [ ] **Step 3: Add browser boot/cleanup to Implementation Gauntlet**

After "Step 2: Implementer Executes (TDD)" section, add a note:

```markdown
**Browser tasks (if `browser.enabled` and task involves browser-facing code):**
- BOOT app on assigned port before browser TDD (invoke `raid-browser`)
- Use Playwright MCP tools to explore while authoring tests
- CLEANUP after task is complete (or on failure — cleanup always runs)
```

After "Step 3: Challengers Attack Directly" section, add:

```markdown
**Browser verification (if `browser.enabled`):**
- Challengers can BOOT on their own ports to run Playwright tests independently
- Verify tests pass without flakiness (run 3x if suspect)
- Explore the feature manually via Playwright MCP to find gaps the tests missed
- Each challenger CLEANUPS their own instance when done
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add template/.claude/skills/raid-implementation/SKILL.md
git commit -m "feat(skills): add browser boot/cleanup to raid-implementation skill"
```

---

## Task 10: Modify `raid-review` Skill — Browser Inspection Phase

**Files:**
- Modify: `template/.claude/skills/raid-review/SKILL.md`

- [ ] **Step 1: Read the current file**

Read `template/.claude/skills/raid-review/SKILL.md` to confirm current state.

- [ ] **Step 2: Add browser inspection section after "The Fight"**

After the "The Fight — Agents Challenge Each Other" section (after line 106), add:

```markdown
## Browser Inspection Phase (when `browser.enabled` in raid.json)

After code review findings are pinned, the Wizard announces browser inspection.

### Process

1. **Wizard announces:** "Browser inspection phase — each reviewer boots their own instance"
2. **Each reviewer BOOTs** their own app instance on separate ports (invoke `raid-browser`)
3. **Each reviewer runs PRE-FLIGHT** — state test subject, check auth, discover routes
4. **Each reviewer LOGINs** if auth is required (credentials from `.env.raid`)
5. **Each reviewer inspects** from their angle (invoke `raid-browser-chrome`):
   - Minimum gates first (console, network, page loads)
   - Then angle-driven exploration (Warrior: stress, Archer: visual/precision, Rogue: security)
   - Evidence captured for every finding (GIF, screenshot, console/network)
6. **Cross-verification** — each reviewer reproduces others' findings on their own instance
7. **Pin browser findings** to Dungeon alongside code review findings
8. **Each reviewer CLEANUPs** their instance
9. **Wizard rules** on ALL findings (code + browser) together

### Browser findings follow the same severity rules:

- **Critical** (crash, security, layout broken) — must fix
- **Important** (broken feature, visual inconsistency, responsive breakage) — must fix
- **Minor** (polish, console warnings) — note for future

**Browser bugs block merge the same way code bugs do.**
```

- [ ] **Step 3: Update Wizard Checklist**

After item 5 ("Close — categorize surviving issues"), insert:

```markdown
6. **Browser inspection** — dispatch agents to inspect in Chrome (if `browser.enabled`)
7. **Observe browser fights** — agents cross-verify findings on separate instances
```

Renumber subsequent items.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add template/.claude/skills/raid-review/SKILL.md
git commit -m "feat(skills): add browser inspection phase to raid-review skill"
```

---

## Task 11: Modify `raid-verification` and `raid-finishing` Skills

**Files:**
- Modify: `template/.claude/skills/raid-verification/SKILL.md`
- Modify: `template/.claude/skills/raid-finishing/SKILL.md`

- [ ] **Step 1: Add browser verification to `raid-verification`**

After the "Common Failures" table (after line 55), add:

```markdown
### Browser Verification (when `browser.enabled` in raid.json)

"Tests pass" means BOTH unit and browser tests pass:

| Claim | Requires |
|---|---|
| "Tests pass" | Unit test command output: 0 failures AND `{execCommand} playwright test`: 0 failures |
| "Feature complete" | All acceptance criteria verified WITH browser test evidence |

If the project's test command doesn't include Playwright, the agent MUST run it separately and report both results.
```

- [ ] **Step 2: Add browser cleanup to `raid-finishing`**

After "Step 2: Final Verification" section (after line 75), add:

```markdown
### Browser Verification (when `browser.enabled` in raid.json)

Additional final checks:
- Full Playwright test suite passes headlessly
- Verify no leaked processes from prior browser sessions
- Verify all ports in `browser.portRange` are free (`lsof -i :PORT`)
- Agents debate: "Are browser tests sufficient for this feature's coverage?"
```

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add template/.claude/skills/raid-verification/SKILL.md template/.claude/skills/raid-finishing/SKILL.md
git commit -m "feat(skills): add browser verification to raid-verification and raid-finishing"
```

---

## Task 12: Update Existing Tests for Backward Compatibility

**Files:**
- Modify: `tests/cli/detect-project.test.js`

- [ ] **Step 1: Verify existing tests still pass after all changes**

Run: `npm test`
Expected: All existing tests pass. The key concern is that existing `detectProject` tests still work because:
- Projects without lockfiles default to `npm` (existing `npm test` commands unchanged)
- Projects without browser frameworks get `browser: null`
- Rust/Go projects get no `packageManager` field

If any existing test fails, fix the test to match the new return shape (e.g., add `browser: null` to expected results if assertions check object shape).

- [ ] **Step 2: Run full test suite one final time**

Run: `npm test`
Expected: ALL tests pass — old and new

- [ ] **Step 3: Commit any test fixes if needed**

```bash
git add tests/
git commit -m "test: update existing tests for browser detection compatibility"
```

---

## Summary

| Task | What | Files |
|---|---|---|
| 1 | Package manager detection | `src/detect-package-manager.js`, tests |
| 2 | Browser framework detection | `src/detect-browser.js`, tests |
| 3 | Integrate into `detect-project.js` | `src/detect-project.js`, tests |
| 4 | Update `init.js` for browser config | `src/init.js`, tests |
| 5 | `raid-browser` skill | `template/.claude/skills/raid-browser/SKILL.md` |
| 6 | `raid-browser-playwright` skill | `template/.claude/skills/raid-browser-playwright/SKILL.md` |
| 7 | `raid-browser-chrome` skill | `template/.claude/skills/raid-browser-chrome/SKILL.md` |
| 8 | Update `raid-tdd` | Browser test decision point |
| 9 | Update `raid-implementation` | Browser boot/cleanup |
| 10 | Update `raid-review` | Browser inspection phase |
| 11 | Update `raid-verification` + `raid-finishing` | Browser in "tests pass" |
| 12 | Backward compatibility check | Existing test updates |

**Deferred (pending hook agent):** Hook changes for `validate-tests-pass.sh`, `validate-browser-cleanup.sh`, `validate-browser-tests-exist.sh`.
