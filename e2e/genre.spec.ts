import { expect, test } from "@playwright/test";
import { mockStartup } from "./helpers.js";

test.describe("Genre Templates", () => {
  test.beforeEach(async ({ page }) => {
    await mockStartup(page);
  });

  test("genre selector visible in Bible Authoring Guided Form", async ({ page }) => {
    await page.goto("/");
    // Bootstrap stage — click "Build Manually" to open BibleAuthoringModal (guided form directly)
    await page.locator(".bootstrap-card", { hasText: "Build Manually" }).click();
    // Genre template selector should be visible
    await expect(page.locator("text=Genre Template")).toBeVisible();
  });

  test("genre selector shows all 4 genre options", async ({ page }) => {
    await page.goto("/");
    await page.locator(".bootstrap-card", { hasText: "Build Manually" }).click();
    // Check all 4 genre names are present as options
    await expect(page.locator("option", { hasText: "Literary Fiction" })).toBeAttached();
    await expect(page.locator("option", { hasText: "Thriller" })).toBeAttached();
    await expect(page.locator("option", { hasText: "Romance" })).toBeAttached();
    await expect(page.locator("option", { hasText: "Science Fiction" })).toBeAttached();
  });

  test("guided form shows stepper and foundations step", async ({ page }) => {
    await page.goto("/");
    await page.locator(".bootstrap-card", { hasText: "Build Manually" }).click();
    // Stepper steps within the modal are visible
    const modal = page.locator(".modal-overlay");
    await expect(modal.getByRole("button", { name: "Foundations" })).toBeVisible();
    await expect(modal.locator(".stepper-step", { hasText: "Characters" })).toBeVisible();
    await expect(modal.locator(".stepper-step", { hasText: "Review" })).toBeVisible();
    // Can navigate with Next button
    await modal.locator("button", { hasText: "Next" }).click();
    await expect(modal.locator("text=Add Character")).toBeVisible();
  });
});
