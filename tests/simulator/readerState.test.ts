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

  it("flags character acting on unrevealed knowledge", () => {
    const scenes: SceneInput[] = [
      makeScene(
        "s1",
        0,
        makeIR("s1", {
          characterDeltas: [
            {
              characterId: "bob",
              learned: "Secret passage exists",
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
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.type).toBe("knowledge_ahead");
    expect(warnings[0]!.message).toContain("Secret passage exists");
  });

  it("does not flag if reader already knows the fact", () => {
    const scenes: SceneInput[] = [
      makeScene(
        "s1",
        0,
        makeIR("s1", {
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
});
