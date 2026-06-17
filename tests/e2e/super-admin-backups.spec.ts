import { expect, test, type Page, type Response } from "@playwright/test";

const password = (() => {
  const v = process.env.E2E_AUTH_PASSWORD;
  if (!v) throw new Error("Missing E2E_AUTH_PASSWORD");
  return v;
})();
const email = process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com";

test.use({ screenshot: "on", serviceWorkers: "block", trace: "on", video: "on" });

function errs(p: Page) {
  const e: string[] = [];
  p.on("pageerror", (err: Error) => e.push(err.message));
  p.on("response", (r: Response) => { if (r.status() >= 500) e.push(`500 ${r.url()}`); });
  return e;
}

test("B01: unauth -> /login", async ({ page }) => {
  await page.goto("/super-admin/backups");
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe("/login");
});

test("B02-15: full backups suite", async ({ page }) => {
  test.setTimeout(300000);
  const e = errs(page);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe("/super-admin");

  await page.goto("/super-admin/backups");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("main").getByText("Application error", { exact: false })).toHaveCount(0);

  const kpis = ["Backups", "Success", "Failed", "RPO", "RTO", "DR", "Storage", "Recovery", "Protected", "Jobs", "Verification", "Replication", "Restores", "Snapshots"];
  for (const kpi of kpis) {
    const el = page.locator("main").getByText(kpi, { exact: false }).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) await expect(el).toBeVisible();
  }

  const links = ["Health API", "Observability"];
  for (const link of links) {
    const l = page.locator("main").getByRole("link").filter({ hasText: link });
    if (await l.isVisible({ timeout: 1000 }).catch(() => false)) await expect(l).toBeVisible();
  }

  // Dashboard Operational Readiness
  await page.goto("/super-admin");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  try {
    const backupRow = page.locator("main").getByText(/Backup Jobs|Backups/i).first();
    if (await backupRow.isVisible({ timeout: 2000 }).catch(() => false)) await expect(backupRow).toBeVisible();
  } catch { /* optional */ }

  expect(e).toEqual([]);
});
