<script lang="ts">
import type { CharacterDossier } from "../../types/index.js";
import { createEmptyCharacterDossier } from "../../types/index.js";
import CharacterFormFields from "./CharacterFormFields.svelte";

let {
  prePopulated = false,
}: {
  prePopulated?: boolean;
} = $props();

function makeChar(): CharacterDossier {
  const char = createEmptyCharacterDossier("test-project");
  if (!prePopulated) return char;
  return {
    ...char,
    name: "Elena Vasquez",
    role: "protagonist",
    physicalDescription:
      "Dark hair cropped short, a scar running along her left jawline. Moves with a deliberate economy that suggests military training.",
    backstory:
      "Former intelligence analyst who defected after discovering her own agency was running the operation she'd been tasked to expose.",
    voice: {
      ...char.voice,
      vocabularyNotes: "Clinical precision in speech, avoids emotional modifiers. Uses technical jargon as deflection.",
      verbalTics: ["listen", "the thing is"],
      metaphoricRegister: "Mechanical — gears, circuits, systems",
      prohibitedLanguage: ["like", "basically", "honestly"],
      dialogueSamples: ["You're asking the wrong question.", "That's not how systems fail."],
      sentenceLengthRange: [4, 18],
    },
    behavior: {
      stressResponse: "Goes quiet, breathing becomes controlled. Hands move to pockets.",
      socialPosture: "Maintains distance, offers information as currency rather than connection.",
      noticesFirst: "Exits. Then hands. Then inconsistencies in what people say vs. how they stand.",
      lyingStyle: "Omission, never fabrication. Redirects with questions.",
      emotionPhysicality: "Jaw tightens before she speaks. Fingers tap a rhythm only she knows.",
    },
  };
}

let character = $state(makeChar());

function handleUpdate(changes: Partial<CharacterDossier>) {
  character = { ...character, ...changes };
}
</script>

<div style="max-width: 500px; font-family: var(--font-mono); font-size: 13px;">
  <CharacterFormFields {character} onUpdate={handleUpdate} />
</div>
