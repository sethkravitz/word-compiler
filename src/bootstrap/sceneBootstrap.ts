import type { CompiledPayload, ScenePlan } from "../types/index.js";
import { createEmptyScenePlan, generateId } from "../types/index.js";

// ─── Types ─────────────────────────────────────────────

export interface ExistingSceneSummary {
  title: string;
  povCharacterName: string;
  povDistance: string;
  narrativeGoal: string;
  emotionalBeat: string;
  readerStateExiting: {
    knows: string[];
    suspects: string[];
    wrongAbout: string[];
    activeTensions: string[];
  } | null;
}

export interface BootstrapChapterArc {
  workingTitle: string;
  narrativeFunction: string;
  dominantRegister: string;
  pacingTarget: string;
  endingPosture: string;
}

export interface BootstrapNarrativeRules {
  pov: {
    default: string;
    distance: string;
    interiority: string;
    reliability: string;
    notes?: string;
  };
  subtextPolicy: string | null;
  expositionPolicy: string | null;
  sceneEndingPolicy: string | null;
}

export interface BootstrapCharacterDossier {
  name: string;
  role: string;
  backstory: string | null;
  contradictions: string[] | null;
  voice: {
    vocabularyNotes: string | null;
    verbalTics: string[];
    prohibitedLanguage: string[];
    metaphoricRegister: string | null;
  };
  behavior: {
    stressResponse: string | null;
    noticesFirst: string | null;
    emotionPhysicality: string | null;
  } | null;
}

export interface BootstrapLocationDetail {
  name: string;
  description: string | null;
  atmosphere: string | null;
  sounds: string[];
  smells: string[];
  prohibitedDefaults: string[];
}

export interface BootstrapActiveSetup {
  description: string;
  status: string;
}

export interface SceneBootstrapParams {
  direction: string;
  sceneCount: number;
  characters: { id: string; name: string; role: string }[];
  locations: { id: string; name: string }[];
  constraints?: string;
  includeChapterArc: boolean;
  // Optional rich context
  existingScenes?: ExistingSceneSummary[];
  chapterArc?: BootstrapChapterArc;
  narrativeRules?: BootstrapNarrativeRules;
  activeSetups?: BootstrapActiveSetup[];
  characterDossiers?: BootstrapCharacterDossier[];
  locationDetails?: BootstrapLocationDetail[];
  killList?: string[];
  structuralBans?: string[];
}

export interface ParsedSceneBootstrap {
  scenes: Array<{
    title?: string;
    povCharacterId?: string;
    povCharacterName?: string;
    povDistance?: string;
    narrativeGoal?: string;
    emotionalBeat?: string;
    readerEffect?: string;
    failureModeToAvoid?: string;
    density?: string;
    pacing?: string;
    sensoryNotes?: string;
    locationId?: string;
    locationName?: string;
    estimatedWordCount?: [number, number] | number;
    chunkCount?: number;
    chunkDescriptions?: string[];
    readerStateEntering?: {
      knows?: string[];
      suspects?: string[];
      wrongAbout?: string[];
      activeTensions?: string[];
    };
    readerStateExiting?: {
      knows?: string[];
      suspects?: string[];
      wrongAbout?: string[];
      activeTensions?: string[];
    };
    subtext?: {
      surfaceConversation?: string;
      actualConversation?: string;
      enforcementRule?: string;
    };
    sceneSpecificProhibitions?: string[];
    anchorLines?: Array<{
      text?: string;
      placement?: string;
      verbatim?: boolean;
    }>;
  }>;
  chapterArc?: {
    workingTitle?: string;
    narrativeFunction?: string;
    dominantRegister?: string;
    pacingTarget?: string;
    endingPosture?: string;
    readerStateEntering?: {
      knows?: string[];
      suspects?: string[];
      wrongAbout?: string[];
      activeTensions?: string[];
    };
    readerStateExiting?: {
      knows?: string[];
      suspects?: string[];
      wrongAbout?: string[];
      activeTensions?: string[];
    };
  };
}

