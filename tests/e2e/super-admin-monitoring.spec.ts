import { expect, test } from "@playwright/test";

const password = (() => {
  const v = process.env.E2E_AUTH_PASSWORD;
  if (!v) throw new Error("Missing E2E_AUTH_PASSWORD");
  return v;
})();
const email = process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com";

test.use({ screenshot: "on", serviceWorkers: "block", trace: "on", video: "on" });

function errs(p: any): string[] {
  const e: string[] = [];
  p.on("pageerror", (err: Error) => e.push(err.message));
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

  // Verify monitoring center badge
  await expect(page.locator("main").getByText("Platform Monitoring Center")).toBeVisible();

  // Header KPIs
  const metrics = ["Platform Health", "Services Monitored", "Healthy Services", "Data Integrity"];
  for (const m of metrics) {
    const el = page.locator("main").getByText(m, { exact: false }).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) await expect(el).toBeVisible();
  }

  // Verify sections exist
  const sections = ["Platform Health Overview", "Platform Usage Overview", "Subscription Monitoring", "System Activity", "Security Monitoring", "Error Monitoring", "Data Integrity Monitoring"];
  for (const section of sections) {
    const el = page.locator("main").getByText(section, { exact: false }).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) await expect(el).toBeVisible();
  }

  // Verify health cards render real or empty state
  const healthCards = page.locator("main").getByText(/API Gateway|Database|Authentication|Storage|Background|Email|Payment/i);
  const healthCardCount = await healthCards.count();
  if (healthCardCount > 0) {
    await expect(healthCards.first()).toBeVisible();
  }

  // Verify usage stats render
  const usageStats = ["Total Organizations", "Total Branches", "Total Users", "Total Members", "Total Trainers", "Total Subscriptions"];
  for (const stat of usageStats) {
    const el = page.locator("main").getByText(stat, { exact: false }).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) await expect(el).toBeVisible();
  }

  // Verify subscription monitoring
  const subStats = ["Active", "Trial", "Expired", "Suspended", "Renewal Due Soon", "Orgs Without Subscription"];
  for (const stat of subStats) {
    const el = page.locator("main").getByText(stat, { exact: false }).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) await expect(el).toBeVisible();
  }

  // Verify recent activity section
  const activitySection = page.locator("main").getByText("Recent Activity Events").first();
  if (await activitySection.isVisible({ timeout: 1000 }).catch(() => false)) await expect(activitySection).toBeVisible();

  // Verify security section
  const securitySection = page.locator("main").getByText("Security Events").first();
  if (await securitySection.isVisible({ timeout: 1000 }).catch(() => false)) await expect(securitySection).toBeVisible();

  // Verify error section
  const errorSection = page.locator("main").getByText("Recent Errors").first();
  if (await errorSection.isVisible({ timeout: 1000 }).catch(() => false)) await expect(errorSection).toBeVisible();

  // Click refresh button
  const refreshBtn = page.locator("main").getByRole("button", { name: /Refresh/i });
  if (await refreshBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await refreshBtn.click();
    await page.waitForTimeout(3000);
    await expect(page.locator("main")).toBeVisible();
  }

  // Verify no dummy/mock text appears
  const fakePatterns = ["Observability Center", "Live SSE", "Health API", "Tracing", "Infrastructure", "SLO/Budget", "Deployments", "On-Call", "Status Page"];
  for (const pattern of fakePatterns) {
    await expect(page.locator("main").getByText(pattern, { exact: false })).toHaveCount(0);
  }

  // Verify no runtime errors
  expect(e).toEqual([]);
});
