'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PKG_NAME = 'claude-raid';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TIMEOUT_MS = 3000;

function getCachePath() {
  return path.join(os.tmpdir(), 'claude-raid-version-check.json');
}

function readCache(cachePath) {
  try {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (Date.now() - data.timestamp < CACHE_TTL_MS) {
      return data.latest;
    }
  } catch {
    // Cache missing, corrupt, or expired
  }
  return null;
}

function writeCache(cachePath, latest) {
  try {
    fs.writeFileSync(cachePath, JSON.stringify({ latest, timestamp: Date.now() }));
  } catch {
    // Non-critical — skip silently
  }
}

function fetchLatestVersion() {
  return new Promise((resolve) => {
    const req = https.get(
      `https://registry.npmjs.org/${PKG_NAME}/latest`,
      { timeout: TIMEOUT_MS },
      (res) => {
        if (res.statusCode !== 200) {
          resolve(null);
          res.resume();
          return;
        }
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const { version } = JSON.parse(body);
            resolve(version || null);
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function getLocalVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return null;
  }
}

function isNewer(latest, current) {
  if (!latest || !current) return false;
  const l = latest.split('.').map(Number);
  const c = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

/**
 * Start a non-blocking version check. Returns a function that,
 * when called, prints an update notice if a newer version is available.
 * Call start() at the beginning of CLI execution, call the returned
 * function at the end.
 */
function start() {
  const current = getLocalVersion();
  if (!current) return () => {};

  const cachePath = getCachePath();
  const cached = readCache(cachePath);

  // If cache hit, return synchronous check
  if (cached) {
    return (colors) => {
      if (isNewer(cached, current)) {
        printNotice(colors, current, cached);
      }
    };
  }

  // Otherwise, fire async fetch
  const pending = fetchLatestVersion().then((latest) => {
    if (latest) writeCache(cachePath, latest);
    return latest;
  });

  return async (colors) => {
    const latest = await pending;
    if (latest && isNewer(latest, current)) {
      printNotice(colors, current, latest);
    }
  };
}

function printNotice(colors, current, latest) {
  if (!colors) {
    console.log(`\n  A new version is available: ${current} → ${latest}`);
    console.log(`  Run npx claude-raid@latest summon to upgrade\n`);
    return;
  }
  console.log(`\n  ${colors.amber('⚔')} A new version is available: ${colors.dim(current)} → ${colors.green(latest)}`);
  console.log(`    Run ${colors.bold('npx claude-raid@latest summon')} to upgrade\n`);
}

module.exports = { start, getLocalVersion, isNewer, readCache, writeCache, getCachePath, fetchLatestVersion };
