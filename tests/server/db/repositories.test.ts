import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import * as auditFlagsRepo from "../../../server/db/repositories/audit-flags.js";
import * as bibles from "../../../server/db/repositories/bibles.js";
import * as chapterArcs from "../../../server/db/repositories/chapter-arcs.js";
import * as chunks from "../../../server/db/repositories/chunks.js";
import * as compilationLogs from "../../../server/db/repositories/compilation-logs.js";
import * as editPatterns from "../../../server/db/repositories/edit-patterns.js";
import * as narrativeIRs from "../../../server/db/repositories/narrative-irs.js";
import * as projects from "../../../server/db/repositories/projects.js";
import * as scenePlans from "../../../server/db/repositories/scene-plans.js";
import { createSchema } from "../../../server/db/schema.js";
import { type CompilationLog, createEmptyNarrativeIR } from "../../../src/types/index.js";
import {
  createEmptyBible,
  createEmptyScenePlan,
  generateId,
  makeAuditFlag,
  makeChapterArc,
  makeChunk,
  makeEditPattern,
  makeProject,
} from "../../helpers/factories.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  createSchema(db);
});

// ─── Projects ─────────────────────────────────────────

describe("projects repository", () => {
  it("creates and retrieves a project", () => {
    const p = makeProject();
    projects.createProject(db, p);
    const found = projects.getProject(db, p.id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe(p.title);
    expect(found!.status).toBe("bootstrap");
  });

  it("lists projects ordered by updated_at desc", () => {
    const p1 = makeProject({ updatedAt: "2024-01-01T00:00:00Z" });
    const p2 = makeProject({ updatedAt: "2024-06-01T00:00:00Z" });
    projects.createProject(db, p1);
    projects.createProject(db, p2);
    const list = projects.listProjects(db);
    expect(list).toHaveLength(2);
    expect(list[0]!.id).toBe(p2.id);
  });

  it("updates a project", () => {
    const p = makeProject();
    projects.createProject(db, p);
    const updated = projects.updateProject(db, p.id, { title: "New Title", status: "drafting" });
    expect(updated!.title).toBe("New Title");
    expect(updated!.status).toBe("drafting");
  });

  it("returns null when updating nonexistent project", () => {
    const result = projects.updateProject(db, "nope", { title: "x" });
    expect(result).toBeNull();
  });

  it("deletes a project", () => {
    const p = makeProject();
    projects.createProject(db, p);
    expect(projects.deleteProject(db, p.id)).toBe(true);
    expect(projects.getProject(db, p.id)).toBeNull();
  });

  it("returns false when deleting nonexistent project", () => {
    expect(projects.deleteProject(db, "nope")).toBe(false);
  });

  it("cascade-deletes all child records", () => {
    const p = makeProject();
    projects.createProject(db, p);

    // Create bible
    const bible = createEmptyBible(p.id);
    bibles.createBible(db, bible);

    // Create chapter + scene + chunk
    const chapter = makeChapterArc(p.id);
    chapterArcs.createChapterArc(db, chapter);
    const scene = { ...createEmptyScenePlan(p.id), chapterId: chapter.id };
    scenePlans.createScenePlan(db, scene, 0);
    const chunk = makeChunk(scene.id, 0);
    chunks.createChunk(db, chunk);

    // Create audit flag
    const flag = makeAuditFlag(scene.id);
    auditFlagsRepo.createAuditFlags(db, [flag]);

    // Create compilation log
    const log: CompilationLog = {
      id: generateId(),
      chunkId: chunk.id,
      payloadHash: "test",
      ring1Tokens: 0,
      ring2Tokens: 0,
      ring3Tokens: 0,
      totalTokens: 0,
      availableBudget: 1000,
      ring1Contents: [],
      ring2Contents: [],
      ring3Contents: [],
      lintWarnings: [],
      lintErrors: [],
      timestamp: new Date().toISOString(),
    };
    compilationLogs.createCompilationLog(db, log);

    // Delete should succeed despite child records
    expect(projects.deleteProject(db, p.id)).toBe(true);
    expect(projects.getProject(db, p.id)).toBeNull();
    expect(bibles.getLatestBible(db, p.id)).toBeNull();
    expect(chunks.getChunk(db, chunk.id)).toBeNull();
  });
});

// ─── Bibles ──────────────────────────────────────────

describe("bibles repository", () => {
  let projectId: string;

  beforeEach(() => {
    const p = makeProject();
    projects.createProject(db, p);
    projectId = p.id;
  });

  it("creates and retrieves latest bible", () => {
    const bible = createEmptyBible(projectId);
    bibles.createBible(db, bible);
    const latest = bibles.getLatestBible(db, projectId);
    expect(latest).not.toBeNull();
    expect(latest!.projectId).toBe(projectId);
    expect(latest!.version).toBe(1);
  });

  it("retrieves specific version", () => {
    const v1 = { ...createEmptyBible(projectId), version: 1 };
    const v2 = { ...createEmptyBible(projectId), version: 2 };
    bibles.createBible(db, v1);
    bibles.createBible(db, v2);
    const found = bibles.getBibleVersion(db, projectId, 1);
    expect(found!.version).toBe(1);
  });

  it("latest returns highest version", () => {
    bibles.createBible(db, { ...createEmptyBible(projectId), version: 1 });
    bibles.createBible(db, { ...createEmptyBible(projectId), version: 3 });
    bibles.createBible(db, { ...createEmptyBible(projectId), version: 2 });
    const latest = bibles.getLatestBible(db, projectId);
    expect(latest!.version).toBe(3);
  });

  it("lists all versions", () => {
    bibles.createBible(db, { ...createEmptyBible(projectId), version: 1 });
    bibles.createBible(db, { ...createEmptyBible(projectId), version: 2 });
    const versions = bibles.listBibleVersions(db, projectId);
    expect(versions).toHaveLength(2);
    expect(versions[0]!.version).toBe(2); // desc order
  });

  it("returns null for nonexistent project", () => {
    expect(bibles.getLatestBible(db, "nope")).toBeNull();
  });

  it("upserts when same (projectId, version) is inserted twice", () => {
    const bible1 = { ...createEmptyBible(projectId), version: 1 };
    bibles.createBible(db, bible1);

    // Insert again with same projectId + version but different data
    const bible2 = {
      ...createEmptyBible(projectId),
      version: 1,
      characters: [
        {
          id: "c1",
          name: "Alice",
          role: "protagonist" as const,
          physicalDescription: null,
          backstory: null,
          selfNarrative: null,
          contradictions: null,
          voice: {
            sentenceLengthRange: null,
            vocabularyNotes: null,
            verbalTics: [],
            metaphoricRegister: null,
            prohibitedLanguage: [],
            dialogueSamples: [],
          },
          behavior: null,
        },
      ],
    };
    // Should NOT throw
    expect(() => bibles.createBible(db, bible2)).not.toThrow();

    // Should have updated the existing row, not created a duplicate
    const versions = bibles.listBibleVersions(db, projectId);
    expect(versions).toHaveLength(1);

    const latest = bibles.getLatestBible(db, projectId);
    expect(latest!.characters).toHaveLength(1);
    expect(latest!.characters[0]!.name).toBe("Alice");
  });
});

// ─── Chapter Arcs ────────────────────────────────────

describe("chapter arcs repository", () => {
  let projectId: string;

  beforeEach(() => {
    const p = makeProject();
    projects.createProject(db, p);
    projectId = p.id;
  });

  it("creates and retrieves a chapter arc", () => {
    const arc = makeChapterArc(projectId);
    chapterArcs.createChapterArc(db, arc);
    const found = chapterArcs.getChapterArc(db, arc.id);
    expect(found!.workingTitle).toBe("Section One");
  });

  it("retrieves by project and chapter number", () => {
    const arc = makeChapterArc(projectId, { chapterNumber: 5 });
    chapterArcs.createChapterArc(db, arc);
    const found = chapterArcs.getChapterArcByProject(db, projectId, 5);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(arc.id);
  });

  it("updates a chapter arc", () => {
    const arc = makeChapterArc(projectId);
    chapterArcs.createChapterArc(db, arc);
    const updated = chapterArcs.updateChapterArc(db, { ...arc, workingTitle: "Updated" });
    expect(updated.workingTitle).toBe("Updated");
    const found = chapterArcs.getChapterArc(db, arc.id);
    expect(found!.workingTitle).toBe("Updated");
  });

  it("lists chapter arcs ordered by chapter_number", () => {
    chapterArcs.createChapterArc(db, makeChapterArc(projectId, { chapterNumber: 3 }));
    chapterArcs.createChapterArc(db, makeChapterArc(projectId, { chapterNumber: 1 }));
    const list = chapterArcs.listChapterArcs(db, projectId);
    expect(list).toHaveLength(2);
    expect(list[0]!.chapterNumber).toBe(1);
  });

  it("upserts when same (projectId, chapterNumber) is inserted twice", () => {
    const arc1 = makeChapterArc(projectId, { chapterNumber: 1, workingTitle: "Original" });
    chapterArcs.createChapterArc(db, arc1);

    const arc2 = makeChapterArc(projectId, { chapterNumber: 1, workingTitle: "Updated Title" });
    expect(() => chapterArcs.createChapterArc(db, arc2)).not.toThrow();

    const list = chapterArcs.listChapterArcs(db, projectId);
    expect(list).toHaveLength(1);

    const found = chapterArcs.getChapterArcByProject(db, projectId, 1);
    expect(found!.workingTitle).toBe("Updated Title");
  });

  it("upsert returns the persisted row id, not the input id", () => {
    const arc1 = makeChapterArc(projectId, { chapterNumber: 1 });
    const saved1 = chapterArcs.createChapterArc(db, arc1);
    expect(saved1.id).toBe(arc1.id);

    const arc2 = makeChapterArc(projectId, { chapterNumber: 1, workingTitle: "Re-bootstrap" });
    expect(arc2.id).not.toBe(arc1.id); // different client-generated id
    const saved2 = chapterArcs.createChapterArc(db, arc2);
    // Must return the original persisted id so FK references remain valid
    expect(saved2.id).toBe(arc1.id);
    expect(saved2.workingTitle).toBe("Re-bootstrap");
  });
});

// ─── Scene Plans ─────────────────────────────────────

describe("scene plans repository", () => {
  let projectId: string;
  let chapterId: string;

  beforeEach(() => {
    const p = makeProject();
    projects.createProject(db, p);
    projectId = p.id;
    const arc = makeChapterArc(projectId);
    chapterArcs.createChapterArc(db, arc);
    chapterId = arc.id;
  });

  it("creates and retrieves a scene plan", () => {
    const plan = { ...createEmptyScenePlan(projectId), chapterId };
    scenePlans.createScenePlan(db, plan, 0);
    const found = scenePlans.getScenePlan(db, plan.id);
    expect(found).not.toBeNull();
    expect(found!.status).toBe("planned");
    expect(found!.sceneOrder).toBe(0);
  });

  it("lists scene plans for a chapter", () => {
    const p1 = { ...createEmptyScenePlan(projectId), chapterId };
    const p2 = { ...createEmptyScenePlan(projectId), chapterId };
    scenePlans.createScenePlan(db, p1, 1);
    scenePlans.createScenePlan(db, p2, 0);
    const list = scenePlans.listScenePlans(db, chapterId);
    expect(list).toHaveLength(2);
    expect(list[0]!.sceneOrder).toBe(0);
  });

  it("updates scene plan data", () => {
    const plan = { ...createEmptyScenePlan(projectId), chapterId, title: "Original" };
    scenePlans.createScenePlan(db, plan, 0);
    scenePlans.updateScenePlan(db, { ...plan, title: "Updated" });
    const found = scenePlans.getScenePlan(db, plan.id);
    expect(found!.plan.title).toBe("Updated");
  });

  it("updates scene status", () => {
    const plan = { ...createEmptyScenePlan(projectId), chapterId };
    scenePlans.createScenePlan(db, plan, 0);
    scenePlans.updateSceneStatus(db, plan.id, "drafting");
    const found = scenePlans.getScenePlan(db, plan.id);
    expect(found!.status).toBe("drafting");
  });

  it("returns false when updating nonexistent scene status", () => {
    expect(scenePlans.updateSceneStatus(db, "nope", "drafting")).toBe(false);
  });

  it("upserts when same scene plan id is inserted twice", () => {
    const plan = { ...createEmptyScenePlan(projectId), chapterId, title: "Original" };
    scenePlans.createScenePlan(db, plan, 0);

    // Insert same plan again with updated data
    const updated = { ...plan, title: "Reloaded" };
    expect(() => scenePlans.createScenePlan(db, updated, 0)).not.toThrow();

    const list = scenePlans.listScenePlans(db, chapterId);
    expect(list).toHaveLength(1);

    const found = scenePlans.getScenePlan(db, plan.id);
    expect(found!.plan.title).toBe("Reloaded");
  });

  // ─── reorderScenePlans ──────────────────────────

  describe("reorderScenePlans", () => {
    function seedScenes(count: number): string[] {
      const ids: string[] = [];
      for (let i = 0; i < count; i++) {
        const plan = { ...createEmptyScenePlan(projectId), chapterId };
        scenePlans.createScenePlan(db, plan, i);
        ids.push(plan.id);
      }
      return ids;
    }

    function readOrder(cId: string): Array<{ id: string; scene_order: number }> {
      return db
        .prepare("SELECT id, scene_order FROM scene_plans WHERE chapter_id = ? ORDER BY scene_order")
        .all(cId) as Array<{ id: string; scene_order: number }>;
    }

    it("reorders scenes to match the supplied permutation", () => {
      const [a, b, c] = seedScenes(3) as [string, string, string];

      const result = scenePlans.reorderScenePlans(db, chapterId, [c, a, b]);

      expect(result).toEqual({ updated: 3 });
      const rows = readOrder(chapterId);
      const order = new Map(rows.map((r) => [r.id, r.scene_order]));
      expect(order.get(c)).toBe(0);
      expect(order.get(a)).toBe(1);
      expect(order.get(b)).toBe(2);
    });

    it("accepts an identity permutation (no visible changes)", () => {
      const ids = seedScenes(3);

      const result = scenePlans.reorderScenePlans(db, chapterId, ids);

      expect(result).toEqual({ updated: 3 });
      const rows = readOrder(chapterId);
      expect(rows.map((r) => r.id)).toEqual(ids);
      expect(rows.map((r) => r.scene_order)).toEqual([0, 1, 2]);
    });

    it("returns MISMATCHED_IDS and does not mutate when an id does not belong to the chapter", () => {
      const [a, b, c] = seedScenes(3) as [string, string, string];

      const result = scenePlans.reorderScenePlans(db, chapterId, [a, b, "stranger-id"]);

      expect(result).toEqual({ error: "MISMATCHED_IDS" });
      // Verify no mutations
      const rows = readOrder(chapterId);
      expect(rows.map((r) => r.id)).toEqual([a, b, c]);
      expect(rows.map((r) => r.scene_order)).toEqual([0, 1, 2]);
    });

    it("returns MISMATCHED_IDS when orderedIds is shorter than the chapter's scenes", () => {
      const [a, b, c] = seedScenes(3) as [string, string, string];

      const result = scenePlans.reorderScenePlans(db, chapterId, [a, b]);

      expect(result).toEqual({ error: "MISMATCHED_IDS" });
      const rows = readOrder(chapterId);
      expect(rows.map((r) => r.id)).toEqual([a, b, c]);
    });

    it("returns MISMATCHED_IDS when orderedIds contains duplicates", () => {
      const [a, b, _c] = seedScenes(3) as [string, string, string];

      const result = scenePlans.reorderScenePlans(db, chapterId, [a, b, a]);

      expect(result).toEqual({ error: "MISMATCHED_IDS" });
      const rows = readOrder(chapterId);
      expect(rows.map((r) => r.scene_order)).toEqual([0, 1, 2]);
    });

    it("returns MISMATCHED_IDS when orderedIds is empty but chapter has scenes", () => {
      seedScenes(2);

      const result = scenePlans.reorderScenePlans(db, chapterId, []);

      expect(result).toEqual({ error: "MISMATCHED_IDS" });
    });

    it("returns { updated: 0 } for an empty chapter with an empty orderedIds", () => {
      const result = scenePlans.reorderScenePlans(db, chapterId, []);
      expect(result).toEqual({ updated: 0 });
    });

    it("does not touch scene_order in other chapters", () => {
      // Chapter A (existing from beforeEach) — 3 scenes
      const [a0, a1, a2] = seedScenes(3) as [string, string, string];

      // Chapter B — 3 more scenes under a second chapter arc
      const otherArc = makeChapterArc(projectId, { chapterNumber: 2 });
      chapterArcs.createChapterArc(db, otherArc);
      const otherChapterId = otherArc.id;
      const otherIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const plan = { ...createEmptyScenePlan(projectId), chapterId: otherChapterId };
        scenePlans.createScenePlan(db, plan, i);
        otherIds.push(plan.id);
      }

      // Reorder chapter A only
      const result = scenePlans.reorderScenePlans(db, chapterId, [a2, a1, a0]);
      expect(result).toEqual({ updated: 3 });

      // Chapter B stays in its original 0/1/2 order
      const otherRows = readOrder(otherChapterId);
      expect(otherRows.map((r) => r.id)).toEqual(otherIds);
      expect(otherRows.map((r) => r.scene_order)).toEqual([0, 1, 2]);
    });
  });

  // ─── deleteScenePlan (cascade) ──────────────────

  describe("deleteScenePlan (cascade)", () => {
    it("returns { deleted: false } when the scene does not exist", () => {
      const result = scenePlans.deleteScenePlan(db, "does-not-exist");
      expect(result.deleted).toBe(false);
      expect(result.cascadeCounts).toEqual({
        chunks: 0,
        compilationLogs: 0,
        compiledPayloads: 0,
        auditFlags: 0,
        narrativeIRs: 0,
        editPatterns: 0,
      });
    });

    it("deletes a scene with zero children and returns zero cascade counts", () => {
      const plan = { ...createEmptyScenePlan(projectId), chapterId };
      scenePlans.createScenePlan(db, plan, 0);

      const result = scenePlans.deleteScenePlan(db, plan.id);

      expect(result.deleted).toBe(true);
      expect(result.cascadeCounts).toEqual({
        chunks: 0,
        compilationLogs: 0,
        compiledPayloads: 0,
        auditFlags: 0,
        narrativeIRs: 0,
        editPatterns: 0,
      });
      expect(scenePlans.getScenePlan(db, plan.id)).toBeNull();
    });

    it("cascades cleanup across every FK-referenced table", () => {
      // Seed: 1 scene, 3 chunks, 2 compilation logs, 2 compiled payloads,
      // 5 audit flags, 1 narrative IR, 4 edit patterns
      const plan = { ...createEmptyScenePlan(projectId), chapterId };
      scenePlans.createScenePlan(db, plan, 0);

      const chunk0 = makeChunk(plan.id, 0);
      const chunk1 = makeChunk(plan.id, 1);
      const chunk2 = makeChunk(plan.id, 2);
      chunks.createChunk(db, chunk0);
      chunks.createChunk(db, chunk1);
      chunks.createChunk(db, chunk2);

      const log1: CompilationLog = {
        id: generateId(),
        chunkId: chunk0.id,
        payloadHash: "h1",
        ring1Tokens: 0,
        ring2Tokens: 0,
        ring3Tokens: 0,
        totalTokens: 0,
        availableBudget: 1000,
        ring1Contents: [],
        ring2Contents: [],
        ring3Contents: [],
        lintWarnings: [],
        lintErrors: [],
        timestamp: new Date().toISOString(),
      };
      const log2: CompilationLog = { ...log1, id: generateId(), chunkId: chunk1.id, payloadHash: "h2" };
      compilationLogs.createCompilationLog(db, log1);
      compilationLogs.createCompilationLog(db, log2);

      // compiled_payloads has no repository — insert directly
      db.prepare("INSERT INTO compiled_payloads (id, chunk_id, data, created_at) VALUES (?, ?, ?, ?)").run(
        generateId(),
        chunk0.id,
        "{}",
        new Date().toISOString(),
      );
      db.prepare("INSERT INTO compiled_payloads (id, chunk_id, data, created_at) VALUES (?, ?, ?, ?)").run(
        generateId(),
        chunk1.id,
        "{}",
        new Date().toISOString(),
      );

      auditFlagsRepo.createAuditFlags(db, [
        makeAuditFlag(plan.id),
        makeAuditFlag(plan.id),
        makeAuditFlag(plan.id),
        makeAuditFlag(plan.id),
        makeAuditFlag(plan.id),
      ]);

      narrativeIRs.createNarrativeIR(db, createEmptyNarrativeIR(plan.id));

      editPatterns.createEditPatterns(db, [
        makeEditPattern({ chunkId: chunk0.id, sceneId: plan.id, projectId }),
        makeEditPattern({ chunkId: chunk0.id, sceneId: plan.id, projectId }),
        makeEditPattern({ chunkId: chunk1.id, sceneId: plan.id, projectId }),
        makeEditPattern({ chunkId: chunk2.id, sceneId: plan.id, projectId }),
      ]);

      // Delete + verify cascade counts
      const result = scenePlans.deleteScenePlan(db, plan.id);

      expect(result.deleted).toBe(true);
      expect(result.cascadeCounts).toEqual({
        chunks: 3,
        compilationLogs: 2,
        compiledPayloads: 2,
        auditFlags: 5,
        narrativeIRs: 1,
        editPatterns: 4,
      });

      // Verify every table is empty for this scene / its chunks
      expect(scenePlans.getScenePlan(db, plan.id)).toBeNull();
      expect(chunks.listChunksForScene(db, plan.id)).toEqual([]);
      expect(auditFlagsRepo.listAuditFlags(db, plan.id)).toEqual([]);
      expect(narrativeIRs.getNarrativeIR(db, plan.id)).toBeNull();
      expect(editPatterns.listEditPatternsForScene(db, plan.id)).toEqual([]);

      for (const chunkId of [chunk0.id, chunk1.id, chunk2.id]) {
        expect(compilationLogs.listCompilationLogs(db, chunkId)).toEqual([]);
        const payloadRows = db
          .prepare("SELECT COUNT(*) as count FROM compiled_payloads WHERE chunk_id = ?")
          .get(chunkId) as { count: number };
        expect(payloadRows.count).toBe(0);
        expect(chunks.getChunk(db, chunkId)).toBeNull();
      }
    });

    it("does not affect unrelated scenes", () => {
      // Two scenes under the same chapter, each with children
      const keepPlan = { ...createEmptyScenePlan(projectId), chapterId };
      const dropPlan = { ...createEmptyScenePlan(projectId), chapterId };
      scenePlans.createScenePlan(db, keepPlan, 0);
      scenePlans.createScenePlan(db, dropPlan, 1);

      const keepChunk = makeChunk(keepPlan.id, 0);
      const dropChunk = makeChunk(dropPlan.id, 0);
      chunks.createChunk(db, keepChunk);
      chunks.createChunk(db, dropChunk);

      auditFlagsRepo.createAuditFlags(db, [makeAuditFlag(keepPlan.id), makeAuditFlag(keepPlan.id)]);
      auditFlagsRepo.createAuditFlags(db, [makeAuditFlag(dropPlan.id)]);

      narrativeIRs.createNarrativeIR(db, createEmptyNarrativeIR(keepPlan.id));
      narrativeIRs.createNarrativeIR(db, createEmptyNarrativeIR(dropPlan.id));

      editPatterns.createEditPatterns(db, [
        makeEditPattern({ chunkId: keepChunk.id, sceneId: keepPlan.id, projectId }),
        makeEditPattern({ chunkId: dropChunk.id, sceneId: dropPlan.id, projectId }),
      ]);

      // Delete only the drop scene
      const result = scenePlans.deleteScenePlan(db, dropPlan.id);
      expect(result.deleted).toBe(true);

      // Keep scene + all its children survive intact
      expect(scenePlans.getScenePlan(db, keepPlan.id)).not.toBeNull();
      expect(chunks.listChunksForScene(db, keepPlan.id)).toHaveLength(1);
      expect(auditFlagsRepo.listAuditFlags(db, keepPlan.id)).toHaveLength(2);
      expect(narrativeIRs.getNarrativeIR(db, keepPlan.id)).not.toBeNull();
      expect(editPatterns.listEditPatternsForScene(db, keepPlan.id)).toHaveLength(1);

      // Drop scene is fully gone
      expect(scenePlans.getScenePlan(db, dropPlan.id)).toBeNull();
      expect(chunks.listChunksForScene(db, dropPlan.id)).toEqual([]);
      expect(narrativeIRs.getNarrativeIR(db, dropPlan.id)).toBeNull();
    });
  });
});

