---
status: pending
priority: p1
issue_id: 002
tags: [code-review, correctness, app-routing, keyboard]
dependencies: []
---

# Cmd+G keyboard shortcut calls a non-existent method

## Problem Statement

`App.svelte` essay-mode keyboard handler calls `composerRef?.generateFocusedSection?.()`, but `EssayComposer.svelte` never exports a `generateFocusedSection` method from its module script. Optional chaining masks the break: `Cmd+G` silently does nothing.

Flagged by `kieran-typescript-reviewer`.

## Findings

- `src/app/App.svelte:59` — `composerRef?.generateFocusedSection?.()` is called on Cmd/Ctrl+G in essay mode.
- `src/app/components/composer/EssayComposer.svelte` — no `export function generateFocusedSection()` exists. The method is not on the bound instance.
- `composerRef` binding at `App.svelte` via `bind:this={composerRef}` captures the component instance, but Svelte 5 doesn't auto-expose arbitrary script-scope functions on it — they must be explicitly exported via a module block or an exported `const`.

## Proposed Solutions

**A. Implement `generateFocusedSection` on EssayComposer and export it (recommended)**
- Track "currently focused section" via a `$state` rune that updates when a SectionCard receives focus (blur/focus handlers).
- Export the method via Svelte 5 instance export syntax (`export function generateFocusedSection() { if (focusedSceneId) handleGenerate(focusedSceneId); }`).
- **Pros:** Delivers the advertised behavior. Small scope.
- **Cons:** Requires adding focus tracking to SectionCard → EssayComposer.
- **Effort:** Small. **Risk:** Low.

**B. Remove Cmd+G and the composerRef binding entirely for V1**
- Drop the essay-mode keyboard branch, the `composerRef` state, and the bind.
- V1 ships without a keyboard shortcut. Re-add in V2 once focus tracking lands.
- **Pros:** Minimal code, removes the latent bug.
- **Cons:** Documented feature disappears.
- **Effort:** Trivial. **Risk:** None.

**C. Make Cmd+G generate the first `idle-empty` or `idle-populated` section**
- Simpler than focus tracking: pick the "next needed" section automatically.
- **Pros:** No focus tracking needed.
- **Cons:** Behavior is less predictable (user might expect it to act on the section they're looking at).
- **Effort:** Small. **Risk:** Low.

## Recommended Action
(Filled during triage.)

## Technical Details

**Affected files:**
- `src/app/components/composer/EssayComposer.svelte` (add exported method + optional focus tracking)
- `src/app/App.svelte` (currently broken handler)
- `tests/ui/AppRouting.test.ts` (add assertion that Cmd+G reaches the composer)

## Acceptance Criteria

- [ ] Cmd+G (or Ctrl+G) in essay mode triggers Generate on a predictable section
- [ ] Option B path: the handler, binding, and composerRef state are all removed cleanly
- [ ] Test asserts the keyboard path is reachable

## Work Log

(To be filled during implementation.)

## Resources

- PR: https://github.com/sethkravitz/word-compiler/pull/7
- Reviewer: `kieran-typescript-reviewer`
- Related files: `src/app/App.svelte:59`, `src/app/components/composer/EssayComposer.svelte`
