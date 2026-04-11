---
name: raid-browser-chrome
description: "Use when live Chrome browser inspection is needed during Phase 5 review or ad-hoc browser verification."
---

# Raid Browser Chrome — Live Adversarial Inspection

Challengers open a real Chrome browser and do adversarial exploratory testing. Each challenger gets their own isolated app instance. Find what automated tests missed.

<HARD-GATE>
Do NOT start inspection without invoking `raid-browser` pre-flight first. Do NOT skip minimum coverage gates. Do NOT share browser instances between agents. Every finding MUST include evidence (GIF, screenshot, console/network output).
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
DUNGEON [CRITICAL]: Login failed — cannot test authenticated flows
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
CHALLENGE: Double-clicking "Place Order" submits two orders.
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
CHALLENGE: Search results page makes 3 identical GET /api/products calls on load.
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
CHALLENGE: Changing /api/users/15 to /api/users/16 returns another user's full profile including email and phone.
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

- **Can reproduce + confirm:** `BUILDING: @Warrior, confirmed double-submit on port 3002. Also affects payment endpoint.`
- **Cannot reproduce:** `CHALLENGE: Could not reproduce @Warrior's double-submit on port 3002. Tried 10 rapid clicks, all debounced. Possible race condition — flaky or env-specific?`
- **Find it's worse:** `BUILDING: @Rogue, the IDOR on /api/users also works on /api/orders — any authenticated user can read any order.`

## Dungeon Pinning

```
DUNGEON [CRITICAL]: IDOR vulnerability on /api/users/:id — no ownership check
DUNGEON [IMPORTANT]: Button padding 16px on /settings, 12px on /profile — visual inconsistency
DUNGEON [IMPORTANT]: No loading state on search results — blank screen for 2s on slow network
DUNGEON [MINOR]: Console warning "act() not wrapped" on search page — React testing artifact
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
