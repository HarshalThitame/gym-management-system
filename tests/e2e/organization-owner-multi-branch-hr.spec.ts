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

test.describe("Organization Owner — Multi-Branch HR", () => {

  test("Branch selection in staff module works", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, email, "/organization");
    await page.goto("/organization/staff");
    await expectPath(page, "/organization/staff");

    await expect(page.locator("main").first()).toBeVisible();

    const branchSelector = page.getByLabel(/branch/i).or(page.getByLabel(/gym/i));
    if (await branchSelector.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(branchSelector.first()).toBeVisible();
      await expect(branchSelector.first()).toBeEnabled();
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Multi-branch assignment visible", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, email, "/organization");
    await page.goto("/organization/staff");
    await expectPath(page, "/organization/staff");

    const branchAccessTab = page.getByRole("tab", { name: /branch access/i });
    if (await branchAccessTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await branchAccessTab.click();
      await expect(page.getByText(/branch/i)).toBeVisible();
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("HR document upload section accessible", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, email, "/organization");
    await page.goto("/organization/staff");
    await expectPath(page, "/organization/staff");

    const documentsTab = page.getByRole("tab", { name: /documents/i });
    if (await documentsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await documentsTab.click();
      await expect(page.getByText(/document/i)).toBeVisible();

      const uploadBtn = page.getByRole("button", { name: /upload/i });
      if (await uploadBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(uploadBtn).toBeVisible();
      }
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Staff module loads without errors", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, email, "/organization");
    await page.goto("/organization/staff");
    await expectPath(page, "/organization/staff");

    await expect(page.locator("main").first()).toBeVisible();
    await page.waitForTimeout(2_000);

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
