<script lang="ts">
import type { Location } from "../../types/index.js";
import { CollapsibleSection, FormField, Input, TagInput, TextArea } from "../primitives/index.js";

let {
  location,
  onUpdate,
}: {
  location: Location;
  onUpdate: (changes: Partial<Location>) => void;
} = $props();
</script>

<div class="loc-form-fields">
  <FormField label="Name" fieldId="locationName" required>
    <Input value={location.name} oninput={(e) => onUpdate({ name: (e.target as HTMLInputElement).value })} placeholder="Location name" />
  </FormField>
  <FormField label="Description" fieldId="locationDescription">
    <TextArea value={location.description ?? ""} variant="compact" rows={2} oninput={(e) => onUpdate({ description: (e.target as HTMLTextAreaElement).value || null })} />
  </FormField>

  <CollapsibleSection summary="Sensory Palette" priority="helpful" sectionId={`bible-loc-sensory-${location.id}`}>
    <div class="loc-section">
      <FormField label="Sounds" fieldId="sounds">
        <TagInput tags={location.sensoryPalette.sounds} onchange={(v) => onUpdate({ sensoryPalette: { ...location.sensoryPalette, sounds: v } })} placeholder="Specific sounds..." />
      </FormField>
      <FormField label="Smells" fieldId="smells">
        <TagInput tags={location.sensoryPalette.smells} onchange={(v) => onUpdate({ sensoryPalette: { ...location.sensoryPalette, smells: v } })} placeholder="Specific smells..." />
      </FormField>
      <FormField label="Textures" fieldId="textures">
        <TagInput tags={location.sensoryPalette.textures} onchange={(v) => onUpdate({ sensoryPalette: { ...location.sensoryPalette, textures: v } })} placeholder="What do hands touch here..." />
      </FormField>
      <FormField label="Light Quality" fieldId="lightQuality">
        <Input value={location.sensoryPalette.lightQuality ?? ""} oninput={(e) => onUpdate({ sensoryPalette: { ...location.sensoryPalette, lightQuality: (e.target as HTMLInputElement).value || null } })} placeholder="What does the light do?" />
      </FormField>
      <FormField label="Atmosphere" fieldId="atmosphere">
        <Input value={location.sensoryPalette.atmosphere ?? ""} oninput={(e) => onUpdate({ sensoryPalette: { ...location.sensoryPalette, atmosphere: (e.target as HTMLInputElement).value || null } })} />
      </FormField>
      <FormField label="Prohibited Defaults" fieldId="prohibitedDefaults">
        <TagInput tags={location.sensoryPalette.prohibitedDefaults} onchange={(v) => onUpdate({ sensoryPalette: { ...location.sensoryPalette, prohibitedDefaults: v } })} placeholder="Generic sensory details to avoid..." />
      </FormField>
    </div>
  </CollapsibleSection>
</div>

<style>
  .loc-form-fields { display: flex; flex-direction: column; gap: 8px; }
  .loc-section { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
</style>
