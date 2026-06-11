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

type RlsSnapshot = {
  organizationSlugs: string[];
  gymSlugs: string[];
  branchSlugs: string[];
  tenantConfigKeys: string[];
  tenantDomains: string[];
  branchUserRoles: string[];
};

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const organizationOwnerEmail = readEnv("E2E_ORGANIZATION_OWNER_EMAIL") ?? "hthitame+qa.owner@gmail.com";
const publicSupabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const publicSupabaseAnonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

const organizationOwnerRoutes = [
  "/organization",
  "/organization/gyms",
  "/organization/staff",
  "/organization/members",
  "/organization/memberships",
  "/organization/revenue",
  "/organization/trainers",
  "/organization/attendance",
  "/organization/classes",
  "/organization/communications",
  "/organization/analytics",
  "/organization/branding",
  "/organization/domains",
  "/organization/billing",
  "/organization/settings",
  "/organization/security"
] as const;

const organizationOwnerMenuHrefs = [...organizationOwnerRoutes] as const;

const dashboardLabels = [
  "Total Gyms",
  "Total Branches",
  "Total Staff",
  "Total Trainers",
  "Total Members",
  "Active Memberships",
  "Expiring Memberships",
  "Revenue",
  "Attendance",
  "Growth Metrics",
  "Notifications",
  "Recent Activity",
  "Security Alerts",
  "Top Branch Performance"
] as const;

const blockedRoutes = ["/super-admin", "/admin", "/admin/settings", "/reception", "/trainer", "/member"] as const;

const reportEndpoints = [
  "/api/analytics/reports?key=executive_kpi_snapshot&format=csv",
  "/api/attendance/reports?type=daily&format=csv",
  "/api/classes/reports?type=bookings&format=csv",
  "/api/fitness/reports?type=goal_progress&format=csv",
  "/api/memberships/reports?type=active",
  "/api/training/reports?type=sessions"
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

async function loginAsOrganizationOwner(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(organizationOwnerEmail);
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
  return {
    route,
    status: response?.status() ?? null,
    durationMs: Math.round(performance.now() - startedAt)
  };
}

async function getPortalMenuHrefs(page: Page) {
  return page.locator('nav[aria-label="Portal"] a').evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname));
}

async function getPortalMenuText(page: Page) {
  return page.locator('nav[aria-label="Portal"]').innerText();
}

