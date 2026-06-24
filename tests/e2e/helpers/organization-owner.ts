import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const organizationOwnerEmail = readEnv("E2E_ORGANIZATION_OWNER_EMAIL") ?? "hthitame+qa.owner@gmail.com";
const publicSupabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

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
      content
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
        })
    );
  } catch {
    return {};
  }
}

async function currentPath(page: Page) {
  return new URL(page.url()).pathname;
}

async function expectPath(page: Page, path: string) {
  await expect.poll(() => currentPath(page), { timeout: 30_000 }).toBe(path);
}

export async function loginAsOrganizationOwner(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(organizationOwnerEmail);
  await page.getByLabel("Password").fill(password);
  const signInButton = page.getByRole("button", { name: /sign in/i });
  await expect(signInButton).toBeEnabled({ timeout: 10_000 });
  await signInButton.click();
  await expectPath(page, "/organization");
}

export function getOrgOwnerEmail() {
  return organizationOwnerEmail;
}

export function getAuthPassword() {
  return password;
}

export async function loginAsEnterpriseOwner(page: Page) {
  await loginAsOrganizationOwner(page);
  const orgId = await getOrganizationIdForAccount(organizationOwnerEmail);
  if (orgId) {
    await ensureEnterprisePlan(orgId);
  }
}

export async function loginAsGrowthOwner(page: Page) {
  await loginAsOrganizationOwner(page);
  const orgId = await getOrganizationIdForAccount(organizationOwnerEmail);
  if (orgId) {
    await ensureGrowthPlan(orgId);
  }
}

export async function loginAsStarterOwner(page: Page) {
  await loginAsOrganizationOwner(page);
  const orgId = await getOrganizationIdForAccount(organizationOwnerEmail);
  if (orgId) {
    await ensureStarterPlan(orgId);
  }
}

export async function navigateToModule(page: Page, path: string) {
  await page.goto(path);
  await expectPath(page, path);
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
}

export async function verifyModuleLoaded(page: Page, expectedText: string) {
  await expect(page.getByText(expectedText, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
}

export async function verifySidebarLocked(page: Page, label: string) {
  const nav = page.locator('nav[aria-label="Portal"]');
  const link = nav.getByText(label, { exact: true });
  await expect(link).toBeVisible();
}

export async function verifySidebarUnlocked(page: Page, label: string) {
  const nav = page.locator('nav[aria-label="Portal"]');
  const link = nav.getByText(label, { exact: false });
  await expect(link).toBeVisible();
}

export function setupAudit(page: Page) {
  const audit = {
    console: [] as Array<{ type: string; text: string }>,
    pageErrors: [] as string[],
    network: [] as Array<{ status: number; method: string; url: string }>,
  };

  page.on("console", (message) => {
    audit.console.push({ type: message.type(), text: message.text() });
  });

  page.on("pageerror", (error) => {
    audit.pageErrors.push(error.message);
  });

  page.on("response", (response) => {
    if (response.status() >= 500) {
      audit.network.push({
        status: response.status(),
        method: response.request().method(),
        url: response.url(),
      });
    }
  });

  return audit;
}

export function expectNoCrashes(audit: ReturnType<typeof setupAudit>) {
  const errors = audit.console
    .filter((e) => e.type === "error")
    .map((e) => e.text)
    .filter((t) => !t.includes("Failed to load resource: the server responded with a status of 403"));
  expect(errors).toEqual([]);
  expect(audit.pageErrors).toEqual([]);
  expect(audit.network).toEqual([]);
}

async function getOrganizationIdForAccount(email: string) {
  if (!publicSupabaseUrl || !serviceRoleKey) return null;
  try {
    const profiles = await serviceSelect<Array<{ id: string; gym_id: string | null }>>("profiles", "id,gym_id", [eq("email", email), limit(1)]);
    const profile = profiles[0];
    if (!profile?.gym_id) return null;
    const gyms = await serviceSelect<Array<{ organization_id: string }>>("gyms", "organization_id", [eq("id", profile.gym_id), limit(1)]);
    return gyms[0]?.organization_id ?? null;
  } catch {
    return null;
  }
}

async function ensureEnterprisePlan(organizationId: string) {
  const packages = await serviceSelect<Array<{ id: string }>>("packages", "id", ["is_active=eq.true", "order=sort_order.desc", limit(1)]);
  const pkg = packages[0];
  if (pkg) {
    await assignPackage(organizationId, pkg.id);
  }
}

async function ensureGrowthPlan(organizationId: string) {
  const packages = await serviceSelect<Array<{ id: string }>>("packages", "id", ["is_active=eq.true", "order=sort_order.asc", "limit=3"]);
  const pkg = packages.length >= 2 ? packages[1] : packages[0];
  if (pkg) {
    await assignPackage(organizationId, pkg.id);
  }
}

async function ensureStarterPlan(organizationId: string) {
  const packages = await serviceSelect<Array<{ id: string }>>("packages", "id", ["is_active=eq.true", "order=sort_order.asc", limit(1)]);
  const pkg = packages[0];
  if (pkg) {
    await assignPackage(organizationId, pkg.id);
  }
}

async function assignPackage(organizationId: string, packageId: string) {
  const existing = await serviceSelect<Array<{ id: string }>>("organization_subscriptions", "id", [eq("organization_id", organizationId), limit(1)]);
  if (existing[0]) {
    await servicePatch("organization_subscriptions", [eq("id", existing[0].id)], { package_id: packageId, status: "active" });
  } else {
    await serviceInsert("organization_subscriptions", {
      organization_id: organizationId,
      package_id: packageId,
      status: "active",
    });
  }
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
    body: JSON.stringify(body),
  });
  return payload[0] ?? null;
}

async function servicePatch<T>(table: string, filters: string[], body: Record<string, unknown>) {
  const { payload } = await restRequest<T[]>(`/rest/v1/${table}?${filters.join("&")}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  return payload[0] ?? null;
}

async function restRequest<T>(path: string, init: RequestInit) {
  const response = await fetch(`${publicSupabaseUrl}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(30_000),
    headers: {
      apikey: serviceRoleKey!,
      authorization: `Bearer ${serviceRoleKey!}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
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
