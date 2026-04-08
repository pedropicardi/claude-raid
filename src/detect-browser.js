'use strict';

const fs = require('fs');
const path = require('path');

// Single-file detectors: first matching variant wins
const SINGLE_FILE_DETECTORS = [
  {
    variants: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    framework: 'next',
    devCommand: (run) => `${run} dev`,
    defaultPort: 3000,
  },
  {
    variants: ['nuxt.config.ts', 'nuxt.config.js'],
    framework: 'nuxt',
    devCommand: (run) => `${run} dev`,
    defaultPort: 3000,
  },
  {
    variants: ['remix.config.js', 'remix.config.ts'],
    framework: 'remix',
    devCommand: (run) => `${run} dev`,
    defaultPort: 3000,
  },
  {
    variants: ['svelte.config.js', 'svelte.config.ts'],
    framework: 'svelte',
    devCommand: (run) => `${run} dev`,
    defaultPort: 5173,
  },
  {
    variants: ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'],
    framework: 'vite',
    devCommand: (run) => `${run} dev`,
    defaultPort: 5173,
  },
  {
    variants: ['angular.json'],
    framework: 'angular',
    devCommand: () => 'ng serve',
    defaultPort: 4200,
  },
  {
    variants: ['astro.config.mjs', 'astro.config.js', 'astro.config.ts'],
    framework: 'astro',
    devCommand: (run) => `${run} dev`,
    defaultPort: 4321,
  },
  {
    variants: ['gatsby-config.js', 'gatsby-config.ts'],
    framework: 'gatsby',
    devCommand: (run) => `${run} develop`,
    defaultPort: 8000,
  },
  {
    variants: ['manage.py'],
    framework: 'django',
    devCommand: () => 'python manage.py runserver',
    defaultPort: 8000,
  },
  {
    variants: ['trunk.toml'],
    framework: 'trunk',
    devCommand: () => 'trunk serve',
    defaultPort: 8080,
  },
];

// Multi-file detectors: ALL listed files must exist
const MULTI_FILE_DETECTORS = [
  {
    files: ['webpack.config.js', 'index.html'],
    framework: 'webpack',
    devCommand: (run) => `${run} dev`,
    defaultPort: 8080,
  },
];

// Content-checked detectors: file must exist AND contain a marker string
const CONTENT_DETECTORS = [
  {
    file: 'app.py',
    markers: ['flask', 'Flask'],
    framework: 'flask',
    devCommand: () => 'flask run',
    defaultPort: 5000,
  },
];

// Directory+file detectors: the nested path must exist
const DIR_FILE_DETECTORS = [
  {
    filePath: path.join('app', 'root.tsx'),
    framework: 'remix',
    devCommand: (run) => `${run} dev`,
    defaultPort: 3000,
  },
];

function detectBrowser(cwd, runCommand) {
  // Check single-file detectors (first match wins)
  for (const detector of SINGLE_FILE_DETECTORS) {
    for (const variant of detector.variants) {
      if (fs.existsSync(path.join(cwd, variant))) {
        return {
          detected: true,
          framework: detector.framework,
          devCommand: detector.devCommand(runCommand),
          defaultPort: detector.defaultPort,
        };
      }
    }
  }

  // Check content-based detectors (file must exist and contain marker)
  for (const detector of CONTENT_DETECTORS) {
    const filePath = path.join(cwd, detector.file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (detector.markers.some(m => content.includes(m))) {
          return {
            detected: true,
            framework: detector.framework,
            devCommand: detector.devCommand(runCommand),
            defaultPort: detector.defaultPort,
          };
        }
      } catch {
        // Unreadable file, skip
      }
    }
  }

  // Check multi-file detectors (all files must exist)
  for (const detector of MULTI_FILE_DETECTORS) {
    const allExist = detector.files.every((f) => fs.existsSync(path.join(cwd, f)));
    if (allExist) {
      return {
        detected: true,
        framework: detector.framework,
        devCommand: detector.devCommand(runCommand),
        defaultPort: detector.defaultPort,
      };
    }
  }

  // Check directory+file detectors
  for (const detector of DIR_FILE_DETECTORS) {
    if (fs.existsSync(path.join(cwd, detector.filePath))) {
      return {
        detected: true,
        framework: detector.framework,
        devCommand: detector.devCommand(runCommand),
        defaultPort: detector.defaultPort,
      };
    }
  }

  return null;
}

module.exports = { detectBrowser };
