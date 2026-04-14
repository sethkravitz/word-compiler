<script lang="ts">
import { onMount, tick } from "svelte";
import { fade } from "svelte/transition";
import { apiListProjects, apiUpdateProject } from "../api/client.js";
import { countTokens } from "../tokens/index.js";
import { getCanonicalText, type Project } from "../types/index.js";
import EssayComposer from "./components/composer/EssayComposer.svelte";
import TemplatePicker from "./components/composer/TemplatePicker.svelte";
import GlossaryPanel from "./components/GlossaryPanel.svelte";
import ProjectList from "./components/ProjectList.svelte";
import StageCTA from "./components/StageCTA.svelte";
import AuditStage from "./components/stages/AuditStage.svelte";
import BootstrapStage from "./components/stages/BootstrapStage.svelte";
import CompleteStage from "./components/stages/CompleteStage.svelte";
import DraftStage from "./components/stages/DraftStage.svelte";
import EditStage from "./components/stages/EditStage.svelte";
import ExportStage from "./components/stages/ExportStage.svelte";
import PlanStage from "./components/stages/PlanStage.svelte";
import VoiceProfilePanel from "./components/VoiceProfilePanel.svelte";
import WorkflowRail from "./components/WorkflowRail.svelte";
import { Button, ErrorBanner, Input, Select } from "./primitives/index.js";
import {
  createApiActions,
  createCommands,
  createGenerationActions,
  initializeApp,
  loadProject,
  setupCompilerEffect,
  store,
} from "./store/index.svelte.js";
import { theme } from "./store/theme.svelte.js";
import { STAGES, WorkflowStore } from "./store/workflow.svelte.js";

// Set up compiler auto-recompile effect
setupCompilerEffect(store);

// Create persisted action handlers
const actions = createApiActions(store);
const commands = createCommands(store, actions);

// Create generation action handlers
const { generateChunk, runAuditManual, runDeepAudit, extractSceneIR, runAutopilot, requestRefinement } =
  createGenerationActions(store, commands);

// Workflow store
const workflow = new WorkflowStore(store);

// ─── Keyboard shortcuts ─────────────────────────
function handleKeydown(e: KeyboardEvent) {
  if (!appReady) return;
  const isCtrl = e.ctrlKey || e.metaKey;

  // Essay mode has its own shortcut set — Cmd/Ctrl+G generates the focused
  // section. Fiction Ctrl+1-7 shortcuts are not reachable here because the
  // WorkflowRail is not rendered in essay mode.
  if (store.bible?.mode === "essay") {
    if (isCtrl && e.key === "g") {
      e.preventDefault();
      composerRef?.generateFocusedSection();
    }
    return;
  }

  if (!isCtrl) return;

  // Ctrl+1-6: stage navigation
  const digit = Number.parseInt(e.key, 10);
  if (digit >= 1 && digit <= 7) {
    const stage = STAGES[digit - 1];
    if (stage && workflow.getStageStatus(stage.id) !== "locked") {
      e.preventDefault();
      workflow.goToStage(stage.id);
    }
    return;
  }

  // Ctrl+Enter: advance to next stage
  if (e.key === "Enter" && workflow.nextStageCTA) {
    e.preventDefault();
    workflow.goToStage(workflow.nextStageCTA.id);
  }
}

// ─── Startup ────────────────────────────────────
let appReady = $state(false);
let startupStatus = $state<string>("loading");
let currentView = $state<"project-list" | "project">("project");
let projectList = $state<import("../types/index.js").Project[]>([]);

onMount(async () => {
  const result = await initializeApp(store);
  startupStatus = result;
  if (result === "loaded") {
    appReady = true;
    currentView = "project";
  } else if (result === "multiple-projects") {
    try {
      projectList = await apiListProjects();
    } catch {
      // Fall through to show the placeholder
    }
  }
});

async function handleSelectProject(projectId: string) {
  store.resetForProjectSwitch();
  const result = await loadProject(store, projectId);
  if (result === "loaded") {
    appReady = true;
    currentView = "project";
  }
}

function handleOpenTemplatePicker() {
  templatePickerOpen = true;
}

// The createEssayProject action has already populated the store — project,
// bible, chapter arc, scene plans. All that's left is to flip the app into
// the loaded state and close the picker. The `project` parameter is accepted
// to match the TemplatePicker contract even though we read everything from
// the store; rename to `_project` satisfies Biome's unused-parameter rule.
function handleEssayProjectCreated(_project: Project) {
  templatePickerOpen = false;
  newProjectTitle = "";
  appReady = true;
  currentView = "project";
  startupStatus = "loaded";
}

