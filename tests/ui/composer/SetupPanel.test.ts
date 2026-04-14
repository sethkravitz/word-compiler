import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Commands } from "../../../src/app/store/commands.js";
import { ProjectStore } from "../../../src/app/store/project.svelte.js";
import type { Bible } from "../../../src/types/bible.js";
import { createEmptyBible } from "../../../src/types/bible.js";

// Replace the full VoiceProfilePanel (which fires API calls in $effect on
// mount) with a sentinel stub so we can verify the subsection renders without
// pulling in the voice API surface.
vi.mock("../../../src/app/components/VoiceProfilePanel.svelte", async () => {
  const mod = await import("./VoiceProfilePanelStub.svelte");
  return { default: mod.default };
});

import SetupPanel from "../../../src/app/components/composer/SetupPanel.svelte";

// ─── Test helpers ─────────────────────────────────────────

function makeBible(overrides: Partial<Bible> = {}): Bible {
  return { ...createEmptyBible("proj-1", "essay"), ...overrides };
}

interface MockCommands {
  saveBible: ReturnType<typeof vi.fn>;
}

function makeCommands(): MockCommands {
  return {
    saveBible: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  };
}

interface RenderResult {
  store: ProjectStore;
  commands: MockCommands;
  onBibleChange: ReturnType<typeof vi.fn>;
}

function renderPanel(opts: { bible?: Bible | null; bibleEmpty?: boolean } = {}): RenderResult {
  const store = new ProjectStore();
  store.setProject({ id: "proj-1", title: "Test", status: "drafting", createdAt: "", updatedAt: "" });
  const bible = opts.bibleEmpty ? null : (opts.bible ?? makeBible());
  if (bible) store.setBible(bible);
  const commands = makeCommands();
  const onBibleChange = vi.fn();
  render(SetupPanel, {
    store,
    commands: commands as unknown as Commands,
    onBibleChange,
  });
  return { store, commands, onBibleChange };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  document.body.innerHTML = "";
});

// ─── Subsection rendering ────────────────────────────────

describe("SetupPanel subsection rendering", () => {
  it("renders Brief, Voice, and Style subsections", () => {
    renderPanel();
    expect(screen.getByTestId("setup-brief")).toBeInTheDocument();
    expect(screen.getByTestId("setup-voice")).toBeInTheDocument();
    expect(screen.getByTestId("setup-style")).toBeInTheDocument();
  });

  it("renders VoiceProfilePanel inside the Voice subsection (via stub)", () => {
    renderPanel();
    expect(screen.getByTestId("voice-profile-panel-stub")).toBeInTheDocument();
  });

  it("Voice subsection header text contains 'shared across all projects'", () => {
    renderPanel();
    expect(screen.getByText(/shared across all projects/i)).toBeInTheDocument();
  });

  it("does not render any fiction-specific fields (characters, locations, setups)", () => {
    renderPanel();
    expect(screen.queryByText(/\bcharacters?\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\blocations?\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bplot setups?\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bsensory\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bdossier/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bscene\b/i)).not.toBeInTheDocument();
  });
});

// ─── Default open / collapsed ────────────────────────────

describe("SetupPanel default open state", () => {
  it("is open by default when subtextPolicy (thesis) is empty", () => {
    const bible = makeBible();
    bible.narrativeRules.subtextPolicy = null;
    renderPanel({ bible });
    const details = screen.getByTestId("setup-panel").querySelector("details");
    expect(details).toBeTruthy();
    expect(details?.open).toBe(true);
  });

  it("is collapsed by default when subtextPolicy is non-empty", () => {
    // Clear any persisted state from prior test runs that may have bled in
    // via jsdom localStorage. We use a unique sectionId for the panel.
    try {
      window.localStorage.removeItem("collapsible:setup-panel");
    } catch {
      /* ignore */
    }
    const bible = makeBible();
    bible.narrativeRules.subtextPolicy = "Personal computing should belong to the user, not the platform.";
    renderPanel({ bible });
    const details = screen.getByTestId("setup-panel").querySelector("details");
    expect(details).toBeTruthy();
    expect(details?.open).toBe(false);
  });
});

// ─── Brief subsection saves ──────────────────────────────

describe("SetupPanel Brief subsection saves", () => {
  it("saves thesis on blur to bible.narrativeRules.subtextPolicy", async () => {
    const bible = makeBible();
    const { commands } = renderPanel({ bible });

    const thesisTextarea = screen.getByText("Thesis").closest(".form-field")?.querySelector("textarea");
    expect(thesisTextarea).toBeTruthy();

    await fireEvent.input(thesisTextarea as HTMLTextAreaElement, {
      target: { value: "Software should respect users." },
    });
    await fireEvent.focusOut(thesisTextarea as HTMLTextAreaElement);

    expect(commands.saveBible).toHaveBeenCalled();
    const savedBible = commands.saveBible.mock.calls[0]?.[0] as Bible;
    expect(savedBible.narrativeRules.subtextPolicy).toBe("Software should respect users.");
  });

  it("fires onBibleChange after a successful save", async () => {
    const { commands, onBibleChange } = renderPanel();
    const thesisTextarea = screen
      .getByText("Thesis")
      .closest(".form-field")
      ?.querySelector("textarea") as HTMLTextAreaElement;

    await fireEvent.input(thesisTextarea, { target: { value: "x" } });
    await fireEvent.focusOut(thesisTextarea);

    // saveBible is async — wait a microtask
    await Promise.resolve();
    await Promise.resolve();
    expect(commands.saveBible).toHaveBeenCalled();
    expect(onBibleChange).toHaveBeenCalled();
  });
});

// ─── Kill list editor ────────────────────────────────────

describe("SetupPanel kill list editor", () => {
  it("adds a kill list entry, types a pattern, and saveBible is called with the new pattern on blur", async () => {
    const { commands } = renderPanel();

    const addBtn = screen.getByRole("button", { name: /\+ Add pattern/i });
    await fireEvent.click(addBtn);

    const editor = screen.getByTestId("kill-list-editor");
    const inputs = editor.querySelectorAll("input.input");
    expect(inputs.length).toBe(1);
    const newInput = inputs[0] as HTMLInputElement;

    await fireEvent.input(newInput, { target: { value: "in today's world" } });
    await fireEvent.blur(newInput);

    expect(commands.saveBible).toHaveBeenCalled();
    const savedBible = commands.saveBible.mock.calls.at(-1)?.[0] as Bible;
    expect(savedBible.styleGuide.killList).toEqual(
      expect.arrayContaining([expect.objectContaining({ pattern: "in today's world", type: "exact" })]),
    );
  });

  it("removes a kill list entry and saveBible is called without that pattern", async () => {
    const bible = makeBible();
    bible.styleGuide.killList = [
      { pattern: "delve", type: "exact" },
      { pattern: "tapestry", type: "exact" },
    ];
    const { commands } = renderPanel({ bible });

    const editor = screen.getByTestId("kill-list-editor");
    const removeButtons = editor.querySelectorAll("button[aria-label='Remove kill list entry']");
    expect(removeButtons.length).toBe(2);

    // Remove the first entry ("delve")
    await fireEvent.click(removeButtons[0] as HTMLButtonElement);

    expect(commands.saveBible).toHaveBeenCalled();
    const savedBible = commands.saveBible.mock.calls.at(-1)?.[0] as Bible;
    expect(savedBible.styleGuide.killList).toEqual([{ pattern: "tapestry", type: "exact" }]);
  });
});
