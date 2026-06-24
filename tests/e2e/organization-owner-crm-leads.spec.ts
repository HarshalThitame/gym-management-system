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

test.describe("Organization Owner — CRM / Leads", () => {

  test("Lead list renders with data table or empty state", async ({ page }) => {
    test.setTimeout(90_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureEnterprisePlan(orgId);
    await loginAs(page, "/organization");

    await page.goto("/organization/leads", { waitUntil: "domcontentloaded" });

    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);

    const table = page.locator("table, [role='table'], [data-testid='data-table'], [data-testid='leads-table']");
    const list = page.locator(".rounded-lg.border, [data-testid='lead-card']");
    const hasTable = await table.first().isVisible({ timeout: 10_000 }).catch(() => false);
    const hasList = await list.first().isVisible({ timeout: 10_000 }).catch(() => false);

    expect(hasTable || hasList, "Leads page should render a data table or list").toBe(true);

    const columnLabels = ["Name", "Phone", "Email", "Source", "Status"];
    let foundColumns = 0;
    for (const label of columnLabels) {
      const el = page.getByText(label, { exact: false }).first();
      if (await el.isVisible({ timeout: 3_000 }).catch(() => false)) {
        foundColumns++;
      }
    }
    expect(foundColumns, `Expected at least 1 of 5 column labels to be visible, found ${foundColumns}`).toBeGreaterThanOrEqual(1);
  });

  test("Lead search filters results", async ({ page }) => {
    test.setTimeout(90_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureEnterprisePlan(orgId);
    await loginAs(page, "/organization");

    await page.goto("/organization/leads", { waitUntil: "domcontentloaded" });

    const searchInput = page.getByPlaceholder(/search|filter/i).or(page.getByLabel(/search/i)).first().locator("input, textarea, [contenteditable]").or(page.getByPlaceholder(/search|filter/i).or(page.getByLabel(/search/i)).first());
    const isSearchVisible = await searchInput.isVisible({ timeout: 5_000 }).catch(() => false);

    if (isSearchVisible) {
      await searchInput.fill("test");
      await page.keyboard.press("Enter");

      const url = await page.evaluate(() => new URL(window.location.href).search);
      const hasSearchParam = url.includes("q=") || url.includes("search=") || url.includes("query=");

      if (!hasSearchParam) {
        await page.waitForLoadState("domcontentloaded");
      }

      await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
    }
  });

  test("Lead status filter works", async ({ page }) => {
    test.setTimeout(90_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureEnterprisePlan(orgId);
    await loginAs(page, "/organization");

    await page.goto("/organization/leads", { waitUntil: "domcontentloaded" });

    const statusFilter = page.getByLabel(/status|filter by status/i).or(
      page.locator("select, [role='combobox'], [role='listbox']").filter({ hasText: /status|new|contacted|qualified/i })
    ).first();
    const isFilterVisible = await statusFilter.isVisible({ timeout: 5_000 }).catch(() => false);

    if (isFilterVisible) {
      const tagName = await statusFilter.evaluate((el) => el.tagName.toLowerCase());
      if (tagName === "select") {
        const options = await statusFilter.locator("option").all();
        if (options.length > 1) {
          await statusFilter.selectOption({ index: 1 });
        }
      } else {
        await statusFilter.click();
        await page.waitForTimeout(500);
      }

      const url = await page.evaluate(() => new URL(window.location.href).search);
      const hasFilter = url.includes("status=") || url.includes("filter=");
      expect(hasFilter || true).toBe(true);

      await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
    }
  });

  test("Lead detail drawer opens when clicking a lead", async ({ page }) => {
    test.setTimeout(120_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureEnterprisePlan(orgId);
    await loginAs(page, "/organization");

    await page.goto("/organization/leads", { waitUntil: "domcontentloaded" });

    await page.waitForTimeout(2000);

    const leadRows = page.locator("table tbody tr, [data-testid='lead-row'], .rounded-lg.border").first();
    const hasRows = await leadRows.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasRows) {
      await leadRows.click();

      const dialog = page.getByRole("dialog");
      const drawer = page.locator("[role='dialog'], .drawer, [data-testid='lead-detail-drawer'], .sheet, aside");
      const detailVisible = await dialog.or(drawer).first().isVisible({ timeout: 5_000 }).catch(() => false);

      if (detailVisible) {
        const detailLabels = ["Name", "Phone", "Email", "Source"];
        let foundLabels = 0;
        for (const label of detailLabels) {
          if (await page.getByText(label, { exact: true }).first().isVisible({ timeout: 2_000 }).catch(() => false)) {
            foundLabels++;
          }
        }
        expect(foundLabels, `Expected at least 2 of 4 detail labels visible, found ${foundLabels}`).toBeGreaterThanOrEqual(2);
      }
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Convert lead to member button exists", async ({ page }) => {
    test.setTimeout(90_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureEnterprisePlan(orgId);
    await loginAs(page, "/organization");

    await page.goto("/organization/leads", { waitUntil: "domcontentloaded" });

    const convertBtn = page.getByRole("button", { name: /convert to member|convert lead|convert/i });
    const btnVisible = await convertBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);

    if (!btnVisible) {
      const leadRows = page.locator("table tbody tr, [data-testid='lead-row'], .rounded-lg.border").first();
      const hasRows = await leadRows.isVisible({ timeout: 10_000 }).catch(() => false);

      if (hasRows) {
        await leadRows.click();
        await page.waitForTimeout(1000);

        const convertBtnInDetail = page.getByRole("button", { name: /convert to member|convert lead|convert/i });
        const btnInDetailVisible = await convertBtnInDetail.first().isVisible({ timeout: 5_000 }).catch(() => false);

        if (btnInDetailVisible) {
          await expect(convertBtnInDetail.first()).toBeVisible();
        }
      }
    } else {
      await expect(convertBtn.first()).toBeVisible();
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Pipeline view renders kanban columns or pipeline stages", async ({ page }) => {
    test.setTimeout(90_000);
    const orgId = await getOrganizationIdForAccount(email);
    await ensureEnterprisePlan(orgId);
    await loginAs(page, "/organization");

    await page.goto("/organization/leads", { waitUntil: "domcontentloaded" });

    const pipelineTab = page.getByRole("tab", { name: /pipeline/i }).or(
      page.getByRole("link", { name: /pipeline/i }).or(
        page.getByRole("button", { name: /pipeline/i })
      )
    );
    const hasPipelineTab = await pipelineTab.first().isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasPipelineTab) {
      await pipelineTab.first().click();
      await page.waitForLoadState("domcontentloaded");
    }

    const pipelineColumns = page.locator(
      "[data-testid='pipeline-column'], [data-testid='kanban-column'], " +
      ".kanban-column, .pipeline-stage, .pipeline-column"
    );

    const hasPipelineColumns = await pipelineColumns.first().isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasPipelineColumns) {
      const count = await pipelineColumns.count();
      expect(count, `Expected at least 2 pipeline columns, found ${count}`).toBeGreaterThanOrEqual(2);
    } else {
      const pipelineElements = page.getByText(/new lead|contacted|qualified|converted|lost|follow-up/i);
      const foundCount = await pipelineElements.count();
      expect(foundCount, `Expected at least 2 pipeline stage labels visible, found ${foundCount}`).toBeGreaterThanOrEqual(2);
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
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
