---
name: raid-browser-playwright
description: "Playwright MCP automated browser test authoring. Extends TDD RED-GREEN-REFACTOR with .spec.ts files. Console + network assertions mandatory. Invoked from raid-tdd and raid-implementation during Phase 3."
---

# Raid Browser Playwright — Automated Test Authoring

Write browser tests as part of TDD. Use Playwright MCP to explore, then encode verified interactions into durable `.spec.ts` files.

<HARD-GATE>
Do NOT write browser tests without invoking `raid-browser` pre-flight first. Do NOT skip console/network assertions. Do NOT write tests without watching them fail first (TDD RED step). No subagents.
</HARD-GATE>

## When to Write Browser Tests vs Unit Tests

Not every task needs a browser test. The implementer decides and states reasoning. Challengers attack this decision.

| Write Browser Test | Write Unit Test Only |
|---|---|
| New user-facing flow (signup, checkout) | Pure utility function |
| UI interaction (drag-drop, modal, form) | API endpoint logic |
| Client-side routing / navigation | Data transformation |
| Visual state changes (loading, error, empty) | Business rule validation |
| Integration between frontend and API | Database queries |

**If unsure:** Write the browser test. It's easier to remove an unnecessary test than to find a bug in production.

## Browser TDD Cycle

### RED (browser)

1. Write Playwright test file: `tests/e2e/<feature>.spec.ts`
2. Test describes **user behavior**, not implementation:
   - Navigate to page
   - Interact (click, type, select, drag)
   - Assert visible outcome (text appears, redirect happens, element state changes)
3. Include mandatory infrastructure assertions (see below)
4. Run test → **MUST fail**
5. Verify it fails for the **RIGHT reason** (page/element missing — not test syntax error)

### GREEN (browser)

1. Implement the feature code
2. Run Playwright test → **MUST pass**
3. Run full test suite (unit + browser) → all green

### REFACTOR

1. Clean up implementation and test code
2. Re-run all tests → still green

## Using Playwright MCP During Test Authoring

While writing the test, the implementer explores interactively to understand the current state and find correct selectors:

| Tool | Purpose |
|---|---|
| `browser_navigate` | Load the page, see what's there |
| `browser_snapshot` | Get DOM state, find correct selectors |
| `browser_click` / `browser_fill_form` | Test interactions manually first |
| `browser_console_messages` | Check for errors during interaction |
| `browser_network_requests` | Verify API calls, check payloads |
| `browser_take_screenshot` | Capture visual state for evidence |

**The MCP tools are the exploratory scratchpad. The `.spec.ts` file is the durable artifact.**

Encode what you verified interactively into the test file. The test must run headlessly in CI without MCP tools.

## Mandatory Assertions

Every browser test file MUST include at least:

### 1. Console-Clean Assertion

```typescript
test('no console errors during <feature> flow', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // ... perform the feature flow ...

  expect(errors).toEqual([]);
});
```

### 2. Network-Health Assertion

```typescript
test('API calls succeed during <feature> flow', async ({ page }) => {
  const failures: string[] = [];
  page.on('response', response => {
    if (response.status() >= 400) {
      failures.push(`${response.status()} ${response.url()}`);
    }
  });

  // ... perform the feature flow ...

  expect(failures).toEqual([]);
});
```

**Missing either of these is an automatic challenge from any reviewer.**

## Selector Best Practices

| Prefer | Avoid | Why |
|---|---|---|
| `data-testid="submit-btn"` | `button.btn-primary` | CSS classes change for styling reasons |
| `getByRole('button', { name: 'Submit' })` | `#submit` | Accessible and resilient |
| `getByText('Welcome back')` | `.header > div:nth-child(2)` | Structural selectors break on layout changes |

## Challenger Attacks on Browser Tests (Phase 3)

**Warrior attacks:**
- "You only tested the happy path — what happens with network failure?"
- "No test for rapid double-submit on the form"
- "What about a 10,000-character input in the name field?"
- "You didn't test with JavaScript disabled / slow network"

**Archer attacks:**
- "Your selector `button[type=submit]` is fragile — use `data-testid`"
- "No assertion on console errors — the feature works but throws warnings"
- "Missing network assertion — you don't verify the POST payload"
- "Tested at desktop width only — what about mobile viewport?"

**Rogue attacks:**
- "What happens if the user is already logged in and hits /register?"
- "No test for XSS in the input fields"
- "What if the API returns 200 but with an error body?"
- "Race condition: what if the user navigates away during submission?"

**Each challenger BOOTS their own app instance** (on their own port via `raid-browser`), runs the tests independently, and verifies they pass without flakiness.

## Running Browser Tests

Use the test command from `.claude/raid.json`:
- Read `project.execCommand` (e.g., `pnpm dlx`, `npx`, `bunx`)
- Run: `{execCommand} playwright test`
- For a specific test: `{execCommand} playwright test tests/e2e/<feature>.spec.ts`

## Test File Organization

```
tests/
  e2e/
    <feature-name>.spec.ts       # One file per feature/flow
    auth/
      login.spec.ts              # Group related flows in directories
      registration.spec.ts
```

## Red Flags

| Thought | Reality |
|---------|---------|
| "The feature is too simple for a browser test" | Simple features break in the browser. If it's user-facing, test it. |
| "I'll add console assertions later" | Later never comes. Add them now. |
| "The unit tests cover this" | Unit tests don't catch hydration mismatches, missing CSS, broken routing. |
| "I tested it manually with MCP tools" | Manual verification isn't reproducible. Write the `.spec.ts`. |
| "Selectors are fine, they work" | They work today. Will they work after a CSS refactor? Use `data-testid`. |
