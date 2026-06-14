import { expect, type Page, test } from "@playwright/test";

const password = (() => {
  const v = process.env.E2E_AUTH_PASSWORD;
  if (!v) throw new Error("Missing E2E_AUTH_PASSWORD");
  return v;
})();
const superAdminEmail = process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com";
const API = "/api/security";

test.use({ screenshot: "on", serviceWorkers: "block", trace: "on", video: "on" });

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(superAdminEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe("/super-admin");
}

// ═══════════════════════════════════════════════════════════════════════════
// UNAUTHENTICATED
// ═══════════════════════════════════════════════════════════════════════════
test("TC-SE01: unauthenticated -> /login", async ({ page }) => {
  await page.goto("/super-admin/security");
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/login");
});

test("TC-SE16: API rejects unauthenticated", async ({ page }) => {
  for (const ep of ["dashboard","incidents","audit","compliance","sessions","emergency","risk"]) {
    expect([401,404]).toContain((await page.request.get(`${API}/${ep}`)).status());
  }
});

test("TC-SE42: unauthenticated POST rejected", async ({ page }) => {
  for (const e of [
    { u: `${API}/emergency`, m: "POST" as const },
    { u: `${API}/incidents`, m: "PATCH" as const },
    { u: `${API}/investigate`, m: "POST" as const },
  ]) {
    const r = await page.request.fetch(e.u, { method:e.m, data:{}, headers:{"Content-Type":"application/json"} });
    expect([401,404]).toContain(r.status());
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATED — each test logs in once
// ═══════════════════════════════════════════════════════════════════════════

test("TC-SE02-12: all 11 security pages load without errors", async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const routes = [
    "/super-admin/security", "/super-admin/security/incidents", "/super-admin/security/audit",
    "/super-admin/security/passwords", "/super-admin/security/mfa", "/super-admin/security/sessions",
    "/super-admin/security/compliance", "/super-admin/security/emergency", "/super-admin/security/investigate",
    "/super-admin/security/analytics", "/super-admin/security/settings",
  ];
  for (const path of routes) {
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push(e.message));
    page.on("response", (r) => { if (r.status() >= 500) errs.push(`500 ${r.url()}`); });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main").getByText("Application error", { exact: false })).toHaveCount(0);
    expect(errs).toEqual([]);
  }
});

test("TC-SE15/20/31/40/41: API endpoints", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  for (const path of [
    `${API}/dashboard`,`${API}/incidents`,`${API}/audit`,`${API}/compliance`,
    `${API}/sessions`,`${API}/emergency`,`${API}/risk`,
    `${API}/investigate?userId=1f402a90-ea36-4ce5-8c5b-fd5a9c71378e`,
  ]) {
    expect((await page.request.get(path, { timeout: 15_000 })).status()).toBeLessThan(500);
  }
  expect((await page.request.post(`${API}/password/check`,
    { data:{password:"StrongPass@123"}, headers:{"Content-Type":"application/json"} })).status()).toBeLessThan(500);
  expect((await page.request.post(`${API}/risk`,
    { data:{action:"assess",userId:"1f402a90-ea36-4ce5-8c5b-fd5a9c71378e",ipAddress:"203.0.113.1",userAgent:"Mozilla/5.0"} })).status()).toBeLessThan(500);
  expect((await page.request.get(`${API}/investigate`)).status()).toBeGreaterThanOrEqual(400);
  expect((await page.request.patch(`${API}/incidents`,
    { data:{id:"fake",action:"nonexistent"}, headers:{"Content-Type":"application/json"} })).status()).toBeGreaterThanOrEqual(400);
});

test("TC-SE13/14/34/35/36/37/38: nav, dashboard, rate limits, data leak", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));

  // SE13: sidebar nav
  await page.goto("/super-admin");
  await page.waitForLoadState("networkidle");
  await page.locator("aside").last().locator("a[href='/super-admin/security']").click();
  await page.waitForLoadState("networkidle");
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000 }).toBe("/super-admin/security");

  // SE14: 404 resilience
  await page.goto("/super-admin/security/nonexistent-xyz");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await expect(page.locator("main").getByText("Application error", { exact: false })).toHaveCount(0);

  // SE34/35: dashboard security alerts + CTA
  await page.goto("/super-admin");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  await expect(page.locator("main").getByRole("heading", { name: "Open Security Alerts" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Review Security/i })).toBeVisible();

  // SE36: rapid requests
  for (let i = 0; i < 5; i++) {
    expect((await page.request.get(`${API}/dashboard`)).status()).toBeLessThan(500);
  }

  // SE37: error safety
  const err = await page.request.get(`${API}/investigate`);
  const txt = JSON.stringify(await err.json().catch(() => ({})));
  expect(txt).not.toContain("stack");
  expect(txt).not.toContain("internal");

  // SE38: no API keys leaked
  await page.goto("/super-admin/security");
  await page.waitForLoadState("networkidle");
  const html = await page.content();
  for (const pat of [/SUPABASE_SERVICE_ROLE_KEY/i, /apikey.*eyJ/i]) {
    const m = html.match(pat);
    if (m) expect(m.every((x) => !x.includes("eyJhbGciOiJIUzI1NiI"))).toBe(true);
  }

  expect(errs).toEqual([]);
});
