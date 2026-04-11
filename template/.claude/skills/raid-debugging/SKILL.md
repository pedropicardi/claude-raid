---
name: raid-debugging
description: "Use when encountering any bug, test failure, or unexpected behavior. Agents investigate competing hypotheses in sequential turns. No fixes without root cause. No subagents."
---

# Raid Debugging — Adversarial Root Cause Analysis

Three investigators, three hypotheses, one truth.

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

**Violating the letter of this process is violating the spirit of debugging.**

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

## Process Flow

```dot
digraph debugging {
  "Bug encountered" -> "Phase 1: Root Cause Investigation";
  "Phase 1: Root Cause Investigation" -> "Reproduce consistently?";
  "Reproduce consistently?" -> "Gather more data" [label="no"];
  "Gather more data" -> "Reproduce consistently?";
  "Reproduce consistently?" -> "Dispatch competing hypotheses" [label="yes"];
  "Dispatch competing hypotheses" -> "Agents investigate independently";
  "Agents investigate independently" -> "Phase 2: Pattern Analysis";
  "Phase 2: Pattern Analysis" -> "Phase 3: Hypothesis Testing";
  "Phase 3: Hypothesis Testing" -> "Hypothesis confirmed?" [shape=diamond];
  "Hypothesis confirmed?" -> "New hypothesis" [label="no"];
  "New hypothesis" -> "Phase 3: Hypothesis Testing";
  "Hypothesis confirmed?" -> "Wizard ruling: root cause identified" [label="yes"];
  "Wizard ruling: root cause identified" -> "Phase 4: Fix (TDD)";
  "Phase 4: Fix (TDD)" -> "Fix works?" [shape=diamond];
  "Fix works?" -> "3+ failed fixes?" [label="no"];
  "3+ failed fixes?" -> "Question architecture" [label="yes"];
  "3+ failed fixes?" -> "New hypothesis" [label="no"];
  "Fix works?" -> "Cross-test fix + verify" [label="yes"];
  "Cross-test fix + verify" -> "Done" [shape=doublecircle];
}
```

## The Four Phases

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read error messages carefully** — stack traces, line numbers, error codes. Don't skip past them. The answer is often in the first error.
2. **Reproduce consistently** — exact steps, every time. If not reproducible, gather more data — don't guess. An unreproducible bug is not understood.
3. **Check recent changes** — `git diff`, recent commits, new dependencies, config changes. What changed since it last worked?
4. **Gather evidence at boundaries** — in multi-component systems, add diagnostic instrumentation:
   ```
   For EACH component boundary:
     - Log what data enters the component
     - Log what data exits the component
     - Verify environment/config propagation
     - Check state at each layer
   Run ONCE to gather evidence showing WHERE it breaks.
   THEN investigate that specific component.
   ```
   Example: API → Service → Database → Response. Log at each boundary. The layer where input looks right but output looks wrong is your target.

5. **Trace data flow backward** — where does the bad value appear? What function produced it? What called that function with what input? Keep tracing backward until you find the SOURCE. Fix at SOURCE, not at symptom.

### Phase 2: Pattern Analysis

1. **Find working examples** of similar code in the same codebase
2. **Read reference implementations COMPLETELY** — don't skim. The difference between working and broken is often subtle.
3. **List every difference** between working and broken, however small
4. **Understand dependency assumptions** — what does this code expect from its environment?

### Phase 3: Hypothesis and Testing

**Per-agent hypothesis discipline:**
1. **Form ONE specific hypothesis:** "I think X is the root cause because Y." Write it down. Be specific, not vague.
2. **Make the SMALLEST possible change** to test it. One variable at a time. Don't fix multiple things at once.
3. **Did it work?** → Phase 4. **Didn't work?** → Form a NEW hypothesis based on what you learned. Don't pile fixes on top of failed fixes. Don't just "try another thing" — the failed test gave you information. Use it.

### Phase 4: Fix Implementation

1. **Write a failing test** that reproduces the bug (use `raid-tdd`)
2. **Implement single fix** addressing root cause
3. **Verify** — test passes, no regressions (run test command from `.claude/raid.json`)
4. **Cross-testing** by challengers — does the fix introduce new issues?

## Raid-Specific: Competing Hypotheses

The Wizard dispatches all agents with different hypotheses. After dispatch, agents debate directly:

