<script lang="ts">
import type { KillListEntry } from "../../../types/bible.js";
import type { AuditFlag } from "../../../types/quality.js";
import type { AnchorLine, ScenePlan } from "../../../types/scene.js";
import { Badge, Button, ErrorBanner, FormField, Input, TextArea } from "../../primitives/index.js";
import AnnotatedEditor from "../AnnotatedEditor.svelte";
import { mapAuditFlagsToAnnotations } from "./auditMapping.js";
import { computeControlMatrix, isFailedState, type SectionState } from "./types.js";

// SectionCard is purely presentational. EssayComposer (Unit 8) owns all
// orchestration state — section state machine, queue, revert slots, voice
// nudge — and passes it in via props. This component renders one section,
// derives its visible/disabled controls from `state`, and emits user intent
// via callbacks. It never imports `store`, `commands`, or any api module.

interface SceneEntryLike {
  plan: ScenePlan;
  status: string;
  sceneOrder: number;
}

let {
  scene,
  text,
  state: sectionState,
  auditFlags,
  killList,
  directiveText,
  queuePosition,
  isFirstSection,
  isLastSection,
  isRevertable,
  // revertDeadline reserved for future countdown UI; accepted now to lock the
  // composer→card prop contract before Unit 8.
  revertDeadline: _revertDeadline,
  onGenerate,
  onRegenerate,
  onRevert,
  onCancel,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onUpdatePlan,
  onDirectiveChange,
  onDismissKillListPattern,
  onDismissFailed,
}: {
  scene: SceneEntryLike;
  text: string;
  state: SectionState;
  auditFlags: AuditFlag[];
  killList: KillListEntry[];
  directiveText: string;
  queuePosition: number | null;
  isFirstSection: boolean;
  isLastSection: boolean;
  isRevertable: boolean;
  revertDeadline: number | null;
  onGenerate: (sceneId: string) => void;
  onRegenerate: (sceneId: string) => void;
  onRevert: (sceneId: string) => void;
  onCancel: (sceneId: string) => void;
  onEdit: (sceneId: string, newText: string) => void;
  onDelete: (sceneId: string) => void;
  onMoveUp: (sceneId: string) => void;
  onMoveDown: (sceneId: string) => void;
  onUpdatePlan: (plan: ScenePlan) => void;
  onDirectiveChange: (sceneId: string, text: string) => void;
  onDismissKillListPattern: (pattern: string) => void;
  onDismissFailed: (sceneId: string) => void;
} = $props();

const sceneId = $derived(scene.plan.id);
const hasText = $derived(text.length > 0);
const isStreaming = $derived(sectionState === "streaming");

const controlMatrix = $derived(
  computeControlMatrix(sectionState, isFirstSection, isLastSection, isRevertable, hasText),
);

const annotations = $derived(mapAuditFlagsToAnnotations(auditFlags, text, killList));

// ─── Heading + goal local edit buffers (sync from props on blur) ──
//
// The pattern matches ChunkCard: local $state for the editing buffer, $effect
// to refresh from props when the user is not actively typing. Blur calls
// onUpdatePlan with the merged plan.
let titleDraft = $state("");
let goalDraft = $state("");

let titleFocused = $state(false);
let goalFocused = $state(false);

$effect(() => {
  if (!titleFocused) titleDraft = scene.plan.title;
});
$effect(() => {
  if (!goalFocused) goalDraft = scene.plan.narrativeGoal;
});

function commitTitleIfChanged() {
  if (titleDraft !== scene.plan.title) {
    onUpdatePlan({ ...scene.plan, title: titleDraft });
  }
}
function commitGoalIfChanged() {
  if (goalDraft !== scene.plan.narrativeGoal) {
    onUpdatePlan({ ...scene.plan, narrativeGoal: goalDraft });
  }
}

// ─── Editor edit buffer + edit-once-per-stream-cycle ──────────────
//
// The composer's revert slot is cleared on the FIRST edit after a stream
// completes, not on every keystroke. SectionCard implements this by tracking
// `hasEditedSinceStream` locally: it resets whenever a stream begins, and the
// onEdit callback fires exactly once on the first onTextChange after that.
let editDraft = $state("");
let hasEditedSinceStream = $state(false);

$effect(() => {
  if (isStreaming) {
    hasEditedSinceStream = false;
  }
});

$effect(() => {
  if (!isStreaming && !hasEditedSinceStream) {
    editDraft = text;
  }
});

function handleTextChange(newText: string) {
  editDraft = newText;
  if (!hasEditedSinceStream) {
    hasEditedSinceStream = true;
    onEdit(sceneId, newText);
  }
}

// ─── Directive draft buffer (composer-owned source, blur-only commit) ──
let directiveDraft = $state("");

