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
  memberIds: string[];
  memberGymIds: string[];
  membershipMemberIds: string[];
  membershipGymIds: string[];
  attendanceMemberIds: string[];
  attendanceGymIds: string[];
  paymentMemberIds: string[];
  paymentGymIds: string[];
  invoiceMemberIds: string[];
  invoiceGymIds: string[];
  classBookingMemberIds: string[];
  classBookingGymIds: string[];
  classWaitlistMemberIds: string[];
  classWaitlistGymIds: string[];
  trainerAssignmentMemberIds: string[];
  trainerAssignmentGymIds: string[];
  trainerSessionMemberIds: string[];
  trainerSessionGymIds: string[];
  workoutAssignmentMemberIds: string[];
  workoutAssignmentGymIds: string[];
  fitnessGoalMemberIds: string[];
  fitnessGoalGymIds: string[];
  workoutSessionMemberIds: string[];
  workoutSessionGymIds: string[];
  bodyMeasurementMemberIds: string[];
  bodyMeasurementGymIds: string[];
  progressPhotoMemberIds: string[];
  progressPhotoGymIds: string[];
  mealEntryMemberIds: string[];
  mealEntryGymIds: string[];
  milestoneMemberIds: string[];
  milestoneGymIds: string[];
  notificationMemberIds: string[];
  communicationMemberIds: string[];
};

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const memberEmail = readEnv("E2E_MEMBER_EMAIL") ?? "hthitame+qa.member@gmail.com";
const publicSupabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const publicSupabaseAnonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

const memberRoutes = [
  "/member",
  "/member/membership",
  "/member/payments",
  "/member/attendance",
  "/member/classes",
  "/member/workouts",
  "/member/fitness",
  "/member/ai-coach",
  "/member/notifications",
  "/member/profile",
  "/member/settings"
] as const;

const dashboardLabels = [
  "Today's Workout",
  "Today's Nutrition",
  "Water Goal",
  "Workout Streak",
  "Attendance Streak",
  "Upcoming Classes",
  "Upcoming PT Sessions",
  "Membership Status",
  "Membership Expiry",
  "Progress Summary",
  "Achievements",
  "Trainer Messages",
  "Announcements",
  "Quick Actions"
] as const;

const moduleExpectations = [
  { route: "/member/membership", labels: ["Membership Details", "Plan", "Expiry Date", "Payment Status"] },
  { route: "/member/payments", labels: ["Payments, invoices, and refunds", "Payment History", "Invoices", "Refunds"] },
  { route: "/member/attendance", labels: ["Check-in QR and visit history", "Member QR", "Visit History"] },
  { route: "/member/classes", labels: ["Browse and book group sessions", "Available Classes", "Upcoming Bookings", "Waitlist", "Class Attendance"] },
  { route: "/member/workouts", labels: ["Workout programs and coaching", "Assigned Programs", "Personal Training Packages", "Sessions", "Trainer Notes"] },
  { route: "/member/fitness", labels: ["Training, nutrition, and body progress", "Goals", "Create Goal", "Body Measurements", "Weight and Composition", "Nutrition Macros", "Log Workout", "Workout History", "Nutrition", "Progress Photos", "Workout Adherence", "Milestones"] },
  { route: "/member/ai-coach", labels: ["Personal coaching with human supervision", "AI Coach Chat", "Profile Engine", "Nutrition Assistant", "Smart Recommendations"] },
  { route: "/member/notifications", labels: ["Messages, reminders, and preferences", "Unread Notifications", "Preferences", "Announcements", "Communication Timeline"] },
  { route: "/member/profile", labels: ["Profile", "Full name", "Avatar URL", "Upload avatar", "Emergency contact"] },
  { route: "/member/settings", labels: ["Email", "Password", "New password", "Confirm password"] }
] as const;

const blockedRoutes = [
  "/super-admin",
  "/organization",
  "/admin",
  "/admin/settings",
  "/admin/members",
  "/admin/payments",
  "/reception",
  "/trainer",
  "/trainer/members"
] as const;

const forbiddenMenuLabels = [/Admin/i, /Staff/i, /Reports/i, /Revenue/i, /Trainer Portal/i, /Reception/i, /Platform/i];

