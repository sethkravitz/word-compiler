import { describe, expect, it } from "vitest";
import {
  applyGenreTemplate,
  GENRE_TEMPLATES,
  LITERARY_FICTION,
  ROMANCE,
  SCI_FI,
  THRILLER,
} from "../../src/bootstrap/genres.js";
import type { Bible } from "../../src/types/index.js";
import { createEmptyBible } from "../../src/types/index.js";

function makeBible(): Bible {
  return createEmptyBible("p1");
}

describe("genre templates", () => {
  it("all templates have required fields", () => {
    for (const tmpl of GENRE_TEMPLATES) {
      expect(tmpl.id).toBeTruthy();
      expect(tmpl.name).toBeTruthy();
      expect(tmpl.description).toBeTruthy();
      expect(tmpl.bible).toBeTruthy();
      expect(tmpl.bible.killList).toBeTruthy();
      expect(tmpl.bible.killList!.length).toBeGreaterThan(0);
    }
  });

  it("exports 4 templates", () => {
    expect(GENRE_TEMPLATES).toHaveLength(4);
    const ids = GENRE_TEMPLATES.map((t) => t.id);
    expect(ids).toContain("literary-fiction");
    expect(ids).toContain("thriller");
    expect(ids).toContain("romance");
    expect(ids).toContain("sci-fi");
  });

  it("each template has metaphoric register", () => {
    for (const tmpl of GENRE_TEMPLATES) {
      expect(tmpl.bible.metaphoricRegister).toBeTruthy();
      expect(tmpl.bible.metaphoricRegister!.approvedDomains!.length).toBeGreaterThan(0);
    }
  });
});

describe("applyGenreTemplate", () => {
  it("fills empty killList from template", () => {
    const bible = makeBible();
    const updated = applyGenreTemplate(bible, LITERARY_FICTION);
    expect(updated.styleGuide.killList.length).toBeGreaterThan(0);
    expect(updated.styleGuide.killList[0]!.pattern).toBe("suddenly");
  });

  it("does NOT overwrite existing killList", () => {
    const bible = makeBible();
    bible.styleGuide.killList = [{ pattern: "my-custom-ban", type: "exact" }];
    const updated = applyGenreTemplate(bible, LITERARY_FICTION);
    expect(updated.styleGuide.killList).toHaveLength(1);
    expect(updated.styleGuide.killList[0]!.pattern).toBe("my-custom-ban");
  });

  it("does not mutate original bible", () => {
    const bible = makeBible();
    const original = structuredClone(bible);
    applyGenreTemplate(bible, THRILLER);
    expect(bible).toEqual(original);
  });

  it("fills metaphoric register when null", () => {
    const bible = makeBible();
    expect(bible.styleGuide.metaphoricRegister).toBeNull();
    const updated = applyGenreTemplate(bible, ROMANCE);
    expect(updated.styleGuide.metaphoricRegister).toBeTruthy();
    expect(updated.styleGuide.metaphoricRegister!.approvedDomains.length).toBeGreaterThan(0);
  });

  it("does NOT overwrite existing metaphoric register", () => {
    const bible = makeBible();
    bible.styleGuide.metaphoricRegister = {
      approvedDomains: ["custom"],
      prohibitedDomains: [],
    };
    const updated = applyGenreTemplate(bible, LITERARY_FICTION);
    expect(updated.styleGuide.metaphoricRegister!.approvedDomains).toEqual(["custom"]);
  });

  it("fills sentence architecture when null", () => {
    const bible = makeBible();
    const updated = applyGenreTemplate(bible, THRILLER);
    expect(updated.styleGuide.sentenceArchitecture).toBeTruthy();
    expect(updated.styleGuide.sentenceArchitecture!.fragmentPolicy).toContain("frequent");
  });

  it("fills paragraph policy when null", () => {
    const bible = makeBible();
    const updated = applyGenreTemplate(bible, SCI_FI);
    expect(updated.styleGuide.paragraphPolicy).toBeTruthy();
    expect(updated.styleGuide.paragraphPolicy!.maxSentences).toBe(5);
  });

  it("fills structural bans when empty", () => {
    const bible = makeBible();
    const updated = applyGenreTemplate(bible, LITERARY_FICTION);
    expect(updated.styleGuide.structuralBans.length).toBeGreaterThan(0);
  });

  it("does NOT overwrite existing structural bans", () => {
    const bible = makeBible();
    bible.styleGuide.structuralBans = ["my ban"];
    const updated = applyGenreTemplate(bible, LITERARY_FICTION);
    expect(updated.styleGuide.structuralBans).toEqual(["my ban"]);
  });

  it("fills subtext policy when null", () => {
    const bible = makeBible();
    const updated = applyGenreTemplate(bible, LITERARY_FICTION);
    expect(updated.narrativeRules.subtextPolicy).toBeTruthy();
  });

  it("fills exposition policy when null", () => {
    const bible = makeBible();
    const updated = applyGenreTemplate(bible, ROMANCE);
    expect(updated.narrativeRules.expositionPolicy).toBeTruthy();
  });

  it("does NOT overwrite existing subtext policy", () => {
    const bible = makeBible();
    bible.narrativeRules.subtextPolicy = "my policy";
    const updated = applyGenreTemplate(bible, LITERARY_FICTION);
    expect(updated.narrativeRules.subtextPolicy).toBe("my policy");
  });

  it("fills POV interiority when at default", () => {
    const bible = makeBible();
    const updated = applyGenreTemplate(bible, ROMANCE);
    // Romance template sets interiority to "stream"
    expect(updated.narrativeRules.pov.interiority).toBe("stream");
  });

  it("produces valid Bible structures for all templates", () => {
    for (const tmpl of GENRE_TEMPLATES) {
      const bible = makeBible();
      const updated = applyGenreTemplate(bible, tmpl);
      expect(updated.projectId).toBe("p1");
      expect(updated.version).toBe(1);
      expect(updated.styleGuide).toBeTruthy();
      expect(updated.narrativeRules).toBeTruthy();
    }
  });
});