// ─── Prompt Builder ────────────────────────────────────

const readerStateSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    knows: { type: "array", items: { type: "string" } },
    suspects: { type: "array", items: { type: "string" } },
    wrongAbout: { type: "array", items: { type: "string" } },
    activeTensions: { type: "array", items: { type: "string" } },
  },
  required: ["knows", "suspects", "wrongAbout", "activeTensions"],
};

export const sceneBootstrapSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          povCharacterId: { type: "string" },
          povCharacterName: { type: "string" },
          povDistance: { type: "string" },
          narrativeGoal: { type: "string" },
          emotionalBeat: { type: "string" },
          readerEffect: { type: "string" },
          failureModeToAvoid: { type: "string" },
          density: { type: "string" },
          pacing: { type: "string" },
          sensoryNotes: { type: "string" },
          locationId: { type: "string" },
          locationName: { type: "string" },
          estimatedWordCount: { type: "array", items: { type: "number" } },
          chunkCount: { type: "number" },
          chunkDescriptions: { type: "array", items: { type: "string" } },
          readerStateEntering: readerStateSchema,
          readerStateExiting: readerStateSchema,
          subtext: {
            type: "object",
            additionalProperties: false,
            properties: {
              surfaceConversation: { type: "string" },
              actualConversation: { type: "string" },
              enforcementRule: { type: "string" },
            },
            required: ["surfaceConversation", "actualConversation", "enforcementRule"],
          },
          sceneSpecificProhibitions: { type: "array", items: { type: "string" } },
          anchorLines: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string" },
                placement: { type: "string" },
                verbatim: { type: "boolean" },
              },
              required: ["text", "placement", "verbatim"],
            },
          },
        },
        required: [
          "title",
          "povCharacterId",
          "povCharacterName",
          "povDistance",
          "narrativeGoal",
          "emotionalBeat",
          "readerEffect",
          "failureModeToAvoid",
          "density",
          "pacing",
          "sensoryNotes",
          "locationId",
          "locationName",
          "estimatedWordCount",
          "chunkCount",
          "chunkDescriptions",
          "readerStateEntering",
          "readerStateExiting",
          "subtext",
          "sceneSpecificProhibitions",
          "anchorLines",
        ],
      },
    },
    chapterArc: {
      type: "object",
      additionalProperties: false,
      properties: {
        workingTitle: { type: "string" },
        narrativeFunction: { type: "string" },
        dominantRegister: { type: "string" },
        pacingTarget: { type: "string" },
        endingPosture: { type: "string" },
        readerStateEntering: readerStateSchema,
        readerStateExiting: readerStateSchema,
      },
      required: [
        "workingTitle",
        "narrativeFunction",
        "dominantRegister",
        "pacingTarget",
        "endingPosture",
        "readerStateEntering",
        "readerStateExiting",
      ],
    },
  },
  required: ["scenes", "chapterArc"],
};

// ─── Condensation Helpers ─────────────────────────────

export function condensedExistingScenes(scenes: ExistingSceneSummary[] | undefined): string {
  if (!scenes || scenes.length === 0) return "";
  return scenes
    .map((s, i) => {
      const parts = [`${i + 1}. "${s.title}" — POV: ${s.povCharacterName} (${s.povDistance})`];
      if (s.narrativeGoal) parts.push(`   Goal: ${s.narrativeGoal}`);
      if (s.emotionalBeat) parts.push(`   Beat: ${s.emotionalBeat}`);
      if (s.readerStateExiting) {
        const exit = s.readerStateExiting;
        const items: string[] = [];
        if (exit.knows.length > 0) items.push(`knows: ${exit.knows.join("; ")}`);
        if (exit.suspects.length > 0) items.push(`suspects: ${exit.suspects.join("; ")}`);
        if (exit.wrongAbout.length > 0) items.push(`wrong about: ${exit.wrongAbout.join("; ")}`);
        if (exit.activeTensions.length > 0) items.push(`tensions: ${exit.activeTensions.join("; ")}`);
        if (items.length > 0) parts.push(`   Reader exits: ${items.join(" | ")}`);
      }
      return parts.join("\n");
    })
    .join("\n");
}

