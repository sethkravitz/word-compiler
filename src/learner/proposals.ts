import type { Bible } from "../types/index.js";
import { generateId } from "../types/index.js";
import { mapToProposedAction, type PatternGroup } from "./patterns.js";

// ─── Types ───────────────────────────────────────

export interface BibleProposal {
  id: string;
  projectId: string;
  patternType: string;
  title: string;
  description: string;
  evidence: ProposalEvidence;
  action: ProposalAction;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

export interface ProposalEvidence {
  occurrences: number;
  confidence: number;
  examples: Array<{ original: string; edited: string }>;
  sceneCount: number;
}

export interface ProposalAction {
  target: string;
  value: string;
  section: BibleSection;
}

export type BibleSection =
  | "killList"
  | "characters"
  | "styleGuide"
  | "locations"
  | "narrativeRules"
  | "compilationNotes";

// ─── Proposal Generation ─────────────────────────

/**
 * Generate bible update proposals from promoted pattern groups.
 */
export function generateProposals(promotedGroups: PatternGroup[], projectId: string): BibleProposal[] {
  const proposals: BibleProposal[] = [];

  for (const group of promotedGroups) {
    const action = mapToProposedAction(group);
    if (!action) continue;

    const section = resolveSection(action.target);
    const title = buildTitle(group);
    const description = buildDescription(group);

    // Collect unique scenes for evidence
    const sceneIds = new Set(group.edits.map((e) => e.sceneId));

    // Take up to 5 examples
    const examples = group.edits.slice(0, 5).map((e) => ({
      original: e.originalText,
      edited: e.editedText,
    }));

    proposals.push({
      id: generateId(),
      projectId,
      patternType: group.patternType,
      title,
      description,
      evidence: {
        occurrences: group.weightedCount,
        confidence: group.confidence,
        examples,
        sceneCount: sceneIds.size,
      },
      action: { target: action.target, value: action.value, section },
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  }

  return proposals;
}

// ─── Proposal Application ────────────────────────

/**
 * Apply an accepted proposal to a bible, returning the modified bible.
 * Does not mutate the original.
 */
export function applyProposal(bible: Bible, proposal: BibleProposal): Bible {
  const updated = structuredClone(bible);

  switch (proposal.action.section) {
    case "killList": {
      const entry = { pattern: proposal.action.value, type: "exact" as const };
      if (!updated.styleGuide.killList.some((k) => k.pattern === entry.pattern)) {
        updated.styleGuide.killList.push(entry);
      }
      break;
    }

    case "styleGuide": {
      if (proposal.action.target === "suggestedTone.exemplars") {
        updated.styleGuide.negativeExemplars.push({
          text: proposal.action.value,
          annotation: `Auto-learned: avoid this pattern (${proposal.patternType})`,
        });
      } else if (proposal.action.target === "suggestedTone.metaphoricDomains") {
        if (!updated.styleGuide.metaphoricRegister) {
          updated.styleGuide.metaphoricRegister = { approvedDomains: [], prohibitedDomains: [] };
        }
        const domains = updated.styleGuide.metaphoricRegister.prohibitedDomains;
        if (!domains.includes(proposal.action.value)) {
          domains.push(proposal.action.value);
        }
      }
      break;
    }

    case "characters": {
      // For character-level proposals, annotate the first character's voice
      if (updated.characters.length > 0) {
        const char = updated.characters[0]!;
        if (!char.voice.vocabularyNotes) {
          char.voice.vocabularyNotes = proposal.action.value;
        } else {
          char.voice.vocabularyNotes += `; ${proposal.action.value}`;
        }
      }
      break;
    }

    case "locations": {
      // For location sensory proposals, add to first location if available
      if (updated.locations.length > 0) {
        const loc = updated.locations[0]!;
        if (!loc.sensoryPalette.atmosphere) {
          loc.sensoryPalette.atmosphere = proposal.action.value;
        } else {
          loc.sensoryPalette.atmosphere += `; ${proposal.action.value}`;
        }
      }
      break;
    }

    case "compilationNotes":
    case "narrativeRules":
      // These are informational — no direct bible modification
      break;
  }

  return updated;
}

// ─── Helpers ─────────────────────────────────────

function resolveSection(target: string): BibleSection {
  if (target === "killList") return "killList";
  if (target.startsWith("characters")) return "characters";
  if (target.startsWith("suggestedTone") || target.startsWith("compilationNotes")) return "styleGuide";
  if (target.startsWith("locations")) return "locations";
  if (target === "compilationNotes") return "compilationNotes";
  return "styleGuide";
}

function buildTitle(group: PatternGroup): string {
  switch (group.patternType) {
    case "CUT_FILLER":
      return `Add "${group.key}" to kill list`;
    case "DIALOGUE_VOICE":
      return `Update dialogue voice notes`;
    case "SHOW_DONT_TELL":
      return `Flag "${truncate(group.key, 40)}" as tell-not-show`;
    case "SENSORY_ADDED":
      return `Add sensory detail pattern`;
    case "BEAT_ADDED":
      return `Note frequent beat additions`;
    case "TONE_SHIFT":
      return `Adjust tone guidance`;
    case "CUT_PASSAGE":
      return `Note frequently cut passage pattern`;
    case "REORDER":
      return `Note sentence reordering preference`;
    default:
      return `Pattern: ${group.patternType}`;
  }
}

function buildDescription(group: PatternGroup): string {
  const sceneIds = new Set(group.edits.map((e) => e.sceneId));
  return (
    `Based on ${Math.round(group.weightedCount)} edits across ${sceneIds.size} scene${sceneIds.size > 1 ? "s" : ""}. ` +
    `Confidence: ${Math.round(group.confidence * 100)}%.`
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
