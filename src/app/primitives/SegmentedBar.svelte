<script lang="ts">
interface Segment {
  label: string;
  flex: number;
  variant: string;
  flagged?: boolean;
  starved?: boolean;
}

let {
  segments,
  height = 26,
  legendLayout = "horizontal",
}: {
  segments: Segment[];
  height?: number;
  legendLayout?: "horizontal" | "vertical";
} = $props();

const showPills = $derived(height >= 20);
</script>

<div class="segmented-bar" style="height: {height}px">
  {#each segments as seg, i}
    <div
      class="segment segment-{seg.variant}"
      class:segment-flagged={seg.flagged}
      class:segment-starved={seg.starved}
      style="flex: {seg.flex}"
    >{#if showPills}{#if seg.variant !== "empty"}<span class="segment-pill pill-{seg.variant}" class:pill-flagged={seg.flagged} class:pill-starved={seg.starved}>{seg.label}</span>{:else}{seg.label}{/if}{/if}</div>
  {/each}
</div>
{#if !showPills}
  <div class="legend legend-{legendLayout}">
    {#each segments as seg}
      <span class="legend-item">
        <span class="legend-swatch swatch-{seg.variant}" class:swatch-flagged={seg.flagged} class:swatch-starved={seg.starved}></span>
        {seg.label}
      </span>
    {/each}
  </div>
{/if}

<style>
  .segmented-bar { display: flex; gap: 2px; border-radius: var(--radius-sm); overflow: hidden; margin: 4px 0 8px; }
  .segment { display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 600; color: white; text-transform: uppercase; letter-spacing: 0.05em; min-width: 40px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .segment-r1 { background: var(--ring1-color); }
  .segment-r2 { background: var(--ring2-color); }
  .segment-r3 { background: var(--ring3-color); }
  .segment-empty { background: var(--bg-secondary); color: var(--text-muted); border: 1px dashed var(--border); font-style: italic; }
  .segment-actionable { background: var(--success); }
  .segment-noise { background: var(--warning); }
  .segment-flagged { background: repeating-linear-gradient(45deg, var(--error), var(--error) 3px, var(--stripe-gap-flagged) 3px, var(--stripe-gap-flagged) 6px); outline: 2px solid var(--error); outline-offset: -1px; font-weight: 700; }
  .segment-starved { background: repeating-linear-gradient(45deg, var(--warning), var(--warning) 3px, var(--stripe-gap-starved) 3px, var(--stripe-gap-starved) 6px); outline: 2px solid var(--warning); outline-offset: -1px; font-weight: 700; }

  /* Pill — tinted per variant */
  .segment-pill { color: white; padding: 1px 6px; border-radius: 3px; font-size: 8px; line-height: 13px; white-space: nowrap; max-width: calc(100% - 4px); overflow: hidden; text-overflow: ellipsis; }
  .pill-r1 { background: #2a4065; }
  .pill-r2 { background: #4a3065; }
  .pill-r3 { background: #1a5045; }
  .pill-actionable { background: #186038; }
  .pill-noise { background: #6a3a10; }
  .pill-flagged { background: #6a1a1a; }
  .pill-starved { background: #5a3510; }

  /* Legend for thin bars */
  .legend { display: flex; margin-top: 3px; }
  .legend-horizontal { flex-direction: row; gap: 10px; }
  .legend-vertical { flex-direction: column; gap: 2px; }
  .legend-item { display: flex; align-items: center; gap: 4px; font-size: 9px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600; }
  .legend-swatch { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
  .swatch-r1 { background: var(--ring1-color); }
  .swatch-r2 { background: var(--ring2-color); }
  .swatch-r3 { background: var(--ring3-color); }
  .swatch-actionable { background: var(--success); }
  .swatch-noise { background: var(--warning); }
  .swatch-empty { background: var(--bg-secondary); border: 1px dashed var(--border); }
  .swatch-flagged { background: var(--error); }
  .swatch-starved { background: var(--warning); }
</style>