export function condensedCharacterDossiers(dossiers: BootstrapCharacterDossier[] | undefined): string {
  if (!dossiers || dossiers.length === 0) return "";
  return dossiers
    .map((c) => {
      const parts = [`- ${c.name} (${c.role})`];
      if (c.backstory) parts.push(`  Backstory: ${c.backstory}`);
      if (c.contradictions && c.contradictions.length > 0)
        parts.push(`  Contradictions: ${c.contradictions.join("; ")}`);
      const voiceParts: string[] = [];
      if (c.voice.vocabularyNotes) voiceParts.push(c.voice.vocabularyNotes);
      if (c.voice.verbalTics.length > 0) voiceParts.push(`tics: ${c.voice.verbalTics.join(", ")}`);
      if (c.voice.prohibitedLanguage.length > 0)
        voiceParts.push(`never says: ${c.voice.prohibitedLanguage.join(", ")}`);
      if (c.voice.metaphoricRegister) voiceParts.push(`metaphor register: ${c.voice.metaphoricRegister}`);
      if (voiceParts.length > 0) parts.push(`  Voice: ${voiceParts.join(" | ")}`);
      if (c.behavior) {
        const bParts: string[] = [];
        if (c.behavior.stressResponse) bParts.push(`stress: ${c.behavior.stressResponse}`);
        if (c.behavior.noticesFirst) bParts.push(`notices first: ${c.behavior.noticesFirst}`);
        if (c.behavior.emotionPhysicality) bParts.push(`emotion: ${c.behavior.emotionPhysicality}`);
        if (bParts.length > 0) parts.push(`  Behavior: ${bParts.join(" | ")}`);
      }
      return parts.join("\n");
    })
    .join("\n");
}

export function condensedLocationDetails(locations: BootstrapLocationDetail[] | undefined): string {
  if (!locations || locations.length === 0) return "";
  return locations
    .map((l) => {
      const parts = [`- ${l.name}`];
      if (l.description) parts.push(`  ${l.description}`);
      if (l.atmosphere) parts.push(`  Atmosphere: ${l.atmosphere}`);
      const sensory: string[] = [];
      if (l.sounds.length > 0) sensory.push(`sounds: ${l.sounds.join(", ")}`);
      if (l.smells.length > 0) sensory.push(`smells: ${l.smells.join(", ")}`);
      if (sensory.length > 0) parts.push(`  Senses: ${sensory.join(" | ")}`);
      if (l.prohibitedDefaults.length > 0) parts.push(`  Avoid: ${l.prohibitedDefaults.join(", ")}`);
      return parts.join("\n");
    })
    .join("\n");
}

export function condensedNarrativeRules(rules: BootstrapNarrativeRules | undefined): string {
  if (!rules) return "";
  const parts: string[] = [];
  const pov = rules.pov;
  parts.push(
    `POV CONTRACT: ${pov.default} person, ${pov.distance} distance, ${pov.interiority} interiority, ${pov.reliability} narrator.`,
  );
  if (pov.notes) parts.push(`POV notes: ${pov.notes}`);
  if (rules.subtextPolicy) parts.push(`SUBTEXT POLICY: ${rules.subtextPolicy}`);
  if (rules.expositionPolicy) parts.push(`EXPOSITION POLICY: ${rules.expositionPolicy}`);
  if (rules.sceneEndingPolicy) parts.push(`SCENE ENDING POLICY: ${rules.sceneEndingPolicy}`);
  return parts.join("\n");
}

