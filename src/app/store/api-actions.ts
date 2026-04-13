import * as api from "../../api/client.js";
import type { AuditFlag, Bible, ChapterArc, Chunk, CompilationLog, NarrativeIR, ScenePlan } from "../../types/index.js";
import type { ProjectStore } from "./project.svelte.js";

/**
 * Low-level API + store mutation pairs. Errors propagate to the caller
 * (the command layer) which is responsible for user-facing error reporting
 * via `store.setError()` and returning `CommandResult`.
 */
export function createApiActions(store: ProjectStore) {
  async function saveBible(bible: Bible): Promise<void> {
    const saved = await api.apiSaveBible(bible);
    store.setBible(saved);
  }

  async function saveScenePlan(plan: ScenePlan, sceneOrder: number): Promise<void> {
    const saved = await api.apiSaveScenePlan(plan, sceneOrder);
    store.addScenePlan(saved);
  }

  async function updateScenePlan(plan: ScenePlan): Promise<void> {
    const saved = await api.apiUpdateScenePlan(plan);
    store.addScenePlan(saved); // addScenePlan replaces by id if it already exists
  }

  async function deleteScenePlan(sceneId: string): Promise<void> {
    await api.apiDeleteScenePlan(sceneId);
  }

  async function saveMultipleScenePlans(plans: ScenePlan[]): Promise<void> {
    const saved = await Promise.all(plans.map((plan, i) => api.apiSaveScenePlan(plan, store.scenes.length + i)));
    store.addMultipleScenePlans(saved);
  }

  async function saveChapterArc(arc: ChapterArc): Promise<void> {
    const saved = await api.apiSaveChapterArc(arc);
    store.setChapterArc(saved);
  }

  async function updateChapterArc(arc: ChapterArc): Promise<void> {
    const saved = await api.apiUpdateChapterArc(arc);
    store.setChapterArc(saved);
  }

  async function saveChunk(chunk: Chunk): Promise<void> {
    await api.apiSaveChunk(chunk);
  }

  async function updateChunk(chunk: Chunk): Promise<void> {
    await api.apiUpdateChunk(chunk);
  }

  async function deleteChunk(id: string): Promise<void> {
    await api.apiDeleteChunk(id);
  }

  async function completeScene(sceneId: string): Promise<void> {
    await api.apiUpdateSceneStatus(sceneId, "complete");
    store.completeScene(sceneId);
  }

  async function saveSceneIR(sceneId: string, ir: NarrativeIR): Promise<void> {
    // apiCreateSceneIR uses ON CONFLICT(scene_id) DO UPDATE — safe for re-extraction
    const saved = await api.apiCreateSceneIR(sceneId, ir);
    store.setSceneIR(sceneId, saved);
  }

  async function verifySceneIR(sceneId: string): Promise<void> {
    await api.apiVerifySceneIR(sceneId);
    store.verifySceneIR(sceneId);
  }

  async function saveAuditFlags(flags: AuditFlag[]): Promise<void> {
    await api.apiSaveAuditFlags(flags);
  }

  async function resolveAuditFlag(flagId: string, action: string, wasActionable: boolean): Promise<void> {
    await api.apiResolveAuditFlag(flagId, action, wasActionable);
    store.resolveAuditFlag(flagId, action, wasActionable);
  }

  async function dismissAuditFlag(flagId: string): Promise<void> {
    await api.apiResolveAuditFlag(flagId, "", false);
    store.dismissAuditFlag(flagId);
  }

  async function saveCompilationLog(log: CompilationLog): Promise<void> {
    await api.apiSaveCompilationLog(log);
  }

  return {
    saveBible,
    saveScenePlan,
    updateScenePlan,
    deleteScenePlan,
    saveMultipleScenePlans,
    saveChapterArc,
    updateChapterArc,
    saveChunk,
    updateChunk,
    deleteChunk,
    completeScene,
    saveSceneIR,
    verifySceneIR,
    saveAuditFlags,
    resolveAuditFlag,
    dismissAuditFlag,
    saveCompilationLog,
  };
}

export type ApiActions = ReturnType<typeof createApiActions>;
