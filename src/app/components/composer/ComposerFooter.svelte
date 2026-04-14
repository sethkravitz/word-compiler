<script lang="ts">
import { exportToMarkdown } from "../../../export/markdown.js";
import { exportToPlaintext } from "../../../export/plaintext.js";
import { getCanonicalText } from "../../../types/index.js";
import { Badge } from "../../primitives/index.js";
import type { Commands } from "../../store/commands.js";
import type { ProjectStore } from "../../store/project.svelte.js";

// ComposerFooter is purely presentational. It reads from `store` (scenes,
// sceneChunks, auditFlags, voiceGuide, chapterArc) and emits jump-to-violation
// intent via callback. Export reuses src/export/markdown and plaintext, and
// downloads via the same URL.createObjectURL + programmatic <a click> pattern
// as ExportStage.svelte.

type ViolationCategory = "kill_list" | "rhythm_monotony" | "paragraph_length";

// `commands` is reserved in the prop contract so EssayComposer (Unit 8) can
// hand the same object it gives SectionCard / SetupPanel. The footer does not
// currently dispatch any command — biome ignores names prefixed with `_`.
let {
  store,
  commands: _commands,
  onJumpToViolation,
}: {
  store: ProjectStore;
  commands: Commands;
  onJumpToViolation: (category: ViolationCategory) => void;
} = $props();

// ─── Word count: sum of canonical text across all scenes ──
// Mirrors App.svelte:172-177 exactly.
const totalWordCount = $derived(
  store.scenes.reduce((sum, scene) => {
    const chunks = store.sceneChunks[scene.plan.id] ?? [];
    return sum + chunks.reduce((s, c) => s + getCanonicalText(c).split(/\s+/).filter(Boolean).length, 0);
  }, 0),
);

// ─── Audit counts: unresolved flags grouped by category ──
const killListCount = $derived(store.auditFlags.filter((f) => !f.resolved && f.category === "kill_list").length);
const rhythmCount = $derived(store.auditFlags.filter((f) => !f.resolved && f.category === "rhythm_monotony").length);
const paragraphCount = $derived(
  store.auditFlags.filter((f) => !f.resolved && f.category === "paragraph_length").length,
);

// ─── Voice readiness ──
const voiceReady = $derived(store.voiceGuide !== null && (store.voiceGuide?.ring1Injection?.length ?? 0) > 0);

// ─── Last save: most recent chunk generatedAt across all scenes ──
//
// Plan said "most recent chunk updatedAt" but the Chunk type only has
// generatedAt (set on creation) — there is no separate updatedAt field. Using
// generatedAt is the closest pure-derivation signal: it advances every time a
// chunk is created or replaced via store.addChunk. Edits update editedText in
// place but do not touch generatedAt; that's a known limitation we accept for
// V1 rather than wrapping commands.
const lastSavedAt = $derived.by(() => {
  let latest: string | null = null;
  for (const scene of store.scenes) {
    const chunks = store.sceneChunks[scene.plan.id] ?? [];
    for (const chunk of chunks) {
      if (latest === null || chunk.generatedAt > latest) {
        latest = chunk.generatedAt;
      }
    }
  }
  return latest;
});

