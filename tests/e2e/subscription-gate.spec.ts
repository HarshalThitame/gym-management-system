import { expect, type Page, test } from "@playwright/test";

// Fixture requirements:
// - E2E_SUPER_ADMIN_EMAIL can access /super-admin/subscriptions.
// - E2E_ORGANIZATION_OWNER_EMAIL belongs to a profile linked to a gym whose organization has a subscription row.
// - E2E_GYM_ADMIN_EMAIL belongs to an org that can be assigned a package without class scheduling for locked-state checks.

const password = requiredEnv("E2E_AUTH_PASSWORD");
const publicSupabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const superAdminEmail = readEnv("E2E_SUPER_ADMIN_EMAIL") ?? "hthitame+qa.superadmin@gmail.com";
const organizationOwnerEmail = readEnv("E2E_ORGANIZATION_OWNER_EMAIL") ?? "hthitame+qa.owner@gmail.com";
const gymAdminEmail = readEnv("E2E_GYM_ADMIN_EMAIL") ?? "hthitame+qa.admin@gmail.com";

test.use({ screenshot: "on", serviceWorkers: "block", trace: "on", video: "on" });

test.describe("subscription gate smoke", () => {
  test("Super Admin can open subscription assignments and save a package", async ({ page }) => {
    await loginAs(page, superAdminEmail, "/super-admin");
    await page.goto("/super-admin/subscriptions");

    await expect(page.getByRole("heading", { name: /Subscription Management/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Package Assignments/i })).toBeVisible();

    const action = page.getByRole("button", { name: /Assign Plan|Change Plan/i }).first();
    await expect(action).toBeVisible();
    await action.click();

    await expect(page.getByRole("dialog", { name: /Package Assignment/i })).toBeVisible();
    await page.getByLabel("Status").selectOption("active");
    await page.getByRole("button", { name: /Save Plan/i }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("Organization Owner can view the current plan and feature list", async ({ page }) => {
    const organizationId = await getOrganizationIdForAccount(organizationOwnerEmail);
    await ensureSubscriptionStatus(organizationId, "active");

    await loginAs(page, organizationOwnerEmail, "/organization");
    await page.goto("/organization/plan");

    await expect(page.getByRole("heading", { name: "Current Plan" })).toBeVisible();
    await expect(page.getByText("QR Attendance")).toBeVisible();
    await expect(page.getByText("Member Limit")).toBeVisible();
    await expect(page.getByText("Branch Limit")).toBeVisible();
  });

  test("Organization Owner is redirected when subscription is suspended", async ({ page }) => {
    const organizationId = await getOrganizationIdForAccount(organizationOwnerEmail);
    await ensureSubscriptionStatus(organizationId, "active");

    await loginAs(page, organizationOwnerEmail, "/organization");
    await ensureSubscriptionStatus(organizationId, "suspended");
    await page.goto("/organization/dashboard");

    await expect(page).toHaveURL(/\/unauthorized\?reason=subscription_suspended/);

    await ensureSubscriptionStatus(organizationId, "active");
  });

  test("class scheduling renders a locked feature state for an organization without the feature", async ({ page }) => {
    const organizationId = await getOrganizationIdForAccount(gymAdminEmail);
    await ensurePackageWithFeatureState(organizationId, { classSchedulingEnabled: false });

    await loginAs(page, gymAdminEmail, "/admin");
    await page.goto("/admin/classes");

    await expect(page.getByText(/Upgrade to/i).or(page.getByText(/Class Scheduling/i))).toBeVisible();
    await expect(page.getByText(/Required plan|Upgrade/i)).toBeVisible();
  });
});

async function loginAs(page: Page, email: string, expectedPath: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expectPath(page, expectedPath);
}

async function expectPath(page: Page, path: string) {
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe(path);
}

async function getOrganizationIdForAccount(email: string) {
  const profiles = await serviceSelect<Array<{ id: string; gym_id: string | null }>>("profiles", "id,gym_id", [eq("email", email), limit(1)]);
  const profile = requireRow(profiles, `profile ${email}`);
  if (!profile.gym_id) {
    throw new Error(`Profile ${email} is not linked to a gym.`);
  }

  const gyms = await serviceSelect<Array<{ organization_id: string }>>("gyms", "organization_id", [eq("id", profile.gym_id), limit(1)]);
  return requireRow(gyms, `gym ${profile.gym_id}`).organization_id;
}

async function ensureSubscriptionStatus(organizationId: string, status: "active" | "suspended") {
  const subscription = await getSubscriptionForOrganization(organizationId);
  if (subscription) {
    if (subscription.status !== status) {
      await servicePatch("organization_subscriptions", [eq("id", subscription.id)], { status });
    }
    return;
  }

  const packageId = await getFirstPackageId();
  await serviceInsert("organization_subscriptions", {
    organization_id: organizationId,
    package_id: packageId,
    status
  });
}

async function ensurePackageWithFeatureState(organizationId: string, input: { classSchedulingEnabled: boolean }) {
  const packages = await serviceSelect<Array<{ id: string }>>(
    "packages",
    "id",
    [`class_scheduling_enabled=eq.${String(input.classSchedulingEnabled)}`, "is_active=eq.true", limit(1)]
  );
  const packageId = requireRow(packages, "package with requested class scheduling state").id;
  const subscription = await getSubscriptionForOrganization(organizationId);

  if (subscription) {
    const needsUpdate = subscription.package_id !== packageId || subscription.status !== "active";
    if (needsUpdate) {
      await servicePatch("organization_subscriptions", [eq("id", subscription.id)], {
        package_id: packageId,
        status: "active"
      });
    }
    return;
  }

  await serviceInsert("organization_subscriptions", {
    organization_id: organizationId,
    package_id: packageId,
    status: "active"
  });
}

async function getSubscriptionForOrganization(organizationId: string) {
  const subscriptions = await serviceSelect<Array<{ id: string; status: string; package_id: string }>>("organization_subscriptions", "id,status,package_id", [eq("organization_id", organizationId), limit(1)]);
  return subscriptions[0] ?? null;
}

async function getFirstPackageId() {
  const packages = await serviceSelect<Array<{ id: string }>>("packages", "id", ["is_active=eq.true", "order=sort_order.asc", limit(1)]);
  return requireRow(packages, "active package").id;
}

async function serviceSelect<T>(table: string, select: string, filters: string[] = []) {
  const query = [`select=${encodeURIComponent(select)}`, ...filters].join("&");
  const { payload } = await restRequest<T>(`/rest/v1/${table}?${query}`, { method: "GET" });
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

async function restRequest<T>(path: string, init: RequestInit) {
  const response = await fetch(`${publicSupabaseUrl}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(30_000),
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${payload?.message ?? payload?.error_description ?? text}`);
  }

  return { payload: payload as T };
}

function eq(column: string, value: string) {
  return `${column}=eq.${encodeURIComponent(value)}`;
}

function limit(count: number) {
  return `limit=${count}`;
}

function requireRow<T>(rows: T[], label: string) {
  const row = rows[0];
  if (!row) {
    throw new Error(`Supabase returned no row for ${label}.`);
  }
  return row;
}

function readEnv(name: string) {
  return process.env[name] ?? null;
}

function requiredEnv(name: string, fallbackName?: string) {
  const value = readEnv(name) ?? (fallbackName ? readEnv(fallbackName) : null);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
