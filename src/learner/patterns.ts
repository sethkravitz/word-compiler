import type { EditPattern, EditSubType } from "./diff.js";

// ─── Types ───────────────────────────────────────

export interface LearnedPattern {
  id: string;
  projectId: string;
  patternType: EditSubType;
  patternData: PatternData;
  occurrences: number;
  confidence: number;
  status: "proposed" | "accepted" | "rejected" | "expired";
  proposedAction: ProposedAction | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatternData {
  /** Normalized text that appears across edits (lowercase) */
  key: string;
  /** Representative example phrases from the edits */
  phrases: string[];
  /** Up to 5 before/after example pairs */
  examples: Array<{ original: string; edited: string; context: string | null }>;
}

export interface ProposedAction {
  target: string;
  value: string;
}

export interface PatternGroup {
  patternType: EditSubType;
  key: string;
  edits: EditPattern[];
  weightedCount: number;
  confidence: number;
}

// ─── Constants ───────────────────────────────────

const Z = 1.96; // 95% CI
const PROMOTION_MIN_OCCURRENCES = 5;
const PROMOTION_MIN_CONFIDENCE = 0.6;
const DECAY_WINDOW = 30;
const DECAY_WEIGHT = 0.5;

// ─── Wilson Interval ─────────────────────────────

/**
 * Compute Wilson score interval lower bound.
 * Used to estimate confidence that a pattern is real,
 * accounting for small sample sizes.
 *
 * @param successes Number of times the pattern appeared
 * @param total Total number of opportunities (edits analyzed)
 * @returns Lower bound of 95% Wilson confidence interval
 */
export function wilsonLowerBound(successes: number, total: number): number {
  if (total === 0) return 0;
  const p = successes / total;
  const z2 = Z * Z;
  const denominator = 1 + z2 / total;
  const center = p + z2 / (2 * total);
  const spread = Z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total));
  return Math.max(0, (center - spread) / denominator);
}

// ─── Evidence Decay ──────────────────────────────

/**
 * Apply evidence decay: edits older than `decayWindow` scenes
 * from the most recent scene carry reduced weight.
 */
export function computeWeightedCount(
  edits: EditPattern[],
  sceneOrder: Map<string, number>,
  decayWindow: number = DECAY_WINDOW,
): number {
  if (edits.length === 0) return 0;

  // Find the maximum scene order across all edits
  let maxOrder = 0;
  for (const edit of edits) {
    const order = sceneOrder.get(edit.sceneId) ?? 0;
    if (order > maxOrder) maxOrder = order;
  }

  let weighted = 0;
  for (const edit of edits) {
    const order = sceneOrder.get(edit.sceneId) ?? 0;
    const age = maxOrder - order;
    weighted += age > decayWindow ? DECAY_WEIGHT : 1;
  }

  return weighted;
}

// ─── Pattern Grouping ────────────────────────────

/**
 * Normalize an edit into a grouping key.
 * For deletions: the deleted text (lowercase, trimmed).
 * For substitutions: the original text (lowercase, trimmed).
 * For additions: the first 3 words of added text (lowercase).
 * For restructures: "reorder".
 */
export function normalizePatternKey(edit: EditPattern): string {
  switch (edit.editType) {
    case "DELETION":
      return edit.originalText.toLowerCase().trim();
    case "SUBSTITUTION":
      return edit.originalText.toLowerCase().trim();
    case "ADDITION":
      return edit.editedText.toLowerCase().trim().split(/\s+/).slice(0, 3).join(" ");
    case "RESTRUCTURE":
      return "reorder";
  }
}

/**
 * Group edit patterns by (subType, normalizedKey) and compute
 * weighted occurrence counts and Wilson confidence intervals.
 *
 * Confidence is computed per-subType: what fraction of edits of the same
 * subType does this specific pattern represent? This gives meaningful
 * proportions even at small sample sizes.
 */
export function groupPatterns(edits: EditPattern[], sceneOrder: Map<string, number>): PatternGroup[] {
  // Count total edits per subType for Wilson denominator
  const subTypeTotals = new Map<string, number>();
  for (const edit of edits) {
    subTypeTotals.set(edit.subType, (subTypeTotals.get(edit.subType) ?? 0) + 1);
  }

  // Group by composite key
  const groups = new Map<string, EditPattern[]>();
  for (const edit of edits) {
    const key = `${edit.subType}::${normalizePatternKey(edit)}`;
    const group = groups.get(key);
    if (group) {
      group.push(edit);
    } else {
      groups.set(key, [edit]);
    }
  }

  const result: PatternGroup[] = [];
  for (const [compositeKey, groupEdits] of groups) {
    const [patternType, ...keyParts] = compositeKey.split("::");
    const key = keyParts.join("::");
    const weightedCount = computeWeightedCount(groupEdits, sceneOrder);
    const subTypeTotal = subTypeTotals.get(patternType!) ?? weightedCount;
    const confidence = wilsonLowerBound(weightedCount, Math.max(subTypeTotal, weightedCount));

    result.push({
      patternType: patternType as EditSubType,
      key,
      edits: groupEdits,
      weightedCount,
      confidence,
    });
  }

  // Sort by confidence descending, then by occurrence count
  result.sort((a, b) => b.confidence - a.confidence || b.weightedCount - a.weightedCount);
  return result;
}

// ─── Promotion Check ─────────────────────────────

/**
 * Check if a pattern group meets the promotion threshold.
 * Requires >= 5 weighted occurrences AND Wilson lower bound >= 0.60.
 */
export function meetsPromotionThreshold(group: PatternGroup): boolean {
  return group.weightedCount >= PROMOTION_MIN_OCCURRENCES && group.confidence >= PROMOTION_MIN_CONFIDENCE;
}

// ─── Action Mapping ──────────────────────────────

/**
 * Map a pattern group to a proposed bible modification action.
 */
export function mapToProposedAction(group: PatternGroup): ProposedAction | null {
  switch (group.patternType) {
    case "CUT_FILLER":
      return { target: "killList", value: group.key };
    case "DIALOGUE_VOICE":
      return { target: "characters.voiceNotes", value: `Tends to edit dialogue: "${group.key}"` };
    case "SHOW_DONT_TELL":
      return { target: "suggestedTone.exemplars", value: group.key };
    case "SENSORY_ADDED":
      return { target: "locations.sensoryPalette", value: group.key };
    case "BEAT_ADDED":
      return { target: "characters.emotionPhysicality", value: group.key };
    case "TONE_SHIFT":
      return { target: "suggestedTone.metaphoricDomains", value: group.key };
    case "CUT_PASSAGE":
      return { target: "compilationNotes", value: `Frequently cuts passages like: "${group.key.slice(0, 80)}"` };
    case "REORDER":
      return { target: "compilationNotes", value: "Frequently reorders sentences within paragraphs" };
    default:
      return null;
  }
}

// ─── Main Accumulation Pipeline ──────────────────

/**
 * Given all edit patterns for a project, accumulate into learned patterns.
 * Returns groups that meet the promotion threshold with proposed actions.
 */
export function accumulatePatterns(edits: EditPattern[], sceneOrder: Map<string, number>): PatternGroup[] {
  const groups = groupPatterns(edits, sceneOrder);
  return groups.filter(meetsPromotionThreshold);
}
