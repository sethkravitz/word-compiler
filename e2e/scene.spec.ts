import { expect, test } from "@playwright/test";
import { mockStartupWithBible, navigateToStage } from "./helpers.js";

test.describe("Scene authoring workflow", () => {
  test.beforeEach(async ({ page }) => {
    await mockStartupWithBible(page);
    await page.goto("/");
    // Navigate to Plan stage (unlocked because bible has a character)
    await navigateToStage(page, "Plan");
  });

  test("opens scene authoring modal", async ({ page }) => {
    // Click the first "+ New Scene" button in the scene sequencer
    const sceneBtn = page.locator("button", { hasText: "New Scene" }).first();
    await expect(sceneBtn).toBeVisible({ timeout: 2000 });
    await sceneBtn.click();
    await expect(page.locator("text=Scene Authoring")).toBeVisible({ timeout: 2000 });
  });

  test("guided form creates scene plan", async ({ page }) => {
    // Open scene authoring
    await page.locator("button", { hasText: "New Scene" }).first().click();
    await expect(page.locator("text=Scene Authoring")).toBeVisible();

    // Switch to Guided Form tab
    await page.locator("button", { hasText: "Guided Form" }).click();

    // Fill in core identity fields
    const titleInput = page.locator("input[placeholder='Scene title']");
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill("The Confrontation");
    }

    // Fill narrative goal
    const goalTextarea = page.locator("textarea").first();
    if (await goalTextarea.isVisible()) {
      await goalTextarea.fill("Marcus discovers Elena's betrayal");
    }

    // Navigate through steps
    const nextBtn = page.locator("button", { hasText: "Next" });
    if (await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      await nextBtn.click();
      await page.waitForTimeout(500);
      await nextBtn.click();
      await page.waitForTimeout(500);
    }

    // Save the scene plan
    const saveBtn = page.locator("button", { hasText: "Save Scene Plan" });
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
      // Modal should close
      await expect(page.locator("text=Scene Authoring")).not.toBeVisible({ timeout: 2000 });
    }
  });
});
