import { describe, expect, it } from "vitest";
import {
  applyEssayTemplate,
  ESSAY_TEMPLATES,
  type EssayTemplate,
  OPINION_PIECE,
  PERSONAL_ESSAY,
} from "../../src/bootstrap/essayTemplates.js";
import { checkScenePlanGate } from "../../src/gates/index.js";
import type { ScenePlan } from "../../src/types/index.js";
import { createEmptyBible, createEmptyScenePlan } from "../../src/types/index.js";

describe("ESSAY_TEMPLATES registry", () => {
  it("exports exactly 2 templates", () => {
    expect(ESSAY_TEMPLATES).toHaveLength(2);
    const ids = ESSAY_TEMPLATES.map((t) => t.id);
    expect(ids).toContain("opinion-piece");
    expect(ids).toContain("personal-essay");
  });

  it("every template has required fields", () => {
    for (const tmpl of ESSAY_TEMPLATES) {
      expect(tmpl.id).toBeTruthy();
      expect(tmpl.name).toBeTruthy();
      expect(tmpl.description).toBeTruthy();
      expect(tmpl.systemPromptOverride).toBeTruthy();
      expect(tmpl.systemPromptOverride.length).toBeGreaterThan(0);
      expect(Array.isArray(tmpl.defaultSectionCount)).toBe(true);
      expect(tmpl.defaultSectionCount).toHaveLength(2);
      expect(typeof tmpl.defaultSectionCount[0]).toBe("number");
      expect(typeof tmpl.defaultSectionCount[1]).toBe("number");
      expect(tmpl.defaultSectionCount[0]).toBeLessThanOrEqual(tmpl.defaultSectionCount[1]);
      expect(Array.isArray(tmpl.defaultWordCountTarget)).toBe(true);
      expect(tmpl.defaultWordCountTarget).toHaveLength(2);
      expect(typeof tmpl.defaultWordCountTarget[0]).toBe("number");
      expect(typeof tmpl.defaultWordCountTarget[1]).toBe("number");
      expect(tmpl.defaultWordCountTarget[0]).toBeLessThanOrEqual(tmpl.defaultWordCountTarget[1]);
      expect(typeof tmpl.defaultFailureModeForSection).toBe("function");
      expect(tmpl.bibleDefaults).toBeTruthy();
      expect(typeof tmpl.bibleDefaults).toBe("object");
    }
  });

  it("defaultFailureModeForSection produces non-empty strings without placeholder leakage", () => {
    for (const tmpl of ESSAY_TEMPLATES) {
      const result = tmpl.defaultFailureModeForSection("Intro", "establish the problem");
      expect(typeof result).toBe("string");
      expect(result.trim().length).toBeGreaterThan(0);
      expect(result).not.toContain("${");
      expect(result).not.toContain("undefined");
    }
  });
});

// Build a ScenePlan that satisfies checkScenePlanGate's other required fields
// so the test isolates the failureModeToAvoid contract.
function makeValidScenePlan(failureMode: string): ScenePlan {
  const plan = createEmptyScenePlan("proj-test");
  plan.title = "Test Section";
  plan.povCharacterId = "author-voice-id";
  plan.narrativeGoal = "Establish the central claim and frame the argument.";
  plan.failureModeToAvoid = failureMode;
  return plan;
}

describe("defaultFailureModeForSection — bootstrap gate contract", () => {
  // Regression test for docs/solutions/logic-errors/bootstrap-gate-empty-failure-mode-2026-04-10.md
  // An empty failureModeToAvoid would fail checkScenePlanGate and block bootstrap.
  it.each(
    ESSAY_TEMPLATES.map((t) => [t.id, t] as const),
  )("%s produces a failureMode that passes checkScenePlanGate", (_id, tmpl: EssayTemplate) => {
    const failureMode = tmpl.defaultFailureModeForSection("test heading", "test purpose");
    const plan = makeValidScenePlan(failureMode);
    const result = checkScenePlanGate(plan);
    expect(result.passed).toBe(true);
    expect(result.messages).toEqual([]);
  });

  it("handles empty heading and purpose without producing an empty or placeholder-leaking string", () => {
    for (const tmpl of ESSAY_TEMPLATES) {
      const result = tmpl.defaultFailureModeForSection("", "");
      expect(result.trim().length).toBeGreaterThan(0);
      expect(result).not.toContain("${");
      expect(result).not.toContain("undefined");
      const plan = makeValidScenePlan(result);
      expect(checkScenePlanGate(plan).passed).toBe(true);
    }
  });
});

