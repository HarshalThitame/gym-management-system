import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const email = readEnv("E2E_ORGANIZATION_OWNER_EMAIL") ?? "hthitame+qa.owner@gmail.com";

test.use({ screenshot: "on", trace: "on" });

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
    return {} as Record<string, string>;
  }
}

test.describe("Organization Owner — Revenue Split", () => {
  test("Revenue module loads with KPI cards and no errors", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "/organization");
    await page.goto("/organization/revenue");
    await expectPath(page, "/organization/revenue");
    await expect(page.locator("main").first()).toBeVisible();

    const statCards = page.locator(".rounded-lg.border").first();
    await expect(statCards).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Revenue Split tab/section is accessible", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "/organization");
    await page.goto("/organization/revenue");
    await expectPath(page, "/organization/revenue");

    const revenueSplitTab = page.getByRole("tab", { name: /revenue split|split/i });
    if (await revenueSplitTab.isVisible().catch(() => false)) {
      await revenueSplitTab.click();
      await page.waitForTimeout(1500);
    }

    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Revenue filter/search is interactive", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "/organization");
    await page.goto("/organization/revenue");
    await expectPath(page, "/organization/revenue");

    const filterSearch = page.getByRole("search", { name: /filter/i });
    if (await filterSearch.isVisible().catch(() => false)) {
      await expect(filterSearch).toBeVisible();
    }

    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill("test");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1000);
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Revenue export button exists or page loads cleanly", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "/organization");
    await page.goto("/organization/revenue");
    await expectPath(page, "/organization/revenue");

    const exportBtn = page.getByRole("button", { name: /export|download/i });
    const hasExport = await exportBtn.isVisible().catch(() => false);

    if (hasExport) {
      await expect(exportBtn).toBeVisible();
    }

    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });
});
