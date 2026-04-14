---
status: pending
priority: p3
issue_id: 007
tags: [code-review, simplicity, yagni, cleanup]
dependencies: []
---

# Cleanup: dead ControlMatrix field, stub handlers, overdecomposed reducer, unused props

## Problem Statement

Consolidated P3 cleanup from `code-simplicity-reviewer` + tail-end P3 items from `kieran-typescript-reviewer`. Each item is small; together they cut ~80 lines without touching any behavior.

**Verdict from simplicity reviewer: MOSTLY LEAN.** The architecture is sound; cruft is small and localized.

## Findings

### 7.1 — `ControlMatrix.directiveEnabled` is dead code
`src/app/components/composer/types.ts:71` — defined, set in three branches (`:111`, `:139`, `:152`), but `SectionCard.svelte` never reads it. Only the test file asserts on it. Either wire it into SectionCard's directive input or delete the field + its test assertions.

### 7.2 — `handleJumpToViolation` is a no-op stub
`src/app/components/composer/EssayComposer.svelte:464-469` — V1 placeholder that does literally nothing. ComposerFooter's entire `ViolationCategory` prop plumbing + `onJumpToViolation` callback exists only to satisfy the test that the click fires. Either make the pills non-clickable for V1 (remove the prop, the type alias, and ~20 lines of footer wiring) or implement the scroll-to-flag.

### 7.3 — `sectionStateMachine.ts` per-event helper functions are overkill
`src/app/components/composer/sectionStateMachine.ts:30-64` splits 5 trivial transitions into 5 named functions "to stay under Biome's cyclomatic complexity ceiling (max 15)" — but the inlined switch would be cyclomatic ~8, well under the limit. **The justification comment at line 28 is factually wrong.** Collapse all 5 helpers into the switch. Cut: ~30 lines, one indirection layer. The reducer module itself is still justified (it's independently tested).

### 7.4 — Stale `setSectionState` wrapper with outdated comment
`src/app/components/composer/EssayComposer.svelte:98-104` — body is literally `sectionStates.set(...)` plus a 4-line comment about a "reactive re-poke" that the code doesn't actually do. Inline the 13 call sites or delete the stale commentary.

### 7.5 — `onRequestRefinement` and `onExtractIR` received but unused
`src/app/components/composer/EssayComposer.svelte:50-62` — both props are destructured, renamed to `_`, and never used in the composer body. Remove from the prop contract. (Parent `App.svelte` still passes them — update there too.)

### 7.6 — `ControlMatrix.queueIndicatorVisible` is redundant with `queuePosition !== null`
`SectionCard.svelte:244` already checks both. One is sufficient; the state-derived flag adds nothing the caller can't compute.

### 7.7 — `createEssayProject` return type overspecified
`src/app/store/api-actions.ts:115-153` — returns `{ project, chapterArc, scenePlans }` but `TemplatePicker` only uses `project`. Drop the return type to `Promise<Project>`.

### 7.8 — `auditMapping.ts` fingerprint parsing is stringly-typed
`SectionCard.svelte:167-172` re-parses `sceneId:pattern:start:end` out of the fingerprint to recover the pattern on dismiss. Extend `EditorialAnnotation` or ship a composer-specific wrapper type so `pattern` is a typed field, not hidden in the fingerprint.

### 7.9 — `sectionStateMachine.ts` `REVERTED` event is a no-op
Line 78-82 — the comment explains why, but an event that never changes state is a code smell. Either remove it from `StateEvent` and let the composer call nothing, or track "was reverted" in state so `idle-populated`-post-revert is distinguishable in tests.

### 7.10 — Empty array typed as `any[]` in re-audit batch
`src/app/components/composer/EssayComposer.svelte:490` — `const allFlags = []` is inferred `any[]`. Should be `const allFlags: AuditFlag[] = []`.

### 7.11 — Redundant `plan as ScenePlan` cast
`src/app/store/api-actions.ts:131-135` — `plansWithChapter[i] as ScenePlan` exists because TS can't narrow under `noUncheckedIndexedAccess`. Replace with `for (const [i, plan] of plansWithChapter.entries())` for a non-nullable `plan` for free.

### 7.12 — `dispatchEvent` shadows `window.dispatchEvent`
`src/app/components/composer/EssayComposer.svelte:110` — rename to `dispatchStateEvent` or `applyEvent`. Confusing in a file this large.

### 7.13 — `_commands` unused in ComposerFooter is accepted but flagged
`src/app/components/composer/ComposerFooter.svelte:22` — reserved for contract symmetry with SectionCard/SetupPanel. Add a `// biome-ignore` comment pointing at the symmetry rationale so future reviewers don't re-flag it.

## Proposed Solutions

**A. Ship as one "simplicity sweep" commit after P1/P2 fixes land (recommended)**
- Total diff: ~80 lines removed, a handful of renames, no behavior change.
- Test suite stays at 1673.
- **Pros:** Reviews the whole surface once. Leaves the codebase meaningfully tighter.
- **Cons:** Broad diff, but each item is orthogonal.
- **Effort:** Small. **Risk:** None — no behavior change.

**B. Cherry-pick the load-bearing items only**
- 7.3 (reducer collapse), 7.5 (unused composer props), 7.12 (shadowed dispatchEvent), 7.13 (biome-ignore comment) are the ones worth the churn.
- Skip 7.4/7.6/7.8/7.9/7.10/7.11 as documented future cleanup.

## Recommended Action
(Filled during triage. Option A is the compound-engineering default.)

## Technical Details

See per-item file:line references above. Each item is self-contained.

## Acceptance Criteria

- [ ] All 13 items addressed (either fixed or explicitly deferred with a comment)
- [ ] Test suite stays at 1673
- [ ] `pnpm typecheck` + `pnpm lint` still clean
- [ ] No behavior change observable in composer tests

## Work Log

(To be filled during implementation.)

## Resources

- PR: https://github.com/sethkravitz/word-compiler/pull/7
- Reviewers: `code-simplicity-reviewer`, `kieran-typescript-reviewer`
