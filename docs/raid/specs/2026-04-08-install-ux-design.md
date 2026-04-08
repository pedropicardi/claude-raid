# Install UX Redesign — Design Spec

**Date:** 2026-04-08
**Status:** Approved
**Scope:** First-time user experience for `npx claude-raid summon`

## Problem

After `npx claude-raid summon`, first-time users don't understand what got installed, why, or how the pieces connect. The current output is minimal and thematic ("Realm detected: javascript", "Battle cry: npm test") but doesn't explain the system. Users are left with 13 hooks, 4 agents, 10+ skills, and multiple config files with no mental model of how they work together.

## Constraints

- Keep RPG flavor in headers and banners (⚔, thematic section names)
- Use plain engineering language for all explanations
- No new runtime features — this is install-time UX only
- Zero new dependencies

## Visual Language

**Aesthetic:** Astro/Vite-inspired — clean, colorful, generous whitespace, crafted feel.

**Color palette (ANSI-16, used intentionally):**

| Role | Color | ANSI | Usage |
|------|-------|------|-------|
| Primary | Amber/Gold | `33` | Headers, borders, brand elements |
| Primary bright | Bold Amber | `1;33` | Top of banner, emphasis |
| Accent | Bold Red | `1;31` | "RAID" wordmark, transition zone |
| Accent | Red | `31` | Lower banner, warnings |
| Accent dim | Dim Red | `2;31` | Banner bottom fade |
| Success | Green | `32` | Checkmarks, completion states |
| Secondary | Dim gray | `90` | Descriptions, hints, tagline |
| Emphasis | Bold | `1` | Commands, file names, key values |

**Banner: amber-to-red vertical gradient**

The banner uses a smooth 5-tone gradient flowing top-to-bottom:
`bold amber → amber → bold red → red → dim red`

```
Line 1-2:  bold amber (1;33)  — CLAUDE top
Line 3-5:  amber (33)        — CLAUDE bottom + transition
Line 6-8:  bold red (1;31)   — CLAUDE/RAID boundary + RAID top
Line 9-11: red (31)          — RAID middle
Line 12:   dim red (2;31)    — RAID bottom fade
```

Rules (⚔ ═══) in amber. Tagline in dim gray.

**Copywriting voice:**
- Engineer-first, RPG accent. Like a dev tool that happens to have flavor.
- Short sentences. Active voice. No filler.
- Thematic words in headers only: "Summoning", "Realm", "Reforge", "Party"
- Explanations in plain English: "quality gates that block bad commits"
- Tip/hint tone: helpful colleague, not tutorial narrator

**Design principles:**
- Vertical flow — one thing at a time, top to bottom
- Breathing room — blank lines between sections, no walls of text
- Hierarchy through color — amber = structure, bold = action, dim = context
- Symbols over words — `✔` not "OK", `→` not "see also", `•` for lists
- Scannable — glancing at the output should convey the gist in 3 seconds

## Design

Three changes to the install flow:

### 1. `summon --dry-run`

A preview flag that shows exactly what would be created/modified without touching disk.

**CLI interface:**
```bash
npx claude-raid summon --dry-run
```

**Behavior:**
- Runs all detection (language, package manager, browser framework) but writes nothing
- Groups output into labeled categories: Agents, Hooks, Skills, Config
- Each file gets a 1-line plain-language description of its purpose
- Hooks are split into "lifecycle hooks" (7) and "quality gates" (7) for clarity
- If already installed, notes which files would be skipped (preserved)
- Shows .gitignore entries that would be added
- Ends with "Run without --dry-run to install."
- Exit code 0 always (informational only)
- Works in non-interactive mode (no prompts, no setup wizard)

**Output structure:**
```
⚔ Dry Run — nothing will be written

  Realm detected: {language} (from {marker file})
  Test command:   {testCommand}
  Lint command:   {lintCommand}

  Would create/modify:

  Agents (4 files → .claude/agents/)
    {name}.md    {1-line description}
    ...

  Hooks (14 files → .claude/hooks/)
    {name}.sh    {1-line description}
    ...

  Skills (13 folders → .claude/skills/)
    {name}       {1-line description}
    ...

  Config
    raid.json       Project config (auto-detected values)
    raid-rules.md   17 team rules (editable)
    settings.json   Hooks merged into existing (backup created)

  .gitignore entries added:
    {entries}

  Run without --dry-run to install.
```

**Implementation notes:**
- Parse `--dry-run` flag in `bin/cli.js` before routing to `summon`
- Extract detection logic from `install()` in `src/init.js` so it can run without side effects
- The descriptions are static strings — one map of filename → description, shared between dry-run and install output
- The file listing comes from scanning the template directory, same as `install()` does today

