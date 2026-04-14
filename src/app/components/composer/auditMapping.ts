// Pure function: translate AuditFlag[] into EditorialAnnotation[] for inline
// Grammarly-style decorations in AnnotatedEditor.svelte.
//
// Scope: V1 supports kill_list only. rhythm_monotony and paragraph_length are
// footer-only — they intentionally produce zero annotations here.
//
// This module has zero side effects and no Svelte/store imports.

import type { EditorialAnnotation } from "../../../review/types.js";
import type { KillListEntry } from "../../../types/bible.js";
import type { AuditFlag } from "../../../types/quality.js";

// Mirrors src/auditor/index.ts:17-19. Kept inline (5 lines, trivial) to avoid
// modifying existing files. Semantics must match the auditor exactly so the
// decorations line up with what the auditor actually flags.
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Parses pattern from the auditor's canonical kill_list message format:
// `Avoid list violation: "PATTERN" found.` (see src/auditor/index.ts:42).
// Returns null on any unexpected format so callers can fall back gracefully.
const KILL_LIST_MESSAGE_RE = /^Avoid list violation: "(.+)" found\.$/;

function parsePatternFromMessage(message: string): string | null {
  const match = message.match(KILL_LIST_MESSAGE_RE);
  return match ? (match[1] ?? null) : null;
}

const ANCHOR_CONTEXT_CHARS = 20;

function buildAnchor(text: string, start: number, end: number): { prefix: string; focus: string; suffix: string } {
  const prefixStart = Math.max(0, start - ANCHOR_CONTEXT_CHARS);
  const suffixEnd = Math.min(text.length, end + ANCHOR_CONTEXT_CHARS);
  return {
    prefix: text.slice(prefixStart, start),
    focus: text.slice(start, end),
    suffix: text.slice(end, suffixEnd),
  };
}

/**
 * Translate pending audit flags into EditorialAnnotations for the editor.
 *
 * Rules:
 *  - Resolved flags are skipped (only pending flags render).
 *  - Only `kill_list` flags produce annotations. `rhythm_monotony` and
 *    `paragraph_length` are footer-only in V1 and return zero annotations.
 *  - For each pending kill_list flag, the pattern is parsed from the flag's
 *    `message` (canonical format: `Avoid list violation: "PATTERN" found.`).
 *    If parsing fails, the flag is skipped gracefully (never throws).
 *  - All case-insensitive matches of that pattern in `text` become annotations,
 *    one per match. This mirrors the auditor's checkKillList which produces
 *    one AuditFlag per match (src/auditor/index.ts:34-48).
 *  - Regex metacharacters in patterns are escaped (literal matching only),
 *    matching auditor semantics.
 *  - De-duplicated by (sceneId, pattern, start, end): if two flags point at
 *    the same span, only one annotation is emitted.
 *
 * IDs and fingerprints are deterministic (sceneId + pattern + start + end) so
 * repeated calls produce stable results across renders.
 *
 * Note: EditorialAnnotation.category uses "kill_list" (a LocalReviewCategory —
 * see src/review/types.ts:19) for all emitted annotations. Severity is always
 * "critical", matching the auditor (src/auditor/index.ts:40). The `killList`
 * parameter is reserved for future use (e.g., rendering pattern matches that
 * weren't explicitly flagged); currently unused because flags are 1:1 with
 * matches and the pattern is parsed from the flag message.
 */
function compilePatternRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(escapeRegex(pattern), "gi");
  } catch {
    // escapeRegex should make this unreachable, but guard pathological input.
    return null;
  }
}

function buildKillListAnnotation(
  sceneId: string,
  pattern: string,
  text: string,
  start: number,
  end: number,
): EditorialAnnotation {
  const fingerprint = `${sceneId}:${pattern}:${start}:${end}`;
  return {
    id: fingerprint,
    category: "kill_list",
    severity: "critical",
    scope: "both",
    message: `Kill list pattern: "${pattern}"`,
    suggestion: null,
    anchor: buildAnchor(text, start, end),
    charRange: { start, end },
    fingerprint,
    killListPattern: pattern,
  };
}

function collectAnnotationsForFlag(flag: AuditFlag, text: string, seen: Set<string>, out: EditorialAnnotation[]): void {
  if (flag.resolved || flag.category !== "kill_list") return;

  const pattern = parsePatternFromMessage(flag.message);
  if (!pattern) return;

  const regex = compilePatternRegex(pattern);
  if (!regex) return;

  for (const match of text.matchAll(regex)) {
    const start = match.index ?? -1;
    if (start < 0) continue;
    const end = start + match[0].length;
    if (end <= start) continue;

    const dedupeKey = `${flag.sceneId}:${pattern}:${start}:${end}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    out.push(buildKillListAnnotation(flag.sceneId, pattern, text, start, end));
  }
}

export function mapAuditFlagsToAnnotations(
  flags: AuditFlag[],
  text: string,
  _killList: KillListEntry[],
): EditorialAnnotation[] {
  if (flags.length === 0 || text.length === 0) return [];

  const annotations: EditorialAnnotation[] = [];
  const seen = new Set<string>();

  for (const flag of flags) {
    collectAnnotationsForFlag(flag, text, seen, annotations);
  }

  return annotations;
}
