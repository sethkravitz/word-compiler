import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectStore } from "../../../src/app/store/project.svelte.js";
import { createEmptyVoiceGuide } from "../../../src/profile/types.js";
import { createEmptyBible } from "../../../src/types/bible.js";
import type { Chunk, ScenePlan } from "../../../src/types/scene.js";

// Mock the auditor BEFORE importing EssayComposer so the kill-list re-audit
// flow can be observed without running the real auditor.
const runAuditMock = vi.fn((_prose: string, _bible: unknown, _sceneId: string) => ({
  flags: [],
  metrics: { wordCount: 0, sentenceCount: 0, paragraphCount: 0, sentenceLengths: [], paragraphLengths: [] },
}));
vi.mock("../../../src/auditor/index.js", () => ({
  runAudit: (prose: string, bible: unknown, sceneId: string) => runAuditMock(prose, bible, sceneId),
}));

// CIPHER + edit-tracking APIs are fired from the debounced edit path. Stub
// them so they don't make real network calls.
vi.mock("../../../src/api/client.js", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    apiStoreSignificantEdit: vi.fn().mockResolvedValue(0),
    apiFireBatchCipher: vi.fn().mockResolvedValue({ ring1Injection: "" }),
  };
});

// Replace the real ProseMirror editor with the lightweight stub so we can
// assert / drive its props from the test.
vi.mock("../../../src/app/components/AnnotatedEditor.svelte", async () => {
  const mod = await import("./AnnotatedEditorStub.svelte");
  return { default: mod.default };
});

// Replace VoiceProfilePanel inside SetupPanel — it fires API calls in $effect
// on mount which we don't want here.
vi.mock("../../../src/app/components/VoiceProfilePanel.svelte", async () => {
  const mod = await import("./VoiceProfilePanelStub.svelte");
  return { default: mod.default };
});

import EssayComposer from "../../../src/app/components/composer/EssayComposer.svelte";
import type { Commands } from "../../../src/app/store/commands.js";

// ─── Fakes / factories ─────────────────────────────────────

function makePlan(overrides: Partial<ScenePlan> = {}): ScenePlan {
  return {
    id: overrides.id ?? `scene-${Math.random().toString(36).slice(2, 8)}`,
    projectId: "proj-1",
    chapterId: null,
    title: "Section",
    povCharacterId: "",
    povDistance: "close",
    narrativeGoal: "Goal",
    emotionalBeat: "",
    readerEffect: "",
    readerStateEntering: null,
    readerStateExiting: null,
    characterKnowledgeChanges: {},
    subtext: null,
    dialogueConstraints: {},
    pacing: null,
    density: "moderate",
    sensoryNotes: null,
    sceneSpecificProhibitions: [],
    anchorLines: [],
    estimatedWordCount: [600, 900],
    chunkCount: 1,
    chunkDescriptions: [],
    failureModeToAvoid: "Generic",
    locationId: null,
    presentCharacterIds: [],
    ...overrides,
  };
}

function makeChunk(sceneId: string, text: string, status: Chunk["status"] = "accepted"): Chunk {
  return {
    id: `${sceneId}-c-${Math.random().toString(36).slice(2, 8)}`,
    sceneId,
    sequenceNumber: 0,
    generatedText: text,
    payloadHash: "",
    model: "test",
    temperature: 0.7,
    topP: 1,
    generatedAt: new Date().toISOString(),
    status,
    editedText: null,
    humanNotes: null,
  };
}

interface FakeCommands {
  saveBible: ReturnType<typeof vi.fn>;
  saveScenePlan: ReturnType<typeof vi.fn>;
  updateScenePlan: ReturnType<typeof vi.fn>;
  removeScenePlan: ReturnType<typeof vi.fn>;
  reorderScenePlans: ReturnType<typeof vi.fn>;
  saveAuditFlags: ReturnType<typeof vi.fn>;
  removeChunk: ReturnType<typeof vi.fn>;
  updateChunk: ReturnType<typeof vi.fn>;
  persistChunk: ReturnType<typeof vi.fn>;
}

