---
title: "feat: Fix essay bootstrap flow end-to-end"
type: feat
status: active
date: 2026-04-09
origin: docs/brainstorms/2026-04-08-essay-writer-adaptation-requirements.md
---

# Fix Essay Bootstrap Flow End-to-End

## Overview

The essay bootstrap produces a Bible with a kill list and tone, but throws away the most important parts: section structure and thesis. The Author character profile is skeletal. Character form fields still use fiction labels. The Plan stage is empty after bootstrap because sections aren't converted to section plans. This plan fixes the entire flow from bootstrap → brief → plan → draft so an essay writer gets a working end-to-end experience.

## Problem Frame

User pastes an essay idea, bootstrap runs, LLM produces a structured plan (thesis, sections, tone, kill list). But:
1. **Sections are discarded** — `bootstrapToBible()` ignores `parsed.sections`. The Plan stage is empty.
2. **Thesis is misplaced** — Stored in `subtextPolicy` instead of being prominently visible.
3. **Author profile is empty** — Only `vocabularyNotes` populated. No writing samples, no voice details, no author background.
4. **Character form labels are fiction-coded** — "Story Role", "Physical Description", "Dialogue Samples", "Lying Style", etc.
5. **Genre templates are fiction** — Literary Fiction, Thriller, Romance, Science Fiction.

The system IS working (LLM fires, database persists, compilation pipeline runs). The data just isn't being stored or displayed correctly for essays.

## Scope Boundaries

- **No TypeScript interface changes** — `Bible`, `CharacterDossier`, `ScenePlan`, `NarrativeRules` stay as-is
- **No database schema changes** — Same SQLite tables, same columns
- **No compilation pipeline changes** — Ring builders, assembler, budget enforcer, auditor untouched
- **No API route changes** — Same REST endpoints
- **Field examples** (`field-examples.ts`) — Fiction-specific but lower priority. Out of scope for this plan.

## Key Technical Decisions

- **Bootstrap creates both Bible AND section plans in one step:** Currently bootstrap only creates a Bible. The extracted `sections` should also produce ScenePlans so the Plan stage is pre-populated. This requires the bootstrap modal to call both `saveBible()` and `saveMultipleScenePlans()`.
- **Thesis stored in Bible's `sourcePrompt` field AND displayed in the UI:** The Bible already has a `sourcePrompt` field that stores the original brief text. The thesis should also be stored somewhere visible. Best option: use `narrativeRules.pov.notes` for the thesis + tone summary, and display `sourcePrompt` in the Bootstrap stage as a collapsible "Original Brief" section. No new fields needed.
- **Author character form gets essay-appropriate labels:** "Physical Description" → hidden or relabeled to "Author Bio", "Backstory" → "Background / Expertise", "Dialogue Samples" → "Writing Samples", "Lying Style" / "Stress Response" etc. → hidden for essay mode. We relabel the visible text but keep the underlying data fields.
- **Essay style templates replace fiction genres:** 4 essay templates (Personal Essay, Analytical, Op-Ed, Narrative Nonfiction) with essay-appropriate kill lists, structural bans, and policies.
- **POV labels relabeled for essay context:** "First" → "First Person", "Close Third" → "Personal Narrative", "Distant Third" → "Analytical", "Omniscient" → "Survey". Underlying values unchanged.

## Implementation Units

- [ ] **Unit 1: Fix bootstrap to preserve sections as ScenePlans**

**Goal:** When the bootstrap LLM returns sections, automatically create ScenePlans so the Plan stage is pre-populated.

**Requirements:** R6, R8

**Dependencies:** None

**Files:**
- Modify: `src/bootstrap/index.ts` — add a `bootstrapToScenePlans()` function
- Modify: `src/app/components/BootstrapModal.svelte` — call `saveMultipleScenePlans()` after `saveBible()`
- Modify: `src/app/components/BibleBootstrapTab.svelte` — same change for the inline bootstrap tab
- Test: `tests/bootstrap/index.test.ts`

**Approach:**

Add a new export `bootstrapToScenePlans(parsed, projectId, authorCharacterId)` that converts `parsed.sections` into `ScenePlan[]`. Each section becomes a ScenePlan with:
- `title` = section heading
- `narrativeGoal` = section purpose
- `chunkDescriptions` = section keyPoints
- `chunkCount` = keyPoints.length (one chunk per key point)
- `povCharacterId` = the author character ID
- `failureModeToAvoid` = "" (user fills in later)
- `estimatedWordCount` = reasonable defaults based on total sections

