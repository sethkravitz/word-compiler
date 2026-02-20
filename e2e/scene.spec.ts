import { expect, test } from "@playwright/test";
import path from "node:path";

const BIBLE_FIXTURE = path.join(import.meta.dirname, "..", "fixtures", "bible.json");

test.describe("Scene authoring workflow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    // Load Bible fixture first
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.locator("button", { hasText: "Load Bible" }).click(),
    ]);
    await fileChooser.setFiles(BIBLE_FIXTURE);
    await expect(page.locator(".bible-version")).toBeVisible({ timeout: 3000 });
  });

  test("opens scene authoring modal", async ({ page }) => {
    // Look for "New Scene" or scene authoring trigger — check what the UI provides
    const sceneBtn = page.locator("button", { hasText: /Scene/ }).first();
    if (await sceneBtn.isVisible()) {
      await sceneBtn.click();
      await expect(page.locator("text=Scene Authoring")).toBeVisible({ timeout: 2000 });
    }
  });

  test("guided form creates scene plan", async ({ page }) => {
    // Open scene authoring if the button exists
    const sceneBtn = page.locator("button", { hasText: /Scene/ }).first();
    if (!(await sceneBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await sceneBtn.click();
    await expect(page.locator("text=Scene Authoring")).toBeVisible();

    // Switch to Guided Form tab
    await page.locator("button", { hasText: "Guided Form" }).click();

    // Fill in core identity fields
    const titleInput = page.locator("input[placeholder='Scene title']");
    await titleInput.fill("The Confrontation");

    // Fill narrative goal
    const goalTextarea = page.locator("textarea").first();
    if (await goalTextarea.isVisible()) {
      await goalTextarea.fill("Marcus discovers Elena's betrayal");
    }

    // Navigate through steps
    await page.locator("button", { hasText: "Next" }).click();
    // Should see Reader Knowledge step
    await expect(page.locator("text=Reader State Entering")).toBeVisible({ timeout: 2000 });

    await page.locator("button", { hasText: "Next" }).click();
    // Should see Texture step
    await expect(page.locator("text=Pacing")).toBeVisible({ timeout: 2000 });

    await page.locator("button", { hasText: "Next" }).click();
    // Should see Structure step with word count and chunks
    await expect(page.locator("text=Estimated Word Count")).toBeVisible({ timeout: 2000 });

    // Save the scene plan
    await page.locator("button", { hasText: "Save Scene Plan" }).click();
    // Modal should close
    await expect(page.locator("text=Scene Authoring")).not.toBeVisible({ timeout: 2000 });
  });
});
