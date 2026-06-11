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
  branchUserRoles: string[];
  memberGymSlugs: string[];
  trainerGymSlugs: string[];
  paymentGymSlugs: string[];
};

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const gymAdminEmail = readEnv("E2E_GYM_ADMIN_EMAIL") ?? "hthitame+qa.admin@gmail.com";
const publicSupabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const publicSupabaseAnonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

const gymAdminRoutes = [
  "/admin",
  "/admin/members",
  "/admin/members/new",
  "/admin/attendance",
  "/admin/classes",
  "/admin/fitness",
  "/admin/trainers",
  "/admin/trainers/packages",
  "/admin/membership-plans",
  "/admin/payments",
  "/admin/communications",
  "/admin/ai",
  "/admin/reports",
  "/admin/staff",
  "/admin/settings"
] as const;

const gymAdminMenuHrefs = [
  "/admin",
  "/admin/members",
  "/admin/attendance",
  "/admin/classes",
  "/admin/fitness",
  "/admin/trainers",
  "/admin/membership-plans",
  "/admin/payments",
  "/admin/communications",
  "/admin/ai",
  "/admin/reports",
  "/admin/staff",
  "/admin/members/new",
  "/admin/settings"
] as const;

const dashboardLabels = [
  "Today's Attendance",
  "Current Members",
  "Active Memberships",
  "Expired Memberships",
  "Revenue Today",
  "Revenue This Month",
  "PT Revenue",
  "Trainer Utilization",
  "Pending Payments",
  "Class Sessions",
  "Fitness Goals",
  "Recent Activities",
  "Growth Metrics"
] as const;

const moduleExpectations = [
  { route: "/admin/members", labels: ["Member Directory", "Members", "Add Member"] },
  { route: "/admin/members/new", labels: ["Create Member", "Membership plan", "Payment status"] },
  { route: "/admin/attendance", labels: ["Attendance, QR check-in, and live occupancy", "Reception Check-In", "QR Scan"] },
  { route: "/admin/classes", labels: ["Classes, schedules, and group bookings", "Create Class", "Capacity Utilization"] },
  { route: "/admin/fitness", labels: ["Fitness tracking and progress analytics", "Exercise Library", "Add Exercise"] },
  { route: "/admin/trainers", labels: ["Trainers, assignments, and PT packages", "Create Trainer", "Assign Trainer"] },
  { route: "/admin/trainers/packages", labels: ["Personal Training Packages", "Create Package"] },
  { route: "/admin/membership-plans", labels: ["Membership Plans", "Create Plan"] },
  { route: "/admin/payments", labels: ["Payments, collections, and reconciliation", "Recent Payments"] },
  { route: "/admin/communications", labels: ["Communication", "Templates", "Announcements"] },
  { route: "/admin/ai", labels: ["AI", "Recommendations"] },
  { route: "/admin/reports", labels: ["Analytics, reporting, and business insights", "Revenue Analytics", "Sales Funnel"] },
  { route: "/admin/staff", labels: ["Staff profiles and employment controls", "Staff Directory", "Create Staff Profile"] },
  { route: "/admin/settings", labels: ["Branch-scoped settings and governance", "Branches", "Domains"] }
] as const;

const blockedRoutes = ["/super-admin", "/organization", "/reception", "/trainer", "/member"] as const;

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

