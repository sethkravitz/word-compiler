import type { Bible } from "../types/index.js";

// ─── Types ───────────────────────────────────────

export interface GenreTemplate {
  id: string;
  name: string;
  description: string;
  /** Partial Bible fields to merge. Only fills blank/default user values. */
  bible: GenreDefaults;
}

/** The subset of Bible fields that a genre template can pre-fill. */
export interface GenreDefaults {
  pov?: {
    default?: "first" | "close-third" | "distant-third" | "omniscient";
    distance?: "intimate" | "close" | "moderate" | "distant";
    interiority?: "stream" | "filtered" | "behavioral-only";
  };
  killList?: Array<{ pattern: string; type: "exact" | "structural" }>;
  metaphoricRegister?: {
    approvedDomains?: string[];
    prohibitedDomains?: string[];
  };
  sentenceArchitecture?: {
    targetVariance?: string;
    fragmentPolicy?: string;
    notes?: string;
  };
  paragraphPolicy?: {
    maxSentences?: number;
    singleSentenceFrequency?: string;
    notes?: string;
  };
  structuralBans?: string[];
  subtextPolicy?: string;
  expositionPolicy?: string;
}

// ─── Templates ───────────────────────────────────

export const LITERARY_FICTION: GenreTemplate = {
  id: "literary-fiction",
  name: "Literary Fiction",
  description: "Character-driven prose with emphasis on interiority, subtext, and precise language.",
  bible: {
    pov: {
      default: "close-third",
      distance: "intimate",
      interiority: "filtered",
    },
    killList: [
      { pattern: "suddenly", type: "exact" },
      { pattern: "a sense of", type: "exact" },
      { pattern: "couldn't help but", type: "exact" },
      { pattern: "in that moment", type: "exact" },
      { pattern: "it was as if", type: "structural" },
    ],
    metaphoricRegister: {
      approvedDomains: ["landscape", "weather", "body", "architecture"],
      prohibitedDomains: ["warfare", "machinery"],
    },
    sentenceArchitecture: {
      targetVariance: "high",
      fragmentPolicy: "occasional for emphasis",
      notes: "Vary sentence length deliberately. Long sentences for interiority, short for impact.",
    },
    paragraphPolicy: {
      maxSentences: 6,
      singleSentenceFrequency: "frequent",
      notes: "Single-sentence paragraphs for emotional beats.",
    },
    structuralBans: ["rhetorical questions in narration", "direct address to reader"],
    subtextPolicy: "Characters rarely say what they mean. Surface dialogue must differ from actual intent.",
    expositionPolicy: "Reveal through action and observation, never through narrator summary.",
  },
};

export const THRILLER: GenreTemplate = {
  id: "thriller",
  name: "Thriller",
  description: "Fast-paced, tension-driven prose with short chapters and cliffhanger scene endings.",
  bible: {
    pov: {
      default: "close-third",
      distance: "close",
      interiority: "behavioral-only",
    },
    killList: [
      { pattern: "little did they know", type: "structural" },
      { pattern: "unbeknownst to", type: "exact" },
      { pattern: "a chill ran down", type: "exact" },
      { pattern: "heart pounded", type: "exact" },
    ],
    metaphoricRegister: {
      approvedDomains: ["predator-prey", "machinery", "shadows"],
      prohibitedDomains: ["flowers", "gentle nature"],
    },
    sentenceArchitecture: {
      targetVariance: "extreme",
      fragmentPolicy: "frequent for tension",
      notes: "Short, punchy sentences in action. Fragments drive pace. Longer sentences only for setup.",
    },
    paragraphPolicy: {
      maxSentences: 4,
      singleSentenceFrequency: "very frequent",
      notes: "One-line paragraphs for shock moments.",
    },
    structuralBans: ["extended flashbacks mid-action", "philosophical digressions"],
    subtextPolicy: "Characters lie and conceal. Let the reader see the gap between words and behavior.",
    expositionPolicy: "Drip-feed only what the reader needs to follow the next beat.",
  },
};

export const ROMANCE: GenreTemplate = {
  id: "romance",
  name: "Romance",
  description: "Emotionally rich prose centered on relationship dynamics and internal conflict.",
  bible: {
    pov: {
      default: "close-third",
      distance: "intimate",
      interiority: "stream",
    },
    killList: [
      { pattern: "orbs", type: "exact" },
      { pattern: "ministrations", type: "exact" },
      { pattern: "member", type: "exact" },
      { pattern: "pooling heat", type: "exact" },
      { pattern: "couldn't help but", type: "exact" },
    ],
    metaphoricRegister: {
      approvedDomains: ["weather", "temperature", "music", "water"],
      prohibitedDomains: ["warfare", "clinical terminology"],
    },
    sentenceArchitecture: {
      targetVariance: "moderate",
      fragmentPolicy: "for emotional peaks only",
      notes: "Flowing sentences for emotional interiority. Clipped dialogue for tension between characters.",
    },
    paragraphPolicy: {
      maxSentences: 5,
      singleSentenceFrequency: "moderate",
      notes: "Single-sentence paragraphs for emotional realizations.",
    },
    structuralBans: ["head-hopping within scenes", "telling emotions instead of showing physical responses"],
    subtextPolicy: "Characters say one thing but their body language and actions reveal true feelings.",
    expositionPolicy: "Backstory through dialogue and memory fragments, never narrator info-dump.",
  },
};

