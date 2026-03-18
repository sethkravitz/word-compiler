import type Anthropic from "@anthropic-ai/sdk";
import type {
  CrossDocumentResult,
  FilterResponse,
  FilteredFeature,
  PipelineConfig,
  VoiceGuide,
} from "../../src/profile/types.js";
import { STAGE5_SYSTEM, buildStage5Prompt } from "../../src/profile/prompts.js";
import { textCall } from "./llm.js";

/**
 * Extract FOR GENERATION, FOR EDITING, and CONFIDENCE NOTES sections from
 * the voice guide prose text. Falls back to sensible defaults if sections
 * are not found.
 */
export function extractSections(guideText: string): { generation: string; editing: string; confidence: string } {
  const generationMatch = guideText.match(/FOR GENERATION:\s*([\s\S]*?)(?=FOR EDITING)/i);
  const editingMatch = guideText.match(/FOR EDITING:\s*([\s\S]*?)(?=\d+\.\s|CONFIDENCE NOTES)/i);
  const confidenceMatch = guideText.match(/CONFIDENCE NOTES\s*([\s\S]*?)$/i);

  return {
    generation: generationMatch?.[1]?.trim() ?? "Follow the voice guide features when generating new text.",
    editing: editingMatch?.[1]?.trim() ?? "Check text against the identified voice features during editing.",
    confidence: confidenceMatch?.[1]?.trim() ?? "Confidence levels are indicated per-feature above.",
  };
}

export async function generateVoiceGuide(
  filterResult: FilterResponse,
  crossDoc: CrossDocumentResult,
  nDocuments: number,
  config: PipelineConfig,
  client: Anthropic,
): Promise<VoiceGuide> {
  // Categorize features
  const avoidance: FilteredFeature[] = [];
  const core: FilteredFeature[] = [];
  const probable: FilteredFeature[] = [];
  const domainSpecific: FilteredFeature[] = [];
  const flagged: FilteredFeature[] = [];

  for (const feature of filterResult.filteredFeatures) {
    if (feature.domainFilterDecision === "filter") {
      domainSpecific.push(feature);
    } else if (feature.domainFilterDecision === "flag_for_shedding") {
      flagged.push(feature);
    } else if (feature.isAvoidancePattern) {
      avoidance.push(feature);
    } else if (feature.confidence === "low") {
      probable.push(feature);
    } else {
      core.push(feature);
    }
  }

  // Count confidence levels across kept features (non-filtered)
  const kept = filterResult.filteredFeatures.filter((f) => f.domainFilterDecision !== "filter");
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  for (const f of kept) {
    if (f.confidence === "high") highCount++;
    else if (f.confidence === "medium") mediumCount++;
    else lowCount++;
  }

  // Features needing new objects
  const needsNewObjectNames = filterResult.filteredFeatures
    .filter((f) => f.needsNewObject)
    .map((f) => f.featureName);

  // Build the features JSON for the prompt (all kept + flagged features)
  const allRelevant = [...core, ...probable, ...avoidance, ...flagged];
  const featuresJson = JSON.stringify(allRelevant, null, 2);

  const prompt = buildStage5Prompt(
    featuresJson,
    nDocuments,
    config.sourceDomain,
    config.targetDomain,
    highCount,
    mediumCount,
    lowCount,
    needsNewObjectNames,
  );

  const guideText = await textCall(client, config.stage5GuideModel, STAGE5_SYSTEM, prompt);

  const { generation, editing, confidence } = extractSections(guideText);

  // Collect domains represented
  const domains = new Set<string>();
  if (config.sourceDomain) domains.add(config.sourceDomain);
  if (config.targetDomain) domains.add(config.targetDomain);

  const now = new Date().toISOString();

  return {
    version: "1.0.0",
    versionHistory: [
      {
        version: "1.0.0",
        updatedAt: now,
        changeReason: "Initial voice guide generation",
        changeSummary: `Generated from ${nDocuments} documents. ${core.length} core features, ${probable.length} probable features, ${avoidance.length} avoidance patterns identified.`,
        confirmedFeatures: core.map((f) => f.featureName),
        contradictedFeatures: [],
        newFeatures: [...core, ...probable, ...avoidance].map((f) => f.featureName),
      },
    ],
    corpusSize: nDocuments,
    domainsRepresented: [...domains],
    coreFeatures: core,
    probableFeatures: probable,
    formatVariantFeatures: crossDoc.formatVariantFeatures,
    domainSpecificFeatures: domainSpecific,
    avoidancePatterns: avoidance,
    narrativeSummary: guideText,
    generationInstructions: generation,
    editingInstructions: editing,
    confidenceNotes: confidence,
    updatedAt: now,
  };
}
