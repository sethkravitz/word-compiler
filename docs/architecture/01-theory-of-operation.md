# Theory of Operation

## The "Compiler" Metaphor

Word Compiler borrows its architecture from real compilers. A traditional compiler reads source code, builds an intermediate representation, optimizes within constraints, and emits output. Word Compiler does the same with prose:

| Compiler Stage | Word Compiler Equivalent |
|---------------|-------------------------|
| Source code | Bible (style guide + world state) |
| Preprocessor | Ring builders (ring1, ring2, ring3) |
| IR generation | Narrative IR extraction |
| Optimization | Budget enforcer (priority-based compression) |
| Codegen | LLM generation (prompt → prose) |
| Static analysis | Linter (pre-generation) + Auditor (post-generation) |
| Linker | Cross-scene bridge (continuity between scenes) |

This metaphor is not cosmetic — it shapes every architectural decision. Compilation is **pure, synchronous, and instant**. The compiler never makes network calls. The expensive LLM call is a separate, explicit step that the author controls.

## Guiding Principles

### 1. Author as Editor, Not Prompt Engineer

The author should never write prompts. They define *what* they want (Bible, scene plan) and the compiler builds the prompt automatically. The author's creative energy goes into reviewing and editing generated prose — the same workflow as working with a human ghostwriter.

### 2. Every Generated Word Must Be Auditable

No prose is accepted on faith. The auditor scans every chunk for kill list violations, sentence variance, paragraph length, epistemic hedging, and subtext density. Audit flags require explicit resolution before a scene can be marked complete.

### 3. The Bible Is the Single Source of Style Truth

All style decisions live in the Bible: voice profile, character dossiers, location palettes, narrative rules, avoid list. The compiler reads the Bible; it never guesses. When the learner proposes a change, it proposes a Bible edit — not a prompt tweak.

### 4. Gates Enforce Workflow Discipline, Not the UI

The six gates are pure validation functions that return `{ passed, messages }`. The UI renders gate results but doesn't enforce them. This means gates can be tested in isolation, run in CI, and composed into workflows without UI coupling.

### 5. Learning Happens from Observation, Not Configuration

The revision learner watches what the author edits, accumulates patterns using Wilson score intervals, and proposes Bible changes when confidence exceeds a threshold. The author never configures the learner — it learns by observing the gap between generated and edited text.

### 6. Compilation Is Instant

The entire compilation pipeline — ring building, budget enforcement, linting, assembly — is pure synchronous TypeScript with no network calls. This means the UI can recompile on every keystroke. Only generation (the LLM call) is async.

## Core Invariants

### Ring Budget Rules
- Ring 1 (system message) has highest priority but is compressed first when over budget
- Ring 2 (chapter context) is compressed second
- Ring 3 (scene context) is compressed last — it contains the most scene-specific material
- Immune sections (marked `immune: true`) are never compressed
- The HEADER section in Ring 1 is immune

### Canonical Text
- `getCanonicalText(chunk)` returns `editedText ?? generatedText`
- This function is the single source of truth for "what the author considers final"
- Export, learner, and cross-scene continuity all use canonical text

### IR Verification
- Narrative IR must be explicitly verified before it is trusted
- Unverified IR is excluded from cross-scene bridging
- The `verified` flag is set by the author, not the system

### Scene Status Transitions
```
planned ──(first chunk generated)──▶ drafting ──(manual gate check)──▶ complete
```
- Backward transitions are not allowed
- A scene cannot be marked complete until all gate checks pass

## Chapter Workflow End-to-End

1. **Bootstrap or author a Bible** — AI bootstrap from synopsis, or build via guided form with genre templates
2. **Create a chapter arc** — working title, narrative function, reader state entering/exiting
3. **Plan scenes** — one scene plan per scene, with POV, goals, emotional beats, chunk descriptions
4. **Generate chunks** — the compiler builds the prompt, the LLM generates prose, the auditor scans it
5. **Edit and revise** — the author edits chunks; the learner observes patterns
6. **Extract narrative IR** — events, facts, character deltas, setups/payoffs
7. **Resolve audit flags** — the author marks each flag as resolved, dismissed, or actionable
8. **Complete the scene** — all gates must pass (audit resolution, IR verification, chunk review)
9. **Repeat for next scene** — Ring 2 carries chapter context forward; Ring 3 bridges continuity
10. **Export** — Markdown or plain text with scene separators and word count
