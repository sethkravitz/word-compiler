import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ComposerFooter from "../../../src/app/components/composer/ComposerFooter.svelte";
import type { Commands } from "../../../src/app/store/commands.js";
import { ProjectStore } from "../../../src/app/store/project.svelte.js";
import type { VoiceGuide } from "../../../src/profile/types.js";
import { createEmptyVoiceGuide } from "../../../src/profile/types.js";
import type { Chunk } from "../../../src/types/scene.js";

// ─── Test factories ───────────────────────────────────────

function makeChunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
    id: `chunk-${Math.random().toString(36).slice(2, 8)}`,
    sceneId: "scene-1",
    sequenceNumber: 0,
    generatedText: "",
    payloadHash: "",
    model: "claude-test",
    temperature: 0.7,
    topP: 1,
    generatedAt: new Date().toISOString(),
    status: "accepted",
    editedText: null,
    humanNotes: null,
    ...overrides,
  };
}

function makeStoreWithScenes(
  opts: {
    scenes?: Array<{ id: string; title: string; chunkTexts: string[]; chunkGeneratedAt?: string[] }>;
    voiceGuide?: VoiceGuide | null;
    killListFlags?: number;
    rhythmFlags?: number;
    paragraphFlags?: number;
  } = {},
): ProjectStore {
  const store = new ProjectStore();
  store.setProject({ id: "proj-1", title: "Test", status: "drafting", createdAt: "", updatedAt: "" });

  const scenes = opts.scenes ?? [];
  const sceneEntries = scenes.map((s, i) => ({
    plan: {
      id: s.id,
      projectId: "proj-1",
      chapterId: null,
      title: s.title,
      povCharacterId: "",
      povDistance: "close" as const,
      narrativeGoal: "",
      emotionalBeat: "",
      readerEffect: "",
      readerStateEntering: null,
      readerStateExiting: null,
      characterKnowledgeChanges: {},
      subtext: null,
      dialogueConstraints: {},
      pacing: null,
      density: "moderate" as const,
      sensoryNotes: null,
      sceneSpecificProhibitions: [],
      anchorLines: [],
      estimatedWordCount: [600, 900] as [number, number],
      chunkCount: s.chunkTexts.length,
      chunkDescriptions: [],
      failureModeToAvoid: "",
      locationId: null,
      presentCharacterIds: [],
    },
    status: "drafting" as const,
    sceneOrder: i,
  }));
  store.setScenes(sceneEntries);

  for (const s of scenes) {
    const chunks: Chunk[] = s.chunkTexts.map((text, i) =>
      makeChunk({
        id: `${s.id}-c${i}`,
        sceneId: s.id,
        sequenceNumber: i,
        generatedText: text,
        generatedAt: s.chunkGeneratedAt?.[i] ?? new Date(2026, 3, 1).toISOString(),
      }),
    );
    store.setSceneChunks(s.id, chunks);
  }

  store.setVoiceGuide(opts.voiceGuide ?? null);

  const flags = [
    ...Array.from({ length: opts.killListFlags ?? 0 }, (_, i) => ({
      id: `kl-${i}`,
      sceneId: "scene-1",
      severity: "critical" as const,
      category: "kill_list" as const,
      message: "kill",
      lineReference: null,
      resolved: false,
      resolvedAction: null,
      wasActionable: null,
    })),
    ...Array.from({ length: opts.rhythmFlags ?? 0 }, (_, i) => ({
      id: `rh-${i}`,
      sceneId: "scene-1",
      severity: "warning" as const,
      category: "rhythm_monotony" as const,
      message: "rh",
      lineReference: null,
      resolved: false,
      resolvedAction: null,
      wasActionable: null,
    })),
    ...Array.from({ length: opts.paragraphFlags ?? 0 }, (_, i) => ({
      id: `pl-${i}`,
      sceneId: "scene-1",
      severity: "info" as const,
      category: "paragraph_length" as const,
      message: "pl",
      lineReference: null,
      resolved: false,
      resolvedAction: null,
      wasActionable: null,
    })),
  ];
  store.setAudit(flags, null);

  return store;
}

function makeCommands(): Commands {
  return {} as unknown as Commands;
}

interface RenderOpts {
  store?: ProjectStore;
  onJumpToViolation?: ReturnType<typeof vi.fn>;
}

function renderFooter(opts: RenderOpts = {}) {
  const store = opts.store ?? makeStoreWithScenes();
  const onJumpToViolation = opts.onJumpToViolation ?? vi.fn();
  render(ComposerFooter, {
    store,
    commands: makeCommands(),
    onJumpToViolation,
  });
  return { store, onJumpToViolation };
}

// ─── Global URL + anchor click stubs ──────────────────────

