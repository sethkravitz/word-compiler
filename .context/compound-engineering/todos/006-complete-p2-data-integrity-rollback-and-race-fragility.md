---
status: complete
priority: p2
issue_id: 006
tags: [code-review, data-integrity, server, cascade, rollback]
dependencies: []
---

# Data-integrity fragility: reorder validation outside transaction, project rollback cascades significant_edits

## Problem Statement

Three related data-integrity findings from `data-integrity-guardian`. None of them are P1 in practice — the cascade ordering, transaction scoping, and rollback logic are all **correct as shipped**. The concerns are fragility and hidden coupling that future changes could break.

**Verdict from data-integrity reviewer: cascade SAFE, rollback CORRECT with caveats.**

## Findings

### 6.1 — Reorder validation SELECT is outside the transaction

`server/db/repositories/scene-plans.ts:109-137` — the permutation validation runs a `SELECT id` outside the `db.transaction(...)` wrapper that subsequently applies the UPDATE loop. A concurrent DELETE between the SELECT and the UPDATEs would pass validation but UPDATE a now-stale id (no-op, silent).

Under the current single-connection Express setup this is practically safe (better-sqlite3 serializes per-connection). The concern is intent: the atomicity boundary should include validation.

**Fix:** move the validation SELECT inside `db.transaction(() => { ... })`.

### 6.2 — createEssayProject rollback cascades significant_edits via deleteProject

`src/app/store/api-actions.ts:147` — rollback calls `apiDeleteProject(project.id)` on failure. `server/db/repositories/projects.ts:84` unconditionally runs `DELETE FROM significant_edits WHERE project_id = ?` as part of project cascade.

For a brand-new project this is fine (no significant_edits exist yet). But the "CIPHER history survives" contract is enforced only by timing — if this atomic helper is ever reused on an existing project id, OR the flow grows a step that produces significant_edits before the failure point, rollback silently erases voice history.

**Fix:** add a comment at `server/db/repositories/projects.ts:84` documenting that project-level delete intentionally scopes broader than scene-level delete, and mirror the comment at the `createEssayProject` rollback site so future maintainers see both sides.

### 6.3 — reorderScenePlans command rollback assumes store wasn't mutated mid-flight

`src/app/store/commands.ts:117-128` — `priorOrder` is captured synchronously, store is optimistically updated, then API is awaited. If another command mutates `store.scenes` (add/remove scene) during the await, the rollback `store.reorderScenePlans(priorOrder)` will silently no-op because `project.svelte.ts:375` has a defensive length-check guard.

Low probability in single-user UX but the silent no-op is the failure mode.

**Fix:** log when the defensive length check trips so a silent rollback failure is at least observable.

## Proposed Solutions

**A. Ship the three fixes as a single "data integrity hardening" commit (recommended)**
- 6.1: move SELECT inside transaction. ~5 lines.
- 6.2: add comments at both call sites. ~4 lines.
- 6.3: add `console.warn` in `project.svelte.ts:375` when length check trips. ~2 lines.
- **Pros:** All three are cheap. Total diff is tiny. Future maintainers get clear signals.
- **Cons:** None.
- **Effort:** Trivial. **Risk:** None.

**B. Skip 6.3 (silent rollback is acceptable for single-user)**
- 6.3 is the least actionable — single-user scenario makes concurrent mutation very rare.
- **Pros:** Smaller diff.
- **Cons:** The silent failure mode is exactly what we want to NOT ship.

## Recommended Action
Ship all three under option A.

## Technical Details

**Affected files:**
- `server/db/repositories/scene-plans.ts` (6.1)
- `server/db/repositories/projects.ts` (6.2)
- `src/app/store/api-actions.ts` (6.2 comment)
- `src/app/store/project.svelte.ts` (6.3)

## Acceptance Criteria

- [ ] Reorder validation runs inside the transaction
- [ ] Project delete cascade has a comment explaining it intentionally includes significant_edits (project-lifetime scope)
- [ ] createEssayProject rollback call site notes the coupling
- [ ] project.svelte.ts length-check failure is logged via `console.warn`
- [ ] Existing reorder/delete tests still pass

## Work Log

(To be filled during implementation.)

## Resources

- PR: https://github.com/sethkravitz/word-compiler/pull/7
- Reviewer: `data-integrity-guardian`
- Memory: `feedback_word_compiler_svelte5_gotchas.md` #11 (significant_edits preservation rationale)
