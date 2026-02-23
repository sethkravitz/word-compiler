import { render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it, vi } from "vitest";
import LearnerPanel from "../../src/app/components/LearnerPanel.svelte";
import type { EditPattern } from "../../src/learner/diff.js";
import type { TuningProposal } from "../../src/learner/tuning.js";
import { generateId } from "../../src/types/index.js";

function makeEdit(overrides: Partial<EditPattern> = {}): EditPattern {
  return {
    id: `e-${Math.random().toString(36).slice(2, 8)}`,
    chunkId: "c1",
    sceneId: "s1",
    projectId: "p1",
    editType: "DELETION",
    subType: "CUT_FILLER",
    originalText: "well",
    editedText: "",
    context: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeTuningProposal(overrides: Partial<TuningProposal> = {}): TuningProposal {
  return {
    id: generateId(),
    projectId: "p1",
    parameter: "defaultTemperature",
    currentValue: 0.85,
    suggestedValue: 0.65,
    rationale: "Average edit ratio is 45% across 12 chunks. Lowering temperature should produce closer prose.",
    confidence: 0.82,
    evidence: { editedChunkCount: 12, sceneCount: 4, avgEditRatio: 0.45 },
    status: "pending",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("LearnerPanel", () => {
  it("shows empty state when no edit patterns", () => {
    render(LearnerPanel, {
      editPatterns: [],
      sceneOrder: new Map(),
      projectId: "p1",
    });
    expect(screen.getByText(/no edit patterns yet/i)).toBeTruthy();
  });

  it("shows 'not enough patterns' when edits exist but none promoted", () => {
    // Only 2 edits — below promotion threshold
    const edits = [makeEdit(), makeEdit()];
    render(LearnerPanel, {
      editPatterns: edits,
      sceneOrder: new Map([["s1", 0]]),
      projectId: "p1",
    });
    expect(screen.getByText(/not enough consistent patterns/i)).toBeTruthy();
  });

  it("shows proposals when enough patterns exist", () => {
    // 10 identical CUT_FILLER edits = above threshold (Wilson(10,10) > 0.60)
    const edits = Array.from({ length: 10 }, () => makeEdit());
    render(LearnerPanel, {
      editPatterns: edits,
      sceneOrder: new Map([["s1", 0]]),
      projectId: "p1",
    });
    // Should show the suggestion (title and action both contain "avoid list")
    expect(screen.getAllByText(/avoid list/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Accept")).toBeTruthy();
    expect(screen.getByText("Reject")).toBeTruthy();
  });

  it("shows suggestion count badge", () => {
    const edits = Array.from({ length: 10 }, () => makeEdit());
    render(LearnerPanel, {
      editPatterns: edits,
      sceneOrder: new Map([["s1", 0]]),
      projectId: "p1",
    });
    expect(screen.getByText(/1 suggestion/i)).toBeTruthy();
  });

  it("shows confidence percentage", () => {
    const edits = Array.from({ length: 10 }, () => makeEdit());
    render(LearnerPanel, {
      editPatterns: edits,
      sceneOrder: new Map([["s1", 0]]),
      projectId: "p1",
    });
    // Should show some percentage (may appear in multiple places)
    const confidenceEls = screen.getAllByText(/%/);
    expect(confidenceEls.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onAcceptProposal when Accept is clicked", async () => {
    const onAccept = vi.fn();
    const edits = Array.from({ length: 10 }, () => makeEdit());
    render(LearnerPanel, {
      editPatterns: edits,
      sceneOrder: new Map([["s1", 0]]),
      projectId: "p1",
      onAcceptProposal: onAccept,
    });
    const acceptBtn = screen.getByText("Accept");
    acceptBtn.click();
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept.mock.calls[0]![0]).toHaveProperty("action");
  });

  it("shows Applied state after accepting", async () => {
    const edits = Array.from({ length: 10 }, () => makeEdit());
    render(LearnerPanel, {
      editPatterns: edits,
      sceneOrder: new Map([["s1", 0]]),
      projectId: "p1",
    });
    screen.getByText("Accept").click();
    await tick();
    // After clicking, the decision text should appear
    expect(screen.getByText("Applied")).toBeTruthy();
  });

  // ─── Tuning Proposals ─────────────────────────────────

  it("shows tuning section when tuningProposals is non-empty", () => {
    render(LearnerPanel, {
      editPatterns: [],
      sceneOrder: new Map(),
      projectId: "p1",
      tuningProposals: [makeTuningProposal()],
    });
    expect(screen.getByText("Tuning Suggestions")).toBeTruthy();
    expect(screen.getByText("defaultTemperature")).toBeTruthy();
  });

  it("hides tuning section when tuningProposals is empty", () => {
    render(LearnerPanel, {
      editPatterns: [],
      sceneOrder: new Map(),
      projectId: "p1",
      tuningProposals: [],
    });
    expect(screen.queryByText("Tuning Suggestions")).toBeNull();
  });

  it("displays current → suggested value and confidence", () => {
    render(LearnerPanel, {
      editPatterns: [],
      sceneOrder: new Map(),
      projectId: "p1",
      tuningProposals: [makeTuningProposal({ currentValue: 0.85, suggestedValue: 0.65, confidence: 0.82 })],
    });
    expect(screen.getByText("0.85")).toBeTruthy();
    expect(screen.getByText("0.65")).toBeTruthy();
    expect(screen.getByText("82%")).toBeTruthy();
  });

  it("calls onAcceptTuning when Accept is clicked on a tuning proposal", async () => {
    const onAcceptTuning = vi.fn();
    const tp = makeTuningProposal();
    render(LearnerPanel, {
      editPatterns: [],
      sceneOrder: new Map(),
      projectId: "p1",
      tuningProposals: [tp],
      onAcceptTuning,
    });
    // The tuning Accept button is the only Accept on screen (no bible proposals)
    screen.getByText("Accept").click();
    expect(onAcceptTuning).toHaveBeenCalledTimes(1);
    expect(onAcceptTuning.mock.calls[0]![0]).toHaveProperty("parameter", "defaultTemperature");
  });

  it("shows Applied state after accepting a tuning proposal", async () => {
    render(LearnerPanel, {
      editPatterns: [],
      sceneOrder: new Map(),
      projectId: "p1",
      tuningProposals: [makeTuningProposal()],
    });
    screen.getByText("Accept").click();
    await tick();
    expect(screen.getByText("Applied")).toBeTruthy();
  });
});
