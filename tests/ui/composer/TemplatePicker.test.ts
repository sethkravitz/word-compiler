import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TemplatePicker from "../../../src/app/components/composer/TemplatePicker.svelte";
import type { ApiActions } from "../../../src/app/store/api-actions.js";
import { checkScenePlanGate } from "../../../src/gates/index.js";
import type { Bible, Project, ScenePlan } from "../../../src/types/index.js";

// Mock the LLM client so the bootstrap path never touches the network.
vi.mock("../../../src/llm/client.js", () => ({
  generateStream: vi.fn(),
}));

import { generateStream } from "../../../src/llm/client.js";

function makeMockActions(overrides: Partial<ApiActions> = {}): ApiActions {
  return {
    saveBible: vi.fn().mockResolvedValue(undefined),
    saveScenePlan: vi.fn().mockResolvedValue(undefined),
    updateScenePlan: vi.fn().mockResolvedValue(undefined),
    deleteScenePlan: vi.fn().mockResolvedValue(undefined),
    reorderScenePlans: vi.fn().mockResolvedValue(undefined),
    saveMultipleScenePlans: vi.fn().mockResolvedValue(undefined),
    saveChapterArc: vi.fn().mockResolvedValue(undefined),
    updateChapterArc: vi.fn().mockResolvedValue(undefined),
    saveChunk: vi.fn().mockResolvedValue(undefined),
    updateChunk: vi.fn().mockResolvedValue(undefined),
    deleteChunk: vi.fn().mockResolvedValue(undefined),
    completeScene: vi.fn().mockResolvedValue(undefined),
    saveSceneIR: vi.fn().mockResolvedValue(undefined),
    verifySceneIR: vi.fn().mockResolvedValue(undefined),
    saveAuditFlags: vi.fn().mockResolvedValue(undefined),
    resolveAuditFlag: vi.fn().mockResolvedValue(undefined),
    dismissAuditFlag: vi.fn().mockResolvedValue(undefined),
    saveCompilationLog: vi.fn().mockResolvedValue(undefined),
    createEssayProject: vi.fn().mockResolvedValue({
      project: { id: "proj-new", title: "Opinion Piece", status: "drafting", createdAt: "", updatedAt: "" } as Project,
      chapterArc: { id: "ch-1" } as unknown as never,
      scenePlans: [] as ScenePlan[],
    }),
    ...overrides,
  } as ApiActions;
}

// Drive the streamed response the LLM client would normally produce. The
// first parseBootstrapResponse fall-through path (tryDirectParse) handles
// plain JSON, so we hand it back as-is.
function makeStreamImpl(responseJson: string) {
  return async (
    _payload: unknown,
    handlers: {
      onToken: (t: string) => void;
      onDone: (usage: { input_tokens: number; output_tokens: number }, stopReason: string) => void;
      onError: (e: string) => void;
    },
  ) => {
    // Chunk the payload so the stream display has something to show.
    const half = Math.floor(responseJson.length / 2);
    handlers.onToken(responseJson.slice(0, half));
    handlers.onToken(responseJson.slice(half));
    handlers.onDone({ input_tokens: 0, output_tokens: 0 }, "end_turn");
  };
}

const VALID_BOOTSTRAP_RESPONSE = JSON.stringify({
  thesis: "Productivity advice fails knowledge workers.",
  sections: [
    {
      heading: "The setup",
      purpose: "Introduce the personal anecdote.",
      keyPoints: ["The tired advice pattern", "Why it feels off"],
    },
    {
      heading: "The counterexamples",
      purpose: "Show three cases where the advice breaks.",
      keyPoints: ["Case one", "Case two", "Case three"],
    },
    {
      heading: "The reframe",
      purpose: "Offer a sharper definition.",
      keyPoints: ["New framing", "What it protects"],
    },
  ],
  suggestedTone: {
    register: "conversational",
    audience: "knowledge workers",
    pacingNotes: "slow build, hard landing",
  },
  suggestedKillList: ["delve", "leverage"],
  structuralBans: ["Never open with a question"],
});

