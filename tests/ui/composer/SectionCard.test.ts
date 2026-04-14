import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeControlMatrix, type SectionState } from "../../../src/app/components/composer/types.js";
import type { KillListEntry } from "../../../src/types/bible.js";
import type { AuditFlag } from "../../../src/types/quality.js";
import type { ScenePlan } from "../../../src/types/scene.js";
import { fireStubDismissAnnotation, fireStubTextChange, getStubProps, resetStub } from "./annotatedEditorStubState.js";

// Replace the real ProseMirror-backed editor with a lightweight stub so we
// can assert what props SectionCard hands it and trigger its callbacks.
vi.mock("../../../src/app/components/AnnotatedEditor.svelte", async () => {
  const mod = await import("./AnnotatedEditorStub.svelte");
  return { default: mod.default };
});

import SectionCard from "../../../src/app/components/composer/SectionCard.svelte";

// ─── Factories ────────────────────────────────────────────

function makeScenePlan(overrides: Partial<ScenePlan> = {}): ScenePlan {
  return {
    id: "scene-1",
    projectId: "proj-1",
    chapterId: null,
    title: "Opening",
    povCharacterId: "",
    povDistance: "close",
    narrativeGoal: "Establish the central tension",
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
    chunkDescriptions: ["Open with the anecdote"],
    failureModeToAvoid: "Generic summary without an argument",
    locationId: null,
    presentCharacterIds: [],
    ...overrides,
  };
}

function makeSceneEntry(overrides: { plan?: Partial<ScenePlan>; sceneOrder?: number } = {}) {
  return {
    plan: makeScenePlan(overrides.plan ?? {}),
    status: "planned" as const,
    sceneOrder: overrides.sceneOrder ?? 0,
  };
}

function makeKillListFlag(pattern: string, sceneId = "scene-1"): AuditFlag {
  return {
    id: `flag-${pattern}-${Math.random().toString(36).slice(2, 8)}`,
    sceneId,
    severity: "critical",
    category: "kill_list",
    message: `Avoid list violation: "${pattern}" found.`,
    lineReference: "line 1",
    resolved: false,
    resolvedAction: null,
    wasActionable: null,
  };
}

interface RenderProps {
  scene?: ReturnType<typeof makeSceneEntry>;
  text?: string;
  state?: SectionState;
  auditFlags?: AuditFlag[];
  killList?: KillListEntry[];
  directiveText?: string;
  queuePosition?: number | null;
  isFirstSection?: boolean;
  isLastSection?: boolean;
  isRevertable?: boolean;
  revertDeadline?: number | null;
  onGenerate?: (id: string) => void;
  onRegenerate?: (id: string) => void;
  onRevert?: (id: string) => void;
  onCancel?: (id: string) => void;
  onEdit?: (id: string, text: string) => void;
  onDelete?: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onUpdatePlan?: (plan: ScenePlan) => void;
  onDirectiveChange?: (id: string, text: string) => void;
  onDismissKillListPattern?: (pattern: string) => void;
  onDismissFailed?: (id: string) => void;
}

const noop = () => {};

function defaultProps() {
  return {
    scene: makeSceneEntry(),
    text: "",
    state: "idle-empty" as SectionState,
    auditFlags: [] as AuditFlag[],
    killList: [] as KillListEntry[],
    directiveText: "",
    queuePosition: null as number | null,
    isFirstSection: false,
    isLastSection: false,
    isRevertable: false,
    revertDeadline: null as number | null,
    onGenerate: noop as (id: string) => void,
    onRegenerate: noop as (id: string) => void,
    onRevert: noop as (id: string) => void,
    onCancel: noop as (id: string) => void,
    onEdit: noop as (id: string, text: string) => void,
    onDelete: noop as (id: string) => void,
    onMoveUp: noop as (id: string) => void,
    onMoveDown: noop as (id: string) => void,
    onUpdatePlan: noop as (plan: ScenePlan) => void,
    onDirectiveChange: noop as (id: string, text: string) => void,
    onDismissKillListPattern: noop as (pattern: string) => void,
    onDismissFailed: noop as (id: string) => void,
  };
}

