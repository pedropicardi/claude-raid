# Browser Testing Integration for The Raid

**Date:** 2026-04-08
**Status:** Approved Design
**Scope:** Three new skills, detection updates, init updates, existing skill modifications

## Overview

Add browser testing capabilities to The Raid workflow for browser-based projects. Two tools work in tandem:

- **Playwright MCP** for automated test authoring during Phase 3 TDD
- **Claude-in-Chrome** for live adversarial inspection during Phase 4 Review

Each agent gets full instance isolation — own port, own dev server, own browser — to prevent stepping on each other's toes.

## Architecture

### Three New Skills

| Skill | Purpose | Invoked By |
|---|---|---|
| `raid-browser` | Core orchestration: startup discovery, boot/cleanup lifecycle, port isolation, pre-flight checks | `raid-browser-playwright`, `raid-browser-chrome` |
| `raid-browser-playwright` | Automated browser test authoring. Extends TDD RED-GREEN-REFACTOR with `.spec.ts` files | `raid-tdd`, `raid-implementation` (Phase 3) |
| `raid-browser-chrome` | Live adversarial Chrome inspection. Angle-driven with evidence capture | `raid-review` (Phase 4) |

### Workflow Integration Points

```
Phase 3 (Implementation):
  raid-tdd ──► if browser-facing code ──► raid-browser-playwright
                                              │
                                              ▼
                                         raid-browser (BOOT/CLEANUP)

Phase 4 (Review):
  raid-review ──► after code review ──► raid-browser-chrome
                                              │
                                              ▼
                                         raid-browser (BOOT/CLEANUP per agent)
```

---

## 1. Package Manager Detection

### Detection Logic (in `detect-project.js`)

Runs FIRST, before language and browser detection, since it informs all command generation.

| Marker | Package Manager | Run Command | Exec Command | Install Command |
|---|---|---|---|---|
| `pnpm-lock.yaml` | pnpm | `pnpm` | `pnpm dlx` | `pnpm add` |
| `yarn.lock` | yarn | `yarn` | `yarn dlx` | `yarn add` |
| `bun.lockb` / `bun.lock` | bun | `bun` | `bunx` | `bun add` |
| `package-lock.json` | npm | `npm run` | `npx` | `npm install` |
| `uv.lock` | uv | `uv run` | `uvx` | `uv add` |
| `poetry.lock` | poetry | `poetry run` | `poetry run` | `poetry add` |
| (fallback Python) | pip | `python -m` | `python -m` | `pip install` |
| (fallback JS) | npm | `npm run` | `npx` | `npm install` |

Detection order: check lockfiles first (most specific), fall back to defaults per language.

### Multi-Language Awareness

The existing `detected[]` array already captures all languages. Package manager detection runs per language — a project with `pnpm-lock.yaml` + `uv.lock` gets `pnpm` for JS and `uv` for Python. Each entry in `detected[]` includes its own package manager info.

---

## 2. Browser Framework Detection

### Detection Logic (in `detect-project.js`)

Runs after package manager and language detection. Scans across ALL detected languages.

| Marker File | Framework | Default Dev Command | Default Port |
|---|---|---|---|
| `next.config.*` | Next.js | `{runCmd} dev` | 3000 |
| `vite.config.*` | Vite | `{runCmd} dev` | 5173 |
| `angular.json` | Angular | `ng serve` | 4200 |
| `svelte.config.*` | SvelteKit | `{runCmd} dev` | 5173 |
| `nuxt.config.*` | Nuxt | `{runCmd} dev` | 3000 |
| `remix.config.*` / `app/root.tsx` | Remix | `{runCmd} dev` | 3000 |
| `astro.config.*` | Astro | `{runCmd} dev` | 4321 |
| `webpack.config.*` + `index.html` | Webpack SPA | `{runCmd} dev` | 8080 |
| `gatsby-config.*` | Gatsby | `{runCmd} develop` | 8000 |
| `manage.py` | Django | `python manage.py runserver` | 8000 |
| `app.py` + Flask markers | Flask | `flask run` | 5000 |
| `trunk.toml` | Yew/Leptos (Rust) | `trunk serve` | 8080 |

`{runCmd}` is resolved from the detected package manager.

### Detection Output Shape

