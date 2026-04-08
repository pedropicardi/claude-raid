# The Dungeon — Shared Knowledge + Free Agent Interaction

**Date:** 2026-04-08
**Status:** Approved
**Author:** Pedro Picardi + Wizard (Claude)

---

## Problem

Agents in The Raid operate in isolated bursts. Communication is Wizard-mediated — agents report to the Wizard, Wizard synthesizes, Wizard dispatches next round. This creates three problems:

1. **Agents miss each other's discoveries.** No shared persistent state means Agent A's finding doesn't reach Agent B unless the Wizard relays it.
2. **Cross-testing is shallow.** Agents react to findings but don't build on each other's work deeply — they challenge in isolation rather than collaborating.
3. **Wizard bottleneck.** All communication routes through the Wizard, making the 90/10 observation rule impossible in practice.

## Solution

Two-layer communication system:

1. **The Dungeon** — A curated, phase-scoped shared knowledge artifact (`.claude/raid-dungeon.md`). Contains only verified findings, active battles, shared knowledge, key decisions, and escalation points. Not a log.
2. **Direct interaction protocols** — Agents address each other by name, challenge freely, roast with evidence, build on each other's work, and escalate to Wizard only when stuck.

The Wizard shifts from dispatcher/mediator to dungeon master — opens phases, observes silently, intervenes on triggers, closes phases with binding rulings.

---

## The Dungeon

### Structure

```markdown
# Dungeon — Phase N: <Phase Name>
## Quest: <task description>
## Mode: <Full Raid | Skirmish | Scout>

### Discoveries
<!-- Verified findings that survived challenge, tagged with agent name -->

### Active Battles
<!-- Ongoing unresolved challenges between agents -->

### Resolved
<!-- Challenges that reached conclusion — conceded, proven, or Wizard-ruled -->

### Shared Knowledge
<!-- Facts established as true by 2+ agents agreeing or surviving challenge -->

### Escalations
<!-- Points where agents pulled the Wizard in -->
```

### Lifecycle

- **Wizard creates** the Dungeon when opening a phase (part of dispatch).
- **Agents read/write** during the phase — only via `📌 DUNGEON:` signal.
- **Wizard archives** when closing a phase — renames to `.claude/raid-dungeon-phase-N.md`.
- **Wizard creates** fresh Dungeon for next phase.
- **Agents reference** archived Dungeons from prior phases (Design knowledge carries into Plan, etc.).
- **`remove` command** cleans up all Dungeon files.

### Curation Rules

**What goes IN the Dungeon:**
- Findings that survived a challenge (verified truths)
- Active unresolved battles (prevents re-litigation)
- Shared knowledge promoted by 2+ agents agreeing
- Key decisions and their reasoning
- Escalation points for the Wizard

**What stays in conversation only:**
- Back-and-forth of challenges and roasts
- Exploratory thinking and hypotheses
- Concessions and rebuttals
- Anything that didn't produce a durable insight

The conversation is the sparring ring. The Dungeon is the scoreboard.

### Gitignore

Dungeon files are session artifacts, not project history. Added to `.gitignore`:
- `.claude/raid-dungeon.md`
- `.claude/raid-dungeon-phase-*.md`

---

## Agent Interaction Protocols

### Communication Signals

| Signal | Meaning | Goes to Dungeon? |
|---|---|---|
| `@Name, ...` | Direct address to specific agent | No |
| `🔍/🎯/💀 FINDING:` | Discovery with evidence (agent-specific emoji) | Only after surviving challenge |
| `⚔️/🏹/🗡️ CHALLENGE:` | Direct challenge to another agent | No |
| `🔥 ROAST:` | Pointed critique backed by evidence | No |
| `🔗 BUILDING ON @Name:` | Extending another agent's work | Result goes to Dungeon if verified |
| `✅ CONCEDE:` | Admitting wrong, moving on | No |
| `📌 DUNGEON:` | Posting a verified finding to the Dungeon | Yes — this is the write gate |
| `🆘 WIZARD:` | Escalation — needs Wizard input | Yes (as escalation point) |

