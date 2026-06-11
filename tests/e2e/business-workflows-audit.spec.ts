import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";

type AuditLog = {
  console: Array<{ type: string; text: string; location: unknown }>;
  pageErrors: string[];
  network: Array<{ status: number; method: string; url: string }>;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string;
  gym_id: string | null;
};

type GymRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

type BranchRow = {
  id: string;
  organization_id: string;
  gym_id: string | null;
  name: string;
  slug: string;
  branch_code: string;
};

type TrainerRow = {
  id: string;
  gym_id: string | null;
  user_id: string | null;
  employee_code: string;
  display_name: string;
};

type SeededWorkflow = {
  runId: string;
  suffix: string;
  organizationId: string;
  branchId: string;
  gymId: string;
  otherOrganizationId: string;
  otherBranchId: string;
  otherGymId: string;
  gymAdminUserId: string;
  receptionUserId: string;
  trainerUserId: string;
  memberUserId: string;
  trainerId: string;
  leadId: string;
  memberId: string;
  waitlistMemberId: string;
  expiredMemberId: string;
  frozenMemberId: string;
  suspendedMemberId: string;
  otherTenantMemberId: string;
  planId: string;
  membershipId: string;
  invoiceId: string;
  paymentId: string;
  partialInvoiceId: string;
  partialPaymentId: string;
  ptPackageId: string;
  memberPtPackageId: string;
  ptSessionId: string;
  scheduledPtSessionId: string;
  scheduledPtSessionDate: string;
  scheduledPtSessionStartsAt: string;
  workoutProgramId: string;
  workoutAssignmentId: string;
  nutritionPlanId: string;
  fitnessGoalId: string;
  workoutSessionId: string;
  classId: string;
  classSessionId: string;
  classBookingId: string;
  classWaitlistId: string;
  attendanceSessionId: string;
  qrTokenId: string;
};

type ApiTiming = {
  name: string;
  route: string;
  status: number | null;
  durationMs: number;
};

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const gymAdminEmail = readEnv("E2E_GYM_ADMIN_EMAIL") ?? "hthitame+qa.admin@gmail.com";
const receptionEmail = readEnv("E2E_RECEPTION_EMAIL") ?? "hthitame+qa.reception@gmail.com";
const trainerEmail = readEnv("E2E_TRAINER_EMAIL") ?? "hthitame+qa.trainer@gmail.com";
const memberEmail = readEnv("E2E_MEMBER_EMAIL") ?? "hthitame+qa.member@gmail.com";
const publicSupabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const publicSupabaseAnonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

const roleRoutes = [
  { name: "Gym Admin", email: gymAdminEmail, expectedPath: "/admin", routes: ["/admin", "/admin/members", "/admin/attendance", "/admin/classes", "/admin/trainers", "/admin/payments", "/admin/reports"] },
  { name: "Reception", email: receptionEmail, expectedPath: "/reception", routes: ["/reception", "/reception/register", "/reception/attendance", "/reception/classes", "/reception/payments"] },
  { name: "Trainer", email: trainerEmail, expectedPath: "/trainer", routes: ["/trainer", "/trainer/members", "/trainer/progress", "/trainer/sessions", "/trainer/classes"] },
  { name: "Member", email: memberEmail, expectedPath: "/member", routes: ["/member", "/member/attendance", "/member/classes", "/member/workouts", "/member/fitness", "/member/payments"] }
] as const;

