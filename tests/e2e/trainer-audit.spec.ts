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
  gymIds: string[];
  gymSlugs: string[];
  branchSlugs: string[];
  tenantConfigKeys: string[];
  branchUserRoles: string[];
  trainerIds: string[];
  trainerGymIds: string[];
  assignmentTrainerIds: string[];
  assignmentGymIds: string[];
  memberGymIds: string[];
  sessionTrainerIds: string[];
  sessionGymIds: string[];
  programTrainerIds: string[];
  programGymIds: string[];
  programAssignmentTrainerIds: string[];
  programAssignmentGymIds: string[];
  noteTrainerIds: string[];
  noteGymIds: string[];
};

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const trainerEmail = readEnv("E2E_TRAINER_EMAIL") ?? "hthitame+qa.trainer@gmail.com";
const publicSupabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const publicSupabaseAnonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

const trainerRoutes = [
  "/trainer",
  "/trainer/members",
  "/trainer/attendance",
  "/trainer/classes",
  "/trainer/sessions",
  "/trainer/programs",
  "/trainer/progress",
  "/trainer/ai",
  "/trainer/communications"
] as const;

const dashboardLabels = [
  "Today's PT Sessions",
  "Assigned Members",
  "Active Clients",
  "Upcoming Appointments",
  "Pending Assessments",
  "Pending Reviews",
  "Workout Compliance",
  "Nutrition Compliance",
  "Progress Alerts",
  "Unread Messages"
] as const;

const moduleExpectations = [
  { route: "/trainer/members", labels: ["Assigned Members", "Trainer Notes"] },
  { route: "/trainer/attendance", labels: ["Assigned member visit trends", "Assigned Member Attendance", "Assigned Member Peak Hours"] },
  { route: "/trainer/classes", labels: ["Schedule, attendance, and class notes", "Assigned Sessions", "Attendance Queue"] },
  { route: "/trainer/sessions", labels: ["Schedule Session", "Upcoming Sessions"] },
  { route: "/trainer/programs", labels: ["Create Workout Program", "Assign Program", "Program Library", "Program Notes"] },
  { route: "/trainer/progress", labels: ["Member fitness progress", "Assigned Members", "Create Goal", "Log Workout", "Measurements", "Nutrition Plan", "Milestone"] },
  { route: "/trainer/ai", labels: ["AI-assisted coaching operations", "Member Risk and Recommendations", "Program Generator", "Recent AI Recommendations"] },
  { route: "/trainer/communications", labels: ["Member updates, reminders, and staff notices", "Message Assigned Members", "Staff Announcements", "Preferences and Timeline"] }
] as const;

const blockedRoutes = [
  "/super-admin",
  "/organization",
  "/admin",
  "/admin/settings",
  "/admin/members",
  "/admin/payments",
  "/admin/membership-plans",
  "/reception",
  "/member"
] as const;

const forbiddenMenuLabels = [/Payments/i, /Membership Plans/i, /Staff/i, /Settings/i, /Revenue/i, /Billing/i, /Reception/i];

