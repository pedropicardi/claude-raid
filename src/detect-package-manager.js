'use strict';

const fs = require('fs');
const path = require('path');

const JS_LOCKFILES = [
  {
    file: 'pnpm-lock.yaml',
    packageManager: 'pnpm',
    runCommand: 'pnpm',
    execCommand: 'pnpm dlx',
    installCommand: 'pnpm add',
  },
  {
    file: 'yarn.lock',
    packageManager: 'yarn',
    runCommand: 'yarn',
    execCommand: 'yarn dlx',
    installCommand: 'yarn add',
  },
  {
    file: 'bun.lockb',
    packageManager: 'bun',
    runCommand: 'bun',
    execCommand: 'bunx',
    installCommand: 'bun add',
  },
  {
    file: 'bun.lock',
    packageManager: 'bun',
    runCommand: 'bun',
    execCommand: 'bunx',
    installCommand: 'bun add',
  },
  {
    file: 'package-lock.json',
    packageManager: 'npm',
    runCommand: 'npm run',
    execCommand: 'npx',
    installCommand: 'npm install',
  },
];

const PYTHON_LOCKFILES = [
  {
    file: 'uv.lock',
    packageManager: 'uv',
    runCommand: 'uv run',
    execCommand: 'uvx',
    installCommand: 'uv add',
  },
  {
    file: 'poetry.lock',
    packageManager: 'poetry',
    runCommand: 'poetry run',
    execCommand: 'poetry run',
    installCommand: 'poetry add',
  },
];

const JS_FALLBACK = {
  packageManager: 'npm',
  runCommand: 'npm run',
  execCommand: 'npx',
  installCommand: 'npm install',
};

const PYTHON_FALLBACK = {
  packageManager: 'pip',
  runCommand: 'python -m',
  execCommand: 'python -m',
  installCommand: 'pip install',
};

function detectPackageManager(cwd, language) {
  if (language === 'javascript') {
    for (const entry of JS_LOCKFILES) {
      if (fs.existsSync(path.join(cwd, entry.file))) {
        return {
          packageManager: entry.packageManager,
          runCommand: entry.runCommand,
          execCommand: entry.execCommand,
          installCommand: entry.installCommand,
        };
      }
    }
    return { ...JS_FALLBACK };
  }

  if (language === 'python') {
    for (const entry of PYTHON_LOCKFILES) {
      if (fs.existsSync(path.join(cwd, entry.file))) {
        return {
          packageManager: entry.packageManager,
          runCommand: entry.runCommand,
          execCommand: entry.execCommand,
          installCommand: entry.installCommand,
        };
      }
    }
    return { ...PYTHON_FALLBACK };
  }

  return null;
}

module.exports = { detectPackageManager };
