import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SceneAuthoringModal from "../../src/app/components/SceneAuthoringModal.svelte";

vi.mock("../../src/llm/client.js", () => ({
  generateStream: vi.fn(),
}));

vi.mock("../../src/bootstrap/sceneBootstrap.js", () => ({
  buildSceneBootstrapPrompt: vi.fn(),
  parseSceneBootstrapResponse: vi.fn(),
  mapSceneBootstrapToPlans: vi.fn(),
}));

function createMockStore(overrides = {}) {
  return {
    sceneAuthoringOpen: true,
    bible: null,
    project: { id: "test-proj" },
    setSceneAuthoringOpen: vi.fn(),
    addScenePlan: vi.fn(),
    addMultipleScenePlans: vi.fn(),
    setChapterArc: vi.fn(),
    setError: vi.fn(),
    ...overrides,
  };
}

describe("SceneAuthoringModal", () => {
  it("renders both tab labels", () => {
    render(SceneAuthoringModal, { store: createMockStore() });
    expect(screen.getByText("AI Bootstrap")).toBeInTheDocument();
    expect(screen.getByText("Guided Form")).toBeInTheDocument();
  });

  it("bootstrap tab shows Chapter Direction field and Generate Scenes button", () => {
    render(SceneAuthoringModal, { store: createMockStore() });
    expect(screen.getByText("Chapter Direction")).toBeInTheDocument();
    expect(screen.getByText("Generate Scenes")).toBeInTheDocument();
  });

  it("Generate Scenes button is disabled when direction is empty", () => {
    render(SceneAuthoringModal, { store: createMockStore() });
    const btn = screen.getByText("Generate Scenes");
    expect(btn.closest("button")).toBeDisabled();
  });

  it("guided form shows title input and narrative goal textarea", async () => {
    render(SceneAuthoringModal, { store: createMockStore() });
    await fireEvent.click(screen.getByText("Guided Form"));
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Narrative Goal")).toBeInTheDocument();
  });

  it("footer shows Save & Close on guided form tab", async () => {
    render(SceneAuthoringModal, { store: createMockStore() });
    await fireEvent.click(screen.getByText("Guided Form"));
    expect(screen.getByText("Save & Close")).toBeInTheDocument();
  });
});
