# Agent Cookbook

This document shows how an agent (LLM, script, test harness) can drive the word-compiler essay composer end-to-end using the existing HTTP API and pure TypeScript functions. Every action available in the UI has an agent-reachable equivalent.

## Scope

Covers the essay composer (not the fiction pipeline). The composer exposes these user actions:

1. Create a new essay project (bootstrap or blank)
2. Edit the Brief / Voice / Style (Bible)
3. Generate prose for a section
4. Regenerate a section (with revert window)
5. Edit section prose inline
6. Re-audit after kill-list changes
7. Add / delete / reorder sections
8. Export to Markdown or plaintext

Everything below assumes the server is running at `http://localhost:3001` (`pnpm dev:server`). Pure-function recipes run without a server.

## Recipe 1 — Create an essay project from a brief

The UI path is `TemplatePicker` → bootstrap. The agent path uses the same bootstrap primitives.

### Ingredients

- `buildBootstrapPrompt(brief, template)` in `src/bootstrap/index.ts`
- `ESSAY_TEMPLATES` in `src/bootstrap/index.ts` — `OPINION_PIECE` and `PERSONAL_ESSAY`
- `generateStream(payload, callbacks)` in `src/llm/client.ts`
- `parseBootstrapResponse(text)` in `src/bootstrap/index.ts`
- `bootstrapToBible(parsed, projectId, sourcePrompt, template)` and `bootstrapToScenePlans(parsed, projectId, authorId, template)` in `src/bootstrap/index.ts`
- HTTP: `POST /projects`, `POST /projects/:projectId/bibles`, `POST /chapters`, `POST /scenes`

### Sketch (TypeScript)

```ts
import {
  buildBootstrapPrompt,
  bootstrapToBible,
  bootstrapToScenePlans,
  ESSAY_TEMPLATES,
  parseBootstrapResponse,
} from "../../src/bootstrap/index.js";
import { generateStream } from "../../src/llm/client.js";
import { createEmptyChapterArc, generateId } from "../../src/types/index.js";

async function createEssay(brief: string) {
  const template = ESSAY_TEMPLATES.find((t) => t.id === "opinion-piece")!;

  // 1. Stream the bootstrap. generateStream handles the network; we just
  //    buffer the tokens into a single string.
  const payload = buildBootstrapPrompt(brief, template);
  let fullText = "";
  await generateStream(payload, {
    onToken: (t) => { fullText += t; },
    onDone: () => {},
    onError: (err) => { throw new Error(err); },
  });

  // 2. Parse + validate. On shape mismatch, parseBootstrapResponse returns
  //    { error, rawText } — check for it before proceeding.
  const parsed = parseBootstrapResponse(fullText);
  if ("error" in parsed) throw new Error(parsed.error);

  // 3. Materialize the project + bible + scene plans CLIENT-SIDE. Nothing
  //    hits the server yet.
  const projectId = generateId();
  const bible = bootstrapToBible(parsed, projectId, brief, template);
  const authorId = bible.characters[0]!.id;
  const plans = bootstrapToScenePlans(parsed, projectId, authorId, template);

  // 4. Persist atomically. The order MUST be: project -> bible ->
  //    chapter arc -> scene plans. Every scene plan needs chapterId set.
  //    On any failure after step 1, rollback via `DELETE /projects/:id`.
  const project = await http.post("/projects", {
    id: projectId,
    title: template.name,
    status: "drafting",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  try {
    await http.post(`/projects/${projectId}/bibles`, bible);
    const arc = createEmptyChapterArc(projectId);
    const savedArc = await http.post("/chapters", arc);
    for (let i = 0; i < plans.length; i++) {
      await http.post("/scenes", {
        plan: { ...plans[i], projectId, chapterId: savedArc.id },
        sceneOrder: i,
      });
    }
  } catch (err) {
    await http.delete(`/projects/${projectId}`);
    throw err;
  }

  return project;
}
```

### Shortcut: use `createEssayProject` directly

If you're running inside the same process as the store (e.g. a Svelte test), `src/app/store/api-actions.ts` exports a `createEssayProject` helper that does all of this atomically with rollback. Agents running over HTTP must choreograph the sequence above manually — there is no `POST /projects/essay-bootstrap` endpoint yet.

### Shortcut: skip-blank

