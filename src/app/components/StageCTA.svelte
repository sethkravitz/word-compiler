<script lang="ts">
import { Button } from "../primitives/index.js";
import type { StageDefinition } from "../store/workflow.svelte.js";

let {
  nextStage,
  onclick,
}: {
  nextStage: StageDefinition | null;
  onclick: (stage: StageDefinition) => void;
} = $props();
</script>

{#if nextStage}
  <div class="stage-cta">
    <Button onclick={() => onclick(nextStage)}>
      Continue to {nextStage.label} →
    </Button>
  </div>
{/if}

<style>
  .stage-cta {
    display: flex;
    justify-content: center;
    padding: 12px 16px;
    flex-shrink: 0;
  }
</style>
