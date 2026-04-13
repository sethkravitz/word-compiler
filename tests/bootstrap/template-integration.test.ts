import { describe, expect, it } from "vitest";
import {
  bootstrapToBible,
  bootstrapToScenePlans,
  buildBootstrapPrompt,
  ESSAY_TEMPLATES,
  OPINION_PIECE,
  type ParsedBootstrap,
  PERSONAL_ESSAY,
} from "../../src/bootstrap/index.js";
import { checkScenePlanGate } from "../../src/gates/index.js";

const parsed: ParsedBootstrap = {
  thesis: "AI writing tools fail because they treat voice as a prompt.",
  sections: [
    {
      heading: "The Prompt Fallacy",
      purpose: "Establish the core problem",
      keyPoints: ["Point A", "Point B"],
    },
    {
      heading: "What Voice Actually Is",
      purpose: "Define voice as learned behavior",
      keyPoints: ["Point C"],
    },
    {
      heading: "A Better Path",
      purpose: "Propose the solution",
      keyPoints: ["Point D", "Point E"],
    },
  ],
  suggestedTone: {
    register: "casual-authoritative",
    audience: "technical writers",
    pacingNotes: "build slowly",
  },
  suggestedKillList: ["bespoke"],
  structuralBans: ["Do not open with a dictionary definition"],
};

describe("buildBootstrapPrompt — template integration", () => {
  it("is backward compatible when called without a template", () => {
    const payload = buildBootstrapPrompt("some synopsis");
    expect(payload.systemMessage).toBe(
      "You are an editorial analyst. Given an essay brief or idea, extract a structured essay plan. Be specific and opinionated — generic structure is useless.",
    );
    // A bare base systemMessage should not contain the opinion-piece or
    // personal-essay override text.
    expect(payload.systemMessage).not.toContain("advancing a single central argument");
    expect(payload.systemMessage).not.toContain("concrete moments from lived experience");
  });

  it("appends OPINION_PIECE systemPromptOverride to the system message", () => {
    const payload = buildBootstrapPrompt("some synopsis", OPINION_PIECE);
    expect(payload.systemMessage).toContain("You are an editorial analyst");
    expect(payload.systemMessage).toContain(OPINION_PIECE.systemPromptOverride);
    expect(payload.systemMessage).toContain("advancing a single central argument");
  });

  it("appends PERSONAL_ESSAY systemPromptOverride to the system message", () => {
    const payload = buildBootstrapPrompt("some synopsis", PERSONAL_ESSAY);
    expect(payload.systemMessage).toContain("You are an editorial analyst");
    expect(payload.systemMessage).toContain(PERSONAL_ESSAY.systemPromptOverride);
    expect(payload.systemMessage).toContain("concrete moments from lived experience");
  });

  it("does not alter the user message shape when a template is provided", () => {
    const withoutTmpl = buildBootstrapPrompt("the synopsis");
    const withTmpl = buildBootstrapPrompt("the synopsis", OPINION_PIECE);
    expect(withTmpl.userMessage).toBe(withoutTmpl.userMessage);
    expect(withTmpl.temperature).toBe(withoutTmpl.temperature);
    expect(withTmpl.topP).toBe(withoutTmpl.topP);
    expect(withTmpl.maxTokens).toBe(withoutTmpl.maxTokens);
    expect(withTmpl.model).toBe(withoutTmpl.model);
  });
});

describe("bootstrapToBible — template integration", () => {
  it("is backward compatible when called without a template (no mode, no template defaults)", () => {
    const bible = bootstrapToBible(parsed, "proj-1");
    expect(bible.mode).toBeUndefined();
    // Template-specific kill list entries should NOT be present.
    const patterns = bible.styleGuide.killList.map((k) => k.pattern);
    expect(patterns).not.toContain("looking back");
    // paragraphPolicy and sentenceArchitecture remain null without a template.
    expect(bible.styleGuide.paragraphPolicy).toBeNull();
    expect(bible.styleGuide.sentenceArchitecture).toBeNull();
  });

  it("applies OPINION_PIECE defaults and sets mode = 'essay'", () => {
    const bible = bootstrapToBible(parsed, "proj-1", undefined, OPINION_PIECE);
    expect(bible.mode).toBe("essay");
    const patterns = bible.styleGuide.killList.map((k) => k.pattern);
    expect(patterns).toContain("it goes without saying");
    expect(bible.styleGuide.paragraphPolicy?.maxSentences).toBe(5);
    expect(bible.styleGuide.sentenceArchitecture?.targetVariance).toBe("high");
  });

  it("applies PERSONAL_ESSAY defaults and sets mode = 'essay'", () => {
    const bible = bootstrapToBible(parsed, "proj-1", undefined, PERSONAL_ESSAY);
    expect(bible.mode).toBe("essay");
    const patterns = bible.styleGuide.killList.map((k) => k.pattern);
    expect(patterns).toContain("looking back");
    expect(bible.styleGuide.metaphoricRegister?.approvedDomains).toContain("domestic");
  });

  it("preserves sourcePrompt AND applies the template when both are provided", () => {
    const bible = bootstrapToBible(parsed, "proj-1", "my synopsis", OPINION_PIECE);
    expect(bible.sourcePrompt).toBe("my synopsis");
    expect(bible.mode).toBe("essay");
    const patterns = bible.styleGuide.killList.map((k) => k.pattern);
    expect(patterns).toContain("it goes without saying");
  });
});

