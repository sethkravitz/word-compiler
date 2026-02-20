<script lang="ts">
import type { Snippet } from "svelte";

let {
  label,
  hint,
  error,
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: Snippet;
} = $props();
</script>

<div class="form-field" class:form-field-error={!!error}>
  <label class="form-field-label">
    {label}{#if required}<span class="form-field-required">*</span>{/if}
  </label>
  {#if hint}
    <span class="form-field-hint">{hint}</span>
  {/if}
  <div class="form-field-input">{@render children?.()}</div>
  {#if error}
    <span class="form-field-error-msg">{error}</span>
  {/if}
</div>

<style>
  .form-field { display: flex; flex-direction: column; gap: 3px; }
  .form-field-label {
    font-size: 11px; color: var(--text-secondary);
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .form-field-required { color: var(--error); margin-left: 2px; }
  .form-field-hint { font-size: 10px; color: var(--text-muted); }
  .form-field-input { display: flex; flex-direction: column; }
  .form-field-error-msg { font-size: 10px; color: var(--error); }
</style>