export function condensedKillListAndBans(killList: string[] | undefined, structuralBans: string[] | undefined): string {
  const parts: string[] = [];
  if (killList && killList.length > 0) {
    parts.push(`NEVER USE these words/phrases: ${killList.join(", ")}`);
  }
  if (structuralBans && structuralBans.length > 0) {
    parts.push(`STRUCTURAL RULES: ${structuralBans.join("; ")}`);
  }
  return parts.join("\n");
}

export function buildSceneBootstrapPrompt(params: SceneBootstrapParams): CompiledPayload {
  const characterList =
    params.characters.length > 0
      ? `\nAvailable characters:\n${params.characters.map((c) => `- ${c.name} (id: "${c.id}", role: ${c.role})`).join("\n")}`
      : "";

  const locationList =
    params.locations.length > 0
      ? `\nAvailable locations:\n${params.locations.map((l) => `- ${l.name} (id: "${l.id}")`).join("\n")}`
      : "";

  const constraintBlock = params.constraints ? `\nAdditional constraints:\n${params.constraints}` : "";

  const chapterArcInstruction = params.includeChapterArc
    ? `\nAlso include a "chapterArc" field with: workingTitle, narrativeFunction, dominantRegister, pacingTarget, endingPosture, readerStateEntering, readerStateExiting.`
    : "";

  // Build system message with optional narrative rules and kill list
  const systemParts = [
    `You are a narrative architect. Given direction for a chapter, generate ${params.sceneCount} scene plans that form a cohesive chapter arc. Each scene must maintain continuity — the readerStateExiting of scene N should inform the readerStateEntering of scene N+1. Be specific and opinionated.`,
  ];
  const rulesBlock = condensedNarrativeRules(params.narrativeRules);
  if (rulesBlock) systemParts.push("", rulesBlock);
  const bansBlock = condensedKillListAndBans(params.killList, params.structuralBans);
  if (bansBlock) systemParts.push("", bansBlock);
  const systemMessage = systemParts.join("\n");

  // Build context blocks for user message
  const contextBlocks: string[] = [];

  if (params.chapterArc) {
    const a = params.chapterArc;
    contextBlocks.push(
      `ESTABLISHED CHAPTER ARC:\nTitle: ${a.workingTitle}\nFunction: ${a.narrativeFunction}\nRegister: ${a.dominantRegister}\nPacing: ${a.pacingTarget}\nEnding: ${a.endingPosture}`,
    );
  }

  const scenesBlock = condensedExistingScenes(params.existingScenes);
  if (scenesBlock) {
    contextBlocks.push(`EXISTING SCENES (do not contradict or duplicate):\n${scenesBlock}`);
  }

  const dossiersBlock = condensedCharacterDossiers(params.characterDossiers);
  if (dossiersBlock) {
    contextBlocks.push(`CHARACTER DOSSIERS:\n${dossiersBlock}`);
  }

  const locsBlock = condensedLocationDetails(params.locationDetails);
  if (locsBlock) {
    contextBlocks.push(`LOCATION DETAILS:\n${locsBlock}`);
  }

  if (params.activeSetups && params.activeSetups.length > 0) {
    const setupLines = params.activeSetups.map((s) => `- [${s.status}] ${s.description}`).join("\n");
    contextBlocks.push(`ACTIVE SETUPS:\n${setupLines}`);
  }

  const contextSection = contextBlocks.length > 0 ? `\n\n${contextBlocks.join("\n\n")}\n` : "";

  // Continuity note when appending to existing scenes
  const existingCount = params.existingScenes?.length ?? 0;
  const continuityNote =
    existingCount > 0
      ? `\nYou are generating scenes ${existingCount + 1} through ${existingCount + params.sceneCount}. New scenes must continue seamlessly from existing ones.`
      : "";

  const userMessage = `CHAPTER DIRECTION:
${params.direction}${contextSection}

Generate exactly ${params.sceneCount} scene plans.${characterList}${locationList}${constraintBlock}

Return JSON:
{
  "scenes": [
    {
      "title": "Scene title",
      "povCharacterId": "REQUIRED — exact character id from the list above",
      "povCharacterName": "REQUIRED — exact character name matching the id",
      "povDistance": "intimate|close|moderate|distant",
      "narrativeGoal": "What must this scene accomplish?",
      "emotionalBeat": "What should the reader FEEL?",
      "readerEffect": "What shifts in the reader's understanding?",
      "failureModeToAvoid": "What would make this scene fail?",
      "density": "sparse|moderate|dense",
      "pacing": "Pacing notes",
      "sensoryNotes": "Key sensory details to anchor the scene",
      "locationId": "location id from list above, or null",
      "locationName": "location name for reference",
      "estimatedWordCount": [min, max],
      "chunkCount": 3,
      "chunkDescriptions": ["what happens in chunk 1", "chunk 2", "chunk 3"],
      "readerStateEntering": {
        "knows": ["what the reader knows going in"],
        "suspects": ["what the reader suspects"],
        "wrongAbout": ["what the reader is wrong about"],
        "activeTensions": ["unresolved tensions"]
      },
      "readerStateExiting": {
        "knows": ["what the reader knows after"],
        "suspects": ["new suspicions"],
        "wrongAbout": ["remaining misconceptions"],
        "activeTensions": ["new or continuing tensions"]
      },
      "subtext": {
        "surfaceConversation": "What characters appear to discuss",
        "actualConversation": "What's really being communicated",
        "enforcementRule": "How to maintain the gap"
      },
      "sceneSpecificProhibitions": ["things to avoid in this specific scene"],
      "anchorLines": [
        { "text": "A line that must appear", "placement": "where in the scene", "verbatim": true }
      ]
    }
  ]${
    params.includeChapterArc
      ? `,
  "chapterArc": {
    "workingTitle": "Chapter working title",
    "narrativeFunction": "What this chapter accomplishes in the larger story",
    "dominantRegister": "The tonal register",
    "pacingTarget": "Overall pacing description",
    "endingPosture": "How the chapter should end",
    "readerStateEntering": { "knows": [], "suspects": [], "wrongAbout": [], "activeTensions": [] },
    "readerStateExiting": { "knows": [], "suspects": [], "wrongAbout": [], "activeTensions": [] }
  }`
      : ""
  }
}

CRITICAL: Maintain reader state continuity across scenes. Scene 2's readerStateEntering must build on Scene 1's readerStateExiting.${chapterArcInstruction}${continuityNote}`;

  return {
    systemMessage,
    userMessage,
    temperature: 0.7,
    topP: 0.92,
    maxTokens: 8000,
    model: "claude-sonnet-4-6",
  };
}

