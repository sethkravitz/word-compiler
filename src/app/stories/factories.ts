import type { EditPattern } from "../../learner/diff.js";
import type { TuningProposal } from "../../learner/tuning.js";
import { hashFingerprint } from "../../review/fingerprint.js";
import type { RefinementVariant } from "../../review/refineTypes.js";
import type { EditorialAnnotation } from "../../review/types.js";
import type {
  AuditFlag,
  ChapterArc,
  CharacterDelta,
  Chunk,
  CompilationLog,
  CompiledPayload,
  LintIssue,
  LintResult,
  NarrativeIR,
  Project,
  ProseMetrics,
  ScenePlan,
  StyleDriftReport,
  VoiceSeparabilityReport,
} from "../../types/index.js";
import { createEmptyNarrativeIR, createEmptyScenePlan, generateId } from "../../types/index.js";
import type { SceneEntry } from "../store/project.svelte.js";

// ─── Chunk ─────────────────────────────────────────────

export function makeChunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
    id: generateId(),
    sceneId: "scene-1",
    sequenceNumber: 0,
    generatedText:
      "The rain fell in sheets against the window, each drop a tiny percussion in the symphony of the storm. Elena pressed her forehead to the glass, watching the world dissolve into watercolor.",
    editedText: null,
    humanNotes: null,
    status: "pending",
    model: "claude-sonnet-4-6",
    temperature: 0.85,
    topP: 1,
    payloadHash: "abc123",
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Scene Plan ────────────────────────────────────────

export function makeScenePlan(overrides: Partial<ScenePlan> = {}): ScenePlan {
  return {
    ...createEmptyScenePlan("proj-1"),
    title: "The Hidden Cost",
    povCharacterId: "char-author",
    narrativeGoal: "Establish the central argument through a concrete example",
    emotionalBeat: "Growing unease → dawning recognition",
    readerEffect: "Reader questions their own assumptions about productivity",
    pacing: "Measured opening to sharp pivot",
    density: "dense",
    estimatedWordCount: [800, 1200],
    chunkCount: 3,
    chunkDescriptions: [
      "Open with the anecdote that triggered the investigation",
      "Present the evidence that contradicts conventional wisdom",
      "Draw the connection the reader hasn't made yet",
    ],
    failureModeToAvoid: "Heavy-handed thesis statement; telegraphing the conclusion too early",
    ...overrides,
  };
}

// ─── Scene Entry ───────────────────────────────────────

export function makeSceneEntry(
  id: string,
  title: string,
  status: "planned" | "drafting" | "complete",
  overrides: Partial<SceneEntry> = {},
): SceneEntry {
  return {
    plan: makeScenePlan({ id, title }),
    sceneOrder: 0,
    status,
    ...overrides,
  };
}

// ─── Narrative IR ──────────────────────────────────────

export function makeNarrativeIR(overrides: Partial<NarrativeIR> = {}): NarrativeIR {
  return {
    ...createEmptyNarrativeIR("scene-1"),
    events: [
      "Introduced the remote work productivity paradox",
      "Presented the 2024 Stanford study contradicting earlier findings",
      "Drew the connection between surveillance tools and declining output",
    ],
    factsIntroduced: ["Remote workers log 15% more hours but produce 8% less measurable output"],
    factsRevealedToReader: [
      "The productivity gains were a measurement artifact",
      "The original study had a self-selection bias",
    ],
    factsWithheld: ["The author's own company made the same mistake"],
    characterDeltas: [
      {
        characterId: "char-author",
        learned: "The data contradicts the prevailing narrative",
        suspicionGained: "The metrics themselves may be the problem",
        emotionalShift: "Confidence → doubt",
        relationshipChange: null,
      },
    ],
    unresolvedTensions: [
      "Are we measuring the right things?",
      "What happens when the surveillance tools become the product?",
    ],
    ...overrides,
  };
}

// ─── Audit Flag ────────────────────────────────────────