In `BootstrapModal.svelte`, after `commands.saveBible(bible)`, also call:
```
const plans = bootstrapToScenePlans(parsed, projectId, bible.characters[0].id);
if (plans.length > 0) await commands.saveMultipleScenePlans(plans);
```

The same change applies to `BibleBootstrapTab.svelte` which has its own bootstrap flow.

Also need to create a ChapterArc (essay arc) before saving scene plans, since plans require a `chapterId`.

**Patterns to follow:**
- `mapSceneBootstrapToPlans()` in `src/bootstrap/sceneBootstrap.ts` — existing function that converts parsed bootstrap data to ScenePlans

**Test scenarios:**
- Happy path: `bootstrapToScenePlans()` converts 3 sections to 3 ScenePlans with correct titles and goals
- Happy path: Each plan has chunkCount matching keyPoints length
- Edge case: Empty sections array returns empty plans array
- Edge case: Section with no keyPoints gets chunkCount = 1

**Verification:**
- After bootstrap, clicking "Continue to Plan" shows the section plans pre-populated in the sequencer

- [ ] **Unit 2: Fix thesis display — move from subtextPolicy to prominent location**

**Goal:** Make the thesis visible at the top of the Essay Brief view instead of buried in "Subtext Policy".

**Requirements:** R6

**Dependencies:** None (can parallel with Unit 1)

**Files:**
- Modify: `src/bootstrap/index.ts` — store thesis in `pov.notes` and `expositionPolicy` instead of `subtextPolicy`
- Modify: `src/app/components/AtlasBibleTab.svelte` — display thesis prominently before the Author Voice section
- Modify: `src/app/components/stages/BootstrapStage.svelte` — show the sourcePrompt / thesis at top
- Test: `tests/bootstrap/index.test.ts`

**Approach:**

