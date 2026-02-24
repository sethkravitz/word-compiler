<script lang="ts">
import type { ReaderState } from "../../types/index.js";
import { ExamplesDrawer, FormField, TagInput } from "../primitives/index.js";
import { getExamples } from "./field-examples.js";

const EMPTY: ReaderState = { knows: [], suspects: [], wrongAbout: [], activeTensions: [] };

let {
  state,
  label,
  onUpdate,
  showExamples = false,
}: {
  state: ReaderState | null;
  label: string;
  onUpdate: (state: ReaderState) => void;
  showExamples?: boolean;
} = $props();

function update(field: keyof ReaderState, value: string[]) {
  onUpdate({ ...(state ?? EMPTY), [field]: value });
}
</script>

<fieldset class="rs-fieldset">
  <legend>{label}</legend>
  <FormField label="Knows">
    <TagInput tags={state?.knows ?? []} onchange={(v) => update("knows", v)} />
  </FormField>
  <FormField label="Suspects">
    <TagInput tags={state?.suspects ?? []} onchange={(v) => update("suspects", v)} />
  </FormField>
  <FormField label="Wrong About" fieldId="readerStateWrongAbout">
    <TagInput tags={state?.wrongAbout ?? []} onchange={(v) => update("wrongAbout", v)} />
    {#if showExamples}
      <ExamplesDrawer fieldId="readerStateWrongAbout" examples={getExamples("readerStateWrongAbout")} />
    {/if}
  </FormField>
  <FormField label="Active Tensions">
    <TagInput tags={state?.activeTensions ?? []} onchange={(v) => update("activeTensions", v)} />
  </FormField>
</fieldset>

<style>
  .rs-fieldset {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 8px;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .rs-fieldset :global(legend) {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent);
    padding: 0 6px;
  }
</style>
