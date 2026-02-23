import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createProfileAdjustment,
  deleteProfileAdjustmentsForProject,
  listProfileAdjustments,
  updateProfileAdjustmentStatus,
} from "../../../server/db/repositories/profile-adjustments.js";
import { createSchema } from "../../../server/db/schema.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  createSchema(db);
  // Seed project
  db.prepare("INSERT INTO projects (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
    "p1",
    "Test Project",
    "drafting",
    new Date().toISOString(),
    new Date().toISOString(),
  );
});

afterEach(() => {
  db.close();
});

describe("profile-adjustments repo", () => {
  const baseProposal = {
    projectId: "p1",
    parameter: "defaultTemperature",
    currentValue: 0.8,
    suggestedValue: 0.6,
    rationale: "High edit ratio detected",
    confidence: 0.75,
    evidence: { editedChunkCount: 12, sceneCount: 4, avgEditRatio: 0.45 },
    status: "pending" as const,
  };

  it("creates and retrieves a profile adjustment", () => {
    const created = createProfileAdjustment(db, baseProposal);
    expect(created.id).toBeTruthy();
    expect(created.projectId).toBe("p1");
    expect(created.parameter).toBe("defaultTemperature");
    expect(created.suggestedValue).toBe(0.6);

    const list = listProfileAdjustments(db, "p1");
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(created.id);
  });

  it("filters by status", () => {
    createProfileAdjustment(db, baseProposal);
    createProfileAdjustment(db, { ...baseProposal, status: "accepted" });

    expect(listProfileAdjustments(db, "p1", "pending")).toHaveLength(1);
    expect(listProfileAdjustments(db, "p1", "accepted")).toHaveLength(1);
    expect(listProfileAdjustments(db, "p1")).toHaveLength(2);
  });

  it("updates status", () => {
    const created = createProfileAdjustment(db, baseProposal);
    const ok = updateProfileAdjustmentStatus(db, created.id, "accepted");
    expect(ok).toBe(true);

    const list = listProfileAdjustments(db, "p1", "accepted");
    expect(list).toHaveLength(1);
    expect(list[0]!.status).toBe("accepted");
  });

  it("returns false for non-existent status update", () => {
    expect(updateProfileAdjustmentStatus(db, "nonexistent", "accepted")).toBe(false);
  });

  it("deletes for project", () => {
    createProfileAdjustment(db, baseProposal);
    createProfileAdjustment(db, baseProposal);
    const deleted = deleteProfileAdjustmentsForProject(db, "p1");
    expect(deleted).toBe(2);
    expect(listProfileAdjustments(db, "p1")).toHaveLength(0);
  });

  it("preserves evidence JSON through round-trip", () => {
    createProfileAdjustment(db, baseProposal);
    const list = listProfileAdjustments(db, "p1");
    expect(list[0]!.evidence).toEqual(baseProposal.evidence);
  });
});
