import type Database from "better-sqlite3";
import type { ScenePlan } from "../../../src/types/index.js";
import { safeJsonParse } from "../helpers.js";

type SceneStatus = "planned" | "drafting" | "complete";

export function createScenePlan(db: Database.Database, plan: ScenePlan, sceneOrder: number): ScenePlan {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO scene_plans (id, project_id, chapter_id, scene_order, status, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       project_id = excluded.project_id,
       chapter_id = excluded.chapter_id,
       scene_order = excluded.scene_order,
       data = excluded.data,
       updated_at = excluded.updated_at`,
  ).run(plan.id, plan.projectId, plan.chapterId ?? null, sceneOrder, "planned", JSON.stringify(plan), now, now);
  return plan;
}

export function getScenePlan(
  db: Database.Database,
  id: string,
): { plan: ScenePlan; status: SceneStatus; sceneOrder: number } | null {
  const row = db.prepare("SELECT data, status, scene_order FROM scene_plans WHERE id = ?").get(id) as
    | { data: string; status: SceneStatus; scene_order: number }
    | undefined;
  if (!row) return null;
  const plan = safeJsonParse<ScenePlan>(row.data, "scene_plans.getScenePlan");
  if (!plan) return null;
  return { plan, status: row.status, sceneOrder: row.scene_order };
}

export function listScenePlans(
  db: Database.Database,
  chapterId: string,
): Array<{ plan: ScenePlan; status: SceneStatus; sceneOrder: number }> {
  const rows = db
    .prepare(`SELECT data, status, scene_order FROM scene_plans WHERE chapter_id = ? ORDER BY scene_order`)
    .all(chapterId) as Array<{ data: string; status: SceneStatus; scene_order: number }>;
  return rows
    .map((r) => {
      const plan = safeJsonParse<ScenePlan>(r.data, "scene_plans.listScenePlans");
      if (!plan) return null;
      return { plan, status: r.status, sceneOrder: r.scene_order };
    })
    .filter((r): r is { plan: ScenePlan; status: SceneStatus; sceneOrder: number } => r !== null);
}

export function updateScenePlan(db: Database.Database, plan: ScenePlan): ScenePlan {
  const now = new Date().toISOString();
  db.prepare(`UPDATE scene_plans SET data = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(plan), now, plan.id);
  return plan;
}

export function updateSceneStatus(db: Database.Database, id: string, status: SceneStatus): boolean {
  const now = new Date().toISOString();
  const result = db.prepare(`UPDATE scene_plans SET status = ?, updated_at = ? WHERE id = ?`).run(status, now, id);
  return result.changes > 0;
}

export interface SceneCascadeCounts {
  chunks: number;
  compilationLogs: number;
  compiledPayloads: number;
  auditFlags: number;
  narrativeIRs: number;
  editPatterns: number;
}

export interface DeleteScenePlanResult {
  deleted: boolean;
  cascadeCounts: SceneCascadeCounts;
}

/**
 * Deletes a scene plan and cascades cleanup across every FK-referenced
 * table. Mirrors `deleteProject` at scene-plan scope.
 *
 * Order matters because `foreign_keys = ON`:
 *   1. `edit_patterns` first — its FK references both chunks and scene_plans
 *   2. `compilation_logs` + `compiled_payloads` per chunk (no FK, safe either order)
 *   3. `chunks` (FK → scene_plans)
 *   4. `audit_flags` + `narrative_irs` (FK → scene_plans)
 *   5. `scene_plans` row itself
 *
 * Wrapped in a transaction so any failure rolls back the entire delete.
 */
export type ReorderScenePlansResult = { updated: number } | { error: "MISMATCHED_IDS" };

/**
 * Batch-reorder all scene plans in a chapter.
 *
 * `orderedIds` MUST be a complete permutation of every scene id currently in
 * the chapter — no additions, no removals, no duplicates. Partial reorders are
 * rejected on purpose: callers pass the full ordered list so validation is a
 * simple set comparison.
 *
 * On validation failure, returns `{ error: "MISMATCHED_IDS" }` WITHOUT mutating
 * any rows. On success, updates every scene's `scene_order` to its index in
 * `orderedIds` inside a single transaction.
 */
