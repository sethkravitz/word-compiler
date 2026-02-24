<script lang="ts">
import type { ReaderState } from "../../types/index.js";
import ReaderStateCard from "./ReaderStateCard.svelte";

let {
  knows = [] as string[],
  suspects = [] as string[],
  wrongAbout = [] as string[],
  activeTensions = [] as string[],
}: {
  knows?: string[];
  suspects?: string[];
  wrongAbout?: string[];
  activeTensions?: string[];
} = $props();

let state: ReaderState = $derived({
  knows,
  suspects,
  wrongAbout,
  activeTensions,
});
</script>

<div style="max-width: 500px; font-family: var(--font-mono); font-size: 13px;">
  <ReaderStateCard {state} />
</div>