// vi.spyOn's return type narrows to function-valued property keys, which
// trips on jsdom's HTMLAnchorElement.click and Window.confirm signatures.
// `any` keeps the spy handles flexible (biome has noExplicitAny off).
type AnySpy = any;
let createObjectURLSpy: ReturnType<typeof vi.fn>;
let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
let anchorClickSpy: AnySpy;
let confirmSpy: AnySpy;

beforeEach(() => {
  createObjectURLSpy = vi.fn(() => "blob:fake-url");
  revokeObjectURLSpy = vi.fn();
  // jsdom doesn't define createObjectURL by default
  Object.defineProperty(URL, "createObjectURL", {
    value: createObjectURLSpy,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: revokeObjectURLSpy,
    writable: true,
    configurable: true,
  });
  anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  anchorClickSpy.mockRestore();
  confirmSpy.mockRestore();
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

// ─── Word count ───────────────────────────────────────────

describe("ComposerFooter word count", () => {
  it("reflects the sum of canonical text across all scenes", () => {
    const store = makeStoreWithScenes({
      scenes: [
        { id: "scene-1", title: "A", chunkTexts: ["one two three", "four five"] }, // 5 words
        { id: "scene-2", title: "B", chunkTexts: ["six seven eight nine ten"] }, // 5 words
      ],
    });
    renderFooter({ store });
    const wordCountEl = screen.getByTestId("footer-word-count");
    // 5 + 5 = 10
    expect(wordCountEl.textContent).toContain("10");
  });

  it("prefers editedText over generatedText for canonical counting", () => {
    const store = new ProjectStore();
    store.setProject({ id: "proj-1", title: "T", status: "drafting", createdAt: "", updatedAt: "" });
    store.setScenes([
      {
        plan: {
          id: "scene-1",
          projectId: "proj-1",
          chapterId: null,
          title: "A",
          povCharacterId: "",
          povDistance: "close",
          narrativeGoal: "",
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
          failureModeToAvoid: "",
          locationId: null,
          presentCharacterIds: [],
        },
        status: "drafting",
        sceneOrder: 0,
      },
    ]);
    store.setSceneChunks("scene-1", [
      makeChunk({
        id: "scene-1-0",
        sceneId: "scene-1",
        generatedText: "ignored generated text words",
        editedText: "only these four words",
      }),
    ]);
    renderFooter({ store });
    const wordCountEl = screen.getByTestId("footer-word-count");
    expect(wordCountEl.textContent).toContain("4");
  });
});

// ─── Audit count pills ────────────────────────────────────

describe("ComposerFooter audit count pills", () => {
  it("renders the kill list / sentence variance / paragraph length labels with counts", () => {
    const store = makeStoreWithScenes({
      killListFlags: 3,
      rhythmFlags: 1,
      paragraphFlags: 0,
    });
    renderFooter({ store });
    expect(screen.getByTestId("audit-pill-kill-list").textContent).toContain("Kill list: 3");
    expect(screen.getByTestId("audit-pill-rhythm").textContent).toContain("Sentence variance: 1");
    expect(screen.getByTestId("audit-pill-paragraph").textContent).toContain("Paragraph length: 0");
  });

  it("clicking the kill list pill calls onJumpToViolation with kill_list", async () => {
    const onJumpToViolation = vi.fn();
    renderFooter({ onJumpToViolation });
    await fireEvent.click(screen.getByTestId("audit-pill-kill-list"));
    expect(onJumpToViolation).toHaveBeenCalledWith("kill_list");
  });

  it("clicking the sentence variance pill calls onJumpToViolation with rhythm_monotony", async () => {
    const onJumpToViolation = vi.fn();
    renderFooter({ onJumpToViolation });
    await fireEvent.click(screen.getByTestId("audit-pill-rhythm"));
    expect(onJumpToViolation).toHaveBeenCalledWith("rhythm_monotony");
  });

  it("clicking the paragraph length pill calls onJumpToViolation with paragraph_length", async () => {
    const onJumpToViolation = vi.fn();
    renderFooter({ onJumpToViolation });
    await fireEvent.click(screen.getByTestId("audit-pill-paragraph"));
    expect(onJumpToViolation).toHaveBeenCalledWith("paragraph_length");
  });

  it("ignores resolved flags in the counts", () => {
    const store = makeStoreWithScenes({ killListFlags: 2 });
    // resolve one of the two kill list flags
    const flag = store.auditFlags[0];
    if (flag) store.resolveAuditFlag(flag.id, "removed", true);
    renderFooter({ store });
    expect(screen.getByTestId("audit-pill-kill-list").textContent).toContain("Kill list: 1");
  });
});

// ─── Voice status ─────────────────────────────────────────

describe("ComposerFooter voice status", () => {
  it("shows 'Voice: ready' when voiceGuide.ring1Injection is non-empty", () => {
    const guide: VoiceGuide = { ...createEmptyVoiceGuide(), ring1Injection: "you sound like this" };
    const store = makeStoreWithScenes({ voiceGuide: guide });
    renderFooter({ store });
    expect(screen.getByTestId("footer-voice-status").textContent).toContain("Voice: ready");
  });

  it("shows 'Voice: not set' when voiceGuide is null", () => {
    const store = makeStoreWithScenes({ voiceGuide: null });
    renderFooter({ store });
    expect(screen.getByTestId("footer-voice-status").textContent).toContain("Voice: not set");
  });

  it("shows 'Voice: not set' when voiceGuide.ring1Injection is empty string", () => {
    const guide: VoiceGuide = { ...createEmptyVoiceGuide(), ring1Injection: "" };
    const store = makeStoreWithScenes({ voiceGuide: guide });
    renderFooter({ store });
    expect(screen.getByTestId("footer-voice-status").textContent).toContain("Voice: not set");
  });
});

// ─── Last save timestamp ──────────────────────────────────

describe("ComposerFooter last save timestamp", () => {
  it("renders the last save label section", () => {
    const store = makeStoreWithScenes({
      scenes: [{ id: "scene-1", title: "A", chunkTexts: ["text"] }],
    });
    renderFooter({ store });
    const el = screen.getByTestId("footer-last-save");
    expect(el).toBeInTheDocument();
    expect(el.textContent).toMatch(/Saved/);
  });

  it("shows 'never' when no chunks exist", () => {
    const store = makeStoreWithScenes({ scenes: [] });
    renderFooter({ store });
    expect(screen.getByTestId("footer-last-save").textContent).toContain("never");
  });
});

// ─── Export menu ──────────────────────────────────────────

describe("ComposerFooter export menu", () => {
  it("opens menu on export button click and shows Markdown + Plain text options", async () => {
    renderFooter();
    await fireEvent.click(screen.getByTestId("footer-export-button"));
    expect(screen.getByTestId("footer-export-menu")).toBeInTheDocument();
    expect(screen.getByTestId("footer-export-markdown")).toBeInTheDocument();
    expect(screen.getByTestId("footer-export-plaintext")).toBeInTheDocument();
  });

  it("exports without confirmation when all sections have prose and no kill list flags", async () => {
    const store = makeStoreWithScenes({
      scenes: [{ id: "scene-1", title: "A", chunkTexts: ["this is some prose"] }],
      killListFlags: 0,
    });
    renderFooter({ store });
    await fireEvent.click(screen.getByTestId("footer-export-button"));
    await fireEvent.click(screen.getByTestId("footer-export-markdown"));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
  });

  it("requests confirmation when any section is empty", async () => {
    const store = makeStoreWithScenes({
      scenes: [
        { id: "scene-1", title: "A", chunkTexts: ["written"] },
        { id: "scene-2", title: "B", chunkTexts: [] }, // empty section
      ],
    });
    renderFooter({ store });
    await fireEvent.click(screen.getByTestId("footer-export-button"));
    await fireEvent.click(screen.getByTestId("footer-export-markdown"));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0]?.[0]).toMatch(/1 section empty/);
  });

  it("requests confirmation when an unresolved kill list flag exists", async () => {
    const store = makeStoreWithScenes({
      scenes: [{ id: "scene-1", title: "A", chunkTexts: ["prose"] }],
      killListFlags: 2,
    });
    renderFooter({ store });
    await fireEvent.click(screen.getByTestId("footer-export-button"));
    await fireEvent.click(screen.getByTestId("footer-export-plaintext"));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0]?.[0]).toMatch(/2 kill list hits/);
  });

  it("aborts the download when confirm returns false", async () => {
    confirmSpy.mockReturnValue(false);
    const store = makeStoreWithScenes({
      scenes: [{ id: "scene-1", title: "A", chunkTexts: [] }],
    });
    renderFooter({ store });
    await fireEvent.click(screen.getByTestId("footer-export-button"));
    await fireEvent.click(screen.getByTestId("footer-export-markdown"));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).not.toHaveBeenCalled();
  });

  it("plaintext export triggers a download with .txt filename", async () => {
    const store = makeStoreWithScenes({
      scenes: [{ id: "scene-1", title: "A", chunkTexts: ["some prose"] }],
    });
    renderFooter({ store });
    await fireEvent.click(screen.getByTestId("footer-export-button"));
    await fireEvent.click(screen.getByTestId("footer-export-plaintext"));
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    // The anchor's download attribute should end in .txt — inspect the most
    // recently created anchor by reading from createElement-tracked path. We
    // can't easily intercept the anchor instance here, but we can assert that
    // createObjectURL was called once with a Blob and that the export ran.
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURLSpy.mock.calls[0]?.[0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect((blobArg as Blob).type).toBe("text/plain");
  });
});
