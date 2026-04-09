# Team-Based Orchestration Redesign — Design Spec

**Date:** 2026-04-08
**Status:** Approved
**Scope:** Migrate agent orchestration from subagent dispatch to TeamCreate-based teams with tmux split panes

## Problem

Raid agents run as subagents inside the Wizard's single tmux pane. The user sees one pane with collapsed agent output. There are no split panes, no direct access to individual agents, and no real-time peer-to-peer communication between agents.

The root cause: the Wizard's `tools: Agent(warrior, archer, rogue)` dispatches agents via the Agent tool's subagent mechanism, which runs child agents inside the parent's pane. Claude Code's TeamCreate mechanism spawns teammates into separate tmux panes, but the Raid doesn't use it.

## Design Decisions

- **4 tmux panes** — Wizard + Warrior + Archer + Rogue, each in their own pane
- **User can talk to any agent** — click into any pane, type directly
- **User overrides all agents** — user instructions take precedence over Wizard protocol. Agents follow user instructions and notify the Wizard.
- **Wizard manages protocol** — phase transitions, rulings, mode changes are Wizard's domain, unless the user overrides
- **Dungeon stays** — agents pin verified findings via Write tool, same as today. Dungeon is the durable knowledge artifact.
- **Task list for coordination** — TeamCreate's built-in task list handles work assignment, ownership, and status tracking
- **SendMessage for real-time communication** — agents talk directly to each other, not through the Wizard as relay

## Architecture

### Two coordination systems (complementary)

| System | Purpose | Written by | Read by |
|--------|---------|-----------|---------|
| **Dungeon** (`.claude/raid-dungeon.md`) | Curated findings that survived challenge | All agents (Write tool) | All agents + Wizard |
| **Task list** (`~/.claude/tasks/{team}/`) | Work assignment, ownership, status | Wizard + agents (TaskCreate/TaskUpdate) | All agents |
| **SendMessage** | Real-time conversation, challenges, escalation | All agents | Target agent (auto-delivered) |

### Session lifecycle

```
1. User: claude --agent wizard (inside tmux)
2. Wizard: reads raid-rules.md, raid.json, creates raid-session
3. Wizard: waits for task description
4. User: describes task
5. Wizard: assesses complexity, recommends mode
6. User: approves mode
7. Wizard: TeamCreate(team_name="raid-{mode}-{slug}")
8. Wizard: spawns agents into team (1-3 based on mode)
   Agent(subagent_type="warrior", team_name="raid-...", name="warrior")
   Agent(subagent_type="archer", team_name="raid-...", name="archer")
   Agent(subagent_type="rogue", team_name="raid-...", name="rogue")
   → Each agent gets its own tmux pane automatically
9. Wizard: DISPATCH via SendMessage to each agent
10. Agents self-organize, communicate via SendMessage, pin to Dungeon
11. Wizard observes (messages auto-delivered), intervenes when protocol breaks
12. Wizard closes phase with RULING via SendMessage to all
13. [Repeat phases 1-4]
14. Session end: Wizard sends shutdown_request to each agent
15. Wizard removes raid-session, archives Dungeon
```

### Communication patterns

**Dispatch (Wizard → agents):**
```
SendMessage(to="warrior", message="DISPATCH: [quest + angle]")
SendMessage(to="archer", message="DISPATCH: [quest + angle]")
SendMessage(to="rogue", message="DISPATCH: [quest + angle]")
```

**Challenge (agent → agent):**
```
SendMessage(to="warrior", message="CHALLENGE: handler.js:23 — race condition...")
```

**Escalation (agent → Wizard):**
```
SendMessage(to="wizard", message="WIZARD: stuck on X, tried Y and Z...")
```

**Ruling (Wizard → all):**
```
SendMessage(to="warrior", message="RULING: [decision]. No appeals.")
SendMessage(to="archer", message="RULING: [decision]. No appeals.")
SendMessage(to="rogue", message="RULING: [decision]. No appeals.")
```

**Task assignment (Wizard):**
```
TaskCreate(subject="Implement auth handler", owner="warrior")
SendMessage(to="warrior", message="Task 1 is yours. TDD enforced.")
SendMessage(to="archer", message="Warrior is implementing Task 1. Stand by to challenge.")
```

**User direct interaction:**
User clicks into Warrior's pane and types. Warrior follows the instruction and notifies the Wizard:
```
SendMessage(to="wizard", message="User directed me to [X]. Proceeding.")
```

## Agent Definition Changes

### Wizard (`wizard.md`)

**Frontmatter:**
```yaml
# OLD
tools: Agent(warrior, archer, rogue), Read, Grep, Glob, Bash, Write, Edit

# NEW
tools: TeamCreate, SendMessage, TaskCreate, TaskUpdate, Read, Grep, Glob, Bash, Write, Edit
```

**initialPrompt:**
```
You are the Wizard — dungeon master of the Raid.
Read .claude/raid-rules.md and .claude/raid.json.
Load the raid-protocol skill. Load your agent memory.
Create .claude/raid-session to activate Raid hooks.
Create a team with TeamCreate. Then wait for instructions.
When the user describes a task, assess complexity, recommend a mode,
and spawn teammates (warrior, archer, rogue) into the team.
When the Raid session ends, shut down teammates, remove .claude/raid-session
and all Dungeon files.
```

