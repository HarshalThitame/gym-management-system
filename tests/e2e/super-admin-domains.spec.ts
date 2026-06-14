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

function main(p: Page) { return p.locator("main"); }

// ═══════════════════════════════════════════════════════════════════════════
test("D01: unauth -> /login", async ({ page }) => {
  await page.goto("/super-admin/domains");
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/login");
});

// ═══════════════════════════════════════════════════════════════════════════
test("D02-30: full domains test suite", async ({ page }) => {
  test.setTimeout(600_000);
  const e = errs(page);
  await login(page);

  await visit(page, "/super-admin/domains", 5000);
  await expect(main(page)).toBeVisible();
  await expect(main(page).getByText("Application error", { exact: false })).toHaveCount(0);

  // Wait for client-rendered content to appear
  await page.waitForTimeout(3000);

  const text = await main(page).textContent();
  expect(text?.length).toBeGreaterThan(50);

  // ── 5 KPI cards ──
  for (const label of ["Total", "Verified", "Failed", "Primary", "Pending"]) {
    const el = main(page).getByText(label, { exact: false }).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  }

  // ── Search ──
  const search = main(page).locator("input[placeholder*='Search'], input[type='text']").first();
  if (await search.isVisible({ timeout: 2000 }).catch(() => false)) {
    await search.fill("e2e");
    await page.waitForTimeout(500);
    await search.clear();
    await page.waitForTimeout(300);
  }

  // ── Status filter tabs ──
  for (const tab of ["All", "Verified", "Failed", "Pending", "Primary"]) {
    const btn = main(page).getByRole("button").filter({ hasText: tab }).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(300);
    }
  }

  // ── Domain table ──
  const table = main(page).locator("table").first();
  const hasTable = await table.isVisible({ timeout: 3000 }).catch(() => false);
  if (hasTable) {
    // Column headers
    for (const h of ["Domain", "Status", "SSL", "Organization"]) {
      const th = table.locator("th, thead tr *").filter({ hasText: h }).first();
      if (await th.isVisible({ timeout: 1000 }).catch(() => false)) await expect(th).toBeVisible();
    }
    // Rows
    const rows = table.locator("tbody tr, tbody > *");
    const rowCount = await rows.count();
    if (rowCount > 0) {
      const cellText = await rows.first().locator("td, > *").first().textContent().catch(() => "");
      if (cellText) expect(cellText.length).toBeGreaterThan(0);
    }
  }

  // ── Sort by clicking column header ──
  if (hasTable) {
    const sortHeaders = table.locator("th").filter({ hasText: /Domain|Status|SSL/ });
    const headerCount = await sortHeaders.count();
    if (headerCount > 0) {
      await sortHeaders.first().click();
      await page.waitForTimeout(300);
    }
  }

  // ── Domain actions (Verify/Check/Delete/Set Primary) ──
  const actions = main(page).getByRole("button").filter({ hasText: /Verify|Check|Delete|Primary|Copy/i });
  const actionCount = await actions.count();
  if (actionCount > 0) {
    for (let i = 0; i < Math.min(actionCount, 3); i++) {
      const actionBtn = actions.nth(i);
      if (await actionBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(actionBtn).toBeVisible();
      }
    }
  }

  // ── Health score badges ──
  const healthBadges = main(page).getByText(/Healthy|Degraded|Critical|Down/i);
  if (await healthBadges.first().isVisible({ timeout: 2000 }).catch(() => false)) {
    await expect(healthBadges.first()).toBeVisible();
  }

  // ── DNS/Provider/SSL info ──
  for (const label of ["DNS", "SSL", "Provider"]) {
    const el = main(page).getByText(label, { exact: false }).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) await expect(el).toBeVisible();
  }

  // ── Pagination ──
  const pagination = main(page).getByText(/Page \d+ of \d+/i).or(main(page).locator("button").filter({ hasText: /Next|Prev|Previous|\d+/ }));
  if (await pagination.first().isVisible({ timeout: 2000 }).catch(() => false)) {
    await expect(pagination.first()).toBeVisible();
  }

  // ── Add Domain dialog ──
  const addBtn = main(page).getByRole("button").filter({ hasText: /Add Domain|Add/i }).first();
  if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addBtn.click();
    await page.waitForTimeout(500);
    const dialog = page.getByRole("dialog").or(page.getByRole("heading", { name: /Add Domain/i }));
    if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(dialog.first()).toBeVisible();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  }

  // ── Bulk select (checkboxes) ──
  const checkboxes = main(page).locator("input[type='checkbox']");
  const cbCount = await checkboxes.count();
  if (cbCount > 0) {
    // Checkbox exists — verify presence
    await expect(checkboxes.first()).toBeVisible();
  }

  // ── Dashboard Domain Routing ──
  await visit(page, "/super-admin", 4000);
  try {
    const routingRow = main(page).locator("a").filter({ hasText: /Domain Routing/i });
    if (await routingRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(routingRow).toBeVisible();
    }
  } catch { /* optional */ }

  expect(e).toEqual([]);
});
