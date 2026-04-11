# Raid Glossary — Concepts & Terminology

A reference for every key term, concept, and convention used in the Raid system.

---

## Agents & Roles

### Wizard
The Dungeon Master. Orchestrates the entire quest — opens phases, dispatches agents, mediates rounds, synthesizes findings, closes phases with binding rulings, and extracts deliverables. The Wizard never writes production code. The Wizard is the only agent that interacts directly with the human.

### Warrior
Party member. Lens: **structural integrity and stress tolerance**. Tests boundaries, load, edge cases, and failure modes. Brings the exact scenario that breaks a proposal. Color: red.

### Archer
Party member. Lens: **pattern consistency and systemic coherence**. Traces ripple effects, catches naming drift, contract violations, and implicit dependencies. Documents with surgical precision. Color: green.

### Rogue
Party member. Lens: **assumption destruction and adversarial robustness**. Thinks like a failing system, malicious input, or race condition. Constructs concrete attack scenarios. Color: orange.

### Party
The three non-Wizard agents: Warrior, Archer, and Rogue. The Canonical Quest always runs with the full party (4 agents total). The party never operates in reduced configurations.

---

## Quest Lifecycle

### Quest
A single Raid session — one complete thread from greeting to PR/commit. A quest has a type (currently only Canonical), a slug-based ID, and a dedicated directory in the Dungeon.

### Canonical Quest
The primary quest type. A 6-phase development cycle: PRD → Design → Plan → Implementation → Review → Wrap Up. Each phase has specific rules, deliverables, and agent interaction patterns.

### Phase
A discrete stage of the quest. Each phase has its own skill, evolution log, deliverable(s), and transition gate. Phases execute in strict order — no skipping, no reordering.

| Phase | Name | Agents | Pattern |
|-------|------|--------|---------|
| 1 | PRD | Wizard + Human only | Dialogue |
| 2 | Design | Full party | Writer / Reviewer / Defend-Concede |
| 3 | Plan | Full party | Writer / Reviewer / Defend-Concede |
| 4 | Implementation | Full party | Strategic task assignment (TDD) |
| 5 | Review | Full party | Reviewer / Converge / Fix Session |
| 6 | Wrap Up | Wizard only | Storyboard, PR, archive |

### Phase Transition Gate
The condition that must be met before the Wizard can close a phase and open the next. Each gate requires human approval and a git commit. Defined in `raid-canonical-protocol`.

---

## Dungeon & Filesystem

### Dungeon
The quest's working directory at `.claude/dungeon/{quest-slug}/`. Contains all phase artifacts organized into two subdirectories: `phases/` and `spoils/`. The Wrap Up storyboard (`phase-6-wrap-up.md`) lives at the quest root, not inside `phases/`.

### Phases Directory (`phases/`)
Contains evolution logs — the raw, round-by-round records of agent work within each phase. Files: `phase-2-design.md`, `phase-3-plan.md`, `phase-4-implementation.md`, `phase-5-review.md`.

### Spoils Directory (`spoils/`)
Contains polished deliverables — the final, Wizard-extracted output of each phase. Files: `prd.md`, `design.md`, `review.md`, `tasks/phase-3-plan-task-NN.md`. Only the Wizard writes to `spoils/`.

### Evolution Log
The round-by-round record of a phase. Lives in `phases/`. Contains versioned agent work (Version 1, Version 2), reviews, defend/concede responses, and Wizard syntheses. Agents write here. The Wizard scaffolds the structure with embedded instructions, then extracts the final deliverable into `spoils/`.

### Deliverable (Spoils)
The polished final output of a phase. Lives in `spoils/`. Extracted by the Wizard from the evolution log after rounds complete. Examples: `design.md` (clean design specification), `review.md` (issue-centric review report).

### Vault
Archive of completed quests at `.claude/vault/{quest-slug}/`. When a quest ends, the Dungeon is moved here for future reference. The vault has an `index.md` registry that tracks all archived quests in a markdown table. Each archived quest retains its original directory structure (`phases/`, `spoils/`, storyboard).

