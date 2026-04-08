---
name: raid-design
description: "Phase 1 of Raid protocol. Read-only exploration, context gathering, requirements refinement, and design document creation. All agents explore, battle, learn from each other's mistakes and discoveries, and push the design to its edges."
---

# Raid Design — Phase 1

Turn ideas into battle-tested designs through adversarial multi-agent exploration.

<HARD-GATE>
Do NOT write any code, scaffold any project, or take any implementation action until the Wizard has approved the design and it is committed to git. All assigned agents participate. No subagents.
</HARD-GATE>

## Mode Behavior

- **Full Raid**: All 3 agents explore from different angles, fight, cross-test. Full design doc required.
- **Skirmish**: 2 agents explore, produce a lightweight design+plan combined doc.
- **Scout**: Wizard assesses inline, no design doc required. Skip this skill entirely.

## Anti-Pattern: "This Is Too Simple To Need A Design"

Every project in Full Raid mode goes through this process. "Simple" projects are where unexamined assumptions cause the most wasted work.

## Wizard Checklist

Complete in order:

1. **Comprehend the request** — read 3 times, identify the real problem
2. **Explore project context** — files, docs, recent commits, dependencies, conventions, patterns
3. **Research dependencies** — if external services/libraries involved, extensively research: API surface, versioning, compatibility, known issues
4. **Ask clarifying questions** — one at a time to the human, eliminate every ambiguity
5. **Dispatch exploration** — agents explore from different angles
6. **Observe the fight** — let agents cross-test, learn from each other, push to edges
7. **Synthesize approaches** — propose 2-3 approaches with trade-offs and recommendation
8. **Present design** — in sections, get user approval after each section
9. **Write design doc** — save to the specs path from `.claude/raid.json` (default: `docs/raid/specs/YYYY-MM-DD-<topic>-design.md`)
10. **Adversarial spec review** — all agents attack the written spec
11. **Wizard ruling** — final spec approval
12. **User reviews written spec** — user approves before proceeding
13. **Commit** — `docs(design): <topic> specification`
14. **Transition** — invoke `raid-implementation-plan`

## Dispatch Pattern

**📡 DISPATCH example:**

> **Warrior**: Explore from the data/infrastructure side. What are the hard technical constraints? What schemas, migrations, APIs are needed? What breaks if we get this wrong?
>
> **Archer**: Explore from the integration/consistency side. How does this fit with existing patterns? What implicit contracts exist? What ripple effects? Check naming patterns and file structure conventions.
>
> **Rogue**: Explore from the failure/adversarial side. What assumptions about inputs, state, timing, availability? Build failure scenarios. What does a malicious user do? What does concurrent access do?

## What Agents Must Cover

Every agent must address ALL of these from their assigned angle:

- **Performance** — scale, bottlenecks, complexity
- **Robustness** — what happens when things go wrong? Retries? Fallbacks? Graceful degradation?
- **Reliability** — can we depend on this in production? Blast radius of failure?
- **Testability** — meaningful tests? Mock external deps? Test-friendly design?
- **Error handling** — what errors can occur? How do we surface them?
- **Edge cases** — empty inputs, null, boundary conditions, Unicode, timezones, large payloads
- **Cascading effects** — what else changes? Blast radius?
- **Clean architecture** — separation of concerns, single responsibility, dependency inversion
- **Modularity & composability** — replaceable? Extensible? Composable?
- **DRY** — duplicating logic? Reuse existing code?
- **Dependencies** — version compatibility, security, maintenance, licensing

## The Fight

After exploration, agents cross-test:
1. Present findings with evidence (file paths, docs, concrete examples)
2. Challenge each other's findings with counter-evidence
3. **Go to the edges** — push every finding to its extreme
4. **Learn from each other** — incorporate discoveries into your model
5. **Build on discoveries** — don't just attack, explore whether findings reveal improvements
6. **Test wrong assumptions explicitly** — document WHY it was wrong

## Design Document Structure

Save to: specs path from `.claude/raid.json` (default: `docs/raid/specs/YYYY-MM-DD-<topic>-design.md`)

```markdown
# [Feature Name] Design Specification

**Date:** YYYY-MM-DD
**Status:** Draft | Under Review | Approved
**Raid Team:** Wizard (lead), [agents used]
**Mode:** Full Raid | Skirmish

## Problem Statement
## Requirements
## Constraints
## Research Findings
### Key Discoveries
### Lessons Learned
## Design Decision
### Alternatives Considered
## Architecture
## File Structure
## Error Handling Strategy
## Testing Strategy
## Edge Cases
## Future Considerations
## ⚡ WIZARD RULING
```

## Key Principles

- **One question at a time** — don't overwhelm the human
- **YAGNI ruthlessly** — remove unnecessary features
- **Explore alternatives** — always propose 2-3 approaches
- **Research deeply** — don't assume, verify
- **Design for isolation** — units with one purpose, clear interfaces
- **Working in existing codebases** — follow existing patterns

After approval: ⚡ WIZARD RULING: Design approved. Commit. Invoke `raid-implementation-plan`.
