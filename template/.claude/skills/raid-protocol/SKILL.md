---
name: raid-protocol
description: "MUST use at the start of any Raid session. Establishes the 4-phase adversarial workflow, team rules, modes, and reference tables. All phases involve all assigned agents in competitive cross-testing."
---

# Raid Protocol — Adversarial Multi-Agent Development

The canonical workflow for all Raid operations. Every feature, bugfix, refactor follows this sequence.

<HARD-GATE>
Do NOT skip phases. Do NOT let a single agent work unchallenged (except in Scout mode). Do NOT proceed without a Wizard ruling. No subagents — agent teams only.
</HARD-GATE>

## Team

| Agent | Role | Color |
|-------|------|-------|
| **Wizard** (Lead) | Coordinator, analyzer, judge, final authority | Purple |
| **Warrior** | Aggressive thorough explorer, stress-tests to destruction | Red |
| **Archer** | Precise pattern-seeker, finds hidden connections and drift | Green |
| **Rogue** | Adversarial assumption-destroyer, thinks like attacker | Orange |

## Team Rules

Read and follow `.claude/raid-rules.md`. Non-negotiable.

## Configuration

Read `.claude/raid.json` for project-specific settings:
- `project.testCommand` — the command to run tests
- `project.lintCommand` — the command to run linting
- `project.buildCommand` — the command to build
- `paths.specs` — where design docs go (default: `docs/raid/specs`)
- `paths.plans` — where plans go (default: `docs/raid/plans`)
- `paths.worktrees` — where worktrees go (default: `.worktrees`)
- `conventions.fileNaming` — naming convention (kebab-case, snake_case, camelCase, none)
- `conventions.commits` — commit format (default: conventional)
- `raid.defaultMode` — default mode (full, skirmish, scout)

If `raid.json` is absent, use sensible defaults.

## Modes

Three modes that scale effort to task complexity.

| Aspect | Full Raid | Skirmish | Scout |
|--------|-----------|----------|-------|
| Agents active | 3 | 2 | 1 |
| Design phase | Full adversarial | Lightweight | Skip (inline) |
| Plan phase | Full adversarial | Merged with design | Skip (inline) |
| Implementation | 1 builds, 2 attack | 1 builds, 1 attacks | 1 builds, Wizard reviews |
| Review phase | 3 independent reviews | 1 review + Wizard | Wizard review only |
| TDD | **Enforced** | **Enforced** | **Enforced** |
| Verification | Triple | Double | Single + Wizard |
| Design doc | Required | Optional (brief) | Not required |
| Plan doc | Required | Combined with design | Not required |

**Mode selection:** User specifies, or Wizard recommends based on task complexity.
**Escalation:** Wizard may escalate (Scout->Skirmish->Full) with human approval.
**De-escalation:** Only with human approval.
**TDD is non-negotiable in ALL modes.**

When to use each:
- **Full Raid**: Complex features, architecture decisions, critical security reviews, major refactors, cross-layer changes
- **Skirmish**: Medium features, non-trivial bugfixes, multi-file changes
- **Scout**: Simple bugfixes, config changes, docs, single-file changes

## The Four Phases

```
Phase 1: DESIGN ──────────── raid-design       -> specs path
Phase 2: IMPLEMENTATION PLAN  raid-implementation-plan -> plans path
Phase 3: IMPLEMENTATION ───── raid-implementation
Phase 4: REVIEW ──────────── raid-review
```

Each phase follows the same pattern:
1. Wizard comprehends and dispatches with different angles
2. Agents explore independently
3. Agents cross-test, challenge, and learn from each other's findings
4. Wizard synthesizes and delivers ruling
5. Phase output is committed before proceeding

### Phase Transition Gates

| From | To | Gate |
|------|-----|------|
| Design | Plan | Design doc approved by Wizard, committed |
| Plan | Implementation | Plan approved by Wizard, committed |
| Implementation | Review | All tasks complete, all tests passing, committed |
| Review | Done | Wizard ruling: approved for merge |

**Violating the letter of these gates is violating the spirit of the process.**

## Skills Reference

| Skill | Purpose |
|-------|---------|
| `raid-protocol` | Master orchestration, modes, team rules, reference tables |
| `raid-design` | Phase 1 — adversarial design with edge exploration |
| `raid-implementation-plan` | Phase 2 — collaborative plan with compliance testing |
| `raid-implementation` | Phase 3 — implement with cross-validation |
| `raid-review` | Phase 4 — adversarial full review |
| `raid-tdd` | TDD with adversarial test quality review |
| `raid-debugging` | Competing hypothesis debugging |
| `raid-verification` | Evidence before completion claims |
| `raid-git-worktrees` | Isolated workspace setup |
| `raid-finishing` | Completeness debate + branch workflow |

## Hooks Reference

| Hook | Event | Purpose |
|------|-------|---------|
| `validate-file-naming.sh` | PostToolUse (Write/Edit) | Enforce naming conventions |
| `validate-commit-message.sh` | PreToolUse (Bash) | Conventional commits |
| `validate-tests-pass.sh` | PreToolUse (Bash) | Tests before commits |
| `validate-phase-gate.sh` | PreToolUse (Write) | Design doc before implementation |
| `validate-no-placeholders.sh` | PostToolUse (Write/Edit) | No TBD/TODO in specs/plans |
| `validate-verification.sh` | PreToolUse (Bash) | Test evidence before completion claims |

## Commit Convention

All commits follow: `type(scope): description`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

Phase transitions get explicit commits:
- Design approved: `docs(design): <topic> specification`
- Plan approved: `docs(plan): <topic> implementation plan`
- Task complete: `feat(scope): <what was built>`
- Review fixes: `fix(scope): <what was fixed>`

## Communication Prefixes

| Prefix | Agent | Meaning |
|--------|-------|---------|
| 📡 DISPATCH: | Wizard | Assigning tasks |
| ⚡ WIZARD RULING: | Wizard | Final decision, binding |
| 🔍 FINDING: / ⚔️ CHALLENGE: | Warrior | Discovery / Challenge |
| 🎯 FINDING: / 🏹 CHALLENGE: | Archer | Discovery / Challenge |
| 💀 FINDING: / 🗡️ CHALLENGE: | Rogue | Discovery / Challenge |
| ✅ CONCEDE: | Any | Conceding (brief, move on) |
