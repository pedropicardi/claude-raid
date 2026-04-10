---
name: raid-browser
description: "Use when browser testing infrastructure is needed — startup discovery, boot/cleanup lifecycle, port isolation, pre-flight checks. Required before raid-browser-chrome or Playwright browser tasks."
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
BROWSER TEST SUBJECT:
- Feature: "<specific feature name>"
- Scope: "<what interactions/flows are being tested>"
- Success criteria: "<what 'working' looks like>"
- Out of scope: "<what we're NOT testing>"
```

If the agent cannot clearly state the test subject, the Wizard asks the user:

```
WIZARD → USER: "What specific user flow should we verify in the browser?

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
WIZARD → USER: "This app requires authentication. I need:
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
6. **Pin to Dungeon** — `DUNGEON: Startup recipe verified — [full recipe details]`
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
6. Pin to Dungeon: `DUNGEON: Startup recipe updated — [reason for change]`