function makeCommands(): FakeCommands {
  return {
    saveBible: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveScenePlan: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    updateScenePlan: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    removeScenePlan: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    reorderScenePlans: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveAuditFlags: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    // Default no-op resolves; tests that need store mutation install a
    // custom .mockImplementation in the test body.
    removeChunk: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    updateChunk: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    persistChunk: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  };
}

interface SetupOptions {
  scenes?: Array<{ id: string; title?: string; chunks?: Array<{ text: string; status?: Chunk["status"] }> }>;
  voiceRing1?: string;
  onGenerateImpl?: (sceneId: string) => Promise<void>;
}

function setupComposer(opts: SetupOptions = {}) {
  const store = new ProjectStore();
  store.setProject({
    id: "proj-1",
    title: "Test",
    status: "drafting",
    createdAt: "",
    updatedAt: "",
  });
  store.setBible(createEmptyBible("proj-1", "essay"));

  const scenes = (opts.scenes ?? [{ id: "scene-1" }]).map((s, i) => ({
    plan: makePlan({ id: s.id, title: s.title ?? `Section ${i + 1}` }),
    status: "planned" as const,
    sceneOrder: i,
  }));
  store.setScenes(scenes);

  for (const s of opts.scenes ?? [{ id: "scene-1" }]) {
    if (s.chunks && s.chunks.length > 0) {
      const chunks = s.chunks.map((c) => makeChunk(s.id, c.text, c.status));
      store.setSceneChunks(s.id, chunks);
    }
  }

  if (opts.voiceRing1 !== undefined) {
    store.setVoiceGuide({ ...createEmptyVoiceGuide(), ring1Injection: opts.voiceRing1 });
  }

  const commands = makeCommands();
  const onGenerate = opts.onGenerateImpl ? vi.fn(opts.onGenerateImpl) : vi.fn().mockResolvedValue(undefined);
  const onRequestRefinement = vi.fn();
  const onExtractIR = vi.fn();

  const result = render(EssayComposer, {
    store,
    commands: commands as unknown as Commands,
    onGenerate,
    onRequestRefinement,
    onExtractIR,
  });

  return { store, commands, onGenerate, onRequestRefinement, onExtractIR, ...result };
}

