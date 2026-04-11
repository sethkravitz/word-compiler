import type { SceneEntry } from "../app/store/project.svelte.js";
import type { Chunk } from "../types/index.js";
import { getCanonicalText } from "../types/index.js";

/**
 * Export sections as plain text with section separators.
 */
export function exportToPlaintext(scenes: SceneEntry[], sceneChunks: Record<string, Chunk[]>): string {
  const sorted = [...scenes].sort((a, b) => a.sceneOrder - b.sceneOrder);

  const sceneProse = sorted
    .map((scene) => {
      const chunks = sceneChunks[scene.plan.id] ?? [];
      return chunks.map((c) => getCanonicalText(c)).join("\n\n");
    })
    .filter((text) => text.length > 0);

  return sceneProse.join("\n\n* * *\n\n");
}
