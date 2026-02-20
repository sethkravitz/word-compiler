<script lang="ts" generics="T">
import type { Snippet } from "svelte";
import Button from "./Button.svelte";

let {
  items,
  renderItem,
  onAdd,
  onRemove,
  addLabel = "Add",
  emptyMessage = "No items yet.",
}: {
  items: T[];
  renderItem: Snippet<[item: T, index: number]>;
  onAdd: () => void;
  onRemove: (index: number) => void;
  addLabel?: string;
  emptyMessage?: string;
} = $props();
</script>

<div class="card-list">
  {#if items.length === 0}
    <div class="card-list-empty">{emptyMessage}</div>
  {/if}
  {#each items as item, i (i)}
    <div class="card-list-item">
      <div class="card-list-item-content">
        {@render renderItem(item, i)}
      </div>
      <button type="button" class="card-list-remove" onclick={() => onRemove(i)} aria-label="Remove item">x</button>
    </div>
  {/each}
  <Button size="sm" onclick={onAdd}>{addLabel}</Button>
</div>

<style>
  .card-list { display: flex; flex-direction: column; gap: 6px; }
  .card-list-empty {
    font-size: 11px; color: var(--text-muted);
    padding: 8px; text-align: center;
  }
  .card-list-item {
    display: flex; gap: 8px; padding: 8px;
    border: 1px solid var(--border); border-radius: var(--radius-md);
    background: var(--bg-card);
  }
  .card-list-item-content { flex: 1; min-width: 0; }
  .card-list-remove {
    background: none; border: none; color: var(--text-muted);
    cursor: pointer; font-family: var(--font-mono); font-size: 12px;
    padding: 0 4px; align-self: flex-start;
  }
  .card-list-remove:hover { color: var(--error); }
</style>
