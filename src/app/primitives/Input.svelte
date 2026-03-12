<script lang="ts">
import { focusOnMount } from "./actions.js";

let {
  type = "text",
  value = $bindable(""),
  placeholder,
  autofocus = false,
  oninput,
  onkeydown,
  onblur,
}: {
  type?: string;
  value?: string;
  placeholder?: string;
  autofocus?: boolean;
  oninput?: (e: Event) => void;
  onkeydown?: (e: KeyboardEvent) => void;
  onblur?: (e: FocusEvent) => void;
} = $props();
</script>

<input class="input" {type} bind:value {placeholder} {oninput} {onkeydown} {onblur} use:focusOnMount={autofocus} />

<style>
  .input {
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 6px 8px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
  }
  .input::placeholder { color: var(--text-muted); }
</style>