describe("applyEssayTemplate", () => {
  it("sets mode to 'essay'", () => {
    const bible = createEmptyBible("proj-1");
    const result = applyEssayTemplate(bible, OPINION_PIECE);
    expect(result.mode).toBe("essay");
  });

  it("sets mode to 'essay' for personal essay template too", () => {
    const bible = createEmptyBible("proj-1");
    const result = applyEssayTemplate(bible, PERSONAL_ESSAY);
    expect(result.mode).toBe("essay");
  });

  it("merges kill list entries for Opinion Piece", () => {
    const bible = createEmptyBible("proj-1");
    const result = applyEssayTemplate(bible, OPINION_PIECE);
    const patterns = result.styleGuide.killList.map((k) => k.pattern);
    expect(patterns).toContain("it goes without saying");
    expect(result.styleGuide.killList.length).toBeGreaterThan(0);
  });

  it("merges kill list entries for Personal Essay", () => {
    const bible = createEmptyBible("proj-1");
    const result = applyEssayTemplate(bible, PERSONAL_ESSAY);
    const patterns = result.styleGuide.killList.map((k) => k.pattern);
    expect(patterns).toContain("looking back");
    expect(result.styleGuide.killList.length).toBeGreaterThan(0);
  });

  it("merges structural bans for every template", () => {
    for (const tmpl of ESSAY_TEMPLATES) {
      const bible = createEmptyBible("proj-1");
      const result = applyEssayTemplate(bible, tmpl);
      expect(result.styleGuide.structuralBans.length).toBeGreaterThan(0);
    }
  });

  it("merges paragraphPolicy when bible's current value is null", () => {
    const bible = createEmptyBible("proj-1");
    expect(bible.styleGuide.paragraphPolicy).toBeNull();
    const result = applyEssayTemplate(bible, OPINION_PIECE);
    expect(result.styleGuide.paragraphPolicy).not.toBeNull();
    expect(result.styleGuide.paragraphPolicy?.maxSentences).toBe(5);
    expect(result.styleGuide.paragraphPolicy?.singleSentenceFrequency).toBe("frequent");
  });

  it("merges sentenceArchitecture when bible's current value is null", () => {
    const bible = createEmptyBible("proj-1");
    const result = applyEssayTemplate(bible, OPINION_PIECE);
    expect(result.styleGuide.sentenceArchitecture).not.toBeNull();
    expect(result.styleGuide.sentenceArchitecture?.targetVariance).toBe("high");
  });

  it("merges metaphoric register when bible's current value is null", () => {
    const bible = createEmptyBible("proj-1");
    const result = applyEssayTemplate(bible, PERSONAL_ESSAY);
    expect(result.styleGuide.metaphoricRegister).not.toBeNull();
    expect(result.styleGuide.metaphoricRegister?.approvedDomains).toContain("domestic");
    expect(result.styleGuide.metaphoricRegister?.prohibitedDomains).toContain("warfare");
  });

  it("routes povNotes to narrativeRules.pov.notes", () => {
    const bible = createEmptyBible("proj-1");
    const result = applyEssayTemplate(bible, OPINION_PIECE);
    expect(result.narrativeRules.pov.notes).toBe(
      "Direct, opinionated first-person. The author has a position and defends it.",
    );
  });

  it("does NOT overwrite user-set paragraphPolicy", () => {
    const bible = createEmptyBible("proj-1");
    bible.styleGuide.paragraphPolicy = {
      maxSentences: 99,
      singleSentenceFrequency: "rare",
      notes: "custom",
    };
    const result = applyEssayTemplate(bible, OPINION_PIECE);
    expect(result.styleGuide.paragraphPolicy?.maxSentences).toBe(99);
    expect(result.styleGuide.paragraphPolicy?.singleSentenceFrequency).toBe("rare");
    expect(result.styleGuide.paragraphPolicy?.notes).toBe("custom");
  });

  it("does NOT overwrite user-set povNotes", () => {
    const bible = createEmptyBible("proj-1");
    bible.narrativeRules.pov.notes = "custom notes";
    const result = applyEssayTemplate(bible, OPINION_PIECE);
    expect(result.narrativeRules.pov.notes).toBe("custom notes");
  });

  it("does NOT overwrite user-set sentenceArchitecture", () => {
    const bible = createEmptyBible("proj-1");
    bible.styleGuide.sentenceArchitecture = {
      targetVariance: "low",
      fragmentPolicy: "never",
      notes: "user notes",
    };
    const result = applyEssayTemplate(bible, OPINION_PIECE);
    expect(result.styleGuide.sentenceArchitecture?.targetVariance).toBe("low");
    expect(result.styleGuide.sentenceArchitecture?.fragmentPolicy).toBe("never");
  });

  it("does NOT mutate the input bible", () => {
    const bible = createEmptyBible("proj-1");
    const snapshot = structuredClone(bible);
    const result = applyEssayTemplate(bible, OPINION_PIECE);
    expect(result).not.toBe(bible);
    expect(bible).toEqual(snapshot);
    // Mutating the result must not affect the input.
    result.styleGuide.killList.push({ pattern: "mutation-test", type: "exact" });
    expect(bible.styleGuide.killList).toEqual(snapshot.styleGuide.killList);
  });

  it("de-duplicates kill list patterns when applying over an existing list", () => {
    const bible = createEmptyBible("proj-1");
    bible.styleGuide.killList.push({ pattern: "it goes without saying", type: "exact" });
    const result = applyEssayTemplate(bible, OPINION_PIECE);
    const matches = result.styleGuide.killList.filter((k) => k.pattern === "it goes without saying");
    expect(matches).toHaveLength(1);
  });

  it("de-duplicates structural bans when applying over an existing list", () => {
    const bible = createEmptyBible("proj-1");
    const duplicateBan = "Do not hedge a claim with 'I think' or 'in my opinion' — state the claim directly.";
    bible.styleGuide.structuralBans.push(duplicateBan);
    const result = applyEssayTemplate(bible, OPINION_PIECE);
    const matches = result.styleGuide.structuralBans.filter((b) => b === duplicateBan);
    expect(matches).toHaveLength(1);
  });
});
