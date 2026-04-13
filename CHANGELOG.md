# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Essay composer mode** — single-page composer for essay writing, selected via a new `bible.mode === "essay"` routing branch in `App.svelte`. Fiction's 7-stage workflow remains unchanged for `mode === "fiction"` or legacy bibles without a mode.
- **Essay templates registry** (`src/bootstrap/essayTemplates.ts`) — Opinion Piece and Personal Essay templates with genre-specific system prompt overrides, default section/word-count targets, and failure-mode guardrails. Templates integrate with `buildBootstrapPrompt`, `bootstrapToBible`, and `bootstrapToScenePlans`.
- **TemplatePicker** modal — new-project entry for essay mode. Two template cards, brief textarea, streaming bootstrap, and skip-blank path that seeds an author persona and a placeholder section plan passing the scene plan gate on first render.
- **EssayComposer** root orchestrator — owns the section state machine, FIFO queue, 60-second revert slots, voice nudge, and cold-load recovery. Renders `SetupPanel`, a list of `SectionCard`s, and `ComposerFooter`. Wires `onGenerate` through `handleComposerGenerate` (setActiveScene + tick + generateChunk) so the compiler effect recomputes the payload before streaming.
- **SectionCard** presentational component with a pure `computeControlMatrix` lookup that drives every visible/disabled control from a 5-state discriminated union (`idle-empty`, `idle-populated`, `queued`, `streaming`, `failed`). Reuses `AnnotatedEditor` for Grammarly-style kill-list decorations via a new `auditMapping.ts` pure function.
- **SetupPanel** with Brief/Voice/Style subsections. Reuses `VoiceProfilePanel` verbatim for voice. Brief fields are intentionally mapped onto existing fiction Bible fields (thesis → `subtextPolicy`, audience and tone → `pov.notes`) so no schema migration is required.
- **ComposerFooter** with word count, clickable audit-count jump pills, voice readiness badge, last-save timestamp, and an export menu that reuses `src/export/markdown.ts` and `src/export/plaintext.ts` with pre-export confirmation when sections are empty or kill-list flags are unresolved.
- **Pure section state machine** (`sectionStateMachine.ts`) — reducer with zero Svelte imports covering the 5-state × 7-event transition matrix. Invalid transitions no-op so the composer survives race conditions.
- **Scene plan cascade delete and batch reorder** — new `DELETE /scenes/:id` and `PATCH /chapters/:chapterId/scenes/reorder` server routes, matching client commands with optimistic update and snapshot rollback, and a repository-level scene cascade that deliberately preserves `significant_edits` to protect CIPHER voice-learning history.
- **Atomic essay project creation** (`createEssayProject` on `api-actions.ts`) — sequences project → bible → chapter arc → scene plans with rollback via `apiDeleteProject` if any step after project creation fails. Rollback errors are swallowed so the original cause surfaces.
- **`apiDeleteProject`** client helper wrapping the existing `DELETE /projects/:id` route.
- **`bible.mode`** optional field on the Bible type (zero-migration — `bibles.data` is a JSON blob, legacy bibles deserialize with `mode === undefined`).

### Changed

- `buildBootstrapPrompt`, `bootstrapToBible`, and `bootstrapToScenePlans` accept an optional `EssayTemplate` parameter. When provided, the bootstrap prompt appends the template's genre-specific system prompt override, the Bible is seeded with the template's defaults, and each scene plan's `failureModeToAvoid` is derived from the template.
- `App.svelte` model selector gate broadens to also show in essay mode. `GlossaryPanel` and `StageCTA` are hidden in essay mode. Keyboard handler gains an essay-mode early branch: `Cmd/Ctrl+G` generates the focused section via a bound composer ref.
- New-project entry points (no-projects welcome screen and `ProjectList` create button) now open `TemplatePicker` instead of creating a blank project from a title form.

### Fixed

- N/A (additive feature branch; no bug fixes)

## [1.0.0] - 2026-03-23

### Added

- **Context compiler** with three-ring architecture (system/chapter/scene) and token budget enforcement
- **Bible system** with version-controlled character dossiers, style guides, narrative rules, and locations
- **Scene planning** with chapter arcs, beat sheets, and continuity tracking
- **Gated prose generation** with chunk-by-chunk drafting and human review (accept/edit/reject)
- **Auditor suite**: kill list enforcement, sentence variance analysis, epistemic leak detection, subtext auditing
- **Revision learner**: diff classification, pattern accumulation, bible update proposals, compiler tuning
- **Narrative IR**: structured extraction of character states, plot threads, and epistemic deltas
- **Bootstrap mode**: paste a synopsis to auto-generate a draft bible and scene plans
- **Genre templates**: pre-configured rules for literary fiction, sci-fi, thriller, romance, and fantasy
- **Voice profiling**: fingerprint extraction and separability metrics across characters
- **Export pipeline**: Markdown and plaintext output
- **Evaluation framework**: automated quality metrics with mock and live LLM modes
- **Local-first persistence**: SQLite database with Express API server
- **Storybook**: component documentation and visual testing
- **E2E tests**: Playwright browser automation suite
