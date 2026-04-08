---
name: raid-debugging
description: "Use when encountering any bug, test failure, or unexpected behavior. Agents investigate competing hypotheses in parallel. No fixes without root cause. No subagents."
---

# Raid Debugging — Adversarial Root Cause Analysis

Three investigators, three hypotheses, one truth.

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

**Violating the letter of this process is violating the spirit of debugging.**

## Mode Behavior

- **Full Raid**: 3 agents investigate competing hypotheses in parallel.
- **Skirmish**: 2 agents with different hypotheses.
- **Scout**: 1 agent investigates + Wizard challenges the hypothesis.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

## The Four Phases

### Phase 1: Root Cause Investigation

1. **Read error messages carefully** — stack traces, line numbers, error codes
2. **Reproduce consistently** — exact steps, every time
3. **Check recent changes** — git diff, recent commits, new dependencies
4. **Gather evidence in multi-component systems** — log what enters/exits each boundary
5. **Trace data flow** — where does the bad value originate? Fix at source, not symptom

### Phase 2: Pattern Analysis

1. Find working examples of similar code
2. Compare against references — read COMPLETELY, don't skim
3. List every difference between working and broken

### Phase 3: Hypothesis and Testing

1. Form a single, specific hypothesis: "X is the root cause because Y"
2. Make the SMALLEST possible change to test it. One variable at a time.
3. Did it work? -> Phase 4. Didn't work? -> NEW hypothesis.

### Phase 4: Fix Implementation

1. Write a failing test that reproduces the bug (use `raid-tdd`)
2. Implement single fix addressing root cause
3. Verify — test passes, no regressions (run test command from `.claude/raid.json`)
4. Cross-testing by challengers

## Raid-Specific: Competing Hypotheses

The Wizard dispatches agents with different hypotheses:

**📡 DISPATCH:**
> **Warrior**: Investigate [structural/data cause]. Reproduce. Trace data flow. Gather evidence.
> **Archer**: Investigate [integration/contract cause]. Check interfaces, type mismatches, dependencies.
> **Rogue**: Investigate [timing/state/adversarial cause]. Race conditions, stale state, environment.

Agents present evidence and fight. The hypothesis that survives cross-testing wins.

⚡ WIZARD RULING: Root cause is [X] because [evidence].

## 3+ Fixes Failed? Question Architecture

All agents discuss fundamentals. Wizard decides: fix architecture or escalate to human.

## Red Flags

- "Quick fix for now" — NO. Find root cause.
- "Just try changing X" — NO. Hypothesize first.
- "I'm confident it's Y" — Confidence ≠ evidence.
