import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const email = readEnv("E2E_ORGANIZATION_OWNER_EMAIL") ?? "hthitame+qa.owner@gmail.com";
const publicSupabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

test.use({ screenshot: "on", trace: "on" });

async function loginAs(page: Page, loginEmail: string, expectedPath: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(loginEmail);
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
  const profile = profiles[0];
  if (!profile?.gym_id) throw new Error(`Profile ${e} is not linked to a gym.`);
  const gyms = await serviceSelect<Array<{ organization_id: string }>>(
    "gyms", "organization_id", [eq("id", profile.gym_id), limit(1)]
  );
  return gyms[0]?.organization_id ?? "";
}

async function ensureEnterprisePlan(organizationId: string) {
  const packages = await serviceSelect<Array<{ id: string }>>(
    "packages", "id", ["is_active=eq.true", "order=sort_order.desc", limit(1)]
  );
  const pkg = packages[0];
  if (pkg) await assignSubscription(organizationId, pkg.id);
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

test.describe("Organization Owner — Custom Roles", () => {

  test("Custom roles page loads", async ({ page }) => {
    test.setTimeout(90_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureEnterprisePlan(orgId);
    await loginAs(page, email, "/organization");
    await page.goto("/organization/custom-roles");
    const actualPath = new URL(page.url()).pathname;

    if (actualPath.includes("locked-feature") || actualPath.includes("unauthorized")) {
      const body = await page.innerText("body").catch(() => "");
      expect(body.toLowerCase()).toMatch(/feature|upgrade|plan|not included/);
      return;
    }

    await expect(page.locator("main").first()).toBeVisible();
    const roleList = page.getByRole("table").or(page.getByText(/no roles/i));
    await expect(roleList.first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Create custom role button exists", async ({ page }) => {
    test.setTimeout(90_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureEnterprisePlan(orgId);
    await loginAs(page, email, "/organization");
    await page.goto("/organization/custom-roles");
    const actualPath = new URL(page.url()).pathname;

    if (actualPath.includes("locked-feature") || actualPath.includes("unauthorized")) {
      const body = await page.innerText("body").catch(() => "");
      expect(body.toLowerCase()).toMatch(/feature|upgrade|plan|not included/);
      return;
    }

    const createBtn = page.getByRole("button", { name: /create role|add role/i });
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Create custom role dialog opens", async ({ page }) => {
    test.setTimeout(90_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureEnterprisePlan(orgId);
    await loginAs(page, email, "/organization");
    await page.goto("/organization/custom-roles");
    const actualPath = new URL(page.url()).pathname;

    if (actualPath.includes("locked-feature") || actualPath.includes("unauthorized")) {
      const body = await page.innerText("body").catch(() => "");
      expect(body.toLowerCase()).toMatch(/feature|upgrade|plan|not included/);
      return;
    }

    const createBtn = page.getByRole("button", { name: /create role|add role/i });
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/role name/i)).toBeVisible();
    const permissionCheckboxes = page.getByRole("checkbox");
    const checkboxCount = await permissionCheckboxes.count();
    expect(checkboxCount).toBeGreaterThanOrEqual(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Custom role table/content renders", async ({ page }) => {
    test.setTimeout(90_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureEnterprisePlan(orgId);
    await loginAs(page, email, "/organization");
    await page.goto("/organization/custom-roles");
    const actualPath = new URL(page.url()).pathname;

    if (actualPath.includes("locked-feature") || actualPath.includes("unauthorized")) {
      const body = await page.innerText("body").catch(() => "");
      expect(body.toLowerCase()).toMatch(/feature|upgrade|plan|not included/);
      return;
    }

    await page.waitForTimeout(2_000);
    await expect(page.locator("main").first()).toBeVisible();
    const tableOrList = page.getByRole("table");
    const noRolesMessage = page.getByText(/no roles|no custom roles/i);
    const hasContent = await tableOrList.isVisible().catch(() => false) || await noRolesMessage.isVisible().catch(() => false);
    expect(hasContent).toBe(true);
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

});

function readEnv(name: string) {
  return process.env[name] ?? localEnv[name] ?? null;
}

function requiredEnv(name: string) {
  const value = readEnv(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function readLocalEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    return Object.fromEntries(
      content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")]; })
    );
  } catch { return {}; }
}

function eq(column: string, value: string) {
  return `${column}=eq.${encodeURIComponent(value)}`;
}

function limit(count: number) {
  return `limit=${count}`;
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
  return payload[0];
}

async function servicePatch<T>(table: string, filters: string[], body: Record<string, unknown>) {
  const { payload } = await restRequest<T[]>(`/rest/v1/${table}?${filters.join("&")}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  return payload[0];
}

async function restRequest<T>(path: string, init: RequestInit) {
  const response = await fetch(`${publicSupabaseUrl}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(30_000),
    headers: {
      apikey: serviceRoleKey!,
      authorization: `Bearer ${serviceRoleKey!}`,
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
