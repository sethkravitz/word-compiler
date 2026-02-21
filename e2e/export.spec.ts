import { expect, test, type Page } from "@playwright/test";
import { mockStartup } from "./helpers.js";

const PROJECT_ID = "proj-e2e-test";
const CHAPTER_ID = "ch-e2e-1";
const SCENE_ID = "scene-e2e-1";

const MOCK_CHAPTER = {
  id: CHAPTER_ID,
  projectId: PROJECT_ID,
  chapterNumber: 1,
  workingTitle: "The Letter",
  narrativeFunction: "Inciting incident",
  dominantRegister: "Restrained",
  pacingTarget: "Slow build",
  endingPosture: "Cliffhanger",
  readerStateEntering: { knows: [], suspects: [], wrongAbout: [], activeTensions: [] },
  readerStateExiting: { knows: [], suspects: [], wrongAbout: [], activeTensions: [] },
};

const MOCK_SCENE = {
  plan: {
    id: SCENE_ID,
    projectId: PROJECT_ID,
    chapterId: CHAPTER_ID,
    title: "The Arrival",
    povCharacterId: "char-1",
    povDistance: "close",
    narrativeGoal: "Elena arrives at the station",
    emotionalBeat: "Anticipation → unease",
    readerEffect: "Reader feels the isolation",
    readerStateEntering: null,
    readerStateExiting: null,
    characterKnowledgeChanges: {},
    subtext: null,
    dialogueConstraints: {},
    pacing: "moderate",
    density: "moderate",
    sensoryNotes: null,
    sceneSpecificProhibitions: [],
    anchorLines: [],
    estimatedWordCount: [400, 600],
    chunkCount: 2,
    chunkDescriptions: ["Arrival", "Exploration"],
    failureModeToAvoid: "",
    locationId: null,
  },
  status: "drafting",
  sceneOrder: 0,
};

const MOCK_CHUNKS = [
  {
    id: "chunk-1",
    sceneId: SCENE_ID,
    sequenceNumber: 0,
    generatedText: "The train pulled into the station just as the last light faded behind the mountains. Elena stepped onto the platform, her breath visible in the cold air.",
    editedText: null,
    humanNotes: null,
    status: "accepted",
    model: "claude-sonnet-4-6",
    temperature: 0.85,
    topP: 1,
    payloadHash: "h1",
    generatedAt: "2025-01-01T00:00:00Z",
  },
];

async function mockWithChunks(page: Page) {
  await mockStartup(page);

  // Override chapters to return one chapter
  await page.route("**/chapters", (route, request) => {
    if (request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([MOCK_CHAPTER]) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: request.postData() ?? "{}" });
  });

  // Scenes for this chapter
  await page.route(`**/chapters/${CHAPTER_ID}/scenes`, (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([MOCK_SCENE]) });
  });

  // Chunks for this scene
  await page.route(`**/scenes/${SCENE_ID}/chunks`, (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_CHUNKS) });
  });

  // Audit flags — empty
  await page.route(`**/scenes/${SCENE_ID}/audit-flags`, (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  // Audit stats — empty
  await page.route(`**/scenes/${SCENE_ID}/audit-stats`, (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ total: 0, resolved: 0, actionable: 0 }) });
  });

  // Scene IR — 404 (not extracted yet)
  await page.route(`**/scenes/${SCENE_ID}/ir`, (route) => {
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
  });

  // Edit patterns — empty
  await page.route(`**/scenes/${SCENE_ID}/edit-patterns`, (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });
}

test.describe("Export Modal", () => {
  test.beforeEach(async ({ page }) => {
    await mockWithChunks(page);
  });

  test("opens Export modal from toolbar button", async ({ page }) => {
    await page.goto("/");
    // Wait for the Export Prose button to be enabled (has prose)
    const exportBtn = page.locator("button", { hasText: "Export Prose" });
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeEnabled();
    await exportBtn.click();
    await expect(page.locator("text=Export Prose").last()).toBeVisible();
    await expect(page.locator("text=Markdown")).toBeVisible();
  });

  test("shows markdown preview with word count", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "Export Prose" }).click();
    // Meta line shows "N words · .md"
    await expect(page.locator(".export-meta")).toContainText("words");
    await expect(page.locator(".export-meta")).toContainText(".md");
  });

  test("switching to Plain Text changes format indicator", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "Export Prose" }).click();
    // Click Plain Text radio
    await page.locator("label", { hasText: "Plain Text" }).click();
    await expect(page.locator("text=.txt")).toBeVisible();
  });

  test("Cancel closes modal", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "Export Prose" }).click();
    await expect(page.locator("[role=dialog]")).toBeVisible();
    await page.locator("button", { hasText: "Cancel" }).click();
    await expect(page.locator("[role=dialog]")).not.toBeVisible();
  });
});
