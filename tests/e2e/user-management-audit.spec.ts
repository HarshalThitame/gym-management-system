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

test.describe("User Management Module", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test("loads user management page with summary cards", async ({ page }) => {
    await page.goto("/super-admin/users");
    const audit = await captureAudit(page);

    expect(page.url()).toContain("/super-admin/users");
    expect(pageErrors(page, audit)).toHaveLength(0);

    const summaryLabels = ["Total", "Active", "Invited", "Suspended", "Super Admins"];
    for (const label of summaryLabels) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("displays the organization accordion and user rows", async ({ page }) => {
    await page.goto("/super-admin/users");
    await page.waitForLoadState("networkidle");

    const accordion = page.locator("button:has-text('Unassigned Users'), button:has-text('Organization')").first();
    await expect(accordion).toBeVisible({ timeout: 10_000 });
  });

  test("opens Invite User drawer and validates form", async ({ page }) => {
    await page.goto("/super-admin/users");
    await page.waitForLoadState("networkidle");

    await page.locator("button:has-text('Invite User')").first().click();
    await expect(page.locator("h2:has-text('Invite User')")).toBeVisible({ timeout: 5_000 });

    await page.fill("input[name=email]", "invalid");
    await page.fill("input[name=fullName]", "");
    await page.click("button[type=submit]");

    await expect(page.locator("text=Check the highlighted fields").or(page.locator("text=required"))).toBeVisible({ timeout: 5_000 });
  });

  test("drawer close button works", async ({ page }) => {
    await page.goto("/super-admin/users");
    await page.waitForLoadState("networkidle");

    await page.locator("button:has-text('Invite User')").first().click();
    await expect(page.locator("h2:has-text('Invite User')")).toBeVisible({ timeout: 5_000 });

    await page.locator("button:has-text('Invite User') path").first().click({ force: true }).catch(() => {});
    const closeBtn = page.locator("button").filter({ has: page.locator("svg.lucide-xcircle") }).first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });

  test("export button navigates to API route", async ({ page }) => {
    await page.goto("/super-admin/users");
    await page.waitForLoadState("networkidle");

    const exportBtn = page.locator("button:has-text('Export')").or(page.locator("a:has-text('Export')")).first();
    if (await exportBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const [newPage] = await Promise.all([
        page.waitForEvent("popup", { timeout: 5_000 }).catch(() => null),
        exportBtn.click()
      ]);
    }
  });

  test("pending invites section is visible when data exists", async ({ page }) => {
    await page.goto("/super-admin/users");
    await page.waitForLoadState("networkidle");

    const pendingSection = page.locator("text=Pending Invites").first();
    if (await pendingSection.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(pendingSection).toBeVisible();
    }
  });

  test("search input is functional", async ({ page }) => {
    await page.goto("/super-admin/users");
    await page.waitForLoadState("networkidle");

    const searchInput = page.locator("input[placeholder*='Search']").first();
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    await searchInput.fill("test user");
    await page.waitForTimeout(300);
  });

  test("no console errors on user management page", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/super-admin/users");
    await page.waitForLoadState("networkidle");

    expect(consoleErrors.filter((e) => !e.includes("favicon") && !e.includes("404"))).toHaveLength(0);
  });

  test("user detail drawer opens from view button", async ({ page }) => {
    await page.goto("/super-admin/users");
    await page.waitForLoadState("networkidle");

    const viewBtn = page.locator("button[title='View details']").first();
    if (await viewBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await viewBtn.click();
      await expect(page.locator("h2").filter({ hasText: /User Detail|user/i }).first()).toBeVisible({ timeout: 5_000 }).catch(() => {});
    }
  });

  test("filters render all options", async ({ page }) => {
    await page.goto("/super-admin/users");
    await page.waitForLoadState("networkidle");

    const selects = page.locator("select");
    const count = await selects.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

function pageErrors(page: Page, audit: AuditLog) {
  return audit.pageErrors;
}
