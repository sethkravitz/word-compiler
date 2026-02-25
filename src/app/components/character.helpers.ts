import type { CharacterDossier } from "../../types/index.js";

export function buildCharacterSummary(char: CharacterDossier): string {
  const parts: string[] = [];
  if (char.voice.sentenceLengthRange) {
    const [min, max] = char.voice.sentenceLengthRange;
    parts.push(`${min}–${max}w`);
  }
  if (char.voice.verbalTics.length > 0) {
    parts.push(char.voice.verbalTics[0]!);
  }
  if (char.voice.metaphoricRegister) {
    const keyword = char.voice.metaphoricRegister.split(/[—,–]/)[0]!.trim();
    if (keyword.length <= 30) parts.push(keyword);
  }
  if (parts.length > 0) return parts.join(" · ");
  if (char.physicalDescription) {
    const first = char.physicalDescription.split(". ")[0]!;
    return first.length > 50 ? `${first.slice(0, 50)}...` : first;
  }
  return "No details yet";
}

export function hasIdentity(char: CharacterDossier): boolean {
  return !!(
    char.physicalDescription ||
    char.backstory ||
    char.selfNarrative ||
    (char.contradictions && char.contradictions.length > 0)
  );
}

export function hasVoice(char: CharacterDossier): boolean {
  return !!(
    char.voice.vocabularyNotes ||
    char.voice.verbalTics.length > 0 ||
    char.voice.metaphoricRegister ||
    char.voice.prohibitedLanguage.length > 0 ||
    char.voice.sentenceLengthRange ||
    char.voice.dialogueSamples.length > 0
  );
}

export function hasBehavior(char: CharacterDossier): boolean {
  if (!char.behavior) return false;
  const b = char.behavior;
  return !!(b.stressResponse || b.socialPosture || b.noticesFirst || b.lyingStyle || b.emotionPhysicality);
}
