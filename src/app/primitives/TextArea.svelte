<script lang="ts">
let {
  value = $bindable(""),
  placeholder,
  rows,
  variant = "default",
  resize = "vertical",
  autosize = false,
  oninput,
}: {
  value?: string;
  placeholder?: string;
  rows?: number;
  variant?: "default" | "compact";
  resize?: "vertical" | "none" | "both";
  autosize?: boolean;
  oninput?: (e: Event) => void;
} = $props();

let el: HTMLTextAreaElement;

function resizeToFit() {
  if (!autosize || !el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

// Resize when value changes (e.g. on mount or external update)
$effect(() => {
  if (autosize && el) {
    // Access value to create reactive dependency
    const _ = value;
    // Defer to next microtask so the DOM has updated
    queueMicrotask(resizeToFit);
  }
});

function handleInput(e: Event) {
  resizeToFit();
  oninput?.(e);
}
</script>

<textarea
  bind:this={el}
  class="textarea textarea-{variant}"
  class:textarea-autosize={autosize}
  bind:value
  {placeholder}
  {rows}
  style:resize={autosize ? "none" : resize}
  oninput={handleInput}
></textarea>

<style>
  .textarea {
    width: 100%;
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 10px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    line-height: 1.6;
  }
  .textarea::placeholder { color: var(--text-muted); }
  .textarea-default { min-height: 200px; }
  .textarea-compact {
    min-height: 32px;
    font-size: 11px;
    padding: 6px 8px;
  }
  .textarea-autosize {
    overflow: hidden;
  }
</style>
