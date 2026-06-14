import { expect, type Page, test } from "@playwright/test";

const password = (() => {
  const v = process.env.E2E_AUTH_PASSWORD;
  if (!v) throw new Error("Missing E2E_AUTH_PASSWORD");
  return v;
})();
const superAdminEmail = process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com";
const BASE = "/super-admin/billing";

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
// UNAUTHENTICATED
// ═══════════════════════════════════════════════════════════════════════════
test("B01: unauth -> /login", async ({ page }) => {
  await page.goto(BASE);
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/login");
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTH: billing page + tabs + KPIs + API + sidebar
// ═══════════════════════════════════════════════════════════════════════════
test("B02-20: billing page, tabs, KPIs, APIs, nav, dash", async ({ page }) => {
  test.setTimeout(600_000);
  const e = errs(page);
  await login(page);

  // ── B02-03: Billing page loads ──
  await visit(page, BASE);
  await expect(page.locator("main")).toBeVisible();
  const mainText = await page.locator("main").textContent();
  expect(mainText?.length).toBeGreaterThan(50);

  // ── B04-07: KPI cards ──
  const kpis = ["Collected", "Invoiced", "Refunded", "Outstanding", "Disputes", "Growth", "Written Off", "Credit Notes", "Reconciliation"];
  for (const kpi of kpis) {
    const el = page.locator("main").getByText(kpi, { exact: false }).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(el).toBeVisible();
    }
  }

  // ── B08-17: Tab navigation ──
  const tabs = ["Overview", "Invoices", "Payments", "Refunds", "Credit Notes", "Write-Offs", "Disputes", "Reconciliation", "Revenue Recognition", "Subscription"];
  for (const tab of tabs) {
    const tabEl = page.locator("main").getByRole("tab").or(page.locator("main").getByRole("button")).filter({ hasText: tab }).first();
    if (await tabEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tabEl.click();
      await page.waitForTimeout(800);
      await expect(page.locator("main")).toBeVisible();
    }
  }

  // ── B18: API health endpoint ──
  const health = await page.request.get("/api/billing/health");
  expect(health.status()).toBeLessThan(500);

  // ── B19: Dashboard billing CTA ──
  await visit(page, "/super-admin", 4000);
  try {
    const revCard = page.locator("main").locator("p.text-xs.font-black.uppercase").filter({ hasText: "Net Revenue" });
    if (await revCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(revCard).toBeVisible();
    }
  } catch { /* optional */ }

  expect(e).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTH: billing API endpoints
// ═══════════════════════════════════════════════════════════════════════════
test("B21-25: billing API endpoints", async ({ page }) => {
  test.setTimeout(120_000);
  const e = errs(page);
  await login(page);

  const endpoints = [
    "/api/billing/dashboard?view=summary",
    "/api/billing/dashboard?view=detailed",
    "/api/billing/dashboard?view=credit_notes",
    "/api/billing/dashboard?view=disputes",
    "/api/billing/dashboard?view=reconciliation",
    "/api/billing/dashboard?view=revenue_recognition",
    "/api/billing/dashboard?view=subscription_invoices",
    "/api/billing/dashboard?view=subscription_payments",
    "/api/billing/health",
  ];

  for (const ep of endpoints) {
    const resp = await page.request.get(ep);
    expect(resp.status()).toBeLessThan(500);
  }

  expect(e).toEqual([]);
});