---

## Round-Based Interaction

### Dice Roll
Random shuffle of `["warrior", "archer", "rogue"]` to determine the turn order for a phase. Rolled by the Wizard at the start of each agent phase (Design, Plan, Review, Fix Session). The Implementation phase has no dice roll — the Wizard assigns tasks strategically.

### Turn
One agent's work period within a round. The Wizard dispatches a turn with `TURN_DISPATCH:`, the agent works, then signals `TURN_COMPLETE:`. Only one agent works at a time.

### Round
A complete cycle of 3 sequential turns (one per party member) plus a Wizard synthesis. Minimum 2 rounds per phase, maximum 3.

### Writer
The first agent in the dice-rolled turn order. Produces the initial document (Version 1) in the evolution log. In subsequent rounds, the writer defends or concedes findings and produces revised versions.

### Reviewer
The second and third agents in the dice-rolled turn order. Review the writer's work, pin findings, challenge gaps, and build on prior reviewers' findings.

### Wizard Synthesis
The Wizard's evaluation after each round. Reads all agent work, identifies key findings, unresolved questions, and sets direction for the next round. Pinned to the evolution log under "Wizard [RN] Synthesis."

---

## Defend-Concede Protocol

### DEFEND:
Signal used by the writer when a reviewer's finding is incorrect or does not apply. Must include counter-evidence. The defended item remains unchanged in the next version.

### CONCEDE:
Signal used by the writer when a reviewer's finding is valid. Acknowledges the issue and commits to addressing it in the next version. The conceded item must be incorporated into the revised document.

### False Positive
A finding the writer marks as not applicable — with evidence explaining why. Other reviewers can challenge false positive designations in subsequent rounds.

---

## Communication Signals

| Signal | Direction | Meaning |
|--------|-----------|---------|
| `TURN_DISPATCH:` | Wizard → Agent | Starts an agent's turn with role, context, and file pointers |
| `TURN_COMPLETE:` | Agent → Wizard | Agent finished their turn. All work stops until next dispatch. |
| `FINDING:` | Agent → Evolution Log | Discovery with the agent's own evidence |
| `CHALLENGE:` | Agent → Evolution Log | Prior agent's claim independently verified and found to be wrong |
| `BUILDING:` | Agent → Evolution Log | Prior agent's claim independently verified and extended deeper |
| `DEFEND:` | Writer → Evolution Log | Counter-evidence against a reviewer's finding |
| `CONCEDE:` | Writer → Evolution Log | Acknowledgment that a reviewer's finding is valid |
| `WIZARD:` | Agent → Wizard | Escalation — agent needs project-level context or is stuck |
| `HOLD` | Wizard → All Agents | Freeze all work immediately. Wizard is presenting decisions. |
| `RULING:` | Wizard → All Agents | Binding decision. No appeals. Phase close. |
| `REDIRECT:` | Wizard → Agent | Course correction. One sentence. |
| `DUNGEON:` | Agent → Evolution Log | Pinning a verified finding that survived challenge from 2+ agents |
| `BLACKCARD:` | Agent → Evolution Log | Architecture-breaking finding that cannot be fixed within current design |

---

## Implementation Phase

### Strategic Task Assignment
The Wizard's method of dividing implementation tasks across agents. No dice roll — the Wizard groups tasks by file/domain affinity (tasks touching the same files go to the same agent) and tracks dependency ordering (blocked tasks are deferred). One agent works at a time.

### TDD (Iron Law)
Test-Driven Development is non-negotiable in the Raid. Every implementation follows: write failing test → verify it fails for the right reason → write minimal code to pass → verify pass → run full suite → commit. Enforced by the `raid-tdd` skill.

### Task
A single, numbered implementation unit from the Plan phase. Each task is one TDD cycle (2-5 minutes): specific files, acceptance criteria, and steps. Task files live at `spoils/tasks/phase-3-plan-task-NN.md`.

