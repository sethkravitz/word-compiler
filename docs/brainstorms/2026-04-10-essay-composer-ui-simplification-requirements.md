---
date: 2026-04-10
topic: essay-composer-ui-simplification
---

# Essay Composer UI Simplification

## Problem Frame

The word-compiler UI was designed for long-form fiction with a 7-stage workflow (Bootstrap → Plan → Draft → Edit → Audit → Complete → Export), a full Bible with characters/locations/sensory palettes/subtext contracts, a scene sequencer, narrative IR inspector, forward simulator, voice separability view, setup/payoff tracker, and per-stage panels. For a 1500-4000 word essay, roughly 80% of that UI is dead weight.

We already adapted the prompts and compilation pipeline for essays in a prior pass (see `2026-04-08-essay-writer-adaptation-requirements.md`). What remains is the UI surface: a user writing an essay currently has to navigate fiction-shaped stages, fill in fiction-shaped fields, and look at panels that are irrelevant to their work.

The goal is to collapse the essay-writing experience into a **single-page composer** — one scrollable view containing everything relevant, with fiction-specific UI hidden rather than removed (so fiction mode can be preserved as a fallback). The underlying compilation pipeline, voice system, CIPHER, and auditor must remain fully functional — only the visible surface changes.

## Product Vision

The composer feels like a single document where the essay is the artifact and the AI is a collaborator in the margins. You land on a populated page, scroll through your sections, generate and edit inline, and never navigate away from your writing to configure something. The tool gets out of the way; your voice does the work.

## V1 Scope Posture

**Aggressive cut.** Ship the smallest version that proves the thesis, then earn each additional feature by actually wanting it after using the smaller version. Every cut feature is preserved in the "Deferred to V2+" section below with its full spec intact — ready to implement when promoted.

## Requirements (V1)

### Single-Page Composer Layout

- **R1.** The essay writing experience is a single scrollable page with no stage-based navigation. The user never clicks "next stage" to progress.
- **R2.** The page has three zones stacked vertically: (a) essay title + export button at the top, (b) a single "Setup" panel containing Brief/Voice/Style, (c) sections area with inline generation and editing.

### Setup Panel (Single, Unified)

- **R3.** Project setup is a **single collapsible "Setup" panel** at the top of the page. The panel contains three subsections: **Brief**, **Voice**, **Style**. The whole panel collapses/expands as one unit. Default: collapsed once any field is configured, expanded on empty projects.
- **R4.** The **Brief** subsection contains: thesis, target audience, tone/register notes. Essay data is stored in existing Bible fields via intentional field reuse — thesis → `narrativeRules.subtextPolicy`, tone → `narrativeRules.pov.notes`. This is the "hide don't rename" principle applied to the data layer. Fiction-specific semantics of these fields are irrelevant in essay mode; they are used as generic string storage.
- **R5.** The **Voice** subsection shows: writing samples list (add/remove), voice profile status (generated / not generated / generating), "Generate Voice Profile" button, and the extracted voice summary. **Voice is global** — the `voice_guide` and `writing_samples` tables are singletons shared across all projects. The subsection header reads "Your Writing Voice (shared across all projects)".
- **R6.** The **Style** subsection contains: kill list (editable), structural bans (editable), vocabulary preferences, metaphor domain rules (approved/prohibited). All map to existing Bible styleGuide fields — no new data model.

### Sections Area (Inline Everything)

