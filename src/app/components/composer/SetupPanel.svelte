<script lang="ts">
import type { Bible, KillListEntry, VocabPreference } from "../../../types/bible.js";
import { Button, CollapsibleSection, FormField, Input, Select, TextArea } from "../../primitives/index.js";
import type { Commands } from "../../store/commands.js";
import type { ProjectStore } from "../../store/project.svelte.js";
import VoiceProfilePanel from "../VoiceProfilePanel.svelte";

// SetupPanel is a single collapsible panel containing Brief / Voice / Style
// subsections. It is the only place in the essay composer that lets the user
// edit Bible fields outside of the bootstrap modal.
//
// Field reuse (no Bible migration needed):
//   - Thesis              -> bible.narrativeRules.subtextPolicy
//   - Audience            -> bible.narrativeRules.pov.notes  (labeled line)
//   - Tone & Register     -> bible.narrativeRules.pov.notes  (labeled line)
//   - Kill list           -> bible.styleGuide.killList
//   - Structural bans     -> bible.styleGuide.structuralBans
//   - Vocab preferences   -> bible.styleGuide.vocabularyPreferences
//   - Metaphor domains    -> bible.styleGuide.metaphoricRegister
//
// Fiction-only fields (characters, locations, setups, sensory palette,
// paragraph policy, sentence architecture, scene ending policy) are never
// rendered here — they would only confuse the essay user.

let {
  store,
  commands,
  onBibleChange,
}: {
  store: ProjectStore;
  commands: Commands;
  onBibleChange?: () => void;
} = $props();

// ─── Reactive bible reference ────────────────────────────
const bible = $derived(store.bible);

// Default open state: panel is open when thesis is empty/null/undefined,
// collapsed once the user has filled it in. Computed once per mount via
// $derived.by so toggling the panel manually doesn't fight this default.
const initialOpen = $derived.by(() => {
  const thesis = bible?.narrativeRules?.subtextPolicy;
  return thesis === null || thesis === undefined || thesis.trim() === "";
});

// ─── Local edit buffers (Svelte 5: never init $state from a prop ref) ─

// Brief
let thesisDraft = $state("");
let audienceDraft = $state("");
let toneDraft = $state("");

// Style — these mirror the bible arrays and are committed on blur of any
// field within the list (or immediately on add/remove, since those are
// discrete actions, not text edits).
let killListDraft = $state<KillListEntry[]>([]);
let structuralBansDraft = $state<string[]>([]);
let vocabPrefsDraft = $state<VocabPreference[]>([]);
let approvedDomainsDraft = $state<string[]>([]);
let prohibitedDomainsDraft = $state<string[]>([]);

// Track whether any field is currently focused so we don't clobber the user's
// in-progress edits when the bible reactively updates after a save. Driven by
// focusin/focusout on the panel wrapper, which bubble from any descendant.
let isFocused = $state(false);
function handlePanelFocusIn() {
  isFocused = true;
}
function handlePanelFocusOut(e: FocusEvent) {
  // relatedTarget is the element receiving focus; if it's still inside the
  // panel we're just moving between fields, not actually leaving.
  const next = e.relatedTarget as Node | null;
  const current = e.currentTarget as HTMLElement;
  if (next && current.contains(next)) return;
  isFocused = false;
}

// ─── Audience / Tone parsing ─────────────────────────────
//
// pov.notes is a single string. We store Audience and Tone & Register as
// labeled lines so they can be parsed back independently. Lines without a
// known label are treated as "extra" tone notes and concatenated back when
// we re-serialize.

function parseNotes(notes: string | undefined): { audience: string; tone: string } {
  if (!notes) return { audience: "", tone: "" };
  const lines = notes.split(/\n+/);
  let audience = "";
  const toneLines: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const audienceMatch = line.match(/^Audience:\s*(.*)$/i);
    if (audienceMatch && !audience) {
      audience = audienceMatch[1] ?? "";
      continue;
    }
    const toneMatch = line.match(/^(?:Tone|Register|Tone & Register):\s*(.*)$/i);
    if (toneMatch) {
      toneLines.push(toneMatch[1] ?? "");
      continue;
    }
    toneLines.push(line);
  }
  return { audience, tone: toneLines.join("\n") };
}

