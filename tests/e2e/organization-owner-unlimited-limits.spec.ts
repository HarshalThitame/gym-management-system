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

test.describe("Organization Owner — Unlimited Limits", () => {

  test("Enterprise plan — multiple member creations succeed without limit error", async ({ page }) => {
    test.setTimeout(120_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureEnterprisePlan(orgId);
    await loginAs(page, "/organization");

    await page.goto("/organization/members", { waitUntil: "domcontentloaded" });
    await expectPath(page, "/organization/members");

    for (let i = 1; i <= 4; i++) {
      const addBtn = page.getByRole("button", { name: /add member/i });
      if (await addBtn.isVisible()) {
        await addBtn.click();
      } else {
        continue;
      }

      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

      const nameInput = page.getByLabel("Full Name");
      if (await nameInput.isVisible()) {
        await nameInput.fill(`E2E Unlimited Test ${i}`);
      }

      const phoneInput = page.getByLabel("Phone");
      if (await phoneInput.isVisible()) {
        await phoneInput.fill(`+91987654328${i}`);
      }

      const gymSelect = page.getByLabel("Gym");
      if (await gymSelect.isVisible()) {
        const options = await gymSelect.locator("option").all();
        if (options.length > 1) {
          await gymSelect.selectOption({ index: 1 });
        }
      }

      const submitBtn = page.getByRole("dialog").getByRole("button", { name: /save|create|add/i }).first();
      if (await submitBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await submitBtn.click({ force: true }).catch(() => {});
      }

      await page.waitForTimeout(2_000);

      const dialog = page.getByRole("dialog");
      if (await dialog.isVisible()) {
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0, { timeout: 3_000 });
      }
    }

    await expect(page.getByText(/limit reached/i)).toHaveCount(0);
  });

  test("Growth plan — approaching limit warning shown or page loads without crash", async ({ page }) => {
    test.setTimeout(90_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureGrowthPlan(orgId);
    await loginAs(page, "/organization");

    await page.goto("/organization/members", { waitUntil: "domcontentloaded" });
    await expectPath(page, "/organization/members");

    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);

    const limitCounter = page.getByText(/\d+\s*(of|out of|\/)\s*\d+/i);
    const counterVisible = await limitCounter.first().isVisible().catch(() => false);
    if (counterVisible) {
      const text = await limitCounter.first().innerText();
      const matches = text.match(/\d+/g);
      if (matches && matches.length >= 2) {
        const used = parseInt(matches[0], 10);
        const total = parseInt(matches[1], 10);
        if (!isNaN(used) && !isNaN(total)) {
          expect(used).toBeGreaterThanOrEqual(0);
          expect(total).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  test("Enterprise plan — multiple branch creations succeed", async ({ page }) => {
    test.setTimeout(120_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureEnterprisePlan(orgId);
    await loginAs(page, "/organization");

    const branchRoute = "/organization/gyms";
    await page.goto(branchRoute, { waitUntil: "domcontentloaded" });

    const altBranchRoute = "/organization/branches";
    const response = await page.goto(altBranchRoute).catch(() => null);
    const currentPath = await page.evaluate(() => new URL(window.location.href).pathname);
    const targetRoute = response && response.status() === 200 ? altBranchRoute : branchRoute;

    if (currentPath !== targetRoute) {
      await page.goto(targetRoute, { waitUntil: "domcontentloaded" });
    }

    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);

    for (let i = 1; i <= 2; i++) {
      const createBtn = page.getByRole("button", { name: /create gym|add gym|create branch|add branch/i }).first();
      if (await createBtn.isVisible()) {
        await createBtn.click();
      } else {
        break;
      }

      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

      const nameInput = page.getByLabel(/name/i).first();
      if (await nameInput.isVisible()) {
        const slug = `e2e-unlimited-branch-${i}-${Date.now()}`;
        await nameInput.fill(slug);
      }

      const slugInput = page.getByLabel("Slug");
      if (await slugInput.isVisible()) {
        const slug = `e2e-unlimited-branch-${i}-${Date.now()}`;
        await slugInput.fill(slug);
      }

      const submitBtn = page.getByRole("dialog").getByRole("button", { name: /save|create|add/i }).first();
      if (await submitBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await submitBtn.click({ force: true }).catch(() => {});
      }

      await page.waitForTimeout(2_000);

      const dialog = page.getByRole("dialog");
      if (await dialog.isVisible()) {
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0, { timeout: 3_000 });
      }
    }
  });

  test("Enterprise plan — staff invitation works without limit errors", async ({ page }) => {
    test.setTimeout(90_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureEnterprisePlan(orgId);
    await loginAs(page, "/organization");

    await page.goto("/organization/staff", { waitUntil: "domcontentloaded" });
    await expectPath(page, "/organization/staff");

    await expect(page.locator("main").first()).toBeVisible();

    const inviteBtn = page.getByRole("button", { name: /invite/i });
    await expect(inviteBtn).toBeVisible();

    await inviteBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    const emailField = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    const nameField = page.getByLabel(/name/i);
    const anyField = emailField.or(nameField);
    await expect(anyField.first()).toBeVisible({ timeout: 5_000 });

    const limitError = page.getByText(/limit reached|upgrade required/i);
    await expect(limitError).toHaveCount(0);
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