- **R7.** Sections render as an ordered vertical list. Each section shows its heading, its generation controls, and its compiled prose inline. "Compiled prose" = the concatenation of the section's chunks, rendered as one continuous TipTap editor per section. Chunk boundaries are invisible in editing; edits are mapped back to the containing chunk on save.
- **R8.** Each section has always-visible primary controls: heading, one-line goal, **one list of 2-4 key points** (section-wide, stored in `chunkDescriptions` as a single array), anchor lines (specific phrases that must appear). Map to existing ScenePlan fields (`title`, `narrativeGoal`, `chunkDescriptions`, `anchorLines`).
- **R9. [CUT FROM V1]** Advanced toggle with power controls (reader takeaway, pacing, density, word count target, section-specific prohibitions) — **deferred to V2**. V1 exposes only the primary controls in R8. Users who need power controls can edit the underlying ScenePlan directly until V2 ships.
- **R10.** Each section has an inline **Generate** button that streams generated prose into the section. Generation must go through the existing `generation.svelte.ts` path; each composer section maps **1:1 to a ScenePlan row in the store** so the existing pipeline (which is coupled to `store.activeScenePlan` and `store.compiledPayload`) works without modification. The composer manipulates `activeScenePlan` before each generation call.
- **R11. [REVISED]** Regenerate replaces the current prose in place. A **"Revert" button** appears for 60 seconds after regeneration, holding the previous version in memory. Clicking Revert restores the prior prose. After 60 seconds (or on any edit), the previous version is discarded. **No history, no side-by-side compare in V1** — deferred to V2.
- **R12. [REVISED]** Sections support: add new (button at end of list), delete (button per section with confirmation), **reorder via up/down buttons** (keyboard accessible, WCAG 2.1.1 compliant). No drag-and-drop in V1 — deferred to V2.
- **R12i.** Each section has a single-line text field above the Regenerate button for micro-directives ("make this more aggressive"). Persists as `humanNotes` on the **most recently generated chunk in the section**. On next Generate/Regenerate, it's injected into the MICRO_DIRECTIVE section of Ring 3 (already wired in the existing compiler). After accepted regeneration, the directive field is cleared.

### New Project Flow (2 Templates + Bootstrap)

- **R12a. [CUT: 5→2]** Creating a new project starts with a **template picker** showing two options: **Opinion piece**, **Personal essay**. The other three templates (Explainer, How-to, Hot take) are deferred to V2.
- **R12b.** After picking a template, the user pastes their essay idea/brief (2-3 paragraphs). The bootstrap system uses a template-specific prompt to produce: thesis, audience, tone/register/pacing, section skeletons with headings/goals/key points, topic-specific kill list additions.
- **R12c. [RESOLVED]** Templates are static TypeScript objects in a new file `src/bootstrap/essayTemplates.ts`, following the existing `src/bootstrap/genres.ts` pattern. No DB schema change. Each template defines: system prompt override, default section count, default tone hints, default word count target, any template-specific kill list additions.
- **R12d.** Template specifics:
  - **Opinion piece**: editorial, thesis-driven, punchy. Target 1500-3000 words, 3-5 sections.
  - **Personal essay**: narrative-driven, reflective, voice-first. Target 1500-4000 words, 3-5 sections.
- **R12e.** After bootstrap, the user lands on the composer with Setup panel pre-populated, N ScenePlans created (one per section from the bootstrap output), and the first section expanded ready to Generate.

### Generation Lifecycle States (NEW)

- **R12k.** Each section is always in exactly one of these states. Controls are enabled/disabled accordingly:
  - **Idle-empty** — no prose yet, Generate enabled, Regenerate disabled
  - **Idle-populated** — prose exists, Generate hidden, Regenerate/Revert/Directive enabled
  - **Queued** — generation requested but not started, Generate disabled, cancel button visible
  - **Streaming** — prose is streaming in, edit disabled, cancel button visible, other sections still usable
  - **Error** — generation failed, error banner in section with retry and dismiss buttons
  - **Aborted** — user cancelled, section returns to prior state (idle-empty or idle-populated with previous content)
  - **Revertable** — just completed regeneration, Revert button visible for 60s
- **R12l.** Multiple sections can be Queued simultaneously. Only one Streaming at a time (existing backend limitation — single `compiledPayload` slot). Queued sections show a "waiting" indicator.
- **R12m.** Edit-during-stream is disallowed: the section editor is locked (read-only, visible via subtle background change) while Streaming. Saving edits happens on blur.

### Voice Profile Dependency

- **R12n.** Generate works even if the voice profile is not yet generated. The compiled prompt gracefully degrades to use only the kill list + style rules + bootstrap thesis/tone, without a voice fingerprint.
- **R12o.** On first Generate click in a session where voice is ungenerated, show a single non-blocking nudge: "Your voice profile isn't set up yet — generated prose will be less distinctive. [Generate Voice] [Skip for now]"

### Hidden Fiction-Specific Fields

- **R13.** The following fields are hidden from the essay composer entirely (but preserved in the data model): POV character selector, POV distance, dialogue constraints, present characters, location selector, sensory notes, subtext contract, chapter arc management, scene sequencer, character voice separability view, narrative IR inspector, setup/payoff tracker, forward simulator.
- **R14.** The hiding mechanism is **routing-level, not conditional rendering**. When `bible.mode === 'essay'`, the composer fully replaces DraftStage and all the fiction-specific panels. This is a one-line branch in `App.svelte`, not 13 conditional imports. Fiction-specific components are never loaded in essay mode.