async function rawSupabaseSignIn() {
  if (!publicSupabaseUrl || !publicSupabaseAnonKey) {
    throw new Error("Missing Supabase public env for Organization Owner RLS audit.");
  }

  const response = await fetch(`${publicSupabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: publicSupabaseAnonKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({ email: organizationOwnerEmail, password })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.msg || `Supabase auth failed with ${response.status}`);
  }
  return payload.access_token as string;
}

async function rawSupabaseSelect<T>(token: string, table: string, select: string, filter?: string) {
  if (!publicSupabaseUrl || !publicSupabaseAnonKey) {
    throw new Error("Missing Supabase public env for Organization Owner RLS audit.");
  }

  const query = `${publicSupabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}${filter ? `&${filter}` : ""}`;
  const response = await fetch(query, {
    headers: {
      apikey: publicSupabaseAnonKey,
      authorization: `Bearer ${token}`
    }
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || `Supabase REST failed with ${response.status}`);
  }
  return payload as T[];
}

function readEnv(name: string) {
  return process.env[name] ?? localEnv[name] ?? null;
}

function requiredEnv(name: string) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readLocalEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    return Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          const key = line.slice(0, index).trim();
          const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
          return [key, value];
        })
    );
  } catch {
    return {} as Record<string, string>;
  }
}

async function getRlsSnapshot(): Promise<RlsSnapshot> {
  const token = await rawSupabaseSignIn();
  const organizations = await rawSupabaseSelect<{ slug: string }>(token, "organizations", "slug");
  const gyms = await rawSupabaseSelect<{ slug: string }>(token, "gyms", "slug");
  const branches = await rawSupabaseSelect<{ slug: string }>(token, "branches", "slug");
  const tenantConfigs = await rawSupabaseSelect<{ tenant_key: string }>(token, "tenant_configs", "tenant_key");
  const tenantDomains = await rawSupabaseSelect<{ domain: string }>(token, "tenant_domains", "domain");
  const branchUsers = await rawSupabaseSelect<{ role_name: string; access_scope: string; branch_role: string; status: string }>(token, "branch_users", "role_name,access_scope,branch_role,status");

  return {
    organizationSlugs: organizations.map((row) => row.slug).sort(),
    gymSlugs: gyms.map((row) => row.slug).sort(),
    branchSlugs: branches.map((row) => row.slug).sort(),
    tenantConfigKeys: tenantConfigs.map((row) => row.tenant_key).sort(),
    tenantDomains: tenantDomains.map((row) => row.domain).sort(),
    branchUserRoles: branchUsers.map((row) => `${row.role_name}:${row.access_scope}:${row.branch_role}:${row.status}`).sort()
  };
}

test.describe("Organization Owner QA audit", () => {
  test("authorization, dashboard KPIs, menu, and session persistence are stable", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const audit = setupAudit(page);

    await page.goto("/organization");
    await expectPath(page, "/login");
    expect(new URL(page.url()).searchParams.get("next")).toBe("/organization");

    const loginStartedAt = performance.now();
    await loginAsOrganizationOwner(page);
    const loginDurationMs = Math.round(performance.now() - loginStartedAt);

    await expect(page.locator("header").getByText("Organization Command Center")).toBeVisible();
    await expect(page.locator("header")).toContainText("organization owner");
    await expect(page.getByRole("heading", { name: "Organization Command Center" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Apex Performance Club" })).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);

    for (const label of dashboardLabels) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    const menuHrefs = await getPortalMenuHrefs(page);
    expect(menuHrefs).toEqual(organizationOwnerMenuHrefs);

    const menuText = await getPortalMenuText(page);
    expect(menuText).not.toMatch(/Super Admin|Platform Settings|System Monitoring|Role Management|Global Billing/i);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectPath(page, "/organization");
    await expect(page.locator("header").getByText("Organization Command Center")).toBeVisible();

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("organization-owner-dashboard.png") });
    await attachAudit(testInfo, "organization-owner-dashboard-audit", audit, { loginDurationMs, menuHrefs });
    await expectNoClientCrashes(audit);
  });

  test("all implemented Organization Owner module routes load without server render failures", async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const audit = setupAudit(page);
    const timings: RouteTiming[] = [];

    await loginAsOrganizationOwner(page);

    for (const route of organizationOwnerRoutes) {
      const timing = await gotoAuditedRoute(page, route);
      timings.push(timing);
      await expectPath(page, route);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
    }

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("organization-owner-last-module.png") });
    await attachAudit(testInfo, "organization-owner-module-route-audit", audit, { timings });
    await expectNoClientCrashes(audit);
  });

  test("restricted portals are blocked and report exports stay tenant scoped", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const audit = setupAudit(page);
    const reportResults: Array<{ endpoint: string; status: number; code: string | null }> = [];

    await loginAsOrganizationOwner(page);

    for (const route of blockedRoutes) {
      await gotoAuditedRoute(page, route);
      await expect.poll(() => currentPath(page), { timeout: 30_000 }).toBe("/organization");
      await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
    }

    const malformedDomainCheck = await page.request.post("/api/enterprise/domains/check", {
      data: { domainId: "not-a-uuid", role: "super_admin" }
    });
    expect(malformedDomainCheck.status()).toBe(400);

    for (const endpoint of reportEndpoints) {
      const response = await page.request.get(endpoint);
      const payload = await response.json().catch(() => null) as { error?: { code?: string } } | null;
      reportResults.push({ endpoint, status: response.status(), code: payload?.error?.code ?? null });
      expect([200, 403]).toContain(response.status());
      if (response.status() === 403) {
        expect(payload).toMatchObject({ ok: false, error: { code: "TENANT_SCOPE_REQUIRED" } });
      } else {
        expect(response.headers()["content-disposition"]).toMatch(/filename=/);
      }
    }

    await attachAudit(testInfo, "organization-owner-security-audit", audit, { blockedRoutes, reportResults });
    await expectNoClientCrashes(audit);
  });

  test("Supabase RLS limits Organization Owner to the owned organization", async ({}, testInfo) => {
    test.setTimeout(60_000);
    const snapshot = await getRlsSnapshot();

    expect(snapshot.organizationSlugs).toEqual(["apex-performance-club"]);
    expect(snapshot.organizationSlugs).not.toEqual(expect.arrayContaining(["rbac-qa-organization-b", "rbac-qa-organization-c"]));
    expect(snapshot.gymSlugs).toEqual(expect.arrayContaining(["apex-performance-club"]));
    expect(snapshot.gymSlugs).not.toEqual(expect.arrayContaining(["rbac-qa-gym-b1", "rbac-qa-gym-c1"]));
    expect(snapshot.branchSlugs).not.toEqual(expect.arrayContaining(["rbac-qa-branch-b1", "rbac-qa-branch-c1"]));
    expect(snapshot.tenantConfigKeys).not.toEqual(expect.arrayContaining(["rbac-qa-organization-b", "rbac-qa-organization-c"]));

    await testInfo.attach("organization-owner-rls-snapshot", {
      body: JSON.stringify(snapshot, null, 2),
      contentType: "application/json"
    });
  });
});
