import type { Bible } from "../types/index.js";

// ─── Types ───────────────────────────────────────

export interface EssayTemplate {
  id: "opinion-piece" | "personal-essay";
  name: string;
  description: string;
  /** Prose extension appended to the essay bootstrap system prompt. */
  systemPromptOverride: string;
  /** [min, max] default number of sections for this essay type. */
  defaultSectionCount: [min: number, max: number];
  /** [min, max] default total word count target for the essay. */
  defaultWordCountTarget: [min: number, max: number];
  /**
   * Derive a non-empty `failureModeToAvoid` string from the section heading
   * and purpose. Output must never contain unresolved template placeholders
   * and must pass `checkScenePlanGate`.
   */
  defaultFailureModeForSection: (heading: string, purpose: string) => string;
  /** Fill-blank defaults merged into a Bible when this template is applied. */
  bibleDefaults: EssayBibleDefaults;
}

export interface EssayBibleDefaults {
  metaphoricRegister?: {
    approvedDomains?: string[];
    prohibitedDomains?: string[];
  };
  killList?: Array<{ pattern: string; type: "exact" | "structural" }>;
  structuralBans?: string[];
  paragraphPolicy?: {
    maxSentences?: number;
    singleSentenceFrequency?: string;
    notes?: string;
  };
  sentenceArchitecture?: {
    targetVariance?: string;
    fragmentPolicy?: string;
    notes?: string;
  };
  /** Routed to narrativeRules.pov.notes during apply (fill-blank). */
  povNotes?: string;
}

// ─── Templates ───────────────────────────────────

export const OPINION_PIECE: EssayTemplate = {
  id: "opinion-piece",
  name: "Opinion Piece",
  description: "Editorial, thesis-driven, punchy. Advances a single central argument.",
  systemPromptOverride:
    "Frame every section as advancing a single central argument. Avoid hedging. Lead with the claim and back it with evidence or reasoning. End each section by making the next logical beat inevitable. The reader should always know exactly where you stand and why. Precision beats politeness.",
  defaultSectionCount: [3, 5],
  defaultWordCountTarget: [1500, 3000],
  defaultFailureModeForSection: (heading: string, purpose: string): string => {
    const purposeLower = purpose.trim().length > 0 ? purpose.trim().toLowerCase() : "advance the central argument";
    const headingPart = heading.trim().length > 0 ? ` ("${heading.trim()}")` : "";
    return `Generic summary without a clear argument. This section${headingPart} must ${purposeLower}, not just describe it. Avoid hedging, throat-clearing, and restating the obvious.`;
  },
  bibleDefaults: {
    metaphoricRegister: {
      approvedDomains: ["architecture", "mechanics"],
      prohibitedDomains: ["warfare", "corporate jargon"],
    },
    killList: [
      { pattern: "it goes without saying", type: "exact" },
      { pattern: "needless to say", type: "exact" },
      { pattern: "at the end of the day", type: "exact" },
      { pattern: "reasonable people can disagree", type: "structural" },
      { pattern: "on the other hand", type: "exact" },
      { pattern: "it's worth noting", type: "exact" },
      { pattern: "make no mistake", type: "exact" },
      { pattern: "the bottom line", type: "exact" },
    ],
    structuralBans: [
      "Do not hedge a claim with 'I think' or 'in my opinion' — state the claim directly.",
      "Do not open a paragraph with 'However' or 'Moreover'.",
      "Do not end a section with a generic call to action.",
      "Do not present false equivalence or bothsidesism when the evidence is one-sided.",
    ],
    paragraphPolicy: {
      maxSentences: 5,
      singleSentenceFrequency: "frequent",
      notes: "Single-sentence paragraphs land punches. Use them.",
    },
    sentenceArchitecture: {
      targetVariance: "high",
      fragmentPolicy: "sparingly for emphasis",
      notes: "Mix short declarative sentences with longer rhetorical ones.",
    },
    povNotes: "Direct, opinionated first-person. The author has a position and defends it.",
  },
};

export const PERSONAL_ESSAY: EssayTemplate = {
  id: "personal-essay",
  name: "Personal Essay",
  description: "Narrative-driven, reflective, voice-first. Lived experience in service of insight.",
  systemPromptOverride:
    "Lead with concrete moments from lived experience. Ground abstract insight in specific sensory detail. Avoid tidy lessons or summary wisdom. The reader should feel they are standing inside the moment with you, not being told about it from a distance. Earn every generalization with a scene.",
  defaultSectionCount: [3, 5],
  defaultWordCountTarget: [1500, 4000],
  defaultFailureModeForSection: (heading: string, purpose: string): string => {
    const purposeText = purpose.trim().length > 0 ? purpose.trim() : "ground insight in concrete, specific experience";
    const headingPart = heading.trim().length > 0 ? ` ("${heading.trim()}")` : "";
    return `Writerly distance or abstract reflection. This section${headingPart} must be grounded in specific, concrete experience — show the thing rather than describe it. Purpose: ${purposeText}.`;
  },
  bibleDefaults: {
    metaphoricRegister: {
      approvedDomains: ["domestic", "bodily", "weather", "landscape"],
      prohibitedDomains: ["warfare", "corporate jargon"],
    },
    killList: [
      { pattern: "taught me a valuable lesson", type: "structural" },
      { pattern: "little did I know", type: "structural" },
      { pattern: "looking back", type: "exact" },
      { pattern: "I never could have imagined", type: "structural" },
      { pattern: "it changed my life forever", type: "structural" },
      { pattern: "in that moment I realized", type: "structural" },
      { pattern: "I learned that", type: "structural" },
    ],
    structuralBans: [
      "Do not open with a throat-clearing anecdote that delays the point.",
      "Do not end with a tidy moral or lesson learned.",
      "Do not hedge genuine claims with 'I think' or 'I feel like'.",
    ],
    paragraphPolicy: {
      maxSentences: 6,
      singleSentenceFrequency: "frequent",
      notes: "Single-sentence paragraphs for emotional turns. Longer paragraphs for setting context.",
    },
    sentenceArchitecture: {
      targetVariance: "high",
      fragmentPolicy: "frequent for emphasis and rhythm",
      notes: "Mix long reflective sentences with short declarative ones. Fragments for emotional beats.",
    },
    povNotes: "Intimate first-person. The narrator is present on every page.",
  },
};

