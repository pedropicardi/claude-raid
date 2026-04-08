# Distribution Strategy — Design Specification

**Date:** 2026-04-08
**Status:** Approved
**Author:** Pedro Picardi + Claude

## Problem Statement

`claude-raid` is built and tested locally but has no distribution pipeline. It needs to be published to npm so `npx claude-raid init` works globally, and future releases need to be automated so every merged PR produces a new version without manual steps.

## Requirements

1. Publish v0.1.0 to npm manually (one-time bootstrap)
2. GitHub Actions workflow that runs on every push to `main`
3. CI runs tests — failed tests block publish
4. CI auto-bumps patch version (0.1.0 -> 0.1.1 -> 0.1.2)
5. CI publishes to npm after successful tests
6. CI pushes version bump commit + tag back to repo
7. CI creates a GitHub Release from the tag
8. Manual minor/major bumps supported by editing `package.json` in the PR

## Constraints

- Single workflow file (`.github/workflows/publish.yml`)
- Requires `NPM_TOKEN` secret in GitHub repo settings
- Node.js 18 for CI
- No PR-level CI (tests run locally, CI only on main after merge)
- Version bump commit must not re-trigger the workflow (infinite loop prevention)

## Design

### 1. Manual Initial Publish

Run `npm publish` locally to bootstrap v0.1.0 on npm. One-time action.

### 2. GitHub Actions Workflow

**File:** `.github/workflows/publish.yml`

**Trigger:** Push to `main`, but skip if the commit message contains `[skip ci]` or is from the CI bot (prevents infinite loop from version bump commits).

**Steps:**
1. Checkout code with full history (for git push back)
2. Setup Node.js 18
3. Configure npm auth with `NPM_TOKEN`
4. Install dependencies (none currently, but future-proof)
5. Run tests: `node --test tests/**/*.test.js`
6. Configure git user for the bump commit
7. Bump patch version: `npm version patch -m "chore(release): v%s [skip ci]"`
8. Publish: `npm publish`
9. Push version bump commit + tag back to main
10. Create GitHub Release from the new tag

**Infinite loop prevention:** The `npm version` command creates a commit with message `chore(release): v0.1.1 [skip ci]`. The workflow has a condition that skips runs when the commit message contains `[skip ci]`.

### 3. Manual Minor/Major Bumps

When a breaking change or new feature warrants a minor or major bump:
1. Update `version` in `package.json` in your PR (e.g., `0.2.0` or `1.0.0`)
2. Merge the PR
3. CI detects the version is already different from npm, publishes it, and continues patch-bumping from there

### 4. NPM Token Setup

1. Go to npmjs.com -> Access Tokens -> Generate New Token (Automation type)
2. Copy the token
3. Go to GitHub repo Settings -> Secrets -> Actions -> New repository secret
4. Name: `NPM_TOKEN`, Value: the token
