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
  leadGymIds: string[];
};

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const receptionEmail = readEnv("E2E_RECEPTION_EMAIL") ?? "hthitame+qa.reception@gmail.com";
const publicSupabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const publicSupabaseAnonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

const receptionRoutes = [
  "/reception",
  "/reception/members",
  "/reception/register",
  "/reception/attendance",
  "/reception/payments",
  "/reception/classes",
  "/reception/messages"
] as const;

const dashboardLabels = [
  "Today's Check-Ins",
  "Today's Registrations",
  "Pending Renewals",
  "Today's Payments",
  "Today's Leads",
  "Appointments",
  "Upcoming Classes",
  "Recent Activities"
] as const;

const quickActionLabels = ["Register Member", "Check In", "Collect Payment", "Book Class", "Send Reminder"] as const;

const moduleExpectations = [
  { route: "/reception/members", labels: ["Member support desk", "Search Members", "Member Support"] },
  { route: "/reception/register", labels: ["Member registration", "Quick Member Registration"] },
  { route: "/reception/attendance", labels: ["Attendance desk", "Manual Check-In", "QR Check-In", "Live Checkout"] },
  { route: "/reception/payments", labels: ["Payment collection", "Pending Dues", "Payment History"] },
  { route: "/reception/classes", labels: ["Class booking desk", "Upcoming Classes", "Upcoming Sessions"] },
  { route: "/reception/messages", labels: ["Front desk messages", "Send Member Reminder", "Recent Communication History"] }
] as const;

const blockedRoutes = [
  "/super-admin",
  "/organization",
  "/admin",
  "/admin/settings",
  "/admin/trainers",
  "/admin/staff",
  "/admin/reports",
  "/trainer",
  "/member"
] as const;

const forbiddenMenuLabels = [/Analytics/i, /Staff/i, /Settings/i, /Reports/i, /Revenue/i, /Inventory/i, /Trainers/i];

