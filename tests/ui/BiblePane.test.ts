import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import BiblePane from "../../src/app/components/BiblePane.svelte";

vi.mock("svelte-codemirror-editor", () => ({
  // Svelte 5 components are functions; provide a no-op component
  default: function CodeMirrorStub() {},
}));
vi.mock("@codemirror/lang-json", () => ({ json: () => [] }));
vi.mock("@codemirror/theme-one-dark", () => ({ oneDark: [] }));

function createMockStore(overrides = {}) {
  return {
    bible: null,
    activeScenePlan: null,
    scenes: [],
    loadFile: vi.fn(),
    saveFile: vi.fn(),
    setBible: vi.fn(),
    setScenePlan: vi.fn(),
    addScenePlan: vi.fn(),
    setChapterArc: vi.fn(),
    setError: vi.fn(),
    ...overrides,
  };
}

describe("BiblePane", () => {
  it("renders 'Bible + Plan' title", () => {
    render(BiblePane, { store: createMockStore(), onBootstrap: vi.fn() });
    expect(screen.getByText("Bible + Plan")).toBeInTheDocument();
  });

  it("shows 'New Bible' button when onAuthor is provided", () => {
    render(BiblePane, {
      store: createMockStore(),
      onBootstrap: vi.fn(),
      onAuthor: vi.fn(),
    });
    expect(screen.getByText("New Bible")).toBeInTheDocument();
  });

  it("shows 'Bootstrap' button when onAuthor is not provided", () => {
    render(BiblePane, { store: createMockStore(), onBootstrap: vi.fn() });
    expect(screen.getByText("Bootstrap")).toBeInTheDocument();
  });

  it("shows 'Load Bible' button", () => {
    render(BiblePane, { store: createMockStore(), onBootstrap: vi.fn() });
    expect(screen.getByText("Load Bible")).toBeInTheDocument();
  });

  it("Save Bible button is disabled when no bible", () => {
    render(BiblePane, { store: createMockStore(), onBootstrap: vi.fn() });
    expect(screen.getByText("Save Bible")).toBeDisabled();
  });
});
