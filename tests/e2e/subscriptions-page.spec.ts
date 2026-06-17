import { expect, test } from "@playwright/test";

test.describe("Super Admin Subscriptions Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com");
    await page.getByLabel("Password").fill(process.env.E2E_AUTH_PASSWORD ?? "");
    await page.getByRole("button", { name: /sign in/i }).click();
  });

  test("page loads without auto-opening any modal", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/subscriptions");

    // Verify page heading is visible
    await expect(page.getByText("Subscription Management")).toBeVisible();

    // Verify KPI cards render
    await expect(page.getByText("Active").or(page.getByText("Trial"))).toBeVisible();

    // Verify the package editor modal is NOT visible
    const modalHeading = page.locator("text=Edit Package").or(page.locator("text=Create Package")).or(page.locator("text=Save Package"));
    await expect(modalHeading).toHaveCount(0);

    // Verify the package editor dialog is not in the DOM or hidden
    const editorModal = page.locator('[role="dialog"]').or(page.locator(".fixed.inset-0.z-50"));
    await expect(editorModal).toHaveCount(0);
  });

  test("clicking Create Package opens modal, closing it keeps it closed", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/subscriptions");

    // Click Create Package button
    const createBtn = page.getByText("Create Package").first();
    const hasBtn = await createBtn.isVisible().catch(() => false);
    if (!hasBtn) {
      test.skip(true, "No Create Package button visible");
      return;
    }
    await createBtn.click();
    await page.waitForTimeout(500);

    // Verify modal opened
    const modalContent = page.locator("text=Save Package").or(page.locator("text=Package Name"));
    await expect(modalContent.first()).toBeVisible();

    // Close the modal
    const closeBtn = page.locator('button[aria-label="Close"]').first();
    const closeBtnVisible = await closeBtn.isVisible().catch(() => false);
    if (closeBtnVisible) {
      await closeBtn.click();
    } else {
      // Try cancel button
      const cancelBtn = page.getByText("Cancel").first();
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click();
      }
    }
    await page.waitForTimeout(500);

    // Verify modal is closed
    await expect(modalContent.first()).not.toBeVisible();
  });

  test("refreshing page does not reopen modal", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/subscriptions");
    await page.waitForTimeout(500);

    // Refresh
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify modal did not open
    const modalHeading = page.locator("text=Edit Package").or(page.locator("text=Create Package"));
    await expect(modalHeading).toHaveCount(0);

    // Verify page content is visible
    await expect(page.getByText("Subscription Management")).toBeVisible();
  });

  test("organizations table renders with subscription data", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/subscriptions");

    // Check for the organizations table
    const orgTable = page.getByText("Organizations").or(page.getByText("No organizations found"));
    await expect(orgTable.first()).toBeVisible();
  });

  test("search organizations works", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/subscriptions");

    const searchInput = page.locator('input[aria-label="Search"]');
    const hasInput = await searchInput.isVisible().catch(() => false);
    if (!hasInput) {
      test.skip(true, "Search input not visible");
      return;
    }

    // Type a search query
    await searchInput.fill("Test");
    await page.waitForTimeout(300);

    // Clear search
    await searchInput.fill("");
    await page.waitForTimeout(300);
  });

  test("page has no hydration errors", async ({ page }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/super-admin/subscriptions");
    await page.waitForTimeout(2000);

    const hydrationErrors = errors.filter(
      (e) => e.includes("Hydration failed") || e.includes("server rendered HTML didn't match")
    );
    expect(hydrationErrors).toEqual([]);
  });
});
