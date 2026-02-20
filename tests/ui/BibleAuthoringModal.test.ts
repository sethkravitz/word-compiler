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

describe("BibleAuthoringModal", () => {
  it('renders "AI Bootstrap" and "Guided Form" tabs', () => {
    render(BibleAuthoringModal, { store: createMockStore() });
    expect(screen.getByText("AI Bootstrap")).toBeInTheDocument();
    expect(screen.getByText("Guided Form")).toBeInTheDocument();
  });

  it("Guided Form tab shows stepper with 5 steps", async () => {
    render(BibleAuthoringModal, { store: createMockStore() });
    await fireEvent.click(screen.getByText("Guided Form"));
    expect(screen.getByText("Foundations")).toBeInTheDocument();
    expect(screen.getByText("Characters")).toBeInTheDocument();
    expect(screen.getByText("Locations")).toBeInTheDocument();
    expect(screen.getByText("Style Guide")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });

  it('Characters step shows "Add Character" button and empty message', async () => {
    render(BibleAuthoringModal, { store: createMockStore() });
    await fireEvent.click(screen.getByText("Guided Form"));
    await fireEvent.click(screen.getByText("Characters"));
    expect(screen.getByText("Add Character")).toBeInTheDocument();
    expect(screen.getByText("No characters yet. Add one to get started.")).toBeInTheDocument();
  });

  it("Review step shows summary counts", async () => {
    render(BibleAuthoringModal, { store: createMockStore() });
    await fireEvent.click(screen.getByText("Guided Form"));
    await fireEvent.click(screen.getByText("Review"));
    expect(screen.getByText("Characters: 0")).toBeInTheDocument();
    expect(screen.getByText("Locations: 0")).toBeInTheDocument();
    expect(screen.getByText("Kill List: 0 entries")).toBeInTheDocument();
  });

  it("Footer shows Cancel and Next buttons on first step", async () => {
    render(BibleAuthoringModal, { store: createMockStore() });
    await fireEvent.click(screen.getByText("Guided Form"));
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  it("Footer shows Back button on non-first steps", async () => {
    render(BibleAuthoringModal, { store: createMockStore() });
    await fireEvent.click(screen.getByText("Guided Form"));
    await fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Back")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });
});
