import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const PROJECT_ID = "proj-e2e-test";

const MOCK_PROJECT = {
  id: PROJECT_ID,
  title: "E2E Test Project",
  status: "drafting",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

export const MOCK_BIBLE = {
  projectId: PROJECT_ID,
  version: 1,
  characters: [
    {
      id: "marcus",
      name: "Marcus",
      role: "protagonist",
      physicalDescription: "Weathered hands",
      backstory: "Former boxer",
      selfNarrative: null,
      contradictions: null,
      voice: {
        sentenceLengthRange: [6, 14],
        vocabularyNotes: "Blue-collar precise",
        verbalTics: [],
        metaphoricRegister: "machinery",
        prohibitedLanguage: [],
        dialogueSamples: [],
      },
      behavior: {
        stressResponse: "Goes still",
        socialPosture: "Edge of conversations",
        noticesFirst: "Hands",
        lyingStyle: "Omits",
        emotionPhysicality: "Jaw tightens",
      },
    },
  ],
  locations: [],
  styleGuide: {
    metaphoricRegister: null,
    vocabularyPreferences: [],
    sentenceArchitecture: null,
    paragraphPolicy: null,
    killList: [],
    negativeExemplars: [],
    positiveExemplars: [],
    structuralBans: [],
  },
  narrativeRules: {
    pov: { default: "close-third", distance: "close", interiority: "filtered", reliability: "reliable" },
    subtextPolicy: null,
    expositionPolicy: null,
    sceneEndingPolicy: null,
    setups: [],
  },
  createdAt: "2025-01-01T00:00:00Z",
  sourcePrompt: null,
};

interface StartupOptions {
  /** If provided, the bible endpoint returns this instead of 404. */
  bible?: object;
}

/**
 * Mocks the startup API calls so the app boots into the main UI
 * with a single empty project. Pass `bible` option to pre-load a bible.
 * Call BEFORE page.goto("/").
 */
export async function mockStartup(page: Page, options: StartupOptions = {}) {
  // List projects → single project
  await page.route("**/api/data/projects", (route, request) => {
    if (request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([MOCK_PROJECT]) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_PROJECT) });
  });

  // Get project by ID (any project)
  await page.route(/\/api\/data\/projects\/[^/]+$/, (route, request) => {
    if (request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_PROJECT) });
    }
    return route.continue();
  });

  // Latest bible → configurable
  await page.route("**/bibles/latest", (route) => {
    if (options.bible) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(options.bible) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "No bible" }) });
  });

  // Bible versions → empty
  await page.route("**/bibles/versions", (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  // Chapter arcs → empty
  await page.route("**/chapters", (route, request) => {
    if (request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: request.postData() ?? "{}" });
  });

  // POST bibles → echo back the body (any project)
  await page.route(/\/api\/data\/projects\/[^/]+\/bibles$/, (route, request) => {
    if (request.method() === "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: request.postData() ?? "{}" });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  // POST scenes → return just the plan
  await page.route("**/api/data/scenes", (route, request) => {
    if (request.method() === "POST") {
      try {
        const body = JSON.parse(request.postData() ?? "{}");
        const plan = body.plan ?? body;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(plan) });
      } catch {
        return route.fulfill({ status: 200, contentType: "application/json", body: request.postData() ?? "{}" });
      }
    }
    return route.continue();
  });
}

/**
 * Like mockStartup, but pre-loads a bible with 1 character.
 * This unlocks the Plan stage.
 */
export async function mockStartupWithBible(page: Page) {
  await mockStartup(page, { bible: MOCK_BIBLE });
}

/** Navigate to a workflow stage via the WorkflowRail stepper. */
export async function navigateToStage(page: Page, stageLabel: string) {
  const stageBtn = page.locator('[aria-label="Progress"] button', { hasText: stageLabel });
  await expect(stageBtn).toBeVisible();
  await stageBtn.click();
}