```js
{
  name: 'my-app',
  language: 'javascript',
  packageManager: 'pnpm',
  runCommand: 'pnpm',
  execCommand: 'pnpm dlx',
  installCommand: 'pnpm add',
  testCommand: 'pnpm test',
  lintCommand: 'pnpm lint',
  buildCommand: 'pnpm build',
  browser: {
    detected: true,
    framework: 'next',
    devCommand: 'pnpm dev',
    defaultPort: 3000
  },
  detected: [
    { language: 'javascript', packageManager: 'pnpm', ... },
    { language: 'python', packageManager: 'uv', ... }
  ]
}
```

---

## 3. Configuration (`raid.json`)

### Updated Full Shape

```json
{
  "project": {
    "name": "my-app",
    "language": "javascript",
    "packageManager": "pnpm",
    "runCommand": "pnpm",
    "execCommand": "pnpm dlx",
    "installCommand": "pnpm add",
    "testCommand": "pnpm test",
    "lintCommand": "pnpm lint",
    "buildCommand": "pnpm build"
  },
  "browser": {
    "enabled": true,
    "framework": "next",
    "devCommand": "pnpm dev",
    "baseUrl": "http://localhost:3000",
    "defaultPort": 3000,
    "portRange": [3001, 3005],
    "playwrightConfig": "playwright.config.ts",
    "auth": null,
    "startup": null
  },
  "paths": {
    "specs": "docs/raid/specs",
    "plans": "docs/raid/plans",
    "worktrees": ".worktrees"
  },
  "conventions": {
    "fileNaming": "none",
    "commits": "conventional",
    "commitMinLength": 15,
    "maxDepth": 8
  },
  "raid": {
    "defaultMode": "full"
  }
}
```

### `browser.auth` (populated by agents when auth detected)

```json
"auth": {
  "required": true,
  "method": "cookie-session",
  "loginUrl": "/login",
  "credentials": {
    "default": { "email": "test@example.com", "password": "..." },
    "admin": { "email": "admin@example.com", "password": "..." }
  },
  "seedCommand": "pnpm db:seed-test-users"
}
```

Credentials MUST be stored in `.env.raid` (not in `raid.json`). The `raid.json` auth section stores only the structure (method, loginUrl, seedCommand, role names). Actual secrets are env var references:

```json
"credentials": {
  "default": { "email": "$RAID_TEST_EMAIL", "password": "$RAID_TEST_PASSWORD" },
  "admin": { "email": "$RAID_ADMIN_EMAIL", "password": "$RAID_ADMIN_PASSWORD" }
}
```

`claude-raid init` adds `.env.raid` to `.gitignore` automatically.

### `browser.startup` (populated by agents on first browser session)

```json
"startup": {
  "env": { "DATABASE_URL": "postgresql://localhost:5432/test_{{PORT}}" },
  "services": [
    { "name": "db", "command": "docker compose up -d postgres" },
    { "name": "edge", "command": "wrangler dev --port {{EDGE_PORT}}" },
    { "name": "app", "command": "pnpm dev --port {{PORT}}" }
  ],
  "readyCheck": "curl -s http://localhost:{{PORT}}/api/health",
  "cleanup": ["kill {{PID}}", "docker compose down"]
}
```

Template variables (`{{PORT}}`, `{{EDGE_PORT}}`, `{{PID}}`) are resolved per-agent at runtime.

---

## 4. `claude-raid init` Changes

After existing language detection, two new steps:

1. **Detect package manager** — Pre-fill all commands with correct runner
2. **Detect browser framework** — If found, prompt user:
   ```
   Detected Next.js project with pnpm.
   Enable browser testing? (Y/n)
   ```
   If yes:
   ```
   Default dev server port? (3000)
   Base URL? (http://localhost:3000)
   ```

Browser section written to `raid.json` with `auth: null` and `startup: null` — agents discover and populate these on first session.

---

## 5. Skill: `raid-browser` (Core Orchestration)

### Purpose

Shared infrastructure for browser testing: startup discovery, boot/cleanup lifecycle, port allocation, pre-flight checks.

### Startup Discovery Protocol

Invoked when `browser.startup` is `null` in `raid.json`. The Wizard assigns one agent to investigate:

1. **Read project config** — `package.json` scripts, `.env.example`, `.env.local.example`, `docker-compose.yml`, `wrangler.toml`, `vercel.json`, `netlify.toml`, `Procfile`
2. **Read README** — "Getting Started", "Development", "Running locally" sections
3. **Map runtime topology** — Identify every process needed:
   - Primary dev server
   - API servers / backend processes
   - Edge workers (Cloudflare, Vercel Edge)
   - Databases (Postgres, MySQL, Redis, SQLite)
   - Message queues, search engines
   - Seed/migration scripts
