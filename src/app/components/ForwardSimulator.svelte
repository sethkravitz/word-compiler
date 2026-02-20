<script lang="ts">
import type { NarrativeIR, ScenePlan } from "../../types/index.js";
import { CollapsibleSection, Pane } from "../primitives/index.js";

interface SceneNode {
  plan: ScenePlan;
  ir: NarrativeIR | null;
  sceneOrder: number;
}

let {
  scenes,
  activeSceneIndex,
  onSelectScene,
}: {
  scenes: SceneNode[];
  activeSceneIndex: number;
  onSelectScene: (index: number) => void;
} = $props();

interface ReaderStateDiff {
  newKnowledge: string[];
  newTensions: string[];
  resolvedTensions: string[];
}

function computeDiff(prevIR: NarrativeIR | null, currentIR: NarrativeIR): ReaderStateDiff {
  const prevTensions = new Set(prevIR?.unresolvedTensions ?? []);
  const currentTensions = new Set(currentIR.unresolvedTensions);
  return {
    newKnowledge: currentIR.factsRevealedToReader,
    newTensions: currentIR.unresolvedTensions.filter((t) => !prevTensions.has(t)),
    resolvedTensions: [...prevTensions].filter((t) => !currentTensions.has(t)),
  };
}
</script>

<Pane title={scenes.length === 0 ? "Forward Simulator" : "Reader State Trace"}>
  {#snippet headerRight()}
    {#if scenes.length > 0}
      <span class="fwd-note">Only verified IRs contribute to state diff.</span>
    {/if}
  {/snippet}

  {#if scenes.length === 0}
    <div class="fwd-empty">No scenes added yet.</div>
  {:else}
    <div class="fwd-timeline">
      {#each scenes as node, i (node.plan.id)}
        {@const hasIR = node.ir !== null}
        {@const isVerified = node.ir?.verified ?? false}
        {@const diff = hasIR && isVerified ? computeDiff(i > 0 ? (scenes[i - 1]?.ir ?? null) : null, node.ir!) : null}

        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="fwd-node" class:fwd-node-active={i === activeSceneIndex} onclick={() => onSelectScene(i)}>
          <div class="fwd-node-header">
            <span class="fwd-scene-num">Scene {i + 1}</span>
            <span class="fwd-scene-title">{node.plan.title || "(untitled)"}</span>
            {#if !hasIR}
              <span class="fwd-tag fwd-tag-empty">No IR</span>
            {:else if !isVerified}
              <span class="fwd-tag fwd-tag-unverified">Unverified</span>
            {:else}
              <span class="fwd-tag fwd-tag-verified">Verified</span>
            {/if}
          </div>

          {#if diff}
            <div class="fwd-diff-summary">
              {#if diff.newKnowledge.length > 0}
                <span class="fwd-facts">+{diff.newKnowledge.length} facts</span>
              {/if}
              {#if diff.newTensions.length > 0}
                <span class="fwd-tensions">+{diff.newTensions.length} tensions</span>
              {/if}
              {#if diff.resolvedTensions.length > 0}
                <span class="fwd-resolved">{diff.resolvedTensions.length} resolved</span>
              {/if}
            </div>

            {#if diff.newKnowledge.length > 0}
              <CollapsibleSection summary="Reader now knows ({diff.newKnowledge.length})">
                <ul class="fwd-list fwd-list-facts">
                  {#each diff.newKnowledge as fact}
                    <li>{fact}</li>
                  {/each}
                </ul>
              </CollapsibleSection>
            {/if}

            {#if diff.newTensions.length > 0}
              <CollapsibleSection summary="New tensions ({diff.newTensions.length})">
                <ul class="fwd-list fwd-list-tensions">
                  {#each diff.newTensions as tension}
                    <li>{tension}</li>
                  {/each}
                </ul>
              </CollapsibleSection>
            {/if}

            {#if diff.resolvedTensions.length > 0}
              <CollapsibleSection summary="Resolved ({diff.resolvedTensions.length})">
                <ul class="fwd-list fwd-list-resolved">
                  {#each diff.resolvedTensions as tension}
                    <li>{tension}</li>
                  {/each}
                </ul>
              </CollapsibleSection>
            {/if}
          {/if}
        </div>

        {#if i < scenes.length - 1}
          <div class="fwd-connector">↓</div>
        {/if}
      {/each}
    </div>
  {/if}
</Pane>

<style>
  .fwd-note { font-size: 0.8em; opacity: 0.5; }
  .fwd-empty { padding: 24px; opacity: 0.5; text-align: center; }
  .fwd-timeline { display: flex; flex-direction: column; gap: 0; padding: 8px; }
  .fwd-node {
    background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius-md);
    padding: 10px 12px; cursor: pointer;
  }
  .fwd-node:hover { border-color: var(--text-muted); }
  .fwd-node-active { border-color: var(--accent); background: var(--focus-bg); }
  .fwd-node-header { display: flex; align-items: center; gap: 8px; }
  .fwd-scene-num { font-size: 10px; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.05em; }
  .fwd-scene-title { font-size: 12px; font-weight: 600; flex: 1; }
  .fwd-tag { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; padding: 1px 6px; border-radius: var(--radius-sm); }
  .fwd-tag-empty { color: var(--text-muted); border: 1px solid var(--border); }
  .fwd-tag-unverified { color: var(--warning); border: 1px solid var(--warning); }
  .fwd-tag-verified { color: var(--success); border: 1px solid var(--success); }
  .fwd-diff-summary { display: flex; gap: 10px; margin-top: 6px; font-size: 11px; }
  .fwd-facts { color: var(--success); }
  .fwd-tensions { color: var(--warning); }
  .fwd-resolved { color: var(--text-muted); text-decoration: line-through; }
  .fwd-list { margin: 0; padding: 0 0 0 16px; font-size: 11px; line-height: 1.5; }
  .fwd-list-facts { color: var(--success); }
  .fwd-list-tensions { color: var(--warning); }
  .fwd-list-resolved { color: var(--text-muted); }
  .fwd-connector { text-align: center; opacity: 0.2; font-size: 14px; line-height: 1; padding: 2px 0; }
</style>
