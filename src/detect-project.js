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
      // For pnpm/yarn/bun the runCommand is just the pm name (e.g. 'pnpm'),
      // so 'pnpm test' is correct. For npm the runCommand is 'npm run',
      // so we special-case 'npm run test' -> 'npm test'.
      const testCmd = (run === 'npm run') ? 'npm test' : `${run} test`;
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const scripts = pkg.scripts || {};
        return {
          language: 'javascript',
          testCommand: scripts.test ? testCmd : '',
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
      try {
        const content = fs.readFileSync(path.join(cwd, 'pyproject.toml'), 'utf8');
        const usesPoetry = content.includes('[tool.poetry]');
        // If a pm is provided (uv or poetry), use its runCommand
        if (pm && pm.packageManager === 'uv') {
          return {
            language: 'python',
            testCommand: 'uv run pytest',
            lintCommand: 'uv run ruff check .',
            buildCommand: 'uv run python -m build',
            name: path.basename(cwd),
          };
        }
        if (pm && pm.packageManager === 'poetry') {
          return {
            language: 'python',
            testCommand: 'poetry run pytest',
            lintCommand: 'poetry run ruff check .',
            buildCommand: 'poetry build',
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
    detect(cwd) {
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
      const entry = detector.detect(cwd, pm);
      if (pm) {
        entry.packageManager = pm.packageManager;
        entry.runCommand = pm.runCommand;
        entry.execCommand = pm.execCommand;
        entry.installCommand = pm.installCommand;
      }
      detected.push(entry);
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
  // Use the primary entry's runCommand for browser detection, fall back to 'npm run'
  const primaryRunCommand = primary.runCommand || 'npm run';
  primary.browser = detectBrowser(cwd, primaryRunCommand);
  primary.detected = detected;
  return primary;
}

module.exports = { detectProject };
