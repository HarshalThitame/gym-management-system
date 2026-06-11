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

const password = requiredEnv("E2E_AUTH_PASSWORD");
const superAdminEmail = process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const superAdminRoutes = [
  "/super-admin",
  "/super-admin/organizations",
  "/super-admin/gyms",
  "/super-admin/domains",
  "/super-admin/subscriptions",
  "/super-admin/billing",
  "/super-admin/users",
  "/super-admin/roles",
  "/super-admin/settings",
  "/super-admin/white-label",
  "/super-admin/support",
  "/super-admin/security",
  "/super-admin/analytics",
  "/super-admin/monitoring",
  "/super-admin/backups",
  "/super-admin/audit-logs",
  "/super-admin/feature-flags"
] as const;

const superAdminMenuHrefs = [
  "/super-admin",
  "/super-admin/organizations",
  "/super-admin/gyms",
  "/super-admin/domains",
  "/super-admin/subscriptions",
  "/super-admin/billing",
  "/super-admin/users",
  "/super-admin/roles",
  "/super-admin/settings",
  "/super-admin/white-label",
  "/super-admin/support",
  "/super-admin/security",
  "/super-admin/analytics",
  "/super-admin/monitoring",
  "/super-admin/backups",
  "/super-admin/audit-logs",
  "/super-admin/feature-flags"
] as const;

const dashboardLabels = [
  "Total Organizations",
  "Total Gyms",
  "Total Branches",
  "Total Staff",
  "Total Trainers",
  "Total Members",
  "Active Subscriptions",
  "Expired Subscriptions",
  "Monthly Revenue",
  "Annual Revenue",
  "System Alerts",
  "Backup Jobs",
  "Platform Health",
  "Recent Activity",
  "Security Alerts"
] as const;

test.use({ screenshot: "on", serviceWorkers: "block", trace: "on", video: "on" });

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

async function loginAsSuperAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(superAdminEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expectPath(page, "/super-admin");
}

async function gotoAuditedRoute(page: Page, route: string): Promise<RouteTiming> {
  const startedAt = performance.now();
  const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch((error: Error) => {
    if (!error.message.includes("ERR_ABORTED") && !error.message.includes("frame was detached")) {
      throw error;
    }
    return null;
  });
  return {
    route,
    status: response?.status() ?? null,
    durationMs: Math.round(performance.now() - startedAt)
  };
}

async function getPortalMenuHrefs(page: Page) {
  return page.locator('nav[aria-label="Portal"] a').evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname));
}

async function getInternalHrefs(page: Page) {
  return page.locator("a[href]").evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname));
}

