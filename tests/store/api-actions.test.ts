import { beforeEach, describe, expect, it, vi } from "vitest";
import * as apiClient from "../../src/api/client.js";
import { createApiActions } from "../../src/app/store/api-actions.js";
import { ProjectStore } from "../../src/app/store/project.svelte.js";
import { makeAuditFlag, makeChapterArc, makeChunk, makeNarrativeIR } from "../../src/app/stories/factories.js";
import { createEmptyBible, createEmptyScenePlan } from "../../src/types/index.js";

vi.mock("../../src/api/client.js");

const mockedApi = vi.mocked(apiClient);

describe("createApiActions", () => {
  let store: ProjectStore;
  let actions: ReturnType<typeof createApiActions>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new ProjectStore();
    store.setProject({ id: "proj-1", title: "Test", status: "drafting", createdAt: "", updatedAt: "" });
    actions = createApiActions(store);
  });

  describe("saveBible", () => {
    it("calls API then updates store", async () => {
      const bible = createEmptyBible("proj-1");
      const saved = { ...bible, version: 2 };
      mockedApi.apiSaveBible.mockResolvedValue(saved);

      await actions.saveBible(bible);

      expect(mockedApi.apiSaveBible).toHaveBeenCalledWith(bible);
      expect(store.bible).toEqual(saved);
    });

    it("propagates errors to caller (command layer handles reporting)", async () => {
      mockedApi.apiSaveBible.mockRejectedValue(new Error("DB error"));

      await expect(actions.saveBible(createEmptyBible("proj-1"))).rejects.toThrow("DB error");
    });
  });

  describe("saveScenePlan", () => {
    it("calls API then adds to store", async () => {
      const plan = createEmptyScenePlan("proj-1");
      mockedApi.apiSaveScenePlan.mockResolvedValue(plan);

      await actions.saveScenePlan(plan, 0);

      expect(mockedApi.apiSaveScenePlan).toHaveBeenCalledWith(plan, 0);
      expect(store.scenes).toHaveLength(1);
      expect(store.scenes[0]!.plan.id).toBe(plan.id);
    });
  });

  describe("saveMultipleScenePlans", () => {
    it("calls API for each plan then bulk-adds to store", async () => {
      const plan1 = createEmptyScenePlan("proj-1");
      const plan2 = createEmptyScenePlan("proj-1");
      mockedApi.apiSaveScenePlan.mockImplementation(async (p) => p);

      await actions.saveMultipleScenePlans([plan1, plan2]);

      expect(mockedApi.apiSaveScenePlan).toHaveBeenCalledTimes(2);
      expect(store.scenes).toHaveLength(2);
    });
  });

  describe("saveChapterArc", () => {
    it("calls API then updates store", async () => {
      const arc = makeChapterArc();
      mockedApi.apiSaveChapterArc.mockResolvedValue(arc);

      await actions.saveChapterArc(arc);

      expect(store.chapterArc).toEqual(arc);
    });
  });

  describe("updateChapterArc", () => {
    it("calls update API then updates store", async () => {
      const arc = makeChapterArc();
      mockedApi.apiUpdateChapterArc.mockResolvedValue(arc);

      await actions.updateChapterArc(arc);

      expect(mockedApi.apiUpdateChapterArc).toHaveBeenCalledWith(arc);
      expect(store.chapterArc).toEqual(arc);
    });
  });

  describe("saveChunk", () => {
    it("calls API to persist chunk", async () => {
      const chunk = makeChunk();
      mockedApi.apiSaveChunk.mockResolvedValue(chunk);

      await actions.saveChunk(chunk);

      expect(mockedApi.apiSaveChunk).toHaveBeenCalledWith(chunk);
    });
  });

  describe("updateChunk", () => {
    it("calls API to update chunk", async () => {
      const chunk = makeChunk();
      mockedApi.apiUpdateChunk.mockResolvedValue(chunk);

      await actions.updateChunk(chunk);

      expect(mockedApi.apiUpdateChunk).toHaveBeenCalledWith(chunk);
    });
  });

  describe("completeScene", () => {
    it("calls API then updates store status", async () => {
      const plan = createEmptyScenePlan("proj-1");
      store.addScenePlan(plan);
      mockedApi.apiUpdateSceneStatus.mockResolvedValue(undefined);

      await actions.completeScene(plan.id);

      expect(mockedApi.apiUpdateSceneStatus).toHaveBeenCalledWith(plan.id, "complete");
      expect(store.scenes[0]!.status).toBe("complete");
    });
  });

  describe("saveSceneIR", () => {
    it("calls create API for new IR then updates store", async () => {
      const ir = makeNarrativeIR({ sceneId: "scene-1" });
      mockedApi.apiCreateSceneIR.mockResolvedValue(ir);

      await actions.saveSceneIR("scene-1", ir);

      expect(mockedApi.apiCreateSceneIR).toHaveBeenCalledWith("scene-1", ir);
      expect(store.sceneIRs["scene-1"]).toEqual(ir);
    });
  });

  describe("verifySceneIR", () => {
    it("calls verify API then updates store", async () => {
      const ir = makeNarrativeIR({ sceneId: "scene-1" });
      store.setSceneIR("scene-1", ir);
      mockedApi.apiVerifySceneIR.mockResolvedValue(undefined);

      await actions.verifySceneIR("scene-1");

      expect(mockedApi.apiVerifySceneIR).toHaveBeenCalledWith("scene-1");
      expect(store.sceneIRs["scene-1"]!.verified).toBe(true);
    });
  });

  describe("saveAuditFlags", () => {
    it("calls API to persist flags", async () => {
      const flags = [makeAuditFlag()];
      mockedApi.apiSaveAuditFlags.mockResolvedValue(flags);

      await actions.saveAuditFlags(flags);

      expect(mockedApi.apiSaveAuditFlags).toHaveBeenCalledWith(flags);
    });
  });

  describe("resolveAuditFlag", () => {
    it("calls API then updates store", async () => {
      const flag = makeAuditFlag({ id: "flag-1" });
      store.setAudit([flag], null);
      mockedApi.apiResolveAuditFlag.mockResolvedValue(undefined);

      await actions.resolveAuditFlag("flag-1", "fixed it", true);

      expect(mockedApi.apiResolveAuditFlag).toHaveBeenCalledWith("flag-1", "fixed it", true);
      expect(store.auditFlags[0]!.resolved).toBe(true);
    });
  });

  describe("dismissAuditFlag", () => {
    it("calls resolve API with empty action then dismisses in store", async () => {
      const flag = makeAuditFlag({ id: "flag-2" });
      store.setAudit([flag], null);
      mockedApi.apiResolveAuditFlag.mockResolvedValue(undefined);

      await actions.dismissAuditFlag("flag-2");

      expect(mockedApi.apiResolveAuditFlag).toHaveBeenCalledWith("flag-2", "", false);
      expect(store.auditFlags[0]!.resolved).toBe(true);
    });
  });

  describe("saveCompilationLog", () => {
    it("calls API to persist log", async () => {
      const log = {
        id: "log-1",
        chunkId: "c-1",
        payloadHash: "h",
        ring1Tokens: 100,
        ring2Tokens: 200,
        ring3Tokens: 300,
        totalTokens: 600,
        availableBudget: 1000,
        ring1Contents: [],
        ring2Contents: [],
        ring3Contents: [],
        lintWarnings: [],
        lintErrors: [],
        timestamp: "",
      };
      mockedApi.apiSaveCompilationLog.mockResolvedValue(log);

      await actions.saveCompilationLog(log);

      expect(mockedApi.apiSaveCompilationLog).toHaveBeenCalledWith(log);
    });
  });

  describe("createEssayProject", () => {
    function makeProject(id = "proj-essay-1") {
      return {
        id,
        title: "Opinion Piece",
        status: "drafting" as const,
        createdAt: "",
        updatedAt: "",
      };
    }

    it("persists project -> bible -> chapter arc -> scene plans and populates the store", async () => {
      const project = makeProject();
      const bible = { ...createEmptyBible(project.id, "essay"), projectId: project.id };
      const plan1 = { ...createEmptyScenePlan(project.id), title: "S1", failureModeToAvoid: "x" };
      const plan2 = { ...createEmptyScenePlan(project.id), title: "S2", failureModeToAvoid: "y" };

      mockedApi.apiCreateProject.mockResolvedValue(project);
      mockedApi.apiSaveBible.mockImplementation(async (b) => b);
      mockedApi.apiSaveChapterArc.mockImplementation(async (a) => a);
      mockedApi.apiSaveScenePlan.mockImplementation(async (p) => p);

      const result = await actions.createEssayProject(project, bible, [plan1, plan2]);

      expect(mockedApi.apiCreateProject).toHaveBeenCalledWith(project);
      expect(mockedApi.apiSaveBible).toHaveBeenCalledTimes(1);
      expect(mockedApi.apiSaveChapterArc).toHaveBeenCalledTimes(1);
      expect(mockedApi.apiSaveScenePlan).toHaveBeenCalledTimes(2);
      expect(mockedApi.apiDeleteProject).not.toHaveBeenCalled();

      // Store populated so the composer can render immediately.
      expect(store.project).toEqual(project);
      expect(store.bible?.mode).toBe("essay");
      expect(store.chapterArc).toBeTruthy();
      expect(store.scenes).toHaveLength(2);
      expect(result.project).toEqual(project);
      expect(result.scenePlans).toHaveLength(2);
      // Each persisted plan got the chapterId stamped in.
      expect(mockedApi.apiSaveScenePlan.mock.calls[0]?.[0].chapterId).toBeTruthy();
    });

    it("rolls back the project if bible persistence fails", async () => {
      const project = makeProject("proj-fail-bible");
      const bible = createEmptyBible(project.id, "essay");
      mockedApi.apiCreateProject.mockResolvedValue(project);
      mockedApi.apiSaveBible.mockRejectedValue(new Error("bible write failed"));
      mockedApi.apiDeleteProject.mockResolvedValue(undefined);

      await expect(actions.createEssayProject(project, bible, [])).rejects.toThrow("bible write failed");

      expect(mockedApi.apiCreateProject).toHaveBeenCalledWith(project);
      expect(mockedApi.apiDeleteProject).toHaveBeenCalledWith(project.id);
      expect(mockedApi.apiSaveChapterArc).not.toHaveBeenCalled();
      // Store was NOT populated because persistence didn't complete.
      expect(store.bible).toBeNull();
    });

    it("rolls back if a scene plan save fails midway", async () => {
      const project = makeProject("proj-fail-plan");
      const bible = createEmptyBible(project.id, "essay");
      const plan1 = createEmptyScenePlan(project.id);
      const plan2 = createEmptyScenePlan(project.id);

      mockedApi.apiCreateProject.mockResolvedValue(project);
      mockedApi.apiSaveBible.mockImplementation(async (b) => b);
      mockedApi.apiSaveChapterArc.mockImplementation(async (a) => a);
      mockedApi.apiSaveScenePlan
        .mockImplementationOnce(async (p) => p)
        .mockImplementationOnce(async () => {
          throw new Error("plan 2 persistence failed");
        });
      mockedApi.apiDeleteProject.mockResolvedValue(undefined);

      await expect(actions.createEssayProject(project, bible, [plan1, plan2])).rejects.toThrow(
        "plan 2 persistence failed",
      );

      expect(mockedApi.apiDeleteProject).toHaveBeenCalledWith(project.id);
    });

    it("swallows rollback errors so the original cause surfaces", async () => {
      const project = makeProject("proj-rollback-fails");
      const bible = createEmptyBible(project.id, "essay");
      mockedApi.apiCreateProject.mockResolvedValue(project);
      mockedApi.apiSaveBible.mockRejectedValue(new Error("original bible failure"));
      mockedApi.apiDeleteProject.mockRejectedValue(new Error("rollback also failed"));

      await expect(actions.createEssayProject(project, bible, [])).rejects.toThrow("original bible failure");
    });
  });
});
