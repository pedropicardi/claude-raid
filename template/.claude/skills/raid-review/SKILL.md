---
name: raid-review
description: "Phase 4 of Raid protocol. Full adversarial review of the entire implementation. All assigned agents review independently, cross-test findings, verify against design doc and plan. No subagents."
---

# Raid Review — Phase 4

The final gauntlet. Zero mercy.

<HARD-GATE>
Do NOT declare work complete without Phase 4 (except Scout mode where Wizard reviews alone). All assigned agents review the ENTIRE implementation independently. Use `raid-verification` before any completion claims. No subagents.
</HARD-GATE>

## Mode Behavior

- **Full Raid**: 3 independent reviews, cross-tested. All severity levels enforced.
- **Skirmish**: 1 agent reviews + Wizard. Cross-testing between reviewer and Wizard.
- **Scout**: Wizard reviews alone. Checks against requirements and runs tests.

## Wizard Checklist

1. **Prepare** — gather git range, design doc, plan doc
2. **Dispatch full review** — agents review independently
3. **Observe the fight** — agents cross-test review findings
4. **Synthesize** — categorize surviving issues by severity
5. **Rule on fixes** — Critical and Important must be fixed
6. **Verify fixes** — targeted re-review after fixes
7. **Final ruling** — approved or rejected
8. **Transition** — invoke `raid-finishing`

## Review Checklist — Each Agent

**Requirements:** Every design doc requirement implemented? No extras (YAGNI)? Nothing misinterpreted?

**Code Quality:** Clean separation? Single responsibility? Error handling? DRY? Clear names?

**Testing:** Every function tested? Behavior, not implementation? Edge cases? Failure paths? All passing? Run test command from `.claude/raid.json`.

**Architecture:** Design decisions correctly implemented? Interfaces match? No drift?

**Naming & Structure:** Consistent naming everywhere? File system follows conventions?

**Production:** Performance OK? External calls have timeouts/retries? Logging? No secrets in code?

## Issue Severity

| Severity | Definition | Action |
|----------|------------|--------|
| **Critical** | Bugs, security holes, data loss, crashes | Must fix. No exceptions. |
| **Important** | Missing features, poor error handling, test gaps | Must fix. |
| **Minor** | Style, docs, optimization | Note for future. |

## Final Ruling

**⚡ WIZARD RULING: APPROVED FOR MERGE** — all Critical/Important fixed, tests pass, requirements met.

**⚡ WIZARD RULING: REJECTED** — specify what must change.

Then: invoke `raid-finishing`.