const reportEndpoints = [
  { name: "attendance", route: "/api/attendance/reports?type=daily&format=csv" },
  { name: "revenue", route: "/api/analytics/reports?key=revenue_sources&format=csv" },
  { name: "membership", route: "/api/memberships/reports?type=active" },
  { name: "class", route: "/api/classes/reports?type=bookings&format=csv" },
  { name: "training", route: "/api/training/reports?type=sessions" }
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

async function attachJson(testInfo: TestInfo, name: string, value: unknown) {
  await testInfo.attach(name, {
    body: JSON.stringify(value, null, 2),
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

async function loginAs(page: Page, email: string, expectedPath: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  const signInButton = page.getByRole("button", { name: /sign in/i });
  await expect(signInButton).toBeEnabled({ timeout: 10_000 });
  await signInButton.click();
  await expectPath(page, expectedPath);
}

async function gotoTimed(page: Page, route: string): Promise<ApiTiming> {
  const startedAt = performance.now();
  const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch((error: Error) => {
    if (!error.message.includes("ERR_ABORTED") && !error.message.includes("frame was detached")) {
      throw error;
    }
    return null;
  });

  return {
    name: route,
    route,
    status: response?.status() ?? null,
    durationMs: Math.round(performance.now() - startedAt)
  };
}

async function requestTimed(page: Page, name: string, route: string): Promise<ApiTiming> {
  const startedAt = performance.now();
  const response = await page.request.get(route, { timeout: 60_000 });

  return {
    name,
    route,
    status: response.status(),
    durationMs: Math.round(performance.now() - startedAt)
  };
}

async function rawSupabaseSignIn(email: string) {
  const response = await fetchWithRetry(`${publicSupabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
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

async function restRequest<T>(
  path: string,
  init: RequestInit & { service?: boolean; expectFailure?: boolean } = {}
) {
  const key = init.service === false ? publicSupabaseAnonKey : serviceRoleKey;
  const response = await fetchWithRetry(`${publicSupabaseUrl}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(30_000),
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok && !init.expectFailure) {
    throw new Error(`${path} failed with ${response.status}: ${payload?.message ?? payload?.error_description ?? text}`);
  }

  return {
    ok: response.ok,
    status: response.status,
    payload: payload as T
  };
}

async function serviceSelect<T>(table: string, select: string, filters: string[] = []) {
  const query = [`select=${encodeURIComponent(select)}`, ...filters].join("&");
  const { payload } = await restRequest<T[]>(`/rest/v1/${table}?${query}`, { method: "GET" });
  return payload;
}

async function serviceInsert<T>(table: string, body: Record<string, unknown>) {
  const { payload } = await restRequest<T[]>(`/rest/v1/${table}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  return requireRow(payload, `insert ${table}`);
}

async function servicePatch<T>(table: string, filters: string[], body: Record<string, unknown>) {
  const { payload } = await restRequest<T[]>(`/rest/v1/${table}?${filters.join("&")}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  return requireRow(payload, `patch ${table}`);
}

async function serviceRpc<T>(name: string, body: Record<string, unknown>) {
  const { payload } = await restRequest<T>(`/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  return payload;
}

async function anonSelect<T>(token: string, table: string, select: string, filters: string[] = []) {
  const query = [`select=${encodeURIComponent(select)}`, ...filters].join("&");
  const response = await fetchWithRetry(`${publicSupabaseUrl}/rest/v1/${table}?${query}`, {
    signal: AbortSignal.timeout(20_000),
    headers: {
      apikey: publicSupabaseAnonKey,
      authorization: `Bearer ${token}`
    }
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || `${table} select failed with ${response.status}`);
  }
  return payload as T[];
}

async function anonInsert<T>(token: string, table: string, body: Record<string, unknown>) {
  const response = await fetchWithRetry(`${publicSupabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: {
      apikey: publicSupabaseAnonKey,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  return {
    ok: response.ok,
    status: response.status,
    payload: payload as T[] | { message?: string; code?: string }
  };
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 2) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (response.status < 500 || attempt === retries) {
        clearTimeout(timeout);
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        clearTimeout(timeout);
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 750 * (attempt + 1)));
  }

  throw lastError instanceof Error ? lastError : new Error("Fetch failed after retries.");
}

function eq(column: string, value: string) {
  return `${column}=eq.${encodeURIComponent(value)}`;
}

function limit(count: number) {
  return `limit=${count}`;
}

function today(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function isoPlusHours(hours: number) {
  const date = new Date();
  date.setUTCHours(date.getUTCHours() + hours, 0, 0, 0);
  return date.toISOString();
}

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function getSingle<T>(table: string, select: string, filters: string[], label: string) {
  const rows = await serviceSelect<T>(table, select, [...filters, limit(1)]);
  if (!rows[0]) {
    throw new Error(`Missing required ${label}.`);
  }
  return rows[0];
}

function requireRow<T>(rows: T[], label: string) {
  const row = rows[0];
  if (!row) {
    throw new Error(`Supabase returned no row for ${label}.`);
  }
  return row;
}

async function getProfileByEmail(email: string) {
  return getSingle<ProfileRow>("profiles", "id,email,full_name,gym_id", [eq("email", email)], `profile ${email}`);
}

async function seedWorkflow(): Promise<SeededWorkflow> {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const runId = `P9-${suffix}`;
  const scheduleOffsetDays = 30 + Math.floor(Math.random() * 240);
  const ptSessionDate = today(scheduleOffsetDays);
  const scheduledPtSessionDate = today(scheduleOffsetDays + 1);
  const classSessionDate = today(scheduleOffsetDays + 2);
  const scheduledPtSessionStartsAt = `${String(6 + Math.floor(Math.random() * 10)).padStart(2, "0")}:00:00`;
  const scheduledPtSessionEndsAt = `${String(Number(scheduledPtSessionStartsAt.slice(0, 2)) + 1).padStart(2, "0")}:00:00`;
  const gymAdmin = await getProfileByEmail(gymAdminEmail);
  const reception = await getProfileByEmail(receptionEmail);
  const trainerProfile = await getProfileByEmail(trainerEmail);
  const memberProfile = await getProfileByEmail(memberEmail);
  const gymId = gymAdmin.gym_id;

  if (!gymId) {
    throw new Error("QA Gym Admin is not linked to a gym.");
  }

  const gym = await getSingle<GymRow>("gyms", "id,name,slug,status", [eq("id", gymId)], "QA gym");
  const branch = await getSingle<BranchRow>("branches", "id,organization_id,gym_id,name,slug,branch_code", [eq("gym_id", gymId)], "QA branch");
  const trainer = await getSingle<TrainerRow>("trainers", "id,gym_id,user_id,employee_code,display_name", [eq("gym_id", gymId), eq("user_id", trainerProfile.id)], "QA trainer");
  const plan = await serviceInsert<{ id: string }>("membership_plans", {
    gym_id: gymId,
    name: `${runId} Workflow Plan`,
    slug: `p9-plan-${suffix}`.replace(/[^a-z0-9-]/g, "-"),
    description: "Phase 9 workflow audit membership plan.",
    plan_type: "monthly",
    duration_days: 30,
    price_amount: 3000,
    joining_fee_amount: 0,
    access_level: "premium",
    features: ["Phase 9 attendance", "Phase 9 classes"],
    status: "active",
    created_by: gymAdmin.id
  });

  const otherGym = await serviceInsert<GymRow>("gyms", {
    name: `${runId} Isolation Gym`,
    slug: `p9-isolation-${suffix}`.replace(/[^a-z0-9-]/g, "-"),
    timezone: "Asia/Kolkata",
    currency: "INR",
    status: "active"
  });
  const otherOrg = await serviceInsert<{ id: string }>("organizations", {
    name: `${runId} Isolation Organization`,
    slug: `p9-isolation-org-${suffix}`.replace(/[^a-z0-9-]/g, "-"),
    organization_type: "single_gym",
    status: "active",
    billing_email: `qa-${suffix}@example.com`,
    created_by: gymAdmin.id
  });
  const otherBranch = await serviceInsert<BranchRow>("branches", {
    organization_id: otherOrg.id,
    gym_id: otherGym.id,
    name: `${runId} Isolation Branch`,
    slug: `p9-isolation-branch-${suffix}`.replace(/[^a-z0-9-]/g, "-"),
    branch_code: `P9${suffix.slice(-6).toUpperCase()}`,
    status: "active",
    city: "Pune",
    state: "Maharashtra",
    phone: "9200000000",
    email: `branch-${suffix}@example.com`
  });

  const lead = await serviceInsert<{ id: string }>("leads", {
    gym_id: gymId,
    name: `${runId} Lead`,
    phone: `92${Date.now().toString().slice(-8)}`,
    email: `lead-${suffix}@example.com`,
    source: "free_trial",
    interest: "Monthly transformation plan",
    message: "Phase 9 lead to member conversion.",
    preferred_trial_at: isoPlusHours(24),
    status: "new",
    consent_marketing: true,
    notes: runId
  });

  await servicePatch("leads", [eq("id", lead.id)], { status: "contacted", notes: `${runId} contacted` });
  await servicePatch("leads", [eq("id", lead.id)], { status: "trial_scheduled", notes: `${runId} trial scheduled` });
  await servicePatch("leads", [eq("id", lead.id)], { status: "trial_completed", notes: `${runId} trial completed` });
  await servicePatch("leads", [eq("id", lead.id)], { status: "converted", notes: `${runId} converted` });

  const member = await createWorkflowMember(runId, suffix, gymId, trainerProfile.id, gymAdmin.id, "Primary");
  const waitlistMember = await createWorkflowMember(runId, suffix, gymId, trainerProfile.id, gymAdmin.id, "Waitlist");
  const expiredMember = await createWorkflowMember(runId, suffix, gymId, null, gymAdmin.id, "Expired");
  const frozenMember = await createWorkflowMember(runId, suffix, gymId, null, gymAdmin.id, "Frozen");
  const suspendedMember = await createWorkflowMember(runId, suffix, gymId, null, gymAdmin.id, "Suspended");
  const otherTenantMember = await createWorkflowMember(runId, suffix, otherGym.id, null, gymAdmin.id, "OtherTenant");

  const membership = await serviceInsert<{ id: string }>("memberships", {
    gym_id: gymId,
    member_id: member.id,
    membership_plan_id: plan.id,
    status: "active",
    start_date: today(),
    end_date: today(30),
    activated_at: new Date().toISOString(),
    source: "manual",
    price_amount: 3000,
    payment_status: "paid",
    invoice_number: `${runId}-MEM`
  });

  await Promise.all([
    serviceInsert("memberships", {
      gym_id: gymId,
      member_id: expiredMember.id,
      membership_plan_id: plan.id,
      status: "expired",
      start_date: today(-45),
      end_date: today(-1),
      source: "manual",
      price_amount: 3000,
      payment_status: "paid",
      invoice_number: `${runId}-EXP`
    }),
    serviceInsert("memberships", {
      gym_id: gymId,
      member_id: frozenMember.id,
      membership_plan_id: plan.id,
      status: "frozen",
      start_date: today(-5),
      end_date: today(25),
      frozen_at: new Date().toISOString(),
      source: "manual",
      price_amount: 3000,
      payment_status: "paid",
      invoice_number: `${runId}-FRZ`
    }),
    serviceInsert("memberships", {
      gym_id: gymId,
      member_id: suspendedMember.id,
      membership_plan_id: plan.id,
      status: "suspended",
      start_date: today(-5),
      end_date: today(25),
      suspended_at: new Date().toISOString(),
      source: "manual",
      price_amount: 3000,
      payment_status: "paid",
      invoice_number: `${runId}-SUS`
    })
  ]);

  const invoice = await serviceInsert<{ id: string }>("invoices", {
    gym_id: gymId,
    member_id: member.id,
    membership_id: membership.id,
    invoice_number: `${runId}-INV-001`,
    status: "paid",
    subtotal_amount: 3000,
    amount_paid: 3000,
    issued_at: new Date().toISOString(),
    paid_at: new Date().toISOString(),
    created_by: gymAdmin.id,
    notes: runId
  });
  await serviceInsert("invoice_items", {
    invoice_id: invoice.id,
    item_type: "membership",
    description: `${runId} membership purchase`,
    quantity: 1,
    unit_amount: 3000
  });
  const payment = await serviceInsert<{ id: string }>("payments", {
    gym_id: gymId,
    member_id: member.id,
    membership_id: membership.id,
    invoice_id: invoice.id,
    payment_number: `${runId}-PAY-001`,
    payment_type: "membership_purchase",
    status: "paid",
    method: "cash",
    provider: "manual",
    amount: 3000,
    receipt_number: `${runId}-RCPT-001`,
    collected_at: new Date().toISOString(),
    paid_at: new Date().toISOString(),
    created_by: reception.id,
    metadata: { run_id: runId }
  });

  const partialInvoice = await serviceInsert<{ id: string }>("invoices", {
    gym_id: gymId,
    member_id: member.id,
    membership_id: membership.id,
    invoice_number: `${runId}-INV-002`,
    status: "partially_paid",
    subtotal_amount: 1200,
    amount_paid: 500,
    issued_at: new Date().toISOString(),
    created_by: gymAdmin.id,
    notes: runId
  });
  const partialPayment = await serviceInsert<{ id: string }>("payments", {
    gym_id: gymId,
    member_id: member.id,
    membership_id: membership.id,
    invoice_id: partialInvoice.id,
    payment_number: `${runId}-PAY-002`,
    payment_type: "class_fee",
    status: "paid",
    method: "upi",
    provider: "manual",
    amount: 500,
    receipt_number: `${runId}-RCPT-002`,
    collected_at: new Date().toISOString(),
    paid_at: new Date().toISOString(),
    created_by: reception.id,
    metadata: { run_id: runId, partial: true }
  });
  await serviceInsert("payments", {
    gym_id: gymId,
    member_id: member.id,
    membership_id: membership.id,
    invoice_id: invoice.id,
    payment_number: `${runId}-PAY-003`,
    payment_type: "membership_renewal",
    status: "paid",
    method: "razorpay",
    provider: "razorpay",
    amount: 3000,
    provider_order_id: `${runId}-ORDER`,
    provider_payment_id: `${runId}-RAZORPAY`,
    receipt_number: `${runId}-RCPT-003`,
    paid_at: new Date().toISOString(),
    created_by: memberProfile.id,
    metadata: { run_id: runId, renewal: true }
  });
  await serviceInsert("refunds", {
    gym_id: gymId,
    payment_id: partialPayment.id,
    invoice_id: partialInvoice.id,
    member_id: member.id,
    amount: 100,
    status: "requested",
    reason: "Phase 9 refund request validation",
    requested_by: reception.id,
    metadata: { run_id: runId }
  });

  await Promise.all([
    serviceInsert("membership_history", {
      gym_id: gymId,
      membership_id: membership.id,
      member_id: member.id,
      event: "created",
      to_plan_id: plan.id,
      to_status: "active",
      new_start_date: today(),
      new_end_date: today(30),
      reason: "Phase 9 onboarding",
      metadata: { run_id: runId },
      created_by: reception.id
    }),
    serviceInsert("membership_history", {
      gym_id: gymId,
      membership_id: membership.id,
      member_id: member.id,
      event: "renewed",
      from_plan_id: plan.id,
      to_plan_id: plan.id,
      from_status: "active",
      to_status: "active",
      previous_start_date: today(),
      previous_end_date: today(30),
      new_start_date: today(),
      new_end_date: today(60),
      reason: "Phase 9 renewal flow",
      metadata: { run_id: runId },
      created_by: memberProfile.id
    }),
    serviceInsert("membership_status_logs", {
      gym_id: gymId,
      membership_id: membership.id,
      member_id: member.id,
      from_status: "pending",
      to_status: "active",
      reason: "Payment received",
      created_by: reception.id
    }),
    serviceInsert("membership_notification_events", {
      gym_id: gymId,
      membership_id: membership.id,
      member_id: member.id,
      event_type: "membership_created",
      channel: "email",
      status: "sent",
      metadata: { run_id: runId }
    }),
    serviceInsert("membership_notification_events", {
      gym_id: gymId,
      membership_id: membership.id,
      member_id: member.id,
      event_type: "renewal_reminder",
      channel: "push",
      status: "queued",
      scheduled_for: isoPlusHours(48),
      metadata: { run_id: runId }
    })
  ]);

  const qrToken = await serviceInsert<{ id: string }>("qr_tokens", {
    gym_id: gymId,
    member_id: member.id,
    token_value: `${runId}-QR`,
    token_hash: hashToken(`${runId}-QR`),
    status: "active",
    purpose: "attendance",
    expires_at: isoPlusHours(24),
    created_by: reception.id
  });
  const attendanceSession = await serviceInsert<{ id: string }>("attendance_sessions", {
    gym_id: gymId,
    member_id: member.id,
    membership_id: membership.id,
    qr_token_id: qrToken.id,
    status: "inside",
    check_in_source: "qr",
    created_by: reception.id,
    notes: runId
  });
  await Promise.all([
    serviceInsert("attendance_logs", {
      gym_id: gymId,
      attendance_session_id: attendanceSession.id,
      member_id: member.id,
      membership_id: membership.id,
      qr_token_id: qrToken.id,
      action: "check_in",
      source: "qr",
      result: "success",
      message: "Phase 9 QR check-in accepted",
      actor_id: reception.id,
      metadata: { run_id: runId }
    }),
    serviceInsert("entry_events", {
      gym_id: gymId,
      attendance_session_id: attendanceSession.id,
      member_id: member.id,
      entry_method: "qr",
      verification_result: "granted",
      metadata: { run_id: runId }
    }),
    serviceInsert("access_logs", {
      gym_id: gymId,
      member_id: member.id,
      membership_id: membership.id,
      attendance_session_id: attendanceSession.id,
      qr_token_id: qrToken.id,
      direction: "entry",
      source: "qr",
      decision: "granted",
      reason_code: "active_membership",
      message: "Phase 9 active member access granted",
      validation_snapshot: { run_id: runId, membership_status: "active" },
      actor_id: reception.id
    })
  ]);

  await servicePatch("attendance_sessions", [eq("id", attendanceSession.id)], {
    status: "checked_out",
    check_out_at: isoPlusHours(1),
    duration_minutes: 60,
    check_out_source: "reception",
    checked_out_by: reception.id
  });
  await Promise.all([
    serviceInsert("attendance_logs", {
      gym_id: gymId,
      attendance_session_id: attendanceSession.id,
      member_id: member.id,
      membership_id: membership.id,
      qr_token_id: qrToken.id,
      action: "check_out",
      source: "reception",
      result: "success",
      message: "Phase 9 manual check-out accepted",
      actor_id: reception.id,
      metadata: { run_id: runId }
    }),
    serviceInsert("exit_events", {
      gym_id: gymId,
      attendance_session_id: attendanceSession.id,
      member_id: member.id,
      exit_method: "manual",
      metadata: { run_id: runId }
    })
  ]);

  const assignment = await serviceInsert<{ id: string }>("trainer_assignments", {
    gym_id: gymId,
    trainer_id: trainer.id,
    member_id: member.id,
    assignment_type: "primary",
    status: "active",
    reason: "Phase 9 onboarding assignment",
    created_by: gymAdmin.id
  });
  await expect(assignment.id).toBeTruthy();

  const ptPackage = await serviceInsert<{ id: string }>("personal_training_packages", {
    gym_id: gymId,
    name: `${runId} PT Package`,
    slug: `p9-pt-${suffix}`.replace(/[^a-z0-9-]/g, "-"),
    description: "Phase 9 personal training package.",
    session_count: 8,
    validity_days: 45,
    price_amount: 5000,
    status: "active",
    created_by: gymAdmin.id
  });
  const memberPtPackage = await serviceInsert<{ id: string }>("member_pt_packages", {
    gym_id: gymId,
    member_id: member.id,
    trainer_id: trainer.id,
    pt_package_id: ptPackage.id,
    invoice_id: invoice.id,
    payment_id: payment.id,
    status: "active",
    starts_on: today(),
    expires_on: today(45),
    total_sessions: 8,
    used_sessions: 1,
    price_amount: 5000,
    created_by: reception.id
  });

  const workoutProgram = await serviceInsert<{ id: string }>("workout_programs", {
    gym_id: gymId,
    trainer_id: trainer.id,
    member_id: member.id,
    name: `${runId} Strength Program`,
    goal: "Build consistent strength",
    description: "Phase 9 workout assignment.",
    difficulty: "intermediate",
    duration_weeks: 4,
    status: "active",
    created_by: trainerProfile.id
  });
  await serviceInsert("workout_program_exercises", {
    program_id: workoutProgram.id,
    day_number: 1,
    exercise_name: "Squat",
    category: "legs",
    sets: "3",
    reps: "10",
    rest_seconds: 90,
    instructions: "Controlled tempo for Phase 9 validation.",
    display_order: 1
  });
  const workoutAssignment = await serviceInsert<{ id: string }>("workout_program_assignments", {
    gym_id: gymId,
    program_id: workoutProgram.id,
    trainer_id: trainer.id,
    member_id: member.id,
    status: "active",
    starts_on: today(),
    ends_on: today(28),
    assigned_by: trainerProfile.id
  });
  const fitnessGoal = await serviceInsert<{ id: string }>("fitness_goals", {
    gym_id: gymId,
    member_id: member.id,
    trainer_id: trainer.id,
    goal_type: "strength_increase",
    title: `${runId} strength goal`,
    target_value: 100,
    target_unit: "kg",
    start_value: 80,
    current_value: 85,
    starts_on: today(),
    target_date: today(60),
    status: "active",
    created_by: trainerProfile.id
  });
  const workoutSession = await serviceInsert<{ id: string }>("workout_sessions", {
    gym_id: gymId,
    member_id: member.id,
    trainer_id: trainer.id,
    workout_program_id: workoutProgram.id,
    workout_assignment_id: workoutAssignment.id,
    fitness_goal_id: fitnessGoal.id,
    session_date: today(),
    started_at: isoPlusHours(-2),
    completed_at: isoPlusHours(-1),
    duration_minutes: 60,
    status: "completed",
    workout_title: `${runId} Workout`,
    source: "assigned_program",
    notes: "Phase 9 workout completion."
  });
  await Promise.all([
    serviceInsert("exercise_logs", {
      gym_id: gymId,
      workout_session_id: workoutSession.id,
      member_id: member.id,
      exercise_name: "Squat",
      set_number: 1,
      target_reps: "10",
      reps_completed: 10,
      weight_used: 85,
      weight_unit: "kg",
      perceived_effort: 7,
      notes: runId
    }),
    serviceInsert("body_measurements", {
      gym_id: gymId,
      member_id: member.id,
      recorded_on: today(),
      weight_kg: 78.5,
      height_cm: 176,
      body_fat_percentage: 18,
      muscle_mass_kg: 35,
      notes: runId,
      recorded_by: trainerProfile.id
    }),
    serviceInsert("progress_photos", {
      gym_id: gymId,
      member_id: member.id,
      photo_date: today(),
      view_type: "front",
      storage_path: `phase9/${runId}/front.jpg`,
      image_url: "https://example.com/phase9-front.jpg",
      visibility: "member_and_trainer",
      notes: runId,
      uploaded_by: memberProfile.id
    }),
    serviceInsert("fitness_milestones", {
      gym_id: gymId,
      member_id: member.id,
      fitness_goal_id: fitnessGoal.id,
      milestone_type: "first_workout",
      title: `${runId} first workout complete`,
      metric_value: 1,
      badge_key: "phase9_first_workout",
      awarded_by: trainerProfile.id,
      metadata: { run_id: runId }
    }),
    serviceInsert("fitness_notification_events", {
      gym_id: gymId,
      member_id: member.id,
      trainer_id: trainer.id,
      event_type: "workout_logged",
      channel: "in_app",
      status: "sent",
      metadata: { run_id: runId }
    })
  ]);

  const nutritionPlan = await serviceInsert<{ id: string }>("nutrition_plans", {
    gym_id: gymId,
    member_id: member.id,
    trainer_id: trainer.id,
    name: `${runId} Nutrition Plan`,
    plan_type: "muscle_gain",
    description: "Phase 9 nutrition assignment.",
    target_calories: 2400,
    target_protein_g: 150,
    target_carbs_g: 260,
    target_fat_g: 70,
    water_target_ml: 3000,
    starts_on: today(),
    ends_on: today(30),
    status: "active",
    created_by: trainerProfile.id
  });
  const mealPlan = await serviceInsert<{ id: string }>("meal_plans", {
    gym_id: gymId,
    nutrition_plan_id: nutritionPlan.id,
    member_id: member.id,
    meal_type: "breakfast",
    title: `${runId} breakfast`,
    description: "Protein breakfast",
    calories: 500,
    protein_g: 35,
    carbs_g: 55,
    fat_g: 15,
    display_order: 1
  });
  await serviceInsert("meal_entries", {
    gym_id: gymId,
    member_id: member.id,
    nutrition_plan_id: nutritionPlan.id,
    meal_plan_id: mealPlan.id,
    entry_date: today(),
    meal_type: "breakfast",
    food_name: "Oats and eggs",
    calories: 520,
    protein_g: 34,
    carbs_g: 58,
    fat_g: 16,
    water_ml: 600,
    adherence_status: "logged",
    notes: runId
  });

  const ptSession = await serviceInsert<{ id: string }>("trainer_sessions", {
    gym_id: gymId,
    trainer_id: trainer.id,
    member_id: member.id,
    member_pt_package_id: memberPtPackage.id,
    workout_program_id: workoutProgram.id,
    session_date: ptSessionDate,
    starts_at: "08:00:00",
    ends_at: "09:00:00",
    duration_minutes: 60,
    status: "scheduled",
    workout_type: "Strength review",
    notes: runId,
    created_by: trainerProfile.id
  });
  await servicePatch("trainer_sessions", [eq("id", ptSession.id)], {
    status: "completed",
    completed_at: isoPlusHours(2),
    completion_notes: "Phase 9 PT session completed."
  });
  await Promise.all([
    serviceInsert("trainer_session_logs", {
      gym_id: gymId,
      session_id: ptSession.id,
      from_status: "scheduled",
      to_status: "completed",
      reason: "Phase 9 lifecycle completion",
      actor_id: trainerProfile.id
    }),
    serviceInsert("trainer_notes", {
      gym_id: gymId,
      trainer_id: trainer.id,
      member_id: member.id,
      session_id: ptSession.id,
      note_type: "progress",
      title: `${runId} PT note`,
      body: "Member completed all planned sets.",
      visibility: "trainer_and_member",
      created_by: trainerProfile.id
    }),
    serviceInsert("trainer_feedback", {
      gym_id: gymId,
      trainer_id: trainer.id,
      member_id: member.id,
      session_id: ptSession.id,
      rating: 5,
      feedback: "Phase 9 feedback.",
      is_public: false
    }),
    serviceInsert("trainer_notification_events", {
      gym_id: gymId,
      trainer_id: trainer.id,
      member_id: member.id,
      session_id: ptSession.id,
      member_pt_package_id: memberPtPackage.id,
      event_type: "session_scheduled",
      channel: "push",
      status: "sent",
      metadata: { run_id: runId }
    })
  ]);

  const scheduledPtSession = await serviceInsert<{ id: string }>("trainer_sessions", {
    gym_id: gymId,
    trainer_id: trainer.id,
    member_id: member.id,
    member_pt_package_id: memberPtPackage.id,
    workout_program_id: workoutProgram.id,
    session_date: scheduledPtSessionDate,
    starts_at: scheduledPtSessionStartsAt,
    ends_at: scheduledPtSessionEndsAt,
    duration_minutes: 60,
    status: "scheduled",
    workout_type: "Concurrent slot guard",
    notes: runId,
    created_by: trainerProfile.id
  });

  const category = await serviceInsert<{ id: string }>("class_categories", {
    gym_id: gymId,
    name: `${runId} HIIT`,
    slug: `p9-hiit-${suffix}`.replace(/[^a-z0-9-]/g, "-"),
    description: "Phase 9 class category.",
    color_token: "accent",
    status: "active",
    created_by: gymAdmin.id
  });
  const groupClass = await serviceInsert<{ id: string }>("classes", {
    gym_id: gymId,
    category_id: category.id,
    name: `${runId} HIIT Class`,
    slug: `p9-class-${suffix}`.replace(/[^a-z0-9-]/g, "-"),
    description: "Phase 9 class booking and waitlist validation.",
    class_type: "group_class",
    difficulty: "all_levels",
    duration_minutes: 45,
    default_capacity: 1,
    status: "active",
    membership_access: "active_members",
    created_by: gymAdmin.id
  });
  await serviceInsert("class_trainers", {
    gym_id: gymId,
    class_id: groupClass.id,
    trainer_id: trainer.id,
    role: "primary",
    status: "active",
    created_by: gymAdmin.id
  });
  const schedule = await serviceInsert<{ id: string }>("class_schedules", {
    gym_id: gymId,
    class_id: groupClass.id,
    recurrence: "one_time",
    start_date: classSessionDate,
    starts_at: "07:00:00",
    ends_at: "07:45:00",
    capacity_override: 1,
    status: "active",
    created_by: gymAdmin.id,
    notes: runId
  });
  const classSession = await serviceInsert<{ id: string }>("class_sessions", {
    gym_id: gymId,
    class_id: groupClass.id,
    schedule_id: schedule.id,
    primary_trainer_id: trainer.id,
    session_date: classSessionDate,
    starts_at: "07:00:00",
    ends_at: "07:45:00",
    capacity: 1,
    status: "scheduled",
    location: "Phase 9 Studio",
    created_by: gymAdmin.id
  });
  const booking = await serviceInsert<{ id: string }>("class_bookings", {
    gym_id: gymId,
    session_id: classSession.id,
    class_id: groupClass.id,
    member_id: member.id,
    status: "booked",
    booking_source: "member_portal",
    created_by: memberProfile.id,
    metadata: { run_id: runId }
  });
  const waitlist = await serviceInsert<{ id: string }>("class_waitlists", {
    gym_id: gymId,
    session_id: classSession.id,
    class_id: groupClass.id,
    member_id: waitlistMember.id,
    position: 1,
    status: "waiting",
    created_by: reception.id,
    metadata: { run_id: runId }
  });
  await serviceRpc("recalculate_class_session_counts", { target_session_id: classSession.id });
  await servicePatch("class_bookings", [eq("id", booking.id)], {
    status: "attended",
    checked_in_at: new Date().toISOString()
  });
  await Promise.all([
    serviceInsert("class_attendance", {
      gym_id: gymId,
      session_id: classSession.id,
      booking_id: booking.id,
      class_id: groupClass.id,
      member_id: member.id,
      status: "attended",
      method: "trainer",
      marked_by: trainerProfile.id,
      notes: runId
    }),
    serviceInsert("class_session_logs", {
      gym_id: gymId,
      session_id: classSession.id,
      class_id: groupClass.id,
      action: "phase9_attendance_recorded",
      from_status: "scheduled",
      to_status: "scheduled",
      actor_id: trainerProfile.id,
      metadata: { run_id: runId }
    }),
    serviceInsert("class_notification_events", {
      gym_id: gymId,
      session_id: classSession.id,
      class_id: groupClass.id,
      booking_id: booking.id,
      member_id: member.id,
      trainer_id: trainer.id,
      event_type: "booking_confirmed",
      channel: "push",
      status: "sent",
      metadata: { run_id: runId }
    })
  ]);

  await Promise.all([
    createNotification(gymId, memberProfile.id, member.id, null, "membership", `${runId} membership active`, "Membership activated."),
    createNotification(gymId, memberProfile.id, member.id, null, "payments", `${runId} payment success`, "Payment collected."),
    createNotification(gymId, memberProfile.id, member.id, null, "attendance", `${runId} attendance`, "Attendance recorded."),
    createNotification(gymId, memberProfile.id, member.id, null, "classes", `${runId} class reminder`, "Class booking confirmed."),
    createNotification(gymId, memberProfile.id, member.id, null, "workouts", `${runId} workout`, "Workout assigned."),
    createNotification(gymId, trainerProfile.id, null, trainer.id, "system", `${runId} trainer alert`, "Client progress updated."),
    createCommunication(gymId, memberProfile.id, member.id, null, "email", "membership", `${runId} welcome`, "Welcome message sent."),
    createCommunication(gymId, memberProfile.id, member.id, null, "push", "classes", `${runId} class`, "Class reminder sent."),
    createCommunication(gymId, trainerProfile.id, null, trainer.id, "internal", "workouts", `${runId} trainer`, "Trainer notified.")
  ]);

  await Promise.all([
    createAudit(gymId, reception.id, "member_created", "members", member.id, runId),
    createAudit(gymId, reception.id, "payment_collected", "payments", payment.id, runId),
    createAudit(gymId, trainerProfile.id, "workout_completed", "workout_sessions", workoutSession.id, runId),
    serviceInsert("activity_events", {
      organization_id: branch.organization_id,
      branch_id: branch.id,
      actor_id: reception.id,
      event_type: "phase9_workflow_completed",
      entity_type: "members",
      entity_id: member.id,
      severity: "info",
      metadata: { run_id: runId }
    }),
    serviceInsert("security_events", {
      organization_id: branch.organization_id,
      branch_id: branch.id,
      actor_id: gymAdmin.id,
      event_type: "phase9_access_denial_reviewed",
      severity: "low",
      status: "resolved",
      description: "Phase 9 workflow audit security trace.",
      metadata: { run_id: runId }
    }),
    serviceInsert("staff_activity_logs", {
      gym_id: gymId,
      staff_user_id: reception.id,
      action: "phase9_front_desk_workflow",
      entity_type: "members",
      entity_id: member.id,
      metadata: { run_id: runId }
    })
  ]);

  return {
    runId,
    suffix,
    organizationId: branch.organization_id,
    branchId: branch.id,
    gymId: gym.id,
    otherOrganizationId: otherOrg.id,
    otherBranchId: otherBranch.id,
    otherGymId: otherGym.id,
    gymAdminUserId: gymAdmin.id,
    receptionUserId: reception.id,
    trainerUserId: trainerProfile.id,
    memberUserId: memberProfile.id,
    trainerId: trainer.id,
    leadId: lead.id,
    memberId: member.id,
    waitlistMemberId: waitlistMember.id,
    expiredMemberId: expiredMember.id,
    frozenMemberId: frozenMember.id,
    suspendedMemberId: suspendedMember.id,
    otherTenantMemberId: otherTenantMember.id,
    planId: plan.id,
    membershipId: membership.id,
    invoiceId: invoice.id,
    paymentId: payment.id,
    partialInvoiceId: partialInvoice.id,
    partialPaymentId: partialPayment.id,
    ptPackageId: ptPackage.id,
    memberPtPackageId: memberPtPackage.id,
    ptSessionId: ptSession.id,
    scheduledPtSessionId: scheduledPtSession.id,
    scheduledPtSessionDate,
    scheduledPtSessionStartsAt,
    workoutProgramId: workoutProgram.id,
    workoutAssignmentId: workoutAssignment.id,
    nutritionPlanId: nutritionPlan.id,
    fitnessGoalId: fitnessGoal.id,
    workoutSessionId: workoutSession.id,
    classId: groupClass.id,
    classSessionId: classSession.id,
    classBookingId: booking.id,
    classWaitlistId: waitlist.id,
    attendanceSessionId: attendanceSession.id,
    qrTokenId: qrToken.id
  };
}

async function createWorkflowMember(
  runId: string,
  suffix: string,
  gymId: string,
  assignedTrainerId: string | null,
  createdBy: string,
  label: string
) {
  return serviceInsert<{ id: string }>("members", {
    gym_id: gymId,
    member_code: `${runId}-${label}`.toUpperCase().replace(/[^A-Z0-9-]/g, "-").slice(0, 48),
    full_name: `${runId} ${label} Member`,
    email: `member-${label.toLowerCase()}-${suffix}@example.com`,
    phone: `91${Math.floor(10000000 + Math.random() * 89999999)}`,
    emergency_contact_name: "Phase 9 Contact",
    emergency_contact_phone: "919999999999",
    assigned_trainer_id: assignedTrainerId,
    status: "active",
    joined_at: today(),
    created_by: createdBy,
    notes: runId,
    metadata: { run_id: runId, label }
  });
}

async function createNotification(
  gymId: string,
  userId: string | null,
  memberId: string | null,
  trainerId: string | null,
  category: string,
  title: string,
  body: string
) {
  return serviceInsert("notifications", {
    gym_id: gymId,
    user_id: userId,
    member_id: memberId,
    trainer_id: trainerId,
    category,
    title,
    body,
    priority: "normal",
    status: "unread",
    metadata: { source: "phase9" }
  });
}

async function createCommunication(
  gymId: string,
  recipientUserId: string | null,
  memberId: string | null,
  trainerId: string | null,
  channel: string,
  category: string,
  subject: string,
  body: string
) {
  return serviceInsert("communication_history", {
    gym_id: gymId,
    recipient_user_id: recipientUserId,
    member_id: memberId,
    trainer_id: trainerId,
    channel,
    category,
    direction: "outbound",
    subject,
    body,
    status: "sent",
    source_type: "phase9",
    metadata: { source: "phase9" }
  });
}

async function createAudit(gymId: string, actorId: string, action: string, entityType: string, entityId: string, runId: string) {
  return serviceInsert("audit_logs", {
    gym_id: gymId,
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: { run_id: runId }
  });
}

async function getWorkflowCounts(workflow: SeededWorkflow) {
  const filters = [eq("member_id", workflow.memberId)];
  const [
    memberships,
    payments,
    invoices,
    attendance,
    logs,
    assignments,
    workoutAssignments,
    workoutSessions,
    exerciseLogs,
    nutritionPlans,
    mealEntries,
    ptSessions,
    classBookings,
    classAttendance,
    notifications,
    communications,
    auditLogs
  ] = await Promise.all([
    serviceSelect("memberships", "id", filters),
    serviceSelect("payments", "id", filters),
    serviceSelect("invoices", "id", filters),
    serviceSelect("attendance_sessions", "id", filters),
    serviceSelect("attendance_logs", "id", filters),
    serviceSelect("trainer_assignments", "id", filters),
    serviceSelect("workout_program_assignments", "id", filters),
    serviceSelect("workout_sessions", "id", filters),
    serviceSelect("exercise_logs", "id", filters),
    serviceSelect("nutrition_plans", "id", filters),
    serviceSelect("meal_entries", "id", filters),
    serviceSelect("trainer_sessions", "id", filters),
    serviceSelect("class_bookings", "id", filters),
    serviceSelect("class_attendance", "id", filters),
    serviceSelect("notifications", "id", filters),
    serviceSelect("communication_history", "id", filters),
    serviceSelect("audit_logs", "id", [eq("entity_id", workflow.memberId)])
  ]);

  return {
    memberships: memberships.length,
    payments: payments.length,
    invoices: invoices.length,
    attendance: attendance.length,
    attendanceLogs: logs.length,
    trainerAssignments: assignments.length,
    workoutAssignments: workoutAssignments.length,
    workoutSessions: workoutSessions.length,
    exerciseLogs: exerciseLogs.length,
    nutritionPlans: nutritionPlans.length,
    mealEntries: mealEntries.length,
    ptSessions: ptSessions.length,
    classBookings: classBookings.length,
    classAttendance: classAttendance.length,
    notifications: notifications.length,
    communications: communications.length,
    auditLogs: auditLogs.length
  };
}

function readEnv(name: string) {
  return process.env[name] ?? localEnv[name] ?? null;
}

function requiredEnv(name: string, fallbackName?: string) {
  const value = readEnv(name) ?? (fallbackName ? readEnv(fallbackName) : null);
  if (!value) {
    throw new Error(`Missing required environment variable ${fallbackName ? `${name} or ${fallbackName}` : name}.`);
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

test.describe.serial("Business workflow QA audit", () => {
  let workflow: SeededWorkflow;

  test("Phase 9 seed covers lead conversion, onboarding, payments, attendance, trainer, class, nutrition, notifications, and audit trail", async ({}, testInfo) => {
    test.setTimeout(240_000);

    workflow = await seedWorkflow();
    const counts = await getWorkflowCounts(workflow);

    expect(counts.memberships).toBeGreaterThanOrEqual(1);
    expect(counts.payments).toBeGreaterThanOrEqual(3);
    expect(counts.invoices).toBeGreaterThanOrEqual(2);
    expect(counts.attendance).toBeGreaterThanOrEqual(1);
    expect(counts.attendanceLogs).toBeGreaterThanOrEqual(2);
    expect(counts.trainerAssignments).toBeGreaterThanOrEqual(1);
    expect(counts.workoutAssignments).toBeGreaterThanOrEqual(1);
    expect(counts.workoutSessions).toBeGreaterThanOrEqual(1);
    expect(counts.exerciseLogs).toBeGreaterThanOrEqual(1);
    expect(counts.nutritionPlans).toBeGreaterThanOrEqual(1);
    expect(counts.mealEntries).toBeGreaterThanOrEqual(1);
    expect(counts.ptSessions).toBeGreaterThanOrEqual(2);
    expect(counts.classBookings).toBeGreaterThanOrEqual(1);
    expect(counts.classAttendance).toBeGreaterThanOrEqual(1);
    expect(counts.notifications).toBeGreaterThanOrEqual(5);
    expect(counts.communications).toBeGreaterThanOrEqual(2);
    expect(counts.auditLogs).toBeGreaterThanOrEqual(1);

    await attachJson(testInfo, "phase9-seed-summary", { workflow, counts });
  });

  test("data consistency and financial links are intact across workflow modules", async ({}, testInfo) => {
    test.setTimeout(120_000);

    const membership = requireRow(await serviceSelect<{ id: string; member_id: string; gym_id: string; status: string; payment_status: string }>(
      "memberships",
      "id,member_id,gym_id,status,payment_status",
      [eq("id", workflow.membershipId)]
    ), "membership consistency row");
    const invoice = requireRow(await serviceSelect<{ id: string; member_id: string; membership_id: string; status: string; total_amount: number; amount_paid: number; amount_due: number }>(
      "invoices",
      "id,member_id,membership_id,status,total_amount,amount_paid,amount_due",
      [eq("id", workflow.invoiceId)]
    ), "invoice consistency row");
    const partialInvoice = requireRow(await serviceSelect<{ id: string; total_amount: number; amount_paid: number; amount_due: number; status: string }>(
      "invoices",
      "id,total_amount,amount_paid,amount_due,status",
      [eq("id", workflow.partialInvoiceId)]
    ), "partial invoice consistency row");
    const classSession = requireRow(await serviceSelect<{ id: string; booked_count: number; waitlist_count: number; capacity: number }>(
      "class_sessions",
      "id,booked_count,waitlist_count,capacity",
      [eq("id", workflow.classSessionId)]
    ), "class session consistency row");
    const progressSummary = requireRow(await serviceSelect<{ member_id: string; completed_workouts: number; last_meal_log_date: string | null; milestone_count: number }>(
      "fitness_member_progress_summary",
      "member_id,completed_workouts,last_meal_log_date,milestone_count",
      [eq("member_id", workflow.memberId)]
    ), "fitness progress summary row");

    expect(membership).toMatchObject({
      member_id: workflow.memberId,
      gym_id: workflow.gymId,
      status: "active",
      payment_status: "paid"
    });
    expect(invoice).toMatchObject({
      member_id: workflow.memberId,
      membership_id: workflow.membershipId,
      status: "paid",
      total_amount: 3000,
      amount_paid: 3000,
      amount_due: 0
    });
    expect(partialInvoice.total_amount).toBe(1200);
    expect(partialInvoice.amount_paid).toBe(500);
    expect(partialInvoice.amount_due).toBe(700);
    expect(classSession.booked_count).toBeLessThanOrEqual(classSession.capacity);
    expect(classSession.waitlist_count).toBeGreaterThanOrEqual(1);
    expect(progressSummary.completed_workouts).toBeGreaterThanOrEqual(1);
    expect(progressSummary.last_meal_log_date).toBeTruthy();
    expect(progressSummary.milestone_count).toBeGreaterThanOrEqual(1);

    await attachJson(testInfo, "phase9-data-consistency", {
      membership,
      invoice,
      partialInvoice,
      classSession,
      progressSummary
    });
  });

  test("concurrency guards prevent duplicate check-ins, duplicate class bookings, and trainer double-booking", async ({}, testInfo) => {
    test.setTimeout(120_000);

    const duplicateAttendance = await restRequest("/rest/v1/attendance_sessions", {
      method: "POST",
      expectFailure: true,
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        gym_id: workflow.gymId,
        member_id: workflow.memberId,
        membership_id: workflow.membershipId,
        qr_token_id: workflow.qrTokenId,
        status: "inside",
        check_in_source: "reception",
        created_by: workflow.receptionUserId,
        notes: `${workflow.runId} duplicate guard`
      })
    });
    const duplicateOpenAttendance = await restRequest("/rest/v1/attendance_sessions", {
      method: "POST",
      expectFailure: true,
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        gym_id: workflow.gymId,
        member_id: workflow.memberId,
        membership_id: workflow.membershipId,
        qr_token_id: workflow.qrTokenId,
        status: "inside",
        check_in_source: "reception",
        created_by: workflow.receptionUserId,
        notes: `${workflow.runId} open-session duplicate attempt`
      })
    });
    const duplicateBooking = await restRequest("/rest/v1/class_bookings", {
      method: "POST",
      expectFailure: true,
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        gym_id: workflow.gymId,
        session_id: workflow.classSessionId,
        class_id: workflow.classId,
        member_id: workflow.memberId,
        status: "booked",
        booking_source: "member_portal",
        created_by: workflow.memberUserId,
        metadata: { run_id: workflow.runId, duplicate: true }
      })
    });
    const duplicateTrainerSession = await restRequest("/rest/v1/trainer_sessions", {
      method: "POST",
      expectFailure: true,
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        gym_id: workflow.gymId,
        trainer_id: workflow.trainerId,
        member_id: workflow.memberId,
        member_pt_package_id: workflow.memberPtPackageId,
        workout_program_id: workflow.workoutProgramId,
        session_date: workflow.scheduledPtSessionDate,
        starts_at: workflow.scheduledPtSessionStartsAt,
        ends_at: `${String(Number(workflow.scheduledPtSessionStartsAt.slice(0, 2)) + 1).padStart(2, "0")}:00:00`,
        duration_minutes: 60,
        status: "scheduled",
        workout_type: "Duplicate session",
        notes: workflow.runId,
        created_by: workflow.trainerUserId
      })
    });

    expect(duplicateAttendance.ok).toBeTruthy();
    expect(duplicateOpenAttendance.ok).toBeFalsy();
    expect(duplicateBooking.ok).toBeFalsy();
    expect(duplicateTrainerSession.ok).toBeFalsy();

    await attachJson(testInfo, "phase9-concurrency-guards", {
      duplicateAttendance: {
        ok: duplicateAttendance.ok,
        status: duplicateAttendance.status,
        payload: duplicateAttendance.payload
      },
      duplicateOpenAttendance: {
        ok: duplicateOpenAttendance.ok,
        status: duplicateOpenAttendance.status,
        payload: duplicateOpenAttendance.payload
      },
      duplicateBooking: {
        ok: duplicateBooking.ok,
        status: duplicateBooking.status,
        payload: duplicateBooking.payload
      },
      duplicateTrainerSession: {
        ok: duplicateTrainerSession.ok,
        status: duplicateTrainerSession.status,
        payload: duplicateTrainerSession.payload
      },
      finding: duplicateAttendance.ok
        ? "Attendance duplicate guard is only effective while an open session exists; a new inside session was allowed after checkout, which is expected for repeat visits."
        : "Attendance duplicate guard rejected the insert."
    });
  });

  test("attendance restriction bypass check: expired, frozen, and suspended members cannot be directly checked in through authenticated REST", async ({}, testInfo) => {
    test.setTimeout(120_000);

    const receptionToken = await rawSupabaseSignIn(receptionEmail);
    const attempts = await Promise.all([
      anonInsert(receptionToken, "attendance_sessions", {
        gym_id: workflow.gymId,
        member_id: workflow.expiredMemberId,
        status: "inside",
        check_in_source: "reception",
        created_by: workflow.receptionUserId,
        notes: `${workflow.runId} expired direct REST bypass attempt`
      }),
      anonInsert(receptionToken, "attendance_sessions", {
        gym_id: workflow.gymId,
        member_id: workflow.frozenMemberId,
        status: "inside",
        check_in_source: "reception",
        created_by: workflow.receptionUserId,
        notes: `${workflow.runId} frozen direct REST bypass attempt`
      }),
      anonInsert(receptionToken, "attendance_sessions", {
        gym_id: workflow.gymId,
        member_id: workflow.suspendedMemberId,
        status: "inside",
        check_in_source: "reception",
        created_by: workflow.receptionUserId,
        notes: `${workflow.runId} suspended direct REST bypass attempt`
      })
    ]);

    await attachJson(testInfo, "phase9-attendance-restriction-attempts", attempts.map((attempt) => ({
      ok: attempt.ok,
      status: attempt.status,
      payload: attempt.payload
    })));

    expect(attempts.every((attempt) => !attempt.ok)).toBe(true);
  });

  test("multi-tenant visibility remains isolated for member, trainer, and gym admin roles", async ({}, testInfo) => {
    test.setTimeout(120_000);

    const [memberToken, trainerToken, gymAdminToken] = await Promise.all([
      rawSupabaseSignIn(memberEmail),
      rawSupabaseSignIn(trainerEmail),
      rawSupabaseSignIn(gymAdminEmail)
    ]);

    const [
      memberOwnRecords,
      memberPhase9Records,
      trainerAssignedRecords,
      trainerOtherTenantRecords,
      gymAdminOwnGymRecords,
      gymAdminOtherTenantRecords
    ] = await Promise.all([
      anonSelect<{ user_id: string | null }>(memberToken, "members", "id,user_id,gym_id", [eq("user_id", workflow.memberUserId)]),
      anonSelect<{ id: string }>(memberToken, "members", "id", [eq("id", workflow.memberId)]),
      anonSelect<{ id: string }>(trainerToken, "members", "id", [eq("id", workflow.memberId)]),
      anonSelect<{ id: string }>(trainerToken, "members", "id", [eq("id", workflow.otherTenantMemberId)]),
      anonSelect<{ id: string }>(gymAdminToken, "members", "id", [eq("id", workflow.memberId)]),
      anonSelect<{ id: string }>(gymAdminToken, "members", "id", [eq("id", workflow.otherTenantMemberId)])
    ]);

    expect(memberOwnRecords.length).toBeGreaterThanOrEqual(1);
    expect(memberPhase9Records).toEqual([]);
    expect(trainerAssignedRecords).toHaveLength(1);
    expect(trainerOtherTenantRecords).toEqual([]);
    expect(gymAdminOwnGymRecords).toHaveLength(1);
    expect(gymAdminOtherTenantRecords).toEqual([]);

    await attachJson(testInfo, "phase9-multi-tenant-rls", {
      memberOwnRecords: memberOwnRecords.length,
      memberPhase9Records: memberPhase9Records.length,
      trainerAssignedRecords: trainerAssignedRecords.length,
      trainerOtherTenantRecords: trainerOtherTenantRecords.length,
      gymAdminOwnGymRecords: gymAdminOwnGymRecords.length,
      gymAdminOtherTenantRecords: gymAdminOtherTenantRecords.length
    });
  });

  test("production portal routes and operational report endpoints load without server crashes", async ({ page }, testInfo) => {
    test.setTimeout(420_000);
    const audit = setupAudit(page);
    const routeTimings: Array<{ role: string; timing: ApiTiming }> = [];
    const reportTimings: ApiTiming[] = [];

    for (const role of roleRoutes) {
      await loginAs(page, role.email, role.expectedPath);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);

      for (const route of role.routes) {
        const timing = await gotoTimed(page, route);
        routeTimings.push({ role: role.name, timing });
        await expect(page.locator("main")).toBeVisible();
        await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
      }

      await page.screenshot({ fullPage: true, path: testInfo.outputPath(`${role.name.toLowerCase().replace(/\s+/g, "-")}-phase9.png`) });
    }

    await loginAs(page, gymAdminEmail, "/admin");
    for (const endpoint of reportEndpoints) {
      reportTimings.push(await requestTimed(page, endpoint.name, endpoint.route));
    }

    for (const result of reportTimings) {
      expect(result.status, `${result.name} report status`).toBeLessThan(500);
    }

    await attachJson(testInfo, "phase9-production-route-report-performance", {
      routeTimings,
      reportTimings,
      targets: {
        checkIn: "< 1000ms through server action path",
        payment: "< 2000ms for operational payments",
        report: "< 5000ms"
      }
    });
    await expectNoClientCrashes(audit);
  });
});