function serializeNotes(audience: string, tone: string): string | undefined {
  const parts: string[] = [];
  if (audience.trim()) parts.push(`Audience: ${audience.trim()}`);
  if (tone.trim()) parts.push(`Tone & Register: ${tone.trim()}`);
  const joined = parts.join("\n");
  return joined || undefined;
}

// Sync drafts from bible whenever it changes AND no field is currently
// focused. The focus check prevents a save round-trip from blowing away
// what the user is typing in another field.
$effect(() => {
  if (isFocused) return;
  thesisDraft = bible?.narrativeRules?.subtextPolicy ?? "";
  const parsed = parseNotes(bible?.narrativeRules?.pov?.notes);
  audienceDraft = parsed.audience;
  toneDraft = parsed.tone;
  killListDraft = bible?.styleGuide?.killList ? [...bible.styleGuide.killList] : [];
  structuralBansDraft = bible?.styleGuide?.structuralBans ? [...bible.styleGuide.structuralBans] : [];
  vocabPrefsDraft = bible?.styleGuide?.vocabularyPreferences
    ? bible.styleGuide.vocabularyPreferences.map((v) => ({ ...v }))
    : [];
  approvedDomainsDraft = bible?.styleGuide?.metaphoricRegister?.approvedDomains
    ? [...bible.styleGuide.metaphoricRegister.approvedDomains]
    : [];
  prohibitedDomainsDraft = bible?.styleGuide?.metaphoricRegister?.prohibitedDomains
    ? [...bible.styleGuide.metaphoricRegister.prohibitedDomains]
    : [];
});

// ─── Save plumbing ───────────────────────────────────────

function buildUpdatedBible(): Bible | null {
  if (!bible) return null;
  const notes = serializeNotes(audienceDraft, toneDraft);
  const hasMetaphors = approvedDomainsDraft.length > 0 || prohibitedDomainsDraft.length > 0;
  return {
    ...bible,
    narrativeRules: {
      ...bible.narrativeRules,
      subtextPolicy: thesisDraft.trim() ? thesisDraft : null,
      pov: {
        ...bible.narrativeRules.pov,
        ...(notes !== undefined ? { notes } : { notes: undefined }),
      },
    },
    styleGuide: {
      ...bible.styleGuide,
      killList: killListDraft.filter((k) => k.pattern.trim() !== ""),
      structuralBans: structuralBansDraft.filter((b) => b.trim() !== ""),
      vocabularyPreferences: vocabPrefsDraft.filter((v) => v.preferred.trim() && v.insteadOf.trim()),
      metaphoricRegister: hasMetaphors
        ? {
            approvedDomains: approvedDomainsDraft.filter((d) => d.trim() !== ""),
            prohibitedDomains: prohibitedDomainsDraft.filter((d) => d.trim() !== ""),
          }
        : null,
    },
  };
}

async function saveIfChanged() {
  const updated = buildUpdatedBible();
  if (!updated) return;
  const result = await commands.saveBible(updated);
  if (result.ok) {
    onBibleChange?.();
  }
}

// ─── Kill list editor ────────────────────────────────────

function addKillEntry() {
  killListDraft = [...killListDraft, { pattern: "", type: "exact" }];
}
function removeKillEntry(index: number) {
  killListDraft = killListDraft.filter((_, i) => i !== index);
  void saveIfChanged();
}
function updateKillEntryPattern(index: number, pattern: string) {
  killListDraft = killListDraft.map((entry, i) => (i === index ? { ...entry, pattern } : entry));
}
function updateKillEntryType(index: number, type: "exact" | "structural") {
  killListDraft = killListDraft.map((entry, i) => (i === index ? { ...entry, type } : entry));
}

// ─── Structural bans editor ──────────────────────────────

function addStructuralBan() {
  structuralBansDraft = [...structuralBansDraft, ""];
}
function removeStructuralBan(index: number) {
  structuralBansDraft = structuralBansDraft.filter((_, i) => i !== index);
  void saveIfChanged();
}
function updateStructuralBan(index: number, value: string) {
  structuralBansDraft = structuralBansDraft.map((b, i) => (i === index ? value : b));
}

