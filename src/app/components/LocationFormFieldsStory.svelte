<script lang="ts">
import type { Location } from "../../types/index.js";
import { generateId } from "../../types/index.js";
import LocationFormFields from "./LocationFormFields.svelte";

let {
  prePopulated = false,
}: {
  prePopulated?: boolean;
} = $props();

function makeLoc(): Location {
  const loc: Location = {
    id: generateId(),
    name: "",
    description: null,
    sensoryPalette: {
      sounds: [],
      smells: [],
      textures: [],
      lightQuality: null,
      atmosphere: null,
      prohibitedDefaults: [],
    },
  };
  if (!prePopulated) return loc;
  return {
    ...loc,
    name: "The Harbor Office",
    description:
      "A converted shipping container on the south wharf, insulated with stolen carpet and lit by a single fluorescent tube that hums in C-sharp.",
    sensoryPalette: {
      sounds: ["foghorn", "hull creak", "distant radio"],
      smells: ["diesel", "salt", "wet cardboard"],
      textures: ["rusted metal", "sticky vinyl"],
      lightQuality: "Greenish fluorescent, pools in the center, corners stay dark",
      atmosphere: "Claustrophobic competence — everything has a purpose, nothing is comfortable",
      prohibitedDefaults: ["ocean breeze", "salty air", "crashing waves"],
    },
  };
}

let location = $state(makeLoc());

function handleUpdate(changes: Partial<Location>) {
  location = { ...location, ...changes };
}
</script>

<div style="max-width: 500px; font-family: var(--font-mono); font-size: 13px;">
  <LocationFormFields {location} onUpdate={handleUpdate} />
</div>
