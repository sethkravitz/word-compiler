<script lang="ts">
import type { NarrativeIR } from "../../types/index.js";
import { Badge, Pane } from "../primitives/index.js";

let {
  sceneIRs,
  sceneTitles,
}: {
  sceneIRs: Record<string, NarrativeIR>;
  sceneTitles: Record<string, string>;
} = $props();

interface SetupEntry {
  text: string;
  plantedInScene: string;
  paidOffInScene: string | null;
}

let entries = $derived.by((): SetupEntry[] => {
  const setups: SetupEntry[] = [];
  const payoffSet = new Map<string, string>();

  // Collect all payoffs first so we can match
  for (const [sceneId, ir] of Object.entries(sceneIRs)) {
    if (!ir.verified) continue;
    for (const payoff of ir.payoffsExecuted) {
      payoffSet.set(payoff.toLowerCase(), sceneId);
    }
  }

  // Collect all setups and match against payoffs
  for (const [sceneId, ir] of Object.entries(sceneIRs)) {
    if (!ir.verified) continue;
    for (const setup of ir.setupsPlanted) {
      const paidOffIn = payoffSet.get(setup.toLowerCase()) ?? null;
      setups.push({ text: setup, plantedInScene: sceneId, paidOffInScene: paidOffIn });
    }
  }

  return setups;
});

let resolved = $derived(entries.filter((e) => e.paidOffInScene !== null));
let dangling = $derived(entries.filter((e) => e.paidOffInScene === null));

function title(sceneId: string): string {
  return sceneTitles[sceneId] ?? sceneId;
}
</script>

<Pane title="Setups & Payoffs">
  {#if entries.length === 0}
    <div class="empty-state">No verified IRs with setups found. Extract and verify scene IRs to populate.</div>
  {:else}
    {#if dangling.length > 0}
      <div class="section">
        <div class="section-header">
          <Badge variant="warning">{dangling.length}</Badge>
          <span>Active Setups (unresolved)</span>
        </div>
        {#each dangling as entry}
          <div class="entry dangling">
            <span class="entry-text">{entry.text}</span>
            <span class="entry-meta">planted in {title(entry.plantedInScene)}</span>
          </div>
        {/each}
      </div>
    {/if}

    {#if resolved.length > 0}
      <div class="section">
        <div class="section-header">
          <Badge variant="accepted">{resolved.length}</Badge>
          <span>Resolved Payoffs</span>
        </div>
        {#each resolved as entry}
          <div class="entry resolved">
            <span class="entry-text">{entry.text}</span>
            <span class="entry-meta">
              {title(entry.plantedInScene)} &rarr; {title(entry.paidOffInScene!)}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</Pane>

<style>
  .empty-state { color: var(--text-muted); padding: 20px; text-align: center; font-size: 12px; }
  .section { margin-bottom: 12px; }
  .section-header {
    display: flex; align-items: center; gap: 6px; padding: 4px 8px;
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--text-secondary); border-bottom: 1px solid var(--border);
  }
  .entry {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 6px 8px; font-size: 12px; border-bottom: 1px solid var(--border-dim, var(--border));
  }
  .entry-text { flex: 1; }
  .entry-meta { font-size: 10px; color: var(--text-muted); margin-left: 8px; white-space: nowrap; }
  .dangling .entry-text { color: var(--warning, #e8a838); }
  .resolved .entry-text { color: var(--text-primary); }
</style>