const restrictedEndpoints = [
  "/api/analytics/reports?key=executive_kpi_snapshot&format=csv",
  "/api/attendance/reports?type=daily&format=csv",
  "/api/classes/reports?type=bookings&format=csv",
  "/api/fitness/reports?type=goal_progress&format=csv",
  "/api/memberships/reports?type=active",
  "/api/training/reports?type=sessions",
  "/api/enterprise/domains/check"
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

async function loginAsReception(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(receptionEmail);
  await page.getByLabel("Password").fill(password);
  const signInButton = page.getByRole("button", { name: /sign in/i });
  await expect(signInButton).toBeEnabled({ timeout: 10_000 });
  await signInButton.click();
  await expectPath(page, "/reception");
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
    throw new Error("Missing Supabase public env for Reception Staff RLS audit.");
  }

  const response = await fetch(`${publicSupabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: {
      apikey: publicSupabaseAnonKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({ email: receptionEmail, password })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.msg || `Supabase auth failed with ${response.status}`);
  }

  return payload.access_token as string;
}

async function rawSupabaseSelect<T>(token: string, table: string, select: string) {
  if (!publicSupabaseUrl || !publicSupabaseAnonKey) {
    throw new Error("Missing Supabase public env for Reception Staff RLS audit.");
  }

  const response = await fetch(`${publicSupabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
    signal: AbortSignal.timeout(20_000),
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
  const [organizations, gyms, branches, tenantConfigs, branchUsers, members, trainers, payments, leads] = await Promise.all([
    rawSupabaseSelect<{ slug: string }>(token, "organizations", "slug"),
    rawSupabaseSelect<{ id: string; slug: string }>(token, "gyms", "id,slug"),
    rawSupabaseSelect<{ slug: string }>(token, "branches", "slug"),
    rawSupabaseSelect<{ tenant_key: string }>(token, "tenant_configs", "tenant_key"),
    rawSupabaseSelect<{ role_name: string; access_scope: string; branch_role: string; status: string }>(token, "branch_users", "role_name,access_scope,branch_role,status"),
    rawSupabaseSelect<{ gyms: { slug: string } | null }>(token, "members", "gyms(slug)"),
    rawSupabaseSelect<{ gyms: { slug: string } | null }>(token, "trainers", "gyms(slug)"),
    rawSupabaseSelect<{ gyms: { slug: string } | null }>(token, "payments", "gyms(slug)"),
    rawSupabaseSelect<{ gym_id: string | null }>(token, "leads", "gym_id")
  ]);

  return {
    organizationSlugs: organizations.map((row) => row.slug).sort(),
    gymSlugs: gyms.map((row) => row.slug).sort(),
    branchSlugs: branches.map((row) => row.slug).sort(),
    tenantConfigKeys: tenantConfigs.map((row) => row.tenant_key).sort(),
    branchUserRoles: branchUsers.map((row) => `${row.role_name}:${row.access_scope}:${row.branch_role}:${row.status}`).sort(),
    memberGymSlugs: uniqueSlugs(members.map((row) => row.gyms?.slug)),
    trainerGymSlugs: uniqueSlugs(trainers.map((row) => row.gyms?.slug)),
    paymentGymSlugs: uniqueSlugs(payments.map((row) => row.gyms?.slug)),
    leadGymIds: uniqueSlugs(leads.map((row) => row.gym_id))
  };
}

function uniqueSlugs(slugs: Array<string | null | undefined>) {
  return Array.from(new Set(slugs.filter((slug): slug is string => Boolean(slug)))).sort();
}

test.describe("Reception Staff QA audit", () => {
  test("authorization, dashboard KPIs, menu, quick actions, and session persistence are stable", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const audit = setupAudit(page);

    await page.goto("/reception");
    await expectPath(page, "/login");
    expect(new URL(page.url()).searchParams.get("next")).toBe("/reception");

    const loginStartedAt = performance.now();
    await loginAsReception(page);
    const loginDurationMs = Math.round(performance.now() - loginStartedAt);

    await expect(page.locator("header").getByText("Reception Portal")).toBeVisible();
    await expect(page.locator("header")).toContainText("reception staff");
    await expect(page.getByRole("heading", { name: "Today at reception" })).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);

    for (const label of dashboardLabels) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    for (const label of quickActionLabels) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    const menuHrefs = await getPortalMenuHrefs(page);
    expect(menuHrefs).toEqual(receptionRoutes);

    const menuText = await getPortalMenuText(page);
    for (const forbiddenLabel of forbiddenMenuLabels) {
      expect(menuText).not.toMatch(forbiddenLabel);
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectPath(page, "/reception");
    await expect(page.getByRole("heading", { name: "Today at reception" })).toBeVisible();

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("reception-dashboard.png") });
    await attachAudit(testInfo, "reception-dashboard-audit", audit, { loginDurationMs, menuHrefs });
    await expectNoClientCrashes(audit);
  });

  test("all implemented Reception module routes load and expose front-desk operational surfaces", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const audit = setupAudit(page);
    const timings: RouteTiming[] = [];

    await loginAsReception(page);

    for (const route of receptionRoutes) {
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

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("reception-last-module.png") });
    await attachAudit(testInfo, "reception-module-route-audit", audit, {
      timings,
      featureCoverage: {
        registration: "implemented: member onboarding form is available to reception staff and scoped to assigned gym.",
        attendance: "implemented: manual check-in, QR check-in, and checkout actions allow reception_staff.",
        payments: "partial: reception can review pending dues and receipts; standalone ad-hoc payment collection remains a gap.",
        leads: "partial: lead metrics are surfaced; dedicated lead CRUD workspace remains a gap.",
        appointments: "not implemented: no appointment schema or route exists in this codebase.",
        tasks: "not implemented: daily work queue is metric-backed, but no persistent task schema exists."
      }
    });
    await expectNoClientCrashes(audit);
  });

  test("restricted portals and privileged APIs are blocked for Reception Staff", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const audit = setupAudit(page);
    const endpointResults: Array<{ endpoint: string; method: "GET" | "POST"; status: number; code: string | null }> = [];
    const blockedRouteResults: Array<{ route: string; status: number; location: string | undefined }> = [];

    await loginAsReception(page);

    for (const route of blockedRoutes) {
      const response = await page.request.get(route, { maxRedirects: 0, timeout: 20_000 });
      const location = response.headers().location;
      blockedRouteResults.push({ route, status: response.status(), location });
      expect([303, 307, 308]).toContain(response.status());
      expect(location).toContain("/reception");
    }

    for (const endpoint of restrictedEndpoints) {
      const response = endpoint.endsWith("/check")
        ? await page.request.post(endpoint, { data: { domainId: "00000000-0000-0000-0000-000000000000" } })
        : await page.request.get(endpoint);
      const payload = await response.json().catch(() => null) as { error?: { code?: string } } | null;
      endpointResults.push({
        endpoint,
        method: endpoint.endsWith("/check") ? "POST" : "GET",
        status: response.status(),
        code: payload?.error?.code ?? null
      });
      expect(response.status()).toBe(403);
    }

    const menuText = await getPortalMenuText(page);
    for (const forbiddenLabel of forbiddenMenuLabels) {
      expect(menuText).not.toMatch(forbiddenLabel);
    }

    await attachAudit(testInfo, "reception-security-audit", audit, { blockedRouteResults, endpointResults });
    await expectNoClientCrashes(audit);
  });

  test("Supabase RLS limits Reception Staff to the assigned organization, branch, gym, and operational rows", async ({}, testInfo) => {
    test.setTimeout(120_000);
    const snapshot = await getRlsSnapshot();

    expect(snapshot.organizationSlugs).toEqual(["apex-performance-club"]);
    expect(snapshot.organizationSlugs).not.toEqual(expect.arrayContaining(["rbac-qa-organization-b", "rbac-qa-organization-c"]));
    expect(snapshot.gymSlugs).toEqual(["apex-performance-club"]);
    expect(snapshot.gymSlugs).not.toEqual(expect.arrayContaining(["rbac-qa-apex-second-gym", "rbac-qa-gym-b1", "rbac-qa-gym-c1"]));
    expect(snapshot.branchSlugs).toEqual(["baner-flagship"]);
    expect(snapshot.tenantConfigKeys).toEqual([]);
    expect(snapshot.branchUserRoles).toEqual(["reception_staff:single_branch:staff:active"]);
    expect(snapshot.memberGymSlugs).toEqual(["apex-performance-club"]);
    expect(snapshot.trainerGymSlugs).toEqual(["apex-performance-club"]);
    if (snapshot.paymentGymSlugs.length > 0) {
      expect(snapshot.paymentGymSlugs).toEqual(["apex-performance-club"]);
    }
    if (snapshot.leadGymIds.length > 0) {
      expect(snapshot.leadGymIds).toHaveLength(1);
    }

    await testInfo.attach("reception-rls-snapshot", {
      body: JSON.stringify(snapshot, null, 2),
      contentType: "application/json"
    });
  });
});
