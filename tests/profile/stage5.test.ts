import { describe, expect, it } from "vitest";
import { extractSections } from "../../server/profile/stage5.js";

describe("extractSections", () => {
  it("extracts all three sections", () => {
    const text = `1. THE CORE SENSIBILITY\nA warm writer.\n\n6. HOW TO USE THIS GUIDE\n\nFOR GENERATION:\nWrite warmly.\n\nFOR EDITING:\nCheck cold passages.\n\n7. CONFIDENCE NOTES\nBased on 2 docs.`;
    const { generation, editing, confidence } = extractSections(text);
    expect(generation).toContain("Write warmly");
    expect(editing).toContain("Check cold");
    expect(confidence).toContain("2 docs");
  });
  it("returns fallbacks when sections not found", () => {
    const { generation, editing, confidence } = extractSections("Just text.");
    expect(generation).toBeTruthy();
    expect(editing).toBeTruthy();
    expect(confidence).toBeTruthy();
  });
});