async function handleRenameProject() {
  const title = editTitleValue.trim();
  if (!title || !store.project || title === store.project.title) {
    editingTitle = false;
    return;
  }
  try {
    const updated = await apiUpdateProject(store.project.id, { title });
    store.setProject(updated);
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Failed to rename project");
  }
  editingTitle = false;
}

function handleBackToProjects() {
  store.resetForProjectSwitch();
  appReady = false;
  currentView = "project-list";
  startupStatus = "multiple-projects";
  apiListProjects()
    .then((list) => {
      projectList = list;
    })
    .catch(() => {});
}

// ─── Local UI state ─────────────────────────────
let newProjectTitle = $state("");
let editingTitle = $state(false);
let editTitleValue = $state("");
let boundaryErrorMsg = "";
let composerBoundaryErrorMsg = $state("");
let templatePickerOpen = $state(false);
// Binding target for EssayComposer so the keyboard handler can drive a
// focused-section generate. The composer exposes `generateFocusedSection`
// as an exported instance method (see EssayComposer.svelte).
let composerRef = $state<{ generateFocusedSection: () => void } | null>(null);

// ─── Essay composer bridge ───────────────────────
//
// The composer treats `onGenerate(sceneId) => Promise<void>` as an opaque
// awaited promise. Fiction's `generateChunk(pinnedSceneId)` handles the
// active-scene bookkeeping internally, but the compiler effect listens for
// `activeScenePlan` changes to recompute `compiledPayload`. We mirror the
// DraftStage flow: set active scene, let the compiler effect settle via a
// `tick()` microtask, then await the generation. Returning the promise lets
// the composer drive its own state machine on success/failure.
async function handleComposerGenerate(sceneId: string): Promise<void> {
  const idx = store.scenes.findIndex((s) => s.plan.id === sceneId);
  if (idx < 0) return;
  store.setActiveScene(idx);
  await tick();
  await generateChunk(sceneId);
}

// ─── Prose word count ───────────────────────────
let totalWordCount = $derived(
  store.scenes.reduce((sum, scene) => {
    const chunks = store.sceneChunks[scene.plan.id] ?? [];
    return sum + chunks.reduce((s, c) => s + getCanonicalText(c).split(/\s+/).filter(Boolean).length, 0);
  }, 0),
);