Instead of bootstrapping from a brief, create:

- A project shell
- A bible via `createEmptyBible(projectId, "essay")`
- A single author persona character added to `bible.characters`
- One placeholder scene plan with non-empty `title`, `narrativeGoal`, `povCharacterId` (pointing at the author), and `failureModeToAvoid`

Every field is required by `checkScenePlanGate` in `src/gates/index.ts` — the composer won't generate until it passes.

## Recipe 2 — Generate prose for a section

The UI path is `SectionCard` → Generate button → `EssayComposer.handleGenerate` → `generateChunk` in `src/app/store/generation.svelte.ts`.

Because `generateChunk` streams into the store rather than returning a value, agents typically want to replicate the prompt-building + streaming manually.

### Ingredients

- `compilePayload(store, sceneId)` in `src/compiler/` — builds the three-ring context
- `generateStream(payload, callbacks)` — same streaming primitive
- `runAudit(prose, bible, sceneId)` in `src/auditor/index.ts` — pure function, zero dependencies
- HTTP: `GET /projects/:projectId/bibles/latest`, `GET /chapters/:chapterId/scenes`, `GET /scenes/:sceneId/chunks`, `POST /chunks`, `POST /audit-flags`

### Sketch

```ts
// 1. Fetch the scene plan, bible, and prior chunks.
const bible = await http.get(`/projects/${projectId}/bibles/latest`);
const scenePlan = /* pull the target scene from GET /chapters/:chapterId/scenes */;

// 2. Build the compiled payload. In a browser/store context, this is
//    triggered reactively by setActiveScene + compiler.svelte.ts. Agents
//    can call compilePayload() directly.
const payload = compilePayload({ bible, scenePlan, priorChunks: [] });

// 3. Stream the generation into a buffer.
let prose = "";
await generateStream(payload, {
  onToken: (t) => { prose += t; },
  onDone: () => {},
  onError: (err) => { throw new Error(err); },
});

// 4. Persist the new chunk.
await http.post("/chunks", {
  id: generateId(),
  sceneId: scenePlan.id,
  sequenceNumber: 0,
  generatedText: prose,
  payloadHash: generateId(),
  model: payload.model,
  temperature: payload.temperature,
  topP: payload.topP,
  generatedAt: new Date().toISOString(),
  status: "pending",
  editedText: null,
  humanNotes: null,
});

// 5. Run the audit and save any flags.
const { flags, metrics } = runAudit(prose, bible, scenePlan.id);
if (flags.length > 0) await http.post("/audit-flags", flags);
```

The UI's `handleComposerGenerate` in `src/app/App.svelte` does `setActiveScene + tick() + generateChunk` because the store's compiler effect recomputes `compiledPayload` reactively. Agents that call `compilePayload` directly skip that bookkeeping.

## Recipe 3 — Update the Bible (Brief / Voice / Style)

Every Bible field edit in SetupPanel calls `commands.saveBible(updatedBible)` which wraps `POST /projects/:projectId/bibles`. Agents do the same.

### Essay-mode field mappings

The essay composer reuses fiction Bible fields rather than adding new ones:

| UI label | Bible field |
|---|---|
| Thesis | `bible.narrativeRules.subtextPolicy` |
| Audience | `bible.narrativeRules.pov.notes` (labeled line) |
| Tone & Register | `bible.narrativeRules.pov.notes` (labeled line) |
| Kill list | `bible.styleGuide.killList` |
| Structural bans | `bible.styleGuide.structuralBans` |
| Vocab preferences | `bible.styleGuide.vocabularyPreferences` |
| Metaphor domains | `bible.styleGuide.metaphoricRegister` |

When parsing `pov.notes` back out, look for lines beginning with `Audience:` or `Tone & Register:` (see `src/app/components/composer/SetupPanel.svelte` `parseNotes` for the canonical parser).

### Sketch

```ts
const current = await http.get(`/projects/${projectId}/bibles/latest`);
const updated = {
  ...current,
  styleGuide: {
    ...current.styleGuide,
    killList: [...current.styleGuide.killList, { pattern: "leverage", type: "exact" }],
  },
};
await http.post(`/projects/${projectId}/bibles`, updated);
```

## Recipe 4 — Re-audit after kill list changes

When the kill list changes, the composer debounces 300ms and calls `runAudit` per idle-populated section. Agents can replicate this synchronously.

