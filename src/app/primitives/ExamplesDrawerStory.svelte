<script lang="ts">
import { tick } from "svelte";
import { FIELD_EXAMPLES, type FieldExample } from "../components/field-examples.js";
import ExamplesDrawer from "./ExamplesDrawer.svelte";

let {
  preset = "narrativeGoal",
  withApplyTemplate = true,
}: {
  preset?: string;
  withApplyTemplate?: boolean;
} = $props();

let examples = $derived<FieldExample[]>(FIELD_EXAMPLES[preset] ?? []);
let applied = $state<string | null>(null);
let containerEl: HTMLDivElement | undefined = $state();

// Auto-expand the drawer after mount so stories show content
$effect(() => {
  void examples;
  tick().then(() => {
    const trigger = containerEl?.querySelector<HTMLButtonElement>(".examples-trigger");
    if (trigger && !containerEl?.querySelector(".examples-content")) {
      trigger.click();
    }
  });
});

function handleApply(content: string) {
  applied = content;
}
</script>

<div style="max-width: 480px; padding: 16px;" bind:this={containerEl}>
  <ExamplesDrawer
    fieldId={preset}
    {examples}
    onApplyTemplate={withApplyTemplate ? handleApply : undefined}
  />
  {#if applied}
    <div class="applied-preview">
      <strong>Applied:</strong>
      <pre>{applied}</pre>
    </div>
  {/if}
</div>

<style>
  .applied-preview {
    margin-top: 12px;
    padding: 8px;
    border: 1px solid var(--border, #444);
    border-radius: 4px;
    font-size: 11px;
    background: var(--bg-secondary, #1a1a2e);
    color: var(--text-primary, #e0e0e0);
  }
  .applied-preview pre {
    margin: 4px 0 0;
    white-space: pre-wrap;
    font-size: 10px;
  }
</style>
