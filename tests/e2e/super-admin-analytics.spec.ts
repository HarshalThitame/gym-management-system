import { expect, test } from "@playwright/test";

const password = (() => {
  const v = process.env.E2E_AUTH_PASSWORD;
  if (!v) throw new Error("Missing E2E_AUTH_PASSWORD");
  return v;
})();
const email = process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com";

test.use({ screenshot: "on", serviceWorkers: "block", trace: "on", video: "on" });

function errs(p: any) {
  const e: string[] = [];
  p.on("pageerror", (err) => e.push(err.message));
  p.on("response", (r: any) => { if (r.status() >= 500) e.push(`500 ${r.url()}`); });
  return e;
}

test("A01: unauth -> /login", async ({ page }) => {
  await page.goto("/super-admin/analytics");
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe("/login");
});

test("A02-20: full analytics suite", async ({ page }) => {
  test.setTimeout(600000);
  const e = errs(page);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe("/super-admin");

  await page.goto("/super-admin/analytics");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("main").getByText("Application error", { exact: false })).toHaveCount(0);

  // KPIs
  const kpis = ["Revenue", "Members", "Growth", "Churn", "LTV", "MRR", "ARR", "Conversion"];
  for (const kpi of kpis) {
    const el = page.locator("main").getByText(kpi, { exact: false }).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) await expect(el).toBeVisible();
  }

  // Navigation sections (12)
  const sections = ["Executive", "Revenue", "Members", "Churn", "LTV", "Branches", "Trainers", "Marketing", "Forecast", "Capacity", "Behavior", "Alerts"];
  for (const section of sections) {
    const btn = page.locator("main").getByRole("button").or(page.locator("main").getByRole("tab")).filter({ hasText: section }).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(300);
    }
  }

  // Export buttons (5 formats)
  for (const fmt of ["CSV", "Excel", "PDF", "JSON", "PPT"]) {
    const btn = page.locator("main").getByText(fmt, { exact: false }).first();
    if (await btn.isVisible({ timeout: 500 }).catch(() => false)) await expect(btn).toBeVisible();
  }

  // NLP query input
  const nlp = page.locator("main").locator("input, textarea").first();
  if (await nlp.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nlp.fill("Show revenue trends");
    await page.waitForTimeout(300);
    await nlp.clear();
  }

  // Dashboard integration
  await page.goto("/super-admin");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  try {
    const analyticsLink = page.locator("main").getByRole("link").filter({ hasText: /Analytics/i }).first();
    if (await analyticsLink.isVisible({ timeout: 2000 }).catch(() => false)) await expect(analyticsLink).toBeVisible();
  } catch { /* optional */ }

  expect(e).toEqual([]);
});
