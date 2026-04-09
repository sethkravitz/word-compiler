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

export const PERSONAL_ESSAY: GenreTemplate = {
  id: "personal-essay",
  name: "Personal Essay",
  description: "First-person, intimate voice drawing from lived experience to make a larger point.",
  bible: {
    pov: {
      default: "first",
      distance: "intimate",
      interiority: "stream",
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
    metaphoricRegister: {
      approvedDomains: ["domestic", "bodily", "weather", "landscape"],
      prohibitedDomains: ["warfare", "corporate jargon"],
    },
    sentenceArchitecture: {
      targetVariance: "high",
      fragmentPolicy: "frequent for emphasis and rhythm",
      notes: "Mix long reflective sentences with short declarative ones. Fragments for emotional beats.",
    },
    paragraphPolicy: {
      maxSentences: 6,
      singleSentenceFrequency: "frequent",
      notes: "Single-sentence paragraphs for emotional turns. Longer paragraphs for scene-setting.",
    },
    structuralBans: [
      "Do not open with a throat-clearing anecdote that delays the point",
      "Do not end with a tidy moral or lesson learned",
      "Do not hedge genuine claims with 'I think' or 'I feel like'",
    ],
    subtextPolicy: undefined,
    expositionPolicy:
      "Show through specific scenes and sensory detail. Generalize only after earning it with concrete evidence.",
  },
};

export const ANALYTICAL_ESSAY: GenreTemplate = {
  id: "analytical",
  name: "Analytical Essay",
  description: "Clear, evidence-driven argument with a strong thesis and logical structure.",
  bible: {
    pov: {
      default: "first",
      distance: "moderate",
      interiority: "filtered",
    },
    killList: [
      { pattern: "it is important to note", type: "structural" },
      { pattern: "studies show", type: "exact" },
      { pattern: "in today's world", type: "exact" },
      { pattern: "it goes without saying", type: "structural" },
      { pattern: "the fact of the matter is", type: "structural" },
      { pattern: "when it comes to", type: "structural" },
    ],
    metaphoricRegister: {
      approvedDomains: ["systems", "architecture", "machinery", "physics"],
      prohibitedDomains: ["flowery nature", "sports cliches"],
    },
    sentenceArchitecture: {
      targetVariance: "moderate",
      fragmentPolicy: "sparingly, for emphasis only",
      notes: "Clear, precise sentences. Subordinate clauses for qualification. Short sentences for key claims.",
    },
    paragraphPolicy: {
      maxSentences: 5,
      singleSentenceFrequency: "occasional",
      notes: "Each paragraph makes one point. Topic sentence, evidence, implication.",
    },
    structuralBans: [
      "Never open a paragraph with However, Moreover, Furthermore, Additionally, or In fact",
      "Never use straw-man framing to set up your argument",
      "Never claim consensus without citing evidence",
    ],
    subtextPolicy: undefined,
    expositionPolicy: "Lead with the claim, then the evidence, then the implication. Never bury the argument.",
  },
};

export const OP_ED: GenreTemplate = {
  id: "op-ed",
  name: "Op-Ed / Persuasive",
  description: "Direct, punchy argument with a clear position and strong voice.",
  bible: {
    pov: {
      default: "first",
      distance: "close",
      interiority: "filtered",
    },
    killList: [
      { pattern: "make no mistake", type: "exact" },
      { pattern: "at the end of the day", type: "exact" },
      { pattern: "the bottom line", type: "exact" },
      { pattern: "wake-up call", type: "exact" },
      { pattern: "game-changer", type: "exact" },
      { pattern: "let that sink in", type: "structural" },
    ],
    metaphoricRegister: {
      approvedDomains: ["construction", "navigation", "combat", "cooking"],
      prohibitedDomains: ["academic jargon", "corporate speak"],
    },
    sentenceArchitecture: {
      targetVariance: "extreme",
      fragmentPolicy: "frequent for punch",
      notes:
        "Short declarative sentences for impact. Longer sentences to build up to a point. Fragments as punctuation.",
    },
    paragraphPolicy: {
      maxSentences: 4,
      singleSentenceFrequency: "very frequent",
      notes: "Short paragraphs. One-sentence paragraphs for key claims. Never more than 4 sentences.",
    },
    structuralBans: [
      "Never present false equivalence or bothsidesism",
      "Never hedge the central argument",
      "Never open with a dictionary definition",
      "Never end with a generic call to action",
    ],
    subtextPolicy: undefined,
    expositionPolicy:
      "State the position early. Every paragraph advances the argument or provides evidence. Cut anything that doesn't serve the thesis.",
  },
};

export const NARRATIVE_NONFICTION: GenreTemplate = {
  id: "narrative-nonfiction",
  name: "Narrative Nonfiction",
  description: "Story-driven nonfiction that uses scenes and characters to explore ideas.",
  bible: {
    pov: {
      default: "close-third",
      distance: "close",
      interiority: "filtered",
    },
    killList: [
      { pattern: "when asked about", type: "structural" },
      { pattern: "declined to comment", type: "exact" },
      { pattern: "sources say", type: "exact" },
      { pattern: "it remains to be seen", type: "structural" },
      { pattern: "time will tell", type: "exact" },
    ],
    metaphoricRegister: {
      approvedDomains: ["the subject's own domain", "environment", "craft"],
      prohibitedDomains: ["mixed metaphors", "cliched comparisons"],
    },
    sentenceArchitecture: {
      targetVariance: "high",
      fragmentPolicy: "occasional for scene transitions",
      notes: "Scene-setting sentences can be long and descriptive. Action and dialogue stay tight.",
    },
    paragraphPolicy: {
      maxSentences: 6,
      singleSentenceFrequency: "moderate",
      notes: "Longer paragraphs for scene-building. Shorter for action and turning points.",
    },
    structuralBans: [
      "Never confuse the timeline without signaling the jump",
      "Never make unattributed claims about a person's internal state",
      "Never dump exposition — weave it into scenes",
    ],
    subtextPolicy: undefined,
    expositionPolicy: "Embed facts and context within scenes. The reader should learn without feeling taught.",
  },
};

export const GENRE_TEMPLATES: GenreTemplate[] = [PERSONAL_ESSAY, ANALYTICAL_ESSAY, OP_ED, NARRATIVE_NONFICTION];

// ─── Apply ──────────────────────────────────────

/** Fill-blank POV fields: only overwrites values still at their factory defaults. */
function applyPovDefaults(updated: Bible, defaults: GenreDefaults): void {
  if (!defaults.pov) return;
  const pov = updated.narrativeRules.pov;
  if (defaults.pov.default && pov.default === "close-third") pov.default = defaults.pov.default;
  if (defaults.pov.distance && pov.distance === "close") pov.distance = defaults.pov.distance;
  if (defaults.pov.interiority && pov.interiority === "filtered") pov.interiority = defaults.pov.interiority;
}

/** Fill-blank kill list: only if empty. */
function applyKillListDefaults(updated: Bible, defaults: GenreDefaults): void {
  if (defaults.killList && updated.styleGuide.killList.length === 0) {
    updated.styleGuide.killList = [...defaults.killList];
  }
}

/** Fill-blank metaphoric register: only if null. */
function applyMetaphoricDefaults(updated: Bible, defaults: GenreDefaults): void {
  if (defaults.metaphoricRegister && !updated.styleGuide.metaphoricRegister) {
    updated.styleGuide.metaphoricRegister = {
      approvedDomains: defaults.metaphoricRegister.approvedDomains ?? [],
      prohibitedDomains: defaults.metaphoricRegister.prohibitedDomains ?? [],
    };
  }
}

/** Fill-blank sentence architecture: only if null. */
function applySentenceDefaults(updated: Bible, defaults: GenreDefaults): void {
  if (defaults.sentenceArchitecture && !updated.styleGuide.sentenceArchitecture) {
    updated.styleGuide.sentenceArchitecture = {
      targetVariance: defaults.sentenceArchitecture.targetVariance ?? null,
      fragmentPolicy: defaults.sentenceArchitecture.fragmentPolicy ?? null,
      notes: defaults.sentenceArchitecture.notes ?? null,
    };
  }
}

/** Fill-blank paragraph policy: only if null. */
function applyParagraphDefaults(updated: Bible, defaults: GenreDefaults): void {
  if (defaults.paragraphPolicy && !updated.styleGuide.paragraphPolicy) {
    updated.styleGuide.paragraphPolicy = {
      maxSentences: defaults.paragraphPolicy.maxSentences ?? null,
      singleSentenceFrequency: defaults.paragraphPolicy.singleSentenceFrequency ?? null,
      notes: defaults.paragraphPolicy.notes ?? null,
    };
  }
}

/** Fill-blank structural bans: only if empty. */
function applyStructuralBanDefaults(updated: Bible, defaults: GenreDefaults): void {
  if (defaults.structuralBans && updated.styleGuide.structuralBans.length === 0) {
    updated.styleGuide.structuralBans = [...defaults.structuralBans];
  }
}

/** Fill-blank narrative rules (subtext + exposition): only if null. */
function applyNarrativeRuleDefaults(updated: Bible, defaults: GenreDefaults): void {
  if (defaults.subtextPolicy && !updated.narrativeRules.subtextPolicy) {
    updated.narrativeRules.subtextPolicy = defaults.subtextPolicy;
  }
  if (defaults.expositionPolicy && !updated.narrativeRules.expositionPolicy) {
    updated.narrativeRules.expositionPolicy = defaults.expositionPolicy;
  }
}

/**
 * Merge genre template defaults into a bible.
 * Fill-blank strategy: only populates fields that are null, empty, or at default values.
 * Does not overwrite user-set values. Returns a new Bible (does not mutate).
 */
export function applyGenreTemplate(bible: Bible, template: GenreTemplate): Bible {
  const updated = structuredClone(bible);
  const d = template.bible;

  applyPovDefaults(updated, d);
  applyKillListDefaults(updated, d);
  applyMetaphoricDefaults(updated, d);
  applySentenceDefaults(updated, d);
  applyParagraphDefaults(updated, d);
  applyStructuralBanDefaults(updated, d);
  applyNarrativeRuleDefaults(updated, d);

  return updated;
}
