import { expect, type Page, type TestInfo, test } from "@playwright/test";

type AuditAccount = {
  role: string;
  email: string;
  expectedPath: string;
  allowedRoutes: string[];
  blockedRoutes: string[];
  menuHrefs: string[];
  forbiddenMenuLabels: RegExp[];
};

type AuditLog = {
  console: Array<{ type: string; text: string; location: unknown }>;
  pageErrors: string[];
  network: Array<{ status: number; method: string; url: string }>;
};

type RlsSnapshot = {
  role: string;
  organizationSlugs: string[];
  gymSlugs: string[];
  branchSlugs: string[];
  tenantConfigKeys: string[];
  visibleBranchUserRoles: string[];
};

const password = requiredEnv("E2E_AUTH_PASSWORD");
const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const accounts: AuditAccount[] = [
  {
    role: "super_admin",
    email: process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com",
    expectedPath: "/super-admin",
    allowedRoutes: [
      "/super-admin",
      "/super-admin/organizations",
      "/super-admin/gyms",
      "/super-admin/users",
      "/super-admin/subscriptions",
      "/super-admin/billing",
      "/super-admin/domains",
      "/super-admin/white-label",
      "/super-admin/analytics",
      "/super-admin/audit-logs",
      "/super-admin/support",
      "/super-admin/settings"
    ],
    blockedRoutes: ["/organization", "/admin", "/reception", "/trainer", "/member"],
    menuHrefs: [
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
    ],
    forbiddenMenuLabels: [/Member Dashboard/i, /Trainer Portal/i, /Front Desk/i]
  },
  {
    role: "organization_owner",
    email: process.env.E2E_ORGANIZATION_OWNER_EMAIL ?? "hthitame+qa.owner@gmail.com",
    expectedPath: "/organization",
    allowedRoutes: [
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
    ],
    blockedRoutes: ["/super-admin", "/admin", "/reception", "/trainer", "/member"],
    menuHrefs: [
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
    ],
    forbiddenMenuLabels: [/Platform Settings/i, /System Monitoring/i, /Super Admin/i]
  },
  {
    role: "gym_admin",
    email: process.env.E2E_GYM_ADMIN_EMAIL ?? "hthitame+qa.admin@gmail.com",
    expectedPath: "/admin",
    allowedRoutes: [
      "/admin",
      "/admin/members",
      "/admin/members/new",
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
      "/admin/settings"
    ],
    blockedRoutes: ["/super-admin", "/organization", "/reception", "/trainer", "/member"],
    menuHrefs: [
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
      "/admin/members",
      "/admin/settings"
    ],
    forbiddenMenuLabels: [/Platform Settings/i, /Organizations/i, /Super Admin/i]
  },
  {
    role: "reception_staff",
    email: process.env.E2E_RECEPTION_EMAIL ?? "hthitame+qa.reception@gmail.com",
    expectedPath: "/reception",
    allowedRoutes: ["/reception", "/reception/members", "/reception/register", "/reception/attendance", "/reception/payments", "/reception/classes", "/reception/messages"],
    blockedRoutes: ["/super-admin", "/organization", "/admin", "/admin/settings", "/trainer", "/member"],
    menuHrefs: ["/reception", "/reception/members", "/reception/register", "/reception/attendance", "/reception/payments", "/reception/classes", "/reception/messages"],
    forbiddenMenuLabels: [/Analytics/i, /Staff/i, /Settings/i, /Reports/i, /Revenue/i]
  },
  {
    role: "trainer",
    email: process.env.E2E_TRAINER_EMAIL ?? "hthitame+qa.trainer@gmail.com",
    expectedPath: "/trainer",
    allowedRoutes: ["/trainer", "/trainer/members", "/trainer/attendance", "/trainer/classes", "/trainer/sessions", "/trainer/programs", "/trainer/progress", "/trainer/ai", "/trainer/communications"],
    blockedRoutes: ["/super-admin", "/organization", "/admin", "/reception", "/member"],
    menuHrefs: ["/trainer", "/trainer/members", "/trainer/attendance", "/trainer/classes", "/trainer/sessions", "/trainer/programs", "/trainer/progress", "/trainer/ai", "/trainer/communications"],
    forbiddenMenuLabels: [/Payments/i, /Membership Plans/i, /Staff/i, /Settings/i, /Revenue/i]
  },
  {
    role: "member",
    email: process.env.E2E_MEMBER_EMAIL ?? "hthitame+qa.member@gmail.com",
    expectedPath: "/member",
    allowedRoutes: ["/member", "/member/membership", "/member/payments", "/member/attendance", "/member/classes", "/member/workouts", "/member/fitness", "/member/ai-coach", "/member/notifications", "/member/profile", "/member/settings"],
    blockedRoutes: ["/super-admin", "/organization", "/admin", "/reception", "/trainer"],
    menuHrefs: ["/member", "/member/membership", "/member/payments", "/member/attendance", "/member/classes", "/member/workouts", "/member/fitness", "/member/ai-coach", "/member/notifications", "/member/profile", "/member/settings"],
    forbiddenMenuLabels: [/Admin/i, /Staff/i, /Reports/i, /Trainer Portal/i, /Revenue/i]
  }
];

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