4. **Identify environment variables** — Which need to differ per instance (DB names, ports), which are shared (API keys)
5. **Test the recipe** — Boot on non-default port, run health check, tear down
6. **Pin to Dungeon** — `📌 DUNGEON: Startup recipe verified`
7. **Write to `raid.json`** — Populate `startup` field

Challengers attack the recipe: cleanup completeness, failure modes, port conflicts, stale PIDs.

### Pre-Flight Checks (mandatory before every browser session)

#### 1. Test Subject Clarity (HARD GATE)

Before any browser action, the agent states:

```
📋 BROWSER TEST SUBJECT:
- Feature: "User registration flow"
- Scope: "Form validation, submission, redirect to dashboard"
- Success criteria: "User can register, sees dashboard, session persists on refresh"
- Out of scope: "Email verification, password reset"
```

If the agent cannot clearly state the test subject, the Wizard asks the user:

```
⚡ WIZARD → USER: "What specific user flow should we verify in the browser?"
```

#### 2. Authentication Check

Agent investigates auth setup (middleware, login pages, session config, protected routes). If auth is required and no test credentials exist:

```
⚡ WIZARD → USER: "This app requires authentication. I need:
  1. Test user credentials or a method to create them
  2. Are there different roles to test? (admin, user, guest)
  3. Is there a seed script that creates test users?"
```

Credentials stored in `raid.json` under `browser.auth`.

#### 3. Route/Page Discovery

After boot, map relevant pages: URLs involved, navigation flow, loading states, redirects, client-side routing. Pinned to Dungeon as verified context.

### Boot/Cleanup Lifecycle

```
BOOT(agentId, port):
  1. Resolve template variables from portRange
  2. Set per-instance env vars
  3. Start services in order (respecting dependencies)
  4. Wait for readyCheck to pass (with timeout)
  5. Return { pid[], port, baseUrl }

CLEANUP(agentId):
  1. Kill all PIDs tracked for this agent (SIGTERM, then SIGKILL after 5s)
  2. Run cleanup commands from config
  3. Verify ports are released (lsof -i :PORT)
  4. Remove temp files/DBs created for this instance
```

**Iron law: Every BOOT has a matching CLEANUP.** If a test crashes, cleanup still runs. Leaked processes are never acceptable.

### Port Allocation

| Mode | Agents | Ports |
|---|---|---|
| Full Raid | 3 challengers | portRange[0], [1], [2] |
| Skirmish | 2 agents | portRange[0], [1] |
| Scout | 1 agent | portRange[0] |

Phase 3: implementer gets `portRange[0]`. Phase 4: each challenger gets their own.

---

## 6. Skill: `raid-browser-playwright` (Automated Test Authoring)

### Purpose

Extend TDD RED-GREEN-REFACTOR with Playwright browser tests during Phase 3. The implementer writes `.spec.ts` files as durable test artifacts, using Playwright MCP tools as an exploratory scratchpad during authoring.

### When to Write Browser Tests vs Unit Tests

| Write Browser Test | Write Unit Test Only |
|---|---|
| New user-facing flow (signup, checkout) | Pure utility function |
| UI interaction (drag-drop, modal, form) | API endpoint logic |
| Client-side routing / navigation | Data transformation |
| Visual state changes (loading, error, empty) | Business rule validation |
| Integration between frontend and API | Database queries |

Implementer states reasoning. Challengers attack this decision.

### Browser TDD Cycle

```
RED (browser):
  1. Write Playwright test: tests/e2e/<feature>.spec.ts
  2. Test describes user behavior, not implementation
  3. Include console + network assertions (mandatory)
  4. Run test → MUST fail
  5. Verify failure is for the RIGHT reason (missing feature, not syntax error)

GREEN (browser):
  1. Implement the feature
  2. Run Playwright test → MUST pass
  3. Run full suite (unit + browser) → all green

REFACTOR:
  1. Clean up implementation
  2. Re-run all tests → still green
```

### Using Playwright MCP During Authoring

While writing tests, the implementer explores interactively:

1. `browser_navigate` — Load page, see what's there
2. `browser_snapshot` — Get DOM state, find correct selectors
3. `browser_click` / `browser_fill_form` — Test interactions manually
4. `browser_console_messages` — Check for errors during interaction
5. `browser_network_requests` — Verify API calls
6. `browser_take_screenshot` — Capture visual state for evidence

