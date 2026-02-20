import { describe, expect, it } from "vitest";
import {
  buildSceneBootstrapPrompt,
  mapSceneBootstrapToPlans,
  parseSceneBootstrapResponse,
  sceneBootstrapSchema,
} from "../../src/bootstrap/sceneBootstrap.js";

const characters = [
  { id: "c1", name: "Marcus Cole", role: "protagonist" },
  { id: "c2", name: "Elena Voss", role: "antagonist" },
];

const locations = [
  { id: "l1", name: "The Velvet" },
  { id: "l2", name: "Harbor District" },
];

describe("buildSceneBootstrapPrompt", () => {
  it("returns a CompiledPayload with model and temperature", () => {
    const payload = buildSceneBootstrapPrompt({
      direction: "A tense confrontation",
      sceneCount: 3,
      characters,
      locations,
      includeChapterArc: false,
    });
    expect(payload.model).toBe("claude-sonnet-4-6");
    expect(payload.temperature).toBe(0.7);
    expect(payload.topP).toBe(0.92);
    expect(payload.systemMessage).toContain("3 scene plans");
    expect(payload.userMessage).toContain("Marcus Cole");
    expect(payload.userMessage).toContain("The Velvet");
  });

  it("includes outputSchema matching sceneBootstrapSchema", () => {
    const payload = buildSceneBootstrapPrompt({
      direction: "A tense confrontation",
      sceneCount: 2,
      characters,
      locations,
      includeChapterArc: false,
    });
    expect(payload.outputSchema).toBe(sceneBootstrapSchema);
    expect(payload.outputSchema).toHaveProperty("type", "object");
    expect(payload.outputSchema).toHaveProperty("properties.scenes");
  });

  it("includes chapter arc instruction when requested", () => {
    const payload = buildSceneBootstrapPrompt({
      direction: "Test",
      sceneCount: 2,
      characters: [],
      locations: [],
      includeChapterArc: true,
    });
    expect(payload.userMessage).toContain("chapterArc");
  });

  it("includes constraints when provided", () => {
    const payload = buildSceneBootstrapPrompt({
      direction: "Test",
      sceneCount: 1,
      characters: [],
      locations: [],
      constraints: "No violence in scene 1",
      includeChapterArc: false,
    });
    expect(payload.userMessage).toContain("No violence in scene 1");
  });
});

describe("parseSceneBootstrapResponse", () => {
  const validResponse = JSON.stringify({
    scenes: [{ title: "Opening", narrativeGoal: "Establish tension" }],
  });

  it("parses clean JSON", () => {
    const result = parseSceneBootstrapResponse(validResponse);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0]!.title).toBe("Opening");
    }
  });

  it("parses JSON inside code fences", () => {
    const fenced = `Here's the result:\n\`\`\`json\n${validResponse}\n\`\`\`\nDone!`;
    const result = parseSceneBootstrapResponse(fenced);
    expect("error" in result).toBe(false);
  });

  it("parses JSON with surrounding text using brace depth", () => {
    const wrapped = `Let me generate scenes for you.\n${validResponse}\n\nI hope these work!`;
    const result = parseSceneBootstrapResponse(wrapped);
    expect("error" in result).toBe(false);
  });

  it("returns error for unparseable text", () => {
    const result = parseSceneBootstrapResponse("This is not JSON at all.");
    expect("error" in result).toBe(true);
  });

  it("returns error for empty string", () => {
    const result = parseSceneBootstrapResponse("");
    expect("error" in result).toBe(true);
  });
});

describe("mapSceneBootstrapToPlans", () => {
  it("maps parsed scenes to typed ScenePlan[]", () => {
    const parsed = {
      scenes: [
        {
          title: "Opening",
          povCharacterId: "c1",
          povDistance: "close",
          narrativeGoal: "Establish the detective's routine",
          emotionalBeat: "Quiet unease",
          density: "moderate",
          estimatedWordCount: [800, 1200] as [number, number],
          chunkCount: 3,
          chunkDescriptions: ["Arrival", "Discovery", "Reaction"],
          readerStateEntering: { knows: ["Marcus owns a bar"] },
          readerStateExiting: { knows: ["Marcus owns a bar", "Someone was murdered"] },
        },
      ],
    };

    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", characters, locations);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.title).toBe("Opening");
    expect(plans[0]!.povCharacterId).toBe("c1");
    expect(plans[0]!.projectId).toBe("proj-1");
    expect(plans[0]!.id).toBeTruthy();
    expect(plans[0]!.chunkDescriptions).toEqual(["Arrival", "Discovery", "Reaction"]);
  });

  it("resolves character by name when ID does not match", () => {
    const parsed = {
      scenes: [
        {
          title: "Test",
          povCharacterId: "unknown-id",
          povCharacterName: "Marcus Cole",
        },
      ],
    };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", characters, locations);
    expect(plans[0]!.povCharacterId).toBe("c1");
  });

  it("resolves character by name when no ID provided", () => {
    const parsed = {
      scenes: [{ title: "Test", povCharacterName: "Elena Voss" }],
    };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", characters, locations);
    expect(plans[0]!.povCharacterId).toBe("c2");
  });

  it("resolves location by name when ID does not match", () => {
    const parsed = {
      scenes: [{ title: "Test", locationId: "bad-id", locationName: "The Velvet" }],
    };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", characters, locations);
    expect(plans[0]!.locationId).toBe("l1");
  });

  it("provides safe defaults for missing fields", () => {
    const parsed = { scenes: [{ title: "Minimal" }] };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", [], []);
    expect(plans[0]!.povDistance).toBe("close");
    expect(plans[0]!.density).toBe("moderate");
    expect(plans[0]!.estimatedWordCount).toEqual([800, 1200]);
    expect(plans[0]!.chunkCount).toBe(3);
  });

  it("normalizes scalar estimatedWordCount to range", () => {
    const parsed = { scenes: [{ title: "Test", estimatedWordCount: 1000 }] };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", [], []);
    expect(plans[0]!.estimatedWordCount).toEqual([800, 1200]);
  });

  it("generates unique IDs for each scene", () => {
    const parsed = {
      scenes: [{ title: "Scene 1" }, { title: "Scene 2" }],
    };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", [], []);
    expect(plans[0]!.id).not.toBe(plans[1]!.id);
  });

  it("maps subtext correctly", () => {
    const parsed = {
      scenes: [
        {
          title: "Test",
          subtext: {
            surfaceConversation: "Business talk",
            actualConversation: "Power struggle",
            enforcementRule: "Never state power explicitly",
          },
        },
      ],
    };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", [], []);
    expect(plans[0]!.subtext).toEqual({
      surfaceConversation: "Business talk",
      actualConversation: "Power struggle",
      enforcementRule: "Never state power explicitly",
    });
  });

  it("validates enum values and falls back to defaults", () => {
    const parsed = {
      scenes: [{ title: "Test", density: "ultra-dense", povDistance: "ethereal" }],
    };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", [], []);
    expect(plans[0]!.density).toBe("moderate");
    expect(plans[0]!.povDistance).toBe("close");
  });
});