async function currentPath(page: Page) {
  return new URL(page.url()).pathname;
}

async function expectPath(page: Page, path: string) {
  await expect.poll(() => currentPath(page), { timeout: 30_000 }).toBe(path);
}

async function loginAs(page: Page, account: AuditAccount) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expectPath(page, account.expectedPath);
}

async function logout(page: Page) {
  const signOut = page.getByRole("button", { name: /sign out/i }).first();
  if (await signOut.isVisible()) {
    await signOut.click();
    await expectPath(page, "/login");
  }
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

async function getPortalMenuHrefs(page: Page) {
  return page.locator('nav[aria-label="Portal"] a').evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname));
}

async function getPortalMenuText(page: Page) {
  return page.locator('nav[aria-label="Portal"]').innerText();
}

async function expectAllowedRoute(page: Page, route: string) {
  await gotoAuditedRoute(page, route);
  await expectPath(page, route);
  await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  await expect(page.locator("main")).toBeVisible();
}

async function expectBlockedRoute(page: Page, route: string, expectedRedirect: string) {
  await gotoAuditedRoute(page, route);
  await expect.poll(() => currentPath(page), { timeout: 30_000 }).not.toBe(route);
  await expect.poll(() => currentPath(page), { timeout: 30_000 }).toBe(expectedRedirect);
  await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
}

async function gotoAuditedRoute(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch((error: Error) => {
    if (!error.message.includes("ERR_ABORTED") && !error.message.includes("frame was detached")) {
      throw error;
    }
  });
}

