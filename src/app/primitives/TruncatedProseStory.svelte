<script lang="ts">
import TruncatedProse from "./TruncatedProse.svelte";

let {
  text = "",
  maxLength = 120,
}: {
  text?: string;
  maxLength?: number;
} = $props();
</script>

<div style="max-width: 400px; font-family: var(--font-mono); font-size: 13px;">
  <TruncatedProse {text} {maxLength} />
</div>
