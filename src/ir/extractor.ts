import type { Bible, NarrativeIR, ScenePlan } from "../types/index.js";
import { DEFAULT_MODEL } from "../types/index.js";
import { parseIRResponse } from "./parser.js";

// ─── LLM Client Interface ────────────────────────────────

export interface IRLLMClient {
  call(
    systemMessage: string,
    userMessage: string,
    model: string,
    maxTokens: number,
    outputSchema?: Record<string, unknown>,
  ): Promise<string>;
}

// ─── Prompt Builder ──────────────────────────────────────

export function buildIRExtractionPrompt(prose: string, plan: ScenePlan, bible: Bible): string {
  const characterList = bible.characters.map((c) => `- ${c.name} (id: ${c.id}, role: ${c.role})`).join("\n");

  const activeSetups = bible.narrativeRules.setups.filter((s) => s.status === "planned" || s.status === "planted");

  const setupList =
    activeSetups.length > 0
      ? activeSetups.map((s) => `- [${s.id}] ${s.description} (${s.status})`).join("\n")
      : "(none registered)";

  return `SECTION PLAN:
Title: ${plan.title}
Section goal: ${plan.narrativeGoal}
Emotional beat: ${plan.emotionalBeat}

VOICES IN BRIEF:
${characterList}

ACTIVE SETUPS:
${setupList}

PAYOFF MATCHING RULES:
When a setup from ACTIVE SETUPS is paid off in this section, reference it in
payoffsExecuted using the setup's description verbatim as a prefix, followed
by " — " and a brief note on how the payoff occurred. Only list payoffs for
setups in the ACTIVE SETUPS list above.

SECTION PROSE:
${prose}

---

Extract the essay structural record for this section. Return ONLY valid JSON in this exact shape:

{
  "events": ["List of concrete claims, arguments, or points made — factual content, not atmosphere"],
  "factsIntroduced": ["Claims or evidence established in the essay after this section"],
  "factsRevealedToReader": ["Claims the reader now knows or points made explicitly in this section"],
  "factsWithheld": ["Evidence gaps or claims not yet supported — points implied but not proven"],
  "characterDeltas": [
    {
      "characterId": "exact id from voice list",
      "learned": "new insight or evidence the author introduced, or null",
      "suspicionGained": "where the argument is heading or foreshadowed conclusions, or null",
      "emotionalShift": "shift in tone or rhetorical stance, or null",
      "relationshipChange": "change in how the author relates to the subject or audience, or null"
    }
  ],
  "setupsPlanted": ["description of each setup planted in this section — quote from prose if possible"],
  "payoffsExecuted": ["<setup description from ACTIVE SETUPS> — <how it was paid off>"],
  "characterPositions": [
    { "characterId": "voice name or id", "position": "author's stated position on key topics at section end" }
  ],
  "unresolvedTensions": ["open questions or unresolved counterarguments — what keeps the reader engaged"]
}

Be specific and factual. Keep each string value TERSE (under 15 words). Do not add commentary. Do not invent claims not present in the prose.`;
}

// ─── Extractor ───────────────────────────────────────────

const IR_SYSTEM_MESSAGE = `You are an essay structure analyst. Your job is to extract a precise, factual structural record from section prose. You identify claims, argument progression, and unresolved questions without interpretation or evaluation. Return only JSON.`;

export async function extractIR(
  prose: string,
  plan: ScenePlan,
  bible: Bible,
  llmClient: IRLLMClient,
  model = DEFAULT_MODEL,
): Promise<NarrativeIR> {
  const userMessage = buildIRExtractionPrompt(prose, plan, bible);
  const responseText = await llmClient.call(IR_SYSTEM_MESSAGE, userMessage, model, 4096);
  if (!responseText || !responseText.trim()) {
    throw new Error("IR extraction failed: LLM returned an empty response");
  }
  return parseIRResponse(responseText, plan.id);
}
