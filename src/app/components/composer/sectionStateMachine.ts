// Pure reducer for one section's lifecycle in the essay composer.
//
// Extracted from EssayComposer.svelte so the transition matrix can be unit
// tested in isolation without Svelte runes, render cycles, or fake stores.
// ZERO Svelte imports — the only thing this module imports is the SectionState
// type from ./types.ts.
//
// Design rules:
//   1. Pure: (state, event) => newState. No I/O, no side effects.
//   2. Invalid transitions are no-ops (return the same reference). This makes
//      the composer resilient to race conditions where, e.g., a stream success
//      arrives after a CANCELLED has already fired.
//   3. The reducer does NOT manage the queue, revert slots, or voice nudge —
//      those live in the composer because they cross sections. The reducer
//      only tracks what state ONE section is in.
//   4. The composer must pass `hasPriorChunks` so CANCELLED can disambiguate
//      between idle-empty (nothing was ever generated) and idle-populated
//      (revert had captured a prior text but generation was cancelled).
//
// See tests/ui/composer/sectionStateMachine.test.ts for the full transition
// matrix.

import type { SectionState, StateEvent } from "./types.js";

export type { StateEvent } from "./types.js";

// Per-event handlers — pulled out so the top-level `reduce` stays under the
// cyclomatic complexity ceiling Biome enforces (max 15).

function onGenerateRequested(state: SectionState): SectionState {
  // Streaming sections never re-queue themselves — defensive no-op layer
  // beneath the control matrix.
  if (state === "streaming") return state;
  // Already queued — leave as-is. The composer's queue array is the ground
  // truth for ordering.
  if (state === "queued") return state;
  return "queued";
}

function onGenerateDispatched(state: SectionState): SectionState {
  if (state === "streaming") return state;
  return "streaming";
}

function onGenerateSucceeded(state: SectionState): SectionState {
  // Only valid out of streaming. Any other source state is a race we
  // silently ignore.
  if (state !== "streaming") return state;
  return "idle-populated";
}

function onGenerateFailed(state: SectionState, reason: "error" | "aborted", message: string): SectionState {
  // Valid from streaming (the normal path) or queued (failure can race a
  // dispatch — e.g. abort while still in queue). Idle and failed states are
  // not legal sources for a new failure.
  if (state !== "streaming" && state !== "queued") return state;
  return { state: "failed", reason, message };
}

function onCancelled(state: SectionState, hasPriorChunks: boolean): SectionState {
  // Cancellation is only meaningful when we're trying to generate.
  if (state !== "queued" && state !== "streaming") return state;
  return hasPriorChunks ? "idle-populated" : "idle-empty";
}

export function reduce(state: SectionState, event: StateEvent, hasPriorChunks: boolean): SectionState {
  switch (event.type) {
    case "GENERATE_REQUESTED":
      return onGenerateRequested(state);
    case "GENERATE_DISPATCHED":
      return onGenerateDispatched(state);
    case "GENERATE_SUCCEEDED":
      return onGenerateSucceeded(state);
    case "GENERATE_FAILED":
      return onGenerateFailed(state, event.reason, event.message);
    case "CANCELLED":
      return onCancelled(state, hasPriorChunks);
    case "REVERTED":
      // Revert slot is composer-owned; the reducer just acknowledges the
      // section is still populated. The derived `isRevertable` predicate
      // flips false because the composer cleared the slot.
      return state;
    case "CLEARED":
      // Hard reset. Used by deletion + cold-load recovery + section drop.
      return "idle-empty";
    default:
      // Unknown event type — defensive no-op so a stray dispatch can't crash
      // the reducer in production.
      return state;
  }
}
