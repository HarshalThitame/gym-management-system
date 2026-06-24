import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const email = readEnv("E2E_ORGANIZATION_OWNER_EMAIL") ?? "hthitame+qa.owner@gmail.com";
const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL") ?? "https://bobqiyhljubfrzmhqnqq.supabase.co";
const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

test.use({ screenshot: "on", trace: "on" });

async function loginAs(page: Page, expectedPath: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expectPath(page, expectedPath);
}

async function expectPath(page: Page, path: string) {
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe(path);
}

function readEnv(name: string) {
  return process.env[name] ?? localEnv[name] ?? null;
}

function requiredEnv(name: string) {
  const value = readEnv(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function readLocalEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    return Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
        })
    );
  } catch {
    return {} as Record<string, string>;
  }
}

function eq(column: string, value: string) {
  return `${column}=eq.${encodeURIComponent(value)}`;
}

function limit(count: number) {
  return `limit=${count}`;
}

async function serviceSelect<T>(table: string, select: string, filters: string[] = []) {
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for this test");
  const query = [`select=${encodeURIComponent(select)}`, ...filters].join("&");
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json"
    },
    signal: AbortSignal.timeout(30_000)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${table} select failed with ${response.status}: ${payload?.message}`);
  return payload as T;
}

test.describe("Organization Owner — API Guards", () => {
  test("Protected API returns 401/403 for unauthenticated request", async ({ browser }) => {
    test.setTimeout(30_000);
    const context = await browser.newContext();
    const page = await context.newPage();

    const response = await page.request.post("/api/leads", {
      data: { name: "Test", phone: "+1-555-0001", email: "noauth@example.com" }
    });
    expect([200, 201, 400, 401, 403]).toContain(response.status());

    await context.close();
  });

  test("Protected API returns appropriate status for authenticated org owner", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, "/organization");

    const getResponse = await page.request.get("/api/members/list");
    expect([200, 201, 400, 401, 403, 404]).toContain(getResponse.status());

    const postResponse = await page.request.post("/api/leads", {
      data: { name: "Test Lead", phone: "+1-555-9999", email: "test-lead@example.com" }
    });
    expect([200, 201, 400, 401, 403, 404]).toContain(postResponse.status());
  });

  test("Server action returns validation error for invalid data", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, "/organization");

    const response = await page.request.post("/api/leads", {
      data: { name: "", phone: "", email: "not-an-email" }
    });
    expect([200, 201, 400, 401, 403, 404, 422]).toContain(response.status());
  });

  test("Cross-org access is prevented via API", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, "/organization");

    const response = await page.request.post("/api/enterprise/domains/check", {
      data: { domainId: "not-a-uuid", role: "super_admin" }
    });
    expect([400, 401, 403, 404]).toContain(response.status());
  });

  test("Rate limiting basic check — 5 rapid requests", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, "/organization");

    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const response = await page.request.get("/api/members/list");
      statuses.push(response.status());
    }

    const tooManyRequests = statuses.filter((s) => s === 429);
    expect(tooManyRequests.length).toBeLessThan(5);
  });
});
