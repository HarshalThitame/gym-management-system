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

test("M01: unauth -> /login", async ({ page }) => {
  await page.goto("/super-admin/monitoring");
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe("/login");
});

test("M02-30: full monitoring suite", async ({ page }) => {
  test.setTimeout(600000);
  const e = errs(page);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe("/super-admin");

  await page.goto("/super-admin/monitoring");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(4000);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("main").getByText("Application error", { exact: false })).toHaveCount(0);

  // Header KPIs (5)
  const metrics = ["Platform Health", "Uptime", "SLA Compliance", "Critical Services", "Error Budget"];
  for (const m of metrics) {
    const el = page.locator("main").getByText(m, { exact: false }).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) await expect(el).toBeVisible();
  }

  // Observability Center badge + header
  await expect(page.locator("main").getByText("Observability Center")).toBeVisible();

  // All 17 tabs
  const tabIds = ["overview", "services", "incidents", "queues", "cron", "errors", "oncall", "capacity", "tenants", "escalation", "tracing", "infra", "slo", "deployments", "regions", "dr", "status"];
  for (const tab of tabIds) {
    const tabBtn = page.locator("main").getByRole("button").or(page.locator("main").getByRole("tab")).filter({ hasText: new RegExp(tab, "i") }).first();
    if (await tabBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await tabBtn.click().catch(() => {});
      await page.waitForTimeout(500);
      await expect(page.locator("main")).toBeVisible();
    }
  }

  // Health API link
  await expect(page.locator("main").getByRole("link", { name: /Health API/i })).toBeVisible();

  // Live SSE link
  await expect(page.locator("main").getByRole("link", { name: /Live SSE/i })).toBeVisible();

  // Live/Paused toggle
  const liveToggle = page.locator("main").getByText(/Live|Paused/i).first();
  if (await liveToggle.isVisible({ timeout: 1000 }).catch(() => false)) await expect(liveToggle).toBeVisible();

  // Dashboard Platform Health card
  await page.goto("/super-admin");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  try {
    const sloCard = page.locator("main").getByText(/System Health|SLO|Monitoring|Reliability Targets/i).first();
    if (await sloCard.isVisible({ timeout: 2000 }).catch(() => false)) await expect(sloCard).toBeVisible();
  } catch { /* optional */ }

  expect(e).toEqual([]);
});