beforeEach(() => {
  runAuditMock.mockClear();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

// ─── Smoke / structure ─────────────────────────────────────

describe("EssayComposer structure", () => {
  it("renders SetupPanel, N SectionCards, and ComposerFooter", () => {
    setupComposer({ scenes: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    expect(screen.getByTestId("setup-panel")).toBeInTheDocument();
    expect(screen.getByTestId("composer-footer")).toBeInTheDocument();
    const cards = document.querySelectorAll(".section-card");
    expect(cards.length).toBe(3);
  });

  it("renders an Add Section button", () => {
    setupComposer();
    expect(screen.getByTestId("add-section-btn")).toBeInTheDocument();
  });

  it("does not render fiction-specific fields anywhere", () => {
    setupComposer();
    expect(screen.queryByText(/POV character/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dialogue constraint/i)).not.toBeInTheDocument();
  });
});

// ─── Generate / Queue ──────────────────────────────────────

describe("EssayComposer generate flow", () => {
  it("Generate on first section transitions to streaming and then idle-populated", async () => {
    let resolveStream: () => void = () => {};
    const streamPromise = new Promise<void>((r) => {
      resolveStream = r;
    });
    const { store, onGenerate } = setupComposer({
      scenes: [{ id: "s1" }],
      onGenerateImpl: async (sceneId: string) => {
        // Simulate a chunk being added by the generation pipeline.
        store.addChunk(makeChunk(sceneId, "generated prose"));
        await streamPromise;
      },
    });

    const generateBtns = screen.getAllByRole("button", { name: /^Generate$/ });
    await fireEvent.click(generateBtns[0]!);

    // runGeneration awaits tick() before calling onGenerate — drain microtasks.
    await tick();
    await Promise.resolve();
    expect(onGenerate).toHaveBeenCalledWith("s1");

    resolveStream();
    await waitFor(() => {
      // After the stream resolves, the section should show Regenerate
      expect(screen.getByRole("button", { name: /^Regenerate$/ })).toBeInTheDocument();
    });
  });

  it("Queues a second Generate while the first is streaming", async () => {
    let resolveFirst: () => void = () => {};
    const firstStream = new Promise<void>((r) => {
      resolveFirst = r;
    });
    let callCount = 0;
    const { store } = setupComposer({
      scenes: [{ id: "a" }, { id: "b" }],
      onGenerateImpl: async (sceneId: string) => {
        callCount++;
        store.addChunk(makeChunk(sceneId, `text-${sceneId}`));
        if (callCount === 1) await firstStream;
      },
    });

    const generateBtns = screen.getAllByRole("button", { name: /^Generate$/ });
    await fireEvent.click(generateBtns[0]!);
    await tick();
    await Promise.resolve();
    await fireEvent.click(generateBtns[1]!);
    await tick();

    // Second section should now be queued (Cancel visible)
    await waitFor(() => {
      expect(screen.getByText(/Queued/i)).toBeInTheDocument();
    });

    resolveFirst();
    await waitFor(() => {
      // After first finishes, second drains and eventually both show Regenerate
      const regens = screen.getAllByRole("button", { name: /^Regenerate$/ });
      expect(regens.length).toBe(2);
    });
  });

  it("Cancel on a queued section removes it from the queue and resets state", async () => {
    let resolveFirst: () => void = () => {};
    const firstStream = new Promise<void>((r) => {
      resolveFirst = r;
    });
    let callCount = 0;
    const { store, onGenerate } = setupComposer({
      scenes: [{ id: "a" }, { id: "b" }],
      onGenerateImpl: async (sceneId: string) => {
        callCount++;
        store.addChunk(makeChunk(sceneId, `t-${sceneId}`));
        if (callCount === 1) await firstStream;
      },
    });

    const generateBtns = screen.getAllByRole("button", { name: /^Generate$/ });
    await fireEvent.click(generateBtns[0]!);
    await tick();
    await Promise.resolve();
    await fireEvent.click(generateBtns[1]!);
    await tick();

    await waitFor(() => screen.getByText(/Queued/i));

    // The queued section's Cancel button is visible.
    const cancelBtns = screen.getAllByRole("button", { name: /^Cancel$/ });
    // First is streaming, second is queued — both have Cancel visible.
    // Click the queued one (second).
    await fireEvent.click(cancelBtns[1]!);

    // Queued indicator disappears
    await waitFor(() => {
      expect(screen.queryByText(/Queued/i)).not.toBeInTheDocument();
    });

    // onGenerate was only called once — the queued one was cancelled before dispatch
    resolveFirst();
    await new Promise((r) => setTimeout(r, 10));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});

// ─── Regenerate / revert ───────────────────────────────────

describe("EssayComposer regenerate + revert", () => {
  it("Regenerate captures priorText and Revert restores it", async () => {
    const { store, commands } = setupComposer({
      scenes: [{ id: "s1", chunks: [{ text: "PRIOR" }] }],
      onGenerateImpl: async (sceneId: string) => {
        // Simulate generation appending a new chunk
        store.addChunk(makeChunk(sceneId, "NEW"));
      },
    });

    // Ensure removeChunk actually removes from store so isRevertable reflects state
    commands.removeChunk.mockImplementation(async (sceneId: string, index: number) => {
      store.removeChunkForScene(sceneId, index);
      return { ok: true, value: undefined };
    });
    commands.updateChunk.mockImplementation(async (sceneId: string, index: number, changes) => {
      store.updateChunkForScene(sceneId, index, changes);
      return { ok: true, value: undefined };
    });

    // Initial state: cold-load effect promotes section with chunks to
    // idle-populated → Regenerate visible. findByRole waits for the effect.
    const regenerateBtn = await screen.findByRole("button", { name: /^Regenerate$/ });
    expect(regenerateBtn).toBeInTheDocument();

    await fireEvent.click(regenerateBtn);
    await tick();
    await Promise.resolve();

    // After regen, revert button should appear
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Revert$/ })).toBeInTheDocument();
    });

    // Click Revert — should call updateChunk with the prior text
    await fireEvent.click(screen.getByRole("button", { name: /^Revert$/ }));

    await waitFor(() => {
      expect(commands.updateChunk).toHaveBeenCalledWith("s1", 0, expect.objectContaining({ editedText: "PRIOR" }));
    });

    // Revert button should disappear after revert
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^Revert$/ })).not.toBeInTheDocument();
    });
  });

  it("Revert window expires after 60 seconds", async () => {
    vi.useFakeTimers();
    const { store, commands } = setupComposer({
      scenes: [{ id: "s1", chunks: [{ text: "PRIOR" }] }],
      onGenerateImpl: async (sceneId: string) => {
        store.addChunk(makeChunk(sceneId, "NEW"));
      },
    });
    commands.removeChunk.mockImplementation(async (sceneId: string, index: number) => {
      store.removeChunkForScene(sceneId, index);
      return { ok: true, value: undefined };
    });

    const regenBtn = await screen.findByRole("button", { name: /^Regenerate$/ });
    await fireEvent.click(regenBtn);

    // Allow microtasks + tick() to drain
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);

    // Revert button should be visible
    expect(screen.getByRole("button", { name: /^Revert$/ })).toBeInTheDocument();

    // Advance past 60s
    await vi.advanceTimersByTimeAsync(60_001);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^Revert$/ })).not.toBeInTheDocument();
    });
  });
});

