import { describe, expect, it } from "vitest";
import { computeDriftRatio } from "../../server/profile/stage2.js";

describe("computeDriftRatio", () => {
  it("returns 0 when no chunks drifted", () => {
    expect(computeDriftRatio([{ contentDriftWarning: false }, { contentDriftWarning: false }])).toBe(0);
  });
  it("returns correct ratio", () => {
    expect(
      computeDriftRatio([
        { contentDriftWarning: true },
        { contentDriftWarning: false },
        { contentDriftWarning: false },
        { contentDriftWarning: true },
      ]),
    ).toBe(0.5);
  });
  it("returns 0 for empty array", () => {
    expect(computeDriftRatio([])).toBe(0);
  });
});