// ─── Chunks ──────────────────────────────────────────

describe("chunks repository", () => {
  let sceneId: string;

  beforeEach(() => {
    const p = makeProject();
    projects.createProject(db, p);
    const arc = makeChapterArc(p.id);
    chapterArcs.createChapterArc(db, arc);
    const plan = { ...createEmptyScenePlan(p.id), chapterId: arc.id };
    scenePlans.createScenePlan(db, plan, 0);
    sceneId = plan.id;
  });

  it("creates and retrieves a chunk", () => {
    const chunk = makeChunk(sceneId, 0);
    chunks.createChunk(db, chunk);
    const found = chunks.getChunk(db, chunk.id);
    expect(found).not.toBeNull();
    expect(found!.generatedText).toBe("Some generated text.");
  });

  it("lists chunks ordered by sequence_number", () => {
    chunks.createChunk(db, makeChunk(sceneId, 2));
    chunks.createChunk(db, makeChunk(sceneId, 0));
    chunks.createChunk(db, makeChunk(sceneId, 1));
    const list = chunks.listChunksForScene(db, sceneId);
    expect(list).toHaveLength(3);
    expect(list[0]!.sequenceNumber).toBe(0);
    expect(list[1]!.sequenceNumber).toBe(1);
    expect(list[2]!.sequenceNumber).toBe(2);
  });

  it("updates chunk data", () => {
    const chunk = makeChunk(sceneId, 0);
    chunks.createChunk(db, chunk);
    chunks.updateChunk(db, { ...chunk, status: "accepted", editedText: "Edited." });
    const found = chunks.getChunk(db, chunk.id);
    expect(found!.status).toBe("accepted");
    expect(found!.editedText).toBe("Edited.");
  });

  it("deletes a chunk", () => {
    const chunk = makeChunk(sceneId, 0);
    chunks.createChunk(db, chunk);
    expect(chunks.deleteChunk(db, chunk.id)).toBe(true);
    expect(chunks.getChunk(db, chunk.id)).toBeNull();
  });

  it("returns false when deleting nonexistent chunk", () => {
    expect(chunks.deleteChunk(db, "nope")).toBe(false);
  });
});