export function makeAuditFlag(overrides: Partial<AuditFlag> = {}): AuditFlag {
  return {
    id: generateId(),
    sceneId: "scene-1",
    severity: "warning",
    category: "kill-list",
    message: 'Avoid list violation: "suddenly" in paragraph 3',
    lineReference: "P3",
    resolved: false,
    resolvedAction: null,
    wasActionable: null,
    ...overrides,
  };
}

// ─── Compiled Payload ──────────────────────────────────

export function makeCompiledPayload(overrides: Partial<CompiledPayload> = {}): CompiledPayload {
  return {
    systemMessage: [
      "You are an essay writer with a direct, personal voice.",
      "",
      "## VOICE PROFILE",
      "Dense, imagistic prose. Favor concrete sensory detail over abstraction.",
      "Sentence variance: mix short declarative with longer compound-complex.",
      "",
      "## VOICE PROFILES",
      "Primary Author — direct, analytical, grounded in concrete detail.",
      "Secondary Voice — reflective, personal, favors extended metaphor.",
    ].join("\n"),
    userMessage: [
      "## SECTION PLAN",
      "Title: The Core Argument",
      "Goal: Establish the central thesis through personal anecdote",
      "",
      "## PROSE SO FAR",
      "The rain fell in sheets against the window, each drop a tiny percussion",
      "in the symphony of the storm. Elena pressed her forehead to the glass,",
      "watching the world dissolve into watercolor.",
    ].join("\n"),
    temperature: 0.85,
    topP: 1,
    maxTokens: 4096,
    model: "claude-sonnet-4-6",
    ...overrides,
  };
}

// ─── Compilation Log ───────────────────────────────────

