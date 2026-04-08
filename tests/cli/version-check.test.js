'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { isNewer, readCache, writeCache, getLocalVersion } = require('../../src/version-check');

let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raid-vc-'));
  return tmpDir;
}

describe('version-check', () => {
  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  });

  describe('isNewer', () => {
    it('returns true when latest is a higher major', () => {
      assert.strictEqual(isNewer('2.0.0', '1.0.0'), true);
    });

    it('returns true when latest is a higher minor', () => {
      assert.strictEqual(isNewer('1.2.0', '1.1.0'), true);
    });

    it('returns true when latest is a higher patch', () => {
      assert.strictEqual(isNewer('1.0.2', '1.0.1'), true);
    });

    it('returns false when versions are equal', () => {
      assert.strictEqual(isNewer('1.0.0', '1.0.0'), false);
    });

    it('returns false when current is newer', () => {
      assert.strictEqual(isNewer('1.0.0', '2.0.0'), false);
    });

    it('returns false when latest is null', () => {
      assert.strictEqual(isNewer(null, '1.0.0'), false);
    });

    it('returns false when current is null', () => {
      assert.strictEqual(isNewer('1.0.0', null), false);
    });
  });

  describe('cache', () => {
    it('writes and reads a cached version', () => {
      const dir = makeTempDir();
      const cachePath = path.join(dir, 'cache.json');
      writeCache(cachePath, '2.0.0');
      const result = readCache(cachePath);
      assert.strictEqual(result, '2.0.0');
    });

    it('returns null for missing cache file', () => {
      const dir = makeTempDir();
      const cachePath = path.join(dir, 'nonexistent.json');
      assert.strictEqual(readCache(cachePath), null);
    });

    it('returns null for expired cache', () => {
      const dir = makeTempDir();
      const cachePath = path.join(dir, 'cache.json');
      const expired = { latest: '2.0.0', timestamp: Date.now() - (25 * 60 * 60 * 1000) };
      fs.writeFileSync(cachePath, JSON.stringify(expired));
      assert.strictEqual(readCache(cachePath), null);
    });

    it('returns null for corrupt cache', () => {
      const dir = makeTempDir();
      const cachePath = path.join(dir, 'cache.json');
      fs.writeFileSync(cachePath, 'not json');
      assert.strictEqual(readCache(cachePath), null);
    });
  });

  describe('getLocalVersion', () => {
    it('returns a semver string', () => {
      const version = getLocalVersion();
      assert.ok(version);
      assert.ok(/^\d+\.\d+\.\d+/.test(version));
    });
  });
});