### Live Audit (Reuse AnnotatedEditor)

- **R15. [REVISED]** Audit runs continuously in the background, debounced at 300ms after edits. Results are surfaced inline by **reusing the existing `AnnotatedEditor.svelte` component** (which already implements the Grammarly-style pattern: PluginKey-based ProseMirror plugin, DecorationSet from EditorialAnnotation[], click-to-activate AnnotationTooltip, document-change remapping). The composer's section editor IS an AnnotatedEditor instance.
- **R15a.** `AuditFlag` objects from the existing auditor are mapped to `EditorialAnnotation` objects consumed by AnnotatedEditor. The only new code is the mapping function.
- **R15b.** Decorations must combine color AND underline style (WCAG 1.4.1): red wavy for critical (kill list), yellow dotted for warnings (sentence variance, paragraph length). Color alone is insufficient.
- **R15c. [CUT]** The "Rewrite this span" hover menu action is **deferred to V2** (it secretly depends on V2 span-anchored directive infrastructure). V1 hover menu shows: "Ignore", "Remove from kill list" (for kill-list hits only).
- **R15d.** The status footer shows aggregate counts: 'Kill list: 3 · Sentence variance: 1 · Paragraph length: 0'. Clicking a count scrolls to the first violation.
- **R16.** The status footer shows: total word count, active audit flag counts per category, voice profile status ("Voice: ready" / "Voice: not set"), last-save timestamp.

### Section Granularity

- **R16a.** A **section** is a logical part of the essay (like an H2 heading): "Introduction", "The Problem", "The Solution", "Conclusion". It is NOT one paragraph.
- **R16b.** Each section is **1 ScenePlan row** in the data store. Chunks under that ScenePlan (`sceneChunks[sceneId]`) are the unit of LLM generation. In V1, each section typically has 1 chunk; the compiler may split into multiple chunks during generation if the word count target warrants it. The 1-4 chunks constraint is a soft UI convention in essay mode only, not a schema invariant.
- **R16c.** The composer renders the section heading and its compiled prose (concatenation of its chunks) as one TipTap (AnnotatedEditor) instance. Chunk boundaries are invisible in the UI — the user thinks in sections, the system generates in chunks.
- **R16d.** Bootstrap templates decide default section count: Opinion piece 3-5, Personal essay 3-5.

### Essay/Fiction Mode Routing

- **R17. [RESOLVED]** Mode is stored as a new field `bible.mode: 'fiction' | 'essay'`. This is a **scoped, intentional data model touch** — acknowledged as minimal schema addition, not a violation of "no data model changes" since the alternative (runtime inference) is fragile.
- **R17a.** Existing fiction projects migrate with default `mode = 'fiction'` so they continue rendering the 7-stage workflow rail unchanged.
- **R17b.** New projects created via template picker get `mode = 'essay'` automatically.
- **R17c.** `App.svelte` branches on `bible.mode` at the top level: `essay` routes to the new `EssayComposer` component, `fiction` routes to the existing workflow rail and DraftStage.
- **R18.** The simplification is additive: no existing fiction UI components are deleted, and no fiction-related tests break. Fiction mode renders identically to today for fiction projects.

### Save Behavior

- **R18a.** Edits to section prose save on blur (when the editor loses focus) or on generation (which commits current prose before streaming).
- **R18b.** Edits to Setup panel fields save on blur.
- **R18c.** Auto-save is not otherwise implemented. This matches the existing app's behavior.

### Export

- **R18d.** The top-right Export button opens a lightweight menu with format options: Markdown, Plain text (both use existing `src/export/` functions).
- **R18e.** If any section is empty or has unresolved critical audit flags, show a confirmation: "N sections unaddressed — export anyway?"
- **R18f.** Export produces a file download. No server-side rendering needed.

### Accessibility

- **R18g.** Section reorder is keyboard-accessible via up/down buttons (not drag-only). Focus order is sequential; buttons have ARIA labels.
- **R18h.** Audit decorations combine color and underline style. Hover-revealed information is also focus-revealed. Menu actions are keyboard-operable.
- **R18i.** Minimum touch target: 44x44px for interactive elements.