**Body changes:**
- Pre-Phase: after mode approval, `TeamCreate` + spawn agents via `Agent(subagent_type=..., team_name=..., name=...)`
- Phase 1 (Open): DISPATCH via `SendMessage` instead of `Agent()` calls
- Phase 3 (Observe): read auto-delivered messages instead of Agent() return values
- Phase 4 (Close): broadcast RULING via `SendMessage` to each agent
- New section "Shutdown": send `{type: "shutdown_request"}` to each teammate
- New section "User Override": if user talks to an agent directly, Wizard defers. User instructions override Wizard protocol.

### Warrior, Archer, Rogue

**Frontmatter (all three):**
```yaml
# OLD
tools: Read, Grep, Glob, Bash, Write, Edit

# NEW
tools: SendMessage, TaskCreate, TaskUpdate, Read, Grep, Glob, Bash, Write, Edit
```

**Body changes (all three):**
- New section "Team Communication": use `SendMessage(to="wizard")` for escalations, `SendMessage(to="archer")` for direct peer challenges. Agents discover teammates by reading team config at `~/.claude/teams/{team_name}/config.json`.
- New section "Task Coordination": use `TaskCreate` for discovered work items, `TaskUpdate` to claim and complete tasks.
- New section "User Direct Access": "The user can talk to you directly in your pane. Follow their instructions. If they give a protocol-level instruction, follow it and notify the Wizard via SendMessage."

**What stays the same (all agents):**
- Reasoning cores (5x thinking, stress-testing, pattern-seeking, assumption-destroying)
- Signals (FINDING, CHALLENGE, ROAST, BUILDING ON, DUNGEON, WIZARD, CONCEDE)
- Verification rules (read code yourself before responding)
- Dungeon discipline (pin only verified findings)
- Team rules reference (raid-rules.md)

## Skill Changes

### raid-protocol (MEDIUM change)

**Update these sections:**
- Team Composition: replace subagent dispatch reference with TeamCreate + Agent(team_name) spawning
- Dispatch Pattern: replace Agent() calls with SendMessage pattern
- Session Lifecycle: add team shutdown step
- Add: User Override section — user talks to any agent, agents comply and notify Wizard

**Leave unchanged:** Mode definitions, phase definitions, Iron Laws, reference tables, rules reference.

### raid-design (MEDIUM change)

**Update the DISPATCH pattern only:**
- Replace `Agent(subagent_type="warrior", prompt="...")` with `SendMessage(to="warrior", message="DISPATCH: ...")`
- Add note: agents communicate directly via SendMessage, not only via Dungeon @Name mentions
- Add note: Wizard receives agent messages automatically (auto-delivered when idle)

**Leave unchanged:** Pre-dispatch comprehension, Dungeon template, intervention triggers, close/archive flow.

### raid-implementation (HIGH change)

**Update task assignment model:**
- Wizard creates tasks with `TaskCreate(subject=..., owner="warrior")`
- Wizard dispatches via `SendMessage` instead of `Agent()` calls
- Challengers are notified via `SendMessage` when implementer reports done
- Direct back-and-forth between implementer and challengers via `SendMessage`
- Implementer rotation tracked via task ownership (next task gets `owner="archer"`)

**Leave unchanged:** TDD enforcement, challenge/concede dynamics, Dungeon pinning, intervention triggers.

### Skills NOT changed (10 skills)

These skills reference "agents" abstractly, not the dispatch mechanism:

| Skill | Why no change needed |
|-------|---------------------|
| raid-implementation-plan | Describes plan structure, not dispatch |
| raid-review | References "independent reviews" — works with SendMessage |
| raid-finishing | References "debate completeness" — works with SendMessage |
| raid-tdd | Within single agent's context |
| raid-debugging | References "competing hypotheses" — works with tasks |
| raid-verification | Evidence gathering, unchanged |
| raid-git-worktrees | Workspace creation, unchanged |
| raid-browser | Browser startup, unchanged |
| raid-browser-playwright | Test authoring, unchanged |
| raid-browser-chrome | Browser inspection, unchanged |

## Mode Handling

**Full Raid:** Wizard spawns warrior + archer + rogue → 4 panes

**Skirmish:** Wizard spawns 2 of {warrior, archer, rogue} → 3 panes. Wizard picks the 2 most relevant roles.

**Scout:** Wizard spawns 1 agent → 2 panes. Wizard picks the most relevant role.

**Team naming:** `raid-{mode}-{short-slug}` (e.g., `raid-full-auth-fix`)

**Mid-session escalation:** Wizard spawns additional agents into the existing team. TeamCreate supports adding members after creation.

## File Changes Summary

| File | Change |
|------|--------|
| `template/.claude/agents/wizard.md` | Frontmatter tools, initialPrompt, body sections for TeamCreate/SendMessage |
| `template/.claude/agents/warrior.md` | Frontmatter tools, add Team Communication + Task Coordination + User Direct Access sections |
| `template/.claude/agents/archer.md` | Same as warrior |
| `template/.claude/agents/rogue.md` | Same as warrior |
| `template/.claude/skills/raid-protocol/SKILL.md` | Team Composition, Dispatch Pattern, Session Lifecycle, User Override |
| `template/.claude/skills/raid-design/SKILL.md` | DISPATCH pattern only |
| `template/.claude/skills/raid-implementation/SKILL.md` | Task assignment model |

## Out of Scope

- Dungeon replacement (Dungeon stays as-is)
- Hook changes (hooks gate on file writes, not communication — unchanged)
- raid-rules.md changes
- raid.json changes
- CLI changes (summon, update, heal)
- New skills
- Test changes (agent definitions are markdown, not tested programmatically)
