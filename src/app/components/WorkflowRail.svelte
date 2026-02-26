<script lang="ts">
import Stepper from "../primitives/Stepper.svelte";
import { STAGES, type WorkflowStore } from "../store/workflow.svelte.js";

let {
  workflow,
}: {
  workflow: WorkflowStore;
} = $props();

const steps = STAGES.map((s) => ({ id: s.id, label: s.label }));

function handleStepClick(id: string) {
  const stage = STAGES.find((s) => s.id === id);
  if (!stage) return;
  const status = workflow.getStageStatus(stage.id);
  if (status === "locked") return;
  workflow.goToStage(stage.id);
}
</script>

<div class="workflow-rail">
  <Stepper
    {steps}
    currentStep={workflow.activeStage}
    completedSteps={workflow.completedStages}
    onStepClick={handleStepClick}
  />
</div>

<style>
  .workflow-rail {
    padding: 4px 16px;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
</style>
