import { describe, expect, it } from "vitest";
import { accumulateReaderState, detectEpistemicIssues, type SceneInput } from "../../src/simulator/readerState.js";
import type { NarrativeIR, ScenePlan } from "../../src/types/index.js";
import { createEmptyScenePlan } from "../../src/types/index.js";

function makePlan(id: string): ScenePlan {
  return { ...createEmptyScenePlan("proj-1"), id, title: `Scene ${id}` };
}

function makeIR(sceneId: string, overrides: Partial<NarrativeIR> = {}): NarrativeIR {
  return {
    sceneId,
    verified: true,
    events: [],
    factsIntroduced: [],
    factsRevealedToReader: [],
    factsWithheld: [],
    characterDeltas: [],
    setupsPlanted: [],
    payoffsExecuted: [],
    characterPositions: {},
    unresolvedTensions: [],
    ...overrides,
  };
}

function makeScene(id: string, order: number, ir: NarrativeIR | null): SceneInput {
  return { plan: makePlan(id), ir, sceneOrder: order };
}

describe("accumulateReaderState", () => {
  it("returns empty array for no scenes", () => {
    expect(accumulateReaderState([])).toEqual([]);
  });

  it("accumulates facts across scenes", () => {
    const scenes: SceneInput[] = [
      makeScene("s1", 0, makeIR("s1", { factsRevealedToReader: ["Alice is a spy"] })),
      makeScene("s2", 1, makeIR("s2", { factsRevealedToReader: ["Bob knows the code"] })),
    ];

    const states = accumulateReaderState(scenes);
    expect(states).toHaveLength(2);
    expect(states[0]!.state.knownFacts).toEqual(new Set(["Alice is a spy"]));
    expect(states[0]!.newFacts).toEqual(["Alice is a spy"]);
    expect(states[1]!.state.knownFacts).toEqual(new Set(["Alice is a spy", "Bob knows the code"]));
    expect(states[1]!.newFacts).toEqual(["Bob knows the code"]);
  });

  it("does not double-count repeated facts", () => {
    const scenes: SceneInput[] = [
      makeScene("s1", 0, makeIR("s1", { factsRevealedToReader: ["Alice is a spy"] })),
      makeScene("s2", 1, makeIR("s2", { factsRevealedToReader: ["Alice is a spy", "New fact"] })),
    ];

    const states = accumulateReaderState(scenes);
    expect(states[1]!.newFacts).toEqual(["New fact"]);
    expect(states[1]!.state.knownFacts.size).toBe(2);
  });

  it("tracks withheld facts as wrong beliefs", () => {
    const scenes: SceneInput[] = [makeScene("s1", 0, makeIR("s1", { factsWithheld: ["The butler did it"] }))];

    const states = accumulateReaderState(scenes);
    expect(states[0]!.state.wrongBeliefs).toEqual(new Set(["The butler did it"]));
  });

  it("removes wrong beliefs when fact is revealed", () => {
    const scenes: SceneInput[] = [
      makeScene("s1", 0, makeIR("s1", { factsWithheld: ["The butler did it"] })),
      makeScene("s2", 1, makeIR("s2", { factsRevealedToReader: ["The butler did it"] })),
    ];

    const states = accumulateReaderState(scenes);
    expect(states[0]!.state.wrongBeliefs.has("The butler did it")).toBe(true);
    expect(states[1]!.state.wrongBeliefs.has("The butler did it")).toBe(false);
  });

  it("tracks suspicions from character deltas", () => {
    const scenes: SceneInput[] = [
      makeScene(
        "s1",
        0,
        makeIR("s1", {
          characterDeltas: [
            {
              characterId: "alice",
              learned: null,
              suspicionGained: "Bob is lying",
              emotionalShift: null,
              relationshipChange: null,
            },
          ],
        }),
      ),
    ];

    const states = accumulateReaderState(scenes);
    expect(states[0]!.state.suspicions).toEqual(new Set(["Bob is lying"]));
  });

  it("tracks new and resolved tensions", () => {
    const scenes: SceneInput[] = [
      makeScene("s1", 0, makeIR("s1", { unresolvedTensions: ["Who killed the mayor?", "Where is the key?"] })),
      makeScene("s2", 1, makeIR("s2", { unresolvedTensions: ["Who killed the mayor?"] })),
    ];

    const states = accumulateReaderState(scenes);
    expect(states[0]!.newTensions).toEqual(["Who killed the mayor?", "Where is the key?"]);
    expect(states[1]!.resolvedTensions).toEqual(["Where is the key?"]);
    expect(states[1]!.state.unresolvedTensions).toEqual(new Set(["Who killed the mayor?"]));
  });

  it("skips unverified IRs", () => {
    const scenes: SceneInput[] = [
      makeScene("s1", 0, makeIR("s1", { verified: false, factsRevealedToReader: ["Secret fact"] })),
    ];

    const states = accumulateReaderState(scenes);
    expect(states[0]!.state.knownFacts.size).toBe(0);
    expect(states[0]!.newFacts).toEqual([]);
  });

  it("skips scenes with no IR", () => {
    const scenes: SceneInput[] = [makeScene("s1", 0, null)];

    const states = accumulateReaderState(scenes);
    expect(states[0]!.state.knownFacts.size).toBe(0);
  });

  it("sorts by sceneOrder regardless of input order", () => {
    const scenes: SceneInput[] = [
      makeScene("s2", 1, makeIR("s2", { factsRevealedToReader: ["Second fact"] })),
      makeScene("s1", 0, makeIR("s1", { factsRevealedToReader: ["First fact"] })),
    ];

    const states = accumulateReaderState(scenes);
    expect(states[0]!.sceneId).toBe("s1");
    expect(states[1]!.sceneId).toBe("s2");
    expect(states[1]!.state.knownFacts).toEqual(new Set(["First fact", "Second fact"]));
  });
});

