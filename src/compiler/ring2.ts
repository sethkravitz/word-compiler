import { countTokens } from "../tokens/index.js";
import type { Bible, ChapterArc, CharacterDelta, CompilationConfig, NarrativeIR, RingSection } from "../types/index.js";
import { assembleSections } from "./helpers.js";

export interface Ring2Result {
  text: string;
  sections: RingSection[];
  tokenCount: number;
}

// ─── IR-derived voice state ──────────────────────────

function buildCharacterStateFromDeltas(deltas: CharacterDelta[]): string {
  const parts: string[] = [];
  if (deltas.some((d) => d.learned)) {
    parts.push(
      `Established: ${deltas
        .filter((d) => d.learned)
        .map((d) => d.learned)
        .join("; ")}`,
    );
  }
  if (deltas.some((d) => d.suspicionGained)) {
    parts.push(
      `Building toward: ${deltas
        .filter((d) => d.suspicionGained)
        .map((d) => d.suspicionGained)
        .join("; ")}`,
    );
  }
  if (deltas.some((d) => d.emotionalShift)) {
    const last = [...deltas].reverse().find((d) => d.emotionalShift);
    if (last) parts.push(`Tonal register: ${last.emotionalShift}`);
  }
  if (deltas.some((d) => d.relationshipChange)) {
    parts.push(
      `Rhetorical stance: ${deltas
        .filter((d) => d.relationshipChange)
        .map((d) => d.relationshipChange)
        .join("; ")}`,
    );
  }
  return parts.join("\n");
}

function buildChapterBriefSection(chapterArc: ChapterArc): RingSection {
  const briefParts: string[] = [`${chapterArc.workingTitle}`];
  if (chapterArc.narrativeFunction) {
    briefParts.push(`Thesis: ${chapterArc.narrativeFunction}`);
  }
  if (chapterArc.dominantRegister) {
    briefParts.push(`Register: ${chapterArc.dominantRegister}`);
  }
  if (chapterArc.pacingTarget) {
    briefParts.push(`Pacing: ${chapterArc.pacingTarget}`);
  }
  if (chapterArc.endingPosture) {
    briefParts.push(`Ending: ${chapterArc.endingPosture}`);
  }
  return {
    name: "CHAPTER_BRIEF",
    text: `=== ESSAY THESIS & STRUCTURE ===\n${briefParts.join("\n")}`,
    priority: 0,
    immune: true,
  };
}

function buildReaderStateSection(entering: ChapterArc["readerStateEntering"]): RingSection | null {
  if (!entering) return null;
  const parts: string[] = [];
  if (entering.knows.length > 0) parts.push(`Established: ${entering.knows.join("; ")}`);
  if (entering.suspects.length > 0) parts.push(`Expects: ${entering.suspects.join("; ")}`);
  if (entering.wrongAbout.length > 0) parts.push(`Assumptions challenged: ${entering.wrongAbout.join("; ")}`);
  if (entering.activeTensions.length > 0) parts.push(`Open questions: ${entering.activeTensions.join("; ")}`);
  if (parts.length === 0) return null;
  return {
    name: "READER_STATE_ENTRY",
    text: `ARGUMENT STATE ENTERING THIS SECTION:\n${parts.join("\n")}`,
    priority: 3,
    immune: false,
  };
}

function buildActiveSetupsSection(bible: Bible): RingSection | null {
  const activeSetups = bible.narrativeRules.setups.filter((s) => s.status === "planned" || s.status === "planted");
  if (activeSetups.length === 0) return null;
  return {
    name: "ACTIVE_SETUPS",
    text: `ACTIVE ARGUMENT THREADS:\n${activeSetups.map((s) => `- ${s.description} [${s.status}]`).join("\n")}`,
    priority: 4,
    immune: false,
  };
}

function buildCharacterStateSections(verifiedIRs: NarrativeIR[], bible: Bible): RingSection[] {
  const sections: RingSection[] = [];

  // Gather all character ids that appear in any delta
  const characterIds = new Set<string>();
  for (const ir of verifiedIRs) {
    for (const delta of ir.characterDeltas) {
      if (delta.characterId) characterIds.add(delta.characterId);
    }
  }

  for (const charId of characterIds) {
    const char = bible.characters.find((c) => c.id === charId);
    const characterName = char?.name ?? charId;

    // Cumulative deltas for this voice across all prior sections
    const cumulativeDeltas = verifiedIRs.flatMap((ir) => ir.characterDeltas.filter((d) => d.characterId === charId));

    const stateText = buildCharacterStateFromDeltas(cumulativeDeltas);
    if (!stateText) continue;

    // Also include last known position if any IR has it
    const lastPositionIR = [...verifiedIRs]
      .reverse()
      .find((ir) => ir.characterPositions[characterName] || ir.characterPositions[charId]);
    const position = lastPositionIR?.characterPositions[characterName] ?? lastPositionIR?.characterPositions[charId];

    const fullText = position ? `${stateText}\nCurrent position: ${position}` : stateText;

    sections.push({
      name: `CHAR_STATE_${charId.toUpperCase().replace(/-/g, "_")}`,
      text: `VOICE STATE — ${characterName.toUpperCase()} (entering this section):\n${fullText}`,
      priority: 2,
      immune: false,
    });
  }

  return sections;
}

function buildUnresolvedTensionsSection(lastIR: NarrativeIR): RingSection | null {
  if (lastIR.unresolvedTensions.length === 0) return null;
  return {
    name: "UNRESOLVED_TENSIONS",
    text: `OPEN QUESTIONS ENTERING THIS SECTION:\n${lastIR.unresolvedTensions.map((t) => `- ${t}`).join("\n")}`,
    priority: 3,
    immune: false,
  };
}

export function buildRing2(
  chapterArc: ChapterArc,
  bible: Bible,
  previousSceneIRs: NarrativeIR[],
  _config: CompilationConfig,
): Ring2Result {
  const sections: RingSection[] = [];

  // --- Chapter Brief (immune) ---
  sections.push(buildChapterBriefSection(chapterArc));

  // --- Reader State at Entry (compressible) ---
  const readerState = buildReaderStateSection(chapterArc.readerStateEntering);
  if (readerState) sections.push(readerState);

  // --- Active Setups (compressible) ---
  const setups = buildActiveSetupsSection(bible);
  if (setups) sections.push(setups);

  // --- IR-Derived Character States (compressible, one section per active voice) ---
  // Only added when verified IRs are available — skip for section 1
  const verifiedIRs = previousSceneIRs.filter((ir) => ir.verified);
  if (verifiedIRs.length > 0) {
    sections.push(...buildCharacterStateSections(verifiedIRs, bible));

    // --- Open questions from last section (compressible) ---
    const lastIR = verifiedIRs[verifiedIRs.length - 1]!;
    const tensions = buildUnresolvedTensionsSection(lastIR);
    if (tensions) sections.push(tensions);
  }

  const text = assembleSections(sections);
  const tokenCount = countTokens(text);

  return { text, sections, tokenCount };
}
