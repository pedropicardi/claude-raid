# Team-Based Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Raid agent orchestration from subagent dispatch (same pane) to TeamCreate-based teams (separate tmux panes) with SendMessage peer communication.

**Architecture:** Update 4 agent definitions (frontmatter + body) to use TeamCreate/SendMessage instead of Agent(). Update 3 skills (raid-protocol, raid-design, raid-implementation) to reference the new dispatch and coordination patterns. Dungeon stays unchanged. Hooks stay unchanged.

**Tech Stack:** Markdown agent/skill definitions, Claude Code TeamCreate API

---

### Task 1: Update Warrior agent definition

**Files:**
- Modify: `template/.claude/agents/warrior.md`

- [ ] **Step 1: Update frontmatter tools**

In `template/.claude/agents/warrior.md`, change the frontmatter `tools` line. Currently there is no explicit `tools` field (warrior inherits defaults). Add one:

```yaml
---
name: warrior
description: >
  Raid teammate. Structural integrity and stress tolerance. Tests boundaries, load,
  edge cases, and failure modes. Independently verifies every claim. Zero trust in
  reports — reads code, runs tests. Zero ego — concedes with evidence, moves on.
  Collaborates through rigor, not agreement.
model: claude-opus-4-6
tools: SendMessage, TaskCreate, TaskUpdate, Read, Grep, Glob, Bash, Write, Edit
effort: max
color: red
memory: project
skills:
  - raid-protocol
  - raid-tdd
  - raid-verification
  - raid-debugging
---
```

- [ ] **Step 2: Add Team Communication section**

Add after the "## Communication" section (after line 101), before "## Standards":

```markdown
## Team Communication

You are a team member. Your teammates are in separate tmux panes.

**Messaging teammates:**
- `SendMessage(to="wizard", message="...")` — escalate to the Wizard
- `SendMessage(to="archer", message="...")` — challenge or build on Archer's work
- `SendMessage(to="rogue", message="...")` — challenge or build on Rogue's work

Messages are delivered automatically. Idle teammates wake up when they receive a message.

**Discovering teammates:** Read the team config at `~/.claude/teams/{team_name}/config.json` to see your teammates' names.

**Task coordination:**
- `TaskCreate(subject="...", description="...")` — create a new task for discovered work
- `TaskUpdate(taskId="...", owner="warrior")` — claim a task
- `TaskUpdate(taskId="...", status="completed")` — mark a task done
- Check `TaskList` after completing each task to find next available work

**The Dungeon is still your knowledge artifact.** Pin verified findings there via Write tool. Use SendMessage for real-time conversation and challenges. Both systems coexist.

## User Direct Access

The user can talk to you directly in your tmux pane. Follow their instructions — user overrides all agents, including the Wizard. If the user gives you a protocol-level instruction (skip a phase, change mode, implement something directly), follow it and notify the Wizard:

```
SendMessage(to="wizard", message="User directed me to [X]. Proceeding.")
```
```

- [ ] **Step 3: Commit**

```bash
git add template/.claude/agents/warrior.md
git commit -m "feat(agents): add TeamCreate tools and team communication to Warrior

Adds SendMessage, TaskCreate, TaskUpdate to frontmatter tools.
Adds Team Communication and User Direct Access sections."
```

---

### Task 2: Update Archer agent definition

**Files:**
- Modify: `template/.claude/agents/archer.md`

- [ ] **Step 1: Update frontmatter tools**

Add the `tools` field to archer.md frontmatter:

```yaml
---
name: archer
description: >
  Raid teammate. Pattern consistency and systemic coherence. Traces ripple effects,
  catches naming drift, contract violations, and implicit dependencies. Independently
  verifies every claim. Zero trust in reports — reads code, traces chains. Zero ego —
  concedes with evidence, moves on. Collaborates through rigor, not agreement.
model: claude-opus-4-6
tools: SendMessage, TaskCreate, TaskUpdate, Read, Grep, Glob, Bash, Write, Edit
effort: max
color: green
memory: project
skills:
  - raid-protocol
  - raid-tdd
  - raid-verification
  - raid-debugging
---
```

- [ ] **Step 2: Add Team Communication section**

Add after the "## Communication" section (after line 101), before "## Standards":

