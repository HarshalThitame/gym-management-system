import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";

type AuditLog = {
  console: Array<{ type: string; text: string; location: unknown }>;
  pageErrors: string[];
  network: Array<{ status: number; method: string; url: string }>;
};

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const email = readEnv("E2E_ORGANIZATION_OWNER_EMAIL") ?? "hthitame+qa.owner@gmail.com";

test.use({ screenshot: "on", trace: "on" });

function setupAudit(page: Page) {
  const audit: AuditLog = {
    console: [],
    pageErrors: [],
    network: []
  };

  page.on("console", (message) => {
    audit.console.push({
      type: message.type(),
      text: message.text(),
      location: message.location()
    });
  });

  page.on("pageerror", (error) => {
    audit.pageErrors.push(error.message);
  });

  page.on("response", (response) => {
    if (response.status() >= 500) {
      audit.network.push({
        status: response.status(),
        method: response.request().method(),
        url: response.url()
      });
    }
  });

  return audit;
}

function clientErrors(audit: AuditLog) {
  return audit.console
    .filter((entry) => entry.type === "error")
    .map((entry) => entry.text)
    .filter((text) => !text.includes("Failed to load resource: the server responded with a status of 403"));
}

async function expectNoCrashes(audit: AuditLog) {
  expect(clientErrors(audit)).toEqual([]);
  expect(audit.pageErrors).toEqual([]);
  expect(audit.network).toEqual([]);
}

async function loginAs(page: Page, expectedPath: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expectPath(page, expectedPath);
}

async function expectPath(page: Page, path: string) {
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe(path);
}

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
      content
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
        })
    );
  } catch {
    return {} as Record<string, string>;
  }
}

test.describe("Organization Owner — Phase 3 Features", () => {
  test("Class calendar/monthly view renders", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const audit = setupAudit(page);
    await loginAs(page, "/organization");

    await page.goto("/organization/classes");
    await expectPath(page, "/organization/classes");
    await expect(page.locator("main").first()).toBeVisible();

    const calendarTab = page.getByRole("tab", { name: /network calendar|calendar|schedule/i });
    if (await calendarTab.isVisible().catch(() => false)) {
      await calendarTab.click();
      await page.waitForTimeout(1500);
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
    await expectNoCrashes(audit);
  });

  test("Referral program tab accessible", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "/organization");
    await page.goto("/organization/members");
    await expectPath(page, "/organization/members");

    const referralsTab = page.getByRole("tab", { name: /referral/i });
    if (await referralsTab.isVisible().catch(() => false)) {
      await referralsTab.click();
      await page.waitForTimeout(1500);
    }

    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Loyalty points tab accessible", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "/organization");
    await page.goto("/organization/members");
    await expectPath(page, "/organization/members");

    const loyaltyTab = page.getByRole("tab", { name: /loyalty/i });
    if (await loyaltyTab.isVisible().catch(() => false)) {
      await loyaltyTab.click();
      await page.waitForTimeout(1500);
    }

    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Network campaign builder accessible via communications", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "/organization");
    await page.goto("/organization/communications");
    await expectPath(page, "/organization/communications");

    const campaignsTab = page.getByRole("tab", { name: /network campaign|campaign/i });
    if (await campaignsTab.isVisible().catch(() => false)) {
      await campaignsTab.click();
      await page.waitForTimeout(1500);
    }

    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("NPS surveys section accessible", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "/organization");
    await page.goto("/organization/communications");
    await expectPath(page, "/organization/communications");

    const npsTab = page.getByRole("tab", { name: /nps/i });
    if (await npsTab.isVisible().catch(() => false)) {
      await npsTab.click();
      await page.waitForTimeout(1500);
    }

    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Dashboard loads with KPI cards and charts", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const audit = setupAudit(page);
    await loginAs(page, "/organization");
    await expectPath(page, "/organization");

    await expect(page.locator("main").first()).toBeVisible();

    const kpis = ["Total Gyms", "Total Members", "Revenue", "Attendance"];
    for (const kpi of kpis) {
      await expect(page.getByText(kpi, { exact: true }).first()).toBeVisible();
    }

    const charts = ["Revenue Over Time", "Member Growth", "Attendance Over Time"];
    for (const heading of charts) {
      await expect(page.getByText(heading).first()).toBeVisible({ timeout: 10_000 });
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
    await expectNoCrashes(audit);
  });

  test("Equipment module renders or redirects cleanly", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "/organization");

    await page.goto("/organization/equipment");
    await page.waitForTimeout(3000);

    const currentPath = new URL(page.url()).pathname;
    expect(["/organization", "/organization/equipment", "/unauthorized"]).toContain(currentPath);

    if (currentPath === "/organization/equipment") {
      await expect(page.locator("main").first()).toBeVisible();
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Settings integrations tabs accessible (Google Calendar, Webhooks)", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "/organization");
    await page.goto("/organization/settings");
    await expectPath(page, "/organization/settings");

    const googleCalendarTab = page.getByRole("tab", { name: /google calendar|calendar integ/i });
    if (await googleCalendarTab.isVisible().catch(() => false)) {
      await googleCalendarTab.click();
      await page.waitForTimeout(1500);
    }

    const webhooksTab = page.getByRole("tab", { name: /webhook/i });
    if (await webhooksTab.isVisible().catch(() => false)) {
      await webhooksTab.click();
      await page.waitForTimeout(1500);
    }

    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });
});