### Sketch

```ts
import { runAudit } from "../../src/auditor/index.js";
import { getCanonicalText } from "../../src/types/index.js";

async function reauditAll(projectId: string, bible: Bible) {
  const scenes = await http.get(`/chapters/${chapterId}/scenes`);
  const allFlags: AuditFlag[] = [];
  for (const scene of scenes) {
    const chunks = await http.get(`/scenes/${scene.plan.id}/chunks`);
    if (chunks.length === 0) continue;
    const prose = chunks.map(getCanonicalText).join("\n\n");
    const { flags } = runAudit(prose, bible, scene.plan.id);
    allFlags.push(...flags);
  }
  if (allFlags.length > 0) await http.post("/audit-flags", allFlags);
}
```

`runAudit` is pure — no store, no DB, no network. Agents embedding the word-compiler codebase can call it directly.

## Recipe 5 — Delete or reorder sections

Two new routes ship with the essay composer:

- `DELETE /scenes/:id` — cascades across `edit_patterns`, `compilation_logs`, `compiled_payloads`, `chunks`, `audit_flags`, `narrative_irs`, and `scene_plans`. Deliberately preserves `significant_edits` for CIPHER voice learning.
- `PATCH /chapters/:chapterId/scenes/reorder` — body `{ orderedIds: string[] }`. Validates permutation completeness before mutating.

### Delete

```ts
await http.delete(`/scenes/${sceneId}`);
```

### Reorder (move section B above A)

```ts
const scenes = await http.get(`/chapters/${chapterId}/scenes`);
const ids = scenes.map((s) => s.plan.id);
// Swap indices 0 and 1
[ids[0], ids[1]] = [ids[1]!, ids[0]!];
await http.patch(`/chapters/${chapterId}/scenes/reorder`, { orderedIds: ids });
```

The server rejects the request with `{ error: "MISMATCHED_IDS" }` if the input set doesn't match the current chapter scenes exactly.

## Recipe 6 — Export

Pure functions, no network:

```ts
import { exportToMarkdown } from "../../src/export/markdown.js";
import { exportToPlaintext } from "../../src/export/plaintext.js";

const markdown = exportToMarkdown(scenes, sceneChunks, chapterArc);
const plaintext = exportToPlaintext(scenes, sceneChunks);
```

`scenes` is an array of `SceneEntry`, `sceneChunks` is a `Record<sceneId, Chunk[]>`, `chapterArc` is optional.

## What's NOT agent-accessible (and why)

A few composer concepts are session-local UI state with no persistence:

- **60s revert window** — revert slots live in `EssayComposer`'s Svelte runes. When the page refreshes, revert is gone. Agents don't need this; they can just not regenerate.
- **FIFO queue** — UX construct for preserving click order under the single-stream constraint (`store.isGenerating`). Agents await their own generations sequentially.
- **Voice nudge banner** — first-time hint that voice profile is empty. Session-local only.

These are correctly UI-only. If you need an agent to enforce the same behavior, implement it in your own script.

## Gotchas

- **Every scene plan needs non-empty `failureModeToAvoid`.** `checkScenePlanGate` blocks generation if it's empty. The bootstrap pipeline and `createEssayProject` already handle this; agents that hand-craft plans must too.
- **Every scene plan needs non-empty `povCharacterId`.** Point it at an author persona character. The bootstrap pipeline creates one; skip-blank creates one; hand-crafted plans must too.
- **`bibles.data` is a JSON blob.** Adding fields to the Bible TypeScript interface is zero-migration — old bibles deserialize with the new field `=== undefined`.
- **`generateStream` streams tokens via callbacks, not a returned iterator.** Buffer them into a string or handle incrementally.
- **The server binds to `127.0.0.1` by default.** Local-first, single-user. No auth, no multi-tenancy.

## V2 ergonomic gaps

This cookbook exists because these endpoints don't yet:

- `POST /projects/essay-bootstrap` — atomic server-side bootstrap with built-in rollback
- `POST /scenes/:sceneId/generate` — one-call generate + persist + audit
- `POST /projects/:projectId/audit` — one-call re-audit across all sections

Agents today can achieve the same outcomes by choreographing the primitives above. If you find yourself writing a lot of glue, that's a signal to promote one of these shortcuts into a server route.
