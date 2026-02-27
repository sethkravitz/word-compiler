import { checkKillList, checkParagraphLength, checkSentenceVariance } from "../auditor/index.js";
import type { Bible } from "../types/bible.js";
import { generateId } from "../types/utils.js";
import { hashFingerprint } from "./fingerprint.js";
import type { EditorialAnnotation, LocalReviewCategory, Severity } from "./types.js";

export function runLocalChecks(text: string, bible: Bible, sceneId: string): EditorialAnnotation[] {
  const annotations: EditorialAnnotation[] = [];

  // Kill list — exact match positions from regex
  const killFlags = checkKillList(text, bible.styleGuide.killList, sceneId);
  for (const flag of killFlags) {
    const match = findPatternInText(text, flag.message);
    annotations.push(flagToAnnotation(flag.severity, "kill_list", flag.message, text, match.start, match.end));
  }

  // Sentence variance — no specific character range, applies to whole chunk
  const varianceFlags = checkSentenceVariance(text, sceneId);
  for (const flag of varianceFlags) {
    annotations.push(flagToAnnotation(flag.severity, "rhythm_monotony", flag.message, text, 0, 0));
  }

  // Paragraph length
  const maxSentences = bible.styleGuide.paragraphPolicy?.maxSentences ?? null;
  const paraFlags = checkParagraphLength(text, maxSentences, sceneId);
  for (const flag of paraFlags) {
    const paraSnippet = extractQuotedSnippet(flag.message);
    const match = paraSnippet ? findSnippetInText(text, paraSnippet) : { start: 0, end: 0 };
    annotations.push(flagToAnnotation(flag.severity, "paragraph_length", flag.message, text, match.start, match.end));
  }

  return annotations;
}

function flagToAnnotation(
  severity: Severity,
  category: LocalReviewCategory,
  message: string,
  text: string,
  start: number,
  end: number,
): EditorialAnnotation {
  const focusText = start < end ? text.slice(start, Math.min(end, start + 60)) : "";
  const prefixStart = Math.max(0, start - 20);
  const suffixEnd = Math.min(text.length, end + 20);

  return {
    id: generateId(),
    category,
    severity,
    scope: "both",
    message,
    suggestion: null,
    anchor: {
      prefix: text.slice(prefixStart, start),
      focus: focusText,
      suffix: text.slice(end, suffixEnd),
    },
    charRange: { start, end },
    fingerprint: hashFingerprint(category, focusText),
  };
}

function findPatternInText(text: string, flagMessage: string): { start: number; end: number } {
  // Extract the pattern from "Avoid list violation: "pattern" found."
  const match = flagMessage.match(/"(.+?)"/);
  if (!match?.[1]) return { start: 0, end: 0 };
  const idx = text.toLowerCase().indexOf(match[1].toLowerCase());
  if (idx === -1) return { start: 0, end: 0 };
  return { start: idx, end: idx + match[1].length };
}

function extractQuotedSnippet(message: string): string | null {
  const match = message.match(/"(.+?)\.\.\."/);
  return match?.[1] ?? null;
}

function findSnippetInText(text: string, snippet: string): { start: number; end: number } {
  const idx = text.indexOf(snippet);
  if (idx === -1) return { start: 0, end: 0 };
  // Find end of paragraph
  const paraEnd = text.indexOf("\n\n", idx);
  return { start: idx, end: paraEnd === -1 ? text.length : paraEnd };
}