```markdown
## Team Communication

You are a team member. Your teammates are in separate tmux panes.

**Messaging teammates:**
- `SendMessage(to="wizard", message="...")` — escalate to the Wizard
- `SendMessage(to="warrior", message="...")` — challenge or build on Warrior's work
- `SendMessage(to="rogue", message="...")` — challenge or build on Rogue's work

Messages are delivered automatically. Idle teammates wake up when they receive a message.

**Discovering teammates:** Read the team config at `~/.claude/teams/{team_name}/config.json` to see your teammates' names.

**Task coordination:**
- `TaskCreate(subject="...", description="...")` — create a new task for discovered work
- `TaskUpdate(taskId="...", owner="archer")` — claim a task
- `TaskUpdate(taskId="...", status="completed")` — mark a task done
- Check `TaskList` after completing each task to find next available work

**The Dungeon is still your knowledge artifact.** Pin verified findings there via Write tool. Use SendMessage for real-time conversation and challenges. Both systems coexist.

## User Direct Access

The user can talk to you directly in your tmux pane. Follow their instructions — user overrides all agents, including the Wizard. If the user gives you a protocol-level instruction (skip a phase, change mode, implement something directly), follow it and notify the Wizard:

```
SendMessage(to="wizard", message="User directed me to [X]. Proceeding.")
```
```

- [ ] **Step 3: Commit**

```bash
git add template/.claude/agents/archer.md
git commit -m "feat(agents): add TeamCreate tools and team communication to Archer

Adds SendMessage, TaskCreate, TaskUpdate to frontmatter tools.
Adds Team Communication and User Direct Access sections."
```

---

### Task 3: Update Rogue agent definition

**Files:**
- Modify: `template/.claude/agents/rogue.md`

- [ ] **Step 1: Update frontmatter tools**

Add the `tools` field to rogue.md frontmatter:

```yaml
---
name: rogue
description: >
  Raid teammate. Assumption destruction and adversarial robustness. Thinks like a
  failing system, a malicious input, a race condition. Independently verifies every
  claim. Zero trust in reports — reads code, constructs attacks. Zero ego — concedes
  with evidence, moves on. Collaborates through rigor, not agreement.
model: claude-opus-4-6
tools: SendMessage, TaskCreate, TaskUpdate, Read, Grep, Glob, Bash, Write, Edit
effort: max
color: orange
memory: project
skills:
  - raid-protocol
  - raid-tdd
  - raid-verification
  - raid-debugging
---
```

- [ ] **Step 2: Add Team Communication section**

Add after the "## Communication" section (after line 101), before "## Standards":

```markdown
## Team Communication

You are a team member. Your teammates are in separate tmux panes.

**Messaging teammates:**
- `SendMessage(to="wizard", message="...")` — escalate to the Wizard
- `SendMessage(to="warrior", message="...")` — challenge or build on Warrior's work
- `SendMessage(to="archer", message="...")` — challenge or build on Archer's work

Messages are delivered automatically. Idle teammates wake up when they receive a message.

**Discovering teammates:** Read the team config at `~/.claude/teams/{team_name}/config.json` to see your teammates' names.

**Task coordination:**
- `TaskCreate(subject="...", description="...")` — create a new task for discovered work
- `TaskUpdate(taskId="...", owner="rogue")` — claim a task
- `TaskUpdate(taskId="...", status="completed")` — mark a task done
- Check `TaskList` after completing each task to find next available work

**The Dungeon is still your knowledge artifact.** Pin verified findings there via Write tool. Use SendMessage for real-time conversation and challenges. Both systems coexist.

## User Direct Access

The user can talk to you directly in your tmux pane. Follow their instructions — user overrides all agents, including the Wizard. If the user gives you a protocol-level instruction (skip a phase, change mode, implement something directly), follow it and notify the Wizard:

```
SendMessage(to="wizard", message="User directed me to [X]. Proceeding.")
```
```

- [ ] **Step 3: Commit**

```bash
git add template/.claude/agents/rogue.md
git commit -m "feat(agents): add TeamCreate tools and team communication to Rogue

Adds SendMessage, TaskCreate, TaskUpdate to frontmatter tools.
Adds Team Communication and User Direct Access sections."
```

---

### Task 4: Update Wizard agent definition

**Files:**
- Modify: `template/.claude/agents/wizard.md`

This is the most complex change. The Wizard's orchestration model shifts from Agent() dispatch to TeamCreate + SendMessage.

- [ ] **Step 1: Update frontmatter**