describe("bootstrapToScenePlans — legacy characterization", () => {
  // Characterization test: documents the legacy failureModeToAvoid shape
  // produced when NO template is provided. Guards against accidental
  // behavior drift on the no-template path.
  it("without a template, uses the legacy 'Generic summary' default failure mode", () => {
    const plans = bootstrapToScenePlans(parsed, "proj-1", "author-id");
    expect(plans).toHaveLength(3);
    for (const plan of plans) {
      expect(plan.failureModeToAvoid).toContain("Generic summary without a clear argument");
      expect(plan.failureModeToAvoid.length).toBeGreaterThan(0);
    }
    // Legacy estimatedWordCount default.
    expect(plans[0]!.estimatedWordCount).toEqual([300, 600]);
  });
});

describe("bootstrapToScenePlans — template integration (critical contract)", () => {
  // The critical fix: every ScenePlan materialized with a template MUST have
  // a non-empty failureModeToAvoid AND pass checkScenePlanGate. This guards
  // against the bootstrap-gate-empty-failure-mode regression.
  it.each(
    ESSAY_TEMPLATES.map((t) => [t.id, t] as const),
  )("%s: every generated ScenePlan has a non-empty failureModeToAvoid and passes checkScenePlanGate", (_id, tmpl) => {
    const plans = bootstrapToScenePlans(parsed, "proj-1", "author-id", tmpl);
    expect(plans).toHaveLength(parsed.sections?.length ?? 0);
    for (const plan of plans) {
      expect(plan.failureModeToAvoid.trim().length).toBeGreaterThan(0);
      expect(plan.failureModeToAvoid).not.toContain("${");
      expect(plan.failureModeToAvoid).not.toContain("undefined");
      const gate = checkScenePlanGate(plan);
      expect(gate.passed).toBe(true);
      expect(gate.messages).toEqual([]);
    }
  });

  it("OPINION_PIECE failure modes reference the section purpose", () => {
    const plans = bootstrapToScenePlans(parsed, "proj-1", "author-id", OPINION_PIECE);
    // First section's purpose: "Establish the core problem"
    expect(plans[0]!.failureModeToAvoid.toLowerCase()).toContain("establish the core problem");
  });

  it("PERSONAL_ESSAY failure modes reference the section purpose", () => {
    const plans = bootstrapToScenePlans(parsed, "proj-1", "author-id", PERSONAL_ESSAY);
    expect(plans[0]!.failureModeToAvoid).toContain("Establish the core problem");
  });

  it("estimatedWordCount is apportioned from the template's defaultWordCountTarget", () => {
    for (const tmpl of ESSAY_TEMPLATES) {
      const plans = bootstrapToScenePlans(parsed, "proj-1", "author-id", tmpl);
      const sectionCount = parsed.sections?.length ?? 1;
      const [minTotal, maxTotal] = tmpl.defaultWordCountTarget;
      const expectedMin = Math.max(1, Math.round(minTotal / sectionCount));
      const expectedMax = Math.max(expectedMin, Math.round(maxTotal / sectionCount));
      for (const plan of plans) {
        expect(plan.estimatedWordCount).toEqual([expectedMin, expectedMax]);
      }
      // Sanity: total budget is in the right ballpark.
      const totalMin = plans.reduce((sum, p) => sum + p.estimatedWordCount[0], 0);
      const totalMax = plans.reduce((sum, p) => sum + p.estimatedWordCount[1], 0);
      expect(totalMin).toBeGreaterThanOrEqual(minTotal - sectionCount);
      expect(totalMax).toBeLessThanOrEqual(maxTotal + sectionCount);
    }
  });
});