function renderCard(props: RenderProps = {}) {
  return render(SectionCard, { ...defaultProps(), ...props });
}

beforeEach(() => {
  resetStub();
});

afterEach(() => {
  resetStub();
});

// ─── computeControlMatrix (pure) ────────────────────────────

describe("computeControlMatrix (pure)", () => {
  it("idle-empty: Generate visible+enabled, Regenerate hidden, Cancel hidden", () => {
    const m = computeControlMatrix("idle-empty", false, false, false, false);
    expect(m.generateVisible).toBe(true);
    expect(m.generateEnabled).toBe(true);
    expect(m.regenerateVisible).toBe(false);
    expect(m.cancelVisible).toBe(false);
    expect(m.revertVisible).toBe(false);
    expect(m.deleteEnabled).toBe(true);
    expect(m.reorderUpEnabled).toBe(true);
    expect(m.reorderDownEnabled).toBe(true);
    expect(m.errorBannerVisible).toBe(false);
  });

  it("idle-populated: Regenerate visible+enabled, Generate hidden", () => {
    const m = computeControlMatrix("idle-populated", false, false, false, true);
    expect(m.generateVisible).toBe(false);
    expect(m.regenerateVisible).toBe(true);
    expect(m.regenerateEnabled).toBe(true);
    expect(m.cancelVisible).toBe(false);
    expect(m.revertVisible).toBe(false);
    expect(m.editorReadonly).toBe(false);
  });

  it("idle-populated + isRevertable=true: Revert visible", () => {
    const m = computeControlMatrix("idle-populated", false, false, true, true);
    expect(m.revertVisible).toBe(true);
  });

  it("idle-populated + isRevertable=false: Revert hidden", () => {
    const m = computeControlMatrix("idle-populated", false, false, false, true);
    expect(m.revertVisible).toBe(false);
  });

  it("queued: Generate disabled, Cancel visible, reorder/delete disabled, editor readonly", () => {
    const m = computeControlMatrix("queued", false, false, false, false);
    expect(m.generateVisible).toBe(true);
    expect(m.generateEnabled).toBe(false);
    expect(m.cancelVisible).toBe(true);
    expect(m.editorReadonly).toBe(true);
    expect(m.reorderUpEnabled).toBe(false);
    expect(m.reorderDownEnabled).toBe(false);
    expect(m.deleteEnabled).toBe(false);
  });

  it("streaming: Generate/Regenerate hidden, Cancel visible, editor readonly, reorder/delete disabled", () => {
    const m = computeControlMatrix("streaming", false, false, false, true);
    expect(m.generateVisible).toBe(false);
    expect(m.regenerateVisible).toBe(false);
    expect(m.cancelVisible).toBe(true);
    expect(m.editorReadonly).toBe(true);
    expect(m.reorderUpEnabled).toBe(false);
    expect(m.reorderDownEnabled).toBe(false);
    expect(m.deleteEnabled).toBe(false);
  });

  it("failed + hasText: Regenerate visible, Generate hidden, error banner visible", () => {
    const failed: SectionState = { state: "failed", reason: "error", message: "boom" };
    const m = computeControlMatrix(failed, false, false, false, true);
    expect(m.regenerateVisible).toBe(true);
    expect(m.regenerateEnabled).toBe(true);
    expect(m.generateVisible).toBe(false);
    expect(m.errorBannerVisible).toBe(true);
  });

  it("failed + no text: Generate visible, Regenerate hidden, error banner visible", () => {
    const failed: SectionState = { state: "failed", reason: "aborted", message: "stopped" };
    const m = computeControlMatrix(failed, false, false, false, false);
    expect(m.generateVisible).toBe(true);
    expect(m.generateEnabled).toBe(true);
    expect(m.regenerateVisible).toBe(false);
    expect(m.errorBannerVisible).toBe(true);
  });

  it("isFirstSection=true disables reorder up", () => {
    const m = computeControlMatrix("idle-populated", true, false, false, true);
    expect(m.reorderUpEnabled).toBe(false);
    expect(m.reorderDownEnabled).toBe(true);
  });

  it("isLastSection=true disables reorder down", () => {
    const m = computeControlMatrix("idle-populated", false, true, false, true);
    expect(m.reorderDownEnabled).toBe(false);
    expect(m.reorderUpEnabled).toBe(true);
  });
});