### Implementation Constraint

- **R19. [REVISED]** The change is implemented as **one new composer component tree** (`EssayComposer.svelte` + a few sub-components: `SetupPanel.svelte`, `SectionCard.svelte`, `TemplatePicker.svelte`) that reuses existing data stores, state management, compilation pipeline, voice pipeline, auditor, and AnnotatedEditor. Existing stage components are not refactored. Routing divergence is one line in `App.svelte`.

## Success Criteria (REVISED)

- **User experience:** A user can write one complete 2000-word opinion piece using the composer, end-to-end, without opening the old fiction stages and without hitting a field or control they don't understand.
- **Fiction preservation:** All 1427 existing tests pass. Fiction mode renders identically for legacy projects (`mode === 'fiction'`).
- **Pipeline integrity:** The kill list, voice profile, CIPHER, revision learner, and auditor all function with zero code changes to their implementations.
- **Reuse:** The composer reuses `AnnotatedEditor.svelte`, the existing generation store, the existing bootstrap system, and the existing auditor. New code is primarily composer structure + state + wiring.
- **No LOC budget.** Feature quality matters more than line count. The realistic estimate for V1 is 1000-1500 lines of new composer code + ~100 lines of wiring (mode field, App.svelte branch, tests). This is a deliberate reset from the earlier 500-line target, which was aspirational.

## Scope Boundaries

- **Not changing the compilation pipeline** — Ring 1/2/3 builders, budget enforcer, assembler unchanged.
- **Not changing the voice pipeline** — 5-stage pipeline, CIPHER, distillVoice unchanged.
- **Not changing the auditor core** — kill list, sentence variance, paragraph length checks unchanged.
- **Not deleting any existing components** — Fiction stage components, panels, and modals all remain in the codebase.
- **Not redesigning the home screen** — The project list stays as-is. Divergence happens at project open time via `bible.mode`.
- **Not implementing auto-save beyond save-on-blur** — Matches existing behavior.
- **Not building per-section version history** — Only the 60-second Revert slot is kept in V1.
- **Not building DnD reorder in V1** — Up/down buttons only.
- **Not building side-by-side compare in V1** — Replace-in-place with Revert only.
- **Not shipping "Rewrite this span" action in V1** — Depends on V2 span-directive infrastructure.
- **Not shipping advanced section controls in V1** — Power controls are V2.
- **Not shipping 3 of 5 templates in V1** — Opinion + Personal only.

## Key Decisions

- **Aggressive V1 cut over feature-complete V1** — Ship the smallest version that proves the thesis. Earn each additional feature by actually wanting it after writing 1-3 real essays with the minimal version.
- **Preserve cut features in Deferred to V2 section** — Every cut idea stays documented with its full spec. Promoting V2 → V1 is a doc edit, not a re-brainstorm.
- **`bible.mode` field over runtime inference** — Small scoped schema addition, with default `'fiction'` for legacy projects. App.svelte branches at the top level, no conditional rendering within DraftStage.
- **Composer Section = ScenePlan row (1:1)** — Reuses the existing generation pipeline which is coupled to `activeScenePlan`. No second code path.
- **Reuse AnnotatedEditor for inline audit** — The codebase already implements Grammarly-style ProseMirror decorations. Reuse instead of rebuild.
- **Single Setup panel over three cards** — "Three natural groupings" is taste, not requirement. One collapsible panel has simpler state and validation.
- **Replace-in-place with Revert over side-by-side compare** — Gets 90% of the safety with 10% of the work. The CIPHER A/B preference signal this enables is itself V2, so building the UI for it now is premature.
- **Reuse AnnotatedEditor, drop "Rewrite this span"** — The hover menu action requires V2 infrastructure. Ship clean hover menu without it.
- **2 templates in V1** — User writes primarily Opinion + Personal. Other templates are occasional and can be added in V2 without changing the template architecture (just new entries in `essayTemplates.ts`).
- **Up/down buttons over drag-and-drop** — No DnD library exists, hand-rolling is 100-150 lines, accessibility needs alternatives anyway. Up/down buttons are simpler and accessible by default.
- **Explicit generation lifecycle states** — Every section state is enumerated. Controls are matrix-mapped to enabled/disabled. No ambiguity for implementers.
- **Voice profile is soft-required, not hard-required** — Generation works without a voice profile with graceful degradation and a one-time nudge.
- **`chunkDescriptions` is section-wide, not per-chunk** — One key-points list per section. Resolves the coherence ambiguity.
- **Section prose is a single editor instance per section** — Chunk boundaries are invisible in the UI. Edits are mapped back to the containing chunk on save. Resolves the editing model ambiguity.
- **Drop the 500-line LOC budget** — Replaced with a user-experience success criterion. Realistic V1 is 1000-1500 lines of composer code.

