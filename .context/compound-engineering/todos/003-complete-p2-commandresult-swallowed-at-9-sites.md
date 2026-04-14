---
status: complete
priority: p2
issue_id: 003
tags: [code-review, error-handling, composer, command-layer]
dependencies: []
---

# CommandResult.ok not checked at 9 call sites in EssayComposer

## Problem Statement

The `CommandResult<T>` type (`{ ok: true; value } | { ok: false; error; gateFailures? }`) exists specifically so failures cannot be silently swallowed. `EssayComposer.svelte` ignores the result at 9 call sites — only lines 250 and 424 check `.ok`. Silent failures leave the UI desynced from the server:

- Failed `reorderScenePlans` → new order shown locally, old order persisted
- Failed `removeScenePlan` → scene deleted from UI but still in DB
- Failed `saveBible` from the composer → changes lost without warning
- Failed `persistChunk` / `updateChunk` / `saveAuditFlags` → stale store, fresh DB

Flagged by `kieran-typescript-reviewer`.

## Findings

Unchecked sites per reviewer:
- `src/app/components/composer/EssayComposer.svelte:293` — `persistChunk`
- `src/app/components/composer/EssayComposer.svelte:300` — `updateChunk`
- `src/app/components/composer/EssayComposer.svelte:389` — `removeScenePlan`
- `src/app/components/composer/EssayComposer.svelte:403` — `reorderScenePlans`
- `src/app/components/composer/EssayComposer.svelte:413` — `updateScenePlan`
- `src/app/components/composer/EssayComposer.svelte:436` — `saveBible`
- `src/app/components/composer/EssayComposer.svelte:452` — `saveAuditFlags`
- Two more per the reviewer report

## Proposed Solutions

**A. Add `.ok` checks at every site with `store.setError` on failure (recommended)**
- Simple `if (!result.ok) store.setError(result.error); return;` after each await
- For optimistic mutations (reorder, edit), roll back the store state on failure
- **Pros:** Minimal code. Error banner surfaces the problem.
- **Cons:** ~40 lines of boilerplate.
- **Effort:** Small. **Risk:** Low.

**B. Wrap each command call in a helper that logs + surfaces on failure**
- `async function safeCommand<T>(fn: () => Promise<CommandResult<T>>, label: string): Promise<T | null>`
- Centralizes error handling.
- **Pros:** Less duplication.
- **Cons:** Adds a wrapper layer; harder to preserve error recovery per call site.
- **Effort:** Small. **Risk:** Low.

**C. Change CommandResult to throw on failure and keep a try/catch at the top level**
- Throws cannot be silently ignored.
- **Pros:** Enforced by the type system.
- **Cons:** Would require refactoring the entire command layer and every consumer (not just the composer). Out of scope for this fix.
- **Effort:** Large. **Risk:** High (touches fiction mode).

## Recommended Action
(Filled during triage.)

## Technical Details

**Affected files:**
- `src/app/components/composer/EssayComposer.svelte` (9 call sites)

**Suggested pattern per site:**
```ts
const result = await commands.persistChunk(sceneId, 0);
if (!result.ok) {
  store.setError(`Failed to save section: ${result.error}`);
  return;
}
```

For optimistic reorder specifically, the command itself already rolls back the store on failure (`src/app/store/commands.ts:117-128`), so the composer just needs to surface the error — no additional rollback logic.

## Acceptance Criteria

- [ ] All 9 call sites check `.ok` and surface failures via `store.setError`
- [ ] Optimistic mutations (reorder, edit) confirm their rollback paths work
- [ ] A test simulating `saveAuditFlags` failure asserts `store.error` is set
- [ ] No silent state divergence under failure

## Work Log

(To be filled during implementation.)

## Resources

- PR: https://github.com/sethkravitz/word-compiler/pull/7
- Reviewer: `kieran-typescript-reviewer`
- Related: `src/app/store/commands.ts` (CommandResult definition)
