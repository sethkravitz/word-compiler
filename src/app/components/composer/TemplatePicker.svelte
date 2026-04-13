<script lang="ts">
import {
  bootstrapToBible,
  bootstrapToScenePlans,
  buildBootstrapPrompt,
  ESSAY_TEMPLATES,
  type EssayTemplate,
  parseBootstrapResponse,
} from "../../../bootstrap/index.js";
import { generateStream } from "../../../llm/client.js";
import {
  createEmptyBible,
  createEmptyCharacterDossier,
  createEmptyScenePlan,
  generateId,
  type Project,
} from "../../../types/index.js";
import { Button, ErrorBanner, Modal, Spinner, TextArea } from "../../primitives/index.js";
import type { ApiActions } from "../../store/api-actions.js";

// TemplatePicker is the new-project entry for essay mode. It runs entirely
// client-side until it hands a fully materialized { project, bible,
// scenePlans } bundle to `actions.createEssayProject`, which persists them
// atomically with rollback on failure. No Bible or ScenePlan touches the
// server before the Project exists, so a failed bootstrap never leaves orphan
// rows behind.

let {
  open,
  actions,
  onProjectCreated,
  onCancel,
}: {
  open: boolean;
  actions: ApiActions;
  onProjectCreated: (project: Project) => void;
  onCancel: () => void;
} = $props();

// ─── Local state ──────────────────────────────────────────

let selectedTemplateId = $state<EssayTemplate["id"] | null>(null);
let brief = $state("");
let loading = $state(false);
let status = $state("");
let streamText = $state("");
let elapsed = $state(0);
let error = $state<string | null>(null);
let timerRef: ReturnType<typeof setInterval> | null = null;

const selectedTemplate = $derived(
  selectedTemplateId ? (ESSAY_TEMPLATES.find((t) => t.id === selectedTemplateId) ?? null) : null,
);

// Bootstrap is enabled when a template is picked AND brief text is non-empty.
// Skip-blank only needs a template pick — the brief textarea is ignored on
// that path.
const canBootstrap = $derived(!!selectedTemplate && brief.trim().length > 0 && !loading);
const canSkip = $derived(!!selectedTemplate && !loading);

function resetTransient() {
  status = "";
  streamText = "";
  elapsed = 0;
  error = null;
  loading = false;
  if (timerRef) {
    clearInterval(timerRef);
    timerRef = null;
  }
}

function handleCancel() {
  resetTransient();
  // Intentionally preserve brief + selection so a retry keeps the user's work.
  onCancel();
}

function handleSelectTemplate(id: EssayTemplate["id"]) {
  selectedTemplateId = id;
  error = null;
}

// ─── Bootstrap path ───────────────────────────────────────

async function streamBootstrap(template: EssayTemplate): Promise<string> {
  const payload = buildBootstrapPrompt(brief, template);
  let fullText = "";
  let streamError: string | null = null;
  await generateStream(payload, {
    onToken: (text) => {
      fullText += text;
      streamText = fullText;
    },
    onDone: () => {
      status = "Parsing response...";
    },
    onError: (err) => {
      streamError = err;
    },
  });
  if (streamError) throw new Error(streamError);
  return fullText;
}

function buildProjectShell(template: EssayTemplate): Project {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: template.name,
    status: "drafting",
    createdAt: now,
    updatedAt: now,
  };
}

async function handleBootstrap() {
  if (!selectedTemplate) return;
  const template = selectedTemplate;
  loading = true;
  error = null;
  streamText = "";
  elapsed = 0;
  const started = Date.now();
  timerRef = setInterval(() => {
    elapsed = Math.floor((Date.now() - started) / 1000);
  }, 1000);

  try {
    status = "Building prompt...";

    status = "Streaming from LLM...";
    const fullText = await streamBootstrap(template);

    status = "Parsing response...";
    const parsed = parseBootstrapResponse(fullText);
    if ("error" in parsed) {
      error = `Parse failed: ${parsed.error}\n\nRaw response:\n${fullText.slice(0, 500)}`;
      // Clear only the loading/stream state — preserve `error` so the banner
      // renders and the brief text so the user can retry.
      status = "";
      streamText = "";
      elapsed = 0;
      loading = false;
      if (timerRef) {
        clearInterval(timerRef);
        timerRef = null;
      }
      return;
    }

    const project = buildProjectShell(template);
    status = "Preparing brief...";
    const bible = bootstrapToBible(parsed, project.id, brief, template);
    const authorId = bible.characters[0]?.id ?? "";
    const plans = bootstrapToScenePlans(parsed, project.id, authorId, template);

    status = "Saving project...";
    const result = await actions.createEssayProject(project, bible, plans);

    status = "Done!";
    setTimeout(() => {
      resetTransient();
      selectedTemplateId = null;
      brief = "";
      onProjectCreated(result.project);
    }, 400);
  } catch (err) {
    error = err instanceof Error ? err.message : "Bootstrap failed";
    // Preserve brief + selection so the user can retry.
    status = "";
    streamText = "";
    loading = false;
    if (timerRef) {
      clearInterval(timerRef);
      timerRef = null;
    }
  }
}

// ─── Skip-blank path ──────────────────────────────────────
//
// Creates a project with an empty bible (mode = "essay") and exactly one
// placeholder section plan. The section plan's failureModeToAvoid is a
// non-empty string so checkScenePlanGate passes — this is the Unit 9 R12e
// contract: every seeded scene must pass the gate.

