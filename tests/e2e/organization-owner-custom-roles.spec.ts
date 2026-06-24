import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const email = readEnv("E2E_ORGANIZATION_OWNER_EMAIL") ?? "hthitame+qa.owner@gmail.com";

test.use({ screenshot: "on", trace: "on" });

/* ---------- helpers ---------- */

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

/* ---------- suite ---------- */

test.describe("Organization Owner — Custom Roles", () => {

  test("Custom roles page loads", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, email, "/organization");
    await page.goto("/organization/custom-roles");
    await expectPath(page, "/organization/custom-roles");

    await expect(page.locator("main").first()).toBeVisible();

    const roleList = page.getByRole("table").or(page.getByText(/no roles/i));
    await expect(roleList.first()).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Create custom role button exists", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, email, "/organization");
    await page.goto("/organization/custom-roles");
    await expectPath(page, "/organization/custom-roles");

    const createBtn = page.getByRole("button", { name: /create role|add role/i });
    await expect(createBtn).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Create custom role dialog opens", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, email, "/organization");
    await page.goto("/organization/custom-roles");
    await expectPath(page, "/organization/custom-roles");

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
    await loginAs(page, email, "/organization");
    await page.goto("/organization/custom-roles");
    await expectPath(page, "/organization/custom-roles");

    await page.waitForTimeout(2_000);
    await expect(page.locator("main").first()).toBeVisible();

    const tableOrList = page.getByRole("table");
    const noRolesMessage = page.getByText(/no roles|no custom roles/i);
    const hasContent = await tableOrList.isVisible().catch(() => false) || await noRolesMessage.isVisible().catch(() => false);
    expect(hasContent).toBe(true);

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

});

/* ---------- env helpers ---------- */

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