## Dependencies / Assumptions

- The existing ScenePlan data structure covers essay needs without new fields (confirmed by feasibility review: 1:1 Section ↔ ScenePlan mapping works).
- The existing voice pipeline, CIPHER, and auditor APIs can be called from the new composer component without modification.
- The Svelte 5 rune-based state store (`ProjectStore`) exposes all the data the composer needs.
- `AnnotatedEditor.svelte` can be driven by `AuditFlag` data via a simple mapping function (confirmed by feasibility review: the component already accepts `EditorialAnnotation[]`).
- The existing bootstrap system already returns a `sections: [{heading, purpose, keyPoints[]}]` shape (confirmed by feasibility review).
- Adding `bible.mode` field requires a trivial migration (default all existing rows to `'fiction'`).

## Outstanding Questions

### Resolve Before Planning

(none — all product decisions resolved)

### Outstanding Premise Challenge (user decision, does not block planning)

- **P0: Hide vs Delete vs Fork for fiction mode.** Product-lens review strongly challenged the "hide don't remove" principle as a sunk-cost compromise for a single-user tool. For the aggressive-cut V1 path, "hide" is acceptable because we're not touching fiction components at all — they just don't render. But the long-term question stays open: once the composer is proven and you've written several essays with it, is fiction mode still worth maintaining? Options for later: (a) delete fiction UI in a separate commit, (b) fork the repo into essay-writer, (c) keep both as first-class modes. This question does not block V1 planning but should be revisited after dogfooding.

### Deferred to Planning

- [Affects R10] Exact integration point between composer section UI and `generation.svelte.ts` (which store manipulation is needed before each `generateChunk` call).
- [Affects R12k-m] Lock mechanism for edit-during-stream (TipTap read-only toggle vs visual-only overlay).
- [Affects R15] Mapping function shape from `AuditFlag` to `EditorialAnnotation` — exact type adaptation.
- [Affects R17] Migration script for adding `bible.mode` column with default value.

## Deferred to V2 (Full Specs Preserved)

Every feature below was considered for V1, has a full spec, and is promotable by moving the R-numbers back into the V1 Requirements section. These are not abandoned ideas — they are ideas waiting their turn.

### Side-by-Side Regenerate Compare

When a user regenerates a section, the new prose appears alongside the old prose (old on left, new on right, or stacked on narrow screens). The user chooses: "Use this version" on the new prose, "Keep current" on the old, or manually merges by copying across. Accepted new prose replaces the current prose. Rejected new prose is discarded. **Enables the CIPHER A/B preference signal below.** Deferred because: (a) compiledPayload singleton makes dual-stream awkward, (b) replace-in-place with Revert gets most of the safety value at a fraction of the cost, (c) no usage data yet showing this is worth the complexity.

**Interaction states needed for promotion:** Generating-right-pane-streaming (left-pane locked or editable?), Both-ready, Error (right pane shows error + retry), Cancelled (exit back to single view). Must specify all before implementing.

### CIPHER A/B Preference Signal

The side-by-side compare flow generates an implicit preference signal: user picked version A over version B. This is a different class of signal than the existing edit-based CIPHER learning — it's comparative, not corrective. Feeding it into the voice learning loop requires a new preference-logging endpoint and a CIPHER extension that processes A/B pairs differently from edit pairs. Potentially significant voice-matching improvement.

### Span-Anchored Directives

Rich inline revision pattern: user selects any text span (word, phrase, sentence, paragraph), types an instruction in a popup, the span gets a numbered underline marker. Multiple directives accumulate per section in a "Pending revisions" strip. On regenerate, all directives are compiled into structured instructions for the LLM:
```
REVISION INSTRUCTIONS:
- Revision 1: In "the quick brown fox" — make this more specific
- Revision 2: In "jumped over" — use a more energetic verb
- Revision 3: Paragraph 2 — shorter sentences, more staccato
```
Accumulated directives clear after accepted regeneration. Requires: new UI in the chunk editor (selection + popup), new pending-directives data structure, prompt construction logic to format span-anchored instructions, clearing logic. Estimated 200-300 lines beyond the V1 composer. High UX value once v1 basics are proven.

