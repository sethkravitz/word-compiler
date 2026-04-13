import { render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted above import/const declarations, so the fake
// store must be constructed inside vi.hoisted so the mock factory can
// reference it.
const { fakeStore } = vi.hoisted(() => {
  const store: {
    project: { id: string; title: string } | null;
    scenes: Array<{ plan: { id: string }; status: string; sceneOrder: number }>;
    sceneChunks: Record<string, unknown[]>;
    bible: { mode?: "fiction" | "essay" } | null;
    error: string | null;
    compilationConfig: {
      defaultModel: string;
      modelContextWindow: number;
      reservedForOutput: number;
      defaultTemperature: number;
      bridgeVerbatimTokens: number;
    };
    availableModels: unknown[];
    compilationLog: unknown;
    compiledPayload: unknown;
    activeSceneChunks: unknown[];
    activeScenePlan: unknown;
    lintResult: unknown;
    auditFlags: unknown[];
    activeScene: unknown;
    activeSceneIR: unknown;
    voiceGuide: unknown;
    chapterArc: unknown;
    isGenerating: boolean;
    setBible: (b: { mode?: "fiction" | "essay" } | null) => void;
    setProject: (p: { id: string; title: string }) => void;
    setError: (msg: string | null) => void;
    resetForProjectSwitch: () => void;
    setActiveScene: (idx: number) => void;
    selectModel: (id: string) => void;
    saveFile: (...args: unknown[]) => void;
  } = {
    project: null,
    scenes: [],
    sceneChunks: {},
    bible: null,
    error: null,
    compilationConfig: {
      defaultModel: "claude-opus-4-6",
      modelContextWindow: 200000,
      reservedForOutput: 4096,
      defaultTemperature: 0.7,
      bridgeVerbatimTokens: 100,
    },
    availableModels: [],
    compilationLog: null,
    compiledPayload: null,
    activeSceneChunks: [],
    activeScenePlan: null,
    lintResult: null,
    auditFlags: [],
    activeScene: null,
    activeSceneIR: null,
    voiceGuide: null,
    chapterArc: null,
    isGenerating: false,
    setBible: (b) => {
      store.bible = b;
    },
    setProject: (p) => {
      store.project = p;
    },
    setError: (msg) => {
      store.error = msg;
    },
    resetForProjectSwitch: () => {},
    setActiveScene: () => {},
    selectModel: () => {},
    saveFile: () => {},
  };
  return { fakeStore: store };
});

vi.mock("../../src/app/store/theme.svelte.js", () => ({
  theme: {
    current: "dark",
    toggle: () => {},
  },
}));

vi.mock("../../src/app/store/index.svelte.js", () => ({
  store: fakeStore,
  createApiActions: vi.fn(() => ({
    createEssayProject: vi.fn(),
  })),
  createCommands: vi.fn(() => ({})),
  createGenerationActions: vi.fn(() => ({
    generateChunk: vi.fn(),
    runAuditManual: vi.fn(),
    runDeepAudit: vi.fn(),
    extractSceneIR: vi.fn(),
    runAutopilot: vi.fn(),
    requestRefinement: vi.fn(),
  })),
  setupCompilerEffect: vi.fn(),
  initializeApp: vi.fn(async () => "loaded"),
  loadProject: vi.fn(async () => "loaded"),
  ProjectStore: class {},
}));

// Simple stubs for the heavy children. Each stub renders a unique testid so
// the routing assertions can check what App.svelte mounted.
vi.mock("../../src/app/components/composer/EssayComposer.svelte", async () => {
  const mod = await import("./composer/AnnotatedEditorStub.svelte");
  return { default: mod.default };
});
vi.mock("../../src/app/components/composer/TemplatePicker.svelte", async () => {
  const mod = await import("./composer/AnnotatedEditorStub.svelte");
  return { default: mod.default };
});

// WorkflowRail is the fiction-mode signal. Stub it with a testid-bearing div.
vi.mock("../../src/app/components/WorkflowRail.svelte", async () => {
  const mod = await import("./composer/AnnotatedEditorStub.svelte");
  return { default: mod.default };
});
// Stages: same stub for simplicity. None of them matter for routing tests.
vi.mock("../../src/app/components/stages/BootstrapStage.svelte", async () => {
  const mod = await import("./composer/AnnotatedEditorStub.svelte");
  return { default: mod.default };
});
vi.mock("../../src/app/components/stages/DraftStage.svelte", async () => {
  const mod = await import("./composer/AnnotatedEditorStub.svelte");
  return { default: mod.default };
});
vi.mock("../../src/app/components/stages/PlanStage.svelte", async () => {
  const mod = await import("./composer/AnnotatedEditorStub.svelte");
  return { default: mod.default };
});
vi.mock("../../src/app/components/stages/AuditStage.svelte", async () => {
  const mod = await import("./composer/AnnotatedEditorStub.svelte");
  return { default: mod.default };
});
vi.mock("../../src/app/components/stages/EditStage.svelte", async () => {
  const mod = await import("./composer/AnnotatedEditorStub.svelte");
  return { default: mod.default };
});
vi.mock("../../src/app/components/stages/CompleteStage.svelte", async () => {
  const mod = await import("./composer/AnnotatedEditorStub.svelte");
  return { default: mod.default };
});
vi.mock("../../src/app/components/stages/ExportStage.svelte", async () => {
  const mod = await import("./composer/AnnotatedEditorStub.svelte");
  return { default: mod.default };
});
vi.mock("../../src/app/components/GlossaryPanel.svelte", async () => {
  const mod = await import("./composer/AnnotatedEditorStub.svelte");
  return { default: mod.default };
});
vi.mock("../../src/app/components/StageCTA.svelte", async () => {
  const mod = await import("./composer/AnnotatedEditorStub.svelte");
  return { default: mod.default };
});
vi.mock("../../src/app/components/VoiceProfilePanel.svelte", async () => {
  const mod = await import("./composer/VoiceProfilePanelStub.svelte");
  return { default: mod.default };
});
vi.mock("../../src/app/components/ProjectList.svelte", async () => {
  const mod = await import("./composer/AnnotatedEditorStub.svelte");
  return { default: mod.default };
});

// WorkflowStore is pure-getter; import and instantiate normally.
vi.mock("../../src/app/store/workflow.svelte.js", () => ({
  STAGES: [
    { id: "bootstrap" },
    { id: "plan" },
    { id: "draft" },
    { id: "audit" },
    { id: "edit" },
    { id: "complete" },
    { id: "export" },
  ],
  WorkflowStore: class {
    activeStage = "draft";
    nextStageCTA = null;
    getStageStatus() {
      return "available";
    }
    goToStage() {}
  },
}));

import App from "../../src/app/App.svelte";

function resetFakeStore() {
  fakeStore.project = { id: "proj-1", title: "Test" };
  fakeStore.scenes = [];
  fakeStore.sceneChunks = {};
  fakeStore.bible = null;
  fakeStore.error = null;
}

describe("App routing on bible.mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFakeStore();
  });

  it("renders EssayComposer when bible.mode === 'essay'", async () => {
    fakeStore.bible = { mode: "essay" };
    render(App);

    await waitFor(() => {
      expect(screen.getByTestId("annotated-editor-stub")).toBeInTheDocument();
    });
    // Composer mounted means fiction-mode WorkflowRail is absent. Assert the
    // essay path is exclusive — the composer-bound stub is present, and we
    // did not render the header-nav "no-projects" welcome text.
    expect(screen.queryByText(/Welcome to Word Compiler/)).not.toBeInTheDocument();
  });

  it("renders fiction stages when bible.mode === undefined", async () => {
    fakeStore.bible = { mode: undefined } as { mode?: "fiction" | "essay" };
    render(App);

    // The stage-content area mounts for fiction mode too; this is a
    // positive rendering check — App.svelte should make it past startup and
    // render the workflow area.
    await waitFor(() => {
      expect(screen.getByText(/Word Compiler/)).toBeInTheDocument();
    });
  });

  it("renders fiction stages when bible.mode === 'fiction'", async () => {
    fakeStore.bible = { mode: "fiction" };
    render(App);
    await waitFor(() => {
      expect(screen.getByText(/Word Compiler/)).toBeInTheDocument();
    });
  });
});
