import { checkAuditResolutionGate, checkSceneCompletionGate } from "../../gates/index.js";
import type { AuditFlag, Bible, ChapterArc, Chunk, CompilationLog, NarrativeIR, ScenePlan } from "../../types/index.js";
import type { ApiActions } from "./api-actions.js";
import type { ProjectStore } from "./project.svelte.js";

// ─── Result type ─────────────────────────────────────

export type CommandResult<T = void> = { ok: true; value: T } | { ok: false; error: string; gateFailures?: string[] };

function success(): CommandResult<void>;
function success<T>(value: T): CommandResult<T>;
function success<T>(value?: T): CommandResult<T> {
  return { ok: true, value: value as T };
}

function failure(error: string, gateFailures?: string[]): CommandResult<never> {
  return { ok: false, error, gateFailures };
}

// ─── Factory ─────────────────────────────────────────

/**
 * Creates the command layer — the single public write path for all
 * persisted mutations. Wraps store + api-actions and enforces gates.
 *
 * When `actions` is undefined (Storybook / store-only mode), persist
 * calls silently no-op and the store is updated directly as fallback.
 */
export function createCommands(store: ProjectStore, actions?: ApiActions) {
  function handleError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    store.setError(msg);
    return msg;
  }

  // ─── Bible ──────────────────────────────────────

  async function saveBible(bible: Bible): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.saveBible(bible);
      } else {
        store.setBible(bible);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  // ─── Scene Plans ────────────────────────────────

  async function saveScenePlan(plan: ScenePlan, order: number): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.saveScenePlan(plan, order);
      } else if (store.scenes.length > 0) {
        store.addScenePlan(plan);
      } else {
        store.setScenePlan(plan);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  async function updateScenePlan(plan: ScenePlan): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.updateScenePlan(plan);
      } else {
        store.addScenePlan(plan);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  async function saveMultipleScenePlans(plans: ScenePlan[]): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.saveMultipleScenePlans(plans);
      } else {
        store.addMultipleScenePlans(plans);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  // ─── Chapter Arc ────────────────────────────────

  async function saveChapterArc(arc: ChapterArc): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.saveChapterArc(arc);
      } else {
        store.setChapterArc(arc);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  async function updateChapterArc(arc: ChapterArc): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.updateChapterArc(arc);
      } else {
        store.setChapterArc(arc);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  // ─── Chunks ─────────────────────────────────────

  async function saveChunk(chunk: Chunk): Promise<CommandResult> {
    try {
      if (actions) await actions.saveChunk(chunk);
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  async function updateChunk(sceneId: string, index: number, changes: Partial<Chunk>): Promise<CommandResult> {
    try {
      store.updateChunkForScene(sceneId, index, changes);
      const updated = (store.sceneChunks[sceneId] ?? [])[index];
      if (updated && actions) await actions.updateChunk(updated);
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  /**
   * API-only persist — no store mutation. Used for debounced text edits
   * where the store was already updated via `store.updateChunkForScene()`
   * for immediate UI responsiveness.
   */
  async function persistChunk(sceneId: string, index: number): Promise<CommandResult> {
    try {
      const chunk = (store.sceneChunks[sceneId] ?? [])[index];
      if (chunk && actions) await actions.updateChunk(chunk);
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  async function removeChunk(sceneId: string, index: number): Promise<CommandResult> {
    try {
      const chunks = store.sceneChunks[sceneId] ?? [];
      const target = chunks[index];

      // Delete from server first
      if (target && actions) await actions.deleteChunk(target.id);

      // Filter + renumber
      const updated = chunks.filter((_, i) => i !== index).map((c, i) => ({ ...c, sequenceNumber: i }));
      store.setSceneChunks(sceneId, updated);

      // Persist renumbered chunks concurrently
      if (actions) {
        await Promise.all(updated.map((c) => actions.updateChunk(c)));
      }

      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  // ─── Scene Completion (gated) ───────────────────

  async function completeScene(sceneId: string): Promise<CommandResult> {
    try {
      const chunks = store.sceneChunks[sceneId] ?? [];
      const scene = store.scenes.find((s) => s.plan.id === sceneId);
      if (!scene) return failure("Scene not found");

      const completionGate = checkSceneCompletionGate(chunks, scene.plan);
      const auditGate = checkAuditResolutionGate(store.auditFlags);

      if (!completionGate.passed || !auditGate.passed) {
        const gateFailures = [...completionGate.messages, ...auditGate.messages];
        const msg = `Scene cannot be completed: ${gateFailures.join("; ")}`;
        store.setError(msg);
        return failure(msg, gateFailures);
      }

      if (actions) {
        await actions.completeScene(sceneId);
      } else {
        store.completeScene(sceneId);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  // ─── Audit Flags ────────────────────────────────

  async function saveAuditFlags(flags: AuditFlag[]): Promise<CommandResult> {
    try {
      if (actions) await actions.saveAuditFlags(flags);
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  async function resolveAuditFlag(flagId: string, action: string, wasActionable: boolean): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.resolveAuditFlag(flagId, action, wasActionable);
      } else {
        store.resolveAuditFlag(flagId, action, wasActionable);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  async function dismissAuditFlag(flagId: string): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.dismissAuditFlag(flagId);
      } else {
        store.dismissAuditFlag(flagId);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  // ─── Scene IR ───────────────────────────────────

  async function saveSceneIR(sceneId: string, ir: NarrativeIR): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.saveSceneIR(sceneId, ir);
      } else {
        store.setSceneIR(sceneId, ir);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  async function verifySceneIR(sceneId: string): Promise<CommandResult> {
    try {
      if (actions) {
        await actions.verifySceneIR(sceneId);
      } else {
        store.verifySceneIR(sceneId);
      }
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  // ─── Compilation Log ────────────────────────────

  async function saveCompilationLog(log: CompilationLog): Promise<CommandResult> {
    try {
      if (actions) await actions.saveCompilationLog(log);
      return success();
    } catch (err) {
      return failure(handleError(err));
    }
  }

  return {
    saveBible,
    saveScenePlan,
    updateScenePlan,
    saveMultipleScenePlans,
    saveChapterArc,
    updateChapterArc,
    saveChunk,
    updateChunk,
    persistChunk,
    removeChunk,
    completeScene,
    saveAuditFlags,
    resolveAuditFlag,
    dismissAuditFlag,
    saveSceneIR,
    verifySceneIR,
    saveCompilationLog,
  };
}

export type Commands = ReturnType<typeof createCommands>;