### "Rewrite This Span" Hover Action in Audit Menu

When clicking an audit decoration (red/yellow underline), the hover menu includes "Rewrite this span" action. This is essentially a one-click shortcut into the span-anchored directives system above — clicking it creates a directive for that span and opens the instruction popup. Depends on span-anchored directive infrastructure.

### Advanced Section Controls Toggle

Each section has an "Advanced ▸" toggle that expands to reveal power controls: reader takeaway, pacing, density, word count target, section-specific prohibitions. Maps to existing ScenePlan fields (`readerEffect`, `pacing`, `density`, `estimatedWordCount`, `sceneSpecificProhibitions`). Toggle state is per-section and persists across sessions. Optional global "Show advanced for all sections" toggle in a settings menu. Cut from V1 because the primary controls (heading, goal, key points, anchor lines) cover most needs and the advanced controls risk re-introducing the "fill out many fields before generating" friction that the simplification is meant to remove.

### Templates 3-5 (Explainer, How-to, Hot Take)

- **Explainer**: teaching a concept, structured but not academic. Target 2000-4000 words, 4-6 sections.
- **How-to**: practical step-by-step. Target variable length, sequential/numbered sections.
- **Hot take**: short punchy single-thesis piece. Target 500-1000 words, 1-2 sections.

Each template = a new entry in `essayTemplates.ts` with its own system prompt override, default section count, tone hints, word count target. Template architecture (the registry + bootstrap integration) ships in V1 with 2 templates; adding more is a data-only change.

### Three-Card Setup Split

Replace the single "Setup" panel with three independently collapsible cards: Brief, Voice, Style. Each expands/collapses independently. Natural mental grouping, more visual separation. Cut from V1 because a single unified panel has simpler state/validation and the groupings are a taste call rather than a functional requirement.

### Drag-and-Drop Section Reordering

Replace up/down buttons with drag handles on each section for smooth reordering. Requires: a DnD library (svelte-dnd-action or hand-rolled HTML5 drag events), drop indicators, keyboard alternatives (for accessibility parity with up/down buttons), touch-reorder (long-press + move). 100-300 lines. V1 up/down buttons cover the functional need; DnD is polish.

### Per-Section Chunk History / Full Regeneration History

Beyond the 60-second Revert slot, preserve all generated versions per chunk with a "view history" dropdown. Each history entry shows: timestamp, directive text used, model used, accept/reject status. Useful for retrospective comparison and for future "revert to version N" functionality.

### Custom AnnotatedEditor Decorations Beyond Reuse

The V1 approach reuses AnnotatedEditor's existing decoration rendering as-is. V2 may want to extend this: custom decoration styles specific to essay audit categories (different underline colors/styles for slop vs hedging vs monotony), richer hover menus, persistent annotations (not just ephemeral audit flags).

### Template Customization by User

Users editing their own templates (custom bootstrap prompts, custom section structures, custom kill list additions) for repeatable essay patterns they own. Requires a template editor UI and either extending the static registry with user-authored templates or adding a new DB table.

### Product Differentiation Surface Area

UI hooks that surface word-compiler's unique value to users: voice match confidence per generated section, CIPHER learning status ("5 preferences learned from your last 10 edits"), kill list evolution ("3 additions auto-proposed from your edits this week"), voice fidelity metric in footer alongside word count. These differentiate from generic AI writing tools but are not core to the minimum viable composer.

### Comprehensive Responsive Design

V1 targets desktop primarily. V2 should add: breakpoint strategy, card stacking on mobile, section control density collapse, touch-friendly reorder, mobile-appropriate audit menu positioning, footer behavior on narrow screens.

### Product Vision Refinement / Unifying Voice

The current doc is a feature spec with decisions rationalized per-requirement. V2 planning should add a stronger unifying Product Vision — what the composer FEELS like during active writing, what the user's hands are doing, what the AI's role is visually.

## Next Steps

`/ce:plan` for structured implementation planning

Once V1 ships and you've written 2-3 real essays with it, revisit this document. Promote V2 items that you actually missed while using V1. Leave unpromoted items in V2 — they're preserved, not lost.