In `bootstrapToBible()`:
- `narrativeRules.pov.notes` = thesis + tone summary (this is the essay's central argument + voice guidance)
- `narrativeRules.subtextPolicy` = null (don't abuse this field)
- `narrativeRules.expositionPolicy` = section overview from parsed sections (one-liner per section for quick reference)

In `AtlasBibleTab.svelte`, add a "Thesis & Structure" section at the top of the bible view (before Author Voice) that shows:
- The thesis from `pov.notes`
- The `sourcePrompt` as a collapsible "Original Brief"

In `BootstrapStage.svelte`, when the bible exists, show the thesis prominently in the header area.

**Patterns to follow:**
- Existing `CollapsibleSection` component for the original brief display

**Test scenarios:**
- Happy path: `bootstrapToBible()` stores thesis in `pov.notes`, not `subtextPolicy`
- Happy path: Atlas view shows thesis at top
- Edge case: No thesis in parsed data — `pov.notes` gets default tone summary only

**Verification:**
- After bootstrap, the thesis is visible at the top of the Essay Brief view, not buried under "Subtext Policy"

- [ ] **Unit 3: Relabel character form fields for essay context**

**Goal:** Replace fiction labels in the character editor and character card with essay-appropriate terms.

**Requirements:** R9

**Dependencies:** None (can parallel)

**Files:**
- Modify: `src/app/components/CharacterFormFields.svelte`
- Modify: `src/app/components/CharacterCard.svelte`
- Modify: `src/app/components/character.helpers.ts` (if it has user-visible strings)
- Modify: `src/app/components/stages/PlanStage.svelte` — sidebar "CHARACTERS (3)" label
- Test: update any UI tests that assert on these strings

**Approach:**

`CharacterFormFields.svelte`:
- "Character Name" → "Name"
- "Role (Story Role)" → "Role"
- Protagonist/Antagonist/Supporting/Minor → "Primary Author" / "Secondary Voice" / "Referenced Voice" / "Minor Reference" (or just keep them — they work as voice hierarchy)
- "Appearance & Background" → "Background"
- "Physical Description (What They Look Like)" → hide or "Author Bio (Optional)"
- "What does the reader SEE?" placeholder → "Brief professional or personal bio"
- "Backstory (Their History)" → "Background / Expertise"
- "Brief but specific" placeholder → "What gives this voice authority on this topic?"
- "Vocabulary Notes (How They Talk)" → "Vocabulary Notes (Writing Style)"
- "Verbal Tics (Speech Habits)" → "Writing Tics (Recurring Patterns)"
- "um, you know..." placeholder → "e.g. parentheticals, em dashes, sentence fragments..."
- "Metaphoric Register (Their Comparison Style)" → "Metaphoric Register (Comparison Style)"
- "Prohibited Language (Words They'd Never Say)" → "Prohibited Language (Words to Avoid)"
- "Words this character would never use..." → "Words you would never write..."
- "Dialogue Samples (Example Lines)" → "Writing Samples (Example Passages)"
- "Example dialogue lines..." → "Paste 2-3 paragraphs of your existing writing..."
- "Behavior" section → collapse label to "Writing Tendencies"
- "Stress Response (Under Pressure)" → "Argumentative Style"
- "Social Posture (Group Dynamics)" → hide or "Rhetorical Approach"
- "Notices First (What Catches Their Eye)" → "Observational Focus"
- "Lying Style (How They Deceive)" → hide
- "Emotion Physicality (Body Language for Feelings)" → hide

`CharacterCard.svelte`:
- "Identity" group → "Profile"
- "Voice" group stays
- "Behavior" group → "Writing Tendencies"

`PlanStage.svelte`:
- Sidebar "Characters (N)" → already shows "CHARACTERS (3)" in the screenshot. Need to check if this was missed in the prior relabeling.

**Patterns to follow:**
- Same string-replacement approach as prior UI relabeling

**Test scenarios:**
- Happy path: Character form shows "Writing Samples" instead of "Dialogue Samples"
- Happy path: Character card shows "Profile" instead of "Identity"

**Verification:**
- Open the Edit Brief modal, go to Author Voice step — all labels are essay-appropriate

- [ ] **Unit 4: Replace fiction genre templates with essay style templates**

**Goal:** Replace Literary Fiction / Thriller / Romance / Science Fiction with Personal Essay / Analytical / Op-Ed / Narrative Nonfiction.

**Requirements:** R2, R3, R5b

**Dependencies:** None (can parallel)

**Files:**
- Modify: `src/bootstrap/genres.ts`
- Modify: `tests/bootstrap/genres.test.ts`

**Approach:**

Replace the 4 fiction templates with:

1. **Personal Essay** — First person, intimate distance, stream interiority. Kill list: memoir cliches ("taught me a valuable lesson", "little did I know", "looking back"). Structural bans: throat-clearing, hedging. Metaphors: domestic, bodily, weather.

2. **Analytical Essay** — First person (moderate distance), filtered interiority. Kill list: academic filler ("it is important to note", "studies show", "in today's world"). Structural bans: paragraph-opening However/Moreover/Furthermore, straw-man framing. Metaphors: systems, architecture, machinery.

3. **Op-Ed / Persuasive** — First person, close distance. Kill list: persuasion cliches ("make no mistake", "the fact of the matter", "at the end of the day"). Structural bans: false equivalence, bothsidesism hedging. Punchy sentence architecture.

4. **Narrative Nonfiction** — Close distance, filtered interiority. Kill list: journalism cliches ("when asked about", "declined to comment", "sources say"). Structural bans: timeline confusion, unattributed claims. Metaphors: subject-domain-specific.

Each ships the 48-entry default anti-slop kill list merged with template-specific additions and 7+ structural bans.

**Patterns to follow:**
- Exact same `GenreTemplate` / `GenreDefaults` structure

**Test scenarios:**
- Happy path: `GENRE_TEMPLATES` exports 4 templates with essay IDs
- Happy path: Each template has non-empty kill list and structural bans
- Happy path: `applyGenreTemplate()` fills blank bible from essay template
- Edge case: Template doesn't overwrite user-set values

**Verification:**
- Style Template dropdown shows essay options instead of fiction genres

- [ ] **Unit 5: Relabel POV and form step labels**

**Goal:** Replace fiction-specific POV labels and form step names with essay equivalents.

**Requirements:** R6

**Dependencies:** None (can parallel)

**Files:**
- Modify: `src/app/components/BibleGuidedFormTab.svelte`
- Modify: `src/app/components/AtlasBibleTab.svelte`
- Modify: `src/app/components/SceneGuidedFormTab.svelte`

**Approach:**

`BibleGuidedFormTab.svelte`:
- "Genre Template" → "Style Template"
- "Select a genre to pre-fill defaults..." → "Select a style to pre-fill defaults..."
- "Foundations" step → "Voice & Perspective"
- "POV Default" → "Perspective"
- POV options: "First" → "First Person", "Close Third" → "Personal Narrative", "Distant Third" → "Analytical", "Omniscient" → "Survey"
- "POV Fine-Tuning" → "Perspective Fine-Tuning"
- "POV Distance" → "Perspective Distance"
- "POV Interiority" → "Perspective Interiority"
- "POV Reliability" → "Perspective Reliability"

`AtlasBibleTab.svelte`:
- "Narrative Rules" → "Writing Rules"
- "Subtext Policy" → "Thesis" (since Unit 2 moves the thesis here or clears this)
- "Exposition Policy" → "Structure Overview"
- "Scene Ending Policy" → "Section Ending Policy" (already done? verify)
- "Setups & Payoffs" → "Setup & Resolution"

`SceneGuidedFormTab.svelte`:
- "POV Distance" → "Perspective Distance"

**Patterns to follow:**
- Same string-replacement approach

**Test scenarios:**
- Happy path: Style Template dropdown shows "Select a style..." placeholder
- Happy path: POV options show essay labels but bind to same underlying values
- Happy path: Atlas shows "Writing Rules" not "Narrative Rules"

**Verification:**
- Walk through guided form — all labels essay-appropriate

- [ ] **Unit 6: Fix remaining "CHARACTERS" label in Plan stage sidebar**

**Goal:** The sidebar in the Plan stage still shows "CHARACTERS (3)" per the screenshot. Fix this missed label.

**Requirements:** Consistency

**Dependencies:** None

**Files:**
- Modify: `src/app/components/stages/PlanStage.svelte`
- Verify: `src/app/components/stages/DraftStage.svelte` (check if sidebar has similar issue)

**Approach:**

Check the screenshot — the sidebar in Plan stage shows "CHARACTERS (3)" with "Author", "PROTAGONIST", "New Character". These labels come from:
- The `ref-label` spans in PlanStage.svelte (line 75: "Characters ({characters.length})")
- CharacterCard.svelte displaying character.role as "PROTAGONIST"

Fix:
- "Characters ({N})" → "Author Voice ({N})" in PlanStage sidebar
- Verify the role badge display is handled by CharacterCard which shows the raw role value — the role relabeling in Unit 3 handles this

**Test scenarios:**
- Happy path: Plan stage sidebar shows "Author Voice (N)" instead of "Characters (N)"

**Verification:**
- Navigate to Plan stage — sidebar header says "Author Voice"

## System-Wide Impact

- **Interaction graph:** `bootstrapToBible()` changes what data flows into the Bible. `bootstrapToScenePlans()` is new but uses existing `commands.saveMultipleScenePlans()` which already handles persistence. The compilation pipeline receives richer data (thesis in notes, sections as plans) but the pipeline code is unchanged.
- **Error propagation:** If section plan creation fails, the Bible is still saved (Bible save happens first). The user can always manually create section plans.
- **State lifecycle risks:** Bootstrap now creates both Bible and ScenePlans in sequence. If the second save fails, the user has a Bible but no plans — acceptable degradation since they can retry or create plans manually.
- **Unchanged invariants:** All TypeScript interfaces, SQLite schema, compilation pipeline, voice pipeline, auditor, and learner remain identical.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Bootstrap creating plans could conflict with existing plans | Check if plans already exist before creating; skip if Plan stage already has plans |
| Thesis placement in pov.notes could conflict with existing POV notes | pov.notes is nullable and concatenation-safe; append thesis before existing notes |
| Essay templates may miss important slop terms | Start with the proven 48-entry default list; template-specific additions are additive |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-08-essay-writer-adaptation-requirements.md](docs/brainstorms/2026-04-08-essay-writer-adaptation-requirements.md)
- Prior PRs: sethkravitz/word-compiler#2 (UI relabeling — merged)
- Bootstrap code: `src/bootstrap/index.ts` (current bootstrapToBible)
- Scene plan creation: `src/bootstrap/sceneBootstrap.ts` (pattern to follow)
- Character form: `src/app/components/CharacterFormFields.svelte`
