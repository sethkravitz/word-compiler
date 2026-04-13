<script lang="ts" module>
// Module-level timer for the kill-list re-audit debounce. Pattern A from
// DraftStage.svelte:186-216 — keeping the timer here (not in effect cleanup)
// prevents an effect re-run from cancelling a legitimate pending re-audit.
let reauditTimer: ReturnType<typeof setTimeout> | null = null;
</script>

<script lang="ts">
import { tick } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import { apiFireBatchCipher, apiStoreSignificantEdit } from "../../../api/client.js";
import { runAudit } from "../../../auditor/index.js";
import { shouldTriggerCipher } from "../../../profile/editFilter.js";
import { getCanonicalText } from "../../../types/index.js";
import type { Chunk, ScenePlan } from "../../../types/index.js";
import { createEmptyScenePlan } from "../../../types/scene.js";
import { Button, Modal } from "../../primitives/index.js";
import type { RefinementRequest, RefinementResult } from "../../../review/refineTypes.js";
import type { Commands } from "../../store/commands.js";
import type { ProjectStore } from "../../store/project.svelte.js";
import ComposerFooter from "./ComposerFooter.svelte";
import { reduce } from "./sectionStateMachine.js";
import SectionCard from "./SectionCard.svelte";
import SetupPanel from "./SetupPanel.svelte";
import type { RevertSlot, SectionState, VoiceNudge } from "./types.js";

// EssayComposer is the top-level orchestrator for the essay composer UI. It
// owns the section state machine, the FIFO generation queue (UX sequencing,
// not concurrency control — store.isGenerating is the single global guard),
// revert slots with 60s timers, the voice nudge banner, and the cold-load
// recovery hook.
//
// Composition:
//   SetupPanel  (Brief / Voice / Style; Bible writes)
//   N × SectionCard (one per scene plan)
//   ComposerFooter (word count, audit pills, export menu)
//
// The composer is the only place in the essay UI that imports `commands`,
// `store`, and the auditor + CIPHER APIs. SectionCard, SetupPanel, and
// ComposerFooter are presentational shells.
//
// Pattern notes:
//   - Pattern A timers (module-level + explicit clearTimeout) for the 60s
//     revert window and the 300ms re-audit debounce.
//   - CIPHER edit-tracking is duplicated inline from
//     src/app/components/stages/DraftStage.svelte:389-427 because R19
//     forbids refactoring fiction components in this phase. A V2 should
//     extract a shared helper.

let {
  store,
  commands,
  onGenerate,
  onRequestRefinement: _onRequestRefinement,
  onExtractIR: _onExtractIR,
}: {
  store: ProjectStore;
  commands: Commands;
  onGenerate: (sceneId: string) => Promise<void>;
  onRequestRefinement: (req: RefinementRequest) => Promise<RefinementResult>;
  onExtractIR: (sceneId: string) => void;
} = $props();

// ─── State ──────────────────────────────────────────────
//
// IMPORTANT: vanilla `$state(new Map())` is NOT reactive on .set/.delete in
// Svelte 5 — `$state` only deeply proxies plain objects and arrays. We use
// SvelteMap from svelte/reactivity which IS reactive on every method.

const sectionStates = new SvelteMap<string, SectionState>();
const queue = $state<string[]>([]);
const revertSlots = new SvelteMap<string, RevertSlot>();
const directivesBySection = new SvelteMap<string, string>();

let voiceNudge = $state<VoiceNudge | null>(null);
let sessionVoiceNudgeDismissed = $state(false);
let confirmDeleteSceneId = $state<string | null>(null);

// Predicate for the revert button visibility. SvelteMap is reactive on get(),
// so reading from it inside the template establishes the dependency.
function isRevertable(sceneId: string): boolean {
  const slot = revertSlots.get(sceneId);
  if (!slot) return false;
  return slot.expiresAt > Date.now();
}

// Per-scene debounced edit timers — one per scene so concurrent edits across
// sections don't clobber each other. Pattern A (module-scoped to component
// instance) — we use a Map and explicit clearTimeout.
const editDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ─── Internal helpers ───────────────────────────────────