// ─── Vocab preferences editor ────────────────────────────

function addVocabPref() {
  vocabPrefsDraft = [...vocabPrefsDraft, { preferred: "", insteadOf: "" }];
}
function removeVocabPref(index: number) {
  vocabPrefsDraft = vocabPrefsDraft.filter((_, i) => i !== index);
  void saveIfChanged();
}
function updateVocabPref(index: number, patch: Partial<VocabPreference>) {
  vocabPrefsDraft = vocabPrefsDraft.map((v, i) => (i === index ? { ...v, ...patch } : v));
}

// ─── Metaphor domains editors ────────────────────────────

function addApprovedDomain() {
  approvedDomainsDraft = [...approvedDomainsDraft, ""];
}
function removeApprovedDomain(index: number) {
  approvedDomainsDraft = approvedDomainsDraft.filter((_, i) => i !== index);
  void saveIfChanged();
}
function updateApprovedDomain(index: number, value: string) {
  approvedDomainsDraft = approvedDomainsDraft.map((d, i) => (i === index ? value : d));
}

function addProhibitedDomain() {
  prohibitedDomainsDraft = [...prohibitedDomainsDraft, ""];
}
function removeProhibitedDomain(index: number) {
  prohibitedDomainsDraft = prohibitedDomainsDraft.filter((_, i) => i !== index);
  void saveIfChanged();
}
function updateProhibitedDomain(index: number, value: string) {
  prohibitedDomainsDraft = prohibitedDomainsDraft.map((d, i) => (i === index ? value : d));
}
</script>

<div
  class="setup-panel"
  data-testid="setup-panel"
  onfocusin={handlePanelFocusIn}
  onfocusout={handlePanelFocusOut}
