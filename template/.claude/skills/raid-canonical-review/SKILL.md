---
name: raid-canonical-review
description: "Use when Phase 5 (Review) begins in a Canonical Quest, after implementation is complete and the human opts in."
---

# Raid Review — Phase 5 (Optional)

Three reviewers, three angles, zero mercy. Pinning then fixing. Black cards for the unfixable.

<HARD-GATE>
This phase is OPTIONAL — the Wizard asks the human before entering. All assigned agents review the ENTIRE implementation independently, then attack each other's findings. Use `raid-verification` before any completion claims. No subagents.
</HARD-GATE>

## Mode Behavior

- **Full Raid**: 3 independent reviews, then agents fight directly over findings. All severity levels enforced.
- **Skirmish**: 1 agent reviews + Wizard. Cross-testing between reviewer and Wizard.
- **Scout**: Wizard reviews alone. Checks against requirements and runs tests.

## Process Flow

```dot
digraph review {
  "Wizard reads design doc, plan, Phase 4 implementation log" -> "Wizard opens review board";
  "Wizard opens Dungeon + dispatches" -> "Agents review independently";
  "Agents review independently" -> "Agents fight over findings directly";
  "Agents fight over findings directly" -> "Agents challenge missing findings";
  "Agents challenge missing findings" -> "Agents pin severity-classified issues to Dungeon";
  "Agents pin severity-classified issues to Dungeon" -> "Wizard closes: categorizes surviving issues";
  "Wizard closes: categorizes surviving issues" -> "Critical or Important?" [shape=diamond];
  "Critical or Important?" -> "Assign fixes" [label="yes"];
  "Assign fixes" -> "Fix + verify + challengers re-attack";
  "Fix + verify + challengers re-attack" -> "Wizard closes: categorizes surviving issues";
  "Critical or Important?" -> "Wizard final ruling" [label="no"];
  "Wizard final ruling" -> "Commit + invoke raid-wrap-up" [shape=doublecircle];
}
```

## Wizard Checklist

1. **Prepare** — gather git range, design doc, plan doc, read `{questDir}/phase-4-implementation.md`
2. **Open the review board** — create `{questDir}/phase-5-review.md`
3. **Dispatch** — all agents review independently, then interact directly
4. **Observe the fight** — agents challenge findings and missing findings directly
5. **Close** — categorize surviving issues by severity from Dungeon
6. **Browser inspection** — dispatch agents to inspect in Chrome (if `browser.enabled`)
7. **Observe browser fights** — agents cross-verify findings on separate instances
8. **Rule on fixes** — Critical and Important must be fixed (code AND browser)
9. **Verify fixes** — targeted re-attack after fixes (use `raid-verification`)
10. **Final ruling** — approved or rejected
11. **Commit** — `fix(quest-{slug}): phase 5 review — {N} findings resolved`
12. **Transition** — invoke `raid-wrap-up`

## Opening the Dungeon

Create `{questDir}/phase-5-review.md`:

```markdown
# Phase 5: Review
## Quest: Full adversarial review of <feature> implementation
## Mode: <Full Raid | Skirmish>

### Discoveries

### Active Battles

### Resolved

### Shared Knowledge

### Escalations
```

## Dispatch

**DISPATCH:**

> **@Warrior**: Review full implementation. Run every test. Check error handling at every boundary. Verify all requirements from design doc. Find the bugs that crash in production. Then fight @Archer and @Rogue over their findings.
>
> **@Archer**: Review full implementation. Does it match the design doc exactly? Patterns consistent? Interfaces correct? Types sound? Naming conventions followed? File structure clean? Find the bugs that silently produce wrong results. Then fight @Warrior and @Rogue.
>
> **@Rogue**: Review full implementation. Think like an attacker. What inputs break it? What timing causes races? What happens when dependencies fail? Find the bugs nobody else will find. Then fight @Warrior and @Archer.
>
> **All**: Review independently first, then fight directly. Challenge each other's findings AND each other's blind spots. Pin severity-classified issues to Dungeon with `DUNGEON:`. Reference the Phase 3 Dungeon for context.

## Review Checklist — Each Agent

**Requirements:** Every design doc requirement implemented? No extras (YAGNI)? Nothing misinterpreted?

**Code Quality:** Clean separation? Error handling at every boundary? DRY? Clear names?

**Testing:** Every function tested? Edge cases? Failure paths? All passing?

**Architecture:** Design decisions implemented correctly? Interfaces match spec? No drift?

**Naming & Structure:** Consistent naming? File system follows conventions? Modules clean?

**Production:** Performance OK? External calls have timeouts? No secrets in code?

## Verification Protocol for Findings

