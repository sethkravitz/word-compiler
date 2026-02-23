import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import BibleAuthoringModal from "../../src/app/components/BibleAuthoringModal.svelte";

vi.mock("../../src/llm/client.js", () => ({
  generateStream: vi.fn(),
}));

vi.mock("../../src/bootstrap/index.js", () => ({
  buildBootstrapPrompt: vi.fn(),
  parseBootstrapResponse: vi.fn(),
  bootstrapToBible: vi.fn(),
}));

function createMockStore() {
  return {
    bibleAuthoringOpen: true,
    bible: null,
    project: { id: "test-proj" },
    setBibleAuthoringOpen: vi.fn(),
    setBible: vi.fn(),
    setError: vi.fn(),
  };
}

function createMockCommands() {
  return {
    saveBible: vi.fn().mockResolvedValue({ ok: true }),
    saveScenePlan: vi.fn().mockResolvedValue({ ok: true }),
    updateScenePlan: vi.fn().mockResolvedValue({ ok: true }),
    saveMultipleScenePlans: vi.fn().mockResolvedValue({ ok: true }),
    saveChapterArc: vi.fn().mockResolvedValue({ ok: true }),
    updateChapterArc: vi.fn().mockResolvedValue({ ok: true }),
    saveChunk: vi.fn().mockResolvedValue({ ok: true }),
    updateChunk: vi.fn().mockResolvedValue({ ok: true }),
    persistChunk: vi.fn().mockResolvedValue({ ok: true }),
    removeChunk: vi.fn().mockResolvedValue({ ok: true }),
    completeScene: vi.fn().mockResolvedValue({ ok: true }),
    saveAuditFlags: vi.fn().mockResolvedValue({ ok: true }),
    resolveAuditFlag: vi.fn().mockResolvedValue({ ok: true }),
    dismissAuditFlag: vi.fn().mockResolvedValue({ ok: true }),
    saveSceneIR: vi.fn().mockResolvedValue({ ok: true }),
    verifySceneIR: vi.fn().mockResolvedValue({ ok: true }),
    saveCompilationLog: vi.fn().mockResolvedValue({ ok: true }),
  };
}

describe("BibleAuthoringModal", () => {
  it('renders "AI Bootstrap" and "Guided Form" tabs', () => {
    render(BibleAuthoringModal, { store: createMockStore(), commands: createMockCommands() });
    expect(screen.getByText("AI Bootstrap")).toBeInTheDocument();
    expect(screen.getByText("Guided Form")).toBeInTheDocument();
  });

  it("Guided Form tab shows stepper with 5 steps", async () => {
    render(BibleAuthoringModal, { store: createMockStore(), commands: createMockCommands() });
    await fireEvent.click(screen.getByText("Guided Form"));
    expect(screen.getByText("Foundations")).toBeInTheDocument();
    expect(screen.getByText("Characters")).toBeInTheDocument();
    expect(screen.getByText("Locations")).toBeInTheDocument();
    expect(screen.getByText("Style Guide")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });

  it('Characters step shows "Add Character" button and empty message', async () => {
    render(BibleAuthoringModal, { store: createMockStore(), commands: createMockCommands() });
    await fireEvent.click(screen.getByText("Guided Form"));
    await fireEvent.click(screen.getByText("Characters"));
    expect(screen.getByText("Add Character")).toBeInTheDocument();
    expect(screen.getByText("No characters yet. Add one to get started.")).toBeInTheDocument();
  });

  it("Review step shows summary counts", async () => {
    render(BibleAuthoringModal, { store: createMockStore(), commands: createMockCommands() });
    await fireEvent.click(screen.getByText("Guided Form"));
    await fireEvent.click(screen.getByText("Review"));
    expect(screen.getByText("Characters: 0")).toBeInTheDocument();
    expect(screen.getByText("Locations: 0")).toBeInTheDocument();
    expect(screen.getByText("Avoid List: 0 entries")).toBeInTheDocument();
  });

  it("Footer shows Cancel and Next buttons on first step", async () => {
    render(BibleAuthoringModal, { store: createMockStore(), commands: createMockCommands() });
    await fireEvent.click(screen.getByText("Guided Form"));
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  it("Footer shows Back button on non-first steps", async () => {
    render(BibleAuthoringModal, { store: createMockStore(), commands: createMockCommands() });
    await fireEvent.click(screen.getByText("Guided Form"));
    await fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Back")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  // ─── Genre Selector ──────────────────────────────

  it("renders genre selector dropdown on Guided Form tab", async () => {
    render(BibleAuthoringModal, { store: createMockStore(), commands: createMockCommands() });
    await fireEvent.click(screen.getByText("Guided Form"));
    expect(screen.getByText("Genre Template")).toBeInTheDocument();
    expect(screen.getByText(/select a genre to pre-fill/i)).toBeInTheDocument();
  });

  it("genre options include all 4 templates", async () => {
    render(BibleAuthoringModal, { store: createMockStore(), commands: createMockCommands() });
    await fireEvent.click(screen.getByText("Guided Form"));
    expect(screen.getByText(/Literary Fiction/)).toBeInTheDocument();
    expect(screen.getByText(/Thriller/)).toBeInTheDocument();
    expect(screen.getByText(/Romance/)).toBeInTheDocument();
    expect(screen.getByText(/Science Fiction/)).toBeInTheDocument();
  });

  it("genre selector is not visible on AI Bootstrap tab", () => {
    render(BibleAuthoringModal, { store: createMockStore(), commands: createMockCommands() });
    // Default tab is AI Bootstrap — form tab is rendered but hidden
    expect(screen.queryByText("Genre Template")).not.toBeVisible();
  });

  it("genre select has correct option values for all 4 templates", async () => {
    render(BibleAuthoringModal, { store: createMockStore(), commands: createMockCommands() });
    await fireEvent.click(screen.getByText("Guided Form"));

    // Verify the select element contains all 4 genre option values
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain("literary-fiction");
    expect(options).toContain("thriller");
    expect(options).toContain("romance");
    expect(options).toContain("sci-fi");
  });
});
