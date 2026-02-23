import { runAudit } from "../../auditor/index.js";
import { checkSubtext } from "../../auditor/subtext.js";
import { extractIR, type IRLLMClient } from "../../ir/extractor.js";
import { callLLM, generateStream } from "../../llm/client.js";
import type { Chunk } from "../../types/index.js";
import { generateId, getCanonicalText } from "../../types/index.js";
import type { Commands } from "./commands.js";
import type { ProjectStore } from "./project.svelte.js";

export function createGenerationActions(store: ProjectStore, commands: Commands) {
  /** Helper: get chunks for a specific scene (avoids activeSceneIndex dependency) */
  function chunksForScene(sceneId: string): Chunk[] {
    return store.sceneChunks[sceneId] ?? [];
  }

  async function generateChunk(pinnedSceneId?: string) {
    const plan = store.activeScenePlan;
    if (!store.compiledPayload || !store.bible || !plan) {
      store.setError("Cannot generate: missing compiled payload, bible, or scene plan");
      return;
    }

    const sceneId = pinnedSceneId ?? plan.id;

    store.setGenerating(true);
    store.setError(null);

    try {
      const chunkId = generateId();
      const chunkIndex = chunksForScene(sceneId).length;
      const pendingChunk: Chunk = {
        id: chunkId,
        sceneId,
        sequenceNumber: chunkIndex,
        generatedText: "",
        payloadHash: generateId(),
        model: store.compiledPayload.model,
        temperature: store.compiledPayload.temperature,
        topP: store.compiledPayload.topP,
        generatedAt: new Date().toISOString(),
        status: "pending",
        editedText: null,
        humanNotes: null,
      };
      store.addChunk(pendingChunk);

      let fullText = "";
      let streamFailed = false;
      let stopReason = "";
      await generateStream(store.compiledPayload, {
        onToken: (text) => {
          fullText += text;
          store.updateChunkForScene(sceneId, chunkIndex, { generatedText: fullText });
        },
        onDone: (usage, reason) => {
          stopReason = reason;
          console.debug("[generation] Stream done:", { stopReason: reason, usage, textLength: fullText.length });
          store.updateChunkForScene(sceneId, chunkIndex, { generatedText: fullText });
        },
        onError: (err) => {
          streamFailed = true;
          store.setError(`Generation failed: ${err}`);
        },
      });

      // Abort if stream errored — don't persist partial/invalid prose
      if (streamFailed) return;

      // Guard: reject empty generation (model may have spent tokens on thinking or hit max_tokens)
      if (!fullText.trim()) {
        const reason =
          stopReason === "max_tokens"
            ? "The model used all output tokens without producing text. Try increasing the output token budget in your generation config."
            : "Generation produced no text. Check server logs for details.";
        store.setError(`Empty generation: ${reason}`);
        store.removeChunkForScene(sceneId, chunkIndex);
        return;
      }

      // Persist the finalized chunk
      const finalChunk = chunksForScene(sceneId)[chunkIndex];
      if (finalChunk) await commands.saveChunk(finalChunk);

      // Run audit on all chunks for this scene
      const allText = [...chunksForScene(sceneId).slice(0, chunkIndex), { ...pendingChunk, generatedText: fullText }]
        .map((c) => getCanonicalText(c))
        .join("\n\n");
      const { flags, metrics } = runAudit(allText, store.bible, sceneId);
      store.setAudit(flags, metrics);

      // Persist audit flags
      await commands.saveAuditFlags(flags);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      store.setGenerating(false);
    }
  }

  function runAuditManual(pinnedSceneId?: string) {
    const plan = store.activeScenePlan;
    if (!store.bible || !plan) {
      store.setError("Cannot audit: missing bible or scene plan");
      return;
    }

    const sceneId = pinnedSceneId ?? plan.id;
    const chunks = chunksForScene(sceneId);
    if (chunks.length === 0) {
      store.setError("Cannot audit: no chunks for this scene");
      return;
    }

    const allText = chunks.map((c) => getCanonicalText(c)).join("\n\n");
    const { flags, metrics } = runAudit(allText, store.bible, sceneId);
    store.setAudit(flags, metrics);
  }

  async function extractSceneIR(pinnedSceneId?: string) {
    const plan = store.activeScenePlan;
    if (!plan) {
      store.setError("Cannot extract IR: no active scene plan");
      return;
    }
    if (!store.bible) {
      store.setError("Cannot extract IR: no bible loaded");
      return;
    }

    const sceneId = pinnedSceneId ?? plan.id;
    const chunks = chunksForScene(sceneId);
    if (chunks.length === 0) {
      store.setError("Cannot extract IR: no chunks for this scene");
      return;
    }

    // Find the plan for the pinned scene (may differ from active)
    const scenePlan = store.scenes.find((s) => s.plan.id === sceneId)?.plan ?? plan;

    store.setExtractingIR(sceneId);
    store.setError(null);

    try {
      const prose = chunks.map((c) => getCanonicalText(c)).join("\n\n");
      if (!prose.trim()) {
        store.setError("Cannot extract IR: all chunks are empty. Generate prose content first.");
        store.setExtractingIR(null);
        return;
      }
      const llmClient: IRLLMClient = {
        call: (systemMessage, userMessage, model, maxTokens, outputSchema) =>
          callLLM(systemMessage, userMessage, model, maxTokens, outputSchema),
      };
      const ir = await extractIR(prose, scenePlan, store.bible, llmClient);
      await commands.saveSceneIR(sceneId, ir);
      store.setIRInspectorOpen(true);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "IR extraction failed");
    } finally {
      store.setExtractingIR(null);
    }
  }

  async function runDeepAudit(pinnedSceneId?: string) {
    const plan = store.activeScenePlan;
    if (!store.bible || !plan) {
      store.setError("Cannot run deep audit: missing bible or scene plan");
      return;
    }

    const sceneId = pinnedSceneId ?? plan.id;
    const chunks = chunksForScene(sceneId);
    if (chunks.length === 0) {
      store.setError("Cannot run deep audit: no chunks for this scene");
      return;
    }

    const scenePlan = store.scenes.find((s) => s.plan.id === sceneId)?.plan ?? plan;

    store.setError(null);

    try {
      const prose = chunks.map((c) => getCanonicalText(c)).join("\n\n");
      const subtextClient = {
        call: (systemMessage: string, userMessage: string, model: string, maxTokens: number) =>
          callLLM(systemMessage, userMessage, model, maxTokens),
      };
      const subtextFlags = await checkSubtext(prose, scenePlan, subtextClient);

      if (subtextFlags.length > 0) {
        const combined = [...store.auditFlags, ...subtextFlags];
        store.setAudit(combined, store.metrics);
        await commands.saveAuditFlags(combined);
      }
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Deep audit failed");
    }
  }

  async function runAutopilot() {
    const plan = store.activeScenePlan;
    if (!plan || !store.compiledPayload || !store.bible) {
      store.setError("Cannot start autopilot: missing scene plan, compiled payload, or bible");
      return;
    }

    // Pin the scene context so switching scenes mid-autopilot can't break the loop
    const sceneId = plan.id;

    store.setAutopilot(true);
    const maxChunks = plan.chunkCount ?? 3;

    try {
      while (chunksForScene(sceneId).length < maxChunks) {
        if (store.autopilotCancelled) break;

        const chunkCountBefore = chunksForScene(sceneId).length;

        // Generate next chunk (pinned to this scene)
        await generateChunk(sceneId);
        if (store.autopilotCancelled) break;

        // If generateChunk removed the empty chunk (guard triggered), stop autopilot
        const chunksAfter = chunksForScene(sceneId);
        if (chunksAfter.length <= chunkCountBefore) {
          // generateChunk failed or produced empty text — error already set
          break;
        }

        // Verify chunk has content before auto-accepting
        const latestChunk = chunksAfter[chunksAfter.length - 1];
        if (!latestChunk || !getCanonicalText(latestChunk).trim()) {
          store.setError("Autopilot stopped: generated chunk has no content.");
          break;
        }

        // Auto-accept the chunk we just generated
        const chunkIndex = chunksAfter.length - 1;
        await commands.updateChunk(sceneId, chunkIndex, { status: "accepted" });
      }

      if (!store.autopilotCancelled) {
        // Gate check + complete via commands (gates enforced inside)
        const result = await commands.completeScene(sceneId);
        if (!result.ok) {
          store.setError(`Autopilot finished but scene cannot be completed: ${result.error}`);
        } else {
          // Auto-extract IR after successful scene completion
          await extractSceneIR(sceneId);
        }
      }
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Autopilot failed");
    } finally {
      store.setAutopilot(false);
    }
  }

  return { generateChunk, runAuditManual, runDeepAudit, extractSceneIR, runAutopilot };
}
