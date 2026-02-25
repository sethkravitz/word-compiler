<script lang="ts">
import type { ReaderState } from "../../types/index.js";

let {
  state,
}: {
  state: ReaderState;
} = $props();
</script>

<div class="reader-state">
  {#if state.knows.length > 0}
    <div class="rs-row"><span class="rs-key">Knows:</span>
      <div class="atlas-pills">{#each state.knows as k (k)}<span class="atlas-pill">{k}</span>{/each}</div>
    </div>
  {/if}
  {#if state.suspects.length > 0}
    <div class="rs-row"><span class="rs-key">Suspects:</span>
      <div class="atlas-pills">{#each state.suspects as s (s)}<span class="atlas-pill">{s}</span>{/each}</div>
    </div>
  {/if}
  {#if state.wrongAbout.length > 0}
    <div class="rs-row"><span class="rs-key">Wrong about:</span>
      <div class="atlas-pills">{#each state.wrongAbout as w (w)}<span class="atlas-pill atlas-pill-warn">{w}</span>{/each}</div>
    </div>
  {/if}
  {#if state.activeTensions.length > 0}
    <div class="rs-row"><span class="rs-key">Tensions:</span>
      <div class="atlas-pills">{#each state.activeTensions as t (t)}<span class="atlas-pill">{t}</span>{/each}</div>
    </div>
  {/if}
</div>

<style>
  .reader-state { display: flex; flex-direction: column; gap: 4px; padding-left: 8px; }
  .rs-row { display: flex; align-items: flex-start; gap: 6px; }
  .rs-key { font-size: 10px; color: var(--text-muted); min-width: 70px; flex-shrink: 0; padding-top: 2px; }
</style>
