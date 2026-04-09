---
title: "feat: Replace fiction genre templates and POV with essay-appropriate equivalents"
type: feat
status: active
date: 2026-04-08
origin: docs/brainstorms/2026-04-08-essay-writer-adaptation-requirements.md
---

# Replace Fiction Genre Templates and POV with Essay Equivalents

## Overview

The genre template dropdown still shows "Literary Fiction," "Thriller," "Romance," "Science Fiction" — all fiction genres with fiction-specific kill lists, metaphor domains, and structural bans. The POV selector (First / Close Third / Distant Third / Omniscient) is a fiction concept. The field examples throughout the guided forms use fiction scenarios. All three need essay-appropriate replacements.

## Problem Frame

A user opening the Essay Brief Editor sees a "Genre Template" dropdown full of fiction genres and a POV selector with fiction perspective types. These are the pre-fill tools meant to bootstrap a good configuration quickly — but they bootstrap fiction configurations that actively mislead an essay writer.

## Requirements Trace

- R2/R3: Default kill list with 40+ anti-slop entries and 7+ structural bans (the essay templates should ship these)
- R5b: Anti-ablation guardrails encoding the "surprise" principle (structural bans in templates)
- R6: Bootstrap prompt rewritten for essays (templates complement the bootstrap)
- Origin: "UI label changes are cosmetic, not structural" — but templates ARE structural (they pre-fill kill lists, bans, policies)

## Scope Boundaries

- **No changes to the TypeScript type system** — `GenreTemplate`, `GenreDefaults`, `NarrativeRules`, `Bible` interfaces stay as-is
- **No changes to `applyGenreTemplate()` logic** — the fill-blank merge strategy stays
- **No database changes** — same schema
- **POV type union stays** — `"first" | "close-third" | "distant-third" | "omniscient"` remains in the type. We relabel the UI but the data values don't change (they map naturally: first person essay, close third = personal narrative, etc.)
- **Field examples are a separate concern** — they're fiction-specific but usable by analogy. Out of scope for this plan. Could be a follow-up.

## Key Technical Decisions

- **Replace genre templates, don't add alongside:** The fiction templates are wrong for essays. Replace them with essay-style templates. Users who want fiction can fork the repo. We're adapting the tool for one domain.
- **Reuse the same `GenreDefaults` structure:** Essay templates use the same fields (kill lists, structural bans, metaphoric register, sentence architecture, paragraph policy, exposition policy). The structure is domain-agnostic — only the content was fiction-specific.
- **Relabel "Genre Template" to "Style Template":** The concept of pre-filling style defaults from a template is valuable for essays. The word "genre" is fiction-specific.
- **Relabel POV options for essay context:** The underlying values stay (`first`, `close-third`, etc.) but the labels become essay-appropriate. "First" → "First Person", "Close Third" → "Personal Narrative", "Distant Third" → "Analytical", "Omniscient" → "Omniscient/Survey". The POV concept maps naturally to essay perspective.
- **Keep POV Fine-Tuning section:** Distance (intimate/close/moderate/distant) and interiority (stream/filtered/behavioral-only) are useful for essays. "Intimate + stream" = confessional essay. "Distant + behavioral-only" = reported essay.

## Implementation Units

- [ ] **Unit 1: Create essay style templates**

**Goal:** Replace the 4 fiction genre templates with 4 essay style templates that ship anti-slop kill lists, structural bans, and essay-appropriate policies.

**Requirements:** R2, R3, R5b

**Dependencies:** None

**Files:**
- Modify: `src/bootstrap/genres.ts`
- Modify: `tests/bootstrap/genres.test.ts`

**Approach:**

Replace `LITERARY_FICTION`, `THRILLER`, `ROMANCE`, `SCI_FI` with 4 essay templates:

1. **Personal Essay** — First-person, intimate, "stream" interiority. Kill list focused on memoir cliches ("taught me a valuable lesson", "little did I know", "I never could have imagined"). Structural bans on throat-clearing transitions and hedging. Metaphoric register: domestic, bodily, weather.

2. **Analytical Essay** — Distant third / analytical voice. Kill list focused on academic filler ("it is important to note", "in today's fast-paced world", "studies show"). Structural bans on paragraph-opening "However/Moreover/Furthermore". Metaphoric register: machinery, architecture, systems.

3. **Op-Ed / Persuasive** — First person, moderate distance. Kill list focused on persuasion cliches ("make no mistake", "the fact of the matter is", "at the end of the day"). Structural bans on straw-man framing and false equivalence patterns. Direct, punchy sentence architecture.

4. **Narrative Nonfiction** — Close third / personal narrative. Kill list combining memoir and journalism cliches. Structural bans on timeline confusion and exposition dumps. Metaphoric register tied to the subject domain.

Each template ships the 48-entry default anti-slop kill list from the bootstrap (R2/R3) merged with template-specific additions. Each includes 7+ structural bans per R3.

**Patterns to follow:**
- Exact same `GenreTemplate` / `GenreDefaults` structure as existing fiction templates
- Same fill-blank merge behavior via `applyGenreTemplate()`