describe("detectEpistemicIssues", () => {
  it("returns empty array when no issues", () => {
    const scenes: SceneInput[] = [makeScene("s1", 0, makeIR("s1", { factsRevealedToReader: ["The door is locked"] }))];
    const states = accumulateReaderState(scenes);
    const warnings = detectEpistemicIssues(scenes, states);
    expect(warnings).toEqual([]);
  });

  it("flags character acting on explicitly withheld knowledge", () => {
    const scenes: SceneInput[] = [
      makeScene(
        "s1",
        0,
        makeIR("s1", {
          factsWithheld: ["Secret passage behind the bookshelf"],
        }),
      ),
      makeScene(
        "s2",
        1,
        makeIR("s2", {
          characterDeltas: [
            {
              characterId: "bob",
              learned: "The secret passage is real",
              suspicionGained: null,
              emotionalShift: null,
              relationshipChange: null,
            },
          ],
        }),
      ),
    ];
    const states = accumulateReaderState(scenes);
    const warnings = detectEpistemicIssues(scenes, states);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.type).toBe("knowledge_ahead");
    expect(warnings[0]!.message).toContain("secret passage");
  });

  it("does not flag if learned fact was never withheld", () => {
    const scenes: SceneInput[] = [
      makeScene(
        "s1",
        0,
        makeIR("s1", {
          characterDeltas: [
            {
              characterId: "bob",
              learned: "The door is locked",
              suspicionGained: null,
              emotionalShift: null,
              relationshipChange: null,
            },
          ],
          factsRevealedToReader: [],
        }),
      ),
    ];
    const states = accumulateReaderState(scenes);
    const warnings = detectEpistemicIssues(scenes, states);
    expect(warnings).toEqual([]);
  });

  it("does not flag if withheld fact was later revealed", () => {
    const scenes: SceneInput[] = [
      makeScene(
        "s1",
        0,
        makeIR("s1", {
          factsWithheld: ["Secret passage exists"],
        }),
      ),
      makeScene(
        "s2",
        1,
        makeIR("s2", {
          factsRevealedToReader: ["Secret passage exists"],
          characterDeltas: [
            {
              characterId: "bob",
              learned: "Secret passage exists",
              suspicionGained: null,
              emotionalShift: null,
              relationshipChange: null,
            },
          ],
        }),
      ),
    ];
    const states = accumulateReaderState(scenes);
    const warnings = detectEpistemicIssues(scenes, states);
    expect(warnings).toEqual([]);
  });

  it("resolves character names from bible when provided", () => {
    const bible = {
      characters: [{ id: "bob-id", name: "Bob" }],
    };
    const scenes: SceneInput[] = [
      makeScene("s1", 0, makeIR("s1", { factsWithheld: ["The treasure location"] })),
      makeScene(
        "s2",
        1,
        makeIR("s2", {
          characterDeltas: [
            {
              characterId: "bob-id",
              learned: "Found the treasure location",
              suspicionGained: null,
              emotionalShift: null,
              relationshipChange: null,
            },
          ],
        }),
      ),
    ];
    const states = accumulateReaderState(scenes);
    const warnings = detectEpistemicIssues(scenes, states, bible as any);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain("Bob");
    expect(warnings[0]!.message).not.toContain("bob-id");
  });

  it("flags payoff executed before matching setup", () => {
    const scenes: SceneInput[] = [
      makeScene("s1", 0, makeIR("s1", { payoffsExecuted: ["The locked drawer"] })),
      makeScene("s2", 1, makeIR("s2", { setupsPlanted: ["The locked drawer"] })),
    ];
    const states = accumulateReaderState(scenes);
    const warnings = detectEpistemicIssues(scenes, states);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.type).toBe("premature_setup_ref");
    expect(warnings[0]!.message).toContain("The locked drawer");
  });

  it("does not flag payoff when setup exists in earlier scene", () => {
    const scenes: SceneInput[] = [
      makeScene("s1", 0, makeIR("s1", { setupsPlanted: ["The locked drawer"] })),
      makeScene("s2", 1, makeIR("s2", { payoffsExecuted: ["The locked drawer"] })),
    ];
    const states = accumulateReaderState(scenes);
    const warnings = detectEpistemicIssues(scenes, states);
    expect(warnings).toEqual([]);
  });

  it("matches payoffs to setups via keyword overlap (not exact match)", () => {
    const scenes: SceneInput[] = [
      makeScene("s1", 0, makeIR("s1", { setupsPlanted: ["Mysterious locked drawer in study"] })),
      makeScene("s2", 1, makeIR("s2", { payoffsExecuted: ["Drawer finally opened revealing contents"] })),
    ];
    const states = accumulateReaderState(scenes);
    const warnings = detectEpistemicIssues(scenes, states);
    expect(warnings).toEqual([]);
  });

  it("does not false-positive on unrelated strings sharing only stop words", () => {
    // "The door was open" and "The car was parked" share stop words but no keywords
    const scenes: SceneInput[] = [
      makeScene(
        "s1",
        0,
        makeIR("s1", {
          factsWithheld: ["The door was open"],
        }),
      ),
      makeScene(
        "s2",
        1,
        makeIR("s2", {
          characterDeltas: [
            {
              characterId: "alice",
              learned: "The car was parked",
              suspicionGained: null,
              emotionalShift: null,
              relationshipChange: null,
            },
          ],
        }),
      ),
    ];
    const states = accumulateReaderState(scenes);
    const warnings = detectEpistemicIssues(scenes, states);
    expect(warnings).toEqual([]);
  });

  it("falls back to substring match when strings contain only stop words", () => {
    // "he was" is all stop words, so extractKeywords returns [].
    // Substring fallback: "he was" includes "he was" → match
    const scenes: SceneInput[] = [
      makeScene("s1", 0, makeIR("s1", { factsWithheld: ["he was"] })),
      makeScene(
        "s2",
        1,
        makeIR("s2", {
          characterDeltas: [
            {
              characterId: "bob",
              learned: "he was not",
              suspicionGained: null,
              emotionalShift: null,
              relationshipChange: null,
            },
          ],
        }),
      ),
    ];
    const states = accumulateReaderState(scenes);
    const warnings = detectEpistemicIssues(scenes, states);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.type).toBe("knowledge_ahead");
  });

  it("does not match empty learned string against withheld facts", () => {
    const scenes: SceneInput[] = [
      makeScene("s1", 0, makeIR("s1", { factsWithheld: ["The treasure location"] })),
      makeScene(
        "s2",
        1,
        makeIR("s2", {
          characterDeltas: [
            {
              characterId: "bob",
              learned: "",
              suspicionGained: null,
              emotionalShift: null,
              relationshipChange: null,
            },
          ],
        }),
      ),
    ];
    const states = accumulateReaderState(scenes);
    const warnings = detectEpistemicIssues(scenes, states);
    expect(warnings).toEqual([]);
  });

  it("wraps character ID in brackets when no bible is provided", () => {
    const scenes: SceneInput[] = [
      makeScene("s1", 0, makeIR("s1", { factsWithheld: ["Secret tunnel beneath castle"] })),
      makeScene(
        "s2",
        1,
        makeIR("s2", {
          characterDeltas: [
            {
              characterId: "char-99",
              learned: "Found secret tunnel",
              suspicionGained: null,
              emotionalShift: null,
              relationshipChange: null,
            },
          ],
        }),
      ),
    ];
    const states = accumulateReaderState(scenes);
    // No bible passed — should use [characterId] format
    const warnings = detectEpistemicIssues(scenes, states);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain("[char-99]");
  });

  it("shows [unknown: id] for character not in bible", () => {
    const bible = {
      characters: [{ id: "alice-id", name: "Alice" }],
    };
    const scenes: SceneInput[] = [
      makeScene("s1", 0, makeIR("s1", { factsWithheld: ["Hidden escape route"] })),
      makeScene(
        "s2",
        1,
        makeIR("s2", {
          characterDeltas: [
            {
              characterId: "nonexistent-id",
              learned: "Discovered the hidden escape route",
              suspicionGained: null,
              emotionalShift: null,
              relationshipChange: null,
            },
          ],
        }),
      ),
    ];
    const states = accumulateReaderState(scenes);
    const warnings = detectEpistemicIssues(scenes, states, bible as any);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain("[unknown: nonexistent-id]");
  });

  it("flags same-scene setup+payoff as premature (setup accumulated after payoff check)", () => {
    // In detectEpistemicIssues, payoffs are checked BEFORE setups are accumulated.
    // So a payoff in the same scene as its setup has no prior setup to match against.
    const scenes: SceneInput[] = [
      makeScene(
        "s1",
        0,
        makeIR("s1", {
          setupsPlanted: ["The mysterious letter"],
          payoffsExecuted: ["The mysterious letter was read"],
        }),
      ),
    ];
    const states = accumulateReaderState(scenes);
    const warnings = detectEpistemicIssues(scenes, states);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.type).toBe("premature_setup_ref");
  });

  it("accumulates multiple withheld facts across scenes", () => {
    const scenes: SceneInput[] = [
      makeScene("s1", 0, makeIR("s1", { factsWithheld: ["Poison in the wine"] })),
      makeScene("s2", 1, makeIR("s2", { factsWithheld: ["Dagger under the table"] })),
      makeScene(
        "s3",
        2,
        makeIR("s3", {
          characterDeltas: [
            {
              characterId: "villain",
              learned: "Retrieved the dagger under table",
              suspicionGained: null,
              emotionalShift: null,
              relationshipChange: null,
            },
          ],
        }),
      ),
    ];
    const states = accumulateReaderState(scenes);
    const warnings = detectEpistemicIssues(scenes, states);
    // Should flag because "dagger" + "table" overlap with withheld "Dagger under the table"
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.type).toBe("knowledge_ahead");
    expect(warnings[0]!.message).toContain("dagger");
  });

  it("skips scenes without reader state entries", () => {
    // If readerStates doesn't include a scene, it should be skipped entirely
    const scenes: SceneInput[] = [
      makeScene("s1", 0, makeIR("s1", { factsWithheld: ["Secret"] })),
      makeScene(
        "s2",
        1,
        makeIR("s2", {
          characterDeltas: [
            {
              characterId: "bob",
              learned: "Found the secret",
              suspicionGained: null,
              emotionalShift: null,
              relationshipChange: null,
            },
          ],
        }),
      ),
    ];
    // Only pass reader state for s1, not s2
    const allStates = accumulateReaderState(scenes);
    const partialStates = allStates.filter((s) => s.sceneId === "s1");
    const warnings = detectEpistemicIssues(scenes, partialStates);
    // s2 should be skipped (not in readerStates), so no warning
    expect(warnings).toEqual([]);
  });
});
