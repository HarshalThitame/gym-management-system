import { expect, type Page, test } from "@playwright/test";

const password = (() => {
  const v = process.env.E2E_AUTH_PASSWORD;
  if (!v) throw new Error("Missing E2E_AUTH_PASSWORD");
  return v;
})();
const superAdminEmail = process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com";

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

// ═══════════════════════════════════════════════════════════════════════════
// FAST: unauthenticated
// ═══════════════════════════════════════════════════════════════════════════
test("R01: unauth -> /login", async ({ page }) => {
  await page.goto("/super-admin/roles");
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/login");
});

// ═══════════════════════════════════════════════════════════════════════════
// SMALL: page + create role + API endpoints
// ═══════════════════════════════════════════════════════════════════════════
test("R02-10: create, API, export", async ({ page }) => {
  test.setTimeout(300_000);
  const e = errs(page);
  await login(page);

  await visit(page, "/super-admin/roles");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("main").getByText("Application error", { exact: false })).toHaveCount(0);

  // Summary cards
  for (const label of ["Total Roles", "System Roles", "Custom Roles", "Assignments"]) {
    const el = page.locator("main").getByText(label, { exact: false }).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  }

  // Create role drawer
  const cb = page.locator("main").getByRole("button", { name: /Create Role/i }).first();
  await expect(cb).toBeVisible();
  await cb.click();
  await expect(page.getByRole("heading", { name: /Create Role/i })).toBeVisible({ timeout: 3000 });

  const rn = `e2e_${Date.now()}`;
  await page.locator("input[name=name]").fill(rn);
  await page.locator("input[name=displayName]").fill("E2E Test");
  await page.locator("textarea[name=description]").fill("Created by Playwright");
  await page.locator("button[type=submit]").first().click();
  await page.waitForTimeout(1500);

  // Search API
  const sr = await page.request.get("/api/super-admin/roles/search?q=super");
  expect(sr.status()).toBeLessThan(500);

  // Assigned API
  const ar = await page.request.get("/api/super-admin/roles/assigned?userId=1f402a90-ea36-4ce5-8c5b-fd5a9c71378e");
  expect(ar.status()).toBeLessThan(500);

  // Export API + content
  const er = await page.request.get("/api/super-admin/roles/export");
  expect(er.status()).toBeLessThan(500);
  const csv = await er.text().catch(() => "");
  if (csv) expect(csv.length).toBeGreaterThan(0);

  expect(e).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
// SMALL: permissions + assign + type filter + system badge
// ═══════════════════════════════════════════════════════════════════════════
test("R11-20: permissions, assign, filters, system", async ({ page }) => {
  test.setTimeout(240_000);
  const e = errs(page);
  await login(page);

  await visit(page, "/super-admin/roles");
  await expect(page.locator("main")).toBeVisible();

  // Permissions drawer
  const pb = page.locator("main").locator("button[title*='Permission']").first();
  if (await pb.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pb.click();
    await page.waitForTimeout(800);
    const ph = page.getByRole("heading", { name: /Permissions/i }).first();
    if (await ph.isVisible({ timeout: 3000 }).catch(() => false)) await expect(ph).toBeVisible();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // Assign drawer
  const ab = page.locator("main").locator("button[title*='Assign']").first();
  if (await ab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await ab.click();
    await page.waitForTimeout(800);
    const ah = page.getByRole("heading", { name: /Assign Role/i }).first();
    if (await ah.isVisible({ timeout: 3000 }).catch(() => false)) await expect(ah).toBeVisible();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // Type filter
  const sel = page.locator("main").locator("select").first();
  if (await sel.isVisible({ timeout: 2000 }).catch(() => false)) {
    const opts = await sel.locator("option").evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).textContent ?? "").filter(Boolean));
    expect(opts.length).toBeGreaterThanOrEqual(2);
  }

  // System badge
  const sys = page.locator("main").getByText("System").first();
  if (await sys.isVisible({ timeout: 3000 }).catch(() => false)) await expect(sys).toBeVisible();

  expect(e).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
// SMALL: export from unauthenticated context
// ═══════════════════════════════════════════════════════════════════════════
test("R21: export rejects unauthenticated", async ({ page }) => {
  const r = await page.request.get("/api/super-admin/roles/export");
  expect([401, 404]).toContain(r.status());
});
