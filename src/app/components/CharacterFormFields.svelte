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
    <Input value={character.name} oninput={(e) => onUpdate({ name: (e.target as HTMLInputElement).value })} placeholder="Name" />
  </FormField>
  <FormField label="Role" fieldId="characterRole">
    <RadioGroup name={`charRole-${character.id}`} value={character.role} options={[
      { value: "protagonist", label: "Primary Author" },
      { value: "antagonist", label: "Counterpoint Voice" },
      { value: "supporting", label: "Referenced Voice" },
      { value: "minor", label: "Minor Reference" },
    ]} onchange={(v) => onUpdate({ role: v as CharacterDossier["role"] })} />
  </FormField>

  <CollapsibleSection summary="Background" priority="helpful" sectionId={`bible-char-appearance-${character.id}`}>
    <div class="char-section">
      <FormField label="Author Bio" fieldId="physicalDescription">
        <TextArea value={character.physicalDescription ?? ""} variant="compact" rows={2} oninput={(e) => onUpdate({ physicalDescription: (e.target as HTMLTextAreaElement).value || null })} placeholder="Brief professional or personal bio" />
      </FormField>
      <FormField label="Background / Expertise" fieldId="backstory">
        <TextArea value={character.backstory ?? ""} variant="compact" rows={2} oninput={(e) => onUpdate({ backstory: (e.target as HTMLTextAreaElement).value || null })} placeholder="What gives this voice authority on this topic?" />
      </FormField>
    </div>
  </CollapsibleSection>

  <CollapsibleSection summary="Voice" priority="helpful" sectionId={`bible-char-voice-${character.id}`}>
    <div class="char-section">
      <FormField label="Vocabulary Notes (Writing Style)" fieldId="vocabularyNotes">
        <TextArea value={character.voice.vocabularyNotes ?? ""} variant="compact" rows={2} oninput={(e) => onUpdate({ voice: { ...character.voice, vocabularyNotes: (e.target as HTMLTextAreaElement).value || null } })} />
        <ExamplesDrawer fieldId="vocabularyNotes" examples={getExamples("vocabularyNotes")} onApplyTemplate={(content) => onUpdate({ voice: { ...character.voice, vocabularyNotes: content } })} />
      </FormField>
      <FormField label="Writing Tics (Recurring Patterns)" fieldId="verbalTics">
        <TagInput tags={character.voice.verbalTics} onchange={(v) => onUpdate({ voice: { ...character.voice, verbalTics: v } })} placeholder="parentheticals, em dashes, sentence fragments..." />
      </FormField>
      <FormField label="Metaphoric Register" fieldId="metaphoricRegister">
        <Input value={character.voice.metaphoricRegister ?? ""} oninput={(e) => onUpdate({ voice: { ...character.voice, metaphoricRegister: (e.target as HTMLInputElement).value || null } })} />
      </FormField>
      <FormField label="Prohibited Language" fieldId="prohibitedLanguage">
        <TagInput tags={character.voice.prohibitedLanguage} onchange={(v) => onUpdate({ voice: { ...character.voice, prohibitedLanguage: v } })} placeholder="Words you would never write..." />
      </FormField>
      <FormField label="Writing Samples" fieldId="dialogueSamples">
        <TagInput tags={character.voice.dialogueSamples} onchange={(v) => onUpdate({ voice: { ...character.voice, dialogueSamples: v } })} placeholder="Paste 2-3 representative passages from your writing..." />
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

  <CollapsibleSection summary="Writing Tendencies" priority="advanced" sectionId={`bible-char-behavior-${character.id}`}>
    <div class="char-section">
      <FormField label="Argumentative Style" fieldId="stressResponse">
        <TextArea value={character.behavior?.stressResponse ?? ""} variant="compact" rows={1} oninput={(e) => onUpdate({ behavior: { ...(character.behavior ?? {}), stressResponse: (e.target as HTMLTextAreaElement).value || null } })} />
      </FormField>
      <FormField label="Rhetorical Approach" fieldId="socialPosture">
        <TextArea value={character.behavior?.socialPosture ?? ""} variant="compact" rows={1} oninput={(e) => onUpdate({ behavior: { ...(character.behavior ?? {}), socialPosture: (e.target as HTMLTextAreaElement).value || null } })} />
      </FormField>
      <FormField label="Observational Focus" fieldId="noticesFirst">
        <TextArea value={character.behavior?.noticesFirst ?? ""} variant="compact" rows={1} oninput={(e) => onUpdate({ behavior: { ...(character.behavior ?? {}), noticesFirst: (e.target as HTMLTextAreaElement).value || null } })} />
      </FormField>
      <FormField label="Persuasion Style" fieldId="lyingStyle">
        <TextArea value={character.behavior?.lyingStyle ?? ""} variant="compact" rows={1} oninput={(e) => onUpdate({ behavior: { ...(character.behavior ?? {}), lyingStyle: (e.target as HTMLTextAreaElement).value || null } })} />
      </FormField>
      <FormField label="Emotional Register" fieldId="emotionPhysicality">
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