// ─── Edit clears revert ────────────────────────────────────

describe("EssayComposer edit clears revert", () => {
  it("editing a revertable section clears the revert slot", async () => {
    vi.useFakeTimers();
    const { store, commands } = setupComposer({
      scenes: [{ id: "s1", chunks: [{ text: "PRIOR" }] }],
      onGenerateImpl: async (sceneId: string) => {
        store.addChunk(makeChunk(sceneId, "NEW"));
      },
    });
    commands.removeChunk.mockImplementation(async (sceneId: string, index: number) => {
      store.removeChunkForScene(sceneId, index);
      return { ok: true, value: undefined };
    });

    const regenBtnX = await screen.findByRole("button", { name: /^Regenerate$/ });
    await fireEvent.click(regenBtnX);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByRole("button", { name: /^Revert$/ })).toBeInTheDocument();

    // Trigger an edit via the AnnotatedEditor stub
    const { fireStubTextChange } = await import("./annotatedEditorStubState.js");
    fireStubTextChange("user edit");
    await vi.advanceTimersByTimeAsync(0);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^Revert$/ })).not.toBeInTheDocument();
    });
  });
});

// ─── Cold-load recovery ────────────────────────────────────

describe("EssayComposer cold-load recovery", () => {
  it("transitions sections with pending chunks to failed/aborted", async () => {
    setupComposer({
      scenes: [{ id: "s1", chunks: [{ text: "interrupted", status: "pending" }] }],
    });

    // Cold-load $effect runs after mount; ErrorBanner renders the message
    // inside an alert. Use findByText with timeout for retry.
    const banner = await screen.findByText(/Last generation was interrupted/i);
    expect(banner).toBeInTheDocument();
  });
});

// ─── Re-audit on kill list edit ────────────────────────────

describe("EssayComposer kill-list re-audit", () => {
  it("debounced re-audit fires runAudit for idle-populated sections", async () => {
    vi.useFakeTimers();
    const { commands } = setupComposer({
      scenes: [
        { id: "s1", chunks: [{ text: "section one prose" }] },
        { id: "s2" }, // empty — should NOT be re-audited
      ],
    });

    // Wait for cold-load $effect to mark s1 as idle-populated
    await vi.advanceTimersByTimeAsync(0);

    // Trigger handleBibleChange via SetupPanel save by editing thesis
    const thesisTextarea = screen
      .getByText("Thesis")
      .closest(".form-field")
      ?.querySelector("textarea") as HTMLTextAreaElement;
    expect(thesisTextarea).toBeTruthy();
    await fireEvent.input(thesisTextarea, { target: { value: "new thesis" } });
    await fireEvent.focusOut(thesisTextarea);

    // saveBible fires onBibleChange synchronously after the awaited save
    await vi.advanceTimersByTimeAsync(0);
    expect(commands.saveBible).toHaveBeenCalled();

    // Advance the 300ms debounce
    runAuditMock.mockClear();
    await vi.advanceTimersByTimeAsync(310);

    // s1 has chunks → should be audited. s2 has none → skipped.
    expect(runAuditMock).toHaveBeenCalled();
    const auditedScenes = runAuditMock.mock.calls.map((c) => c[2]);
    expect(auditedScenes).toContain("s1");
    expect(auditedScenes).not.toContain("s2");

    // Flags batched into a single saveAuditFlags call
    expect(commands.saveAuditFlags).toHaveBeenCalled();
  });
});

