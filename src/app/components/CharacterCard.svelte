<script lang="ts">
import type { CharacterDossier } from "../../types/index.js";
import { Badge, CollapsibleSection, TruncatedProse } from "../primitives/index.js";
import { buildCharacterSummary, hasBehavior, hasIdentity, hasVoice } from "./character.helpers.js";

let {
  character,
}: {
  character: CharacterDossier;
} = $props();

let summary = $derived(buildCharacterSummary(character));
</script>

<CollapsibleSection summary={character.name} sectionId={`atlas-char-${character.id}`}>
    <div class="char-header">
      <Badge variant="default">{character.role}</Badge>
      <span class="char-summary">{summary}</span>
    </div>

    {#if hasIdentity(character)}
      <h4 class="atlas-group-title">Identity</h4>
      <div class="atlas-kv">
        {#if character.physicalDescription}
          <span class="atlas-kv-key">Physical</span>
          <span class="atlas-kv-val"><TruncatedProse text={character.physicalDescription} /></span>
        {/if}
        {#if character.backstory}
          <span class="atlas-kv-key">Backstory</span>
          <span class="atlas-kv-val"><TruncatedProse text={character.backstory} /></span>
        {/if}
        {#if character.selfNarrative}
          <span class="atlas-kv-key">Self-view</span>
          <span class="atlas-kv-val"><TruncatedProse text={character.selfNarrative} /></span>
        {/if}
        {#if character.contradictions && character.contradictions.length > 0}
          <span class="atlas-kv-key">Contradicts</span>
          <span class="atlas-kv-val atlas-kv-pills">
            {#each character.contradictions as c (c)}
              <span class="atlas-pill">{c}</span>
            {/each}
          </span>
        {/if}
      </div>
    {/if}

    {#if hasVoice(character)}
      <h4 class="atlas-group-title">Voice</h4>
      <div class="atlas-kv">
        {#if character.voice.vocabularyNotes}
          <span class="atlas-kv-key">Vocabulary</span>
          <span class="atlas-kv-val"><TruncatedProse text={character.voice.vocabularyNotes} /></span>
        {/if}
        {#if character.voice.verbalTics.length > 0}
          <span class="atlas-kv-key">Tics</span>
          <span class="atlas-kv-val atlas-kv-pills">
            {#each character.voice.verbalTics as tic (tic)}
              <span class="atlas-pill">{tic}</span>
            {/each}
          </span>
        {/if}
        {#if character.voice.metaphoricRegister}
          <span class="atlas-kv-key">Register</span>
          <span class="atlas-kv-val"><TruncatedProse text={character.voice.metaphoricRegister} /></span>
        {/if}
        {#if character.voice.prohibitedLanguage.length > 0}
          <span class="atlas-kv-key">Prohibited</span>
          <span class="atlas-kv-val atlas-kv-pills">
            {#each character.voice.prohibitedLanguage as word (word)}
              <span class="atlas-pill atlas-pill-warn">{word}</span>
            {/each}
          </span>
        {/if}
        {#if character.voice.sentenceLengthRange}
          <span class="atlas-kv-key">Sentence</span>
          <span class="atlas-kv-val">{character.voice.sentenceLengthRange[0]}–{character.voice.sentenceLengthRange[1]} words</span>
        {/if}
        {#if character.voice.dialogueSamples.length > 0}
          <span class="atlas-kv-key">Samples</span>
          <span class="atlas-kv-val">
            <div class="dialogue-samples">
              {#each character.voice.dialogueSamples as sample (sample)}
                <blockquote class="dialogue-sample">"{sample}"</blockquote>
              {/each}
            </div>
          </span>
        {/if}
      </div>
    {/if}

    {#if hasBehavior(character)}
      <h4 class="atlas-group-title">Behavior</h4>
      <div class="atlas-kv">
        {#if character.behavior?.stressResponse}
          <span class="atlas-kv-key">Stress</span>
          <span class="atlas-kv-val"><TruncatedProse text={character.behavior.stressResponse} /></span>
        {/if}
        {#if character.behavior?.socialPosture}
          <span class="atlas-kv-key">Social</span>
          <span class="atlas-kv-val"><TruncatedProse text={character.behavior.socialPosture} /></span>
        {/if}
        {#if character.behavior?.noticesFirst}
          <span class="atlas-kv-key">Notices</span>
          <span class="atlas-kv-val"><TruncatedProse text={character.behavior.noticesFirst} /></span>
        {/if}
        {#if character.behavior?.lyingStyle}
          <span class="atlas-kv-key">Lying</span>
          <span class="atlas-kv-val"><TruncatedProse text={character.behavior.lyingStyle} /></span>
        {/if}
        {#if character.behavior?.emotionPhysicality}
          <span class="atlas-kv-key">Emotion</span>
          <span class="atlas-kv-val"><TruncatedProse text={character.behavior.emotionPhysicality} /></span>
        {/if}
      </div>
    {/if}
</CollapsibleSection>

<style>
  .char-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .char-summary { font-size: 10px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
  .dialogue-samples { display: flex; flex-direction: column; gap: 3px; }
  .dialogue-sample {
    font-size: 11px; color: var(--text-secondary); font-style: italic;
    margin: 0; padding-left: 8px; border-left: 2px solid var(--border);
    line-height: 1.5;
  }
</style>
