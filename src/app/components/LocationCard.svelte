<script lang="ts">
import type { Location } from "../../types/index.js";
import { CollapsibleSection, TruncatedProse } from "../primitives/index.js";
import { hasSensoryData } from "./location.helpers.js";

let {
  location,
}: {
  location: Location;
} = $props();
</script>

<CollapsibleSection summary={location.name} sectionId={`atlas-loc-${location.id}`}>
    {#if location.description}
      <div class="loc-desc">
        <TruncatedProse text={location.description} />
      </div>
    {/if}

    {#if hasSensoryData(location)}
      <h4 class="atlas-group-title">Sensory Palette</h4>
      <div class="atlas-kv">
        {#if location.sensoryPalette.sounds.length > 0}
          <span class="atlas-kv-key">Sounds</span>
          <span class="atlas-kv-val atlas-kv-pills">
            {#each location.sensoryPalette.sounds as s (s)}
              <span class="atlas-pill">{s}</span>
            {/each}
          </span>
        {/if}
        {#if location.sensoryPalette.smells.length > 0}
          <span class="atlas-kv-key">Smells</span>
          <span class="atlas-kv-val atlas-kv-pills">
            {#each location.sensoryPalette.smells as s (s)}
              <span class="atlas-pill">{s}</span>
            {/each}
          </span>
        {/if}
        {#if location.sensoryPalette.textures.length > 0}
          <span class="atlas-kv-key">Textures</span>
          <span class="atlas-kv-val atlas-kv-pills">
            {#each location.sensoryPalette.textures as t (t)}
              <span class="atlas-pill">{t}</span>
            {/each}
          </span>
        {/if}
        {#if location.sensoryPalette.lightQuality}
          <span class="atlas-kv-key">Light</span>
          <span class="atlas-kv-val"><TruncatedProse text={location.sensoryPalette.lightQuality} /></span>
        {/if}
        {#if location.sensoryPalette.atmosphere}
          <span class="atlas-kv-key">Mood</span>
          <span class="atlas-kv-val"><TruncatedProse text={location.sensoryPalette.atmosphere} /></span>
        {/if}
        {#if location.sensoryPalette.prohibitedDefaults.length > 0}
          <span class="atlas-kv-key">Avoid</span>
          <span class="atlas-kv-val atlas-kv-pills">
            {#each location.sensoryPalette.prohibitedDefaults as p (p)}
              <span class="atlas-pill atlas-pill-warn">{p}</span>
            {/each}
          </span>
        {/if}
      </div>
    {/if}
</CollapsibleSection>

<style>
  .loc-desc { margin-bottom: 6px; }
</style>