**Test scenarios:**
- Happy path: `GENRE_TEMPLATES` exports 4 templates with essay IDs
- Happy path: Each template has non-empty kill list, structural bans, and metaphoric register
- Happy path: `applyGenreTemplate()` fills empty bible fields from essay template
- Happy path: Template does not overwrite user-set values (fill-blank strategy preserved)
- Edge case: Applying template to a bible that already has kill list entries — original entries preserved

**Verification:**
- All existing `applyGenreTemplate` tests pass (logic unchanged, only data changed)
- New templates have at least as many kill list entries as the fiction ones they replace

- [ ] **Unit 2: Relabel UI — "Genre Template" → "Style Template", POV labels**

**Goal:** Update the form labels so the dropdown says "Style Template" and POV options have essay-appropriate labels.

**Requirements:** R6 (UI consistency with essay domain)

**Dependencies:** None (can be done in parallel with Unit 1)

**Files:**
- Modify: `src/app/components/BibleGuidedFormTab.svelte`

**Approach:**

`BibleGuidedFormTab.svelte`:
- "Genre Template" label → "Style Template"
- "Select a genre to pre-fill defaults..." placeholder → "Select a style to pre-fill defaults..."
- POV radio options: "First" → "First Person", "Close Third" → "Personal Narrative", "Distant Third" → "Analytical", "Omniscient" → "Survey/Omniscient"
- "POV Default" label → "Perspective" 
- "POV Fine-Tuning" → "Perspective Fine-Tuning"
- "POV Distance" → "Perspective Distance"
- "POV Interiority" → "Perspective Interiority"
- "POV Reliability" → "Perspective Reliability"

Also update the atlas display:
- Modify: `src/app/components/AtlasBibleTab.svelte` — the POV badge display

The underlying data values (`"first"`, `"close-third"`, etc.) do NOT change. Only the displayed labels change.

**Patterns to follow:**
- Same string-replacement approach as the previous UI relabeling PR

**Test scenarios:**
- Happy path: BibleGuidedFormTab renders "Style Template" label instead of "Genre Template"
- Happy path: POV options show essay-appropriate labels
- Happy path: Selected POV value still binds correctly to the data model (radio value unchanged)

**Verification:**
- Form renders with essay terminology
- Selecting a POV option sets the correct underlying value

- [ ] **Unit 3: Update the "Foundations" step label and related form field labels**

**Goal:** Relabel the Foundations step and its fiction-specific field labels for essay context.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `src/app/components/BibleGuidedFormTab.svelte`
- Modify: `src/app/components/AtlasBibleTab.svelte`
- Modify: `src/app/components/SceneGuidedFormTab.svelte`

**Approach:**

`BibleGuidedFormTab.svelte`:
- Step label "Foundations" → "Voice & Perspective" (more descriptive for essays)
- "Locations" step label → "References" (locations can be settings for narrative nonfiction)

`AtlasBibleTab.svelte`:
- "Narrative Rules" section header → "Writing Rules"
- "Subtext Policy" → "Implicit Meaning Policy" (subtext applies to essays too but the label is fiction-coded)
- "Exposition Policy" → "Information Policy"
- "Setups & Payoffs" → "Setup & Resolution" (slightly more generic)

`SceneGuidedFormTab.svelte`:
- "POV Character" already changed to "Author Voice" in prior PR
- "POV Distance" label → "Perspective Distance"

**Patterns to follow:**
- Pure string replacement in Svelte templates

**Test scenarios:**
- Happy path: Bible guided form stepper shows "Voice & Perspective" instead of "Foundations"
- Happy path: Atlas panel shows "Writing Rules" instead of "Narrative Rules"

**Verification:**
- Walk through the guided form — all labels use essay terminology
- View the atlas panel with populated data — section headers are essay-appropriate

## System-Wide Impact

- **Interaction graph:** `applyGenreTemplate()` is the only consumer of `GENRE_TEMPLATES`. Changing the template data flows through the same merge logic.
- **Error propagation:** No new error paths. Same fill-blank merge.
- **State lifecycle risks:** None. Templates are static data.
- **API surface parity:** No API changes.
- **Unchanged invariants:** TypeScript interfaces (`GenreTemplate`, `GenreDefaults`, `NarrativeRules`), the `applyGenreTemplate()` function logic, SQLite schema, and all data model values remain identical. Only template content and UI labels change.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Essay kill lists miss important AI slop terms | Start with the 48-entry list from the bootstrap prompt (already researched) and add template-specific entries |
| POV relabeling confuses users who know the fiction terms | The underlying values are the same; labels are just more intuitive for essay context |
| Losing the fiction templates permanently | They're in git history. Anyone who wants them can fork or revert. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-08-essay-writer-adaptation-requirements.md](docs/brainstorms/2026-04-08-essay-writer-adaptation-requirements.md)
- Prior PR: sethkravitz/word-compiler#2 (UI relabeling — merged)
- Kill list research: ICLR 2026 Antislop paper, NousResearch ANTI-SLOP taxonomy
- Bootstrap kill list: `src/bootstrap/index.ts` (48-entry default + 7 structural bans)