export function makeCompilationLog(overrides: Partial<CompilationLog> = {}): CompilationLog {
  return {
    id: generateId(),
    chunkId: "chunk-1",
    payloadHash: "abc123",
    ring1Tokens: 1200,
    ring2Tokens: 800,
    ring3Tokens: 2400,
    totalTokens: 4400,
    availableBudget: 8000,
    ring1Contents: ["HEADER", "BIBLE_VOICE", "BIBLE_CHARACTERS"],
    ring2Contents: ["CHAPTER_ARC", "PREVIOUS_SCENE_SUMMARY"],
    ring3Contents: ["SCENE_PLAN", "PROSE_SO_FAR", "CONTINUITY_BRIDGE"],
    lintWarnings: [],
    lintErrors: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Lint Result ───────────────────────────────────────

export function makeLintResult(issues: LintIssue[] = []): LintResult {
  return { issues };
}

// ─── Prose Metrics ─────────────────────────────────────

export function makeProseMetrics(overrides: Partial<ProseMetrics> = {}): ProseMetrics {
  return {
    wordCount: 342,
    sentenceCount: 28,
    avgSentenceLength: 12.2,
    sentenceLengthStdDev: 4.8,
    typeTokenRatio: 0.68,
    paragraphCount: 6,
    avgParagraphLength: 4.7,
    ...overrides,
  };
}

// ─── Style Drift Report ───────────────────────────────

export function makeStyleDriftReport(
  sceneId: string,
  flagged: boolean,
  drifts: Partial<StyleDriftReport["driftPercent"]> = {},
): StyleDriftReport {
  return {
    baselineSceneId: "scene-1",
    currentSceneId: sceneId,
    baselineMetrics: makeProseMetrics(),
    currentMetrics: makeProseMetrics(),
    driftPercent: {
      avgSentenceLength: 0,
      sentenceLengthStdDev: 0,
      typeTokenRatio: 0,
      avgParagraphLength: 0,
      ...drifts,
    },
    flagged,
    flaggedFields: flagged
      ? Object.keys(drifts).filter((k) => Math.abs(drifts[k as keyof typeof drifts] ?? 0) > 0.1)
      : [],
  };
}

// ─── Voice Separability Report ─────────────────────────

export function makeVoiceReport(overrides: Partial<VoiceSeparabilityReport> = {}): VoiceSeparabilityReport {
  return {
    characterStats: [
      {
        characterId: "char-author",
        characterName: "Author",
        dialogueCount: 24,
        avgSentenceLength: 8.3,
        sentenceLengthStdDev: 3.1,
        typeTokenRatio: 0.72,
      },
      {
        characterId: "char-editor",
        characterName: "Editor",
        dialogueCount: 18,
        avgSentenceLength: 14.6,
        sentenceLengthStdDev: 5.8,
        typeTokenRatio: 0.58,
      },
    ],
    interCharacterVariance: 0.42,
    separable: true,
    detail:
      "Distinct voice signatures: Author uses short, clipped sentences; Editor favors longer, hedging constructions.",
    ...overrides,
  };
}

// ─── Chapter Arc ───────────────────────────────────────

export function makeChapterArc(overrides: Partial<ChapterArc> = {}): ChapterArc {
  return {
    id: generateId(),
    projectId: "proj-1",
    chapterNumber: 1,
    workingTitle: "The Productivity Illusion",
    narrativeFunction: "Establish the central thesis through evidence and personal experience",
    dominantRegister: "Analytical → personal",
    pacingTarget: "Measured opening, accelerating through evidence, reflective close",
    endingPosture: "Open question — the reader must decide what to do with this",
    readerStateEntering: {
      knows: ["Remote work became the default after 2020"],
      suspects: ["The productivity numbers may be inflated"],
      wrongAbout: ["More hours equals more output"],
      activeTensions: ["Is remote work actually working?"],
    },
    readerStateExiting: {
      knows: ["Remote work became the default after 2020", "The metrics are measuring the wrong things"],
      suspects: ["The surveillance tools are making it worse"],
      wrongAbout: [],
      activeTensions: ["What should companies actually measure?", "Can trust replace tracking?"],
    },
    sourcePrompt: null,
    ...overrides,
  };
}

// ─── Edit Pattern ─────────────────────────────────────

export function makeEditPattern(overrides: Partial<EditPattern> = {}): EditPattern {
  return {
    id: generateId(),
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

// ─── Tuning Proposal ──────────────────────────────────

export function makeTuningProposal(overrides: Partial<TuningProposal> = {}): TuningProposal {
  return {
    id: generateId(),
    projectId: "p1",
    parameter: "defaultTemperature",
    currentValue: 0.85,
    suggestedValue: 0.65,
    rationale:
      "Average edit ratio is 45% across 12 chunks. Lowering temperature should produce prose closer to your preferred style.",
    confidence: 0.82,
    evidence: { editedChunkCount: 12, sceneCount: 4, avgEditRatio: 0.45 },
    status: "pending",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Project ──────────────────────────────────────────

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: generateId(),
    title: "Untitled Project",
    status: "bootstrap",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Character Delta ───────────────────────────────────

export function makeCharacterDelta(overrides: Partial<CharacterDelta> = {}): CharacterDelta {
  return {
    characterId: "char-author",
    learned: "The data contradicts the prevailing narrative",
    suspicionGained: "The metrics themselves may be the problem",
    emotionalShift: "Confidence → doubt",
    relationshipChange: null,
    ...overrides,
  };
}

// ─── Refinement Variant ────────────────────────────

export function makeRefinementVariant(overrides: Partial<RefinementVariant> = {}): RefinementVariant {
  return {
    text: "The rain hammered against the window, each drop a tiny percussion in the storm's symphony.",
    rationale: "Stronger verb choice; inverted metaphor order for freshness.",
    killListClean: true,
    killListViolations: [],
    ...overrides,
  };
}

// ─── Editorial Annotation ──────────────────────────────

export function makeEditorialAnnotation(overrides: Partial<EditorialAnnotation> = {}): EditorialAnnotation {
  const category = overrides.category ?? "kill_list";
  const focus = overrides.anchor?.focus ?? "very";
  return {
    id: generateId(),
    category,
    severity: "warning",
    scope: "both",
    message: `Kill list violation: "very" weakens prose`,
    suggestion: null,
    anchor: {
      prefix: "She was ",
      focus,
      suffix: " happy and ",
    },
    charRange: { start: 8, end: 12 },
    fingerprint: hashFingerprint(category, focus),
    ...overrides,
  };
}