// ─── Response Parser ───────────────────────────────────

export function parseSceneBootstrapResponse(
  response: string,
): ParsedSceneBootstrap | { error: string; rawText: string } {
  // Try 1: direct parse
  try {
    return JSON.parse(response) as ParsedSceneBootstrap;
  } catch {
    // continue
  }

  // Try 2: strip markdown code fences
  const fenceMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1]) as ParsedSceneBootstrap;
    } catch {
      // continue
    }
  }

  // Try 3: extract first {...} block by brace-depth counting
  const startIdx = response.indexOf("{");
  if (startIdx !== -1) {
    let depth = 0;
    for (let i = startIdx; i < response.length; i++) {
      if (response[i] === "{") depth++;
      if (response[i] === "}") depth--;
      if (depth === 0) {
        try {
          return JSON.parse(response.slice(startIdx, i + 1)) as ParsedSceneBootstrap;
        } catch {
          break;
        }
      }
    }
  }

  return { error: "Failed to parse scene bootstrap response as JSON", rawText: response };
}

// ─── Mapper ────────────────────────────────────────────

function resolveReaderState(raw?: {
  knows?: string[];
  suspects?: string[];
  wrongAbout?: string[];
  activeTensions?: string[];
}) {
  if (!raw) return null;
  return {
    knows: raw.knows ?? [],
    suspects: raw.suspects ?? [],
    wrongAbout: raw.wrongAbout ?? [],
    activeTensions: raw.activeTensions ?? [],
  };
}

