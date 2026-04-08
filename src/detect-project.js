'use strict';

const fs = require('fs');
const path = require('path');

const DETECTORS = [
  {
    file: 'package.json',
    language: 'javascript',
    detect(cwd) {
      const pkgPath = path.join(cwd, 'package.json');
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const scripts = pkg.scripts || {};
        return {
          language: 'javascript',
          testCommand: scripts.test ? 'npm test' : '',
          lintCommand: scripts.lint ? 'npm run lint' : '',
          buildCommand: scripts.build ? 'npm run build' : '',
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
    detect(cwd) {
      try {
        const content = fs.readFileSync(path.join(cwd, 'pyproject.toml'), 'utf8');
        const usesPoetry = content.includes('[tool.poetry]');
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
      detected.push(detector.detect(cwd));
    }
  }

  if (detected.length === 0) {
    return {
      language: 'unknown',
      testCommand: '',
      lintCommand: '',
      buildCommand: '',
      name: path.basename(cwd),
      detected: [],
    };
  }

  const primary = detected[0];
  primary.detected = detected;
  return primary;
}

module.exports = { detectProject };
