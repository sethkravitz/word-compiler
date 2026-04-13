import { describe, expect, it } from "vitest";
import { reduce, type StateEvent } from "../../../src/app/components/composer/sectionStateMachine.js";
import type { SectionState } from "../../../src/app/components/composer/types.js";

// Pure reducer for the section state machine. No Svelte imports allowed.
//
// Source states (5):
//   - "idle-empty"
//   - "idle-populated"
//   - "queued"
//   - "streaming"
//   - { state: "failed"; reason: "error" | "aborted"; message }
//
// Events (7):
//   - GENERATE_REQUESTED   (with hasPending flag)
//   - GENERATE_DISPATCHED
//   - GENERATE_SUCCEEDED
//   - GENERATE_FAILED      (with reason + message)
//   - CANCELLED
//   - REVERTED
//   - CLEARED
//
// Invalid transitions are no-ops (return state unchanged) so race conditions
// can't crash the composer.

const FAILED_ERROR: SectionState = { state: "failed", reason: "error", message: "boom" };
const FAILED_ABORTED: SectionState = { state: "failed", reason: "aborted", message: "stopped" };

describe("sectionStateMachine reducer", () => {
  describe("GENERATE_REQUESTED", () => {
    it("idle-empty + no pending -> queued (composer will dispatch immediately)", () => {
      const next = reduce("idle-empty", { type: "GENERATE_REQUESTED", hasPending: false }, false);
      expect(next).toBe("queued");
    });

    it("idle-empty + pending -> queued", () => {
      const next = reduce("idle-empty", { type: "GENERATE_REQUESTED", hasPending: true }, false);
      expect(next).toBe("queued");
    });

    it("idle-populated + pending -> queued (regenerate while another is in flight)", () => {
      const next = reduce("idle-populated", { type: "GENERATE_REQUESTED", hasPending: true }, true);
      expect(next).toBe("queued");
    });

    it("idle-populated + no pending -> queued (composer will dispatch immediately)", () => {
      const next = reduce("idle-populated", { type: "GENERATE_REQUESTED", hasPending: false }, true);
      expect(next).toBe("queued");
    });

    it("failed + pending -> queued", () => {
      const next = reduce(FAILED_ERROR, { type: "GENERATE_REQUESTED", hasPending: true }, true);
      expect(next).toBe("queued");
    });

    it("failed + no pending -> queued", () => {
      const next = reduce(FAILED_ABORTED, { type: "GENERATE_REQUESTED", hasPending: false }, false);
      expect(next).toBe("queued");
    });

    it("queued -> queued (no change)", () => {
      const next = reduce("queued", { type: "GENERATE_REQUESTED", hasPending: true }, false);
      expect(next).toBe("queued");
    });

    it("streaming -> streaming (no-op)", () => {
      const next = reduce("streaming", { type: "GENERATE_REQUESTED", hasPending: true }, false);
      expect(next).toBe("streaming");
    });
  });

  describe("GENERATE_DISPATCHED", () => {
    it("queued -> streaming", () => {
      const next = reduce("queued", { type: "GENERATE_DISPATCHED" }, false);
      expect(next).toBe("streaming");
    });

    it("idle-empty -> streaming (direct dispatch path)", () => {
      const next = reduce("idle-empty", { type: "GENERATE_DISPATCHED" }, false);
      expect(next).toBe("streaming");
    });

    it("idle-populated -> streaming (regenerate direct dispatch)", () => {
      const next = reduce("idle-populated", { type: "GENERATE_DISPATCHED" }, true);
      expect(next).toBe("streaming");
    });

    it("failed -> streaming", () => {
      const next = reduce(FAILED_ERROR, { type: "GENERATE_DISPATCHED" }, true);
      expect(next).toBe("streaming");
    });

    it("streaming -> streaming (no-op)", () => {
      const next = reduce("streaming", { type: "GENERATE_DISPATCHED" }, false);
      expect(next).toBe("streaming");
    });
  });

  describe("GENERATE_SUCCEEDED", () => {
    it("streaming -> idle-populated", () => {
      const next = reduce("streaming", { type: "GENERATE_SUCCEEDED" }, false);
      expect(next).toBe("idle-populated");
    });

    it("idle-empty -> idle-empty (no-op, invalid)", () => {
      const next = reduce("idle-empty", { type: "GENERATE_SUCCEEDED" }, false);
      expect(next).toBe("idle-empty");
    });

    it("queued -> queued (no-op, invalid)", () => {
      const next = reduce("queued", { type: "GENERATE_SUCCEEDED" }, false);
      expect(next).toBe("queued");
    });

    it("idle-populated -> idle-populated (no-op)", () => {
      const next = reduce("idle-populated", { type: "GENERATE_SUCCEEDED" }, true);
      expect(next).toBe("idle-populated");
    });
  });

  describe("GENERATE_FAILED", () => {
    it("streaming + reason=error -> failed/error", () => {
      const next = reduce("streaming", { type: "GENERATE_FAILED", reason: "error", message: "Network down" }, false);
      expect(next).toEqual({ state: "failed", reason: "error", message: "Network down" });
    });

    it("streaming + reason=aborted -> failed/aborted", () => {
      const next = reduce(
        "streaming",
        { type: "GENERATE_FAILED", reason: "aborted", message: "User cancelled" },
        false,
      );
      expect(next).toEqual({ state: "failed", reason: "aborted", message: "User cancelled" });
    });

    it("queued -> failed (failure can hit before dispatch in race)", () => {
      const next = reduce("queued", { type: "GENERATE_FAILED", reason: "error", message: "Oops" }, false);
      expect(next).toEqual({ state: "failed", reason: "error", message: "Oops" });
    });

    it("idle-empty -> idle-empty (no-op, invalid)", () => {
      const next = reduce("idle-empty", { type: "GENERATE_FAILED", reason: "error", message: "ignored" }, false);
      expect(next).toBe("idle-empty");
    });

    it("idle-populated -> idle-populated (no-op, invalid)", () => {
      const next = reduce("idle-populated", { type: "GENERATE_FAILED", reason: "error", message: "ignored" }, true);
      expect(next).toBe("idle-populated");
    });
  });

  describe("CANCELLED", () => {
    it("queued + no prior chunks -> idle-empty", () => {
      const next = reduce("queued", { type: "CANCELLED" }, false);
      expect(next).toBe("idle-empty");
    });

    it("queued + prior chunks -> idle-populated", () => {
      const next = reduce("queued", { type: "CANCELLED" }, true);
      expect(next).toBe("idle-populated");
    });

    it("streaming + no prior chunks -> idle-empty", () => {
      const next = reduce("streaming", { type: "CANCELLED" }, false);
      expect(next).toBe("idle-empty");
    });

    it("streaming + prior chunks -> idle-populated", () => {
      const next = reduce("streaming", { type: "CANCELLED" }, true);
      expect(next).toBe("idle-populated");
    });

    it("idle-empty -> idle-empty (no-op)", () => {
      const next = reduce("idle-empty", { type: "CANCELLED" }, false);
      expect(next).toBe("idle-empty");
    });

    it("idle-populated -> idle-populated (no-op)", () => {
      const next = reduce("idle-populated", { type: "CANCELLED" }, true);
      expect(next).toBe("idle-populated");
    });

    it("failed -> failed (no-op)", () => {
      const next = reduce(FAILED_ERROR, { type: "CANCELLED" }, true);
      expect(next).toBe(FAILED_ERROR);
    });
  });

  describe("REVERTED", () => {
    it("idle-populated -> idle-populated (state unchanged; revert slot lives in composer)", () => {
      const next = reduce("idle-populated", { type: "REVERTED" }, true);
      expect(next).toBe("idle-populated");
    });

    it("idle-empty -> idle-empty (no-op)", () => {
      const next = reduce("idle-empty", { type: "REVERTED" }, false);
      expect(next).toBe("idle-empty");
    });

    it("streaming -> streaming (no-op)", () => {
      const next = reduce("streaming", { type: "REVERTED" }, false);
      expect(next).toBe("streaming");
    });
  });

  describe("CLEARED", () => {
    it("idle-populated -> idle-empty", () => {
      const next = reduce("idle-populated", { type: "CLEARED" }, true);
      expect(next).toBe("idle-empty");
    });

    it("failed -> idle-empty", () => {
      const next = reduce(FAILED_ERROR, { type: "CLEARED" }, true);
      expect(next).toBe("idle-empty");
    });

    it("queued -> idle-empty", () => {
      const next = reduce("queued", { type: "CLEARED" }, false);
      expect(next).toBe("idle-empty");
    });

    it("streaming -> idle-empty", () => {
      const next = reduce("streaming", { type: "CLEARED" }, false);
      expect(next).toBe("idle-empty");
    });

    it("idle-empty -> idle-empty (no-op)", () => {
      const next = reduce("idle-empty", { type: "CLEARED" }, false);
      expect(next).toBe("idle-empty");
    });
  });

  describe("purity", () => {
    it("does not mutate the input state object for failed states", () => {
      const original: SectionState = { state: "failed", reason: "error", message: "x" };
      const snapshot = { ...original };
      reduce(original, { type: "GENERATE_DISPATCHED" }, true);
      expect(original).toEqual(snapshot);
    });

    it("returns the same reference for no-op transitions", () => {
      const original: SectionState = { state: "failed", reason: "error", message: "x" };
      const next = reduce(original, { type: "REVERTED" }, true);
      expect(next).toBe(original);
    });
  });

  describe("event type discrimination", () => {
    it("handles unknown event type as no-op (defensive)", () => {
      // @ts-expect-error — testing runtime defense against bad inputs
      const next = reduce("idle-populated", { type: "UNKNOWN_EVENT" } as StateEvent, true);
      expect(next).toBe("idle-populated");
    });
  });
});
