<script lang="ts">
let {
  value,
  onchange,
  labels,
}: {
  value: [number, number];
  onchange: (v: [number, number]) => void;
  labels?: [string, string];
} = $props();

function handleMin(e: Event) {
  const v = Number((e.target as HTMLInputElement).value);
  if (!Number.isNaN(v)) onchange([v, value[1]]);
}

function handleMax(e: Event) {
  const v = Number((e.target as HTMLInputElement).value);
  if (!Number.isNaN(v)) onchange([value[0], v]);
}
</script>

<div class="number-range">
  {#if labels?.[0]}
    <span class="number-range-label">{labels[0]}</span>
  {/if}
  <input class="number-range-input" type="number" value={value[0]} oninput={handleMin} />
  <span class="number-range-dash">&ndash;</span>
  <input class="number-range-input" type="number" value={value[1]} oninput={handleMax} />
  {#if labels?.[1]}
    <span class="number-range-label">{labels[1]}</span>
  {/if}
</div>

<style>
  .number-range { display: flex; align-items: center; gap: 6px; }
  .number-range-input {
    font-family: var(--font-mono); font-size: 12px;
    padding: 4px 6px; background: var(--bg-input);
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    color: var(--text-primary); width: 80px;
  }
  .number-range-dash { color: var(--text-muted); font-size: 12px; }
  .number-range-label { font-size: 10px; color: var(--text-muted); }
</style>