const restrictedEndpoints = [
  "/api/analytics/reports?key=executive_kpi_snapshot&format=csv",
  "/api/attendance/reports?type=daily&format=csv",
  "/api/classes/reports?type=bookings&format=csv",
  "/api/fitness/reports?type=goal_progress&format=csv",
  "/api/memberships/reports?type=active",
  "/api/training/reports?type=sessions",
  "/api/billing/razorpay/refunds",
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

async function loginAsMember(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(memberEmail);
  await page.getByLabel("Password").fill(password);
  const signInButton = page.getByRole("button", { name: /sign in/i });
  await expect(signInButton).toBeEnabled({ timeout: 10_000 });
  await signInButton.click();
  await expectPath(page, "/member");
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
    throw new Error("Missing Supabase public env for Member RLS audit.");
  }

  const response = await fetch(`${publicSupabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: {
      apikey: publicSupabaseAnonKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({ email: memberEmail, password })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.msg || `Supabase auth failed with ${response.status}`);
  }

  return payload.access_token as string;
}

async function rawSupabaseSelect<T>(token: string, table: string, select: string) {
  if (!publicSupabaseUrl || !publicSupabaseAnonKey) {
    throw new Error("Missing Supabase public env for Member RLS audit.");
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
    members,
    memberships,
    attendance,
    payments,
    invoices,
    classBookings,
    classWaitlists,
    trainerAssignments,
    trainerSessions,
    workoutAssignments,
    fitnessGoals,
    workoutSessions,
    measurements,
    photos,
    meals,
    milestones,
    notifications,
    history
  ] = await Promise.all([
    rawSupabaseSelect<{ slug: string }>(token, "organizations", "slug"),
    rawSupabaseSelect<{ id: string; slug: string }>(token, "gyms", "id,slug"),
    rawSupabaseSelect<{ slug: string }>(token, "branches", "slug"),
    rawSupabaseSelect<{ tenant_key: string }>(token, "tenant_configs", "tenant_key"),
    rawSupabaseSelect<{ role_name: string; access_scope: string; branch_role: string; status: string }>(token, "branch_users", "role_name,access_scope,branch_role,status"),
    rawSupabaseSelect<{ id: string; gym_id: string | null }>(token, "members", "id,gym_id"),
    rawSupabaseSelect<{ member_id: string; gym_id: string | null }>(token, "memberships", "member_id,gym_id"),
    rawSupabaseSelect<{ member_id: string; gym_id: string | null }>(token, "attendance_sessions", "member_id,gym_id"),
    rawSupabaseSelect<{ member_id: string; gym_id: string | null }>(token, "payments", "member_id,gym_id"),
    rawSupabaseSelect<{ member_id: string; gym_id: string | null }>(token, "invoices", "member_id,gym_id"),
    rawSupabaseSelect<{ member_id: string; gym_id: string | null }>(token, "class_bookings", "member_id,gym_id"),
    rawSupabaseSelect<{ member_id: string; gym_id: string | null }>(token, "class_waitlists", "member_id,gym_id"),
    rawSupabaseSelect<{ member_id: string; gym_id: string | null }>(token, "trainer_assignments", "member_id,gym_id"),
    rawSupabaseSelect<{ member_id: string; gym_id: string | null }>(token, "trainer_sessions", "member_id,gym_id"),
    rawSupabaseSelect<{ member_id: string; gym_id: string | null }>(token, "workout_program_assignments", "member_id,gym_id"),
    rawSupabaseSelect<{ member_id: string; gym_id: string | null }>(token, "fitness_goals", "member_id,gym_id"),
    rawSupabaseSelect<{ member_id: string; gym_id: string | null }>(token, "workout_sessions", "member_id,gym_id"),
    rawSupabaseSelect<{ member_id: string; gym_id: string | null }>(token, "body_measurements", "member_id,gym_id"),
    rawSupabaseSelect<{ member_id: string; gym_id: string | null }>(token, "progress_photos", "member_id,gym_id"),
    rawSupabaseSelect<{ member_id: string; gym_id: string | null }>(token, "meal_entries", "member_id,gym_id"),
    rawSupabaseSelect<{ member_id: string; gym_id: string | null }>(token, "fitness_milestones", "member_id,gym_id"),
    rawSupabaseSelect<{ member_id: string | null }>(token, "notifications", "member_id"),
    rawSupabaseSelect<{ member_id: string | null }>(token, "communication_history", "member_id")
  ]);

  return {
    organizationSlugs: organizations.map((row) => row.slug).sort(),
    gymIds: uniqueValues(gyms.map((row) => row.id)),
    gymSlugs: gyms.map((row) => row.slug).sort(),
    branchSlugs: branches.map((row) => row.slug).sort(),
    tenantConfigKeys: tenantConfigs.map((row) => row.tenant_key).sort(),
    branchUserRoles: branchUsers.map((row) => `${row.role_name}:${row.access_scope}:${row.branch_role}:${row.status}`).sort(),
    memberIds: uniqueValues(members.map((row) => row.id)),
    memberGymIds: uniqueValues(members.map((row) => row.gym_id)),
    membershipMemberIds: uniqueValues(memberships.map((row) => row.member_id)),
    membershipGymIds: uniqueValues(memberships.map((row) => row.gym_id)),
    attendanceMemberIds: uniqueValues(attendance.map((row) => row.member_id)),
    attendanceGymIds: uniqueValues(attendance.map((row) => row.gym_id)),
    paymentMemberIds: uniqueValues(payments.map((row) => row.member_id)),
    paymentGymIds: uniqueValues(payments.map((row) => row.gym_id)),
    invoiceMemberIds: uniqueValues(invoices.map((row) => row.member_id)),
    invoiceGymIds: uniqueValues(invoices.map((row) => row.gym_id)),
    classBookingMemberIds: uniqueValues(classBookings.map((row) => row.member_id)),
    classBookingGymIds: uniqueValues(classBookings.map((row) => row.gym_id)),
    classWaitlistMemberIds: uniqueValues(classWaitlists.map((row) => row.member_id)),
    classWaitlistGymIds: uniqueValues(classWaitlists.map((row) => row.gym_id)),
    trainerAssignmentMemberIds: uniqueValues(trainerAssignments.map((row) => row.member_id)),
    trainerAssignmentGymIds: uniqueValues(trainerAssignments.map((row) => row.gym_id)),
    trainerSessionMemberIds: uniqueValues(trainerSessions.map((row) => row.member_id)),
    trainerSessionGymIds: uniqueValues(trainerSessions.map((row) => row.gym_id)),
    workoutAssignmentMemberIds: uniqueValues(workoutAssignments.map((row) => row.member_id)),
    workoutAssignmentGymIds: uniqueValues(workoutAssignments.map((row) => row.gym_id)),
    fitnessGoalMemberIds: uniqueValues(fitnessGoals.map((row) => row.member_id)),
    fitnessGoalGymIds: uniqueValues(fitnessGoals.map((row) => row.gym_id)),
    workoutSessionMemberIds: uniqueValues(workoutSessions.map((row) => row.member_id)),
    workoutSessionGymIds: uniqueValues(workoutSessions.map((row) => row.gym_id)),
    bodyMeasurementMemberIds: uniqueValues(measurements.map((row) => row.member_id)),
    bodyMeasurementGymIds: uniqueValues(measurements.map((row) => row.gym_id)),
    progressPhotoMemberIds: uniqueValues(photos.map((row) => row.member_id)),
    progressPhotoGymIds: uniqueValues(photos.map((row) => row.gym_id)),
    mealEntryMemberIds: uniqueValues(meals.map((row) => row.member_id)),
    mealEntryGymIds: uniqueValues(meals.map((row) => row.gym_id)),
    milestoneMemberIds: uniqueValues(milestones.map((row) => row.member_id)),
    milestoneGymIds: uniqueValues(milestones.map((row) => row.gym_id)),
    notificationMemberIds: uniqueValues(notifications.map((row) => row.member_id)),
    communicationMemberIds: uniqueValues(history.map((row) => row.member_id))
  };
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function expectSubset(actual: string[], allowed: string[]) {
  for (const value of actual) {
    expect(allowed).toContain(value);
  }
}

test.describe("Member QA audit", () => {
  test("authorization, dashboard KPIs, quick actions, and session persistence are stable", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const audit = setupAudit(page);

    await page.goto("/member");
    await expectPath(page, "/login");
    expect(new URL(page.url()).searchParams.get("next")).toBe("/member");

    const loginStartedAt = performance.now();
    await loginAsMember(page);
    const loginDurationMs = Math.round(performance.now() - loginStartedAt);

    await expect(page.locator("header").getByText("Member Portal")).toBeVisible();
    await expect(page.locator("header")).toContainText("member");
    await expect(page.getByText("Ready for workouts on the move")).toBeVisible();
    await expect(page.getByText("Membership Status", { exact: true }).first()).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);

    for (const label of dashboardLabels) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    const menuHrefs = await getPortalMenuHrefs(page);
    expect(menuHrefs).toEqual(memberRoutes);

    const menuText = await getPortalMenuText(page);
    for (const forbiddenLabel of forbiddenMenuLabels) {
      expect(menuText).not.toMatch(forbiddenLabel);
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectPath(page, "/member");
    await expect(page.locator("header").getByText("Member Portal")).toBeVisible();

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("member-dashboard.png") });
    await attachAudit(testInfo, "member-dashboard-audit", audit, { loginDurationMs, menuHrefs });
    await expectNoClientCrashes(audit);
  });

  test("all implemented Member module routes load and expose member experience surfaces", async ({ page }, testInfo) => {
    test.setTimeout(360_000);
    const audit = setupAudit(page);
    const timings: RouteTiming[] = [];

    await loginAsMember(page);

    for (const route of memberRoutes) {
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

    await page.goto("/member/profile", { waitUntil: "domcontentloaded" });
    await expect(page.locator('input[type="file"][name="avatarFile"]')).toHaveAttribute("accept", /image\/jpeg,image\/png,image\/webp/);
    await page.goto("/member/fitness", { waitUntil: "domcontentloaded" });
    await expect(page.locator('input[type="file"][name="photoFile"]')).toHaveAttribute("accept", /image\/jpeg,image\/png,image\/webp/);

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("member-last-module.png") });
    await attachAudit(testInfo, "member-module-route-audit", audit, {
      timings,
      featureCoverage: {
        dashboard: "implemented: member KPIs, PWA readiness, and quick actions are visible.",
        profile: "partial: profile photo, contact, and emergency contact exist; medical information and fitness preferences are not first-class.",
        membership: "implemented: membership detail, pending payment, and renewal request path are visible.",
        attendance: "implemented: QR, visit history, streak, and attendance metrics are visible.",
        workouts: "implemented: assigned programs, exercises, PT packages, sessions, trainer notes, and feedback are visible.",
        nutrition: "implemented: nutrition plan context, meal logging, calories, macros, water, and history are visible.",
        progressPhotos: "implemented: progress photo upload and history are visible; before/after comparison is not first-class.",
        classBooking: "implemented: available sessions, booking/cancel forms, waitlists, and attendance history are visible.",
        payments: "implemented: payment history, invoices, pending checkout, and refund status are visible.",
        aiCoach: "implemented: chat, profile engine, nutrition assistant, and recommendations are visible.",
        gamification: "partial: milestones/achievements are visible; leaderboards, challenges, and reward points are not first-class.",
        documents: "partial: invoices and receipt/payment records are visible; dedicated member document center is not first-class."
      }
    });
    await expectNoClientCrashes(audit);
  });

  test("restricted portals and privileged APIs are blocked for Member", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const audit = setupAudit(page);
    const endpointResults: Array<{ endpoint: string; method: "GET" | "POST"; status: number; code: string | null }> = [];
    const blockedRouteResults: Array<{ route: string; status: number; location: string | undefined }> = [];

    await loginAsMember(page);

    for (const route of blockedRoutes) {
      const response = await page.request.get(route, { maxRedirects: 0, timeout: 20_000 });
      const location = response.headers().location;
      blockedRouteResults.push({ route, status: response.status(), location });
      expect([303, 307, 308]).toContain(response.status());
      expect(location).toContain("/member");
    }

    for (const endpoint of restrictedEndpoints) {
      const response = endpoint.endsWith("/refunds")
        ? await page.request.post(endpoint, { data: { paymentId: "00000000-0000-0000-0000-000000000000", amount: 1, reason: "rbac-test" } })
        : endpoint.endsWith("/check")
          ? await page.request.post(endpoint, { data: { domainId: "00000000-0000-0000-0000-000000000000" } })
          : await page.request.get(endpoint);
      const payload = await response.json().catch(() => null) as { error?: { code?: string } } | null;
      endpointResults.push({
        endpoint,
        method: endpoint.endsWith("/refunds") || endpoint.endsWith("/check") ? "POST" : "GET",
        status: response.status(),
        code: payload?.error?.code ?? null
      });
      expect(response.status()).toBe(403);
    }

    const menuText = await getPortalMenuText(page);
    for (const forbiddenLabel of forbiddenMenuLabels) {
      expect(menuText).not.toMatch(forbiddenLabel);
    }

    await attachAudit(testInfo, "member-security-audit", audit, { blockedRouteResults, endpointResults });
    await expectNoClientCrashes(audit);
  });

  test("Supabase RLS limits Member to own tenant, gym, and member-owned rows", async ({}, testInfo) => {
    test.setTimeout(120_000);
    const snapshot = await getRlsSnapshot();

    expect(snapshot.organizationSlugs).toEqual(["apex-performance-club"]);
    expect(snapshot.organizationSlugs).not.toEqual(expect.arrayContaining(["rbac-qa-organization-b", "rbac-qa-organization-c"]));
    expect(snapshot.gymSlugs).toEqual(["apex-performance-club"]);
    expect(snapshot.gymSlugs).not.toEqual(expect.arrayContaining(["rbac-qa-apex-second-gym", "rbac-qa-gym-b1", "rbac-qa-gym-c1"]));
    if (snapshot.branchSlugs.length > 0) {
      expect(snapshot.branchSlugs).toEqual(["baner-flagship"]);
    }
    expect(snapshot.tenantConfigKeys).toEqual([]);
    expect(snapshot.branchUserRoles).toEqual(["member:single_branch:viewer:active"]);
    expect(snapshot.memberIds).toHaveLength(1);
    expect(snapshot.memberGymIds).toEqual(snapshot.gymIds);

    for (const memberScoped of [
      snapshot.membershipMemberIds,
      snapshot.attendanceMemberIds,
      snapshot.paymentMemberIds,
      snapshot.invoiceMemberIds,
      snapshot.classBookingMemberIds,
      snapshot.classWaitlistMemberIds,
      snapshot.trainerAssignmentMemberIds,
      snapshot.trainerSessionMemberIds,
      snapshot.workoutAssignmentMemberIds,
      snapshot.fitnessGoalMemberIds,
      snapshot.workoutSessionMemberIds,
      snapshot.bodyMeasurementMemberIds,
      snapshot.progressPhotoMemberIds,
      snapshot.mealEntryMemberIds,
      snapshot.milestoneMemberIds,
      snapshot.notificationMemberIds,
      snapshot.communicationMemberIds
    ]) {
      expectSubset(memberScoped, snapshot.memberIds);
    }

    for (const gymScoped of [
      snapshot.membershipGymIds,
      snapshot.attendanceGymIds,
      snapshot.paymentGymIds,
      snapshot.invoiceGymIds,
      snapshot.classBookingGymIds,
      snapshot.classWaitlistGymIds,
      snapshot.trainerAssignmentGymIds,
      snapshot.trainerSessionGymIds,
      snapshot.workoutAssignmentGymIds,
      snapshot.fitnessGoalGymIds,
      snapshot.workoutSessionGymIds,
      snapshot.bodyMeasurementGymIds,
      snapshot.progressPhotoGymIds,
      snapshot.mealEntryGymIds,
      snapshot.milestoneGymIds
    ]) {
      expectSubset(gymScoped, snapshot.gymIds);
    }

    await testInfo.attach("member-rls-snapshot", {
      body: JSON.stringify(snapshot, null, 2),
      contentType: "application/json"
    });
  });

  test("mobile and PWA shell expose install, offline, and bottom navigation surfaces", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const audit = setupAudit(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsMember(page);

    await expect(page.getByText("Mobile app mode")).toBeVisible();
    await expect(page.getByText("Ready for workouts on the move")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Mobile primary portal navigation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open more navigation" })).toBeVisible();
    await page.getByRole("button", { name: "Open more navigation" }).click();
    await expect(page.getByRole("button", { name: "Close more navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Workouts", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "AI Coach", exact: true })).toBeVisible();

    const manifest = await page.request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
    const manifestJson = await manifest.json() as { display?: string; start_url?: string; shortcuts?: unknown[]; icons?: unknown[] };
    expect(manifestJson.display).toBe("standalone");
    expect(manifestJson.start_url).toContain("/member");
    expect((manifestJson.shortcuts ?? []).length).toBeGreaterThanOrEqual(3);
    expect((manifestJson.icons ?? []).length).toBeGreaterThanOrEqual(2);

    await page.goto("/offline", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Offline mode")).toBeVisible();
    await expect(page.getByText("Workout and nutrition drafts")).toBeVisible();

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("member-mobile-pwa.png") });
    await attachAudit(testInfo, "member-mobile-pwa-audit", audit, { manifest: manifestJson });
    await expectNoClientCrashes(audit);
  });
});
