<script lang="ts">
let {
  text,
  maxLength = 120,
}: {
  text: string;
  maxLength?: number;
} = $props();

let expanded = $state(false);

let truncated = $derived.by(() => {
  if (text.length <= maxLength) return text;
  // Try to break at first sentence boundary
  const sentenceEnd = text.indexOf(". ");
  if (sentenceEnd > 0 && sentenceEnd < maxLength) {
    return text.slice(0, sentenceEnd + 1);
  }
  // Fall back to max length at word boundary
  const sliced = text.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced}...`;
});

let needsTruncation = $derived(truncated !== text);
</script>

<span class="truncated-prose">
  {#if expanded || !needsTruncation}
    {text}
    {#if expanded}
      <button class="prose-toggle" onclick={() => (expanded = false)}>less</button>
    {/if}
  {:else}
    {truncated}
    <button class="prose-toggle" onclick={() => (expanded = true)}>more</button>
  {/if}
</span>

<style>
  .truncated-prose {
    font-size: 11px;
    color: var(--text-primary);
    line-height: 1.5;
  }
  .prose-toggle {
    background: none;
    border: none;
    color: var(--accent-dim, var(--accent));
    cursor: pointer;
    font-size: 10px;
    padding: 0 2px;
    opacity: 0.7;
  }
  .prose-toggle:hover {
    opacity: 1;
    text-decoration: underline;
  }
</style>
