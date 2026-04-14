---
status: complete
priority: p1
issue_id: 001
tags: [code-review, correctness, composer, svelte5, state-machine]
dependencies: []
---

# Regenerate-while-queued skips revert-slot cleanup and 60s timer

## Problem Statement

When a user clicks **Regenerate** on section B while section A is already `streaming`, the composer captures `priorText` into a revert slot and pushes section B onto the queue. When the queue drains and section B finally runs, the cleanup path (`removeChunk(sceneId, 0)` of the prior chunk + scheduling the 60s revert timer) **never executes**. The old chunk stays alongside the new chunk, and the revert slot lives forever until unmount or an edit event fires.

Flagged by `kieran-typescript-reviewer`. No test exercises this path — `EssayComposer.test.ts` only covers queued **Cancel**, not queued **Regenerate**.

## Findings

- `src/app/components/composer/EssayComposer.svelte:270-281` — `handleRegenerate` captures `priorText`, creates the slot, pushes onto queue, and returns.
- The in-flight generation's `finally` block at `EssayComposer.svelte:168-175` drains the queue by calling `runGeneration(nextId)` directly. `dispatchPath` is never called for queued regenerates.
- Consequence:
  - `removeChunk(sceneId, 0)` doesn't run → old + new chunks both persisted
  - 60s revert timer never scheduled → slot leaks until next edit or unmount
- The inline comment at `:275-280` acknowledges the gap but hand-waves it.

## Proposed Solutions

**A. Per-scene post-generation callback Map (recommended by reviewer)**
- Add `postGenHooks: Map<sceneId, () => void>` state
- `handleRegenerate` registers its cleanup via `postGenHooks.set(sceneId, () => { commands.removeChunk(...); startRevertTimer(...); })`
- `runGeneration` finally block runs the hook after the state transition, then deletes the entry
- **Pros:** Decouples regenerate cleanup from dispatch ordering. Works for the queued and immediate paths identically.
- **Cons:** Adds one more piece of composer state.
- **Effort:** Small. **Risk:** Low.

**B. Inline the cleanup at the moment the queue pops**
- When draining the queue in `runGeneration`'s finally block, check `revertSlots.get(nextId)` — if present and the section has prior text, wire the cleanup into the next `runGeneration` invocation.
- **Pros:** No new state.
- **Cons:** Couples the queue drain path to revert-slot semantics. Harder to reason about.
- **Effort:** Small. **Risk:** Medium.

**C. Synchronously call `removeChunk` + start the timer at Regenerate click time, before queueing**
- Move the cleanup side effects to `handleRegenerate` directly, so by the time the generation runs, the prior chunk is already gone.
- **Pros:** Simplest code.
- **Cons:** If the user cancels the queued regenerate, the prior chunk is already deleted — a Cancel of a queued Regenerate can't restore it. This defeats the revert guarantee.
- **Effort:** Trivial. **Risk:** High — changes the cancel semantics in a user-visible way.

## Recommended Action
(Filled during triage.)

## Technical Details

**Affected files:**
- `src/app/components/composer/EssayComposer.svelte` (handleRegenerate, runGeneration, new postGenHooks state)
- `tests/ui/composer/EssayComposer.test.ts` (add coverage for queued-regenerate cleanup)

**Test scenario to add:**
Section A is streaming. User clicks Regenerate on section B (which has prior text). Assert: when A finishes and B starts generating, B's prior chunk is removed exactly once and the 60s revert timer is scheduled for B with the captured priorText.

## Acceptance Criteria

- [ ] Queued Regenerate path removes the prior chunk on generation success
- [ ] 60s revert timer is started for queued Regenerates
- [ ] Revert button appears on section B after its queued generation completes
- [ ] Cancelling a queued Regenerate does NOT delete the prior chunk
- [ ] New EssayComposer test exercising this exact path passes

## Work Log

(To be filled during implementation.)

## Resources

- PR: https://github.com/sethkravitz/word-compiler/pull/7
- Reviewer: `kieran-typescript-reviewer`
- Related file: `src/app/components/composer/EssayComposer.svelte:270-281`