export const SCI_FI: GenreTemplate = {
  id: "sci-fi",
  name: "Science Fiction",
  description: "Speculative prose balancing world-building with character-driven narrative.",
  bible: {
    pov: {
      default: "close-third",
      distance: "moderate",
      interiority: "filtered",
    },
    killList: [
      { pattern: "it was unlike anything", type: "structural" },
      { pattern: "no words could describe", type: "structural" },
      { pattern: "futuristic", type: "exact" },
      { pattern: "high-tech", type: "exact" },
    ],
    metaphoricRegister: {
      approvedDomains: ["physics", "biology", "stellar phenomena", "architecture"],
      prohibitedDomains: ["anachronistic Earth references", "contemporary brand names"],
    },
    sentenceArchitecture: {
      targetVariance: "moderate",
      fragmentPolicy: "sparingly",
      notes: "Clean, precise sentences for exposition. More variety in character-driven passages.",
    },
    paragraphPolicy: {
      maxSentences: 5,
      singleSentenceFrequency: "occasional",
      notes: "Longer paragraphs acceptable for world-building, but break up with dialogue.",
    },
    structuralBans: ["As you know, Bob exposition", "footnotes or technical appendices in prose"],
    subtextPolicy: "Technology should be shown through use, not explained through lectures.",
    expositionPolicy: "World-build through sensory detail and character interaction with environment.",
  },
};

export const GENRE_TEMPLATES: GenreTemplate[] = [LITERARY_FICTION, THRILLER, ROMANCE, SCI_FI];

// ─── Apply ──────────────────────────────────────

/**
 * Merge genre template defaults into a bible.
 * Fill-blank strategy: only populates fields that are null, empty, or at default values.
 * Does not overwrite user-set values. Returns a new Bible (does not mutate).
 */
export function applyGenreTemplate(bible: Bible, template: GenreTemplate): Bible {
  const updated = structuredClone(bible);
  const d = template.bible;

  // POV defaults
  if (d.pov) {
    const pov = updated.narrativeRules.pov;
    if (d.pov.default && pov.default === "close-third") pov.default = d.pov.default;
    if (d.pov.distance && pov.distance === "close") pov.distance = d.pov.distance;
    if (d.pov.interiority && pov.interiority === "filtered") pov.interiority = d.pov.interiority;
  }

  // Kill list (fill-blank: only if empty)
  if (d.killList && updated.styleGuide.killList.length === 0) {
    updated.styleGuide.killList = [...d.killList];
  }

  // Metaphoric register (fill-blank: only if null)
  if (d.metaphoricRegister && !updated.styleGuide.metaphoricRegister) {
    updated.styleGuide.metaphoricRegister = {
      approvedDomains: d.metaphoricRegister.approvedDomains ?? [],
      prohibitedDomains: d.metaphoricRegister.prohibitedDomains ?? [],
    };
  }

  // Sentence architecture (fill-blank: only if null)
  if (d.sentenceArchitecture && !updated.styleGuide.sentenceArchitecture) {
    updated.styleGuide.sentenceArchitecture = {
      targetVariance: d.sentenceArchitecture.targetVariance ?? null,
      fragmentPolicy: d.sentenceArchitecture.fragmentPolicy ?? null,
      notes: d.sentenceArchitecture.notes ?? null,
    };
  }

  // Paragraph policy (fill-blank: only if null)
  if (d.paragraphPolicy && !updated.styleGuide.paragraphPolicy) {
    updated.styleGuide.paragraphPolicy = {
      maxSentences: d.paragraphPolicy.maxSentences ?? null,
      singleSentenceFrequency: d.paragraphPolicy.singleSentenceFrequency ?? null,
      notes: d.paragraphPolicy.notes ?? null,
    };
  }

  // Structural bans (fill-blank: only if empty)
  if (d.structuralBans && updated.styleGuide.structuralBans.length === 0) {
    updated.styleGuide.structuralBans = [...d.structuralBans];
  }

  // Narrative rules (fill-blank: only if null)
  if (d.subtextPolicy && !updated.narrativeRules.subtextPolicy) {
    updated.narrativeRules.subtextPolicy = d.subtextPolicy;
  }
  if (d.expositionPolicy && !updated.narrativeRules.expositionPolicy) {
    updated.narrativeRules.expositionPolicy = d.expositionPolicy;
  }

  return updated;
}