async function handleSkipBlank() {
  if (!selectedTemplate) return;
  const template = selectedTemplate;
  loading = true;
  error = null;

  try {
    const project = buildProjectShell(template);
    // Seed an author persona so every scene plan has a valid
    // povCharacterId — checkScenePlanGate requires it. Mirrors the author
    // persona that bootstrapToBible creates for essay briefs.
    const authorPersona = createEmptyCharacterDossier("Author");
    authorPersona.role = "protagonist";
    const bible = createEmptyBible(project.id, "essay");
    bible.characters = [authorPersona];

    const placeholder = createEmptyScenePlan(project.id);
    placeholder.title = "Section 1";
    // checkScenePlanGate requires non-empty title, povCharacterId,
    // narrativeGoal, and failureModeToAvoid. All four are set here so the
    // scene plan gate passes on the very first render.
    placeholder.povCharacterId = authorPersona.id;
    placeholder.narrativeGoal = "Establish the essay's opening move.";
    placeholder.failureModeToAvoid =
      "Generic section without a clear function. Define what this section should do in the essay.";
    placeholder.chunkDescriptions = [];
    placeholder.chunkCount = 1;
    placeholder.estimatedWordCount = template.defaultWordCountTarget;

    const result = await actions.createEssayProject(project, bible, [placeholder]);
    resetTransient();
    selectedTemplateId = null;
    brief = "";
    onProjectCreated(result.project);
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not create blank essay";
    loading = false;
  }
}
</script>

<Modal {open} onClose={handleCancel}>
  {#snippet header()}Start a new essay{/snippet}

  <div class="template-picker" data-testid="template-picker">
    <section class="templates">
      <h3 class="section-heading">Pick a template</h3>
      <div class="template-cards">
        {#each ESSAY_TEMPLATES as template (template.id)}
          {@const isSelected = selectedTemplateId === template.id}
          <button
            type="button"
            class="template-card"
            class:selected={isSelected}
            data-testid={`template-card-${template.id}`}
            aria-pressed={isSelected}
            disabled={loading}
            onclick={() => handleSelectTemplate(template.id)}
          >
            <div class="template-name">{template.name}</div>
            <div class="template-description">{template.description}</div>
            <div class="template-meta">
              <span>{template.defaultSectionCount[0]}–{template.defaultSectionCount[1]} sections</span>
              <span>·</span>
              <span>
                {template.defaultWordCountTarget[0].toLocaleString()}–{template.defaultWordCountTarget[1].toLocaleString()} words
              </span>
            </div>
          </button>
        {/each}
      </div>
    </section>

    <section class="brief">
      <h3 class="section-heading">Describe your essay</h3>
      {#if !loading}
        <TextArea
          bind:value={brief}
          placeholder={`A few sentences or a short outline. The more specific you are about the argument you want to make, the sharper the opening plan.\n\nExample:\nAn essay arguing that productivity advice fails knowledge workers because it treats creative work like factory output. Opens with a personal anecdote, builds through three counterexamples, closes with a reframed definition.`}
          rows={6}
        />
      {:else}
        <div class="stream-display" data-testid="stream-display">{streamText || "Waiting for first token..."}</div>
      {/if}
    </section>

    {#if loading}
      <div class="status-bar" data-testid="status-bar">
        <Spinner size="sm" />
        <span>{status}</span>
        <span class="status-meta">{elapsed}s · {streamText.length} chars</span>
      </div>
    {/if}

    {#if error}
      <div class="error-wrap" data-testid="template-picker-error">
        <ErrorBanner message={error} />
      </div>
    {/if}
  </div>

  {#snippet footer()}
    <div class="footer-row">
      <button
        type="button"
        class="skip-link"
        data-testid="skip-blank-btn"
        disabled={!canSkip}
        onclick={handleSkipBlank}
      >Skip — start blank</button>
      <div class="spacer"></div>
      <Button onclick={handleCancel} disabled={loading}>Cancel</Button>
      <Button
        variant="primary"
        onclick={handleBootstrap}
        disabled={!canBootstrap}
      >Bootstrap</Button>
    </div>
  {/snippet}
</Modal>

<style>
  .template-picker {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 520px;
    max-width: 680px;
  }
  .section-heading {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 8px 0;
  }
  .template-cards {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .template-card {
    text-align: left;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font: inherit;
  }
  .template-card:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .template-card.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent) inset;
  }
  .template-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .template-name {
    font-size: 13px;
    font-weight: 600;
  }
  .template-description {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
  }
  .template-meta {
    font-size: 10px;
    color: var(--text-muted);
    display: flex;
    gap: 6px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 2px;
  }
  .brief {
    display: flex;
    flex-direction: column;
  }
  .stream-display {
    min-height: 140px;
    max-height: 240px;
    overflow-y: auto;
    padding: 10px 12px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: 11px;
    white-space: pre-wrap;
    color: var(--text-primary);
  }
  .status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--text-secondary);
  }
  .status-meta {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
  }
  .error-wrap {
    max-height: 160px;
    overflow-y: auto;
  }
  .footer-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .spacer {
    flex: 1;
  }
  .skip-link {
    background: none;
    border: none;
    color: var(--text-secondary);
    text-decoration: underline;
    cursor: pointer;
    font-size: 12px;
    padding: 4px 0;
    font: inherit;
  }
  .skip-link:hover:not(:disabled) {
    color: var(--accent);
  }
  .skip-link:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