export const ESSAY_TEMPLATES: EssayTemplate[] = [OPINION_PIECE, PERSONAL_ESSAY];

// ─── Apply ──────────────────────────────────────

/** Fill-blank metaphoric register: only if null or both domain lists are empty. */
function applyMetaphoricDefaults(updated: Bible, defaults: EssayBibleDefaults): void {
  if (!defaults.metaphoricRegister) return;
  const existing = updated.styleGuide.metaphoricRegister;
  const isBlank =
    existing === null || (existing.approvedDomains.length === 0 && existing.prohibitedDomains.length === 0);
  if (isBlank) {
    updated.styleGuide.metaphoricRegister = {
      approvedDomains: [...(defaults.metaphoricRegister.approvedDomains ?? [])],
      prohibitedDomains: [...(defaults.metaphoricRegister.prohibitedDomains ?? [])],
    };
  }
}

/** Append kill list entries, de-duping by pattern text. */
function applyKillListDefaults(updated: Bible, defaults: EssayBibleDefaults): void {
  if (!defaults.killList || defaults.killList.length === 0) return;
  const seen = new Set(updated.styleGuide.killList.map((k) => k.pattern));
  for (const entry of defaults.killList) {
    if (!seen.has(entry.pattern)) {
      updated.styleGuide.killList.push({ pattern: entry.pattern, type: entry.type });
      seen.add(entry.pattern);
    }
  }
}

/** Append structural bans, de-duping. */
function applyStructuralBanDefaults(updated: Bible, defaults: EssayBibleDefaults): void {
  if (!defaults.structuralBans || defaults.structuralBans.length === 0) return;
  const seen = new Set(updated.styleGuide.structuralBans);
  for (const ban of defaults.structuralBans) {
    if (!seen.has(ban)) {
      updated.styleGuide.structuralBans.push(ban);
      seen.add(ban);
    }
  }
}

/** Fill-blank paragraph policy: only if null (never overwrite user-set values). */
function applyParagraphDefaults(updated: Bible, defaults: EssayBibleDefaults): void {
  if (defaults.paragraphPolicy && !updated.styleGuide.paragraphPolicy) {
    updated.styleGuide.paragraphPolicy = {
      maxSentences: defaults.paragraphPolicy.maxSentences ?? null,
      singleSentenceFrequency: defaults.paragraphPolicy.singleSentenceFrequency ?? null,
      notes: defaults.paragraphPolicy.notes ?? null,
    };
  }
}

/** Fill-blank sentence architecture: only if null. */
function applySentenceDefaults(updated: Bible, defaults: EssayBibleDefaults): void {
  if (defaults.sentenceArchitecture && !updated.styleGuide.sentenceArchitecture) {
    updated.styleGuide.sentenceArchitecture = {
      targetVariance: defaults.sentenceArchitecture.targetVariance ?? null,
      fragmentPolicy: defaults.sentenceArchitecture.fragmentPolicy ?? null,
      notes: defaults.sentenceArchitecture.notes ?? null,
    };
  }
}

/** Fill-blank POV notes: only if the bible's current notes are undefined or empty. */
function applyPovNotesDefaults(updated: Bible, defaults: EssayBibleDefaults): void {
  if (!defaults.povNotes) return;
  const currentNotes = updated.narrativeRules.pov.notes;
  if (currentNotes === undefined || currentNotes.trim() === "") {
    updated.narrativeRules.pov.notes = defaults.povNotes;
  }
}

/**
 * Merge essay template defaults into a bible.
 *
 * Fill-blank strategy: only populates fields that are null, empty, or at
 * default values. Never overwrites user-set values. Also sets `mode` to
 * "essay" — this is the critical marker that routes the bible through the
 * essay UI and essay bootstrap system prompt.
 *
 * Returns a new Bible (does not mutate the input).
 */
export function applyEssayTemplate(bible: Bible, template: EssayTemplate): Bible {
  const updated = structuredClone(bible);
  updated.mode = "essay";

  const d = template.bibleDefaults;
  applyMetaphoricDefaults(updated, d);
  applyKillListDefaults(updated, d);
  applyStructuralBanDefaults(updated, d);
  applyParagraphDefaults(updated, d);
  applySentenceDefaults(updated, d);
  applyPovNotesDefaults(updated, d);

  return updated;
}
