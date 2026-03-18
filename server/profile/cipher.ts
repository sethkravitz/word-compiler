import type Anthropic from "@anthropic-ai/sdk";
import type { PreferenceStatement } from "../../src/profile/types.js";
import { generateId } from "../../src/types/index.js";
import { textCall } from "./llm.js";

export const CIPHER_BATCH_SIZE = 10;

export const CIPHER_SYSTEM =
  "You are a writing style analyst. Given a batch of edits an author made to LLM-generated prose, identify the writing preferences and patterns these edits reveal. Focus on recurring stylistic preferences, not individual content choices.";

export function buildBatchCipherPrompt(edits: Array<{ original: string; edited: string }>): string {
  const editBlocks = edits
    .map(
      (e, i) => `Edit ${i + 1}:\nORIGINAL: ${e.original.slice(0, 500)}\nEDITED: ${e.edited.slice(0, 500)}`,
    )
    .join("\n\n");

  return `The author made these ${edits.length} edits to LLM-generated prose:

${editBlocks}

What writing preferences and patterns do these edits reveal? Identify 3-5 specific, actionable style preferences. Focus on recurring patterns across multiple edits. Each preference should be one sentence.

Format as a numbered list.`;
}

const CIPHER_MODEL = "claude-haiku-4-5-20251001";

export async function inferBatchPreferences(
  client: Anthropic,
  projectId: string,
  edits: Array<{ original: string; edited: string }>,
): Promise<PreferenceStatement> {
  const statement = await textCall(client, CIPHER_MODEL, CIPHER_SYSTEM, buildBatchCipherPrompt(edits));

  return {
    id: generateId(),
    projectId,
    statement,
    editCount: edits.length,
    createdAt: new Date().toISOString(),
  };
}