// ─── SectionCard rendering — control matrix ───────────────

describe("SectionCard control matrix rendering", () => {
  it("renders the heading from scene.plan.title", () => {
    renderCard({ scene: makeSceneEntry({ plan: { title: "My Hook" } }) });
    expect(screen.getByDisplayValue("My Hook")).toBeInTheDocument();
  });

  it("idle-empty: shows Generate, hides Regenerate and Cancel", () => {
    renderCard({ state: "idle-empty" });
    expect(screen.getByRole("button", { name: /^Generate$/ })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /^Regenerate$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Cancel$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Revert$/ })).not.toBeInTheDocument();
  });

  it("idle-populated: shows Regenerate, hides Generate and Cancel; editor not readonly", () => {
    renderCard({ state: "idle-populated", text: "some prose" });
    expect(screen.getByRole("button", { name: /^Regenerate$/ })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /^Generate$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Cancel$/ })).not.toBeInTheDocument();
    expect(getStubProps().readonly).toBe(false);
  });

  it("idle-populated + isRevertable=false: Revert hidden", () => {
    renderCard({ state: "idle-populated", text: "x", isRevertable: false });
    expect(screen.queryByRole("button", { name: /^Revert$/ })).not.toBeInTheDocument();
  });

  it("idle-populated + isRevertable=true: Revert visible", () => {
    renderCard({ state: "idle-populated", text: "x", isRevertable: true });
    expect(screen.getByRole("button", { name: /^Revert$/ })).toBeEnabled();
  });

  it("queued: Generate disabled, Cancel visible, queue position badge shows N+1", () => {
    renderCard({ state: "queued", queuePosition: 1 });
    const generate = screen.getByRole("button", { name: /^Generate$/ });
    expect(generate).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Cancel$/ })).toBeEnabled();
    expect(screen.getByText(/Queued.*position 2/i)).toBeInTheDocument();
    expect(getStubProps().readonly).toBe(true);
  });

  it("streaming: Generate/Regenerate hidden, Cancel visible, editor readonly", () => {
    renderCard({ state: "streaming", text: "in progress" });
    expect(screen.queryByRole("button", { name: /^Generate$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Regenerate$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Cancel$/ })).toBeEnabled();
    expect(getStubProps().readonly).toBe(true);
  });

  it("failed + hasText: Regenerate visible, error banner shows message", () => {
    renderCard({
      state: { state: "failed", reason: "error", message: "Network failure" },
      text: "some prose",
    });
    expect(screen.getByRole("button", { name: /^Regenerate$/ })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /^Generate$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/Network failure/);
  });

  it("failed + no text: Generate visible, error banner shows message", () => {
    renderCard({
      state: { state: "failed", reason: "aborted", message: "User cancelled" },
      text: "",
    });
    expect(screen.getByRole("button", { name: /^Generate$/ })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /^Regenerate$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/User cancelled/);
  });

  it("failed reason error vs aborted produces different header text", () => {
    const { unmount } = renderCard({
      state: { state: "failed", reason: "error", message: "boom" },
      text: "x",
    });
    expect(screen.getByText(/Generation failed/i)).toBeInTheDocument();
    unmount();
    resetStub();
    renderCard({
      state: { state: "failed", reason: "aborted", message: "boom" },
      text: "x",
    });
    expect(screen.getByText(/Generation cancelled/i)).toBeInTheDocument();
  });

  it("failed Dismiss button fires onDismissFailed(sceneId)", async () => {
    const onDismissFailed = vi.fn();
    renderCard({
      state: { state: "failed", reason: "error", message: "boom" },
      onDismissFailed,
    });
    await fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismissFailed).toHaveBeenCalledWith("scene-1");
  });
});

// ─── Reorder boundaries ────────────────────────────────────

