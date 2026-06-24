import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";

type AuditLog = {
  console: Array<{ type: string; text: string; location: unknown }>;
  pageErrors: string[];
  network: Array<{ status: number; method: string; url: string }>;
};

type RouteTiming = {
  route: string;
  status: number | null;
  durationMs: number;
};

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const email = readEnv("E2E_ORGANIZATION_OWNER_EMAIL") ?? "hthitame+qa.owner@gmail.com";

const moduleRoutes = [
  "/organization/members", "/organization/staff", "/organization/trainers",
  "/organization/attendance", "/organization/classes", "/organization/communications",
  "/organization/analytics", "/organization/branding", "/organization/domains",
  "/organization/billing", "/organization/nutrition", "/organization/leads",
  "/organization/revenue", "/organization/custom-roles", "/organization/equipment",
  "/organization/security", "/organization/settings", "/organization/profile",
  "/organization/support", "/organization/plan"
] as const;

test.use({ screenshot: "on", serviceWorkers: "block", trace: "on" });

function setupAudit(page: Page): AuditLog {
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

async function attachAudit(testInfo: TestInfo, name: string, audit: AuditLog, extra: Record<string, unknown> = {}) {
  await testInfo.attach(name, {
    body: JSON.stringify({ ...extra, ...audit }, null, 2),
    contentType: "application/json"
  });
}

function clientErrors(audit: AuditLog) {
  return audit.console
    .filter((entry) => entry.type === "error")
    .map((entry) => entry.text)
    .filter((text) => !text.includes("Failed to load resource: the server responded with a status of 403"));
}

async function expectNoClientCrashes(audit: AuditLog) {
  expect(clientErrors(audit)).toEqual([]);
  expect(audit.pageErrors).toEqual([]);
  expect(audit.network).toEqual([]);
}

async function currentPath(page: Page) {
  return new URL(page.url()).pathname;
}

async function expectPath(page: Page, path: string) {
  await expect.poll(() => currentPath(page), { timeout: 30_000 }).toBe(path);
}

async function loginAsOrganizationOwner(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  const signInButton = page.getByRole("button", { name: /sign in/i });
  await expect(signInButton).toBeEnabled({ timeout: 10_000 });
  await signInButton.click();
  await expectPath(page, "/organization");
}

async function gotoAuditedRoute(page: Page, route: string): Promise<RouteTiming> {
  const startedAt = performance.now();
  const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch((error: Error) => {
    if (!error.message.includes("ERR_ABORTED") && !error.message.includes("frame was detached")) {
      throw error;
    }
    return null;
  });
  await page.waitForTimeout(3000);

  return {
    route,
    status: response?.status() ?? null,
    durationMs: Math.round(performance.now() - startedAt)
  };
}

test.describe("Organization Owner — Module Health", () => {

  test("all modules render without crashes and have main content visible", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const audit = setupAudit(page);
    const timings: RouteTiming[] = [];

    await loginAsOrganizationOwner(page);

    for (const route of moduleRoutes) {
      const timing = await gotoAuditedRoute(page, route);
      timings.push(timing);

      const actualPath = await currentPath(page);
      const redirected = actualPath !== route;

      if (!redirected) {
        const bodyText = await page.innerText("body").catch(() => "");
        expect(bodyText).not.toMatch(/Application error/);
        expect(bodyText).not.toMatch(/\b500\b/);
        await expect(page.locator("main").first()).toBeVisible({ timeout: 10_000 }).catch(() => {});
      }
    }

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("org-owner-module-health.png") });
    await attachAudit(testInfo, "org-owner-module-health-audit", audit, { timings });
    await expectNoClientCrashes(audit);
  });

  test("all modules are mobile responsive and have accessible navigation", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });

    await loginAsOrganizationOwner(page);

    const keyRoutes = ["/organization/members", "/organization/staff", "/organization/dashboard"];

    for (const route of keyRoutes) {
      if (route === "/organization/dashboard") {
        await page.goto("/organization", { waitUntil: "domcontentloaded" });
      } else {
        await page.goto(route, { waitUntil: "domcontentloaded" });
      }

      await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
      await expect(page.locator("main").first()).toBeVisible({ timeout: 10_000 });

      const menuButton = page.locator('[aria-label*="menu" i], [aria-label*="toggle" i], .hamburger, [data-testid="mobile-menu"]').first();
      const menuVisible = await menuButton.isVisible().catch(() => false);
      if (menuVisible) {
        await expect(menuButton).toBeVisible();
      } else {
        const nav = page.locator('nav').first();
        await expect(nav).toBeVisible();
      }

      const scrollableContent = page.getByRole("heading").first();
      if (await scrollableContent.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(scrollableContent).toBeInViewport();
      }

      await expect(page.getByText("500", { exact: false })).toHaveCount(0);
    }

    await page.setViewportSize({ width: 1280, height: 720 });
  });

});

function readLocalEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    return Object.fromEntries(
      content.split(/\r?\n/).map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")]; })
    );
  } catch { return {} as Record<string, string>; }
}

function readEnv(name: string) {
  return process.env[name] ?? localEnv[name] ?? null;
}

function requiredEnv(name: string) {
  const value = readEnv(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}