>
  <CollapsibleSection summary="Setup: Brief, Voice, Style" open={initialOpen}>
    <div class="subsections">
      <!-- ─── Brief ──────────────────────────────────── -->
      <section class="subsection" data-testid="setup-brief">
        <h3 class="subsection-heading">Brief</h3>

        <FormField label="Thesis">
          <div onfocusout={() => { void saveIfChanged(); }}>
            <TextArea
              bind:value={thesisDraft}
              placeholder="What's the central argument of this piece?"
              rows={3}
            />
          </div>
        </FormField>

        <FormField label="Audience">
          <Input
            bind:value={audienceDraft}
            placeholder="Who is this written for?"
            onblur={() => { void saveIfChanged(); }}
          />
        </FormField>

        <FormField label="Tone & Register">
          <div onfocusout={() => { void saveIfChanged(); }}>
            <TextArea
              bind:value={toneDraft}
              placeholder="Voice, formality, pacing notes…"
              rows={3}
            />
          </div>
        </FormField>
      </section>

      <!-- ─── Voice ──────────────────────────────────── -->
      <section class="subsection" data-testid="setup-voice">
        <h3 class="subsection-heading">Your Writing Voice (shared across all projects)</h3>
        <VoiceProfilePanel />
      </section>

      <!-- ─── Style ──────────────────────────────────── -->
      <section class="subsection" data-testid="setup-style">
        <h3 class="subsection-heading">Style</h3>

        <FormField label="Kill list">
          <div class="list-editor" data-testid="kill-list-editor">
            {#each killListDraft as entry, i (i)}
              <div class="list-row">
                <Input
                  value={entry.pattern}
                  placeholder="Pattern to avoid"
                  oninput={(e) => updateKillEntryPattern(i, (e.target as HTMLInputElement).value)}
                  onblur={() => { void saveIfChanged(); }}
                />
                <Select
                  value={entry.type}
                  onchange={(e) => {
                    updateKillEntryType(i, (e.target as HTMLSelectElement).value as "exact" | "structural");
                    void saveIfChanged();
                  }}
                >
                  <option value="exact">exact</option>
                  <option value="structural">structural</option>
                </Select>
                <button
                  type="button"
                  class="row-remove-btn"
                  aria-label="Remove kill list entry"
                  onclick={() => removeKillEntry(i)}
                >×</button>
              </div>
            {/each}
            <Button size="sm" onclick={addKillEntry}>+ Add pattern</Button>
          </div>
        </FormField>

        <FormField label="Structural bans">
          <div class="list-editor" data-testid="structural-bans-editor">
            {#each structuralBansDraft as ban, i (i)}
              <div class="list-row">
                <div class="row-grow" onfocusout={() => { void saveIfChanged(); }}>
                  <TextArea
                    value={ban}
                    variant="compact"
                    placeholder="Structural pattern to avoid"
                    oninput={(e) => updateStructuralBan(i, (e.target as HTMLTextAreaElement).value)}
                  />
                </div>
                <button
                  type="button"
                  class="row-remove-btn"
                  aria-label="Remove structural ban"
                  onclick={() => removeStructuralBan(i)}
                >×</button>
              </div>
            {/each}
            <Button size="sm" onclick={addStructuralBan}>+ Add ban</Button>
          </div>
        </FormField>

        <FormField label="Vocabulary preferences">
          <div class="list-editor" data-testid="vocab-prefs-editor">
            {#each vocabPrefsDraft as pref, i (i)}
              <div class="list-row">
                <Input
                  value={pref.preferred}
                  placeholder="Use this…"
                  oninput={(e) => updateVocabPref(i, { preferred: (e.target as HTMLInputElement).value })}
                  onblur={() => { void saveIfChanged(); }}
                />
                <span class="vocab-instead">instead of</span>
                <Input
                  value={pref.insteadOf}
                  placeholder="…not this"
                  oninput={(e) => updateVocabPref(i, { insteadOf: (e.target as HTMLInputElement).value })}
                  onblur={() => { void saveIfChanged(); }}
                />
                <button
                  type="button"
                  class="row-remove-btn"
                  aria-label="Remove vocabulary preference"
                  onclick={() => removeVocabPref(i)}
                >×</button>
              </div>
            {/each}
            <Button size="sm" onclick={addVocabPref}>+ Add preference</Button>
          </div>
        </FormField>

        <FormField label="Approved metaphor domains">
          <div class="list-editor" data-testid="approved-domains-editor">
            {#each approvedDomainsDraft as domain, i (i)}
              <div class="list-row">
                <Input
                  value={domain}
                  placeholder="e.g. carpentry, gardening"
                  oninput={(e) => updateApprovedDomain(i, (e.target as HTMLInputElement).value)}
                  onblur={() => { void saveIfChanged(); }}
                />
                <button
                  type="button"
                  class="row-remove-btn"
                  aria-label="Remove approved domain"
                  onclick={() => removeApprovedDomain(i)}
                >×</button>
              </div>
            {/each}
            <Button size="sm" onclick={addApprovedDomain}>+ Add approved domain</Button>
          </div>
        </FormField>

        <FormField label="Prohibited metaphor domains">
          <div class="list-editor" data-testid="prohibited-domains-editor">
            {#each prohibitedDomainsDraft as domain, i (i)}
              <div class="list-row">
                <Input
                  value={domain}
                  placeholder="e.g. war, sports, finance"
                  oninput={(e) => updateProhibitedDomain(i, (e.target as HTMLInputElement).value)}
                  onblur={() => { void saveIfChanged(); }}
                />
                <button
                  type="button"
                  class="row-remove-btn"
                  aria-label="Remove prohibited domain"
                  onclick={() => removeProhibitedDomain(i)}
                >×</button>
              </div>
            {/each}
            <Button size="sm" onclick={addProhibitedDomain}>+ Add prohibited domain</Button>
          </div>
        </FormField>
      </section>
    </div>
  </CollapsibleSection>
</div>

<style>
  .setup-panel {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    padding: 12px;
    margin-bottom: 12px;
  }
  .subsections {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding-top: 8px;
  }
  .subsection {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .subsection-heading {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }
  .list-editor {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .list-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .row-grow {
    flex: 1;
  }
  .vocab-instead {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
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
</style>