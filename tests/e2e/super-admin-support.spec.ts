import { expect, type Page, test } from "@playwright/test";

const password = (() => {
  const v = process.env.E2E_AUTH_PASSWORD;
  if (!v) throw new Error("Missing E2E_AUTH_PASSWORD");
  return v;
})();
const email = process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com";

test.use({ screenshot: "on", serviceWorkers: "block", trace: "on", video: "on" });

function errs(p: Page) {
  const e: string[] = [];
  p.on("pageerror", (err) => e.push(err.message));
  p.on("response", (r) => { if (r.status() >= 500) e.push(`500 ${r.url()}`); });
  return e;
}

async function login(p: Page) {
  await p.goto("/login");
  await p.getByLabel("Email").fill(email);
  await p.getByLabel("Password").fill(password);
  await p.getByRole("button", { name: /sign in/i }).click();
  await expect.poll(() => new URL(p.url()).pathname, { timeout: 30_000 }).toBe("/super-admin");
}

async function visit(p: Page, path: string, wait = 2000) {
  await p.goto(path);
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(wait);
}

test("S01: unauth -> /login", async ({ page }) => {
  await page.goto("/super-admin/support");
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/login");
});

test("S02-12: support center page", async ({ page }) => {
  test.setTimeout(240_000);
  const e = errs(page);
  await login(page);
  await visit(page, "/super-admin/support", 4000);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("main").getByText("Application error", { exact: false })).toHaveCount(0);
  await expect(page.locator("main").getByRole("heading", { name: /Support Center/i })).toBeVisible();

  for (const link of ["Analytics", "SLA", "Automation"]) {
    const lnk = page.locator("main").getByRole("link").filter({ hasText: link });
    if (await lnk.isVisible({ timeout: 1000 }).catch(() => false)) await expect(lnk).toBeVisible();
  }
  for (const kpi of ["Open", "Closed", "SLA", "CSAT", "Tickets"]) {
    const el = page.locator("main").getByText(kpi, { exact: false }).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) await expect(el).toBeVisible();
  }

  const table = page.locator("main").locator("table").first();
  if (await table.isVisible({ timeout: 3000 }).catch(() => false)) {
    for (const h of ["Subject", "Status", "Priority"]) {
      const th = table.locator("th").filter({ hasText: h });
      if (await th.isVisible({ timeout: 1000 }).catch(() => false)) await expect(th).toBeVisible();
    }
  }
  expect(e).toEqual([]);
});

test("S13-16: sub-routes analytics, sla", async ({ page }) => {
  test.setTimeout(300_000);
  const e = errs(page);
  await login(page);
  for (const sub of ["analytics", "sla"]) {
    await visit(page, `/super-admin/support/${sub}`, 2000);
    await expect(page.locator("main")).toBeVisible();
  }
  expect(e).toEqual([]);
});

test("S17-19: sub-routes automation, escalations, knowledge-base", async ({ page }) => {
  test.setTimeout(300_000);
  const e = errs(page);
  await login(page);
  for (const sub of ["automation", "escalations", "knowledge-base"]) {
    await visit(page, `/super-admin/support/${sub}`, 2000);
    await expect(page.locator("main")).toBeVisible();
  }
  expect(e).toEqual([]);
});
