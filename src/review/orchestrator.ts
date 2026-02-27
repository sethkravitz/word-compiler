import type { Bible } from "../types/bible.js";
import type { ScenePlan } from "../types/scene.js";
import { generateId } from "../types/utils.js";
import { resolveAnchor } from "./anchorResolver.js";
import { buildReviewContext } from "./contextBuilder.js";
import { hashFingerprint } from "./fingerprint.js";
import { runLocalChecks } from "./localChecks.js";
import { buildReviewSystemPrompt, buildReviewUserPrompt, REVIEW_OUTPUT_SCHEMA } from "./prompt.js";
import type { ChunkView, EditorialAnnotation, LLMReviewCategory, ReviewOrchestrator, Severity } from "./types.js";

export interface LLMReviewClient {
  review(systemPrompt: string, userPrompt: string, signal: AbortSignal): Promise<string>;
}

export function createReviewOrchestrator(
  bible: Bible,
  scenePlan: ScenePlan,
  getDismissed: () => Set<string>,
  llmClient: LLMReviewClient,
  onAnnotationsChanged: (chunkIndex: number, anns: EditorialAnnotation[]) => void,
): ReviewOrchestrator {
  let abortController: AbortController | null = null;
  const annotations = new Map<number, EditorialAnnotation[]>();
  const reviewing = new Set<number>();

  function requestReview(chunks: ChunkView[]) {
    abortController?.abort();
    abortController = new AbortController();

    const context = buildReviewContext(bible, scenePlan);
    const systemPrompt = buildReviewSystemPrompt(context);

    for (const chunk of chunks) {
      // Tier 1: Deterministic (instant) — publish immediately
      const localAnnotations = runLocalChecks(chunk.text, bible, chunk.sceneId);
      const filteredLocal = localAnnotations.filter((a) => !getDismissed().has(a.fingerprint));
      const resolvedLocal = resolveAnnotations(filteredLocal, chunk.text);
      annotations.set(chunk.index, resolvedLocal);
      onAnnotationsChanged(chunk.index, resolvedLocal);

      // Tier 2: LLM review (async) — merge when ready
      reviewing.add(chunk.index);
      const userPrompt = buildReviewUserPrompt(chunk.text);

      llmClient
        .review(systemPrompt, userPrompt, abortController.signal)
        .then((rawJson) => {
          const llmAnnotations = parseLLMResponse(rawJson, chunk.text);
          const all = [...localAnnotations, ...llmAnnotations].filter((a) => !getDismissed().has(a.fingerprint));
          const resolved = resolveAnnotations(all, chunk.text);
          annotations.set(chunk.index, resolved);
          onAnnotationsChanged(chunk.index, resolved);
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          // LLM failed — local annotations already showing, no action needed
        })
        .finally(() => reviewing.delete(chunk.index));
    }
  }

  function cancelAll() {
    abortController?.abort();
    reviewing.clear();
  }

  return { requestReview, cancelAll, annotations, reviewing };
}

function resolveAnnotations(anns: EditorialAnnotation[], text: string): EditorialAnnotation[] {
  return anns
    .map((a) => {
      const match = resolveAnchor(text, a.anchor, a.charRange);
      return { ...a, charRange: { start: match.start, end: match.end } };
    })
    .filter((a) => a.charRange.start !== a.charRange.end || a.anchor.focus === "");
}

const VALID_LLM_CATEGORIES = new Set<LLMReviewCategory>([
  "tone",
  "grammar",
  "voice",
  "punctuation",
  "show_dont_tell",
  "pov",
  "dialogue",
  "metaphor",
  "vocabulary",
  "continuity",
]);
const VALID_SEVERITIES = new Set<Severity>(["critical", "warning", "info"]);
const VALID_SCOPES = new Set(["dialogue", "narration", "both"]);

function parseLLMResponse(raw: string, chunkText: string): EditorialAnnotation[] {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.annotations || !Array.isArray(parsed.annotations)) return [];
    return parsed.annotations
      .filter(
        (a: Record<string, unknown>) =>
          typeof a.category === "string" &&
          VALID_LLM_CATEGORIES.has(a.category as LLMReviewCategory) &&
          typeof a.message === "string" &&
          a.anchor &&
          typeof (a.anchor as Record<string, unknown>).focus === "string",
      )
      .map(
        (a: {
          category: string;
          severity: string;
          scope: string;
          message: string;
          suggestion: string | null;
          anchor: { prefix: string; focus: string; suffix: string };
        }) => {
          const severity: Severity = VALID_SEVERITIES.has(a.severity as Severity) ? (a.severity as Severity) : "info";
          const scope = VALID_SCOPES.has(a.scope) ? a.scope : "both";
          const focusIdx = chunkText.indexOf(a.anchor.focus);
          return {
            id: generateId(),
            category: a.category,
            severity,
            scope,
            message: a.message,
            suggestion: a.suggestion ?? null,
            anchor: a.anchor,
            charRange: {
              start: focusIdx === -1 ? 0 : focusIdx,
              end: focusIdx === -1 ? 0 : focusIdx + a.anchor.focus.length,
            },
            fingerprint: hashFingerprint(a.category, a.anchor.focus),
          } as EditorialAnnotation;
        },
      );
  } catch {
    return [];
  }
}

export { REVIEW_OUTPUT_SCHEMA };
