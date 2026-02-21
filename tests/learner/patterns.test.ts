import { describe, expect, it } from "vitest";
import type { EditPattern } from "../../src/learner/diff.js";
import {
  accumulatePatterns,
  computeWeightedCount,
  groupPatterns,
  mapToProposedAction,
  meetsPromotionThreshold,
  normalizePatternKey,
  type PatternGroup,
  wilsonLowerBound,
} from "../../src/learner/patterns.js";

function makeEdit(overrides: Partial<EditPattern> = {}): EditPattern {
  return {
    id: "e1",
    chunkId: "c1",
    sceneId: "s1",
    projectId: "p1",
    editType: "DELETION",
    subType: "CUT_FILLER",
    originalText: "um well",
    editedText: "",
    context: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── wilsonLowerBound ───────────────────────────

describe("wilsonLowerBound", () => {
  it("returns 0 for zero total", () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it("returns 0 for zero successes", () => {
    expect(wilsonLowerBound(0, 10)).toBe(0);
  });

  it("returns value between 0 and 1 for normal inputs", () => {
    const result = wilsonLowerBound(7, 10);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it("increases with more successes at same total", () => {
    const low = wilsonLowerBound(3, 10);
    const high = wilsonLowerBound(8, 10);
    expect(high).toBeGreaterThan(low);
  });

  it("converges toward ratio for large samples", () => {
    const result = wilsonLowerBound(800, 1000);
    // With 80% success rate and n=1000, Wilson lower should be close to 0.8
    expect(result).toBeGreaterThan(0.75);
    expect(result).toBeLessThan(0.82);
  });

  it("is conservative for small samples", () => {
    // 2/2 = 100%, but Wilson should be well below 1
    const result = wilsonLowerBound(2, 2);
    expect(result).toBeLessThan(0.8);
  });
});

// ─── computeWeightedCount ───────────────────────

describe("computeWeightedCount", () => {
  it("returns 0 for empty edits", () => {
    expect(computeWeightedCount([], new Map())).toBe(0);
  });

  it("counts recent edits at full weight", () => {
    const edits = [makeEdit({ sceneId: "s1" }), makeEdit({ sceneId: "s2" }), makeEdit({ sceneId: "s3" })];
    const sceneOrder = new Map([
      ["s1", 0],
      ["s2", 1],
      ["s3", 2],
    ]);
    // All within 30-scene window of max (2)
    expect(computeWeightedCount(edits, sceneOrder)).toBe(3);
  });

  it("applies 50% decay to old edits", () => {
    const edits = [makeEdit({ sceneId: "s-old" }), makeEdit({ sceneId: "s-new" })];
    // s-old is at order 0, s-new at order 35 → age of s-old = 35 > 30
    const sceneOrder = new Map([
      ["s-old", 0],
      ["s-new", 35],
    ]);
    expect(computeWeightedCount(edits, sceneOrder)).toBe(1.5); // 0.5 + 1.0
  });

  it("respects custom decay window", () => {
    const edits = [makeEdit({ sceneId: "s1" }), makeEdit({ sceneId: "s2" })];
    const sceneOrder = new Map([
      ["s1", 0],
      ["s2", 5],
    ]);
    // With window of 3, s1 is at age 5 > 3 → decayed
    expect(computeWeightedCount(edits, sceneOrder, 3)).toBe(1.5);
  });
});

// ─── normalizePatternKey ────────────────────────

describe("normalizePatternKey", () => {
  it("uses lowercase originalText for DELETION", () => {
    const edit = makeEdit({ editType: "DELETION", originalText: "Um Well" });
    expect(normalizePatternKey(edit)).toBe("um well");
  });

  it("uses lowercase originalText for SUBSTITUTION", () => {
    const edit = makeEdit({ editType: "SUBSTITUTION", originalText: "She Felt Sad" });
    expect(normalizePatternKey(edit)).toBe("she felt sad");
  });

  it("uses first 3 words of editedText for ADDITION", () => {
    const edit = makeEdit({
      editType: "ADDITION",
      editedText: "The bitter aroma of fresh coffee filled the room",
    });
    expect(normalizePatternKey(edit)).toBe("the bitter aroma");
  });

  it("returns 'reorder' for RESTRUCTURE", () => {
    const edit = makeEdit({ editType: "RESTRUCTURE" });
    expect(normalizePatternKey(edit)).toBe("reorder");
  });
});

// ─── groupPatterns ──────────────────────────────

describe("groupPatterns", () => {
  it("groups edits by subType + normalizedKey", () => {
    const edits = [
      makeEdit({ id: "e1", subType: "CUT_FILLER", originalText: "um well" }),
      makeEdit({ id: "e2", subType: "CUT_FILLER", originalText: "Um Well" }),
      makeEdit({ id: "e3", subType: "CUT_FILLER", originalText: "you know" }),
    ];
    const sceneOrder = new Map([["s1", 0]]);
    const groups = groupPatterns(edits, sceneOrder);
    // "um well" group has 2, "you know" has 1
    expect(groups).toHaveLength(2);
    const umGroup = groups.find((g) => g.key === "um well");
    expect(umGroup!.edits).toHaveLength(2);
  });

  it("computes confidence using Wilson interval", () => {
    const edits = Array.from({ length: 8 }, (_, i) =>
      makeEdit({ id: `e${i}`, sceneId: "s1", subType: "CUT_FILLER", originalText: "well" }),
    );
    const sceneOrder = new Map([["s1", 0]]);
    const groups = groupPatterns(edits, sceneOrder);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.confidence).toBeGreaterThan(0);
    expect(groups[0]!.confidence).toBeLessThan(1);
  });

  it("sorts by confidence descending", () => {
    const edits = [
      ...Array.from({ length: 8 }, (_, i) =>
        makeEdit({ id: `a${i}`, sceneId: "s1", subType: "CUT_FILLER", originalText: "well" }),
      ),
      makeEdit({ id: "b1", sceneId: "s1", subType: "CUT_FILLER", originalText: "rare" }),
    ];
    const sceneOrder = new Map([["s1", 0]]);
    const groups = groupPatterns(edits, sceneOrder);
    expect(groups[0]!.key).toBe("well");
  });
});

// ─── meetsPromotionThreshold ────────────────────

describe("meetsPromotionThreshold", () => {
  it("rejects groups with fewer than 5 occurrences", () => {
    const group: PatternGroup = {
      patternType: "CUT_FILLER",
      key: "well",
      edits: [],
      weightedCount: 4,
      confidence: 0.8,
    };
    expect(meetsPromotionThreshold(group)).toBe(false);
  });

  it("rejects groups with confidence below 0.60", () => {
    const group: PatternGroup = {
      patternType: "CUT_FILLER",
      key: "well",
      edits: [],
      weightedCount: 10,
      confidence: 0.55,
    };
    expect(meetsPromotionThreshold(group)).toBe(false);
  });

  it("accepts groups meeting both thresholds", () => {
    const group: PatternGroup = {
      patternType: "CUT_FILLER",
      key: "well",
      edits: [],
      weightedCount: 7,
      confidence: 0.65,
    };
    expect(meetsPromotionThreshold(group)).toBe(true);
  });
});

// ─── mapToProposedAction ────────────────────────

describe("mapToProposedAction", () => {
  it("maps CUT_FILLER to killList", () => {
    const group: PatternGroup = {
      patternType: "CUT_FILLER",
      key: "a sense of",
      edits: [],
      weightedCount: 5,
      confidence: 0.7,
    };
    const action = mapToProposedAction(group);
    expect(action).toEqual({ target: "killList", value: "a sense of" });
  });

  it("maps DIALOGUE_VOICE to characters.voiceNotes", () => {
    const group: PatternGroup = {
      patternType: "DIALOGUE_VOICE",
      key: "said softly",
      edits: [],
      weightedCount: 6,
      confidence: 0.7,
    };
    const action = mapToProposedAction(group);
    expect(action!.target).toBe("characters.voiceNotes");
  });

  it("maps SHOW_DONT_TELL to suggestedTone.exemplars", () => {
    const group: PatternGroup = {
      patternType: "SHOW_DONT_TELL",
      key: "felt a sense of dread",
      edits: [],
      weightedCount: 5,
      confidence: 0.65,
    };
    const action = mapToProposedAction(group);
    expect(action!.target).toBe("suggestedTone.exemplars");
  });

  it("maps SENSORY_ADDED to locations.sensoryPalette", () => {
    const group: PatternGroup = {
      patternType: "SENSORY_ADDED",
      key: "the bitter aroma",
      edits: [],
      weightedCount: 5,
      confidence: 0.65,
    };
    const action = mapToProposedAction(group);
    expect(action!.target).toBe("locations.sensoryPalette");
  });

  it("maps BEAT_ADDED to characters.emotionPhysicality", () => {
    const group: PatternGroup = {
      patternType: "BEAT_ADDED",
      key: "she shrugged and",
      edits: [],
      weightedCount: 5,
      confidence: 0.65,
    };
    const action = mapToProposedAction(group);
    expect(action!.target).toBe("characters.emotionPhysicality");
  });

  it("maps TONE_SHIFT to suggestedTone.metaphoricDomains", () => {
    const group: PatternGroup = {
      patternType: "TONE_SHIFT",
      key: "the building was old",
      edits: [],
      weightedCount: 5,
      confidence: 0.65,
    };
    const action = mapToProposedAction(group);
    expect(action!.target).toBe("suggestedTone.metaphoricDomains");
  });

  it("maps REORDER to compilationNotes", () => {
    const group: PatternGroup = {
      patternType: "REORDER",
      key: "reorder",
      edits: [],
      weightedCount: 5,
      confidence: 0.65,
    };
    const action = mapToProposedAction(group);
    expect(action!.target).toBe("compilationNotes");
  });
});

// ─── accumulatePatterns ─────────────────────────

describe("accumulatePatterns", () => {
  it("returns empty for no edits", () => {
    const result = accumulatePatterns([], new Map());
    expect(result).toEqual([]);
  });

  it("filters out groups below promotion threshold", () => {
    // Only 2 edits — won't meet the 5-occurrence threshold
    const edits = [
      makeEdit({ id: "e1", subType: "CUT_FILLER", originalText: "well" }),
      makeEdit({ id: "e2", subType: "CUT_FILLER", originalText: "well" }),
    ];
    const sceneOrder = new Map([["s1", 0]]);
    const result = accumulatePatterns(edits, sceneOrder);
    expect(result).toEqual([]);
  });

  it("promotes groups that meet threshold", () => {
    const edits = Array.from({ length: 8 }, (_, i) =>
      makeEdit({ id: `e${i}`, sceneId: "s1", subType: "CUT_FILLER", originalText: "well" }),
    );
    const sceneOrder = new Map([["s1", 0]]);
    // 8/8 within CUT_FILLER subType → Wilson well above 0.60
    const result = accumulatePatterns(edits, sceneOrder);
    expect(result).toHaveLength(1);
    expect(result[0]!.key).toBe("well");
    expect(result[0]!.weightedCount).toBe(8);
  });

  it("handles mixed groups with some promoted and some not", () => {
    const edits = [
      // 10 "well" edits — should promote (10/11 ratio → Wilson ≈ 0.62 > 0.60)
      ...Array.from({ length: 10 }, (_, i) =>
        makeEdit({ id: `a${i}`, sceneId: "s1", subType: "CUT_FILLER", originalText: "well" }),
      ),
      // 1 "um" edit — should not promote (below 5 occurrences)
      makeEdit({ id: "b1", sceneId: "s1", subType: "CUT_FILLER", originalText: "um" }),
    ];
    const sceneOrder = new Map([["s1", 0]]);
    const result = accumulatePatterns(edits, sceneOrder);
    expect(result).toHaveLength(1);
    expect(result[0]!.key).toBe("well");
  });
});
