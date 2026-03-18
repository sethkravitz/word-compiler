import { describe, expect, it } from "vitest";
import { bumpVersion, applyDelta } from "../../server/profile/delta.js";
import { createDefaultPipelineConfig, createEmptyVoiceGuide } from "@/profile/types.js";
import type { DeltaResponse, DocumentAnalysis, FilteredFeature } from "@/profile/types.js";

describe("bumpVersion", () => {
  const config = createDefaultPipelineConfig();

  it("bumps patch for confidence-only changes", () => {
    expect(
      bumpVersion("1.0.0", { strongContradictions: 0, newFeatures: 0, hasTransfer: false, hasEvolution: false }, config),
    ).toBe("1.0.1");
  });
  it("bumps minor for new features meeting threshold", () => {
    expect(
      bumpVersion(
        "1.0.0",
        { strongContradictions: 0, newFeatures: config.fullRegenNewFeatures, hasTransfer: false, hasEvolution: false },
        config,
      ),
    ).toBe("1.1.0");
  });
  it("bumps minor for transfer validations", () => {
    expect(
      bumpVersion("1.2.3", { strongContradictions: 0, newFeatures: 0, hasTransfer: true, hasEvolution: false }, config),
    ).toBe("1.3.0");
  });
  it("bumps major for strong contradictions", () => {
    expect(
      bumpVersion(
        "1.0.0",
        {
          strongContradictions: config.fullRegenStrongContradictions,
          newFeatures: 0,
          hasTransfer: false,
          hasEvolution: false,
        },
        config,
      ),
    ).toBe("2.0.0");
  });
  it("bumps major for evolution signals", () => {
    expect(
      bumpVersion("2.1.4", { strongContradictions: 0, newFeatures: 0, hasTransfer: false, hasEvolution: true }, config),
    ).toBe("3.0.0");
  });
});

describe("applyDelta", () => {
  it("upgrades confidence for confirmed features", () => {
    const guide = createEmptyVoiceGuide();
    const feature: FilteredFeature = {
      featureName: "warm tone",
      description: "warm",
      documentCount: 2,
      totalDocuments: 2,
      evidenceExamples: [],
      confidence: "low",
      transferability: "transferable",
      transferabilityRationale: "",
      isAvoidancePattern: false,
      domainFilterDecision: "keep",
      filterRationale: "",
      needsNewObject: false,
      newObjectNote: null,
    };
    guide.coreFeatures = [feature];
    guide.version = "1.0.0";

    const delta: DeltaResponse = {
      confirmed: [{ featureName: "warm tone", evidence: "seen again" }],
      contradicted: [],
      newFeatures: [],
      transferValidated: [],
      evolutionSignals: null,
    };
    const config = createDefaultPipelineConfig();
    const updated = applyDelta(guide, delta, [], "blog", config);
    expect(updated.coreFeatures[0]!.confidence).toBe("medium");
    expect(updated.version).toBe("1.0.1");
  });

  it("does not mutate original guide", () => {
    const guide = createEmptyVoiceGuide();
    guide.version = "1.0.0";
    const delta: DeltaResponse = {
      confirmed: [],
      contradicted: [],
      newFeatures: [],
      transferValidated: [],
      evolutionSignals: null,
    };
    const config = createDefaultPipelineConfig();
    const updated = applyDelta(guide, delta, [], "blog", config);
    expect(updated).not.toBe(guide);
    expect(guide.version).toBe("1.0.0");
  });
});
