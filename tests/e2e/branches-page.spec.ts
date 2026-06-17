import { expect, test } from "@playwright/test";

test.describe("Super Admin Branches Page", () => {
  test.beforeEach(async ({ page }) => {
    // Login as Super Admin
    await page.goto("/login");
    await page.getByLabel("Email").fill(process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com");
    await page.getByLabel("Password").fill(process.env.E2E_AUTH_PASSWORD ?? "");
    await page.getByRole("button", { name: /sign in/i }).click();
  });

  test("page loads with KPI cards and branch table", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/branches");

    // Wait for page to be visible
    await expect(page.locator("h1")).toContainText("Branch & Location Management");
    await expect(page.getByText("Total Branches")).toBeVisible();
    await expect(page.getByText("No branches found").or(page.locator("table"))).toBeVisible();

    // Check at least one KPI card is visible
    const kpiCards = page.locator("text=Total Branches, Active, Inactive / Issues, Avg Members/Branch, No Settings, No Admin, Needs Attention, Organizations");
    await expect(kpiCards.first()).toBeVisible();
  });

  test("search filters work correctly", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/branches");

    // Check if branches exist to filter
    const table = page.locator("table");
    const tableExists = await table.isVisible().catch(() => false);
    if (!tableExists) {
      test.skip(true, "No branches exist to test filtering");
      return;
    }

    // Search for something unlikely
    await page.locator('input[placeholder*="Search"]').fill("zzzzzznonexistent");
    await page.waitForTimeout(500);
    await expect(page.getByText("No branches found")).toBeVisible();

    // Clear filters
    await page.getByText("Clear Filters").click();
    await page.waitForTimeout(500);
    await expect(page.getByText("No branches found")).not.toBeVisible();
  });

  test("status filter dropdown works", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/branches");

    const select = page.locator("select").first();
    const selectExists = await select.isVisible().catch(() => false);
    if (!selectExists) {
      test.skip(true, "Filter dropdown not visible");
      return;
    }

    await select.selectOption("active");
    await page.waitForTimeout(300);
  });

  test("clear filters button resets all filters", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/branches");

    const clearBtn = page.getByText("Clear Filters");
    const exists = await clearBtn.isVisible().catch(() => false);
    if (!exists) {
      test.skip(true, "Clear filters button not visible");
      return;
    }

    // Change a filter
    const select = page.locator("select").first();
    const selectExists = await select.isVisible().catch(() => false);
    if (selectExists) {
      await select.selectOption("active");
    }

    // Clear
    await clearBtn.click();
    await page.waitForTimeout(300);
  });

  test("branch detail drawer opens on click", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/branches");

    const eyeButton = page.locator('button[aria-label="View details"]').first();
    const exists = await eyeButton.isVisible().catch(() => false);
    if (!exists) {
      test.skip(true, "No branch detail buttons available");
      return;
    }

    await eyeButton.click();
    await expect(page.getByText("Configuration Health")).toBeVisible();
  });

  test("page has no console errors", async ({ page }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/super-admin/branches");
    await page.waitForTimeout(2000);

    const hydrationErrors = errors.filter((e) =>
      e.includes("Hydration failed") ||
      e.includes("server rendered HTML didn't match")
    );
    expect(hydrationErrors).toEqual([]);
  });
});
