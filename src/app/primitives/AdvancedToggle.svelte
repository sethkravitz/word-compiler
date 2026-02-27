<script lang="ts">
let {
  storageKey,
  label = "Advanced",
  children,
}: {
  storageKey: string;
  label?: string;
  children: import("svelte").Snippet;
} = $props();

const fullKey = `wc-advanced-${storageKey}`;
let open = $state(false);

// Restore from localStorage on init
if (typeof localStorage !== "undefined") {
  open = localStorage.getItem(fullKey) === "true";
}

function toggle() {
  open = !open;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(fullKey, String(open));
  }
}
</script>

<div class="advanced-toggle">
  <button class="advanced-trigger" onclick={toggle} type="button">
    <span class="advanced-chevron" class:advanced-chevron-open={open}>&#9654;</span>
    <span class="advanced-label">{label}</span>
  </button>
  {#if open}
    <div class="advanced-content">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .advanced-toggle {
    margin-top: 8px;
  }

  .advanced-trigger {
    display: flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 4px 0;
  }

  .advanced-trigger:hover {
    color: var(--text-secondary);
  }

  .advanced-chevron {
    font-size: 8px;
    transition: transform 0.15s;
  }

  .advanced-chevron-open {
    transform: rotate(90deg);
  }

  .advanced-content {
    margin-top: 4px;
    padding-left: 12px;
    border-left: 1px solid var(--border);
  }
</style>
