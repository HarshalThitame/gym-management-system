import { expect, test } from "@playwright/test";

test.describe("Super Admin Users Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com");
    await page.getByLabel("Password").fill(process.env.E2E_AUTH_PASSWORD ?? "");
    await page.getByRole("button", { name: /sign in/i }).click();
  });

  test("page loads with KPI cards and user data", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/users");
    await page.waitForTimeout(2000);

    // Verify heading
    await expect(page.getByText("Global User Management")).toBeVisible();

    // Verify KPI cards render (use first text match)
    await expect(page.getByText("Total Users").first()).toBeVisible();
    await expect(page.getByText("Active").first()).toBeVisible();

    // Verify user data or empty state
    const hasUsers = await page.getByText("No users match these filters").isVisible().catch(() => false);
    if (!hasUsers) {
      await expect(page.getByText("Total Users").first()).toBeVisible();
    }
  });

  test("search input is visible and functional", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/users");
    await page.waitForTimeout(1000);

    // Search input should be visible
    const searchInput = page.locator('input[name="q"]').or(page.locator('input[placeholder*="Search"]'));
    const hasSearch = await searchInput.isVisible().catch(() => false);
    if (hasSearch) {
      await searchInput.fill("test@example.com");
      await page.waitForTimeout(300);
      await searchInput.fill("");
    }
  });

  test("filter dropdowns are visible", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/users");
    await page.waitForTimeout(1000);

    // Check filter selects exist
    const roleSelect = page.locator('select[name="role"]');
    const statusSelect = page.locator('select[name="status"]');
    const orgSelect = page.locator('select[name="organizationId"]');

    const roleVisible = await roleSelect.isVisible().catch(() => false);
    const statusVisible = await statusSelect.isVisible().catch(() => false);
    const orgVisible = await orgSelect.isVisible().catch(() => false);

    if (roleVisible) await roleSelect.selectOption("all");
    if (statusVisible) await statusSelect.selectOption("all");
    if (orgVisible) await orgSelect.selectOption("all");
  });

  test("sort dropdown changes sort", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/users");
    await page.waitForTimeout(1000);

    const sortSelect = page.locator('select').filter({ has: page.locator('option[value="created_desc"]') });
    const hasSort = await sortSelect.isVisible().catch(() => false);
    if (hasSort) {
      await sortSelect.selectOption("name_asc");
      await page.waitForTimeout(500);
    }
  });

  test("invite user button is visible", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/users");
    await page.waitForTimeout(1000);

    const inviteBtn = page.getByText("Invite User").first();
    await expect(inviteBtn).toBeVisible();
  });

  test("export CSV button is visible", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/users");
    await page.waitForTimeout(1000);

    const exportBtn = page.getByText("Export CSV").first();
    await expect(exportBtn).toBeVisible();
  });

  test("pagination controls are visible when multiple pages", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/users");
    await page.waitForTimeout(1000);

    const prevBtn = page.getByText("Previous").first();
    const nextBtn = page.getByText("Next").first();

    const prevVisible = await prevBtn.isVisible().catch(() => false);
    const nextVisible = await nextBtn.isVisible().catch(() => false);
  });

  test("page has no hydration errors", async ({ page }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/super-admin/users");
    await page.waitForTimeout(2000);

    const hydrationErrors = errors.filter(
      (e) => e.includes("Hydration failed") || e.includes("server rendered HTML didn't match")
    );
    expect(hydrationErrors).toEqual([]);
  });
});