describe("SectionCard reorder boundaries", () => {
  it("isFirstSection=true disables Move up regardless of state", () => {
    renderCard({ state: "idle-populated", text: "x", isFirstSection: true });
    expect(screen.getByRole("button", { name: /move up/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /move down/i })).toBeEnabled();
  });

  it("isLastSection=true disables Move down regardless of state", () => {
    renderCard({ state: "idle-populated", text: "x", isLastSection: true });
    expect(screen.getByRole("button", { name: /move down/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /move up/i })).toBeEnabled();
  });

  it("queued state disables both reorder buttons and delete", () => {
    renderCard({ state: "queued" });
    expect(screen.getByRole("button", { name: /move up/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /move down/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Delete$/ })).toBeDisabled();
  });
});

// ─── Edit-once-per-stream-cycle ────────────────────────────

describe("SectionCard edit-once-per-stream-cycle", () => {
  it("fires onEdit exactly once on first onTextChange after stream", () => {
    const onEdit = vi.fn();
    renderCard({ state: "idle-populated", text: "original", onEdit });
    fireStubTextChange("edited once");
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith("scene-1", "edited once");
  });

  it("does NOT fire onEdit on subsequent onTextChange in same cycle", () => {
    const onEdit = vi.fn();
    renderCard({ state: "idle-populated", text: "original", onEdit });
    fireStubTextChange("edit a");
    fireStubTextChange("edit b");
    fireStubTextChange("edit c");
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith("scene-1", "edit a");
  });

  it("resets the one-shot when a new stream cycle starts", async () => {
    const onEdit = vi.fn();
    const { rerender } = renderCard({ state: "idle-populated", text: "v1", onEdit });
    fireStubTextChange("edit 1");
    expect(onEdit).toHaveBeenCalledTimes(1);

    // Composer transitions section into streaming, then back to idle-populated.
    await rerender({ ...defaultProps(), text: "v1", state: "streaming", onEdit });
    await rerender({ ...defaultProps(), text: "v2", state: "idle-populated", onEdit });

    fireStubTextChange("edit after new stream");
    expect(onEdit).toHaveBeenCalledTimes(2);
    expect(onEdit).toHaveBeenLastCalledWith("scene-1", "edit after new stream");
  });
});

// ─── Directive field ──────────────────────────────────────

describe("SectionCard directive field", () => {
  it("syncs directiveDraft from directiveText prop", () => {
    renderCard({ state: "idle-populated", text: "x", directiveText: "Be sharper" });
    expect(screen.getByPlaceholderText(/nudge/i)).toHaveValue("Be sharper");
  });

  it("typing does NOT fire onDirectiveChange", async () => {
    const onDirectiveChange = vi.fn();
    renderCard({ state: "idle-populated", text: "x", onDirectiveChange });
    const input = screen.getByPlaceholderText(/nudge/i) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "typing..." } });
    expect(onDirectiveChange).not.toHaveBeenCalled();
  });

  it("blur fires onDirectiveChange with the current draft when changed", async () => {
    const onDirectiveChange = vi.fn();
    renderCard({ state: "idle-populated", text: "x", directiveText: "", onDirectiveChange });
    const input = screen.getByPlaceholderText(/nudge/i) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "tighter" } });
    await fireEvent.blur(input);
    expect(onDirectiveChange).toHaveBeenCalledWith("scene-1", "tighter");
  });

  it("blur does NOT fire onDirectiveChange when the draft equals the prop", async () => {
    const onDirectiveChange = vi.fn();
    renderCard({ state: "idle-populated", text: "x", directiveText: "same", onDirectiveChange });
    const input = screen.getByPlaceholderText(/nudge/i) as HTMLInputElement;
    await fireEvent.blur(input);
    expect(onDirectiveChange).not.toHaveBeenCalled();
  });
});

// ─── Revert button behavior ───────────────────────────────

describe("SectionCard revert button", () => {
  it("Revert click fires onRevert(sceneId)", async () => {
    const onRevert = vi.fn();
    renderCard({ state: "idle-populated", text: "x", isRevertable: true, onRevert });
    await fireEvent.click(screen.getByRole("button", { name: /^Revert$/ }));
    expect(onRevert).toHaveBeenCalledWith("scene-1");
  });
});

