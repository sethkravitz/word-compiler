import type Anthropic from "@anthropic-ai/sdk";
import type {
  DeltaResponse,
  DocumentAnalysis,
  FilteredFeature,
  PipelineConfig,
  VoiceGuide,
  VoiceGuideVersion,
} from "../../src/profile/types.js";
import { DELTA_SYSTEM, buildDeltaUpdatePrompt } from "../../src/profile/prompts.js";
import { structuredCall } from "./llm.js";

// ─── Version Bumping ─────────────────────────────────────

export interface VersionBumpInput {
  strongContradictions: number;
  newFeatures: number;
  hasTransfer: boolean;
  hasEvolution: boolean;
}

export function bumpVersion(current: string, changes: VersionBumpInput, config: PipelineConfig): string {
  const [major, minor, patch] = current.split(".").map(Number) as [number, number, number];

  // Major bump: strong contradictions or evolution
  if (changes.strongContradictions >= config.fullRegenStrongContradictions || changes.hasEvolution) {
    return `${major + 1}.0.0`;
  }

  // Minor bump: new features meeting threshold or transfer validations
  if (changes.newFeatures >= config.fullRegenNewFeatures || changes.hasTransfer) {
    return `${major}.${minor + 1}.0`;
  }

  // Patch bump: confidence-only changes
  return `${major}.${minor}.${patch + 1}`;
}

// ─── Confidence Helpers ──────────────────────────────────

function upgradeConfidence(level: "low" | "medium" | "high"): "low" | "medium" | "high" {
  if (level === "low") return "medium";
  if (level === "medium") return "high";
  return "high";
}

function downgradeConfidence(level: "low" | "medium" | "high"): "low" | "medium" | "high" {
  if (level === "high") return "medium";
  if (level === "medium") return "low";
  return "low";
}

// ─── Feature Search Helper ───────────────────────────────

function findFeatureByName(
  guide: VoiceGuide,
  name: string,
): { feature: FilteredFeature; list: FilteredFeature[] } | null {
  for (const list of [
    guide.coreFeatures,
    guide.probableFeatures,
    guide.domainSpecificFeatures,
    guide.avoidancePatterns,
  ]) {
    const feature = list.find((f) => f.featureName === name);
    if (feature) return { feature, list };
  }
  return null;
}

// ─── Apply Delta ─────────────────────────────────────────

export function applyDelta(
  guide: VoiceGuide,
  delta: DeltaResponse,
  newAnalyses: DocumentAnalysis[],
  newDomain: string,
  config: PipelineConfig,
): VoiceGuide {
  // 1. Deep clone
  const updated = structuredClone(guide);

  // 2. Confirmed features: upgrade confidence
  for (const confirmed of delta.confirmed) {
    const match = findFeatureByName(updated, confirmed.featureName);
    if (match) {
      match.feature.confidence = upgradeConfidence(match.feature.confidence);
    }
  }

  // 3. Contradicted features
  let strongContradictions = 0;
  for (const contradicted of delta.contradicted) {
    const match = findFeatureByName(updated, contradicted.featureName);
    if (contradicted.strength === "strong") {
      strongContradictions++;
      if (match) {
        match.feature.filterRationale += `[FLAGGED: strong contradiction — ${contradicted.evidence}]`;
      }
    } else {
      // weak: downgrade confidence
      if (match) {
        match.feature.confidence = downgradeConfidence(match.feature.confidence);
      }
    }
  }

  // 4. Bump version
  const versionInput: VersionBumpInput = {
    strongContradictions,
    newFeatures: delta.newFeatures.length,
    hasTransfer: delta.transferValidated.length > 0,
    hasEvolution: delta.evolutionSignals !== null && delta.evolutionSignals !== "",
  };
  updated.version = bumpVersion(guide.version, versionInput, config);

  // 5. Update corpus size
  updated.corpusSize += newAnalyses.length;

  // 6. Add new domain if not present
  if (!updated.domainsRepresented.includes(newDomain)) {
    updated.domainsRepresented.push(newDomain);
  }

  // 7. Append version history entry
  const versionEntry: VoiceGuideVersion = {
    version: updated.version,
    updatedAt: new Date().toISOString(),
    changeReason: delta.evolutionSignals ?? "incremental update",
    changeSummary: [
      `${delta.confirmed.length} confirmed`,
      `${delta.contradicted.length} contradicted`,
      `${delta.newFeatures.length} new`,
      `${delta.transferValidated.length} transfer-validated`,
    ].join(", "),
    confirmedFeatures: delta.confirmed.map((c) => c.featureName),
    contradictedFeatures: delta.contradicted.map((c) => c.featureName),
    newFeatures: delta.newFeatures.map((f) => f.name),
  };
  updated.versionHistory.push(versionEntry);

  // 8. Update timestamp
  updated.updatedAt = new Date().toISOString();

  return updated;
}

// ─── Delta Response Schema ───────────────────────────────

const DELTA_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    confirmed: {
      type: "array",
      items: {
        type: "object",
        properties: {
          featureName: { type: "string" },
          evidence: { type: "string" },
        },
        required: ["featureName", "evidence"],
      },
    },
    contradicted: {
      type: "array",
      items: {
        type: "object",
        properties: {
          featureName: { type: "string" },
          strength: { type: "string", enum: ["weak", "strong"] },
          evidence: { type: "string" },
        },
        required: ["featureName", "strength", "evidence"],
      },
    },
    newFeatures: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          evidence: { type: "string" },
          confidence: { type: "string" },
        },
        required: ["name", "description", "evidence", "confidence"],
      },
    },
    transferValidated: {
      type: "array",
      items: {
        type: "object",
        properties: {
          featureName: { type: "string" },
          outcome: { type: "string", enum: ["correct", "incorrect", "partial"] },
          note: { type: "string" },
        },
        required: ["featureName", "outcome", "note"],
      },
    },
    evolutionSignals: { type: ["string", "null"] },
  },
  required: ["confirmed", "contradicted", "newFeatures", "transferValidated", "evolutionSignals"],
};

// ─── Run Delta Update ────────────────────────────────────

export async function runDeltaUpdate(
  existingGuide: VoiceGuide,
  newAnalyses: DocumentAnalysis[],
  newDomain: string,
  config: PipelineConfig,
  client: Anthropic,
): Promise<VoiceGuide> {
  // 1. Serialize existing guide features and new analyses
  const existingCoreFeaturesJson = JSON.stringify(
    [...existingGuide.coreFeatures, ...existingGuide.probableFeatures],
    null,
    2,
  );
  const existingAvoidanceJson = JSON.stringify(existingGuide.avoidancePatterns, null, 2);
  const newAnalysesJson = JSON.stringify(newAnalyses, null, 2);

  // 2. Call LLM
  const prompt = buildDeltaUpdatePrompt(
    existingGuide.narrativeSummary,
    existingCoreFeaturesJson,
    existingAvoidanceJson,
    newAnalysesJson,
    newDomain,
    existingGuide.domainsRepresented,
  );

  const delta = await structuredCall<DeltaResponse>(
    client,
    config.deltaUpdateModel,
    DELTA_SYSTEM,
    prompt,
    DELTA_RESPONSE_SCHEMA,
    "delta_response",
  );

  // 3. Apply and return
  return applyDelta(existingGuide, delta, newAnalyses, newDomain, config);
}