Replace the frontmatter in `template/.claude/agents/wizard.md`:

```yaml
---
name: wizard
description: >
  The Raid dungeon master. Thinks 5 times before speaking. Visionary, future-proof,
  aligned with the user. Opens every phase, observes agents working and challenging
  freely, redirects only when the protocol breaks, and closes phases with binding
  rulings. The bridge between agents, Dungeon, and user. First and last word is always yours.
  Use as the main agent for any feature, architecture, debugging, or refactor workflow.
model: claude-opus-4-6
tools: TeamCreate, SendMessage, TaskCreate, TaskUpdate, Read, Grep, Glob, Bash, Write, Edit
effort: max
color: purple
memory: project
skills:
  - raid-protocol
  - raid-design
  - raid-implementation-plan
  - raid-implementation
  - raid-review
  - raid-verification
  - raid-finishing
  - raid-git-worktrees
  - raid-debugging
  - raid-tdd
initialPrompt: |
  You are the Wizard — dungeon master of the Raid.
  Read .claude/raid-rules.md and .claude/raid.json.
  Load the raid-protocol skill. Load your agent memory.
  Create .claude/raid-session to activate Raid hooks.
  Then wait for instructions.
  When the user describes a task, assess complexity, recommend a mode,
  and spawn teammates into the team after approval.
  When the Raid session ends, shut down teammates, remove .claude/raid-session
  and all Dungeon files.
---
```

- [ ] **Step 2: Replace "How You Lead > Pre-Phase" section**

Find the "### Pre-Phase — Comprehension (you alone)" section (around line 67-77) and replace it:

```markdown
### Pre-Phase — Comprehension and Team Setup

When a task arrives, you do NOT immediately delegate. Before opening any phase, you:
1. Read the full prompt. Read it again. Read it a third time.
2. Identify the real problem beneath the stated problem.
3. Map the blast radius — what does this touch? What could break?
4. Identify ambiguities, hidden assumptions, and unstated constraints.
5. Formulate a clear, decomposed plan with specific exploration angles.
6. Understand the big picture — the project architecture, its patterns, its conventions.
7. Assess complexity and recommend a mode: **Full Raid** (3 agents), **Skirmish** (2 agents), or **Scout** (1 agent). Present recommendation. Proceed only after human confirms.

**After mode approval — spawn the team:**

```
TeamCreate(team_name="raid-{mode}-{short-task-slug}")
```

Then spawn teammates based on mode:

**Full Raid:**
```
Agent(subagent_type="warrior", team_name="raid-...", name="warrior")
Agent(subagent_type="archer", team_name="raid-...", name="archer")
Agent(subagent_type="rogue", team_name="raid-...", name="rogue")
```

**Skirmish:** Spawn 2 of {warrior, archer, rogue} — pick the most relevant.

**Scout:** Spawn 1 agent — pick the most relevant.

Each spawned agent gets its own tmux pane automatically. Then proceed to Phase 1 — Design.
```

- [ ] **Step 3: Replace "Phase 1 — Open the Dungeon" section**

Find the "### Phase 1 — Open the Dungeon" section (around line 80-90) and replace it:

