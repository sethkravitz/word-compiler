import type Database from "better-sqlite3";
import type { WritingSample } from "../../../src/profile/types.js";

interface WritingSampleRow {
  id: string;
  filename: string | null;
  domain: string | null;
  word_count: number;
  data: string;
  created_at: string;
}

function rowToSample(row: WritingSampleRow): WritingSample {
  return {
    id: row.id,
    filename: row.filename,
    domain: row.domain ?? "",
    wordCount: row.word_count,
    text: row.data,
    createdAt: row.created_at,
  };
}

export function createWritingSampleRecord(db: Database.Database, sample: WritingSample): WritingSample {
  db.prepare(
    `INSERT INTO writing_samples (id, filename, domain, word_count, data, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(sample.id, sample.filename, sample.domain, sample.wordCount, sample.text, sample.createdAt);
  return sample;
}

export function listWritingSamples(db: Database.Database): WritingSample[] {
  const rows = db.prepare("SELECT * FROM writing_samples ORDER BY created_at").all() as WritingSampleRow[];
  return rows.map(rowToSample);
}

export function getWritingSample(db: Database.Database, id: string): WritingSample | null {
  const row = db.prepare("SELECT * FROM writing_samples WHERE id = ?").get(id) as WritingSampleRow | undefined;
  if (!row) return null;
  return rowToSample(row);
}

export function getWritingSamplesByIds(db: Database.Database, ids: string[]): WritingSample[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const rows = db
    .prepare(`SELECT * FROM writing_samples WHERE id IN (${placeholders})`)
    .all(...ids) as WritingSampleRow[];
  return rows.map(rowToSample);
}

export function deleteWritingSample(db: Database.Database, id: string): boolean {
  const result = db.prepare("DELETE FROM writing_samples WHERE id = ?").run(id);
  return result.changes > 0;
}
