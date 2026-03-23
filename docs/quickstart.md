# Quickstart Guide

Get Word Compiler running and generate your first scene in under 10 minutes.

## Prerequisites

- **Node.js 20+** (check with `node -v`)
- **pnpm** — install with `npm install -g pnpm` if you don't have it
- **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com/)

## Install

```bash
git clone https://github.com/2389-research/word-compiler.git
cd word-compiler
pnpm install
```

Create a `.env` file in the project root:

```
ANTHROPIC_API_KEY=your-key-here
```

## Launch

```bash
pnpm dev:all
```

This starts two processes:
- **Frontend** at [localhost:5173](http://localhost:5173) (Vite + Svelte)
- **API server** at [localhost:3001](http://localhost:3001) (Express + SQLite)

Open [localhost:5173](http://localhost:5173) in your browser.

## Your First Project

### 1. Create a Project

On first launch you'll see a welcome screen. Click **Create Project** and give it a name.

### 2. Bootstrap a Bible

The app starts on the **Bootstrap** stage. You have two paths:

**Start from Synopsis (recommended for first-timers):**
1. Click **Start from Synopsis**
2. Pick a genre template (literary fiction, thriller, sci-fi, fantasy, romance) — this pre-fills tone, pacing, and a starter kill list
3. Paste a synopsis of your story (a paragraph or two is enough)
4. Click **Generate** — the LLM creates a draft bible with characters, locations, tone, and narrative rules
5. Review the result, tweak what you want, and save

**Build Manually:**
Open the guided form and fill in characters, locations, style guide, and narrative rules by hand. Good when you already know your world.

### 3. Plan a Scene

Navigate to the **Plan** stage (unlocked once your bible has at least one character).

1. Click **+ New Scene**
2. In the **AI Bootstrap** tab: describe the chapter direction, set the scene count, select characters and locations
3. Click **Generate** — the LLM produces scene plans with continuity between them
4. Review the plans: POV, narrative goal, emotional beats, subtext rules, chunk descriptions

Or use the **Guided Form** tab to fill in every field manually.

### 4. Draft Prose

Navigate to the **Draft** stage (unlocked once you have at least one scene plan).

The Drafting Desk is your main workspace:

1. Click **Generate Chunk** — the context compiler assembles your bible, scene plan, and any previous chunks into an optimized prompt, sends it to the LLM, and displays the result
2. **Review** the generated prose in the editor
3. **Accept** to keep it, **Edit** to revise, or **Reject** to regenerate
4. Repeat for each chunk in the scene (typically 3-5 chunks per scene)

The right panel shows what the compiler sent to the LLM — ring contents, token usage, voice consistency, and active setups.

**Autopilot mode:** Click **Autopilot** to generate all remaining chunks automatically, accepting each one.

### 5. Audit Quality

Navigate to the **Audit** stage (unlocked after generating at least one chunk).

- **Run Audit** — deterministic checks: kill list violations, sentence length variance, paragraph length, signal-to-noise ratio
- **Deep Audit** — LLM-assisted subtext compliance check that flags lines where characters say the quiet part out loud

Resolve or dismiss flags inline. The prose view highlights flagged passages.

### 6. Complete and Export

**Complete stage** (unlocked when no unresolved critical flags remain): mark scenes as done and extract Narrative IR for cross-scene analysis.

**Export stage** (unlocked after at least one scene is marked complete): choose Markdown or Plaintext format, then copy to clipboard or download.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` through `Ctrl+6` | Jump to a stage (if unlocked) |
| `Ctrl+Enter` | Advance to next unlocked stage |

## Key Concepts

### The Three Rings

The context compiler builds LLM prompts in three concentric rings:

- **Ring 1** (system message) — Project voice, tone, kill list, global rules. Hard-capped.
- **Ring 2** (chapter context) — Chapter arc, character states, active setups.
- **Ring 3** (scene context) — Scene plan, voice fingerprints, continuity bridge, anchor lines. Gets at least 60% of the token budget.

When over budget, the compiler compresses rings in priority order (R1 first, then R2, then R3). Kill list, scene contract, voice fingerprints, and anchor lines are never compressed.

### Chunks

A scene is composed of multiple chunks (typically 3-5). Each chunk is a passage of prose, usually 300-800 words. Chunks are generated sequentially — each new chunk sees all previous chunks in the Ring 3 context.

### The Bible

Your story's source of truth: characters (with voice fingerprints, secrets, relationships), locations, style guide (tone, metaphoric domains, kill list), and narrative rules (POV conventions, pacing, subtext enforcement). The bible is version-controlled — every save creates a new version.

### Gates

Quality checkpoints that enforce workflow discipline. Each stage has prerequisites that must be met before unlocking. You can't draft without a scene plan, can't complete without resolving critical audit flags, and can't export without marking scenes complete.

## Next Steps

- Read the full [Workflow Guide](workflow.md) for common tasks and detailed stage breakdowns
- Explore the [Architecture docs](architecture/) to understand the compilation pipeline
- Run `pnpm storybook` to browse the component library