### Key Rule

Only `📌 DUNGEON:` writes to the Dungeon. This is the filter that keeps it curated. An agent must explicitly decide "this is worth pinning." Other agents can challenge whether a pinned finding belongs there.

### Phase Lifecycle

1. **Wizard opens** — Sets the quest, assigns angles, creates Dungeon.
2. **Agents unleash** — They own the phase. Explore, challenge, roast, build, share. No waiting for Wizard turns.
3. **Agents escalate** — When stuck, uncertain, or fundamentally split: `🆘 WIZARD:`.
4. **Wizard intervenes** — Only on triggers: destructive loops, drift, deadlock, laziness, ego, misinformation.
5. **Wizard closes** — Calls the phase, delivers binding ruling citing Dungeon evidence, archives Dungeon.

### Direct Interaction Rules

- Evidence required for all challenges and roasts. No "I disagree" without proof.
- Build on each other's work explicitly. `🔗 BUILDING ON @Name:` forces credit and continuity.
- Concede instantly when proven wrong. No ego. Then find a new angle.
- Escalate to Wizard when: 2+ agents are stuck on the same disagreement for 3+ exchanges, an agent is uncertain about project-level context, the team needs a decision that affects the quest direction.
- Don't escalate when: you can resolve it by reading the code, another agent already answered, it's a matter of opinion that doesn't affect the outcome.

---

## Wizard Role

### Responsibilities