export function reorderScenePlans(
  db: Database.Database,
  chapterId: string,
  orderedIds: string[],
): ReorderScenePlansResult {
  // Validation + mutation share a single transaction so a concurrent DELETE
  // between the SELECT and the UPDATEs cannot slip a stale id past the
  // permutation check. better-sqlite3 serializes per-connection, so the
  // enclosing transaction is also a serializability boundary.
  const run = db.transaction((ids: string[]): ReorderScenePlansResult => {
    const existing = (
      db.prepare("SELECT id FROM scene_plans WHERE chapter_id = ?").all(chapterId) as Array<{
        id: string;
      }>
    ).map((r) => r.id);

    // Validation: same length, no duplicates in input, identical set membership.
    if (existing.length !== ids.length) {
      return { error: "MISMATCHED_IDS" };
    }
    const inputSet = new Set(ids);
    if (inputSet.size !== ids.length) {
      // duplicates in ids
      return { error: "MISMATCHED_IDS" };
    }
    for (const id of existing) {
      if (!inputSet.has(id)) {
        return { error: "MISMATCHED_IDS" };
      }
    }

    const stmt = db.prepare("UPDATE scene_plans SET scene_order = ?, updated_at = ? WHERE id = ?");
    const now = new Date().toISOString();
    for (let i = 0; i < ids.length; i++) {
      stmt.run(i, now, ids[i]);
    }
    return { updated: ids.length };
  });

  return run(orderedIds);
}

export function deleteScenePlan(db: Database.Database, sceneId: string): DeleteScenePlanResult {
  const run = db.transaction((id: string): DeleteScenePlanResult => {
    const counts: SceneCascadeCounts = {
      chunks: 0,
      compilationLogs: 0,
      compiledPayloads: 0,
      auditFlags: 0,
      narrativeIRs: 0,
      editPatterns: 0,
    };

    const sceneExists = db.prepare("SELECT 1 FROM scene_plans WHERE id = ?").get(id);
    if (!sceneExists) {
      return { deleted: false, cascadeCounts: counts };
    }

    const chunkIds = (db.prepare("SELECT id FROM chunks WHERE scene_id = ?").all(id) as Array<{ id: string }>).map(
      (r) => r.id,
    );

    // 1. Delete edit_patterns for this scene BEFORE chunks (FK to chunks(id) + scene_plans(id))
    const editPatternsResult = db.prepare("DELETE FROM edit_patterns WHERE scene_id = ?").run(id);
    counts.editPatterns = editPatternsResult.changes;

    // 2. Delete chunk-scoped leaf tables (no FK constraints, but cleans orphans)
    const logStmt = db.prepare("DELETE FROM compilation_logs WHERE chunk_id = ?");
    const payloadStmt = db.prepare("DELETE FROM compiled_payloads WHERE chunk_id = ?");
    for (const chunkId of chunkIds) {
      counts.compilationLogs += logStmt.run(chunkId).changes;
      counts.compiledPayloads += payloadStmt.run(chunkId).changes;
    }

    // 3. Delete chunks (FK → scene_plans)
    const chunksResult = db.prepare("DELETE FROM chunks WHERE scene_id = ?").run(id);
    counts.chunks = chunksResult.changes;

    // 4. Delete remaining scene-scoped tables (FK → scene_plans)
    counts.auditFlags = db.prepare("DELETE FROM audit_flags WHERE scene_id = ?").run(id).changes;
    counts.narrativeIRs = db.prepare("DELETE FROM narrative_irs WHERE scene_id = ?").run(id).changes;

    // 5. Finally, delete the scene_plans row itself
    const sceneResult = db.prepare("DELETE FROM scene_plans WHERE id = ?").run(id);

    return { deleted: sceneResult.changes > 0, cascadeCounts: counts };
  });

  return run(sceneId);
}
