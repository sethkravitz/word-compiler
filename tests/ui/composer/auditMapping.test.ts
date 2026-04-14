import { describe, expect, it } from "vitest";
import { mapAuditFlagsToAnnotations } from "../../../src/app/components/composer/auditMapping.js";
import type { KillListEntry } from "../../../src/types/bible.js";
import type { AuditFlag } from "../../../src/types/quality.js";

// ─── Helpers ──────────────────────────────────────────────────────

function makeKillListFlag(pattern: string, overrides: Partial<AuditFlag> = {}): AuditFlag {
  return {
    id: `flag-${pattern}-${Math.random().toString(36).slice(2, 8)}`,
    sceneId: "scene-1",
    severity: "critical",
    category: "kill_list",
    message: `Avoid list violation: "${pattern}" found.`,
    lineReference: "line 1",
    resolved: false,
    resolvedAction: null,
    wasActionable: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────

describe("mapAuditFlagsToAnnotations", () => {
  it("returns [] for empty flags, empty text, empty killList", () => {
    expect(mapAuditFlagsToAnnotations([], "", [])).toEqual([]);
  });

  it("returns [] when there are no flags even if killList is populated", () => {
    const killList: KillListEntry[] = [{ pattern: "delve", type: "exact" }];
    expect(mapAuditFlagsToAnnotations([], "some text", killList)).toEqual([]);
  });

  it("returns [] when flag pattern is not present in the text", () => {
    const flag = makeKillListFlag("delve");
    const result = mapAuditFlagsToAnnotations([flag], "hello world", []);
    expect(result).toEqual([]);
  });

  it("produces one annotation for a single kill_list match", () => {
    const flag = makeKillListFlag("delve");
    const text = "we delve deeper";
    const result = mapAuditFlagsToAnnotations([flag], text, []);
    expect(result).toHaveLength(1);
    const ann = result[0]!;
    expect(ann.charRange).toEqual({ start: 3, end: 8 });
    expect(ann.anchor.focus).toBe("delve");
    expect(ann.severity).toBe("critical");
    expect(ann.category).toBe("kill_list");
    expect(ann.suggestion).toBeNull();
  });

  it("produces one annotation per text match when the auditor emits multiple flags", () => {
    // The auditor emits one flag per text occurrence (src/auditor/index.ts:34-48).
    // With two flags both parsing to "delve", de-duplication keeps one per span,
    // but since there are two distinct text spans, both become annotations.
    const flag1 = makeKillListFlag("delve", { id: "f1" });
    const flag2 = makeKillListFlag("delve", { id: "f2" });
    const text = "delve into the delve";
    const result = mapAuditFlagsToAnnotations([flag1, flag2], text, []);
    expect(result).toHaveLength(2);
    const starts = result.map((a) => a.charRange.start).sort((a, b) => a - b);
    expect(starts).toEqual([0, 15]);
    expect(result.every((a) => a.anchor.focus === "delve")).toBe(true);
  });

  it("matches case-insensitively", () => {
    const flag = makeKillListFlag("DELVE");
    const text = "delve into things";
    const result = mapAuditFlagsToAnnotations([flag], text, []);
    expect(result).toHaveLength(1);
    expect(result[0]!.charRange).toEqual({ start: 0, end: 5 });
    expect(result[0]!.anchor.focus).toBe("delve");
  });

  it("escapes regex metacharacters so patterns match literally", () => {
    const flag = makeKillListFlag("a.b");
    const text = "a.b and aXb";
    const result = mapAuditFlagsToAnnotations([flag], text, []);
    expect(result).toHaveLength(1);
    expect(result[0]!.charRange).toEqual({ start: 0, end: 3 });
    expect(result[0]!.anchor.focus).toBe("a.b");
  });

  it("skips resolved flags", () => {
    const flag = makeKillListFlag("delve", { resolved: true });
    const result = mapAuditFlagsToAnnotations([flag], "we delve deeper", []);
    expect(result).toEqual([]);
  });

  it("skips rhythm_monotony category flags", () => {
    const flag: AuditFlag = {
      ...makeKillListFlag("ignored"),
      category: "rhythm_monotony",
      message: "Sentence length variance is low.",
    };
    const result = mapAuditFlagsToAnnotations([flag], "we delve deeper", []);
    expect(result).toEqual([]);
  });

  it("skips paragraph_length category flags", () => {
    const flag: AuditFlag = {
      ...makeKillListFlag("ignored"),
      category: "paragraph_length",
      message: "Paragraph too long.",
    };
    const result = mapAuditFlagsToAnnotations([flag], "we delve deeper", []);
    expect(result).toEqual([]);
  });

  it("de-duplicates annotations pointing at the same span", () => {
    // Two flags for the same pattern on a text with only one occurrence.
    // Both parse to "delve" + match at position 3, so only one annotation emits.
    const flag1 = makeKillListFlag("delve", { id: "f1" });
    const flag2 = makeKillListFlag("delve", { id: "f2" });
    const text = "we delve deeper";
    const result = mapAuditFlagsToAnnotations([flag1, flag2], text, []);
    expect(result).toHaveLength(1);
    expect(result[0]!.charRange).toEqual({ start: 3, end: 8 });
  });

  it("produces stable ids and fingerprints across repeated calls", () => {
    const flag = makeKillListFlag("delve");
    const text = "we delve deeper and delve again";
    const first = mapAuditFlagsToAnnotations([flag], text, []);
    const second = mapAuditFlagsToAnnotations([flag], text, []);
    expect(first.map((a) => a.id)).toEqual(second.map((a) => a.id));
    expect(first.map((a) => a.fingerprint)).toEqual(second.map((a) => a.fingerprint));
  });

  it("fingerprints differ when sceneId differs for the same span", () => {
    const flagA = makeKillListFlag("delve", { sceneId: "scene-a" });
    const flagB = makeKillListFlag("delve", { sceneId: "scene-b" });
    const text = "we delve deeper";
    const [annA] = mapAuditFlagsToAnnotations([flagA], text, []);
    const [annB] = mapAuditFlagsToAnnotations([flagB], text, []);
    expect(annA).toBeDefined();
    expect(annB).toBeDefined();
    expect(annA!.fingerprint).not.toBe(annB!.fingerprint);
    expect(annA!.id).not.toBe(annB!.id);
  });

  it("builds anchor prefix/focus/suffix around the match", () => {
    const text = "The quick brown fox jumps over the lazy dog near a pond.";
    // "jumps" is at index 20-25
    const flag = makeKillListFlag("jumps");
    const [ann] = mapAuditFlagsToAnnotations([flag], text, []);
    expect(ann).toBeDefined();
    expect(ann!.charRange).toEqual({ start: 20, end: 25 });
    expect(ann!.anchor.focus).toBe("jumps");
    // Prefix is up to ~20 chars before
    expect(ann!.anchor.prefix).toBe(text.slice(0, 20));
    // Suffix is up to ~20 chars after
    expect(ann!.anchor.suffix).toBe(text.slice(25, 45));
  });

  it("anchor prefix is truncated near the start of text", () => {
    const text = "delve deeper into the unknown";
    const flag = makeKillListFlag("delve");
    const [ann] = mapAuditFlagsToAnnotations([flag], text, []);
    expect(ann!.anchor.prefix).toBe(""); // at position 0, no prefix
    expect(ann!.anchor.focus).toBe("delve");
  });

  it("gracefully skips flags whose message does not match the canonical format", () => {
    const flag: AuditFlag = {
      ...makeKillListFlag("ignored"),
      message: "Some unexpected format that does not match.",
    };
    const result = mapAuditFlagsToAnnotations([flag], "we delve deeper", []);
    expect(result).toEqual([]);
    // And does not throw — which reaching this line proves.
  });

  it("every emitted annotation has critical severity", () => {
    const flags = [makeKillListFlag("delve"), makeKillListFlag("a sense of")];
    const text = "we delve deeper with a sense of urgency";
    const result = mapAuditFlagsToAnnotations(flags, text, []);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((a) => a.severity === "critical")).toBe(true);
  });

  it("handles multiple distinct patterns in one call", () => {
    const flag1 = makeKillListFlag("delve");
    const flag2 = makeKillListFlag("a sense of");
    const text = "we delve into a sense of dread";
    const result = mapAuditFlagsToAnnotations([flag1, flag2], text, []);
    expect(result).toHaveLength(2);
    const focuses = result.map((a) => a.anchor.focus).sort();
    expect(focuses).toEqual(["a sense of", "delve"]);
  });

  it("returns [] for empty text regardless of flags", () => {
    const flag = makeKillListFlag("delve");
    expect(mapAuditFlagsToAnnotations([flag], "", [])).toEqual([]);
  });
});