Then encode verified interactions into the `.spec.ts` file.

### Mandatory Assertions

Every browser test file MUST include:

- **Console-clean assertion** — No console errors during the flow
- **Network-health assertion** — Expected API calls succeed, no unexpected failures

```typescript
test('no console errors during registration flow', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/register');
  await page.fill('[name="email"]', 'test@test.com');
  await page.fill('[name="password"]', 'Pass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');

  expect(errors).toEqual([]);
});
```

### Challenger Attacks on Browser Tests

**Warrior:** Happy path only? Double-submit? Huge inputs? Network failure?

**Archer:** Fragile selectors? Missing console assertions? No network payload verification? Desktop-only?

**Rogue:** Auth edge cases? XSS in inputs? API returning 200 with error body? Race conditions?

Each challenger BOOTS their own app instance, runs the tests independently, and verifies they pass without flakiness.

---

## 7. Skill: `raid-browser-chrome` (Live Challenger Inspection)

### Purpose

Adversarial exploratory testing in a real Chrome browser during Phase 4 Review. Each challenger gets their own isolated app instance.

### Session Lifecycle Per Challenger

```
1. BOOT(agentId, assignedPort)
2. PRE-FLIGHT(feature) — state subject, check auth, discover routes
3. LOGIN (if auth required) — navigate to loginUrl, fill credentials, verify
4. INSPECT (angle-driven with minimum gates)
5. REPORT (findings + evidence pinned to Dungeon)
6. CLEANUP(agentId)
```

### Minimum Coverage Gates (mandatory for every challenger)

| Check | Tool | What to Look For |
|---|---|---|
| Console errors | `read_console_messages` | Errors, unhandled rejections, deprecation warnings |
| Network failures | `read_network_requests` | 4xx/5xx, failed fetches, CORS errors, large payloads |
| Page loads | `navigate` + `read_page` | All relevant pages render, no blank screens or hydration mismatches |

Only after these gates pass does the challenger proceed to their angle.

### Angle-Driven Inspection

**Warrior — Stress & Breakage:**
- Rapid interactions (double-click, multi-submit)
- Large inputs, oversized uploads
- Navigation abuse (back/forward, refresh during submission)
- Viewport stress (`resize_window` to mobile, tablet, ultra-wide)
- Record GIF of each breaking scenario

**Archer — Precision, Visual Consistency & Spec Compliance:**
- Cross-page visual consistency (same components styled identically)
- Design system compliance (correct tokens, spacing, typography)
- State visual coverage (hover, focus, active, disabled, loading, error, empty states)
- Responsive check — screenshot at 375px, 768px, 1280px, 1920px
- Dark mode / theme consistency (if applicable)
- Tab order and keyboard navigation
- Network efficiency (redundant calls, missing caching, overfetching)

**Rogue — Adversarial & Security:**
- XSS probing in every input (`<script>alert('xss')</script>`, `"><img src=x onerror=alert(1)>`)
- Auth boundary testing (admin routes as regular user, IDOR via URL ID changes)
- API manipulation via `javascript_tool` (replay with modified payloads)
- State corruption (multiple tabs, conflicting actions)
- Data leak inspection (passwords, tokens, internal IDs in network responses)

### Visual Severity Classification

| Finding | Severity |
|---|---|
| Layout broken — overlapping, overflowing, hidden elements | **Critical** |
| Visual inconsistency — different spacing, colors, fonts across same feature | **Important** |
| Responsive breakage — feature unusable at common breakpoints | **Important** |
| Misalignment with design spec / design doc | **Important** |
| Animation/transition glitch — janky, missing, wrong | **Important** |
| Minor polish — 1px off on a non-primary element | **Minor** |

### Evidence Requirements

| Severity | Required Evidence |
|---|---|
| Critical (crash, security, data loss, layout broken) | GIF + console log + network detail |
| Important (broken feature, visual inconsistency, wrong behavior) | Screenshot + console or network detail |
| Minor (polish) | Screenshot or console excerpt |

Tools: `gif_creator`, `read_page` / `get_page_text`, `read_console_messages` (with `pattern` filter), `read_network_requests`, `javascript_tool`.

### Cross-Challenger Verification

