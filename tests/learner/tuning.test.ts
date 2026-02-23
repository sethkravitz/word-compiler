import { describe, expect, it } from "vitest";
import { computeEditRatio, generateTuningProposals, levenshteinDistance } from "../../src/learner/tuning.js";
import type { Chunk, CompilationConfig } from "../../src/types/index.js";
import { createDefaultCompilationConfig } from "../../src/types/index.js";

function makeChunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
    id: `c-${Math.random()}`,
    sceneId: "s1",
    sequenceNumber: 0,
    generatedText: "The quick brown fox jumps over the lazy dog.",
    payloadHash: "",
    model: "test",
    temperature: 0.8,
    topP: 0.9,
    generatedAt: new Date().toISOString(),
    status: "accepted",
    editedText: null,
    humanNotes: null,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<CompilationConfig> = {}): CompilationConfig {
  return {
    ...createDefaultCompilationConfig(),
    ...overrides,
  };
}

// ─── levenshteinDistance ─────────────────────────

describe("levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("abc", "abc")).toBe(0);
  });

  it("returns string length for empty vs non-empty", () => {
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("abc", "")).toBe(3);
  });

  it("returns 0 for two empty strings", () => {
    expect(levenshteinDistance("", "")).toBe(0);
  });

  it("handles single character difference", () => {
    expect(levenshteinDistance("cat", "bat")).toBe(1);
  });

  it("handles insertion", () => {
    expect(levenshteinDistance("cat", "cats")).toBe(1);
  });

  it("handles deletion", () => {
    expect(levenshteinDistance("cats", "cat")).toBe(1);
  });

  it("handles completely different strings", () => {
    expect(levenshteinDistance("abc", "xyz")).toBe(3);
  });

  it("is symmetric", () => {
    const a = "kitten";
    const b = "sitting";
    expect(levenshteinDistance(a, b)).toBe(levenshteinDistance(b, a));
  });

  it("computes classic kitten/sitting distance", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
  });
});

// ─── computeEditRatio ───────────────────────────

describe("computeEditRatio", () => {
  it("returns 0 for unedited chunk", () => {
    expect(computeEditRatio(makeChunk())).toBe(0);
  });

  it("returns 0 when editedText equals generatedText", () => {
    expect(computeEditRatio(makeChunk({ editedText: "The quick brown fox jumps over the lazy dog." }))).toBe(0);
  });

  it("returns positive value for edited chunk", () => {
    const ratio = computeEditRatio(makeChunk({ editedText: "A fast brown fox leaps over the sleepy dog." }));
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(1);
  });

  it("returns high ratio for completely rewritten chunk", () => {
    const ratio = computeEditRatio(
      makeChunk({
        generatedText: "Hello world how are you doing today",
        editedText: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      }),
    );
    expect(ratio).toBeGreaterThan(0.5);
  });
});

// ─── generateTuningProposals ────────────────────

describe("generateTuningProposals", () => {
  it("returns empty when fewer than 10 edited chunks", () => {
    const chunks = Array.from({ length: 5 }, (_, i) =>
      makeChunk({ id: `c${i}`, sceneId: `s${i % 3}`, editedText: "edited" }),
    );
    expect(generateTuningProposals(chunks, makeConfig(), "p1")).toEqual([]);
  });

  it("returns empty when fewer than 3 scenes", () => {
    const chunks = Array.from({ length: 12 }, (_, i) =>
      makeChunk({ id: `c${i}`, sceneId: `s${i % 2}`, editedText: "edited" }),
    );
    expect(generateTuningProposals(chunks, makeConfig(), "p1")).toEqual([]);
  });

  it("returns empty when no edits at all", () => {
    const chunks = Array.from({ length: 20 }, (_, i) => makeChunk({ id: `c${i}`, sceneId: `s${i % 5}` }));
    expect(generateTuningProposals(chunks, makeConfig(), "p1")).toEqual([]);
  });

  it("suggests lower temperature for high edit ratio", () => {
    // Create chunks with very different generated vs edited text (high edit ratio)
    const chunks = Array.from({ length: 12 }, (_, i) =>
      makeChunk({
        id: `c${i}`,
        sceneId: `s${i % 4}`,
        generatedText:
          "This is the original generated text that was produced by the model and is quite different from what was wanted.",
        editedText:
          "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      }),
    );
    const proposals = generateTuningProposals(chunks, makeConfig({ defaultTemperature: 0.8 }), "p1");
    const tempProposal = proposals.find((p) => p.parameter === "defaultTemperature");
    expect(tempProposal).toBeTruthy();
    expect(tempProposal!.suggestedValue).toBeLessThan(0.8);
    expect(tempProposal!.status).toBe("pending");
  });

  it("does not suggest temperature change for low edit ratio", () => {
    // Create chunks with very similar generated vs edited text
    const chunks = Array.from({ length: 12 }, (_, i) =>
      makeChunk({
        id: `c${i}`,
        sceneId: `s${i % 4}`,
        generatedText: "The brown fox jumped quickly.",
        editedText: "The brown fox jumped quickly!", // Just punctuation change
      }),
    );
    const proposals = generateTuningProposals(chunks, makeConfig(), "p1");
    const tempProposal = proposals.find((p) => p.parameter === "defaultTemperature");
    expect(tempProposal).toBeUndefined();
  });

  it("includes evidence in proposals", () => {
    const chunks = Array.from({ length: 12 }, (_, i) =>
      makeChunk({
        id: `c${i}`,
        sceneId: `s${i % 4}`,
        generatedText: "Original text that will be very different from the edited version.",
        editedText: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      }),
    );
    const proposals = generateTuningProposals(chunks, makeConfig(), "p1");
    expect(proposals.length).toBeGreaterThan(0);
    const first = proposals[0]!;
    expect(first.evidence.editedChunkCount).toBe(12);
    expect(first.evidence.sceneCount).toBe(4);
    expect(first.evidence.avgEditRatio).toBeGreaterThan(0);
  });

  it("suggested temperature never goes below 0.3", () => {
    const chunks = Array.from({ length: 12 }, (_, i) =>
      makeChunk({
        id: `c${i}`,
        sceneId: `s${i % 4}`,
        generatedText: "AAAA",
        editedText: "ZZZZ",
      }),
    );
    const proposals = generateTuningProposals(chunks, makeConfig({ defaultTemperature: 0.4 }), "p1");
    const tempProposal = proposals.find((p) => p.parameter === "defaultTemperature");
    if (tempProposal) {
      expect(tempProposal.suggestedValue).toBeGreaterThanOrEqual(0.3);
    }
  });
});
