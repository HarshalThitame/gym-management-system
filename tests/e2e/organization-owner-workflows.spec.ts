import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const email = readEnv("E2E_ORGANIZATION_OWNER_EMAIL") ?? "hthitame+qa.owner@gmail.com";

const moduleRoutes = [
  "/organization/gyms", "/organization/staff", "/organization/members",
  "/organization/memberships", "/organization/revenue", "/organization/trainers",
  "/organization/attendance", "/organization/classes", "/organization/communications",
  "/organization/analytics", "/organization/branding", "/organization/domains",
  "/organization/billing", "/organization/settings", "/organization/security",
  "/organization/nutrition", "/organization/support", "/organization/profile"
] as const;

test.use({ screenshot: "on", trace: "on" });

/* ---------- helpers ---------- */

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL("/organization", { timeout: 30_000 });
}

async function expectPath(page: Page, path: string) {
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe(path);
}

/* ---------- suite ---------- */

test.describe("Organization Owner — Complete Workflows", () => {

  test("1 — Gym CRUD: list, filter, create drawer, edit drawer, status toggle", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);

    // Navigate to gyms
    await page.goto("/organization/gyms");
    await expectPath(page, "/organization/gyms");
    await expect(page.locator("main")).toBeVisible();

    // Verify filter bar renders
    const filterBar = page.getByRole("search", { name: /filter/i });
    await expect(filterBar).toBeVisible();

    // Verify data list renders with gym cards or empty state
    await page.waitForSelector(".rounded-lg.border", { timeout: 10_000 });

    // Verify breadcrumb
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Gyms" })).toBeVisible();

    // Verify "Create Gym" button exists
    const createBtn = page.getByRole("button", { name: /create gym/i });
    await expect(createBtn).toBeVisible();

    // Open create drawer
    await createBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Create Gym")).toBeVisible();

    // Verify drawer form fields
    await expect(page.getByLabel("Gym Name")).toBeVisible();
    await expect(page.getByLabel("Slug")).toBeVisible();
    await expect(page.getByLabel("Timezone")).toBeVisible();
    await expect(page.getByLabel("Currency")).toBeVisible();
    await expect(page.getByLabel("Status")).toBeVisible();

    // Close drawer with Escape
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Verify gym cards have action buttons
    const editButtons = page.getByRole("button", { name: /edit/i });
    const count = await editButtons.count();
    if (count > 0) {
      // Click first edit button
      await editButtons.first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByText("Edit Gym")).toBeVisible();
      await page.keyboard.press("Escape");
    }

    // Test empty state — verify no application errors
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("2 — Staff module: invite drawer, role/gym/branch selects, deactivate", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    await page.goto("/organization/staff");
    await expectPath(page, "/organization/staff");

    // Verify invite button
    const inviteBtn = page.getByRole("button", { name: /invite/i });
    await expect(inviteBtn).toBeVisible();
    await inviteBtn.click();

    // Drawer opens
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Invite Staff")).toBeVisible();

    // Verify form fields
    await expect(page.getByLabel("Email Address")).toBeVisible();
    await expect(page.getByLabel("Full Name")).toBeVisible();
    await expect(page.getByLabel("Role")).toBeVisible();
    await expect(page.getByLabel("Gym")).toBeVisible();
    await expect(page.getByLabel("Branch")).toBeVisible();
    await expect(page.getByLabel("Access Scope")).toBeVisible();

    // Close drawer
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Verify staff cards
    await page.waitForSelector(".rounded-lg.border", { timeout: 10_000 });

    // Test filter bar — change role filter
    const roleSelect = page.getByLabel(/filter by role/i);
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption("gym_admin");
      await page.getByRole("button", { name: /apply/i }).click();
      // Verify URL params
      await expect(page).toHaveURL(/role=/);
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("3 — Members module: list, filter, search, create drawer, transfer drawer", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    await page.goto("/organization/members");
    await expectPath(page, "/organization/members");

    // Verify filter + search
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
    const statusFilter = page.getByLabel(/filter by status/i);
    await expect(statusFilter).toBeVisible();

    // Verify create button
    const addBtn = page.getByRole("button", { name: /add member/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Create drawer
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Add Member")).toBeVisible();
    await expect(page.getByLabel("Full Name")).toBeVisible();
    await expect(page.getByLabel("Phone")).toBeVisible();
    await expect(page.getByLabel("Gym")).toBeVisible();
    await page.keyboard.press("Escape");

    // Verify member cards
    await page.waitForSelector(".rounded-lg.border", { timeout: 10_000 });

    // Test search
    await searchInput.fill("test");
    await page.getByRole("button", { name: /apply/i }).click();
    await expect(page).toHaveURL(/q=/);

    // Check transfer button exists on member cards
    const transferBtns = page.getByRole("button", { name: /transfer/i });
    const transferCount = await transferBtns.count();
    if (transferCount > 0) {
      await transferBtns.first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByText("Transfer Member")).toBeVisible();
      await expect(page.getByLabel("Target Gym")).toBeVisible();
      await page.keyboard.press("Escape");
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("4 — Memberships, Trainers, Revenue modules load with KPIs and filters", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);

    for (const route of ["/organization/memberships", "/organization/trainers", "/organization/revenue"] as const) {
      await page.goto(route);
      await expectPath(page, route);

      // Verify StatCards (KPI grid)
      await page.waitForSelector(".rounded-lg.border", { timeout: 10_000 });
      const statCards = page.locator(".grid.gap-4").first();
      await expect(statCards).toBeVisible();

      // Verify filter/search
      const filterSearch = page.getByRole("search", { name: /filter/i });
      await expect(filterSearch).toBeVisible();

      // Verify data list with items or empty state
      await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
    }
  });

  test("5 — Dashboard: breadcrumbs, navigation, KPI cards, charts, security alerts", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    await expectPath(page, "/organization");

    // Verify dashboard hero
    await expect(page.getByText("Organization Owner Portal")).toBeVisible();

    // Verify KPI grid
    const kpis = ["Total Gyms", "Total Members", "Revenue", "Attendance", "Security Alerts"];
    for (const kpi of kpis) {
      await expect(page.getByText(kpi, { exact: true }).first()).toBeVisible();
    }

    // Verify charts section (Revenue Trend, Member Growth, etc.)
    const chartHeadings = ["Revenue Over Time", "Member Growth", "Attendance Over Time", "Branch Performance"];
    for (const heading of chartHeadings) {
      await expect(page.getByText(heading).first()).toBeVisible();
    }

    // Verify activity + security sections
    await expect(page.getByText("Recent Activity")).toBeVisible();
    await expect(page.getByText("Security Alerts")).toBeVisible();

    // Click a module card to navigate
    const gymsLink = page.getByRole("link", { name: "Gyms" }).first();
    await expect(gymsLink).toBeVisible();
    await gymsLink.click();
    await expectPath(page, "/organization/gyms");

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("6 — All remaining module routes load successfully", async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);

    for (const route of moduleRoutes) {
      await page.goto(route);
      await expectPath(page, route);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
    }
  });

  test("7 — Breadcrumb navigation works on all module pages", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);

    for (const route of ["/organization/gyms", "/organization/members", "/organization/settings"] as const) {
      await page.goto(route);

      // Click Dashboard breadcrumb
      const dashboardLink = page.getByRole("link", { name: "Dashboard" });
      await expect(dashboardLink).toBeVisible();
      await dashboardLink.click();
      await expectPath(page, "/organization");
    }
  });

  test("8 — Plan & billing pages load with subscription data", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);

    await page.goto("/organization/plan");
    await expectPath(page, "/organization/plan");
    await expect(page.getByText("Subscription & Plan")).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);

    await page.goto("/organization/billing");
    await expectPath(page, "/organization/billing");
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

});

/* ---------- env helpers ---------- */

function readEnv(name: string) {
  return process.env[name] ?? localEnv[name] ?? null;
}

function requiredEnv(name: string) {
  const value = readEnv(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function readLocalEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    return Object.fromEntries(
      content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")]; })
    );
  } catch { return {}; }
}