const restrictedEndpoints = [
  "/api/analytics/reports?key=executive_kpi_snapshot&format=csv",
  "/api/attendance/reports?type=daily&format=csv",
  "/api/classes/reports?type=bookings&format=csv",
  "/api/fitness/reports?type=goal_progress&format=csv",
  "/api/memberships/reports?type=active",
  "/api/training/reports?type=sessions",
  "/api/billing/razorpay/refunds"
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

async function loginAsTrainer(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(trainerEmail);
  await page.getByLabel("Password").fill(password);
  const signInButton = page.getByRole("button", { name: /sign in/i });
  await expect(signInButton).toBeEnabled({ timeout: 10_000 });
  await signInButton.click();
  await expectPath(page, "/trainer");
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
    throw new Error("Missing Supabase public env for Trainer RLS audit.");
  }

  const response = await fetch(`${publicSupabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: {
      apikey: publicSupabaseAnonKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({ email: trainerEmail, password })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.msg || `Supabase auth failed with ${response.status}`);
  }

  return payload.access_token as string;
}

async function rawSupabaseSelect<T>(token: string, table: string, select: string) {
  if (!publicSupabaseUrl || !publicSupabaseAnonKey) {
    throw new Error("Missing Supabase public env for Trainer RLS audit.");
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
  const [
    organizations,
    gyms,
    branches,
    tenantConfigs,
    branchUsers,
    trainers,
    assignments,
    members,
    sessions,
    programs,
    programAssignments,
    notes
  ] = await Promise.all([
    rawSupabaseSelect<{ slug: string }>(token, "organizations", "slug"),
    rawSupabaseSelect<{ id: string; slug: string }>(token, "gyms", "id,slug"),
    rawSupabaseSelect<{ slug: string }>(token, "branches", "slug"),
    rawSupabaseSelect<{ tenant_key: string }>(token, "tenant_configs", "tenant_key"),
    rawSupabaseSelect<{ role_name: string; access_scope: string; branch_role: string; status: string }>(token, "branch_users", "role_name,access_scope,branch_role,status"),
    rawSupabaseSelect<{ id: string; gym_id: string | null }>(token, "trainers", "id,gym_id"),
    rawSupabaseSelect<{ trainer_id: string; gym_id: string | null }>(token, "trainer_assignments", "trainer_id,gym_id"),
    rawSupabaseSelect<{ gym_id: string | null }>(token, "members", "gym_id"),
    rawSupabaseSelect<{ trainer_id: string; gym_id: string | null }>(token, "trainer_sessions", "trainer_id,gym_id"),
    rawSupabaseSelect<{ trainer_id: string; gym_id: string | null }>(token, "workout_programs", "trainer_id,gym_id"),
    rawSupabaseSelect<{ trainer_id: string; gym_id: string | null }>(token, "workout_program_assignments", "trainer_id,gym_id"),
    rawSupabaseSelect<{ trainer_id: string; gym_id: string | null }>(token, "trainer_notes", "trainer_id,gym_id")
  ]);

  return {
    organizationSlugs: organizations.map((row) => row.slug).sort(),
    gymIds: uniqueSlugs(gyms.map((row) => row.id)),
    gymSlugs: gyms.map((row) => row.slug).sort(),
    branchSlugs: branches.map((row) => row.slug).sort(),
    tenantConfigKeys: tenantConfigs.map((row) => row.tenant_key).sort(),
    branchUserRoles: branchUsers.map((row) => `${row.role_name}:${row.access_scope}:${row.branch_role}:${row.status}`).sort(),
    trainerIds: uniqueSlugs(trainers.map((row) => row.id)),
    trainerGymIds: uniqueSlugs(trainers.map((row) => row.gym_id)),
    assignmentTrainerIds: uniqueSlugs(assignments.map((row) => row.trainer_id)),
    assignmentGymIds: uniqueSlugs(assignments.map((row) => row.gym_id)),
    memberGymIds: uniqueSlugs(members.map((row) => row.gym_id)),
    sessionTrainerIds: uniqueSlugs(sessions.map((row) => row.trainer_id)),
    sessionGymIds: uniqueSlugs(sessions.map((row) => row.gym_id)),
    programTrainerIds: uniqueSlugs(programs.map((row) => row.trainer_id)),
    programGymIds: uniqueSlugs(programs.map((row) => row.gym_id)),
    programAssignmentTrainerIds: uniqueSlugs(programAssignments.map((row) => row.trainer_id)),
    programAssignmentGymIds: uniqueSlugs(programAssignments.map((row) => row.gym_id)),
    noteTrainerIds: uniqueSlugs(notes.map((row) => row.trainer_id)),
    noteGymIds: uniqueSlugs(notes.map((row) => row.gym_id))
  };
}

function uniqueSlugs(slugs: Array<string | null | undefined>) {
  return Array.from(new Set(slugs.filter((slug): slug is string => Boolean(slug)))).sort();
}

function expectSubset(actual: string[], allowed: string[]) {
  for (const value of actual) {
    expect(allowed).toContain(value);
  }
}

test.describe("Trainer QA audit", () => {
  test("authorization, dashboard KPIs, menu, and session persistence are stable", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const audit = setupAudit(page);

    await page.goto("/trainer");
    await expectPath(page, "/login");
    expect(new URL(page.url()).searchParams.get("next")).toBe("/trainer");

    const loginStartedAt = performance.now();
    await loginAsTrainer(page);
    const loginDurationMs = Math.round(performance.now() - loginStartedAt);

    await expect(page.locator("header").getByText("Trainer Portal")).toBeVisible();
    await expect(page.locator("header")).toContainText("trainer");
    await expect(page.getByText("Manage today's coaching work", { exact: false })).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);

    for (const label of dashboardLabels) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    const menuHrefs = await getPortalMenuHrefs(page);
    expect(menuHrefs).toEqual(trainerRoutes);

    const menuText = await getPortalMenuText(page);
    for (const forbiddenLabel of forbiddenMenuLabels) {
      expect(menuText).not.toMatch(forbiddenLabel);
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectPath(page, "/trainer");
    await expect(page.locator("header").getByText("Trainer Portal")).toBeVisible();

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("trainer-dashboard.png") });
    await attachAudit(testInfo, "trainer-dashboard-audit", audit, { loginDurationMs, menuHrefs });
    await expectNoClientCrashes(audit);
  });

  test("all implemented Trainer module routes load and expose coaching surfaces", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const audit = setupAudit(page);
    const timings: RouteTiming[] = [];

    await loginAsTrainer(page);

    for (const route of trainerRoutes) {
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

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("trainer-last-module.png") });
    await attachAudit(testInfo, "trainer-module-route-audit", audit, {
      timings,
      featureCoverage: {
        assignedMembers: "implemented: trainer sees assigned members and coaching notes only.",
        assessments: "partial: goals, measurements, milestones, and workout logs exist; dedicated assessment workflow is not first-class.",
        workoutPlans: "implemented: trainer can create, edit, add exercises, and assign workout programs.",
        exerciseLibrary: "partial: custom exercise entry exists inside programs; standalone browse/search trainer exercise library is not first-class.",
        nutrition: "implemented: trainer can create nutrition plans and meal plans for assigned members.",
        progressPhotos: "partial: progress photo storage/actions exist, but trainer portal does not expose a progress-photo upload or comparison workspace.",
        reports: "partial: report data exists for admins; trainer PDF/export workspace is not first-class.",
        tasks: "partial: dashboard metrics show pending reviews/alerts; persistent task management is not first-class."
      }
    });
    await expectNoClientCrashes(audit);
  });

  test("restricted portals and privileged APIs are blocked for Trainer", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const audit = setupAudit(page);
    const endpointResults: Array<{ endpoint: string; method: "GET" | "POST"; status: number; code: string | null }> = [];
    const blockedRouteResults: Array<{ route: string; status: number; location: string | undefined }> = [];

    await loginAsTrainer(page);

    for (const route of blockedRoutes) {
      const response = await page.request.get(route, { maxRedirects: 0, timeout: 20_000 });
      const location = response.headers().location;
      blockedRouteResults.push({ route, status: response.status(), location });
      expect([303, 307, 308]).toContain(response.status());
      expect(location).toContain("/trainer");
    }

    for (const endpoint of restrictedEndpoints) {
      const response = endpoint.endsWith("/refunds")
        ? await page.request.post(endpoint, { data: { paymentId: "00000000-0000-0000-0000-000000000000", amount: 1, reason: "rbac-test" } })
        : await page.request.get(endpoint);
      const payload = await response.json().catch(() => null) as { error?: { code?: string } } | null;
      endpointResults.push({
        endpoint,
        method: endpoint.endsWith("/refunds") ? "POST" : "GET",
        status: response.status(),
        code: payload?.error?.code ?? null
      });
      expect(response.status()).toBe(403);
    }

    const menuText = await getPortalMenuText(page);
    for (const forbiddenLabel of forbiddenMenuLabels) {
      expect(menuText).not.toMatch(forbiddenLabel);
    }

    await attachAudit(testInfo, "trainer-security-audit", audit, { blockedRouteResults, endpointResults });
    await expectNoClientCrashes(audit);
  });

  test("Supabase RLS limits Trainer to assigned organization, gym, and coaching rows", async ({}, testInfo) => {
    test.setTimeout(120_000);
    const snapshot = await getRlsSnapshot();

    expect(snapshot.organizationSlugs).toEqual(["apex-performance-club"]);
    expect(snapshot.organizationSlugs).not.toEqual(expect.arrayContaining(["rbac-qa-organization-b", "rbac-qa-organization-c"]));
    expect(snapshot.gymSlugs).toEqual(["apex-performance-club"]);
    expect(snapshot.gymSlugs).not.toEqual(expect.arrayContaining(["rbac-qa-apex-second-gym", "rbac-qa-gym-b1", "rbac-qa-gym-c1"]));
    expect(snapshot.branchSlugs).toEqual(["baner-flagship"]);
    expect(snapshot.tenantConfigKeys).toEqual([]);
    expect(snapshot.branchUserRoles).toEqual(["trainer:single_branch:trainer:active"]);
    expect(snapshot.trainerIds).toHaveLength(1);
    expect(snapshot.trainerGymIds).toEqual(snapshot.gymIds);

    expectSubset(snapshot.memberGymIds, snapshot.gymIds);
    expectSubset(snapshot.assignmentGymIds, snapshot.gymIds);
    expectSubset(snapshot.sessionGymIds, snapshot.gymIds);
    expectSubset(snapshot.programGymIds, snapshot.gymIds);
    expectSubset(snapshot.programAssignmentGymIds, snapshot.gymIds);
    expectSubset(snapshot.noteGymIds, snapshot.gymIds);

    expectSubset(snapshot.assignmentTrainerIds, snapshot.trainerIds);
    expectSubset(snapshot.sessionTrainerIds, snapshot.trainerIds);
    expectSubset(snapshot.programTrainerIds, snapshot.trainerIds);
    expectSubset(snapshot.programAssignmentTrainerIds, snapshot.trainerIds);
    expectSubset(snapshot.noteTrainerIds, snapshot.trainerIds);

    await testInfo.attach("trainer-rls-snapshot", {
      body: JSON.stringify(snapshot, null, 2),
      contentType: "application/json"
    });
  });
});
