<script lang="ts">
import type { CharacterDossier } from "../../types/index.js";
import {
  CollapsibleSection,
  ExamplesDrawer,
  FormField,
  Input,
  NumberRange,
  RadioGroup,
  TagInput,
  TextArea,
} from "../primitives/index.js";
import { getExamples } from "./field-examples.js";

let {
  character,
  onUpdate,
}: {
  character: CharacterDossier;
  onUpdate: (changes: Partial<CharacterDossier>) => void;
} = $props();
</script>

<div class="char-form-fields">
  <FormField label="Name" fieldId="characterName" required>
    <Input value={character.name} oninput={(e) => onUpdate({ name: (e.target as HTMLInputElement).value })} placeholder="Character name" />
  </FormField>
  <FormField label="Role" fieldId="characterRole">
    <RadioGroup name={`charRole-${character.id}`} value={character.role} options={[
      { value: "protagonist", label: "Protagonist" },
      { value: "antagonist", label: "Antagonist" },
      { value: "supporting", label: "Supporting" },
      { value: "minor", label: "Minor" },
    ]} onchange={(v) => onUpdate({ role: v as CharacterDossier["role"] })} />
  </FormField>

  <CollapsibleSection summary="Appearance & Background" priority="helpful" sectionId={`bible-char-appearance-${character.id}`}>
    <div class="char-section">
      <FormField label="Physical Description" fieldId="physicalDescription">
        <TextArea value={character.physicalDescription ?? ""} variant="compact" rows={2} oninput={(e) => onUpdate({ physicalDescription: (e.target as HTMLTextAreaElement).value || null })} placeholder="What does the reader SEE?" />
      </FormField>
      <FormField label="Backstory" fieldId="backstory">
        <TextArea value={character.backstory ?? ""} variant="compact" rows={2} oninput={(e) => onUpdate({ backstory: (e.target as HTMLTextAreaElement).value || null })} placeholder="Brief but specific" />
      </FormField>
    </div>
  </CollapsibleSection>

  <CollapsibleSection summary="Voice" priority="helpful" sectionId={`bible-char-voice-${character.id}`}>
    <div class="char-section">
      <FormField label="Vocabulary Notes" fieldId="vocabularyNotes">
        <TextArea value={character.voice.vocabularyNotes ?? ""} variant="compact" rows={2} oninput={(e) => onUpdate({ voice: { ...character.voice, vocabularyNotes: (e.target as HTMLTextAreaElement).value || null } })} />
        <ExamplesDrawer fieldId="vocabularyNotes" examples={getExamples("vocabularyNotes")} onApplyTemplate={(content) => onUpdate({ voice: { ...character.voice, vocabularyNotes: content } })} />
      </FormField>
      <FormField label="Verbal Tics" fieldId="verbalTics">
        <TagInput tags={character.voice.verbalTics} onchange={(v) => onUpdate({ voice: { ...character.voice, verbalTics: v } })} placeholder="um, you know..." />
      </FormField>
      <FormField label="Metaphoric Register" fieldId="metaphoricRegister">
        <Input value={character.voice.metaphoricRegister ?? ""} oninput={(e) => onUpdate({ voice: { ...character.voice, metaphoricRegister: (e.target as HTMLInputElement).value || null } })} />
      </FormField>
      <FormField label="Prohibited Language" fieldId="prohibitedLanguage">
        <TagInput tags={character.voice.prohibitedLanguage} onchange={(v) => onUpdate({ voice: { ...character.voice, prohibitedLanguage: v } })} placeholder="Words this character would never use..." />
      </FormField>
      <FormField label="Dialogue Samples" fieldId="dialogueSamples">
        <TagInput tags={character.voice.dialogueSamples} onchange={(v) => onUpdate({ voice: { ...character.voice, dialogueSamples: v } })} placeholder="Example dialogue lines..." />
      </FormField>
      <FormField label="Sentence Length Range" fieldId="sentenceLengthRange">
        <NumberRange
          value={character.voice.sentenceLengthRange ?? [5, 25]}
          onchange={(v) => onUpdate({ voice: { ...character.voice, sentenceLengthRange: v } })}
          labels={["min", "max"]}
        />
      </FormField>
    </div>
  </CollapsibleSection>

  <CollapsibleSection summary="Behavior" priority="advanced" sectionId={`bible-char-behavior-${character.id}`}>
    <div class="char-section">
      <FormField label="Stress Response" fieldId="stressResponse">
        <TextArea value={character.behavior?.stressResponse ?? ""} variant="compact" rows={1} oninput={(e) => onUpdate({ behavior: { ...(character.behavior ?? {}), stressResponse: (e.target as HTMLTextAreaElement).value || null } })} />
      </FormField>
      <FormField label="Social Posture" fieldId="socialPosture">
        <TextArea value={character.behavior?.socialPosture ?? ""} variant="compact" rows={1} oninput={(e) => onUpdate({ behavior: { ...(character.behavior ?? {}), socialPosture: (e.target as HTMLTextAreaElement).value || null } })} />
      </FormField>
      <FormField label="Notices First" fieldId="noticesFirst">
        <TextArea value={character.behavior?.noticesFirst ?? ""} variant="compact" rows={1} oninput={(e) => onUpdate({ behavior: { ...(character.behavior ?? {}), noticesFirst: (e.target as HTMLTextAreaElement).value || null } })} />
      </FormField>
      <FormField label="Lying Style" fieldId="lyingStyle">
        <TextArea value={character.behavior?.lyingStyle ?? ""} variant="compact" rows={1} oninput={(e) => onUpdate({ behavior: { ...(character.behavior ?? {}), lyingStyle: (e.target as HTMLTextAreaElement).value || null } })} />
      </FormField>
      <FormField label="Emotion Physicality" fieldId="emotionPhysicality">
        <TextArea value={character.behavior?.emotionPhysicality ?? ""} variant="compact" rows={1} oninput={(e) => onUpdate({ behavior: { ...(character.behavior ?? {}), emotionPhysicality: (e.target as HTMLTextAreaElement).value || null } })} />
        <ExamplesDrawer fieldId="emotionPhysicality" examples={getExamples("emotionPhysicality")} onApplyTemplate={(content) => onUpdate({ behavior: { ...(character.behavior ?? {}), emotionPhysicality: content } })} />
      </FormField>
    </div>
  </CollapsibleSection>
</div>

<style>
  .char-form-fields { display: flex; flex-direction: column; gap: 8px; }
  .char-section { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
</style>