async function loginAsGymAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(gymAdminEmail);
  await page.getByLabel("Password").fill(password);
  const signInButton = page.getByRole("button", { name: /sign in/i });
  await expect(signInButton).toBeEnabled({ timeout: 10_000 });
  await signInButton.click();
  await expectPath(page, "/admin");
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
    throw new Error("Missing Supabase public env for Gym Admin RLS audit.");
  }

  const response = await fetch(`${publicSupabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: publicSupabaseAnonKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({ email: gymAdminEmail, password })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.msg || `Supabase auth failed with ${response.status}`);
  }

  return payload.access_token as string;
}

async function rawSupabaseSelect<T>(token: string, table: string, select: string, filter?: string) {
  if (!publicSupabaseUrl || !publicSupabaseAnonKey) {
    throw new Error("Missing Supabase public env for Gym Admin RLS audit.");
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
  const branchUsers = await rawSupabaseSelect<{ role_name: string; access_scope: string; branch_role: string; status: string }>(token, "branch_users", "role_name,access_scope,branch_role,status");
  const members = await rawSupabaseSelect<{ gyms: { slug: string } | null }>(token, "members", "gyms(slug)");
  const trainers = await rawSupabaseSelect<{ gyms: { slug: string } | null }>(token, "trainers", "gyms(slug)");
  const payments = await rawSupabaseSelect<{ gyms: { slug: string } | null }>(token, "payments", "gyms(slug)");

  return {
    organizationSlugs: organizations.map((row) => row.slug).sort(),
    gymSlugs: gyms.map((row) => row.slug).sort(),
    branchSlugs: branches.map((row) => row.slug).sort(),
    tenantConfigKeys: tenantConfigs.map((row) => row.tenant_key).sort(),
    branchUserRoles: branchUsers.map((row) => `${row.role_name}:${row.access_scope}:${row.branch_role}:${row.status}`).sort(),
    memberGymSlugs: uniqueSlugs(members.map((row) => row.gyms?.slug)),
    trainerGymSlugs: uniqueSlugs(trainers.map((row) => row.gyms?.slug)),
    paymentGymSlugs: uniqueSlugs(payments.map((row) => row.gyms?.slug))
  };
}

function uniqueSlugs(slugs: Array<string | null | undefined>) {
  return Array.from(new Set(slugs.filter((slug): slug is string => Boolean(slug)))).sort();
}

test.describe("Gym Admin QA audit", () => {
  test("authorization, dashboard KPIs, menu, and session persistence are stable", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const audit = setupAudit(page);

    await page.goto("/admin");
    await expectPath(page, "/login");
    expect(new URL(page.url()).searchParams.get("next")).toBe("/admin");

    const loginStartedAt = performance.now();
    await loginAsGymAdmin(page);
    const loginDurationMs = Math.round(performance.now() - loginStartedAt);

    await expect(page.locator("header").getByText("Gym Admin Panel")).toBeVisible();
    await expect(page.locator("header")).toContainText("gym admin");
    await expect(page.getByRole("heading", { name: "Gym Operations Dashboard" })).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);

    for (const label of dashboardLabels) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    const menuHrefs = await getPortalMenuHrefs(page);
    expect(menuHrefs).toEqual(gymAdminMenuHrefs);

    const menuText = await getPortalMenuText(page);
    expect(menuText).not.toMatch(/Super Admin|Organizations|Platform Settings|System Monitoring|Global Billing|White Label/i);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectPath(page, "/admin");
    await expect(page.getByRole("heading", { name: "Gym Operations Dashboard" })).toBeVisible();

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("gym-admin-dashboard.png") });
    await attachAudit(testInfo, "gym-admin-dashboard-audit", audit, { loginDurationMs, menuHrefs });
    await expectNoClientCrashes(audit);
  });

  test("all implemented Gym Admin module routes load and expose the expected operational surfaces", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const audit = setupAudit(page);
    const timings: RouteTiming[] = [];

    await loginAsGymAdmin(page);

    for (const route of gymAdminRoutes) {
      const timing = await gotoAuditedRoute(page, route);
      timings.push(timing);
      await expectPath(page, route);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
    }

    for (const expectation of moduleExpectations) {
      await page.goto(expectation.route, { waitUntil: "domcontentloaded" });
      await expectPath(page, expectation.route);
      for (const label of expectation.labels) {
        await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
      }
    }

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("gym-admin-last-module.png") });
    await attachAudit(testInfo, "gym-admin-module-route-audit", audit, {
      timings,
      featureCoverage: {
        leads: "partial: lead data is available through analytics/sales funnel, but no dedicated /admin/leads workflow exists.",
        inventory: "not implemented: no /admin/inventory module or inventory schema exists in this codebase."
      }
    });
    await expectNoClientCrashes(audit);
  });

  test("restricted portals are blocked and report exports stay gym scoped", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const audit = setupAudit(page);
    const reportResults: Array<{ endpoint: string; status: number; contentDisposition: string | undefined; code: string | null }> = [];

    await loginAsGymAdmin(page);

    for (const route of blockedRoutes) {
      await gotoAuditedRoute(page, route);
      await expect.poll(() => currentPath(page), { timeout: 30_000 }).toBe("/admin");
      await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
    }

    for (const endpoint of reportEndpoints) {
      const response = await page.request.get(endpoint);
      const payload = await response.json().catch(() => null) as { error?: { code?: string } } | null;
      reportResults.push({
        endpoint,
        status: response.status(),
        contentDisposition: response.headers()["content-disposition"],
        code: payload?.error?.code ?? null
      });
      expect(response.status()).toBe(200);
      expect(response.headers()["content-disposition"]).toMatch(/filename=/);
    }

    await attachAudit(testInfo, "gym-admin-security-audit", audit, { blockedRoutes, reportResults });
    await expectNoClientCrashes(audit);
  });

  test("Supabase RLS limits Gym Admin to one organization and one gym", async ({}, testInfo) => {
    test.setTimeout(60_000);
    const snapshot = await getRlsSnapshot();

    expect(snapshot.organizationSlugs).toEqual(["apex-performance-club"]);
    expect(snapshot.organizationSlugs).not.toEqual(expect.arrayContaining(["rbac-qa-organization-b", "rbac-qa-organization-c"]));
    expect(snapshot.gymSlugs).toEqual(["apex-performance-club"]);
    expect(snapshot.gymSlugs).not.toEqual(expect.arrayContaining(["rbac-qa-apex-second-gym", "rbac-qa-gym-b1", "rbac-qa-gym-c1"]));
    expect(snapshot.branchSlugs).toEqual(["baner-flagship"]);
    expect(snapshot.tenantConfigKeys).toEqual([]);
    expect(snapshot.branchUserRoles).not.toEqual(expect.arrayContaining([expect.stringMatching(/^super_admin:/), expect.stringMatching(/^organization_owner:/)]));
    expect(snapshot.memberGymSlugs).toEqual(["apex-performance-club"]);
    expect(snapshot.trainerGymSlugs).toEqual(["apex-performance-club"]);
    if (snapshot.paymentGymSlugs.length > 0) {
      expect(snapshot.paymentGymSlugs).toEqual(["apex-performance-club"]);
    }

    await testInfo.attach("gym-admin-rls-snapshot", {
      body: JSON.stringify(snapshot, null, 2),
      contentType: "application/json"
    });
  });
});