After all challengers report:
- Each reads the others' findings and attempts to reproduce on their own instance
- Can't reproduce → challenge: "Could not reproduce on port 3002, possible flaky/env-specific"
- Reproduce + find worse → build on: "Double-submit also affects payment endpoint, not just orders"

### Dungeon Pinning

```
📌 DUNGEON [CRITICAL]: IDOR vulnerability on /api/users/:id — no ownership check
📌 DUNGEON [IMPORTANT]: Visual inconsistency — button padding differs on /settings vs /profile
📌 DUNGEON [MINOR]: Console warning "act() not wrapped" on search page
```

Critical and Important must be fixed before merge. Wizard rules on severity disputes.

---

## 8. Existing Skill Modifications

### `raid-tdd` — Phase 3

Add decision point after identifying what test to write:

- Pure logic / API / data → unit test (existing flow)
- User-facing interaction → browser test (invoke `raid-browser-playwright`)
- Both → unit test FIRST, then browser test

Add adversarial questions:
- "User-facing feature with only unit tests — where's the browser test?"
- "Browser test checks DOM but no console/network assertions"
- "Tested at desktop width only — what about mobile?"

### `raid-implementation` — Phase 3

Add to Wizard's task setup:
- Check if `browser.startup` exists; if null → invoke `raid-browser` startup discovery first
- Check if Playwright is installed; if not → first task becomes scaffolding
- Assign port from `portRange` to implementer

Add to Implementation Gauntlet:
- Implementer BOOTs app before browser TDD, CLEANUPs after task
- Challengers BOOT on own ports to run tests independently and check for flakiness

### `raid-review` — Phase 4

Add after existing code review:
1. Wizard announces browser inspection phase
2. Each reviewer BOOTs own instance (via `raid-browser`)
3. Each reviewer runs PRE-FLIGHT
4. Each reviewer LOGINs if needed
5. Each reviewer inspects from angle (via `raid-browser-chrome`)
6. Cross-verification of findings
7. Pin browser findings alongside code findings
8. Each reviewer CLEANUPs
9. Wizard rules on ALL findings (code + browser) together

### `raid-verification` — Before Completion

- "Tests pass" means unit AND browser tests pass
- Playwright tests must run headlessly
- If test command doesn't include Playwright, agent runs it separately

### `raid-finishing` — Completion

- Full suite includes Playwright tests (headless)
- Verify no leaked processes from prior sessions
- Verify all ports in `portRange` are free
- Agents debate browser test coverage sufficiency

---

## 9. Hook Changes (DEFERRED)

> **Status:** Designed but NOT for implementation yet. Another agent is actively working on the hooks system. These changes will be integrated after that work is complete.

### `validate-tests-pass.sh` — Update

After running primary test command, also run `{execCommand} playwright test` if `browser.enabled` is true and Playwright config exists. Both must pass. Timestamp written only when both pass.

### `validate-browser-cleanup.sh` — New (PostToolUse, Bash)

Check if any ports in `portRange` are still occupied after cleanup-related commands. Warning only (exit 0), not a block.

### `validate-browser-tests-exist.sh` — New (PreToolUse, git commit)

When browser-facing code is staged (`.tsx`, `.jsx`, `.vue`, `.svelte` in `src/`, `app/`, `pages/`, `components/`), check for corresponding Playwright tests. Warning only (exit 0).

---

## 10. Playwright Scaffolding (Agent-Driven)

If browser testing is enabled but Playwright isn't installed, the agents handle setup as a natural first task:

1. Install Playwright: `{installCommand} -D @playwright/test`
2. Install browsers: `{execCommand} playwright install`
3. Generate config: `playwright.config.ts` with `baseURL` from `raid.json`
4. Create test directory structure
5. Verify with a smoke test
6. Commit scaffolding

This keeps `claude-raid init` simple — it only configures, never installs dependencies.

---

## Key Design Principles

1. **Dual-tool** — Playwright MCP for durable test artifacts, Claude-in-Chrome for exploratory QA
2. **Full instance isolation** — Each agent gets own port, dev server, browser
3. **Discover once, codify** — Startup recipe investigated once, written to `raid.json`, reused
4. **Pre-flight gates** — Auth and test subject clarity checked before every browser session
5. **Package manager aware** — All commands use detected runner
6. **Visual consistency is Important** — Not minor. Visual bugs block merge.
7. **Cleanup iron law** — Every BOOT has a CLEANUP. Leaked processes are never acceptable.
8. **Existing skills own the "when"** — New skills handle the "how"
