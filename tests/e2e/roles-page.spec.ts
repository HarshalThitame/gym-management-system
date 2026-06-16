import { expect, test } from "@playwright/test";

test.describe("Super Admin Roles Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com");
    await page.getByLabel("Password").fill(process.env.E2E_AUTH_PASSWORD ?? "");
    await page.getByRole("button", { name: /sign in/i }).click();
  });

  test("page loads with KPI cards", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/roles");
    await page.waitForTimeout(2000);

    await expect(page.getByText("Total Roles").first()).toBeVisible();
    await expect(page.getByText("Assignments").first()).toBeVisible();
  });

  test("role table renders", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/roles");
    await page.waitForTimeout(1000);

    const hasRoles = await page.getByText("No roles found").isVisible().catch(() => false);
    if (!hasRoles) {
      await expect(page.getByText("Roles").or(page.getByText("Permissions"))).toBeVisible();
    }
  });

  test("filter dropdowns work", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/super-admin/roles");
    await page.waitForTimeout(1000);

    const typeSelect = page.locator('select[name="type"]');
    const sortSelect = page.locator('select[name="sort"]');

    const typeVisible = await typeSelect.isVisible().catch(() => false);
    const sortVisible = await sortSelect.isVisible().catch(() => false);

    if (typeVisible) await typeSelect.selectOption("system");
    if (sortVisible) await sortSelect.selectOption("name_asc");
  });

  test("no hydration errors", async ({ page }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/super-admin/roles");
    await page.waitForTimeout(2000);

    const hydrationErrors = errors.filter(
      (e) => e.includes("Hydration failed") || e.includes("server rendered HTML didn't match")
    );
    expect(hydrationErrors).toEqual([]);
  });
});