**DISPATCH:**
> **@Warrior**: Investigate [structural/data cause]. Reproduce. Trace data flow. Gather evidence at boundaries.
> **@Archer**: Investigate [integration/contract cause]. Check interfaces, type mismatches, implicit contracts, dependency versions.
> **@Rogue**: Investigate [timing/state/adversarial cause]. Race conditions, stale state, environment assumptions, concurrent access.
>
> **All**: Investigate independently, then debate directly. Challenge each other's hypotheses with evidence. Build on each other's findings. Pin verified evidence to the Dungeon. The hypothesis that survives cross-testing wins. Escalate to me with `WIZARD:` only if stuck.

**How agents debate root cause:**
- `CHALLENGE: @Rogue, your race condition hypothesis doesn't explain why it fails on single-threaded test runs — evidence: [test output]`
- `BUILDING: @Warrior, your data flow trace reveals the value originates from the config loader, not the API call — here's the upstream path: ...`
- `DUNGEON: Root cause evidence — config loader at config.js:47 returns stale cache when called concurrently [verified by @Archer and @Warrior]`

The hypothesis that survives direct cross-testing gets the Wizard's ruling:

RULING: Root cause is [X] because [evidence from Dungeon].

## Root Cause Tracing

When tracing a bad value upstream:

```
1. Start at the symptom (where the bug manifests)
2. Find where the bad value is used
3. Find where it was set
4. Is THIS the source? Or was it passed from somewhere else?
5. If passed: go to the caller. Repeat from step 2.
6. When you find where the value ORIGINATES incorrectly: that's the root cause.
7. Fix at the source. Add validation at boundaries for defense-in-depth.
```

## 3+ Fixes Failed? Question Architecture

If 3 or more fix attempts fail, **STOP fixing and question architecture:**

- Each fix revealing a new problem in a different place = architectural issue, not implementation bug
- All three agents discuss fundamentals
- Wizard decides: fix architecture or escalate to human with evidence

This is not failure — it's the system working. Detecting architectural problems before sinking more time into symptom fixes.

**Pattern indicating architectural problem:**
- Each fix reveals new shared state or coupling in a different place
- Fixes require "massive refactoring" to implement
- Each fix creates new symptoms elsewhere

If within a Canonical Quest: consider playing a `BLACKCARD:` — this may be a design-level problem, not an implementation bug.

## Defense in Depth

After finding and fixing the root cause, add validation at multiple layers:

1. **Entry point** — validate at the boundary where bad data enters
2. **Business logic** — assert preconditions at the function that broke
3. **Environment guards** — check assumptions about dependencies/state
4. **Debug instrumentation** — add logging at key boundaries for future diagnosis

## Red Flags — STOP and Follow Process

| Thought | Reality |
|---------|---------|
| "Quick fix for now" | NO. Find root cause. Quick fixes become permanent. |
| "Just try changing X" | NO. Hypothesize first. Random changes = random results. |
| "I'm confident it's Y" | Confidence ≠ evidence. Verify before acting. |
| "One more fix attempt" (after 2 failures) | STOP. Question architecture. |
| "I see the problem, let me fix it" | Seeing symptoms ≠ understanding root cause. Trace it. |
| "The issue is simple, don't need process" | Simple issues have root causes too. Process is fast. |
| "Emergency, no time" | Systematic debugging is FASTER than thrashing. Always. |
| "Just try this first" | The first fix sets the pattern. Do it right. |
| "Pattern says X but I'll adapt" | Partial understanding guarantees bugs. Read it completely. |
| "I don't fully understand but this might work" | STOP. Return to Phase 1. |
| "Multiple changes at once saves time" | Can't isolate what worked. Causes new bugs. |
| "I'll write the test after confirming fix" | Untested fixes don't stick. Test first proves it. |
| "Skip investigation, the error message says it all" | Error messages describe symptoms, not root causes. |
| "Add multiple changes, run tests" | One variable at a time. Scientific method. |

## Escalation

| Situation | Action |
|-----------|--------|
| Can't reproduce | Gather more data. Instrument boundaries. Don't guess. |
| Root cause identified but fix is risky | Present to human with evidence and risk assessment. |
| 3+ fixes failed | Architectural discussion. Don't force through. |
| Bug is in a dependency | Document, workaround, and report upstream. |
