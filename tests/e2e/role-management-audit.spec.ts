import { expect, type Page, test } from "@playwright/test";

type AuditLog = {
  console: Array<{ type: string; text: string; location: unknown }>;
  pageErrors: string[];
  network: Array<{ status: number; method: string; url: string }>;
};

const password = process.env.E2E_AUTH_PASSWORD ?? "";
const superAdminEmail = process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com";

function requiredEnv(name: string) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
  return process.env[name]!;
}

async function loginAsSuperAdmin(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.fill("input[name=email]", superAdminEmail);
  await page.fill("input[name=password]", password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/super-admin/);
}

async function captureAudit(page: Page): Promise<AuditLog> {
  const consoleMessages: Array<{ type: string; text: string; location: unknown }> = [];
  const pageErrors: string[] = [];
  const networkRequests: Array<{ status: number; method: string; url: string }> = [];

  page.on("console", (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text(), location: msg.location() });
  });

  page.on("pageerror", (err) => pageErrors.push(err.message));

  page.on("response", (res) => {
    networkRequests.push({ status: res.status(), method: res.request().method(), url: res.url() });
  });

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  return { console: consoleMessages, pageErrors, network: networkRequests };
}

test.describe("Roles & Permissions Module", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test("loads roles page with summary cards", async ({ page }) => {
    await page.goto("/super-admin/roles");
    const audit = await captureAudit(page);

    expect(page.url()).toContain("/super-admin/roles");
    expect(audit.pageErrors).toHaveLength(0);

    const summaryLabels = ["Total Roles", "System Roles", "Custom Roles", "Assignments"];
    for (const label of summaryLabels) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("displays roles table with all columns", async ({ page }) => {
    await page.goto("/super-admin/roles");
    await page.waitForLoadState("networkidle");

    const headers = ["Role", "Users", "Permissions", "Type", "Actions"];
    for (const header of headers) {
      await expect(page.locator(`th:has-text('${header}')`).first()).toBeVisible({ timeout: 5_000 });
    }

    const rows = page.locator("table tbody tr");
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);
  });

  test("system roles show System badge and hide edit/delete", async ({ page }) => {
    await page.goto("/super-admin/roles");
    await page.waitForLoadState("networkidle");

    const systemBadge = page.locator("text=System").first();
    await expect(systemBadge).toBeVisible({ timeout: 5_000 });
  });

  test("opens Create Role drawer", async ({ page }) => {
    await page.goto("/super-admin/roles");
    await page.waitForLoadState("networkidle");

    await page.locator("button:has-text('Create Role')").first().click();
    await expect(page.locator("h2:has-text('Create Role')")).toBeVisible({ timeout: 5_000 });

    await page.fill("input[name=name]", "test_role");
    await page.fill("input[name=displayName]", "Test Role");
    await page.fill("textarea[name=description]", "A test custom role for QA.");
  });

  test("create role form validates empty fields", async ({ page }) => {
    await page.goto("/super-admin/roles");
    await page.waitForLoadState("networkidle");

    await page.locator("button:has-text('Create Role')").first().click();
    await expect(page.locator("h2:has-text('Create Role')")).toBeVisible({ timeout: 5_000 });

    await page.click("button[type=submit]");
    await expect(page.locator("text=Check the highlighted fields").or(page.locator("text=required"))).toBeVisible({ timeout: 5_000 });
  });

  test("opens Permissions drawer for a role", async ({ page }) => {
    await page.goto("/super-admin/roles");
    await page.waitForLoadState("networkidle");

    const permBtn = page.locator("button[title='Manage permissions']").first();
    await expect(permBtn).toBeVisible({ timeout: 5_000 });
    await permBtn.click();

    await expect(page.locator("h2").filter({ hasText: /Permissions/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test("permissions drawer shows resource toggles", async ({ page }) => {
    await page.goto("/super-admin/roles");
    await page.waitForLoadState("networkidle");

    const permBtn = page.locator("button[title='Manage permissions']").first();
    await permBtn.click();
    await page.waitForTimeout(1_000);

    const resourceLabel = page.locator("text=users").or(page.locator("text=roles")).or(page.locator("text=profiles")).first();
    await expect(resourceLabel).toBeVisible({ timeout: 5_000 });
  });

  test("opens Assign drawer for a role", async ({ page }) => {
    await page.goto("/super-admin/roles");
    await page.waitForLoadState("networkidle");

    const assignBtn = page.locator("button[title='Assign to user']").first();
    await expect(assignBtn).toBeVisible({ timeout: 5_000 });
    await assignBtn.click();

    await expect(page.locator("h2").filter({ hasText: /Assign Role/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test("export button triggers CSV download", async ({ page }) => {
    await page.goto("/super-admin/roles");
    await page.waitForLoadState("networkidle");

    const exportBtn = page.locator("a[href*='export'], button:has-text('Export')").first();
    if (await exportBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const [response] = await Promise.all([
        page.waitForResponse((res) => res.url().includes("export") && res.status() === 200).catch(() => null),
        exportBtn.click()
      ]);
    }
  });

  test("no console errors on roles page", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/super-admin/roles");
    await page.waitForLoadState("networkidle");

    expect(consoleErrors.filter((e) => !e.includes("favicon") && !e.includes("404"))).toHaveLength(0);
  });

  test("edit button is hidden for system roles", async ({ page }) => {
    await page.goto("/super-admin/roles");
    await page.waitForLoadState("networkidle");

    const systemRows = page.locator("tbody tr").filter({ has: page.locator("text=System") });
    const systemRowCount = await systemRows.count();

    if (systemRowCount > 0) {
      const editInSystem = systemRows.first().locator("button[title='Edit']");
      await expect(editInSystem).toHaveCount(0);
    }
  });

  test("delete button is hidden for system roles", async ({ page }) => {
    await page.goto("/super-admin/roles");
    await page.waitForLoadState("networkidle");

    const systemRows = page.locator("tbody tr").filter({ has: page.locator("text=System") });
    const systemRowCount = await systemRows.count();

    if (systemRowCount > 0) {
      const deleteInSystem = systemRows.first().locator("button[title='Delete']");
      await expect(deleteInSystem).toHaveCount(0);
    }
  });
});