### 2. Phased Install Output

Replace the current minimal `summon` output with structured, grouped output. Each category gets a labeled section with file counts and a brief explanation.

**Output structure:**
```
  [banner]

  ⚔ Summoning the Party...

  Realm detected: {language} (from {marker file})
  Test command:   {testCommand}
  Lint command:   {lintCommand}

  ⚔ Agents                                          4 files
    Copied wizard.md, warrior.md, archer.md, rogue.md
    AI teammates that challenge each other's work from
    competing angles. Start a session with: claude --agent wizard

  ⚔ Hooks                                          14 files
    Copied 7 lifecycle hooks + 7 quality gates
    Lifecycle hooks manage session state automatically.
    Quality gates block bad commits, missing tests, and
    placeholder text — only active during Raid sessions.

  ⚔ Skills                                     13 folders
    Copied {skill names}
    Phase-specific workflows that guide agent behavior.

  ⚔ Config
    Generated raid.json          Project settings (editable)
    Copied raid-rules.md         17 team rules (editable)
    Merged settings.json         Backup at .pre-raid-backup

  Preserved existing scrolls:
    → {skipped file paths}
```

**Key changes from current output:**
- Categories replace flat file list
- File counts shown per category at a glance
- 1-2 line plain-language explanation per category
- Hooks split into "lifecycle + quality gates" — not 14 opaque names
- Skipped files still listed under "Preserved existing scrolls"

**What stays the same:**
- Banner at top
- Thematic headers (⚔ prefix)
- Setup wizard runs after (Party Status checks)
- "The party is assembled" closing message

**Implementation notes:**
- Restructure `run()` in `src/init.js` to output in sections
- Count files per category from the copy results (agents, hooks, skills)
- Reuse the same filename → description map from the dry-run implementation (single source of truth)
- Skipped files remain as-is

### 3. Post-Install Reference Card

After the setup wizard completes, show a structured reference card that explains the system. Two boxes: "How It Works" (system understanding) and "Next Step" (action).

**"How It Works" box content:**
- Modes: Full Raid (3 agents), Skirmish (2), Scout (1 + Wizard) — one line each
- Phases: 1. Design, 2. Plan, 3. Implement, 4. Review — one line each
- Hook enforcement summary: no impl without design, no commits without tests, no completion without evidence, conventional commits
- "Hooks only activate during Raid sessions" reassurance
- Config file locations: raid.json, raid-rules.md

**"Next Step" box content:**
- `claude --agent wizard` command
- "Describe your task and the Wizard takes over."
- Tip: start with a small task to see the workflow first
- `claude-raid heal` as the "read this again" command

**Key decisions:**
- Plain engineering language throughout — no Dungeon, Realm, or Vault mentioned
- The tip to start small steers first-timers away from Full Raid on complex features
- No mention of signals, Dungeon pins, or phase internals — those are learned during first session
- `heal` command consolidated to show the same reference cards

**`heal` consolidation:**
The existing `heal` command shows 3 boxes (Quick Start, Controls, Raid Modes). Replace these with:
1. Party Status (unchanged — the check results)
2. How It Works (new — from above)
3. Next Step (new — from above, but with Controls info merged in)

The Controls box content (Shift+Down, Enter, Escape, Ctrl+T, Click pane) moves into the Next Step box as a "Controls" sub-section.

**Implementation notes:**
- Add a `referenceCard()` function to `src/ui.js` that returns the two boxes
- Call it at the end of `run()` in `src/init.js` (after setup wizard)
- Refactor `src/doctor.js` to use the same `referenceCard()` function
- The `box()` function in `ui.js` already handles the rendering

## File Changes Summary

| File | Change |
|------|--------|
| `bin/cli.js` | Parse `--dry-run` flag, pass to summon |
| `src/init.js` | Add `dryRun()` function, restructure `run()` output into sections, add reference card |
| `src/doctor.js` | Replace Quick Start / Controls / Modes boxes with shared reference card |
| `src/ui.js` | Add `referenceCard()` function returning How It Works + Next Step boxes |
| `tests/cli/init.test.js` | Add dry-run tests, update output assertions for phased output |
| `tests/cli/doctor.test.js` | Update assertions for new reference card |

## Out of Scope

- Guided first session / onboarding tutorial
- Interactive step-by-step install with per-category confirmation
- `claude-raid explain` command
- Changes to the Raid session experience itself
- README updates (separate task)