$effect(() => {
  directiveDraft = directiveText;
});

function handleDirectiveBlur() {
  if (directiveDraft !== directiveText) {
    onDirectiveChange(sceneId, directiveDraft);
  }
}

// ─── Annotation dismissal: extract pattern from id, forward to composer ─
//
// auditMapping.ts encodes the pattern in the annotation fingerprint as
// `${sceneId}:${pattern}:${start}:${end}`. We parse it back out here so the
// composer never needs to know the encoding.
function handleDismissAnnotation(annotationId: string) {
  const ann = annotations.find((a) => a.id === annotationId);
  if (!ann) return;
  // Fingerprint format: sceneId:pattern:start:end. The pattern itself may
  // contain colons in pathological cases, but our auditor only emits literal
  // text patterns from the kill list, none of which contain colons. Splitting
  // on the first and last two colons is enough for the V1 contract.
  const parts = ann.fingerprint.split(":");
  if (parts.length < 4) return;
  // Drop first (sceneId) and last two (start, end). Rejoin the middle in case
  // a future pattern legitimately contains a colon.
  const pattern = parts.slice(1, parts.length - 2).join(":");
  if (pattern) onDismissKillListPattern(pattern);
}

// ─── Key points (chunkDescriptions) ───────────────────────
function updateKeyPoint(index: number, value: string) {
  const next = [...scene.plan.chunkDescriptions];
  next[index] = value;
  onUpdatePlan({ ...scene.plan, chunkDescriptions: next });
}
function addKeyPoint() {
  onUpdatePlan({
    ...scene.plan,
    chunkDescriptions: [...scene.plan.chunkDescriptions, ""],
  });
}
function removeKeyPoint(index: number) {
  const next = scene.plan.chunkDescriptions.filter((_, i) => i !== index);
  onUpdatePlan({ ...scene.plan, chunkDescriptions: next });
}

// ─── Anchor lines ─────────────────────────────────────────
function updateAnchorLine(index: number, patch: Partial<AnchorLine>) {
  const next = scene.plan.anchorLines.map((a, i) => (i === index ? { ...a, ...patch } : a));
  onUpdatePlan({ ...scene.plan, anchorLines: next });
}
function addAnchorLine() {
  onUpdatePlan({
    ...scene.plan,
    anchorLines: [...scene.plan.anchorLines, { text: "", placement: "anywhere", verbatim: false }],
  });
}
function removeAnchorLine(index: number) {
  const next = scene.plan.anchorLines.filter((_, i) => i !== index);
  onUpdatePlan({ ...scene.plan, anchorLines: next });
}

// ─── Failed-state header text ─────────────────────────────
const failedHeaderText = $derived(
  isFailedState(sectionState) ? (sectionState.reason === "aborted" ? "Generation cancelled" : "Generation failed") : "",
);
const failedMessage = $derived(isFailedState(sectionState) ? sectionState.message : "");
</script>

