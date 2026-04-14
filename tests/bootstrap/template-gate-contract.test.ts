import { describe, expect, it } from "vitest";
import {
  bootstrapToBible,
  bootstrapToScenePlans,
  ESSAY_TEMPLATES,
  type ParsedBootstrap,
} from "../../src/bootstrap/index.js";
import { checkScenePlanGate } from "../../src/gates/index.js";

// ─── Contract test ─────────────────────────────────────────
//
// Applies the prevention pattern from
// `docs/solutions/logic-errors/bootstrap-gate-empty-failure-mode-2026-04-10.md`.
//
// The bug that solution documented: `bootstrapToScenePlans` produced scene
// plans with empty `failureModeToAvoid`, which hard-blocks generation via
// `checkScenePlanGate`. The fix was to derive failureModeToAvoid from the
// template and section purpose. The prevention was: add a contract test
// asserting every template produces gate-passing sections.
//
// This test iterates every registered essay template with a realistic fixture
// and asserts each produced ScenePlan passes the gate. If a future template
// is added without a working `defaultFailureModeForSection`, this test fails
// loudly before the user ever clicks Generate.

const FIXTURE_PARSED: ParsedBootstrap = {
  thesis: "Productivity advice fails knowledge workers because it treats creative work like factory output.",
  sections: [
    {
      heading: "The setup",
      purpose: "Introduce the anecdote and the frame.",
      keyPoints: ["First encounter with the advice", "Why it felt wrong"],
    },
    {
      heading: "The counterexamples",
      purpose: "Three cases where the advice actively harms the work.",
      keyPoints: ["Case 1", "Case 2", "Case 3"],
    },
    {
      heading: "The reframe",
      purpose: "Offer a sharper definition of productive creative work.",
      keyPoints: ["New framing", "What it protects"],
    },
  ],
  suggestedTone: {
    register: "conversational",
    audience: "knowledge workers",
    pacingNotes: "Build slowly, land hard",
  },
  suggestedKillList: ["delve", "leverage"],
  structuralBans: ["Never open with a dictionary definition"],
};

describe("essay template gate contract", () => {
  for (const template of ESSAY_TEMPLATES) {
    it(`${template.id}: every produced scene plan passes checkScenePlanGate`, () => {
      const bible = bootstrapToBible(FIXTURE_PARSED, "proj-test", "brief text", template);
      const authorId = bible.characters[0]?.id;
      expect(authorId, `template ${template.id} did not seed an author persona`).toBeTruthy();

      const plans = bootstrapToScenePlans(FIXTURE_PARSED, "proj-test", authorId ?? "", template);
      expect(plans.length, `template ${template.id} produced no scene plans`).toBeGreaterThan(0);

      for (const [i, plan] of plans.entries()) {
        const gate = checkScenePlanGate(plan);
        expect(
          gate.passed,
          `template ${template.id} plan[${i}] (${plan.title}) failed gate: ${gate.messages.join("; ")}`,
        ).toBe(true);
      }
    });

    it(`${template.id}: produced scene plans have non-empty required fields`, () => {
      const bible = bootstrapToBible(FIXTURE_PARSED, "proj-test", "brief text", template);
      const authorId = bible.characters[0]?.id ?? "";
      const plans = bootstrapToScenePlans(FIXTURE_PARSED, "proj-test", authorId, template);
      for (const plan of plans) {
        expect(plan.title.trim().length, "title must be non-empty").toBeGreaterThan(0);
        expect(plan.narrativeGoal.trim().length, "narrativeGoal must be non-empty").toBeGreaterThan(0);
        expect(plan.povCharacterId.trim().length, "povCharacterId must be non-empty").toBeGreaterThan(0);
        expect(plan.failureModeToAvoid.trim().length, "failureModeToAvoid must be non-empty").toBeGreaterThan(0);
      }
    });
  }
});
