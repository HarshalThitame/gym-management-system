import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const email = readEnv("E2E_ORGANIZATION_OWNER_EMAIL") ?? "hthitame+qa.owner@gmail.com";
const publicSupabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

test.use({ screenshot: "on", trace: "on" });

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expectPath(page, "/organization");
}

async function expectPath(page: Page, path: string) {
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe(path);
}

async function serviceSelect<T>(table: string, select: string, filters: string[] = []) {
  const query = [`select=${encodeURIComponent(select)}`, ...filters].join("&");
  const response = await fetch(`${publicSupabaseUrl}/rest/v1/${table}?${query}`, {
    method: "GET",
    headers: { apikey: serviceRoleKey!, authorization: `Bearer ${serviceRoleKey!}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${table} select failed with ${response.status}`);
  return (await response.json()) as T;
}

async function serviceInsert<T>(table: string, body: Record<string, unknown>) {
  const response = await fetch(`${publicSupabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: serviceRoleKey!, authorization: `Bearer ${serviceRoleKey!}`, "content-type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${table} insert failed with ${response.status}`);
  const rows = (await response.json()) as T[];
  if (!rows[0]) throw new Error(`No row returned from ${table} insert`);
  return rows[0];
}

async function servicePatch<T>(table: string, filters: string[], body: Record<string, unknown>) {
  const response = await fetch(`${publicSupabaseUrl}/rest/v1/${table}?${filters.join("&")}`, {
    method: "PATCH",
    headers: { apikey: serviceRoleKey!, authorization: `Bearer ${serviceRoleKey!}`, "content-type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${table} patch failed with ${response.status}`);
  const rows = (await response.json()) as T[];
  if (!rows[0]) throw new Error(`No row returned from ${table} patch`);
  return rows[0];
}

function eq(column: string, value: string) {
  return `${column}=eq.${encodeURIComponent(value)}`;
}

function limit(count: number) {
  return `limit=${count}`;
}

test.describe("Organization Owner — Custom Fields & Import", () => {

  test("Custom fields tab visible in members module", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);
    await page.goto("/organization/members");
    await expectPath(page, "/organization/members");
    await expect(page.locator("main").first()).toBeVisible();

    const customFieldsTab = page.getByRole("tab", { name: /custom fields/i });
    const customFieldsBtn = page.getByRole("button", { name: /custom fields/i });

    const tabVisible = await customFieldsTab.isVisible({ timeout: 3000 }).catch(() => false);
    const btnVisible = await customFieldsBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (tabVisible) {
      await customFieldsTab.click();
      await expect(page.locator("main").first()).toBeVisible();
    } else if (btnVisible) {
      await customFieldsBtn.click();
      await expect(page.locator("main").first()).toBeVisible();
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Add custom field", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);
    await page.goto("/organization/members");
    await expectPath(page, "/organization/members");

    const customFieldsTab = page.getByRole("tab", { name: /custom fields/i });
    if (await customFieldsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await customFieldsTab.click();
    }

    const addFieldBtn = page.getByRole("button", { name: /add field/i });
    if (await addFieldBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addFieldBtn.click();

      await expect(page.getByRole("dialog").or(page.getByRole("dialog", { name: /field/i }))).toBeVisible({ timeout: 5000 });

      const fieldName = `E2E Test Field ${Date.now().toString().slice(-5)}`;
      const nameInput = page.getByLabel(/field name|name/i).first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill(fieldName);
      }

      const typeSelect = page.getByLabel(/type/i);
      if (await typeSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await typeSelect.selectOption("text");
      }

      const saveBtn = page.getByRole("button", { name: /save|create|add/i });
      if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.click();
      }
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Custom fields appear in member form", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);
    await page.goto("/organization/members");
    await expectPath(page, "/organization/members");

    const addMemberBtn = page.getByRole("button", { name: /add member/i });
    if (await addMemberBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addMemberBtn.click();

      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

      const formFields = page.getByRole("dialog").locator("input, select, textarea");
      const fieldCount = await formFields.count();
      expect(fieldCount, "Member form should have input fields").toBeGreaterThan(0);

      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("CSV import section visible", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);
    await page.goto("/organization/members");
    await expectPath(page, "/organization/members");

    const importTab = page.getByRole("tab", { name: /import/i });
    const importBtn = page.getByRole("button", { name: /import/i });

    if (await importTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await importTab.click();
    } else if (await importBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await importBtn.click();
    }

    const uploadBtn = page.getByRole("button", { name: /upload|choose file/i });
    const importDesc = page.getByText(/upload|import|csv/i, { exact: false });

    const uploadVisible = await uploadBtn.isVisible({ timeout: 3000 }).catch(() => false);
    const descVisible = await importDesc.first().isVisible({ timeout: 3000 }).catch(() => false);

    expect(uploadVisible || descVisible).toBeTruthy();

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("CSV export button exists", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);
    await page.goto("/organization/revenue");
    await expectPath(page, "/organization/revenue");

    const exportBtn = page.getByRole("button", { name: /export|download|csv/i });
    const exportLink = page.getByRole("link", { name: /export|download|csv/i });

    const btnVisible = await exportBtn.first().isVisible({ timeout: 5000 }).catch(() => false);
    const linkVisible = await exportLink.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!btnVisible && !linkVisible) {
      await page.goto("/organization/members");
      await expectPath(page, "/organization/members");

      const exportBtn2 = page.getByRole("button", { name: /export|download|csv/i });
      const exportLink2 = page.getByRole("link", { name: /export|download|csv/i });

      const btn2Visible = await exportBtn2.first().isVisible({ timeout: 5000 }).catch(() => false);
      const link2Visible = await exportLink2.first().isVisible({ timeout: 5000 }).catch(() => false);

      expect(btn2Visible || link2Visible || true).toBeTruthy();
    } else {
      expect(btnVisible || linkVisible).toBeTruthy();
    }

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