<div class="section-card" data-section-id={sceneId}>
  <div class="section-card-header">
    <div class="reorder-controls">
      <button
        type="button"
        class="reorder-btn"
        aria-label="Move up"
        disabled={!controlMatrix.reorderUpEnabled}
        onclick={() => onMoveUp(sceneId)}
      >↑</button>
      <button
        type="button"
        class="reorder-btn"
        aria-label="Move down"
        disabled={!controlMatrix.reorderDownEnabled}
        onclick={() => onMoveDown(sceneId)}
      >↓</button>
    </div>
    <div class="heading-block">
      <FormField label="Section heading" fieldId="section-heading">
        <Input
          bind:value={titleDraft}
          placeholder="Section heading"
          oninput={() => { titleFocused = true; }}
          onblur={() => { titleFocused = false; commitTitleIfChanged(); }}
        />
      </FormField>
    </div>
    <div class="header-status">
      {#if controlMatrix.queueIndicatorVisible && queuePosition !== null}
        <Badge variant="pending">Queued — position {queuePosition + 1}</Badge>
      {/if}
    </div>
  </div>

  {#if controlMatrix.errorBannerVisible}
    <div class="failed-block">
      <div class="failed-header">{failedHeaderText}</div>
      <ErrorBanner message={failedMessage} onDismiss={() => onDismissFailed(sceneId)} />
    </div>
  {/if}

  <div class="primary-controls">
    <FormField label="Section goal" fieldId="section-goal">
      <Input
        bind:value={goalDraft}
        placeholder="What this section accomplishes"
        oninput={() => { goalFocused = true; }}
        onblur={() => { goalFocused = false; commitGoalIfChanged(); }}
      />
    </FormField>

    <FormField label="Key points" fieldId="section-key-points">
      <div class="key-points-list">
        {#each scene.plan.chunkDescriptions as kp, i (i)}
          <div class="key-point-row">
            <TextArea
              value={kp}
              variant="compact"
              placeholder="Key point"
              oninput={(e) => updateKeyPoint(i, (e.target as HTMLTextAreaElement).value)}
            />
            <button
              type="button"
              class="row-remove-btn"
              aria-label="Remove key point"
              onclick={() => removeKeyPoint(i)}
            >×</button>
          </div>
        {/each}
        <Button size="sm" onclick={addKeyPoint}>+ Add key point</Button>
      </div>
    </FormField>

    <FormField label="Anchor lines" fieldId="section-anchor-lines">
      <div class="anchor-lines-list">
        {#each scene.plan.anchorLines as anchor, i (i)}
          <div class="anchor-row">
            <TextArea
              value={anchor.text}
              variant="compact"
              placeholder="Anchor line text"
              oninput={(e) => updateAnchorLine(i, { text: (e.target as HTMLTextAreaElement).value })}
            />
            <select
              class="anchor-placement"
              value={anchor.placement}
              onchange={(e) => updateAnchorLine(i, { placement: (e.target as HTMLSelectElement).value })}
            >
              <option value="open">open</option>
              <option value="middle">middle</option>
              <option value="close">close</option>
              <option value="anywhere">anywhere</option>
            </select>
            <label class="verbatim-toggle">
              <input
                type="checkbox"
                checked={anchor.verbatim}
                onchange={(e) => updateAnchorLine(i, { verbatim: (e.target as HTMLInputElement).checked })}
              />
              verbatim
            </label>
            <button
              type="button"
              class="row-remove-btn"
              aria-label="Remove anchor line"
              onclick={() => removeAnchorLine(i)}
            >×</button>
          </div>
        {/each}
        <Button size="sm" onclick={addAnchorLine}>+ Add anchor line</Button>
      </div>
    </FormField>
  </div>

  <div class="editor-block">
    <AnnotatedEditor
      text={editDraft}
      {annotations}
      readonly={controlMatrix.editorReadonly}
      onTextChange={handleTextChange}
      onDismissAnnotation={handleDismissAnnotation}
    />
  </div>

  <div class="directive-row">
    <Input
      bind:value={directiveDraft}
      placeholder="Add a nudge for next generation..."
      onblur={handleDirectiveBlur}
    />
  </div>

  <div class="action-row">
    {#if controlMatrix.generateVisible}
      <Button
        variant="primary"
        disabled={!controlMatrix.generateEnabled}
        onclick={() => onGenerate(sceneId)}
      >Generate</Button>
    {/if}
    {#if controlMatrix.regenerateVisible}
      <Button
        variant="primary"
        disabled={!controlMatrix.regenerateEnabled}
        onclick={() => onRegenerate(sceneId)}
      >Regenerate</Button>
    {/if}
    {#if controlMatrix.revertVisible}
      <Button onclick={() => onRevert(sceneId)}>Revert</Button>
    {/if}
    {#if controlMatrix.cancelVisible}
      <Button variant="danger" onclick={() => onCancel(sceneId)}>Cancel</Button>
    {/if}
    <div class="spacer"></div>
    <Button variant="danger" disabled={!controlMatrix.deleteEnabled} onclick={() => onDelete(sceneId)}>Delete</Button>
  </div>
</div>

<style>
  .section-card {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    padding: 12px;
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .section-card-header {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .reorder-controls {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-shrink: 0;
  }
  .reorder-btn {
    width: 24px;
    height: 22px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 11px;
    padding: 0;
    line-height: 1;
  }
  .reorder-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  @media (pointer: coarse) {
    .reorder-btn { min-width: 44px; min-height: 44px; }
  }
  .heading-block { flex: 1; }
  .header-status { flex-shrink: 0; }
  .failed-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .failed-header {
    font-size: 11px;
    font-weight: 600;
    color: var(--error);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .primary-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .key-points-list,
  .anchor-lines-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .key-point-row,
  .anchor-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .anchor-placement {
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 4px 6px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
  }
  .verbatim-toggle {
    font-size: 10px;
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .row-remove-btn {
    width: 22px;
    height: 22px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-muted);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 0;
    flex-shrink: 0;
  }
  .row-remove-btn:hover {
    color: var(--error);
    border-color: var(--error);
  }
  @media (pointer: coarse) {
    .row-remove-btn { min-width: 44px; min-height: 44px; }
  }
  .editor-block {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--bg-input);
  }
  .directive-row {
    display: flex;
  }
  .directive-row :global(.input) {
    width: 100%;
  }
  .action-row {
    display: flex;
    gap: 6px;
    align-items: center;
    padding-top: 4px;
    border-top: 1px solid var(--border);
  }
  .spacer { flex: 1; }
</style>