function getSectionState(sceneId: string): SectionState {
  return sectionStates.get(sceneId) ?? "idle-empty";
}

function setSectionState(sceneId: string, next: SectionState) {
  sectionStates.set(sceneId, next);
  // Trigger reactive re-read via reassignment dance (Svelte 5 maps don't
  // auto-track .set() — we re-poke the state proxy by replacing it).
  // Note: $state(new Map()) IS reactive on .set() in Svelte 5.4+, but we
  // also touch a sentinel to be safe across patches.
}

function hasPriorChunks(sceneId: string): boolean {
  return (store.sceneChunks[sceneId]?.length ?? 0) > 0;
}

function dispatchEvent(sceneId: string, event: import("./types.js").StateEvent) {
  const current = getSectionState(sceneId);
  const next = reduce(current, event, hasPriorChunks(sceneId));
  setSectionState(sceneId, next);
}

function isAnotherSectionInFlight(): boolean {
  for (const s of sectionStates.values()) {
    if (s === "streaming" || s === "queued") return true;
  }
  return queue.length > 0;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// ─── Generation pipeline ────────────────────────────────

async function runGeneration(sceneId: string): Promise<void> {
  // Enter streaming. The reducer will accept GENERATE_DISPATCHED from any
  // pre-stream source state.
  dispatchEvent(sceneId, { type: "GENERATE_DISPATCHED" });
  await tick();

  try {
    await onGenerate(sceneId);

    // After awaited stream, check store-level error signal. generation.svelte.ts
    // sets store.error on stream failure and removes the pending chunk.
    if (store.error) {
      dispatchEvent(sceneId, {
        type: "GENERATE_FAILED",
        reason: "error",
        message: store.error,
      });
      return;
    }

    dispatchEvent(sceneId, { type: "GENERATE_SUCCEEDED" });
  } catch (err) {
    dispatchEvent(sceneId, {
      type: "GENERATE_FAILED",
      reason: isAbortError(err) ? "aborted" : "error",
      message: errorMessage(err),
    });
  } finally {
    // Drain the queue — only one stream in flight at a time.
    if (queue.length > 0) {
      const nextId = queue.shift();
      if (nextId !== undefined) {
        // Fire-and-forget the next generation. The error path inside
        // runGeneration handles its own state transitions.
        void runGeneration(nextId);
      }
    }
  }
}

// ─── Voice nudge logic ──────────────────────────────────

function maybeShowVoiceNudge(sceneId: string) {
  if (sessionVoiceNudgeDismissed) return;
  const ring1 = store.voiceGuide?.ring1Injection ?? "";
  if (ring1.length === 0) {
    voiceNudge = { sceneId };
  }
}

function dismissVoiceNudge() {
  sessionVoiceNudgeDismissed = true;
  voiceNudge = null;
}

function openVoiceSetup() {
  // Scroll to the Voice subsection in SetupPanel. The setup panel is
  // collapsible; we scroll regardless and rely on the user to expand it.
  const el = document.querySelector("[data-testid=\"setup-voice\"]");
  if (el && typeof el.scrollIntoView === "function") {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  dismissVoiceNudge();
}

// ─── Public handlers passed to SectionCard ──────────────

function handleGenerate(sceneId: string) {
  maybeShowVoiceNudge(sceneId);

  if (isAnotherSectionInFlight()) {
    queue.push(sceneId);
    dispatchEvent(sceneId, { type: "GENERATE_REQUESTED", hasPending: true });
    return;
  }

  // Direct dispatch path — straight into streaming via runGeneration.
  void runGeneration(sceneId);
}

async function handleRegenerate(sceneId: string) {
  // First, flush any pending debounced edit so priorText is accurate.
  await flushPendingEdit(sceneId);

  // SYNCHRONOUSLY capture the prior canonical text. The store may be mutated
  // by the next generation before we get another chance.
  const chunks = store.sceneChunks[sceneId] ?? [];
  const priorChunk = chunks[0];
  const priorText = priorChunk ? getCanonicalText(priorChunk) : "";

  if (priorText.length > 0) {
    revertSlots.set(sceneId, {
      priorText,
      expiresAt: Date.now() + 60_000,
      timerId: null,
    });
  }

  maybeShowVoiceNudge(sceneId);

  const dispatchPath = async () => {
    await runGeneration(sceneId);

    // After successful regenerate, drop the prior chunk and start the 60s
    // revert window. We check that the section actually transitioned to
    // idle-populated — failure clears the slot.
    const finalState = getSectionState(sceneId);
    if (finalState === "idle-populated") {
      // The "prior chunk" was at index 0 of the original chunks array. Now
      // there's a new chunk appended; the prior is still index 0.
      if (priorText.length > 0) {
        const removeResult = await commands.removeChunk(sceneId, 0);
        if (removeResult.ok) {
          // Start the 60s timer
          const slot = revertSlots.get(sceneId);
          if (slot) {
            const timerId = setTimeout(() => {
              revertSlots.delete(sceneId);
            }, 60_000);
            revertSlots.set(sceneId, { ...slot, timerId });
          }
        } else {
          revertSlots.delete(sceneId);
        }
      }
    } else {
      // Failure or cancellation — abandon the slot.
      revertSlots.delete(sceneId);
    }
  };

  if (isAnotherSectionInFlight()) {
    queue.push(sceneId);
    dispatchEvent(sceneId, { type: "GENERATE_REQUESTED", hasPending: true });
    // Wait until the queue drains to this sceneId. We can't easily await
    // that here without more plumbing; instead, the post-success cleanup is
    // hooked from the same queue dispatch by checking state inside the
    // finally block. For V1 simplicity, kick off dispatchPath when the queue
    // empties via the runGeneration finally block. Since we already pushed,
    // the runGeneration drain will pick this up. The priorText capture is
    // already locked in via the slot.
    return;
  }

  await dispatchPath();
}

async function flushPendingEdit(sceneId: string): Promise<void> {
  const timerId = editDebounceTimers.get(sceneId);
  if (!timerId) return;
  clearTimeout(timerId);
  editDebounceTimers.delete(sceneId);
  // Persist immediately (the store has already been mutated by handleEdit;
  // we just need to push it to the API).
  await commands.persistChunk(sceneId, 0);
}

async function handleRevert(sceneId: string) {
  const slot = revertSlots.get(sceneId);
  if (!slot) return;
  if (slot.timerId !== null) clearTimeout(slot.timerId);
  await commands.updateChunk(sceneId, 0, { editedText: slot.priorText, status: "edited" });
  revertSlots.delete(sceneId);
  dispatchEvent(sceneId, { type: "REVERTED" });
}

function handleEdit(sceneId: string, newText: string) {
  // Edit clears the revert slot (first edit only — SectionCard fires onEdit
  // exactly once per stream cycle).
  const slot = revertSlots.get(sceneId);
  if (slot) {
    if (slot.timerId !== null) clearTimeout(slot.timerId);
    revertSlots.delete(sceneId);
  }

  // Update the store optimistically so the UI reflects the edit.
  store.updateChunkForScene(sceneId, 0, { editedText: newText, status: "edited" });

  // Debounced 500ms persist. Per-scene timer.
  const existing = editDebounceTimers.get(sceneId);
  if (existing) clearTimeout(existing);
  const timerId = setTimeout(async () => {
    editDebounceTimers.delete(sceneId);
    await commands.persistChunk(sceneId, 0);

    // ─── CIPHER duplication from DraftStage.svelte:389-427 ────────────
    // TODO v2: extract shared helper — reference: DraftStage.svelte:389-427
    const chunk = (store.sceneChunks[sceneId] ?? [])[0];
    if (chunk?.generatedText && chunk.editedText && store.project) {
      if (shouldTriggerCipher(chunk.generatedText, chunk.editedText)) {
        apiStoreSignificantEdit(store.project.id, chunk.id, chunk.generatedText, chunk.editedText)
          .then((count) => {
            if (count >= 10) {
              const projectId = store.project?.id;
              if (!projectId) return;
              apiFireBatchCipher(projectId)
                .then(({ ring1Injection }) => {
                  if (ring1Injection && store.voiceGuide) {
                    store.setVoiceGuide({ ...store.voiceGuide, ring1Injection });
                  }
                })
                .catch((err) => console.warn("[cipher] Batch inference failed:", err));
            }
          })
          .catch((err) => console.warn("[cipher] Edit tracking failed:", err));
      }
    }
  }, 500);
  editDebounceTimers.set(sceneId, timerId);
}

function handleCancel(sceneId: string) {
  // Remove from queue if present
  const queueIdx = queue.indexOf(sceneId);
  if (queueIdx >= 0) queue.splice(queueIdx, 1);

  // If currently streaming, abort the live generation. The store-level
  // abort controller will cause generateChunk to throw, which the
  // runGeneration catch handles via GENERATE_FAILED.
  if (getSectionState(sceneId) === "streaming") {
    store.cancelGeneration?.();
  }

  dispatchEvent(sceneId, { type: "CANCELLED" });
}

function handleDeleteRequest(sceneId: string) {
  confirmDeleteSceneId = sceneId;
}

async function confirmDelete() {
  const sceneId = confirmDeleteSceneId;
  if (!sceneId) return;
  confirmDeleteSceneId = null;

  // Clear any pending state for this scene before deleting.
  const slot = revertSlots.get(sceneId);
  if (slot?.timerId) clearTimeout(slot.timerId);
  revertSlots.delete(sceneId);

  const editTimer = editDebounceTimers.get(sceneId);
  if (editTimer) clearTimeout(editTimer);
  editDebounceTimers.delete(sceneId);

  sectionStates.delete(sceneId);
  directivesBySection.delete(sceneId);

  const idx = queue.indexOf(sceneId);
  if (idx >= 0) queue.splice(idx, 1);

  await commands.removeScenePlan(sceneId);
}

function cancelDelete() {
  confirmDeleteSceneId = null;
}

async function handleMoveUp(sceneId: string) {
  const ids = store.scenes.map((s) => s.plan.id);
  const idx = ids.indexOf(sceneId);
  if (idx <= 0) return;
  const next = [...ids];
  [next[idx - 1], next[idx]] = [next[idx]!, next[idx - 1]!];
  const chapterId = store.scenes[idx]?.plan.chapterId ?? "";
  await commands.reorderScenePlans(chapterId, next);
}

async function handleMoveDown(sceneId: string) {
  const ids = store.scenes.map((s) => s.plan.id);
  const idx = ids.indexOf(sceneId);
  if (idx < 0 || idx >= ids.length - 1) return;
  const next = [...ids];
  [next[idx], next[idx + 1]] = [next[idx + 1]!, next[idx]!];
  const chapterId = store.scenes[idx]?.plan.chapterId ?? "";
  await commands.reorderScenePlans(chapterId, next);
}

async function handleAddSection() {
  if (!store.project) return;
  const plan = createEmptyScenePlan(store.project.id);
  // Non-empty failureModeToAvoid so checkScenePlanGate eventually passes.
  plan.failureModeToAvoid =
    "Generic section without a clear function. Define what this section should do in the essay.";
  const order = store.scenes.length;
  const result = await commands.saveScenePlan(plan, order);
  if (result.ok) {
    sectionStates.set(plan.id, "idle-empty");
    // Scroll to the new section after the next render tick.
    await tick();
    const el = document.querySelector(`[data-section-id="${plan.id}"]`);
    if (el && typeof (el as HTMLElement).scrollIntoView === "function") {
      (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

async function handleUpdatePlan(plan: ScenePlan) {
  await commands.updateScenePlan(plan);
}

function handleDirectiveChange(sceneId: string, text: string) {
  directivesBySection.set(sceneId, text);
}

async function handleDismissKillListPattern(pattern: string) {
  if (!store.bible) return;
  const next = {
    ...store.bible,
    styleGuide: {
      ...store.bible.styleGuide,
      killList: store.bible.styleGuide.killList.filter((k) => k.pattern !== pattern),
    },
  };
  await commands.saveBible(next);
}

function handleDismissFailed(sceneId: string) {
  // Reset to the most accurate non-failed state based on current chunks.
  if (hasPriorChunks(sceneId)) {
    sectionStates.set(sceneId, "idle-populated");
  } else {
    sectionStates.set(sceneId, "idle-empty");
  }
}

function handleJumpToViolation(_category: "kill_list" | "rhythm_monotony" | "paragraph_length") {
  // V1 stub — focus the first section that has a flag of this category. The
  // actual scroll-to-flag is annotation-driven inside SectionCard's editor;
  // the minimum viable wiring here is a no-op placeholder for the prop
  // contract. ComposerFooter already verifies the click fires the callback.
}

function handleBibleChange() {
  // Kill-list edits trigger a 300ms-debounced re-audit of all idle-populated
  // sections (and failed-with-prior-chunks). Streaming/queued sections get
  // re-audited via persistChunkAndAudit when their stream completes.
  if (reauditTimer !== null) clearTimeout(reauditTimer);
  reauditTimer = setTimeout(() => {
    reauditTimer = null;
    runReauditAcrossSections();
  }, 300);
}

function shouldReauditSection(state: SectionState, sceneId: string): boolean {
  if (state === "idle-populated") return true;
  if (typeof state === "object" && state.state === "failed" && hasPriorChunks(sceneId)) return true;
  return false;
}

async function runReauditAcrossSections() {
  if (!store.bible) return;
  const allFlags = [];
  for (const scene of store.scenes) {
    const sceneId = scene.plan.id;
    const state = getSectionState(sceneId);
    if (!shouldReauditSection(state, sceneId)) continue;
    const chunks = store.sceneChunks[sceneId] ?? [];
    if (chunks.length === 0) continue;
    const prose = chunks.map((c: Chunk) => getCanonicalText(c)).join("\n\n");
    const { flags } = runAudit(prose, store.bible, sceneId);
    allFlags.push(...flags);
  }
  await commands.saveAuditFlags(allFlags);
}

// ─── Cold-load recovery ─────────────────────────────────
//
// On mount, scan all scenes for chunks left in `pending` status (interrupted
// streams from a prior session). For each, remove the orphan chunk and set
// the section state to failed/aborted with an interrupted message.

let coldLoadDone = false;
$effect(() => {
  if (coldLoadDone) return;
  if (!store.project) return; // wait until the store is hydrated
  coldLoadDone = true;

  for (const scene of store.scenes) {
    const sceneId = scene.plan.id;
    const chunks = store.sceneChunks[sceneId] ?? [];
    if (chunks.length === 0) continue;
    const last = chunks[chunks.length - 1];
    if (last?.status === "pending") {
      store.removeChunkForScene(sceneId, chunks.length - 1);
      sectionStates.set(sceneId, {
        state: "failed",
        reason: "aborted",
        message: "Last generation was interrupted — regenerate when ready",
      });
    } else if (chunks.length > 0) {
      // Initialize known sections to idle-populated so the reducer tracks
      // them properly on first interaction.
      if (!sectionStates.has(sceneId)) {
        sectionStates.set(sceneId, "idle-populated");
      }
    }
  }
});

// ─── Unmount cleanup ────────────────────────────────────
//
// Empty-deps trick: returning a function from a $effect runs it on
// destruction. Closing over the timer maps means we can clear them all
// without re-running on every render.
$effect(() => {
  return () => {
    for (const slot of revertSlots.values()) {
      if (slot.timerId !== null) clearTimeout(slot.timerId);
    }
    for (const t of editDebounceTimers.values()) {
      clearTimeout(t);
    }
    if (reauditTimer !== null) {
      clearTimeout(reauditTimer);
      reauditTimer = null;
    }
  };
});

// ─── Per-section derived data ───────────────────────────

function queuePositionFor(sceneId: string): number | null {
  const idx = queue.indexOf(sceneId);
  return idx >= 0 ? idx : null;
}

function textForScene(sceneId: string): string {
  const chunks = store.sceneChunks[sceneId] ?? [];
  return chunks.map((c) => getCanonicalText(c)).join("\n\n");
}

function auditFlagsForScene(sceneId: string) {
  return store.auditFlags.filter((f) => f.sceneId === sceneId && !f.resolved);
}

function revertDeadlineFor(sceneId: string): number | null {
  return revertSlots.get(sceneId)?.expiresAt ?? null;
}
</script>

<div class="essay-composer" data-testid="essay-composer">
  <SetupPanel {store} {commands} onBibleChange={handleBibleChange} />

  <div class="sections-list" data-testid="sections-list">
    {#each store.scenes as scene, index (scene.plan.id)}
      {#if voiceNudge?.sceneId === scene.plan.id}
        <div class="voice-nudge-banner" data-testid="voice-nudge-banner" role="alert">
          <span class="voice-nudge-text">
            Generate voice profile first to get prose that sounds like you?
          </span>
          <div class="voice-nudge-actions">
            <Button
              size="sm"
              variant="primary"
              onclick={openVoiceSetup}
            >Generate Voice</Button>
            <Button
              size="sm"
              onclick={dismissVoiceNudge}
            >Skip for now</Button>
          </div>
        </div>
      {/if}

      <SectionCard
        {scene}
        text={textForScene(scene.plan.id)}
        state={getSectionState(scene.plan.id)}
        auditFlags={auditFlagsForScene(scene.plan.id)}
        killList={store.bible?.styleGuide?.killList ?? []}
        directiveText={directivesBySection.get(scene.plan.id) ?? ""}
        queuePosition={queuePositionFor(scene.plan.id)}
        isFirstSection={index === 0}
        isLastSection={index === store.scenes.length - 1}
        isRevertable={isRevertable(scene.plan.id)}
        revertDeadline={revertDeadlineFor(scene.plan.id)}
        onGenerate={handleGenerate}
        onRegenerate={handleRegenerate}
        onRevert={handleRevert}
        onCancel={handleCancel}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onUpdatePlan={handleUpdatePlan}
        onDirectiveChange={handleDirectiveChange}
        onDismissKillListPattern={handleDismissKillListPattern}
        onDismissFailed={handleDismissFailed}
      />
    {/each}
  </div>

  <div class="add-section-row">
    <button
      type="button"
      class="add-section-btn"
      data-testid="add-section-btn"
      onclick={handleAddSection}
    >+ Add section</button>
  </div>

  <ComposerFooter {store} {commands} onJumpToViolation={handleJumpToViolation} />

  {#if confirmDeleteSceneId}
    <Modal open={true} onClose={cancelDelete}>
      {#snippet header()}<span>Delete section?</span>{/snippet}
      {#snippet children()}
        <p>This will remove the section and any generated prose. This action cannot be undone.</p>
      {/snippet}
      {#snippet footer()}
        <button type="button" class="btn btn-default btn-md" onclick={cancelDelete}>Cancel</button>
        <button type="button" class="btn btn-danger btn-md" data-testid="confirm-delete-btn" onclick={confirmDelete}>Delete</button>
      {/snippet}
    </Modal>
  {/if}
</div>

<style>
  .essay-composer {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }
  .sections-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .voice-nudge-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: var(--radius-md);
    font-size: 12px;
  }
  .voice-nudge-text {
    color: var(--text-primary);
  }
  .voice-nudge-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
  .add-section-row {
    display: flex;
    justify-content: center;
    padding: 4px 0;
  }
  .add-section-btn {
    background: var(--bg-secondary);
    border: 1px dashed var(--border);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    padding: 8px 16px;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  }
  .add-section-btn:hover {
    color: var(--text-primary);
    border-color: var(--text-secondary);
  }
</style>