export function mapSceneBootstrapToPlans(
  parsed: ParsedSceneBootstrap,
  projectId: string,
  characters: { id: string; name: string }[],
  locations: { id: string; name: string }[],
): ScenePlan[] {
  return (parsed.scenes || []).map((raw) => {
    const base = createEmptyScenePlan(projectId);

    // Resolve character by name if ID not directly matched
    let povCharacterId = raw.povCharacterId || "";
    if (povCharacterId && !characters.some((c) => c.id === povCharacterId)) {
      const byName = characters.find((c) => c.name.toLowerCase() === (raw.povCharacterName || "").toLowerCase());
      if (byName) povCharacterId = byName.id;
    }
    if (!povCharacterId && raw.povCharacterName) {
      const byName = characters.find((c) => c.name.toLowerCase() === raw.povCharacterName!.toLowerCase());
      if (byName) povCharacterId = byName.id;
    }

    // Resolve location by name if ID not matched
    let locationId = raw.locationId || null;
    if (locationId && !locations.some((l) => l.id === locationId)) {
      const byName = locations.find((l) => l.name.toLowerCase() === (raw.locationName || "").toLowerCase());
      locationId = byName?.id ?? null;
    }
    if (!locationId && raw.locationName) {
      const byName = locations.find((l) => l.name.toLowerCase() === raw.locationName!.toLowerCase());
      locationId = byName?.id ?? null;
    }

    // Normalize estimated word count
    let estimatedWordCount: [number, number] = base.estimatedWordCount;
    if (Array.isArray(raw.estimatedWordCount) && raw.estimatedWordCount.length >= 2) {
      estimatedWordCount = [raw.estimatedWordCount[0]!, raw.estimatedWordCount[1]!];
    } else if (typeof raw.estimatedWordCount === "number") {
      estimatedWordCount = [Math.floor(raw.estimatedWordCount * 0.8), Math.ceil(raw.estimatedWordCount * 1.2)];
    }

    const density = (["sparse", "moderate", "dense"].includes(raw.density || "") ? raw.density : base.density) as
      | "sparse"
      | "moderate"
      | "dense";

    const povDistance = (
      ["intimate", "close", "moderate", "distant"].includes(raw.povDistance || "") ? raw.povDistance : base.povDistance
    ) as "intimate" | "close" | "moderate" | "distant";

    return {
      ...base,
      id: generateId(),
      title: raw.title || base.title,
      povCharacterId,
      povDistance,
      narrativeGoal: raw.narrativeGoal || base.narrativeGoal,
      emotionalBeat: raw.emotionalBeat || base.emotionalBeat,
      readerEffect: raw.readerEffect || base.readerEffect,
      failureModeToAvoid: raw.failureModeToAvoid || base.failureModeToAvoid,
      density,
      pacing: raw.pacing || base.pacing,
      sensoryNotes: raw.sensoryNotes || base.sensoryNotes,
      locationId,
      estimatedWordCount,
      chunkCount: raw.chunkCount || base.chunkCount,
      chunkDescriptions: raw.chunkDescriptions || base.chunkDescriptions,
      readerStateEntering: resolveReaderState(raw.readerStateEntering),
      readerStateExiting: resolveReaderState(raw.readerStateExiting),
      subtext: raw.subtext
        ? {
            surfaceConversation: raw.subtext.surfaceConversation || "",
            actualConversation: raw.subtext.actualConversation || "",
            enforcementRule: raw.subtext.enforcementRule || "",
          }
        : base.subtext,
      sceneSpecificProhibitions: raw.sceneSpecificProhibitions || base.sceneSpecificProhibitions,
      anchorLines: (raw.anchorLines || []).map((a) => ({
        text: a.text || "",
        placement: a.placement || "",
        verbatim: a.verbatim ?? true,
      })),
    };
  });
}