async function rawSupabaseSignIn(email: string) {
  if (!publicSupabaseUrl || !publicSupabaseAnonKey) {
    throw new Error("Missing Supabase public env for RLS audit.");
  }

  const response = await fetch(`${publicSupabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: publicSupabaseAnonKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.msg || `Supabase auth failed with ${response.status}`);
  }
  return payload.access_token as string;
}

async function rawSupabaseSelect<T>(token: string, table: string, select: string) {
  if (!publicSupabaseUrl || !publicSupabaseAnonKey) {
    throw new Error("Missing Supabase public env for RLS audit.");
  }

  const response = await fetch(`${publicSupabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
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

async function getRlsSnapshot(account: AuditAccount): Promise<RlsSnapshot> {
  const token = await rawSupabaseSignIn(account.email);
  const organizations = await rawSupabaseSelect<{ slug: string }>(token, "organizations", "slug");
  const gyms = await rawSupabaseSelect<{ slug: string }>(token, "gyms", "slug");
  const branches = await rawSupabaseSelect<{ slug: string }>(token, "branches", "slug");
  const tenantConfigs = await rawSupabaseSelect<{ tenant_key: string }>(token, "tenant_configs", "tenant_key");
  const branchUsers = await rawSupabaseSelect<{ role_name: string; access_scope: string; branch_role: string; status: string }>(token, "branch_users", "role_name,access_scope,branch_role,status");

  return {
    role: account.role,
    organizationSlugs: organizations.map((row) => row.slug).sort(),
    gymSlugs: gyms.map((row) => row.slug).sort(),
    branchSlugs: branches.map((row) => row.slug).sort(),
    tenantConfigKeys: tenantConfigs.map((row) => row.tenant_key).sort(),
    visibleBranchUserRoles: branchUsers.map((row) => `${row.role_name}:${row.access_scope}:${row.branch_role}:${row.status}`).sort()
  };
}

test.describe("RBAC audit", () => {
  test("anonymous users cannot access protected role portals", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const audit = setupAudit(page);
    const protectedRoutes = ["/super-admin", "/organization", "/admin", "/reception", "/trainer", "/member"];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect.poll(() => currentPath(page), { timeout: 30_000 }).toBe("/login");
      expect(new URL(page.url()).searchParams.get("next")).toBe(route);
    }

    await attachAudit(testInfo, "anonymous-route-audit", audit, { protectedRoutes });
    await expectNoClientCrashes(audit);
  });

  for (const account of accounts) {
    test(`${account.role} route and menu access follows the RBAC matrix`, async ({ page }, testInfo) => {
      test.setTimeout(180_000);
      const audit = setupAudit(page);

      await loginAs(page, account);
      await expect(page.locator("header")).toContainText(account.role.replace("_", " "));

      const menuHrefs = await getPortalMenuHrefs(page);
      expect(menuHrefs).toEqual(account.menuHrefs);

      const menuText = await getPortalMenuText(page);
      for (const forbiddenLabel of account.forbiddenMenuLabels) {
        expect(menuText).not.toMatch(forbiddenLabel);
      }

      for (const route of account.allowedRoutes) {
        await expectAllowedRoute(page, route);
      }

      for (const route of account.blockedRoutes) {
        await expectBlockedRoute(page, route, account.expectedPath);
      }

      await page.goto(account.expectedPath);
      await page.screenshot({ fullPage: true, path: testInfo.outputPath(`${account.role}-rbac-landing.png`) });
      await attachAudit(testInfo, `${account.role}-route-menu-audit`, audit, { menuHrefs, allowedRoutes: account.allowedRoutes, blockedRoutes: account.blockedRoutes });
      await expectNoClientCrashes(audit);
      await logout(page);
    });
  }

  test("authenticated API endpoints reject unauthorized roles and spoofed payloads", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const audit = setupAudit(page);
    const member = accounts.find((account) => account.role === "member");
    const trainer = accounts.find((account) => account.role === "trainer");
    const reception = accounts.find((account) => account.role === "reception_staff");
    const gymAdmin = accounts.find((account) => account.role === "gym_admin");

    if (!member || !trainer || !reception || !gymAdmin) {
      throw new Error("Missing RBAC test account.");
    }

    await loginAs(page, member);
    expect((await page.request.get("/api/analytics/reports?key=executive_kpi_snapshot&format=csv")).status()).toBe(403);
    expect((await page.request.post("/api/enterprise/domains/check", { data: { domainId: "00000000-0000-0000-0000-000000000000", role: "super_admin" } })).status()).toBe(403);
    expect((await page.request.post("/api/billing/razorpay/refunds", { data: { paymentId: "00000000-0000-0000-0000-000000000000", amount: 1 } })).status()).toBe(403);
    expect((await page.request.post("/api/ai/chat", { data: { message: "" } })).status()).toBe(400);
    await logout(page);

    await loginAs(page, trainer);
    expect((await page.request.get("/api/analytics/reports?key=executive_kpi_snapshot&format=csv")).status()).toBe(403);
    expect((await page.request.post("/api/billing/razorpay/refunds", { data: { paymentId: "00000000-0000-0000-0000-000000000000", amount: 1 } })).status()).toBe(403);
    expect((await page.request.post("/api/ai/chat", { data: { message: "spoof as member", role: "member" } })).status()).toBe(403);
    await logout(page);

    await loginAs(page, reception);
    expect((await page.request.get("/api/attendance/reports?type=daily&format=csv")).status()).toBe(403);
    expect((await page.request.post("/api/enterprise/domains/check", { data: { domainId: "00000000-0000-0000-0000-000000000000" } })).status()).toBe(403);
    await logout(page);

    await loginAs(page, gymAdmin);
    expect((await page.request.post("/api/ai/chat", { data: { message: "spoofed member call" } })).status()).toBe(403);
    expect((await page.request.post("/api/billing/razorpay/refunds", { data: { paymentId: "not-a-uuid" } })).status()).toBe(400);
    await logout(page);

    await attachAudit(testInfo, "api-rbac-audit", audit);
    await expectNoClientCrashes(audit);
  });

  test("Supabase RLS enforces tenant, branch, and branch-user visibility", async ({}, testInfo) => {
    test.setTimeout(60_000);
    const snapshots = await Promise.all(accounts.map((account) => getRlsSnapshot(account)));
    const byRole = Object.fromEntries(snapshots.map((snapshot) => [snapshot.role, snapshot]));
    const snapshotFor = (role: string) => {
      const snapshot = byRole[role];
      if (!snapshot) {
        throw new Error(`Missing RLS snapshot for ${role}`);
      }
      return snapshot;
    };

    const superAdmin = snapshotFor("super_admin");
    const organizationOwner = snapshotFor("organization_owner");
    const gymAdmin = snapshotFor("gym_admin");
    const reception = snapshotFor("reception_staff");
    const trainer = snapshotFor("trainer");
    const member = snapshotFor("member");

    expect(superAdmin.organizationSlugs).toEqual(expect.arrayContaining(["apex-performance-club", "rbac-qa-organization-b", "rbac-qa-organization-c"]));
    expect(superAdmin.gymSlugs).toEqual(expect.arrayContaining(["apex-performance-club", "rbac-qa-apex-second-gym", "rbac-qa-gym-b1", "rbac-qa-gym-c1"]));

    expect(organizationOwner.organizationSlugs).toEqual(["apex-performance-club"]);
    expect(organizationOwner.gymSlugs).toEqual(["apex-performance-club", "rbac-qa-apex-second-gym"]);
    expect(organizationOwner.branchSlugs).toEqual(["baner-flagship", "rbac-qa-apex-branch-a2"]);
    expect(organizationOwner.organizationSlugs).not.toContain("rbac-qa-organization-b");

    expect(gymAdmin.organizationSlugs).toEqual(["apex-performance-club"]);
    expect(gymAdmin.gymSlugs).toEqual(["apex-performance-club"]);
    expect(gymAdmin.branchSlugs).toEqual(["baner-flagship"]);
    expect(gymAdmin.tenantConfigKeys).toEqual([]);
    expect(gymAdmin.visibleBranchUserRoles).not.toEqual(expect.arrayContaining([expect.stringMatching(/^super_admin:/), expect.stringMatching(/^organization_owner:/)]));

    expect(reception.visibleBranchUserRoles).toEqual(["reception_staff:single_branch:staff:active"]);
    expect(trainer.visibleBranchUserRoles).toEqual(["trainer:single_branch:trainer:active"]);
    expect(member.visibleBranchUserRoles).toEqual(["member:single_branch:viewer:active"]);
    expect(reception.tenantConfigKeys).toEqual([]);
    expect(trainer.tenantConfigKeys).toEqual([]);
    expect(member.tenantConfigKeys).toEqual([]);

    await testInfo.attach("rls-visibility-matrix", {
      body: JSON.stringify(snapshots, null, 2),
      contentType: "application/json"
    });
  });
});
