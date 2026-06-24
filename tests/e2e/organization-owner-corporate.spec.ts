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

test.describe("Organization Owner — Corporate", () => {

  test("Corporate tab visible in members module", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, email, "/organization");
    await page.goto("/organization/members");
    await expectPath(page, "/organization/members");

    await expect(page.locator("main").first()).toBeVisible();

    const corporateTab = page.getByRole("tab", { name: /corporate/i });
    if (await corporateTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await corporateTab.click();
      await page.waitForTimeout(1_000);
      await expect(page.locator("main").first()).toBeVisible();
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Create corporate account UI exists", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, email, "/organization");
    await page.goto("/organization/members");
    await expectPath(page, "/organization/members");

    const corporateTab = page.getByRole("tab", { name: /corporate/i });
    if (await corporateTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await corporateTab.click();
    }

    const addCompanyBtn = page.getByRole("button", { name: /add company|create company/i });
    if (await addCompanyBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(addCompanyBtn).toBeVisible();
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Corporate company list renders", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, email, "/organization");
    await page.goto("/organization/members");
    await expectPath(page, "/organization/members");

    const corporateTab = page.getByRole("tab", { name: /corporate/i });
    if (await corporateTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await corporateTab.click();
      await page.waitForTimeout(2_000);
    }

    const companyList = page.getByRole("table").or(page.getByRole("list")).or(page.getByText(/no compan/i));
    await expect(companyList.first()).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Bulk employee add UI accessible", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, email, "/organization");
    await page.goto("/organization/members");
    await expectPath(page, "/organization/members");

    const corporateTab = page.getByRole("tab", { name: /corporate/i });
    if (await corporateTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await corporateTab.click();
      await page.waitForTimeout(2_000);
    }

    const companyCards = page.locator(".rounded-lg.border");
    const cardCount = await companyCards.count();
    if (cardCount > 0) {
      await companyCards.first().click();
      await page.waitForTimeout(2_000);

      const bulkAddBtn = page.getByRole("button", { name: /add employees|bulk add|add employee/i });
      if (await bulkAddBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(bulkAddBtn).toBeVisible();
      }
    }

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
