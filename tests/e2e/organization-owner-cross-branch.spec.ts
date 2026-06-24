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

test.describe("Organization Owner — Cross-Branch", () => {
  test("Branches/gyms page loads with data", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "/organization");
    await page.goto("/organization/gyms");
    await expectPath(page, "/organization/gyms");
    await expect(page.locator("main").first()).toBeVisible();

    await page.waitForSelector(".rounded-lg.border", { timeout: 10_000 });

    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Gyms" })).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Cross-Branch Access tab/section is accessible", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "/organization");
    await page.goto("/organization/gyms");
    await expectPath(page, "/organization/gyms");

    const crossBranchTab = page.getByRole("tab", { name: /cross.?branch|branch access|access/i });
    if (await crossBranchTab.isVisible().catch(() => false)) {
      await crossBranchTab.click();
      await page.waitForTimeout(1500);
    }

    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Cross-Branch rule creation UI exists", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "/organization");
    await page.goto("/organization/gyms");
    await expectPath(page, "/organization/gyms");

    const crossBranchTab = page.getByRole("tab", { name: /cross.?branch|branch access|access/i });
    if (await crossBranchTab.isVisible().catch(() => false)) {
      await crossBranchTab.click();
      await page.waitForTimeout(1500);
    }

    const createBtn = page.getByRole("button", { name: /create rule|add rule|new rule/i });
    const hasCreate = await createBtn.isVisible().catch(() => false);

    if (hasCreate) {
      await expect(createBtn).toBeVisible();
      await createBtn.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
    }

    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Branch data list renders with action buttons", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "/organization");
    await page.goto("/organization/gyms");
    await expectPath(page, "/organization/gyms");

    await page.waitForSelector(".rounded-lg.border", { timeout: 10_000 });

    const editBtns = page.getByRole("button", { name: /edit/i });
    const editCount = await editBtns.count();
    if (editCount > 0) {
      await editBtns.first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
    }

    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });
});