---

## Review Phase

### Severity Classification
Findings in the Review phase are classified by impact:

| Severity | Definition | Action |
|----------|------------|--------|
| **Critical** | Bugs, security holes, data loss, crashes | Must fix |
| **Important** | Missing features, poor error handling, test gaps | Must fix |
| **Minor** | Style, docs, optimization | Note for future |

### Fix Plan
The converged output of the Review sub-phase. Groups all confirmed findings by severity with proposed fixes and execution order. Extracted by the Wizard into `spoils/review.md`.

### Fix Session
Sub-phase B of Review. Agents execute fixes from `review.md` following TDD, then other agents verify the fixes. Has its own fresh dice roll.

### Black Card
A finding that fundamentally breaks the architecture — unfixable within the current design. Requires 2+ agents to independently verify. The Wizard escalates to the human with options: (a) rollback to an earlier phase, (b) accept the limitation. Black cards are rare.

---

## Document Conventions

### Signing
All agent work is signed with identity and round number: `@warrior [R1]`, `@archer [R2]`, `@rogue [R1]`. By reading any document, you can see who wrote what and when.

### Embedded Instructions
HTML comments (`<!-- ... -->`) inside scaffolded evolution logs that guide agents on what to write in each section. The Wizard fills in actual agent names from the dice roll before dispatching. Removed during final extraction to `spoils/`.

### Scaffolding
The Wizard's act of creating a phase's evolution log with the full template structure — heading, subtitle, references, quest goal, sections with embedded instructions, and writing guidance. The scaffold is the workspace agents write in.

### Phase Spoils
The mandatory output(s) of each phase. Every phase produces at least one detailed markdown artifact. Listed in the Phase Spoils table in `raid-canonical-protocol`.

---

## Session Management

### Raid Session (`.claude/raid-session`)
JSON file tracking the active quest's state: phase, quest type, quest ID, directory, turn order, current round, and black cards. Managed by hooks and Wizard via `jq` commands (the write gate blocks direct Write/Edit on this file).

### Question Chain
The rule that agents never ask the human directly. All questions flow: Agent → `WIZARD:` → Wizard reasons → Wizard asks human (if needed) → Wizard passes answer back with interpretation. The Wizard always digests before passing — never relays raw questions or answers.

### Dispatch
The act of the Wizard activating an agent's turn via `TURN_DISPATCH:`. The dispatch message carries quest context, the agent's role, file pointers, and a directive to read the evolution log's embedded instructions first.

### Send
The act of an agent communicating to the Wizard via `SendMessage`. Used for `TURN_COMPLETE:`, `WIZARD:` escalations, and status reports. Agents never send messages to each other — inter-agent communication flows through evolution log pins.

---

## Skills

### Core Skill
`raid-init` — always loaded first. Handles quest selection, greeting, and session setup.

### Canonical Quest Chain (7 skills)
Phase-specific skills that chain in order: `raid-canonical-protocol` → `raid-canonical-prd` → `raid-canonical-design` → `raid-canonical-implementation-plan` → `raid-canonical-implementation` → `raid-canonical-review` → `raid-wrap-up`. Loaded by the Wizard as phases progress.

### Reusable Skills (6 skills)
Quest-type agnostic, invoked within phases as needed: `raid-tdd`, `raid-verification`, `raid-debugging`, `raid-browser`, `raid-browser-chrome`, `raid-teambuff`.

---

## Git Conventions

### Phase Commit
The Wizard commits at every phase transition. Format:
- PRD/Design/Plan: `docs(quest-{slug}): phase N {name} — {summary}`
- Implementation: `feat(quest-{slug}): phase 4 implementation — {summary}`
- Review: `fix(quest-{slug}): phase 5 review — {N} findings resolved`

### Task Commit
Each implementation task gets its own atomic commit: `feat(scope): descriptive message`. One commit per task — no batching.
