import * as api from "../../api/client.js";
import type {
  AuditFlag,
  Bible,
  ChapterArc,
  Chunk,
  CompilationLog,
  NarrativeIR,
  Project,
  ScenePlan,
} from "../../types/index.js";
import { createEmptyChapterArc } from "../../types/index.js";
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

  async function reorderScenePlans(chapterId: string, orderedIds: string[]): Promise<void> {
    await api.apiReorderScenePlans(chapterId, orderedIds);
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

  /**
   * Atomically materialize a new essay project: project row -> bible ->
   * chapter arc -> N scene plans. On any post-create failure, roll back by
   * deleting the freshly created project.
   *
   * **Rollback coupling note.** Rollback delegates to `apiDeleteProject`,
   * which invokes the server-side `deleteProject` cascade at
   * `server/db/repositories/projects.ts`. That cascade deletes project-scoped
   * tables including `significant_edits` and `preference_statements` —
   * broader than scene-level delete which deliberately preserves them for
   * CIPHER voice-learning continuity. This is safe here because
   * `createEssayProject` is only called on a brand-new project id with no
   * significant_edits yet. Do NOT reuse this helper on existing projects.
   *
   * The caller is responsible for building the inputs via buildBootstrapPrompt
   * + bootstrapToBible + bootstrapToScenePlans (or for skip-blank: an empty
   * bible and a single placeholder scene plan). This helper owns the I/O and
   * the failure recovery; it does not mutate prose or call the LLM.
   *
   * Returns the persisted Project. The bible, chapter arc, and scene plans
   * are written to the store directly so the composer can render immediately
   * after the caller flips the routing branch.
   */
  async function createEssayProject(project: Project, bible: Bible, scenePlans: ScenePlan[]): Promise<Project> {
    const savedProject = await api.apiCreateProject(project);
    try {
      const savedBible = await api.apiSaveBible({ ...bible, projectId: savedProject.id });
      const arc = createEmptyChapterArc(savedProject.id);
      const savedArc = await api.apiSaveChapterArc(arc);
      const plansWithChapter = scenePlans.map((p) => ({
        ...p,
        projectId: savedProject.id,
        chapterId: savedArc.id,
      }));
      const savedPlans: ScenePlan[] = [];
      for (const [i, plan] of plansWithChapter.entries()) {
        const saved = await api.apiSaveScenePlan(plan, i);
        savedPlans.push(saved);
      }
      // Populate the store so the composer can render immediately when the
      // caller flips into the essay route.
      store.setProject(savedProject);
      store.setBible(savedBible);
      store.setChapterArc(savedArc);
      store.addMultipleScenePlans(savedPlans);
      return savedProject;
    } catch (err) {
      // Best-effort rollback. Swallow delete errors so the original cause
      // surfaces to the caller.
      try {
        await api.apiDeleteProject(savedProject.id);
      } catch {
        // Intentionally ignored — surface the original error.
      }
      throw err;
    }
  }

  return {
    saveBible,
    saveScenePlan,
    updateScenePlan,
    deleteScenePlan,
    reorderScenePlans,
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
    createEssayProject,
  };
}

export type ApiActions = ReturnType<typeof createApiActions>;