// ─── Audit Flags ─────────────────────────────────────

describe("audit flags repository", () => {
  let sceneId: string;

  beforeEach(() => {
    const p = makeProject();
    projects.createProject(db, p);
    const arc = makeChapterArc(p.id);
    chapterArcs.createChapterArc(db, arc);
    const plan = { ...createEmptyScenePlan(p.id), chapterId: arc.id };
    scenePlans.createScenePlan(db, plan, 0);
    sceneId = plan.id;
  });

  it("creates and lists flags ordered by severity", () => {
    auditFlagsRepo.createAuditFlag(db, makeAuditFlag(sceneId, { severity: "info" }));
    auditFlagsRepo.createAuditFlag(db, makeAuditFlag(sceneId, { severity: "critical" }));
    auditFlagsRepo.createAuditFlag(db, makeAuditFlag(sceneId, { severity: "warning" }));
    const list = auditFlagsRepo.listAuditFlags(db, sceneId);
    expect(list).toHaveLength(3);
    expect(list[0]!.severity).toBe("critical");
    expect(list[1]!.severity).toBe("warning");
    expect(list[2]!.severity).toBe("info");
  });

  it("bulk creates flags", () => {
    const flags = [makeAuditFlag(sceneId), makeAuditFlag(sceneId), makeAuditFlag(sceneId)];
    auditFlagsRepo.createAuditFlags(db, flags);
    expect(auditFlagsRepo.listAuditFlags(db, sceneId)).toHaveLength(3);
  });

  it("resolves a flag as actionable", () => {
    const flag = makeAuditFlag(sceneId);
    auditFlagsRepo.createAuditFlag(db, flag);
    const ok = auditFlagsRepo.resolveAuditFlag(db, flag.id, "Fixed the violation", true);
    expect(ok).toBe(true);
    const list = auditFlagsRepo.listAuditFlags(db, sceneId);
    expect(list[0]!.resolved).toBe(true);
    expect(list[0]!.wasActionable).toBe(true);
    expect(list[0]!.resolvedAction).toBe("Fixed the violation");
  });

  it("resolves a flag as non-actionable (dismissed)", () => {
    const flag = makeAuditFlag(sceneId);
    auditFlagsRepo.createAuditFlag(db, flag);
    auditFlagsRepo.resolveAuditFlag(db, flag.id, "False positive", false);
    const list = auditFlagsRepo.listAuditFlags(db, sceneId);
    expect(list[0]!.wasActionable).toBe(false);
  });

  it("returns false when resolving nonexistent flag", () => {
    expect(auditFlagsRepo.resolveAuditFlag(db, "nope", "x", true)).toBe(false);
  });

  it("computes audit stats correctly", () => {
    const f1 = makeAuditFlag(sceneId, { category: "kill_list" });
    const f2 = makeAuditFlag(sceneId, { category: "kill_list" });
    const f3 = makeAuditFlag(sceneId, { category: "rhythm_monotony" });
    auditFlagsRepo.createAuditFlags(db, [f1, f2, f3]);
    auditFlagsRepo.resolveAuditFlag(db, f1.id, "Fixed", true);
    auditFlagsRepo.resolveAuditFlag(db, f2.id, "False positive", false);

    const stats = auditFlagsRepo.getAuditStats(db, sceneId);
    expect(stats.total).toBe(3);
    expect(stats.resolved).toBe(2);
    expect(stats.actionable).toBe(1);
    expect(stats.dismissed).toBe(1);
    expect(stats.signalToNoiseRatio).toBe(0.5);
    expect(stats.pending).toBe(1);
    expect(stats.nonActionable).toBe(1);
    expect(stats.byCategory.kill_list!.total).toBe(2);
    expect(stats.byCategory.kill_list!.actionable).toBe(1);
    expect(stats.byCategory.rhythm_monotony!.total).toBe(1);
  });

  it("signal-to-noise defaults to 1 when no flags resolved", () => {
    auditFlagsRepo.createAuditFlag(db, makeAuditFlag(sceneId));
    const stats = auditFlagsRepo.getAuditStats(db, sceneId);
    expect(stats.signalToNoiseRatio).toBe(1);
  });
});

