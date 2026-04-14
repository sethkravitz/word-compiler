---
status: pending
priority: p3
issue_id: 008
tags: [code-review, agent-native, api, ergonomics]
dependencies: []
---

# Agent-native parity: HIGH. Convenience gaps worth closing in V2.

## Problem Statement

`agent-native-reviewer` verified that **every persistent user action in the essay composer is reachable via HTTP routes or pure functions**. No capability gaps. Verdict: **HIGH parity**.

Three ergonomic gaps worth addressing in a follow-up (not this PR):

## Findings

### 8.1 — No server-side `POST /projects/essay-bootstrap` atomic wrapper
Agents must choreograph 4+ calls (project → bible → chapter → scenes×N) and handle rollback themselves. `createEssayProject` in `src/app/store/api-actions.ts:115` encodes this, but is store-coupled and unreachable from HTTP. Adding a server-side endpoint would let agents create essay projects in one call.

### 8.2 — No single "generate section" endpoint
Agents must compile payload client-side, stream, then persist — replicating `generateChunk` logic from `src/app/store/generation.svelte.ts`. The pieces are all primitives (good), but a cookbook/example script would reduce risk of divergence from UI behavior (setActiveScene/tick preamble, post-persist audit, CIPHER trigger thresholds).

### 8.3 — `runAudit` is a pure function with no HTTP endpoint
Lives in `src/auditor/index.ts` — agents working over HTTP only must import the module or reimplement. Consider exposing `POST /scenes/:sceneId/audit` that runs audit + saves flags in one call.

## Proposed Solutions

**A. Ship an "agent ergonomics" follow-up PR (recommended for V2)**
- Server-side endpoints for bootstrap, generate, and audit
- Example Python/TS scripts in a new `examples/agents/` directory
- **Pros:** Turns "HIGH parity" into "FULL parity". Lowers the bar for agent integration.
- **Cons:** Out of scope for this PR.
- **Effort:** Medium. **Risk:** Low.

**B. Document the existing primitives in a cookbook (minimum viable)**
- New file: `docs/agent-cookbook.md` showing how to create an essay project, trigger generation, and re-audit using the existing API surface.
- No code changes to the repo itself.
- **Pros:** Zero implementation risk. Unblocks agent integration today.
- **Cons:** Duplicates what `src/app/store/api-actions.ts` already does.

**C. Defer entirely**
- V1 ships with HIGH parity. Agent work isn't blocked.
- Revisit when someone actually tries to automate essay creation.

## Recommended Action
Option B as a cheap follow-up. Option A tracked for V2.

## Technical Details

**Option A affected files (if pursued):**
- `server/api/routes.ts` (new endpoints)
- `server/api/bootstrap.ts` (new: server-side atomic helper)
- `examples/agents/create-essay.ts` (new cookbook)

**Option B affected files:**
- `docs/agent-cookbook.md` (new)

## Acceptance Criteria

- [ ] V1: agent cookbook exists showing the current HTTP + pure-function path for essay creation
- [ ] V2 (deferred): server-side bootstrap endpoint with atomic rollback
- [ ] V2 (deferred): server-side audit endpoint

## Work Log

(To be filled during implementation.)

## Resources

- PR: https://github.com/sethkravitz/word-compiler/pull/7
- Reviewer: `agent-native-reviewer`
