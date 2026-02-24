<script lang="ts">
import type { ReaderState } from "../../types/index.js";
import ReaderStateFields from "./ReaderStateFields.svelte";

let {
  prePopulated = false,
  showExamples = false,
}: {
  prePopulated?: boolean;
  showExamples?: boolean;
} = $props();

let state = $state<ReaderState | null>(
  prePopulated
    ? {
        knows: ["Marcus is the informant", "The letter was forged"],
        suspects: ["Elena knows more than she admits"],
        wrongAbout: ["Tomas is trustworthy"],
        activeTensions: ["Will the deal close before dawn?"],
      }
    : null,
);

function handleUpdate(rs: ReaderState) {
  state = rs;
}
</script>

<div style="max-width: 500px; font-family: var(--font-mono); font-size: 13px;">
  <ReaderStateFields {state} label="Reader State Entering" {showExamples} onUpdate={handleUpdate} />
</div>
