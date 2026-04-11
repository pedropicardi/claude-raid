---
name: raid-init
description: "Use when starting a new Raid session or resuming an existing quest. Loaded first by the Wizard before any phase begins."
---

# Raid Init — Quest Selection & Session Setup

The first skill loaded when the Wizard starts. Guides the greeting, quest selection, and session bootstrap.

<HARD-GATE>
Do NOT skip the greeting. Do NOT skip quest selection. Do NOT begin any phase without the human choosing a quest type and confirming the mode.
</HARD-GATE>

## Process Flow

```dot
digraph init {
  "Read rules + raid.json" -> "Check for in-progress quests";
  "Check for in-progress quests" -> "Offer to resume?" [shape=diamond];
  "Offer to resume?" -> "Resume existing quest" [label="yes, human confirms"];
  "Offer to resume?" -> "Greet the human" [label="no"];
  "Greet the human" -> "Present quest menu";
  "Present quest menu" -> "Canonical Quest?" [shape=diamond];
  "Canonical Quest?" -> "Ask: PRD needed?" [label="A"];
  "Canonical Quest?" -> "Coming soon message" [label="B/D/E/F"];
  "Coming soon message" -> "Present quest menu";
  "Ask: PRD needed?" -> "Human describes task";
  "Human describes task" -> "Spawn full team + create quest dir";
  "Spawn full team + create quest dir" -> "Announce quest + begin first phase" [shape=doublecircle];
}
```

## Step 0: Detect Plan Mode

Before anything else, check if you are running in Claude Code's **plan mode**.

If plan mode is active, ask the human to exit it before proceeding:

> "It looks like we're in **plan mode**. The Raid has its own safety gates — no teammate writes any file without permission, and hooks enforce phase-based restrictions. Plan mode would block the quest from working properly. Please exit plan mode (`/plan` or press Escape) and we'll get started."

Do NOT proceed with the quest until plan mode is exited.

## Step 1: Check for In-Progress Quests

Look in `.claude/dungeon/` for existing quest directories. If any exist:

> "I sense an unfinished quest in the dungeon: **{quest-slug}**. Shall we resume where we left off, or begin a new adventure?"

If the human wants to resume, read the raid-session file and continue from the current phase.

## Step 2: Greet the Human

```
Farewell brave Engineer, Welcome to the dungeon —
the raid is waiting for you.
Let's make the bards sing about the quest we are embracing today:
```

## Step 3: Present Quest Menu

```
Choose your quest:

A) Canonical Quest — Full 6-phase development cycle
   (PRD, Design, Plan, Build, Review, Wrap Up)

B) Round Table — (Coming soon)
D) Map Exploration — (Coming soon)
E) Bug Hunting — (Coming soon)
F) Bard Bonfire — (Coming soon)
```

If the human selects B, D, E, or F:
> "That quest type is still being forged by the arcane smiths. Choose another path for now."

Loop back to the menu.

## Step 4: Canonical Quest Setup

### 4a. PRD Question

> "Do you carry a Product Requirements scroll, or shall we forge one together?"

- If PRD needed → first phase will be PRD (raid-canonical-prd)
- If PRD not needed → first phase will be Design (raid-canonical-design)

### 4b. Task Description

Ask the human to describe the task/feature they want to build. Listen carefully. Read 3 times internally.

### 4c. Spawn Team & Setup

The Canonical Quest always runs with the full party (Wizard + Warrior + Archer + Rogue). 4 agents, no reduced configurations.

1. Update `.claude/raid-session` (created by the session-start hook) via **Bash with jq** — the write gate blocks Write/Edit on this file, so always use Bash:
   ```bash
   jq --arg qt "canonical" --arg qid "{questId}" --arg qdir ".claude/dungeon/{questId}" \
     '.questType=$qt | .questId=$qid | .questDir=$qdir' \
     .claude/raid-session > .claude/raid-session.tmp && mv .claude/raid-session.tmp .claude/raid-session
   ```
2. Create quest directory if not already created by hook:
   ```
   mkdir -p {questDir}
   ```
3. Spawn the full team:
   ```
   TeamCreate(team_name="raid-full-{questId}")
   Agent(subagent_type="warrior", team_name="raid-...", name="warrior")
   Agent(subagent_type="archer", team_name="raid-...", name="archer")
   Agent(subagent_type="rogue", team_name="raid-...", name="rogue")
   ```

## Step 5: Begin First Phase

- If PRD needed → Load `raid-canonical-prd` skill, begin Phase 1
- If PRD skipped → Load `raid-canonical-design` skill, begin Phase 2

**Announce the quest to the party and the human:**
> "The quest begins: **{task description}**. 4 brave souls answer the call. The dice will roll at each phase to determine turn order."

Dice rolls happen **per phase**, not at quest start. The first dice roll happens when Phase 2 (Design) opens — or whenever the first agent phase begins. Phase 1 (PRD) is wizard+human only, so no dice needed there.

## Red Flags

| Thought | Reality |
|---------|---------|
| "Skip the greeting, get to work" | The greeting sets the tone. It takes 5 seconds. Do it. |
| "Let me ask which mode to use" | Canonical Quest = full party, always. Don't ask. |
| "Let me start exploring the codebase" | You are the Wizard. You don't explore. You dispatch. |
| "I'll figure out the quest type later" | Quest type determines the phase flow. Choose now. |
