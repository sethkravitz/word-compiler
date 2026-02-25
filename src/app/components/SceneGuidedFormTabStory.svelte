<script lang="ts">
import { onMount } from "svelte";
import type { CharacterDossier, Location } from "../../types/index.js";
import { createEmptyCharacterDossier, generateId } from "../../types/index.js";
import SceneGuidedFormTab from "./SceneGuidedFormTab.svelte";

let {
  withCharacters = false,
  withLocations = false,
  initialStep = "core",
}: {
  withCharacters?: boolean;
  withLocations?: boolean;
  initialStep?: "core" | "reader" | "texture" | "structure";
} = $props();

const STEPS = ["core", "reader", "texture", "structure"];

const characters: CharacterDossier[] = withCharacters
  ? [
      {
        ...createEmptyCharacterDossier("Alice Whitmore"),
        role: "protagonist",
        physicalDescription: "Sharp eyes, ink-stained fingers",
        backstory: "Investigative journalist chasing a decade-old corruption case",
      },
      {
        ...createEmptyCharacterDossier("Bob Harlan"),
        role: "supporting",
        physicalDescription: "Tailored suits, easy smile",
        backstory: "Alice's editor — charming surface conceals deep anxiety",
      },
      {
        ...createEmptyCharacterDossier("Marcus Vega"),
        role: "antagonist",
        physicalDescription: "Lean build, silver watch he never takes off",
        backstory: "Corporate fixer with ties to the scandal",
      },
    ]
  : [];

const locations: Location[] = withLocations
  ? [
      {
        id: generateId(),
        name: "The Velvet",
        description: "Jazz bar in a decaying waterfront district",
        sensoryPalette: {
          sounds: ["muted trumpet", "ice clinking"],
          smells: ["bourbon", "old wood"],
          textures: ["worn leather"],
          lightQuality: "Amber neon through dirty glass",
          atmosphere: "Melancholy warmth",
          prohibitedDefaults: [],
        },
      },
      {
        id: generateId(),
        name: "Herald Newsroom",
        description: "Open-plan newsroom, third floor",
        sensoryPalette: {
          sounds: ["keyboard clatter", "muted phones"],
          smells: ["stale coffee"],
          textures: ["laminate desk"],
          lightQuality: "Fluorescent hum",
          atmosphere: "Productive tension",
          prohibitedDefaults: [],
        },
      },
    ]
  : [];

let tabRef: SceneGuidedFormTab | undefined = $state();

async function handleSave() {
  // no-op in story
}

onMount(() => {
  const target = STEPS.indexOf(initialStep);
  if (target > 0 && tabRef) {
    // Defer so the component's own $effect (which resets to "core") runs first
    setTimeout(() => {
      for (let i = 0; i < target; i++) {
        tabRef?.next();
      }
    }, 0);
  }
});
</script>

<div style="max-width: 560px; padding: 16px;">
  <SceneGuidedFormTab
    bind:this={tabRef}
    {characters}
    {locations}
    projectId="story-proj"
    open={true}
    onSave={handleSave}
  />
</div>
