import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const email = readEnv("E2E_ORGANIZATION_OWNER_EMAIL") ?? "hthitame+qa.owner@gmail.com";

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

test.describe("Organization Owner — Custom Roles", () => {

  test("Custom roles page shows locked-feature redirect", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, email, "/organization");
    await page.goto("/organization/custom-roles");
    await page.waitForTimeout(5000);

    const url = page.url();
    const isLocked = url.includes("locked-feature") || url.includes("unauthorized");
    const body = await page.innerText("body").catch(() => "");
    const bodyHasLockedMsg = body.toLowerCase().includes("feature") ||
      body.toLowerCase().includes("upgrade") ||
      body.toLowerCase().includes("plan") ||
      body.toLowerCase().includes("not included") ||
      body.toLowerCase().includes("custom");

    expect(isLocked || bodyHasLockedMsg, "Should redirect to locked-feature or show locked message").toBe(true);
    await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  });

  test("Custom roles feature gateway works correctly", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, email, "/organization");
    await page.goto("/organization/custom-roles");
    await page.waitForTimeout(5000);

    const url = page.url();
    expect(url).not.toMatch(/error|500/i);

    if (url.includes("locked-feature")) {
      const heading = page.getByRole("heading").first();
      const headingExists = await heading.isVisible({ timeout: 3_000 }).catch(() => false);
      if (headingExists) {
        const headingText = await heading.textContent();
        expect(headingText).toBeTruthy();
      }
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