describe("TemplatePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders both essay templates", () => {
    render(TemplatePicker, {
      open: true,
      actions: makeMockActions(),
      onProjectCreated: vi.fn(),
      onCancel: vi.fn(),
    });

    expect(screen.getByTestId("template-card-opinion-piece")).toBeInTheDocument();
    expect(screen.getByTestId("template-card-personal-essay")).toBeInTheDocument();
  });

  it("clicking a template highlights it and enables Bootstrap when brief is non-empty", async () => {
    render(TemplatePicker, {
      open: true,
      actions: makeMockActions(),
      onProjectCreated: vi.fn(),
      onCancel: vi.fn(),
    });

    const card = screen.getByTestId("template-card-opinion-piece");
    expect(card.getAttribute("aria-pressed")).toBe("false");

    await fireEvent.click(card);
    expect(card.getAttribute("aria-pressed")).toBe("true");

    const bootstrapBtn = screen.getByRole("button", { name: /^Bootstrap$/ });
    expect(bootstrapBtn).toBeDisabled();

    const textarea = screen.getByRole("textbox");
    await fireEvent.input(textarea, { target: { value: "A short brief about productivity advice." } });

    expect(screen.getByRole("button", { name: /^Bootstrap$/ })).toBeEnabled();
  });

  it("Bootstrap success streams the LLM response and calls createEssayProject with materialized inputs", async () => {
    vi.mocked(generateStream).mockImplementation(
      makeStreamImpl(VALID_BOOTSTRAP_RESPONSE) as unknown as typeof generateStream,
    );

    const createEssayProject = vi.fn().mockResolvedValue({
      project: { id: "proj-created", title: "Opinion Piece", status: "drafting", createdAt: "", updatedAt: "" },
      chapterArc: { id: "ch-1" },
      scenePlans: [],
    });
    const onProjectCreated = vi.fn();

    render(TemplatePicker, {
      open: true,
      actions: makeMockActions({ createEssayProject }),
      onProjectCreated,
      onCancel: vi.fn(),
    });

    await fireEvent.click(screen.getByTestId("template-card-opinion-piece"));
    await fireEvent.input(screen.getByRole("textbox"), {
      target: { value: "A brief about how productivity advice fails knowledge workers." },
    });
    await fireEvent.click(screen.getByRole("button", { name: /^Bootstrap$/ }));

    await waitFor(() => {
      expect(createEssayProject).toHaveBeenCalledTimes(1);
    });

    const [project, bible, scenePlans] = createEssayProject.mock.calls[0] as [Project, Bible, ScenePlan[]];
    // Project shell
    expect(project.id).toBeTruthy();
    expect(project.title).toBe("Opinion Piece");
    // Bible seeded with essay mode
    expect(bible.mode).toBe("essay");
    // 3 sections from the mocked response
    expect(scenePlans).toHaveLength(3);
    // Every plan passes the scene plan gate (R12 contract)
    for (const plan of scenePlans) {
      const gate = checkScenePlanGate(plan);
      expect(gate.passed).toBe(true);
    }

    await waitFor(() => {
      expect(onProjectCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "proj-created" }));
    });
  });

  it("Bootstrap failure surfaces an error and preserves the brief text", async () => {
    vi.mocked(generateStream).mockImplementation(
      makeStreamImpl(VALID_BOOTSTRAP_RESPONSE) as unknown as typeof generateStream,
    );

    const createEssayProject = vi.fn().mockRejectedValue(new Error("network unreachable"));
    const onProjectCreated = vi.fn();

    render(TemplatePicker, {
      open: true,
      actions: makeMockActions({ createEssayProject }),
      onProjectCreated,
      onCancel: vi.fn(),
    });

    await fireEvent.click(screen.getByTestId("template-card-opinion-piece"));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    const briefText = "A brief the user does not want to retype.";
    await fireEvent.input(textarea, { target: { value: briefText } });
    await fireEvent.click(screen.getByRole("button", { name: /^Bootstrap$/ }));

    await waitFor(() => {
      expect(screen.getByTestId("template-picker-error")).toBeInTheDocument();
    });
    expect(screen.getByText(/network unreachable/)).toBeInTheDocument();
    expect(onProjectCreated).not.toHaveBeenCalled();
    // Brief text survives the failure so the user can retry.
    const preservedTextarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(preservedTextarea.value).toBe(briefText);
  });

  it("Bootstrap with a parse-failure response surfaces the error without calling createEssayProject", async () => {
    vi.mocked(generateStream).mockImplementation(
      makeStreamImpl("not a json response at all") as unknown as typeof generateStream,
    );

    const createEssayProject = vi.fn();
    render(TemplatePicker, {
      open: true,
      actions: makeMockActions({ createEssayProject }),
      onProjectCreated: vi.fn(),
      onCancel: vi.fn(),
    });

    await fireEvent.click(screen.getByTestId("template-card-opinion-piece"));
    await fireEvent.input(screen.getByRole("textbox"), { target: { value: "Any brief." } });
    await fireEvent.click(screen.getByRole("button", { name: /^Bootstrap$/ }));

    await waitFor(() => {
      expect(screen.getByTestId("template-picker-error")).toBeInTheDocument();
    });
    expect(screen.getByText(/Parse failed/)).toBeInTheDocument();
    expect(createEssayProject).not.toHaveBeenCalled();
  });

  it("Skip-blank creates a project with a single placeholder scene plan passing the gate", async () => {
    const createEssayProject = vi.fn().mockResolvedValue({
      project: { id: "proj-blank", title: "Personal Essay", status: "drafting", createdAt: "", updatedAt: "" },
      chapterArc: { id: "ch-1" },
      scenePlans: [],
    });
    const onProjectCreated = vi.fn();

    render(TemplatePicker, {
      open: true,
      actions: makeMockActions({ createEssayProject }),
      onProjectCreated,
      onCancel: vi.fn(),
    });

    await fireEvent.click(screen.getByTestId("template-card-personal-essay"));
    await fireEvent.click(screen.getByTestId("skip-blank-btn"));

    await waitFor(() => {
      expect(createEssayProject).toHaveBeenCalledTimes(1);
    });

    const [, bible, scenePlans] = createEssayProject.mock.calls[0] as [Project, Bible, ScenePlan[]];
    expect(bible.mode).toBe("essay");
    expect(scenePlans).toHaveLength(1);
    const gate = checkScenePlanGate(scenePlans[0] as ScenePlan);
    expect(gate.passed).toBe(true);

    await waitFor(() => {
      expect(onProjectCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "proj-blank" }));
    });
  });

  it("Skip-blank is disabled until a template is selected", () => {
    render(TemplatePicker, {
      open: true,
      actions: makeMockActions(),
      onProjectCreated: vi.fn(),
      onCancel: vi.fn(),
    });
    expect(screen.getByTestId("skip-blank-btn")).toBeDisabled();
  });

  it("Cancel button fires onCancel without calling any actions", async () => {
    const onCancel = vi.fn();
    const actions = makeMockActions();

    render(TemplatePicker, {
      open: true,
      actions,
      onProjectCreated: vi.fn(),
      onCancel,
    });

    await fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(actions.createEssayProject).not.toHaveBeenCalled();
  });
});
