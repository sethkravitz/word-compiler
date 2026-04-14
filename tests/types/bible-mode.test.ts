import { describe, expect, it } from "vitest";
import { type Bible, createEmptyBible } from "../../src/types/bible.js";

describe("Bible.mode field", () => {
  it("createEmptyBible returns mode === undefined when mode is omitted", () => {
    const bible = createEmptyBible("proj-1");
    expect(bible.mode).toBeUndefined();
  });

  it('createEmptyBible("proj-1", "essay") returns mode === "essay"', () => {
    const bible = createEmptyBible("proj-1", "essay");
    expect(bible.mode).toBe("essay");
  });

  it('createEmptyBible("proj-1", "fiction") returns mode === "fiction"', () => {
    const bible = createEmptyBible("proj-1", "fiction");
    expect(bible.mode).toBe("fiction");
  });

  it("JSON round-trip preserves mode when set to essay", () => {
    const bible = createEmptyBible("proj-1", "essay");
    const roundTripped = JSON.parse(JSON.stringify(bible)) as Bible;
    expect(roundTripped.mode).toBe("essay");
  });

  it("JSON round-trip preserves mode when set to fiction", () => {
    const bible = createEmptyBible("proj-1", "fiction");
    const roundTripped = JSON.parse(JSON.stringify(bible)) as Bible;
    expect(roundTripped.mode).toBe("fiction");
  });

  it("serialized JSON does NOT include a mode key when mode is undefined", () => {
    const bible = createEmptyBible("proj-1");
    const serialized = JSON.stringify(bible);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    expect("mode" in parsed).toBe(false);
  });

  it("loading a legacy JSON blob without a mode field yields mode === undefined", () => {
    // Simulate a legacy bible JSON blob that was persisted before the
    // mode field existed. It must deserialize without error and the
    // resulting object's mode must be undefined.
    const legacyBlob = JSON.stringify({
      projectId: "legacy-proj",
      version: 1,
      characters: [],
      styleGuide: {
        metaphoricRegister: null,
        vocabularyPreferences: [],
        sentenceArchitecture: null,
        paragraphPolicy: null,
        killList: [],
        negativeExemplars: [],
        positiveExemplars: [],
        structuralBans: [],
      },
      narrativeRules: {
        pov: {
          default: "close-third",
          distance: "close",
          interiority: "filtered",
          reliability: "reliable",
        },
        subtextPolicy: null,
        expositionPolicy: null,
        sceneEndingPolicy: null,
        setups: [],
      },
      locations: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      sourcePrompt: null,
    });

    const parsed = JSON.parse(legacyBlob) as Bible;
    expect(parsed.mode).toBeUndefined();
    expect(parsed.projectId).toBe("legacy-proj");
  });

  it("TypeScript rejects assigning an invalid string to bible.mode", () => {
    const bible = createEmptyBible("proj-1");
    // @ts-expect-error — "invalid-mode" is not assignable to "fiction" | "essay" | undefined
    bible.mode = "invalid-mode";
    // Runtime assignment still succeeds (TS-only guarantee); reset so the
    // object stays in a valid shape for any later use.
    bible.mode = undefined;
    expect(bible.mode).toBeUndefined();
  });
});