// ─── State Export ────────────────────────────────
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}… [${text.length} chars total]`;
}

function exportState() {
  const plan = store.activeScenePlan;
  const log = store.compilationLog;
  const chunks = store.activeSceneChunks;
  const payload = store.compiledPayload;

  const snapshot = {
    _format: "word-compiler-state-v1",
    _exported: new Date().toISOString(),
    scene: plan
      ? {
          title: plan.title,
          chunkCount: plan.chunkCount,
          chunkDescriptions: plan.chunkDescriptions,
          status: store.activeScene?.status,
        }
      : null,
    config: {
      model: store.compilationConfig.defaultModel,
      contextWindow: store.compilationConfig.modelContextWindow,
      reservedForOutput: store.compilationConfig.reservedForOutput,
      temperature: store.compilationConfig.defaultTemperature,
      bridgeVerbatimTokens: store.compilationConfig.bridgeVerbatimTokens,
    },
    compilation: log
      ? {
          ring1Tokens: log.ring1Tokens,
          ring2Tokens: log.ring2Tokens,
          ring3Tokens: log.ring3Tokens,
          totalTokens: log.totalTokens,
          availableBudget: log.availableBudget,
          r1Sections: log.ring1Contents,
          r2Sections: log.ring2Contents,
          r3Sections: log.ring3Contents,
        }
      : null,
    payload: payload
      ? {
          systemMessage: truncate(payload.systemMessage, 500),
          userMessage: truncate(payload.userMessage, 2000),
          systemMessageTokens: countTokens(payload.systemMessage),
          userMessageTokens: countTokens(payload.userMessage),
        }
      : null,
    chunks: chunks.map((c, i) => ({
      index: i + 1,
      status: c.status,
      model: c.model,
      temperature: c.temperature,
      textPreview: truncate(getCanonicalText(c), 200),
      wordCount: getCanonicalText(c).split(/\s+/).length,
      hasNotes: !!c.humanNotes,
      notes: c.humanNotes || undefined,
    })),
    lint: store.lintResult
      ? {
          errors: store.lintResult.issues.filter((i) => i.severity === "error").map((i) => `${i.code}: ${i.message}`),
          warnings: store.lintResult.issues
            .filter((i) => i.severity === "warning")
            .map((i) => `${i.code}: ${i.message}`),
          infos: store.lintResult.issues.filter((i) => i.severity === "info").map((i) => `${i.code}: ${i.message}`),
        }
      : null,
    audit: {
      total: store.auditFlags.length,
      pending: store.auditFlags.filter((f) => !f.resolved).length,
      flags: store.auditFlags
        .filter((f) => !f.resolved)
        .map((f) => ({
          severity: f.severity,
          category: f.category,
          message: f.message,
        })),
    },
    ir: store.activeSceneIR
      ? {
          verified: store.activeSceneIR.verified,
          events: store.activeSceneIR.events.length,
          factsIntroduced: store.activeSceneIR.factsIntroduced.length,
          characterDeltas: store.activeSceneIR.characterDeltas.length,
          setupsPlanted: store.activeSceneIR.setupsPlanted.length,
          payoffsExecuted: store.activeSceneIR.payoffsExecuted.length,
          unresolvedTensions: store.activeSceneIR.unresolvedTensions,
        }
      : null,
  };

  const json = JSON.stringify(snapshot, null, 2);
  navigator.clipboard
    .writeText(json)
    .then(() => {
      // Clear any stale error on success. A proper toast/notification
      // system would be better here, but this at least avoids leaving
      // an old error banner visible after a successful action.
      store.setError(null);
    })
    .catch(() => {
      store.saveFile(snapshot, `wc-state-${Date.now()}.json`);
    });
}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if !appReady}
  <div class="app" class:loading-screen={startupStatus !== "multiple-projects"}>
    {#if startupStatus !== "multiple-projects"}
      <span class="app-title">Word Compiler</span>
    {/if}
    {#if startupStatus === "loading"}
      <p>Loading project...</p>
    {:else if startupStatus === "no-projects"}
      <p>Welcome to Word Compiler. Create your first essay to get started.</p>
      <div class="new-project-form">
        <Button onclick={handleOpenTemplatePicker}>Create Project</Button>
      </div>
    {:else if startupStatus === "error"}
      <ErrorBanner message={store.error ?? "Failed to load"} onDismiss={() => store.setError(null)} />
    {:else if startupStatus === "multiple-projects"}
      <ProjectList
        projects={projectList}
        newTitle={newProjectTitle}
        onSelectProject={handleSelectProject}
        onCreateProject={handleOpenTemplatePicker}
        onTitleChange={(t) => { newProjectTitle = t; }}
      />
    {/if}
    {#if startupStatus === "no-projects" || startupStatus === "multiple-projects"}
      <VoiceProfilePanel />
    {/if}
  </div>
{:else}
<div class="app">
  <div class="app-header">
    <span class="app-title">Word Compiler</span>
    {#if editingTitle}
      <Input
        autofocus
        value={editTitleValue}
        oninput={(e) => { editTitleValue = (e.target as HTMLInputElement).value; }}
        onkeydown={(e) => { if (e.key === "Enter") handleRenameProject(); if (e.key === "Escape") editingTitle = false; }}
        onblur={handleRenameProject}
      />
    {:else}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span
        class="project-title"
        role="button"
        tabindex="0"
        title="Click to rename"
        onclick={() => { editTitleValue = store.project?.title ?? ""; editingTitle = true; }}
        onkeydown={(e) => { if (e.key === "Enter") { editTitleValue = store.project?.title ?? ""; editingTitle = true; } }}
      >{store.project?.title ?? ""}</span>
    {/if}
    <div class="header-right">
      <Button size="sm" onclick={handleBackToProjects}>Projects</Button>
      {#if workflow.activeStage === "draft" || store.bible?.mode === "essay"}
        <label class="model-selector">
          Model:
          <Select
            value={store.compilationConfig.defaultModel}
            onchange={(e) => store.selectModel((e.target as HTMLSelectElement).value)}
          >
            {#if store.availableModels.length > 0}
              {#each store.availableModels as m (m.id)}
                <option value={m.id}>{m.label} ({(m.contextWindow / 1000).toFixed(0)}k ctx, {(m.maxOutput / 1000).toFixed(0)}k out)</option>
              {/each}
            {:else}
              <option value={store.compilationConfig.defaultModel}>{store.compilationConfig.defaultModel}</option>
            {/if}
          </Select>
        </label>
      {/if}
      {#if totalWordCount > 0}
        <span class="app-status">{totalWordCount.toLocaleString()}w</span>
      {/if}
      <Button size="sm" onclick={exportState} title="Copy state snapshot to clipboard">Export</Button>
      <Button size="sm" onclick={() => theme.toggle()} title="Toggle dark/light theme">
        {theme.current === "dark" ? "Light" : "Dark"}
      </Button>
    </div>
  </div>

  {#if store.bible?.mode !== "essay"}
    <WorkflowRail {workflow} />
  {/if}

  {#if store.error}
    <div class="error-margin">
      <ErrorBanner message={store.error} onDismiss={() => store.setError(null)} />
    </div>
  {/if}

  {#if store.bible?.mode !== "essay"}
    <StageCTA nextStage={workflow.nextStageCTA} onclick={(stage) => workflow.goToStage(stage.id)} />
  {/if}

  <div class="stage-workspace">
    {#if store.bible?.mode === "essay"}
      <!-- Essay mode: single-page composer. No stage switching, so no {#key}.
           A dedicated svelte:boundary with its own error state keeps a
           composer crash from dragging fiction-mode state down with it. -->
      <svelte:boundary onerror={(err) => { console.error("[boundary] Composer crash:", err); composerBoundaryErrorMsg = `Something went wrong: ${err instanceof Error ? err.message : "Unknown error"}. Try again or refresh.`; store.setError(composerBoundaryErrorMsg); }}>
        <div class="stage-content">
          <EssayComposer
            bind:this={composerRef}
            {store}
            {commands}
            onGenerate={handleComposerGenerate}
          />
        </div>
        {#snippet failed(err, reset)}
          <div class="stage-crash">
            <h3>Something went wrong</h3>
            <p>{err instanceof Error ? err.message : "An unexpected error occurred."}</p>
            <Button onclick={() => { if (store.error === composerBoundaryErrorMsg) store.setError(null); reset(); }}>Try Again</Button>
          </div>
        {/snippet}
      </svelte:boundary>
    {:else}
      {#key workflow.activeStage}
        <svelte:boundary onerror={(err) => { console.error("[boundary] Stage crash:", err); boundaryErrorMsg = `Something went wrong: ${err instanceof Error ? err.message : "Unknown error"}. Try switching stages or refreshing.`; store.setError(boundaryErrorMsg); }}>
          <div class="stage-content" in:fade={{ duration: 150, delay: 50 }} out:fade={{ duration: 100 }}>
            {#if workflow.activeStage === "bootstrap"}
              <BootstrapStage {store} {commands} />
            {:else if workflow.activeStage === "draft"}
              <DraftStage
                {store}
                {commands}
                onGenerate={() => generateChunk()}
                onRunAudit={() => runAuditManual()}
                onRunDeepAudit={() => runDeepAudit()}
                onAutopilot={() => runAutopilot()}
                onExtractIR={(sceneId) => extractSceneIR(sceneId)}
              />
            {:else if workflow.activeStage === "plan"}
              <PlanStage {store} {commands} />
            {:else if workflow.activeStage === "audit"}
              <AuditStage
                {store}
                {commands}
                onRunAudit={() => runAuditManual()}
                onRunDeepAudit={() => runDeepAudit()}
              />
            {:else if workflow.activeStage === "edit"}
              <EditStage
                {store}
                {commands}
                onRequestRefinement={requestRefinement}
              />
            {:else if workflow.activeStage === "complete"}
              <CompleteStage
                {store}
                {commands}
                onExtractIR={(sceneId) => extractSceneIR(sceneId)}
              />
            {:else if workflow.activeStage === "export"}
              <ExportStage {store} />
            {/if}
          </div>
          {#snippet failed(err, reset)}
            <div class="stage-crash">
              <h3>Something went wrong</h3>
              <p>{err instanceof Error ? err.message : "An unexpected error occurred."}</p>
              <Button onclick={() => { if (store.error === boundaryErrorMsg) store.setError(null); reset(); }}>Try Again</Button>
            </div>
          {/snippet}
        </svelte:boundary>
      {/key}
    {/if}
  </div>

  {#if store.bible?.mode !== "essay"}
    <GlossaryPanel />
  {/if}
</div>
{/if}

<!-- TemplatePicker lives outside the appReady gate so a first-time user on
     the no-projects screen can open it. It's always in the DOM but only
     visible when `templatePickerOpen` is true. -->
<TemplatePicker
  open={templatePickerOpen}
  {actions}
  onProjectCreated={handleEssayProjectCreated}
  onCancel={() => { templatePickerOpen = false; }}
/>

<style>
  .header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .model-selector {
    display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-secondary);
  }
  .stage-content { display: flex; flex-direction: column; flex: 1; min-height: 0; }
  .error-margin { margin: 0 8px; }
  .loading-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 200px; }
  .stage-crash { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 48px 24px; text-align: center; color: var(--text-secondary); }
  .new-project-form { display: flex; align-items: center; gap: 8px; }
  .project-title {
    font-size: 13px; font-weight: 600; color: var(--text-secondary); cursor: pointer;
    padding: 2px 6px; border-radius: var(--radius-sm); border: 1px solid transparent;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px;
  }
  @media (hover: hover) {
    .project-title:hover { border-color: var(--border); color: var(--text-primary); }
  }
  .project-title:active { border-color: var(--border); color: var(--text-primary); }
</style>
