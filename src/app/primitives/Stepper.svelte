<script lang="ts">
let {
  steps,
  currentStep,
  completedSteps = [],
  onStepClick,
}: {
  steps: { id: string; label: string }[];
  currentStep: string;
  completedSteps?: string[];
  onStepClick?: (id: string) => void;
} = $props();

function getStepState(stepId: string, _index: number): "completed" | "current" | "future" {
  if (completedSteps.includes(stepId)) return "completed";
  if (stepId === currentStep) return "current";
  return "future";
}
</script>

<div class="stepper" role="navigation" aria-label="Progress">
  {#each steps as step, i (step.id)}
    {@const state = getStepState(step.id, i)}
    <button
      type="button"
      class="stepper-step stepper-step-{state}"
      onclick={() => onStepClick?.(step.id)}
      disabled={!onStepClick}
      aria-current={state === "current" ? "step" : undefined}
    >
      <span class="stepper-indicator">
        {#if state === "completed"}
          <span class="stepper-check" aria-label="Completed">&#10003;</span>
        {:else}
          <span class="stepper-number">{i + 1}</span>
        {/if}
      </span>
      <span class="stepper-label">{step.label}</span>
    </button>
    {#if i < steps.length - 1}
      <span class="stepper-connector" class:stepper-connector-done={state === "completed"}></span>
    {/if}
  {/each}
</div>

<style>
  .stepper {
    display: flex; align-items: center; gap: 0; padding: 8px 0;
  }
  .stepper-step {
    display: flex; align-items: center; gap: 6px;
    background: none; border: none; cursor: pointer;
    padding: 4px 8px; border-radius: var(--radius-sm);
    transition: all 0.15s; font-family: var(--font-mono);
  }
  .stepper-step:disabled { cursor: default; }
  .stepper-step:not(:disabled):hover { background: var(--bg-secondary); }
  .stepper-indicator {
    width: 20px; height: 20px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; border: 1px solid var(--border);
    transition: all 0.15s;
  }
  .stepper-step-completed .stepper-indicator {
    background: var(--accent); border-color: var(--accent); color: var(--bg-primary);
  }
  .stepper-step-current .stepper-indicator {
    border-color: var(--accent); color: var(--accent);
  }
  .stepper-step-future .stepper-indicator {
    color: var(--text-muted);
  }
  .stepper-check { font-size: 11px; }
  .stepper-number { font-size: 10px; }
  .stepper-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
  }
  .stepper-step-current .stepper-label { color: var(--accent); }
  .stepper-step-future .stepper-label { color: var(--text-muted); }
  .stepper-step-completed .stepper-label { color: var(--text-secondary); }
  .stepper-connector {
    flex: 1; height: 1px; background: var(--border);
    min-width: 16px;
  }
  .stepper-connector-done { background: var(--accent); }
</style>