| Action | When |
|---|---|
| **Open phase** | Always first. Sets quest, assigns angles, creates Dungeon |
| **Observe silently** | Default state. Reads everything, says nothing |
| **Intervene** | Destructive loop (same arguments 3+ rounds), drift from objective, deadlock (agents stuck, no progress), laziness (shallow work), ego (won't concede with evidence against), misinformation (wrong finding posted to Dungeon) |
| **Answer escalations** | When an agent sends `🆘 WIZARD:` |
| **Close phase** | When the Wizard judges the phase objective is met |
| **Deliver ruling** | Binding. Synthesizes from Dungeon entries. |

### What the Wizard Stops Doing

- Dispatching individual turns within a phase
- Mediating every challenge
- Asking each agent to report findings
- Synthesizing after every round of interaction

### Wizard Signals

| Signal | Meaning |
|---|---|
| `⚡ WIZARD OBSERVES:` | Brief note without stopping action — course correction, hint |
| `⚡ WIZARD INTERVENES:` | Stops the action. Something is wrong. Agents must address before continuing |
| `⚡ WIZARD RULING:` | Phase is over. Binding decision. |

### The 90/10 Rule Becomes Real

The Wizard speaks at phase boundaries (open/close) and intervention triggers. Everything else is silence. The agents drive the work.

---

## Skill Rework

### Universal Pattern Change

| Current | New |
|---|---|
| Wizard dispatches → each agent reports → Wizard synthesizes → repeat | Wizard opens → agents self-organize and interact → Wizard closes |
| Agents address the Wizard | Agents address each other, escalate to Wizard |
| Wizard collects findings | Agents pin findings to Dungeon themselves via `📌 DUNGEON:` |
| Wizard decides when agents are done | Agents naturally converge; Wizard confirms and closes |

### Per-Skill Changes

**raid-protocol** — Major rewrite. Add Dungeon lifecycle management (create, archive, reference). Replace turn-based dispatch with open/close bookend model. Add interaction protocol reference table. Add Dungeon curation rules. Update intervention triggers.

**raid-design** — Wizard opens with quest + angles. Agents explore freely, challenge each other's findings directly, build on discoveries, roast weak analysis. Pin verified findings to Dungeon. Wizard closes when Dungeon has enough verified findings to form 2-3 approaches. Wizard synthesizes approaches from Dungeon, not from conversation.

**raid-implementation-plan** — Wizard opens with design doc reference. Agents decompose independently then compare directly — arguing task ordering, coverage, naming. Pin agreed-upon tasks to Dungeon. Wizard closes when task list is complete and verified by cross-challenge.

**raid-implementation** — "One builds, others attack" rotation stays. Attackers interact with each other too — building on each other's attacks. Implementer defends against both simultaneously. Wizard rotates the implementer role and closes each task.

**raid-review** — Agents review independently then go at each other's findings. Pin severity-classified issues to Dungeon. Wizard closes when all Critical/Important issues are addressed.

**raid-finishing** — Completeness debate is a free-for-all. Agents argue directly about what's missing vs. done. Wizard closes with final verdict and merge options.

**raid-tdd** — Challengers attack test quality by building on each other's critiques.

**raid-debugging** — Competing hypotheses become a real debate. Agents argue root cause directly, converge on strongest hypothesis. Wizard intervenes if 3+ attempts fail.

**raid-verification** — Challengers verify independently then cross-check each other's verification.

**raid-git-worktrees** — Minimal change. Procedural, not collaborative.

### Skill Quality Standard

All skills must be comprehensive, prescriptive, and detailed — matching the quality bar of superpowers skills. Each skill includes:
- Explicit flow with defined steps
- Checklists with concrete items
- Red flags and rationalization tables where applicable
- Forbidden patterns and phrases
- Hard gates that cannot be skipped
- Communication signal reference
- Dungeon interaction rules specific to that phase
- Mode-specific behavior (Full Raid / Skirmish / Scout)

---

## Team Rules Additions

Add to the existing 13 rules in `raid-rules.md`:

14. **Dungeon discipline** — Only pin verified findings. Don't spam. If challenged on a pin, defend or remove it.
15. **Direct engagement** — Address agents by name. Build on each other's work explicitly. No broadcasting into void.
16. **Escalate wisely** — Pull the Wizard when stuck, not when lazy. If you can resolve it by reading code or talking to another agent, do that first.
17. **Roast with evidence** — Every roast carries proof. "This is wrong" without showing why is laziness, not challenge.

---

## CLI Changes

- `init` — Creates Dungeon template, adds Dungeon files to `.gitignore`.
- `remove` — Cleans up all Dungeon files (active + archived).
- `update` — Refreshes Dungeon template if format changed.

---

## Hook Changes

Minimal. Existing hooks are tool-boundary gates, not communication gates. No new hooks needed.

Phase-gate hook may optionally reference Dungeon for richer validation (archived Design Dungeon = design phase complete), but this is a nice-to-have, not required.

---

## What Doesn't Change

- 4-phase workflow (Design → Plan → Implementation → Review → Finishing)
- 3 modes (Full Raid, Skirmish, Scout)
- TDD Iron Law
- Verification Iron Law
- Agent core personalities (Warrior aggressive, Archer precise, Rogue adversarial)
- Conventional commits, file naming, placeholder validation hooks
- CLI commands (init/update/remove/doctor)
- Zero dependencies

---

## Files Touched

- `template/.claude/agents/wizard.md` — major rewrite
- `template/.claude/agents/warrior.md` — major rewrite
- `template/.claude/agents/archer.md` — major rewrite
- `template/.claude/agents/rogue.md` — major rewrite
- `template/.claude/skills/raid-protocol/SKILL.md` — major rewrite
- `template/.claude/skills/raid-design/SKILL.md` — significant rework
- `template/.claude/skills/raid-implementation-plan/SKILL.md` — significant rework
- `template/.claude/skills/raid-implementation/SKILL.md` — significant rework
- `template/.claude/skills/raid-review/SKILL.md` — significant rework
- `template/.claude/skills/raid-finishing/SKILL.md` — moderate rework
- `template/.claude/skills/raid-tdd/SKILL.md` — moderate rework
- `template/.claude/skills/raid-debugging/SKILL.md` — moderate rework
- `template/.claude/skills/raid-verification/SKILL.md` — moderate rework
- `template/.claude/skills/raid-git-worktrees/SKILL.md` — minimal change
- `template/.claude/raid-rules.md` — additions (rules 14-17)
- `src/init.js` — Dungeon template creation, gitignore entries
- `src/remove.js` — Dungeon cleanup
- `src/update.js` — Dungeon template refresh
- `README.md` — reflect new communication model
