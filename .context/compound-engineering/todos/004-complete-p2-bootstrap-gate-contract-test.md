---
status: complete
priority: p2
issue_id: 004
tags: [code-review, testing, prevention, learnings-applied, bootstrap, gates]
dependencies: []
---

# Add contract test: every essay template produces gate-passing section plans

## Problem Statement

**Prior learning applied:** `docs/solutions/logic-errors/bootstrap-gate-empty-failure-mode-2026-04-10.md` documented a hard incident where `bootstrapToScenePlans()` produced section plans with empty `failureModeToAvoid`, which hard-blocks generation via `checkScenePlanGate()`. The lesson: **any code path that creates section plans must populate `failureModeToAvoid`, and a contract test must enforce this across every factory**.

This PR adds TWO new factory paths that create section plans:
1. `bootstrapToScenePlans()` invoked with an `EssayTemplate` (Unit 3)
2. `createEssayProject()` skip-blank path in `TemplatePicker` (Unit 9) — constructs a placeholder ScenePlan by hand

The skip-blank path is correct (sets `failureModeToAvoid` explicitly), and Unit 3 tests cover the template-aware bootstrap. **But there is no single contract test that iterates every `ESSAY_TEMPLATES` entry and asserts each produced section passes `checkScenePlanGate()`.**

If a future template is added to the registry without a `defaultFailureModeForSection()` that returns non-empty strings, the composer will hard-fail on first Generate click with no warning.

Flagged by `learnings-researcher`.

## Findings

- `src/bootstrap/essayTemplates.ts` — template registry with `defaultFailureModeForSection(heading, purpose)` per template
- `src/bootstrap/index.ts:360-386` — `bootstrapToScenePlans` applies `template.defaultFailureModeForSection` when a template is provided
- `src/app/components/composer/TemplatePicker.svelte` — skip-blank path hand-sets a placeholder plan (has non-empty `failureModeToAvoid`, but not covered by a contract test either)
- `src/gates/index.ts:11` — `checkScenePlanGate` requires non-empty title, povCharacterId, narrativeGoal, failureModeToAvoid

**No current test iterates `ESSAY_TEMPLATES` and asserts gate compliance.**

## Proposed Solutions

**A. Add a Vitest contract test (recommended)**

New test file `tests/bootstrap/template-gate-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ESSAY_TEMPLATES, bootstrapToBible, bootstrapToScenePlans } from "../../src/bootstrap/index.js";
import { checkScenePlanGate } from "../../src/gates/index.js";

describe("essay template gate contract", () => {
  const fixtureParsed = {
    thesis: "...",
    sections: [{ heading: "Intro", purpose: "Set up the argument", keyPoints: ["p1"] }],
    suggestedTone: { register: "conversational", audience: "readers", pacingNotes: "slow build" },
    suggestedKillList: [],
    structuralBans: [],
  };

  for (const template of ESSAY_TEMPLATES) {
    it(`${template.id}: every produced section passes checkScenePlanGate`, () => {
      const bible = bootstrapToBible(fixtureParsed, "proj-test", "brief", template);
      const authorId = bible.characters[0]!.id;
      const plans = bootstrapToScenePlans(fixtureParsed, "proj-test", authorId, template);
      for (const plan of plans) {
        const gate = checkScenePlanGate(plan);
        expect(gate.passed, `gate failed: ${gate.messages.join("; ")}`).toBe(true);
      }
    });
  }
});
```

- **Pros:** Iterates every registered template. Prevents the exact recurrence pattern. Cheap.
- **Cons:** None.
- **Effort:** Trivial. **Risk:** None.

**B. Also extend to the skip-blank path**
- Add an assertion in `TemplatePicker.test.ts` that the skip-blank placeholder plan passes `checkScenePlanGate`. (Already done for `opinion-piece` in the existing test — extend to `personal-essay` too.)
- **Pros:** Covers the other factory path.
- **Cons:** None.
- **Effort:** Trivial.

## Recommended Action
Do both. Ship them as a single follow-up commit.

## Technical Details

**New file:**
- `tests/bootstrap/template-gate-contract.test.ts`

**Extended file:**
- `tests/ui/composer/TemplatePicker.test.ts` (add `personal-essay` skip-blank case)

## Acceptance Criteria

- [ ] Contract test exists and asserts every `ESSAY_TEMPLATES` entry produces gate-passing sections
- [ ] Skip-blank path is tested for both templates
- [ ] Adding a new template to the registry without `defaultFailureModeForSection` support immediately fails the contract test

## Work Log

(To be filled during implementation.)

## Resources

- PR: https://github.com/sethkravitz/word-compiler/pull/7
- Source solution: `docs/solutions/logic-errors/bootstrap-gate-empty-failure-mode-2026-04-10.md`
- Reviewer: `learnings-researcher`
- Gate: `src/gates/index.ts:11`