// ─── Compilation Logs ────────────────────────────────

describe("compilation logs repository", () => {
  it("creates and retrieves a compilation log", () => {
    const log: CompilationLog = {
      id: generateId(),
      chunkId: "c1",
      payloadHash: "hash",
      ring1Tokens: 100,
      ring2Tokens: 50,
      ring3Tokens: 200,
      totalTokens: 350,
      availableBudget: 198000,
      ring1Contents: ["HEADER", "POV"],
      ring2Contents: [],
      ring3Contents: ["SCENE_CONTRACT"],
      lintWarnings: [],
      lintErrors: [],
      timestamp: new Date().toISOString(),
    };
    compilationLogs.createCompilationLog(db, log);
    const found = compilationLogs.getCompilationLog(db, log.id);
    expect(found).not.toBeNull();
    expect(found!.ring1Tokens).toBe(100);
    expect(found!.ring3Contents).toEqual(["SCENE_CONTRACT"]);
  });

  it("lists logs for a chunk", () => {
    const log1: CompilationLog = {
      id: generateId(),
      chunkId: "c1",
      payloadHash: "h1",
      ring1Tokens: 100,
      ring2Tokens: 0,
      ring3Tokens: 200,
      totalTokens: 300,
      availableBudget: 198000,
      ring1Contents: [],
      ring2Contents: [],
      ring3Contents: [],
      lintWarnings: [],
      lintErrors: [],
      timestamp: "2024-01-01T00:00:00Z",
    };
    const log2: CompilationLog = {
      id: generateId(),
      chunkId: "c1",
      payloadHash: "h2",
      ring1Tokens: 110,
      ring2Tokens: 0,
      ring3Tokens: 210,
      totalTokens: 320,
      availableBudget: 198000,
      ring1Contents: [],
      ring2Contents: [],
      ring3Contents: [],
      lintWarnings: [],
      lintErrors: [],
      timestamp: "2024-02-01T00:00:00Z",
    };
    compilationLogs.createCompilationLog(db, log1);
    compilationLogs.createCompilationLog(db, log2);
    const list = compilationLogs.listCompilationLogs(db, "c1");
    expect(list).toHaveLength(2);
    // Desc order — most recent first
    expect(list[0]!.payloadHash).toBe("h2");
  });
});
