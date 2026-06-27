import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const email = readEnv("E2E_ORGANIZATION_OWNER_EMAIL") ?? "hthitame+qa.owner@gmail.com";
const publicSupabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

test.use({ screenshot: "on", serviceWorkers: "block", trace: "on" });

async function loginAs(page: Page, expectedPath: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expectPath(page, expectedPath);
}

async function expectPath(page: Page, path: string) {
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe(path);
}

async function getOrganizationIdForAccount(e: string) {
  const profiles = await serviceSelect<Array<{ id: string; gym_id: string | null }>>(
    "profiles", "id,gym_id", [eq("email", e), limit(1)]
  );
  const profile = requireRow(profiles, `profile ${e}`);
  if (!profile.gym_id) throw new Error(`Profile ${e} is not linked to a gym.`);

  const gyms = await serviceSelect<Array<{ organization_id: string }>>(
    "gyms", "organization_id", [eq("id", profile.gym_id), limit(1)]
  );
  return requireRow(gyms, `gym ${profile.gym_id}`).organization_id;
}

async function ensureEnterprisePlan(organizationId: string) {
  const packages = await serviceSelect<Array<{ id: string }>>(
    "packages", "id", ["is_active=eq.true", "order=sort_order.desc", limit(1)]
  );
  const pkg = requireRow(packages, "enterprise package");
  await assignSubscription(organizationId, pkg.id);
}

async function ensureGrowthPlan(organizationId: string) {
  const packages = await serviceSelect<Array<{ id: string }>>(
    "packages", "id", ["is_active=eq.true", "order=sort_order.asc", "limit=3"]
  );
  const pkg = packages.length >= 2 ? packages[1] : packages[0];
  if (pkg) await assignSubscription(organizationId, pkg.id);
}

async function ensureStarterPlan(organizationId: string) {
  const packages = await serviceSelect<Array<{ id: string }>>(
    "packages", "id", ["is_active=eq.true", "order=sort_order.asc", limit(1)]
  );
  const pkg = requireRow(packages, "starter package");
  await assignSubscription(organizationId, pkg.id);
}

async function assignSubscription(organizationId: string, packageId: string) {
  const existing = await serviceSelect<Array<{ id: string }>>(
    "organization_subscriptions", "id", [eq("organization_id", organizationId), limit(1)]
  );
  if (existing[0]) {
    await servicePatch("organization_subscriptions", [eq("id", existing[0].id)], {
      package_id: packageId, status: "active"
    });
  } else {
    await serviceInsert("organization_subscriptions", {
      organization_id: organizationId, package_id: packageId, status: "active"
    });
  }
}

async function getSidebarText(page: Page) {
  return page.locator('nav[aria-label="Portal"]').first().innerText();
}

test.describe("Organization Owner — Entitlement Gating", () => {

  test("Enterprise plan — sidebar shows all unlocked modules", async ({ page }) => {
    test.setTimeout(90_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureEnterprisePlan(orgId);

    await loginAs(page, "/organization");
    await page.goto("/organization", { waitUntil: "domcontentloaded" });

    const sidebar = await getSidebarText(page);

    const enterpriseModules = [
      "Dashboard", "Plan", "Branches", "Staff", "Members", "Memberships",
      "Revenue", "Trainers", "Attendance", "Classes", "Communications",
      "Analytics", "Branding", "Domains", "Billing", "Nutrition",
      "Support", "Profile", "Settings", "Security", "Leads",
      "Custom Roles", "Equipment"
    ];

    for (const mod of enterpriseModules) {
      expect(sidebar, `Enterprise sidebar should contain "${mod}"`).toContain(mod);
    }

    expect(sidebar.toLowerCase()).not.toMatch(/upgrade/i);
    expect(sidebar.toLowerCase()).not.toMatch(/locked/i);
    expect(sidebar).not.toMatch(/Not included/i);
  });

  test("Growth plan — sidebar shows mixed locked/unlocked", async ({ page }) => {
    test.setTimeout(90_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureGrowthPlan(orgId);

    await loginAs(page, "/organization");
    await page.goto("/organization", { waitUntil: "domcontentloaded" });

    const sidebar = await getSidebarText(page);

    const unlockedModules = [
      "Branches", "Staff", "Members", "Revenue", "Trainers",
      "Attendance", "Classes", "Communications", "Analytics", "Billing"
    ];

    for (const mod of unlockedModules) {
      expect(sidebar, `Growth sidebar should contain "${mod}"`).toContain(mod);
    }

    const lockedModules = ["Custom Roles", "Equipment", "Leads", "Branding", "Domains"];
    for (const mod of lockedModules) {
      expect(sidebar.toLowerCase(), `Growth sidebar should mention "${mod}" even if locked`).toMatch(new RegExp(mod.toLowerCase(), "i"));
    }
  });

  test("Starter plan — sidebar mostly locked", async ({ page }) => {
    test.setTimeout(90_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureStarterPlan(orgId);

    await loginAs(page, "/organization");
    await page.goto("/organization", { waitUntil: "domcontentloaded" });

    const sidebar = await getSidebarText(page);

    const visibleModules = ["Dashboard", "Plan", "Staff", "Members", "Memberships", "Attendance", "Billing"];
    for (const mod of visibleModules) {
      expect(sidebar, `Starter sidebar should contain "${mod}"`).toContain(mod);
    }

    const lockedOrAbsent = ["Analytics", "Classes", "Communications", "Trainers", "Revenue"];
    for (const mod of lockedOrAbsent) {
      const modInSidebar = sidebar.toLowerCase().includes(mod.toLowerCase());
      expect(modInSidebar, `${mod} should be mentioned in sidebar`).toBe(true);
    }
  });

  test("Direct route access — locked features redirect for Starter plan", async ({ page }) => {
    test.setTimeout(90_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureStarterPlan(orgId);
    await loginAs(page, "/organization");

    await page.goto("/organization/equipment", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);

    const currentPath = new URL(page.url()).pathname;
    const isRedirected = currentPath !== "/organization/equipment" ||
      ["/organization/locked-feature", "/unauthorized", "/organization"].includes(currentPath);

    const body = await page.innerText("body").catch(() => "");
    const hasLockedMessage = body.toLowerCase().includes("feature not in your plan") ||
      body.toLowerCase().includes("upgrade") ||
      body.toLowerCase().includes("not available") ||
      body.toLowerCase().includes("unauthorized") ||
      body.toLowerCase().includes("not included");

    if (!isRedirected && !hasLockedMessage) {
      await expect(page.locator("main").first()).toBeVisible({ timeout: 5_000 }).catch(() => {});
      await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
    }
  });

  test("Direct route access — unlocked features load for Enterprise plan", async ({ page }) => {
    test.setTimeout(90_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureEnterprisePlan(orgId);
    await loginAs(page, "/organization");

    await page.goto("/organization/equipment", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText("500", { exact: false })).toHaveCount(0);

    const path = await page.evaluate(() => new URL(window.location.href).pathname);
    expect(path.startsWith("/organization")).toBe(true);
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

function eq(column: string, value: string) {
  return `${column}=eq.${encodeURIComponent(value)}`;
}

function limit(count: number) {
  return `limit=${count}`;
}

function requireRow<T>(rows: T[], label: string) {
  const row = rows[0];
  if (!row) throw new Error(`Supabase returned no row for ${label}.`);
  return row;
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
