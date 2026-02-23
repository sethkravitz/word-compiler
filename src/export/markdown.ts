import type { SceneEntry } from "../app/store/project.svelte.js";
import type { ChapterArc, Chunk } from "../types/index.js";
import { getCanonicalText } from "../types/index.js";

/**
 * Export scenes as Markdown with chapter/scene headings.
 */
export function exportToMarkdown(
  scenes: SceneEntry[],
  sceneChunks: Record<string, Chunk[]>,
  chapterArc?: ChapterArc | null,
): string {
  const parts: string[] = [];

  if (chapterArc?.workingTitle) {
    parts.push(`# ${chapterArc.workingTitle}`);
    parts.push("");
  }

  const sorted = [...scenes].sort((a, b) => a.sceneOrder - b.sceneOrder);

  for (let i = 0; i < sorted.length; i++) {
    const scene = sorted[i]!;
    const chunks = sceneChunks[scene.plan.id] ?? [];
    if (chunks.length === 0) continue;

    if (i > 0) {
      parts.push("---");
      parts.push("");
    }

    parts.push(`## ${scene.plan.title || `Scene ${i + 1}`}`);
    parts.push("");

    const prose = chunks.map((c) => getCanonicalText(c)).join("\n\n");
    parts.push(prose);
    parts.push("");
  }

  // Word count footer
  const allText = sorted.flatMap((s) => (sceneChunks[s.plan.id] ?? []).map((c) => getCanonicalText(c))).join(" ");
  const wordCount = allText.split(/\s+/).filter(Boolean).length;
  if (wordCount > 0) {
    parts.push("---");
    parts.push("");
    parts.push(`*${wordCount.toLocaleString()} words*`);
  }

  return parts.join("\n").trimEnd();
}
