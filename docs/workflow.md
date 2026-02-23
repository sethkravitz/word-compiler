# Word Compiler Workflow Guide

A task-oriented guide to writing fiction with Word Compiler. For technical internals, see `docs/architecture/`.

---

## Quick Start

1. **Create a project** — On first launch you'll see a welcome screen. Click "Create Project". If you already have projects, the Project List appears instead — click "New Project".

2. **Create your bible** — The Project Atlas panel (left side) shows your bible, scene plans, and chapter arc. You have two options:
   - **Bootstrap** — Paste a synopsis and let the LLM generate characters, locations, tone, and a kill list. You can pick a genre template (literary fiction, thriller, sci-fi, fantasy) to pre-fill sensible defaults.
   - **Author** — Open the Bible Authoring modal and fill in everything manually using the guided form. Good when you already know your world.

3. **Plan your scenes** — Click the **+** button in the Scene Sequencer (the horizontal strip below the header). The Scene Authoring modal opens with two modes:
   - **AI Bootstrap** — Describe the chapter direction, set a scene count (1 for a single scene, 3+ for a full chapter), select which characters and locations to include, and generate. The LLM produces scene plans with continuity between them.
   - **Guided Form** — Manually fill in every field: POV, narrative goal, emotional beat, subtext, reader state, chunk descriptions, etc.

4. **Generate prose** — Select a scene in the sequencer, then use the Drafting Desk (center panel):
   - **Generate Chunk** — Produces the next chunk of prose using the compiled context (bible + scene plan + previous chunks). Review the output, edit if needed, then accept or reject.
   - **Autopilot** — Generates all remaining chunks for the scene automatically, accepting each one. Runs the completion gate at the end.

5. **Audit and refine** — The right panel shows the Draft Engine (compiled context), along with audit results:
   - **Run Audit** — Deterministic checks: kill list violations, sentence length variance, paragraph length, signal-to-noise ratio.
   - **Deep Audit** — LLM-assisted subtext compliance check. Sends your prose + the scene plan's subtext rules to Claude and flags any lines where characters say the quiet part out loud.
   - Resolve or dismiss flags in the Audit panel.

6. **Complete the scene** — Click "Complete Scene" in the Drafting Desk. This runs the scene completion gate (checks chunk count, audit resolution, etc.). Once complete, you can extract the Scene IR (intermediate representation) for cross-scene analysis.

7. **Export** — Click "Export Prose" in the header. Choose markdown or plaintext format. The export concatenates all accepted chunks across all scenes in order.

---

## The Panels

### Scene Sequencer (top strip)
The horizontal bar showing all scenes for the current chapter. Click a scene to switch to it. The **+** button opens the Scene Authoring modal. Each scene shows its status: planned, drafting, or complete.

### Project Atlas (left panel)
Your project's reference data:
- **Bible** — Characters, locations, tone, kill list. Click "Bootstrap" to generate from a synopsis, or "Author" to edit manually.
- **Scene Plans** — JSON view of the active scene plan. All the metadata the compiler uses: POV, narrative goal, reader state, subtext rules, chunk descriptions.
- **Chapter Arc** — If generated during scene bootstrap (or created manually), shows the chapter-level arc data. Click "Chapter Arc" in the header to edit.

### Drafting Desk (center panel)
Where prose happens:
- Generated chunks appear in sequence, each with accept/edit/reject controls.
- "Generate Chunk" adds the next chunk using the full compiled context.
- "Autopilot" runs through all remaining chunks automatically.
- "Run Audit" and "Deep Audit" buttons trigger quality checks.
- "Complete Scene" finalizes the scene (requires passing the completion gate).

### Right Panel (tabbed)
- **Draft Engine** — Shows the compiled context payload (system message + user message), the compilation log, lint results, and audit flags with the signal/noise meter.
- **Scene Blueprint** — The extracted IR (intermediate representation) after scene completion. Shows narrative beats, character arcs, and key moments.
- **Reader Journey** — Forward simulation of what the reader knows, suspects, and is wrong about at each scene boundary.
- **Voice Consistency** — Style drift analysis comparing each scene's prose against a baseline.
- **Character Voices** — Voice separability report showing how distinct each character's dialogue is.
- **Setups** — Setup/payoff registry tracking planted setups and their resolutions across scenes.
- **Learner** — Edit pattern analysis and auto-tuning proposals based on how you revise generated prose.

---

## Key Concepts

### The Three Rings
The context compiler builds the LLM prompt in three rings:
- **Ring 1** — System message: project voice, tone, kill list, global rules.
- **Ring 2** — Chapter context: bible characters/locations relevant to this chapter, chapter arc.
- **Ring 3** — Scene context: scene plan, previous chunks, continuity bridge from prior scene.

When the total exceeds the token budget, the compiler compresses rings in priority order (R1 first, then R2, then R3) by removing non-immune sections.

### Chunks
A scene is composed of multiple chunks (typically 3-5). Each chunk is a passage of prose, usually 300-800 words. Chunks are generated sequentially — each new chunk sees all previous chunks in the Ring 3 context.

### Gates
Quality checkpoints that enforce workflow discipline:
- **Scene Plan Gate** — Validates the plan has required fields before drafting.
- **Compile Gate** — Ensures the context compiles without critical lint errors.
- **Chunk Review Gate** — Checks that chunks are reviewed before generating more.
- **Scene Completion Gate** — Requires all chunks accepted and audit flags resolved.
- **Audit Resolution Gate** — Validates audit flag resolution before marking complete.
- **Bible Versioning Gate** — Ensures bible changes are versioned.

### Subtext
Each scene plan can define subtext rules:
- **Surface conversation** — What characters appear to be discussing.
- **Actual conversation** — What's really being communicated underneath.
- **Enforcement rule** — How to maintain the gap between surface and actual.

The Deep Audit checks whether your prose violates these rules by having characters state the subtext explicitly.

---

## Common Tasks

### Adding a scene to an existing chapter
Click **+** in the Scene Sequencer. Set Scene Count to **1** in the AI Bootstrap tab. Your existing scenes are untouched — the new plan is appended.

### Re-bootstrapping the bible
Open the Bible Authoring modal ("Author" button in Project Atlas). Edit fields and save. The bible version increments automatically. The compiler will use the updated bible for all subsequent chunk generation.

### Switching between projects
Click "Projects" in the header (visible when you have 2+ projects). This returns to the Project List. Your current project state is preserved in the database.

### Using genre templates
When bootstrapping a bible, select a genre template (literary fiction, thriller, sci-fi, fantasy) before generating. The template pre-fills tone, metaphoric domains, pacing notes, and a starter kill list appropriate to the genre.

### Exporting your work
Click "Export Prose" in the header. Choose format:
- **Markdown** — Scene titles as headings, preserves formatting.
- **Plaintext** — Clean text with scene breaks, no markup.

---

## Tips

<!-- TODO: Add your workflow tips here — e.g., when to use autopilot vs manual,
     when deep audit is most useful, gotchas you've encountered, etc. -->