// ─── Voice nudge ───────────────────────────────────────────

describe("EssayComposer voice nudge", () => {
  it("shows the voice nudge banner on first Generate when voiceGuide is empty", async () => {
    const { store } = setupComposer({
      scenes: [{ id: "s1" }],
      voiceRing1: "",
      onGenerateImpl: async (sceneId: string) => {
        store.addChunk(makeChunk(sceneId, "out"));
      },
    });

    expect(screen.queryByTestId("voice-nudge-banner")).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /^Generate$/ }));

    expect(screen.getByTestId("voice-nudge-banner")).toBeInTheDocument();
  });

  it("does NOT show again after dismissal in same session", async () => {
    const { store } = setupComposer({
      scenes: [{ id: "s1" }, { id: "s2" }],
      voiceRing1: "",
      onGenerateImpl: async (sceneId: string) => {
        store.addChunk(makeChunk(sceneId, "out"));
      },
    });

    const generateBtns = screen.getAllByRole("button", { name: /^Generate$/ });
    await fireEvent.click(generateBtns[0]!);
    expect(screen.getByTestId("voice-nudge-banner")).toBeInTheDocument();

    // Dismiss
    await fireEvent.click(screen.getByRole("button", { name: /Skip for now/i }));
    expect(screen.queryByTestId("voice-nudge-banner")).not.toBeInTheDocument();

    // Drain the first generation
    await tick();
    await Promise.resolve();
    await Promise.resolve();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /^Regenerate$/ }).length).toBe(1);
    });

    // Click Generate on the remaining section
    const remainingGenerate = screen.getByRole("button", { name: /^Generate$/ });
    await fireEvent.click(remainingGenerate);

    expect(screen.queryByTestId("voice-nudge-banner")).not.toBeInTheDocument();
  });
});

// ─── Add / Delete / Reorder ────────────────────────────────

describe("EssayComposer section management", () => {
  it("Add Section calls saveScenePlan with non-empty failureModeToAvoid", async () => {
    const { commands } = setupComposer();
    await fireEvent.click(screen.getByTestId("add-section-btn"));
    expect(commands.saveScenePlan).toHaveBeenCalled();
    const callArg = commands.saveScenePlan.mock.calls[0]?.[0] as ScenePlan;
    expect(callArg.failureModeToAvoid.length).toBeGreaterThan(0);
  });

  it("Delete Section opens confirmation modal then calls removeScenePlan", async () => {
    const { commands } = setupComposer({
      scenes: [{ id: "s1", chunks: [{ text: "x" }] }],
    });

    // Click Delete on the section card
    const deleteBtns = screen.getAllByRole("button", { name: /^Delete$/ });
    // first Delete is the section delete
    await fireEvent.click(deleteBtns[0]!);

    // Modal appears
    const confirmBtn = await screen.findByTestId("confirm-delete-btn");
    await fireEvent.click(confirmBtn);

    expect(commands.removeScenePlan).toHaveBeenCalledWith("s1");
  });

  it("Move up calls reorderScenePlans with the new order", async () => {
    const { commands } = setupComposer({
      scenes: [{ id: "a" }, { id: "b" }, { id: "c" }],
    });

    // Click Move up on second card (index 1)
    const moveUpBtns = screen.getAllByRole("button", { name: /move up/i });
    await fireEvent.click(moveUpBtns[1]!);

    expect(commands.reorderScenePlans).toHaveBeenCalled();
    const args = commands.reorderScenePlans.mock.calls[0];
    const orderedIds = args?.[1] as string[];
    expect(orderedIds[0]).toBe("b");
    expect(orderedIds[1]).toBe("a");
    expect(orderedIds[2]).toBe("c");
  });
});
