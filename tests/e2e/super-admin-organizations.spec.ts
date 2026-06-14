import { expect, type Page, test } from "@playwright/test";

const password = (() => {
  const v = process.env.E2E_AUTH_PASSWORD;
  if (!v) throw new Error("Missing E2E_AUTH_PASSWORD");
  return v;
})();
const superAdminEmail = process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com";
const BASE = "/super-admin/organizations";

test.use({ screenshot: "on", serviceWorkers: "block", trace: "on", video: "on" });

function errs(p: Page) {
  const e: string[] = [];
  p.on("pageerror", (err) => e.push(err.message));
  p.on("response", (r) => { if (r.status() >= 500) e.push(`500 ${r.url()}`); });
  return e;
}

async function login(p: Page) {
  await p.goto("/login");
  await p.getByLabel("Email").fill(superAdminEmail);
  await p.getByLabel("Password").fill(password);
  await p.getByRole("button", { name: /sign in/i }).click();
  await expect.poll(() => new URL(p.url()).pathname, { timeout: 30_000 }).toBe("/super-admin");
}

async function visit(p: Page, path: string, wait = 2000) {
  await p.goto(path);
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(wait);
}

function main(p: Page) { return p.locator("main"); }

// ═══════════════════════════════════════════════════════════════════════════
// UNAUTHENTICATED
// ═══════════════════════════════════════════════════════════════════════════
test("U1: unauth -> /login", async ({ page }) => {
  await page.goto(BASE);
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/login");
});

// ═══════════════════════════════════════════════════════════════════════════
// LIST PAGE: search, create btn, export, org links, 404
// ═══════════════════════════════════════════════════════════════════════════
test("L1: list page features", async ({ page }) => {
  test.setTimeout(300_000);
  const e = errs(page);
  await login(page);
  await visit(page, BASE, 3000);
  await expect(main(page)).toBeVisible();
  await expect(main(page).getByText("Application error", { exact: false })).toHaveCount(0);

  // Org links
  const ids = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href^='/super-admin/organizations/']"))
      .map((a) => a.getAttribute("href") ?? "").filter((h) => h.includes("/organizations/") && !h.includes("/export"))
      .map((h) => h.split("/organizations/").pop() ?? "").filter((id) => id.length > 0);
  });
  expect(ids.length).toBeGreaterThanOrEqual(1);

  // Search
  const inp = main(page).locator("input[type='text'], input[placeholder*='earch'], input:not([type='hidden'])").first();
  if (await inp.isVisible({ timeout: 2000 }).catch(() => false)) {
    await inp.fill("Gold");
    await page.waitForTimeout(500);
    await inp.clear();
  }

  // Create button
  const cb = main(page).getByRole("button", { name: /Create/i }).first();
  if (await cb.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cb.click();
    await page.waitForTimeout(800);
    const h = page.getByRole("heading", { name: /Create|New|Organization/i });
    if (await h.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(h).toBeVisible();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  }

  // Export
  expect((await page.request.get("/api/super-admin/organizations/export?format=csv")).status()).toBeLessThan(500);
  expect((await page.request.get("/api/super-admin/organizations/export?format=pdf")).status()).toBeLessThan(500);

  // 404
  await visit(page, `${BASE}/00000000-0000-0000-0000-000000000000`);
  await expect(main(page).getByText("Application error", { exact: false })).toHaveCount(0);
  expect(e).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
// DETAIL + ALL 7 TABS
// ═══════════════════════════════════════════════════════════════════════════
test("T1: detail page + all tabs", async ({ page }) => {
  test.setTimeout(600_000);
  const e = errs(page);
  await login(page);

  await visit(page, BASE);
  const ids = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href^='/super-admin/organizations/']"))
      .map((a) => a.getAttribute("href") ?? "").filter((h) => h.includes("/organizations/") && !h.includes("/export"))
      .map((h) => h.split("/organizations/").pop() ?? "").filter((id) => id.length > 0);
  });
  if (ids.length === 0) { expect(e).toEqual([]); return; }
  const oid = ids[0];

  // Warmup cache by visiting detail once
  await visit(page, `${BASE}/${oid}`);
  await expect(main(page)).toBeVisible();
  await expect(main(page).getByText("Application error", { exact: false })).toHaveCount(0);

  // All 7 tabs
  for (const tab of ["governance", "users", "gyms", "billing", "audit", "security", "domains"]) {
    await visit(page, `${BASE}/${oid}?tab=${tab}`, 1500);
    await expect(main(page)).toBeVisible();
    await expect(main(page).getByText("Application error", { exact: false })).toHaveCount(0);
  }
  expect(e).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD METRIC
// ═══════════════════════════════════════════════════════════════════════════
test("D1: dashboard loads without errors", async ({ page }) => {
  test.setTimeout(180_000);
  const e = errs(page);
  await login(page);
  await visit(page, "/super-admin", 5000);
  await expect(main(page)).toBeVisible();
  expect(e).toEqual([]);
});