Before acting on ANY finding (yours or a teammate's):
1. **READ:** Complete the finding without reacting
2. **VERIFY:** Check against codebase reality — read the actual code at the referenced location
3. **EVALUATE:** Is this technically sound for THIS codebase? Does fixing it break something else?
4. **RESPOND:** Technical evidence or reasoned pushback

## No Performative Agreement

NEVER respond with "You're absolutely right!" or "Great point!" or "Good catch!"
Instead: state the technical finding, show evidence, or push back.
Actions speak. Fix and show — don't compliment.

If a finding IS correct: `"Fixed. [Brief description of what changed]."` or just fix it silently.

## YAGNI Check on Findings

Before implementing a "professional improvement" suggestion:
- Grep codebase for actual usage of the component
- If unused: suggest removing (YAGNI) — `"This endpoint isn't called. Remove it?"`
- If used: implement properly
- Don't gold-plate during review

## The Fight — Agents Challenge Each Other

After independent reviews, agents fight DIRECTLY over findings AND missing findings:

- `CHALLENGE: @Archer, you gave the auth module a pass but didn't check the session rotation path — review it now.`
- `BUILDING: @Warrior, your finding about the missing error handler — the impact is worse than you stated because...`
- `CHALLENGE: @Rogue, your "Critical" severity on the naming inconsistency is overblown — here's why it's actually Minor...`
- `DUNGEON: [Critical] handler.js:23 — missing input validation allows injection. Verified by @Warrior and @Rogue.`

**Agents classify severity when pinning to Dungeon:**

| Severity | Definition | Action |
|----------|------------|--------|
| **Critical** | Bugs, security holes, data loss, crashes | Must fix. No exceptions. |
| **Important** | Missing features, poor error handling, test gaps, naming inconsistencies | Must fix. |
| **Minor** | Style, docs, optimization | Note for future. |

## Browser Inspection Phase (when `browser.enabled` in raid.json)

After code review findings are pinned, the Wizard announces browser inspection.

### Process

1. **Wizard announces:** "Browser inspection phase — each reviewer boots their own instance"
2. **Each reviewer BOOTs** their own app instance on separate ports (invoke `raid-browser`)
3. **Each reviewer runs PRE-FLIGHT** — state test subject, check auth, discover routes
4. **Each reviewer LOGINs** if auth is required (credentials from `.env.raid`)
5. **Each reviewer inspects** from their angle (invoke `raid-browser-chrome`):
   - Minimum gates first (console, network, page loads)
   - Then angle-driven exploration (Warrior: stress, Archer: visual/precision, Rogue: security)
   - Evidence captured for every finding (GIF, screenshot, console/network)
6. **Cross-verification** — each reviewer reproduces others' findings on their own instance
7. **Pin browser findings** to Dungeon alongside code review findings
8. **Each reviewer CLEANUPs** their instance
9. **Wizard rules** on ALL findings (code + browser) together

### Browser findings follow the same severity rules:

- **Critical** (crash, security, layout broken) — must fix
- **Important** (broken feature, visual inconsistency, responsive breakage) — must fix
- **Minor** (polish, console warnings) — note for future

**Browser bugs block merge the same way code bugs do.**

## Black Card System

If any agent finds something that fundamentally breaks the architecture — a change so deep it invalidates the implementation — they play a `BLACKCARD:`:

```
BLACKCARD: [description of breaking concern]
Evidence: [file paths, scenarios, why this is unfixable within current design]
Impact: [what breaks, how deep the damage goes]
```

**Black Card flow:**
1. Agent plays `BLACKCARD:` → other agents independently verify
2. If 2+ agents agree it's a black card → Wizard escalates to human
3. Wizard presents to human with full context (digested, not raw):
   - What the black card is
   - Why it's unfixable in current design
   - Options:
     a) **Rollback** — Go back to PRD or Design phase (creates `phase-2-design-v2.md`)
     b) **Accept** — Live with the limitation, document it, continue
4. Human decides → Wizard acts accordingly

**Black cards are RARE.** Most issues are Critical or Important, not black cards. A black card means "the foundation is wrong" — not "there's a bug."

## Fix Implementation Order

When the Wizard assigns fixes during the Fixing subphase, prioritize in this order within each severity level:
1. **Blocking issues** — crashes, security holes, data loss
2. **Simple fixes** — typos, imports, naming inconsistencies
3. **Complex fixes** — refactoring, logic changes, architectural adjustments

Test each fix individually. Verify no regressions before moving to the next fix.

## Unclear Finding Protocol

If ANY finding is unclear — unclear what the problem is, unclear how to reproduce, unclear what the fix should be — **STOP**. Clarify ALL unclear items before implementing ANY fixes. Partial understanding leads to wrong implementation.

## Closing the Phase

The Wizard closes when agents have exhausted their findings and the review board has all issues classified:

**RULING: APPROVED FOR MERGE** — all Critical/Important fixed, tests pass, requirements met.

**RULING: REJECTED** — specify what must change and which phase to return to.

## Red Flags

| Thought | Reality |
|---------|---------|
| "The implementation looks fine, no issues" | Every review finds at least one issue. Look harder. |
| "I'll report my findings to the Wizard" | Report to the other agents directly. Fight over them. |
| "This is a Minor issue" (when it causes wrong behavior) | Wrong results = Important or Critical. |
| "The tests pass, so it works" | Tests prove what they test. What DON'T they test? |
| "Let's skip re-review of the fixes" | Fixes introduce new bugs. Always re-attack. |

---

## Phase Transition

When the RULING is APPROVED FOR MERGE:

1. Update `.claude/raid-session` phase via Bash (write gate blocks Write/Edit on this file):
   ```bash
   jq '.phase="wrap-up"' .claude/raid-session > .claude/raid-session.tmp && mv .claude/raid-session.tmp .claude/raid-session
   ```
2. **Commit**: `fix(quest-{slug}): phase 5 review — {N} findings resolved`
3. **Send phase report to human**: findings count, fixes applied, any black cards
4. **Load the `raid-wrap-up` skill now and begin Phase 6.**

Do not wait. Do not ask. The next action after approving for merge is loading the next skill.