function formatRelativeTime(iso: string | null): string {
  if (iso === null) return "never";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "never";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const lastSavedLabel = $derived(formatRelativeTime(lastSavedAt));

// ─── Export menu ──
let exportMenuOpen = $state(false);

function toggleExportMenu() {
  exportMenuOpen = !exportMenuOpen;
}

function closeExportMenu() {
  exportMenuOpen = false;
}

function getFilename(format: "markdown" | "plaintext"): string {
  const title = store.chapterArc?.workingTitle ?? "essay";
  const slug =
    title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") || "essay";
  const ext = format === "markdown" ? "md" : "txt";
  return `${slug}-${Date.now()}.${ext}`;
}

function countEmptySections(): number {
  let empty = 0;
  for (const scene of store.scenes) {
    const chunks = store.sceneChunks[scene.plan.id] ?? [];
    const text = chunks
      .map((c) => getCanonicalText(c))
      .join("")
      .trim();
    if (text.length === 0) empty++;
  }
  return empty;
}

function countUnresolvedKillListFlags(): number {
  return store.auditFlags.filter((f) => !f.resolved && f.category === "kill_list").length;
}

function performExport(format: "markdown" | "plaintext") {
  const content =
    format === "markdown"
      ? exportToMarkdown(store.scenes, store.sceneChunks, store.chapterArc)
      : exportToPlaintext(store.scenes, store.sceneChunks);
  const mimeType = format === "markdown" ? "text/markdown" : "text/plain";
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = getFilename(format);
  a.click();
  URL.revokeObjectURL(url);
}

function handleExport(format: "markdown" | "plaintext") {
  closeExportMenu();
  const empty = countEmptySections();
  const killList = countUnresolvedKillListFlags();
  if (empty > 0 || killList > 0) {
    const ok = window.confirm(
      `${empty} section${empty === 1 ? "" : "s"} empty, ${killList} kill list hit${killList === 1 ? "" : "s"} — export anyway?`,
    );
    if (!ok) return;
  }
  performExport(format);
}

function handlePillClick(category: ViolationCategory) {
  onJumpToViolation(category);
}
</script>

<div class="composer-footer" data-testid="composer-footer">
  <div class="footer-section word-count" data-testid="footer-word-count">
    <span class="metric-label">Words</span>
    <span class="metric-value">{totalWordCount.toLocaleString()}</span>
  </div>

  <div class="footer-section audit-counts" data-testid="footer-audit-counts">
    <button
      type="button"
      class="audit-pill"
      data-testid="audit-pill-kill-list"
      onclick={() => handlePillClick("kill_list")}
    >Kill list: {killListCount}</button>
    <span class="pill-sep">·</span>
    <button
      type="button"
      class="audit-pill"
      data-testid="audit-pill-rhythm"
      onclick={() => handlePillClick("rhythm_monotony")}
    >Sentence variance: {rhythmCount}</button>
    <span class="pill-sep">·</span>
    <button
      type="button"
      class="audit-pill"
      data-testid="audit-pill-paragraph"
      onclick={() => handlePillClick("paragraph_length")}
    >Paragraph length: {paragraphCount}</button>
  </div>

  <div class="footer-section voice-status" data-testid="footer-voice-status">
    {#if voiceReady}
      <Badge variant="accepted">Voice: ready</Badge>
    {:else}
      <Badge variant="warning">Voice: not set</Badge>
    {/if}
  </div>

  <div class="footer-section last-save" data-testid="footer-last-save">
    <span class="metric-label">Saved</span>
    <span class="metric-value">{lastSavedLabel}</span>
  </div>

  <div class="footer-section export-block" data-testid="footer-export-block">
    <button
      type="button"
      class="export-button"
      data-testid="footer-export-button"
      onclick={toggleExportMenu}
    >Export ▾</button>
    {#if exportMenuOpen}
      <div class="export-menu" data-testid="footer-export-menu" role="menu">
        <button
          type="button"
          class="export-menu-item"
          role="menuitem"
          data-testid="footer-export-markdown"
          onclick={() => handleExport("markdown")}
        >Markdown</button>
        <button
          type="button"
          class="export-menu-item"
          role="menuitem"
          data-testid="footer-export-plaintext"
          onclick={() => handleExport("plaintext")}
        >Plain text</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .composer-footer {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 16px;
    border-top: 1px solid var(--border);
    background: var(--bg-card);
    font-size: 12px;
    color: var(--text-secondary);
  }
  .footer-section {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .metric-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .metric-value {
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }
  .audit-counts {
    gap: 4px;
  }
  .audit-pill {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 2px 8px;
    font-size: 11px;
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
  }
  .audit-pill:hover {
    color: var(--text-primary);
    border-color: var(--text-secondary);
  }
  .pill-sep {
    color: var(--text-muted);
    font-size: 11px;
  }
  .export-block {
    margin-left: auto;
    position: relative;
  }
  .export-button {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  }
  .export-button:hover {
    border-color: var(--text-secondary);
  }
  .export-menu {
    position: absolute;
    bottom: calc(100% + 4px);
    right: 0;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    min-width: 140px;
    z-index: 10;
  }
  .export-menu-item {
    background: transparent;
    border: none;
    padding: 8px 12px;
    text-align: left;
    font-size: 12px;
    color: var(--text-primary);
    cursor: pointer;
    font-family: inherit;
  }
  .export-menu-item:hover {
    background: var(--bg-secondary);
  }
  @media (pointer: coarse) {
    .audit-pill,
    .export-menu-item {
      min-height: 44px;
    }
  }
</style>
