import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import SetupPayoffPanel from "../../src/app/components/SetupPayoffPanel.svelte";
import type { NarrativeIR } from "../../src/types/index.js";

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

describe("SetupPayoffPanel", () => {
  it("shows empty state when no verified IRs exist", () => {
    render(SetupPayoffPanel, { sceneIRs: {}, sceneTitles: {} });
    expect(screen.getByText(/no verified irs/i)).toBeTruthy();
  });

  it("shows dangling setups as active/unresolved", () => {
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeIR("scene-1", { setupsPlanted: ["The locked drawer"] }),
    };
    const titles = { "scene-1": "Opening" };
    render(SetupPayoffPanel, { sceneIRs: irs, sceneTitles: titles });

    expect(screen.getByText("The locked drawer")).toBeTruthy();
    expect(screen.getByText(/planted in Opening/)).toBeTruthy();
    expect(screen.getByText(/active setups/i)).toBeTruthy();
  });

  it("shows resolved payoffs when setup matches a payoff", () => {
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeIR("scene-1", { setupsPlanted: ["The locked drawer"] }),
      "scene-2": makeIR("scene-2", { payoffsExecuted: ["The locked drawer"] }),
    };
    const titles = { "scene-1": "Opening", "scene-2": "Climax" };
    render(SetupPayoffPanel, { sceneIRs: irs, sceneTitles: titles });

    expect(screen.getByText("The locked drawer")).toBeTruthy();
    expect(screen.getByText(/resolved payoffs/i)).toBeTruthy();
  });

  it("skips unverified IRs", () => {
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeIR("scene-1", { verified: false, setupsPlanted: ["Hidden clue"] }),
    };
    render(SetupPayoffPanel, { sceneIRs: irs, sceneTitles: {} });
    expect(screen.getByText(/no verified irs/i)).toBeTruthy();
  });

  it("matches payoffs case-insensitively", () => {
    const irs: Record<string, NarrativeIR> = {
      "scene-1": makeIR("scene-1", { setupsPlanted: ["The Locked Drawer"] }),
      "scene-2": makeIR("scene-2", { payoffsExecuted: ["the locked drawer"] }),
    };
    const titles = { "scene-1": "Opening", "scene-2": "Climax" };
    render(SetupPayoffPanel, { sceneIRs: irs, sceneTitles: titles });

    expect(screen.getByText(/resolved payoffs/i)).toBeTruthy();
    expect(screen.queryByText(/active setups/i)).toBeNull();
  });
});