// ─── Annotation wiring ────────────────────────────────────

describe("SectionCard annotation wiring", () => {
  it("passes mapped annotations to AnnotatedEditor for kill_list flags", () => {
    const flags = [makeKillListFlag("delve"), makeKillListFlag("a sense of")];
    renderCard({
      state: "idle-populated",
      text: "we delve into a sense of dread",
      auditFlags: flags,
    });
    const props = getStubProps();
    expect(props.annotations).toHaveLength(2);
    const focuses = props.annotations.map((a) => a.anchor.focus).sort();
    expect(focuses).toEqual(["a sense of", "delve"]);
  });

  it("dismissing an annotation extracts the pattern and calls onDismissKillListPattern", () => {
    const onDismissKillListPattern = vi.fn();
    renderCard({
      state: "idle-populated",
      text: "we delve deeper",
      auditFlags: [makeKillListFlag("delve")],
      onDismissKillListPattern,
    });
    const ann = getStubProps().annotations[0];
    expect(ann).toBeDefined();
    fireStubDismissAnnotation(ann!.id);
    expect(onDismissKillListPattern).toHaveBeenCalledWith("delve");
  });
});

// ─── Primary control updates (heading/goal/key points/anchor lines) ─

describe("SectionCard primary control updates", () => {
  it("editing the heading and blurring fires onUpdatePlan with new title", async () => {
    const onUpdatePlan = vi.fn();
    renderCard({ scene: makeSceneEntry({ plan: { title: "Old" } }), onUpdatePlan });
    const input = screen.getByDisplayValue("Old") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "New" } });
    await fireEvent.blur(input);
    expect(onUpdatePlan).toHaveBeenCalled();
    const called = onUpdatePlan.mock.calls[0]?.[0] as ScenePlan;
    expect(called.title).toBe("New");
  });

  it("editing the goal and blurring fires onUpdatePlan with new narrativeGoal", async () => {
    const onUpdatePlan = vi.fn();
    renderCard({
      scene: makeSceneEntry({ plan: { narrativeGoal: "Old goal" } }),
      onUpdatePlan,
    });
    const input = screen.getByDisplayValue("Old goal") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "New goal" } });
    await fireEvent.blur(input);
    expect(onUpdatePlan).toHaveBeenCalled();
    const called = onUpdatePlan.mock.calls.at(-1)?.[0] as ScenePlan;
    expect(called.narrativeGoal).toBe("New goal");
  });

  it("removing a key point fires onUpdatePlan with shorter chunkDescriptions", async () => {
    const onUpdatePlan = vi.fn();
    renderCard({
      scene: makeSceneEntry({ plan: { chunkDescriptions: ["one", "two", "three"] } }),
      onUpdatePlan,
    });
    const removeButtons = screen.getAllByRole("button", { name: /remove key point/i });
    expect(removeButtons.length).toBe(3);
    await fireEvent.click(removeButtons[1]!);
    expect(onUpdatePlan).toHaveBeenCalled();
    const called = onUpdatePlan.mock.calls.at(-1)?.[0] as ScenePlan;
    expect(called.chunkDescriptions).toEqual(["one", "three"]);
  });

  it("adding a key point fires onUpdatePlan with longer chunkDescriptions", async () => {
    const onUpdatePlan = vi.fn();
    renderCard({
      scene: makeSceneEntry({ plan: { chunkDescriptions: ["one"] } }),
      onUpdatePlan,
    });
    await fireEvent.click(screen.getByRole("button", { name: /add key point/i }));
    expect(onUpdatePlan).toHaveBeenCalled();
    const called = onUpdatePlan.mock.calls.at(-1)?.[0] as ScenePlan;
    expect(called.chunkDescriptions).toHaveLength(2);
  });

  it("removing an anchor line fires onUpdatePlan with shorter anchorLines", async () => {
    const onUpdatePlan = vi.fn();
    renderCard({
      scene: makeSceneEntry({
        plan: {
          anchorLines: [
            { text: "First", placement: "open", verbatim: false },
            { text: "Second", placement: "close", verbatim: true },
          ],
        },
      }),
      onUpdatePlan,
    });
    const removeButtons = screen.getAllByRole("button", { name: /remove anchor line/i });
    expect(removeButtons.length).toBe(2);
    await fireEvent.click(removeButtons[0]!);
    expect(onUpdatePlan).toHaveBeenCalled();
    const called = onUpdatePlan.mock.calls.at(-1)?.[0] as ScenePlan;
    expect(called.anchorLines).toHaveLength(1);
    expect(called.anchorLines[0]?.text).toBe("Second");
  });
});