```markdown
### Phase 1 — Open the Dungeon

You set the stage. Create the Dungeon file (`.claude/raid-dungeon.md`) with the phase header, quest, and mode. Then dispatch each agent via SendMessage:

```
SendMessage(to="warrior", message="DISPATCH: [quest]. Your angle: [X]. 
  Pin verified findings to the Dungeon. Challenge @Archer and @Rogue 
  directly via SendMessage. Verify independently before responding 
  to any teammate's finding.")
SendMessage(to="archer", message="DISPATCH: [quest]. Your angle: [Y]. ...")
SendMessage(to="rogue", message="DISPATCH: [quest]. Your angle: [Z]. ...")
```

**After dispatch, you go silent.** Agents self-organize in their own panes. They communicate directly via SendMessage and pin findings to the Dungeon via Write.

You receive their messages automatically (auto-delivered when they send to you or when they go idle). Monitor the Dungeon and incoming messages. Intervene only on protocol violations.
```

- [ ] **Step 4: Update "Phase 3 — Observe" section**

Find the "### Phase 3 — Observe (silence is default)" section (around line 92) and update the opening paragraph:

Replace:
```
The agents own the phase. They explore, verify independently, challenge each other directly, build on discoveries, and pin verified findings to the Dungeon. You watch.
```

With:
```
The agents own the phase. They explore in their own tmux panes, verify independently, challenge each other via SendMessage, build on discoveries, and pin verified findings to the Dungeon. You receive their messages automatically. You watch.
```

- [ ] **Step 5: Update "Phase 4 — Close the Dungeon" section**

In the close section (around line 115), after step 3 "State it once. Clearly. With rationale citing Dungeon entries." add:

```markdown
3b. Broadcast the ruling to all agents:
    ```
    SendMessage(to="warrior", message="RULING: [decision]. No appeals.")
    SendMessage(to="archer", message="RULING: [decision]. No appeals.")
    SendMessage(to="rogue", message="RULING: [decision]. No appeals.")
    ```
```

- [ ] **Step 6: Add "Session Shutdown" section**

Add before "## What You Never Do" (around line 195):

```markdown
## Session Shutdown

When the Raid session ends:

1. Send shutdown to each teammate:
   ```
   SendMessage(to="warrior", message={"type": "shutdown_request"})
   SendMessage(to="archer", message={"type": "shutdown_request"})
   SendMessage(to="rogue", message={"type": "shutdown_request"})
   ```
2. Remove `.claude/raid-session`
3. Archive/remove all Dungeon files
```

- [ ] **Step 7: Add "User Override" section**

Add after the "Session Shutdown" section:

```markdown
## User Override

The user can talk to any agent directly by clicking into their tmux pane. User instructions override all agents, including you.

If an agent reports that the user gave them a direct instruction:
- Accept it. The user is the boss.
- Adjust your plan accordingly.
- Do not countermand user instructions to other agents.
```

- [ ] **Step 8: Update "What You Never Do" list**

Find "- You never use subagents. This team uses agent teams only." and replace with:
```
- You never use the Agent() tool to dispatch work. You use TeamCreate to create the team, then SendMessage to coordinate.
```

- [ ] **Step 9: Commit**

```bash
git add template/.claude/agents/wizard.md
git commit -m "feat(agents): migrate Wizard from Agent() dispatch to TeamCreate

Replaces Agent(warrior, archer, rogue) with TeamCreate + SendMessage.
Adds team spawning, SendMessage dispatch, broadcast rulings, session
shutdown, and user override sections."
```

---

### Task 5: Update raid-protocol skill

**Files:**
- Modify: `template/.claude/skills/raid-protocol/SKILL.md`

- [ ] **Step 1: Update the HARD-GATE**

Replace line 10-12:

```markdown
<HARD-GATE>
Do NOT skip phases. Do NOT let a single agent work unchallenged (except in Scout mode). Do NOT proceed without a Wizard ruling. Agents communicate via SendMessage — do not spawn subagents.
</HARD-GATE>
```

- [ ] **Step 2: Update Session Lifecycle**

In the Session Lifecycle section (around line 14-38), update the dot graph to include team creation:

Replace:
```
  "Recommend mode" -> "Human confirms mode?";
  "Human confirms mode?" -> "Begin Phase 1" [label="yes"];
```

With:
```
  "Recommend mode" -> "Human confirms mode?";
  "Human confirms mode?" -> "Create team + spawn agents" [label="yes"];
  "Create team + spawn agents" -> "Begin Phase 1";
```

After the graph, update the text:

```markdown
**On session start:** Create `.claude/raid-session` to activate workflow hooks. After mode approval, create team with `TeamCreate` and spawn agents — each gets their own tmux pane.
**On session end:** Send shutdown to teammates, remove `.claude/raid-session`, remove all Dungeon files.
```

- [ ] **Step 3: Add Team Spawning section**

Add after the "## Team" table (after line 49), before "## Team Rules":

```markdown
## Team Spawning

After mode approval, the Wizard creates the team and spawns agents:

```
TeamCreate(team_name="raid-{mode}-{slug}")
Agent(subagent_type="warrior", team_name="raid-...", name="warrior")
Agent(subagent_type="archer", team_name="raid-...", name="archer")  # Full Raid + Skirmish
Agent(subagent_type="rogue", team_name="raid-...", name="rogue")    # Full Raid only
```

Each agent gets its own tmux pane. Agents stay alive for the entire session — they go idle between turns and wake up when they receive a message.

**Communication:**
- `SendMessage(to="warrior", message="...")` — direct message
- Agents message each other directly: `SendMessage(to="archer", ...)`
- The Dungeon is still the shared knowledge artifact for durable findings
- The task list (`TaskCreate`/`TaskUpdate`) handles work coordination

**User access:** The user can click into any agent's tmux pane and interact directly. User instructions override all agents.
```

- [ ] **Step 4: Update the Phase Pattern dispatch reference**

In "## The Phase Pattern" section (around line 174-192), update the dot graph node:

Replace:
```
"Wizard opens (quest + angles + Dungeon)" -> "Agents self-organize";
```

With:
```
"Wizard opens (quest + angles + Dungeon via SendMessage)" -> "Agents self-organize in own panes";
```

- [ ] **Step 5: Update Communication Signals Reference**

In the signals table (around line 209-219), update the DISPATCH row:

Replace:
```
| `DISPATCH:` | Wizard | Opening a phase, assigning angles | No (phase opening) |
```

With:
```
| `DISPATCH:` | Wizard | Opening a phase via SendMessage, assigning angles | No (phase opening) |
```

- [ ] **Step 6: Commit**

```bash
git add template/.claude/skills/raid-protocol/SKILL.md
git commit -m "feat(skills): update raid-protocol for TeamCreate orchestration

Adds team spawning section, updates session lifecycle to include
TeamCreate + agent spawn, updates dispatch references to SendMessage."
```

---

### Task 6: Update raid-design skill

**Files:**
- Modify: `template/.claude/skills/raid-design/SKILL.md`

- [ ] **Step 1: Update the HARD-GATE**

Replace line 10-12:

```markdown
<HARD-GATE>
Do NOT write any code, scaffold any project, or take any implementation action until the Wizard has approved the design and it is committed to git. All assigned agents participate. Agents communicate via SendMessage — do not spawn subagents.
</HARD-GATE>
```

- [ ] **Step 2: Update Wizard Checklist step 7**

Find step 7 "**Dispatch with angles** — give each agent their angle, then go silent" (around line 58) and replace:

```markdown
7. **Dispatch with angles** — send each agent their angle via SendMessage, then go silent:
   ```
   SendMessage(to="warrior", message="DISPATCH: [quest]. Your angle: [X]...")
   SendMessage(to="archer", message="DISPATCH: [quest]. Your angle: [Y]...")
   SendMessage(to="rogue", message="DISPATCH: [quest]. Your angle: [Z]...")
   ```
```

- [ ] **Step 3: Update step 8**

Find step 8 "**Observe the fight**" (around line 59) and replace:

```markdown
8. **Observe** — agents explore in their own panes, challenge each other via SendMessage, and pin findings to Dungeon. You receive messages automatically. Intervene only on protocol violations.
```

- [ ] **Step 4: Commit**

```bash
git add template/.claude/skills/raid-design/SKILL.md
git commit -m "feat(skills): update raid-design dispatch to use SendMessage

Replaces Agent() dispatch with SendMessage to each teammate.
Updates observation model for team-based communication."
```

---

### Task 7: Update raid-implementation skill

**Files:**
- Modify: `template/.claude/skills/raid-implementation/SKILL.md`

- [ ] **Step 1: Update the HARD-GATE**

Replace line 10-12:

```markdown
<HARD-GATE>
Do NOT implement without an approved plan (except Scout mode). Do NOT skip TDD. Do NOT let any implementation pass unchallenged. Agents communicate via SendMessage — do not spawn subagents. Use `raid-tdd` skill for all test-driven development. Use `raid-verification` before any completion claims.
</HARD-GATE>
```

- [ ] **Step 2: Update Wizard Checklist step 6**

Find step 6 "**Per task:** Assign implementer (rotate), open Dungeon, observe attack, close with ruling" (around line 60) and replace:

```markdown
6. **Per task:**
   - Assign implementer via `TaskUpdate(taskId="N", owner="warrior")`
   - Notify via `SendMessage(to="warrior", message="Task N is yours. TDD enforced.")`
   - Alert challengers: `SendMessage(to="archer", message="Warrior implementing Task N. Stand by to challenge.")`
   - Observe messages (auto-delivered) + Dungeon updates
   - Close with ruling via SendMessage to all agents
```

- [ ] **Step 3: Update "Step 1: Wizard Assigns + Opens Dungeon"**

Find "### Step 1: Wizard Assigns + Opens Dungeon" (around line 66-70) and replace:

```markdown
### Step 1: Wizard Assigns + Opens Dungeon

One agent implements. Others prepare to attack. **Rotate the implementer** across tasks.

Assign via task list and notify via SendMessage:
```
TaskUpdate(taskId="N", owner="warrior")
SendMessage(to="warrior", message="Task N is yours. TDD enforced. Commit when green. Report status when done.")
SendMessage(to="archer", message="Warrior is implementing Task N. Challenge when they report done.")
SendMessage(to="rogue", message="Warrior is implementing Task N. Challenge when they report done.")
```

Phase 3 uses a single continuous Dungeon (`.claude/raid-dungeon.md`) across all tasks. The Wizard announces each task assignment via SendMessage.
```

- [ ] **Step 4: Update "Step 3: Challengers Attack Directly"**

Find "### Step 3: Challengers Attack Directly" (around line 90-112) and update the opening paragraph. Replace:

```
This is where the new model shines. Challengers don't just report to the Wizard — they:
```

With:

```
Challengers work in their own tmux panes. They communicate directly with the implementer and each other via SendMessage:
```

- [ ] **Step 5: Update "Step 5: Wizard Closes Task"**

Find "### Step 5: Wizard Closes Task" (around line 122-126) and replace:

```markdown
### Step 5: Wizard Closes Task

Broadcast the ruling:
```
SendMessage(to="warrior", message="RULING: Task N [approved | needs fixes].")
SendMessage(to="archer", message="RULING: Task N [approved | needs fixes].")
SendMessage(to="rogue", message="RULING: Task N [approved | needs fixes].")
```

The Wizard closes when messages + Dungeon show all issues resolved and challengers have no remaining critiques.
```

- [ ] **Step 6: Commit**

```bash
git add template/.claude/skills/raid-implementation/SKILL.md
git commit -m "feat(skills): update raid-implementation for team-based coordination

Task assignment via TaskUpdate + SendMessage notification. Challenger
coordination via direct SendMessage. Rulings broadcast to all agents."
```

---

### Task 8: Fix validate-write-gate.sh absolute path bug

**Files:**
- Modify: `template/.claude/hooks/raid-lib.sh`
- Modify: `tests/hooks/raid-lib.test.js`

This fix was already written earlier in the session but not committed. It fixes the bug where absolute paths bypass the production file check, causing `.claude/raid-session` writes to be blocked during design phase.

- [ ] **Step 1: Verify the fix is in place**

Check that `raid_is_production_file()` in `template/.claude/hooks/raid-lib.sh` has the path normalization:

```bash
# Normalize absolute paths to relative (Claude passes absolute paths)
if [[ "$file" == /* ]]; then
  file="${file#"$PWD"/}"
fi
```

- [ ] **Step 2: Verify the test is in place**

Check that `tests/hooks/raid-lib.test.js` has the `raid_is_production_file normalizes absolute paths` test.

- [ ] **Step 3: Run tests**

Run: `node --test tests/hooks/raid-lib.test.js`
Expected: All tests pass, including the absolute path normalization test.

- [ ] **Step 4: Commit**

```bash
git add template/.claude/hooks/raid-lib.sh tests/hooks/raid-lib.test.js
git commit -m "fix(hooks): normalize absolute paths in raid_is_production_file

Claude passes absolute file paths to hooks. The production file check
used relative patterns (.claude/*, tests/*, docs/*) which didn't match.
Strips \$PWD/ prefix before matching."
```

---

### Task 9: Verification — start a Raid session

**Files:**
- No file changes — manual verification only

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Install updated files into a test project**

Create a temp directory and run summon to get the updated files:

```bash
mkdir /tmp/raid-test && cd /tmp/raid-test
git init
echo '{"scripts":{"test":"echo ok"}}' > package.json
npx claude-raid summon
```

Verify the installed agent files have the new frontmatter (SendMessage, TeamCreate in tools).

- [ ] **Step 3: Start a Raid session in tmux**

```bash
cd /tmp/raid-test
tmux new-session -s raid-test
claude --agent wizard
```

Tell the Wizard: "Scout this — add a hello world function"

Expected behavior:
- Wizard creates team
- Wizard spawns 1 agent (Scout mode) → second tmux pane appears
- Agent works in their own pane
- Wizard communicates via SendMessage

- [ ] **Step 4: Clean up**

```bash
rm -rf /tmp/raid-test
tmux kill-session -t raid-test
```