test.describe("Super Admin QA audit", () => {
  test("authorization, dashboard, session persistence, and navigation are stable", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const audit = setupAudit(page);

    await page.goto("/super-admin");
    await expectPath(page, "/login");
    expect(new URL(page.url()).searchParams.get("next")).toBe("/super-admin");

    const loginStartedAt = performance.now();
    await loginAsSuperAdmin(page);
    const loginDurationMs = Math.round(performance.now() - loginStartedAt);

    await expect(page.locator("header").getByText("Super Admin Console")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Platform Control Center" })).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);

    for (const label of dashboardLabels) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    const menuHrefs = await getPortalMenuHrefs(page);
    expect(menuHrefs).toEqual(superAdminMenuHrefs);

    const internalHrefs = await getInternalHrefs(page);
    expect(internalHrefs.filter((href) => href === "/admin" || href.startsWith("/admin/"))).toEqual([]);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectPath(page, "/super-admin");
    await expect(page.getByRole("heading", { name: "Platform Control Center" })).toBeVisible();

    await page.goto("/admin/settings", { waitUntil: "domcontentloaded" });
    await expectPath(page, "/super-admin");

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("super-admin-dashboard.png") });
    await attachAudit(testInfo, "super-admin-dashboard-audit", audit, { loginDurationMs, menuHrefs });
    await expectNoClientCrashes(audit);
  });

  test("all implemented Super Admin modules load without server render failures", async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const audit = setupAudit(page);
    const timings: RouteTiming[] = [];

    await loginAsSuperAdmin(page);

    for (const route of superAdminRoutes) {
      const timing = await gotoAuditedRoute(page, route);
      timings.push(timing);
      await expectPath(page, route);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
    }

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("super-admin-last-module.png") });
    await attachAudit(testInfo, "super-admin-module-route-audit", audit, { timings });
    await expectNoClientCrashes(audit);
  });

  test("implemented Super Admin forms validate unsafe input and support safe create workflow", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const audit = setupAudit(page);
    const suffix = Date.now().toString(36);
    const organizationName = `QA Super Admin ${suffix}`;
    const organizationSlug = `qa-super-admin-${suffix}`;
    const gymName = `QA Gym ${suffix}`;
    const gymSlug = `qa-gym-${suffix}`;

    await loginAsSuperAdmin(page);

    await page.goto("/super-admin/organizations", { waitUntil: "domcontentloaded" });
    const organizationForm = page.locator("form").filter({ hasText: "Save Organization" });
    await organizationForm.getByLabel("Name").fill(`Bad JSON ${suffix}`);
    await organizationForm.getByLabel("Slug").fill(`bad-json-${suffix}`);
    await organizationForm.getByLabel("Billing email").fill(`qa-${suffix}@example.com`);
    const settingsJson = organizationForm.locator("#org-settings");
    await settingsJson.fill("{invalid");
    await expect(settingsJson).toHaveValue("{invalid");
    await organizationForm.getByRole("button", { name: "Save Organization" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Enter valid JSON." })).toBeVisible();

    await organizationForm.getByLabel("Name").fill(organizationName);
    await organizationForm.getByLabel("Slug").fill(organizationSlug);
    await organizationForm.getByLabel("Billing email").fill(`qa-${suffix}@example.com`);
    await settingsJson.fill('{"qa":true,"source":"playwright"}');
    await organizationForm.getByRole("button", { name: "Save Organization" }).click();
    await expect(page.getByText("Organization created.")).toBeVisible({ timeout: 30_000 });

    await page.goto("/super-admin/gyms", { waitUntil: "domcontentloaded" });
    const gymForm = page.locator("form").filter({ hasText: "Save Gym" });
    await gymForm.getByLabel("Organization").selectOption({ label: organizationName });
    await gymForm.getByLabel("Name").fill(gymName);
    await gymForm.getByLabel("Slug").fill(gymSlug);
    await gymForm.getByLabel("Timezone").fill("Asia/Kolkata");
    await gymForm.getByLabel("Currency").fill("INR");
    await gymForm.getByRole("button", { name: "Save Gym" }).click();
    await expect(page.getByText("Gym created.")).toBeVisible({ timeout: 30_000 });

    await page.goto("/super-admin/domains", { waitUntil: "domcontentloaded" });
    const domainForm = page.locator("form").filter({ hasText: "Save Tenant Domain" });
    await domainForm.locator('select[name="organizationId"]').selectOption({ label: organizationName });
    await domainForm.locator("#tenant-domain").fill("not-a-full-domain");
    await domainForm.getByRole("button", { name: "Save Tenant Domain" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Enter a full domain such as apexfit.com or bandra.apexfit.com." })).toBeVisible();

    await attachAudit(testInfo, "super-admin-form-workflow-audit", audit, { organizationSlug, gymSlug });
    await expectNoClientCrashes(audit);
  });

  test("Super Admin APIs reject malformed privileged requests cleanly", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const audit = setupAudit(page);

    await loginAsSuperAdmin(page);

    const malformedDomainCheck = await page.request.post("/api/enterprise/domains/check", {
      data: { domainId: "not-a-uuid", role: "super_admin" }
    });
    expect(malformedDomainCheck.status()).toBe(400);
    await expect(malformedDomainCheck.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" }
    });

    const missingDomain = await page.request.post("/api/enterprise/domains/check", {
      data: { domainId: "00000000-0000-0000-0000-000000000000" }
    });
    expect(missingDomain.status()).toBe(404);
    await expect(missingDomain.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "DOMAIN_NOT_FOUND" }
    });

    await attachAudit(testInfo, "super-admin-api-security-audit", audit);
    await expectNoClientCrashes(audit);
  });
});