// ─── Delete + reorder action firing ───────────────────────

describe("SectionCard action callbacks", () => {
  it("Delete click fires onDelete(sceneId)", async () => {
    const onDelete = vi.fn();
    renderCard({ state: "idle-populated", text: "x", onDelete });
    await fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
    expect(onDelete).toHaveBeenCalledWith("scene-1");
  });

  it("Move up click fires onMoveUp(sceneId)", async () => {
    const onMoveUp = vi.fn();
    renderCard({ state: "idle-populated", text: "x", onMoveUp });
    await fireEvent.click(screen.getByRole("button", { name: /move up/i }));
    expect(onMoveUp).toHaveBeenCalledWith("scene-1");
  });

  it("Move down click fires onMoveDown(sceneId)", async () => {
    const onMoveDown = vi.fn();
    renderCard({ state: "idle-populated", text: "x", onMoveDown });
    await fireEvent.click(screen.getByRole("button", { name: /move down/i }));
    expect(onMoveDown).toHaveBeenCalledWith("scene-1");
  });

  it("Generate click fires onGenerate(sceneId)", async () => {
    const onGenerate = vi.fn();
    renderCard({ state: "idle-empty", onGenerate });
    await fireEvent.click(screen.getByRole("button", { name: /^Generate$/ }));
    expect(onGenerate).toHaveBeenCalledWith("scene-1");
  });

  it("Regenerate click fires onRegenerate(sceneId)", async () => {
    const onRegenerate = vi.fn();
    renderCard({ state: "idle-populated", text: "x", onRegenerate });
    await fireEvent.click(screen.getByRole("button", { name: /^Regenerate$/ }));
    expect(onRegenerate).toHaveBeenCalledWith("scene-1");
  });

  it("Cancel click fires onCancel(sceneId)", async () => {
    const onCancel = vi.fn();
    renderCard({ state: "streaming", text: "x", onCancel });
    await fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(onCancel).toHaveBeenCalledWith("scene-1");
  });
});

// ─── Pure-presentational enforcement ──────────────────────

describe("SectionCard purity", () => {
  it("source file does not import store, commands, api, or api-actions", () => {
    const source = readFileSync(resolve(__dirname, "../../../src/app/components/composer/SectionCard.svelte"), "utf-8");
    expect(source).not.toMatch(/from\s+["'][^"']*\/store\//);
    expect(source).not.toMatch(/from\s+["'][^"']*\/commands/);
    expect(source).not.toMatch(/from\s+["'][^"']*\/api-actions/);
    expect(source).not.toMatch(/from\s+["'][^"']*\/api\/client/);
    expect(source).not.toMatch(/from\s+["']svelte\/store["']/);
  });
});

// ─── Fiction guardrail ────────────────────────────────────

describe("SectionCard fiction guardrail", () => {
  it("does not render POV character, dialogue constraints, or location even when set on the plan", () => {
    renderCard({
      scene: makeSceneEntry({
        plan: {
          povCharacterId: "char-elena",
          locationId: "loc-cafe",
          dialogueConstraints: { "char-elena": ["formal"] },
          sensoryNotes: "smell of coffee",
        },
      }),
    });
    expect(screen.queryByText(/char-elena/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/loc-cafe/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/smell of coffee/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/POV character/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dialogue constraint/i)).not.toBeInTheDocument();
  });
});
