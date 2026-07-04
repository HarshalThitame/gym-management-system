import { expect, type Page, test } from "@playwright/test";

const password = process.env.E2E_AUTH_PASSWORD ?? "Extreme$00";
const email = process.env.E2E_ORGANIZATION_OWNER_EMAIL ?? "hthitame+qa.owner@gmail.com";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://bobqiyhljubfrzmhqnqq.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.use({ screenshot: "on", serviceWorkers: "block", trace: "on" });

async function loginAs(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe("/organization");
}

async function ensureEnterprisePlan(organizationId: string) {
  const packages = await serviceSelect<Array<{ id: string }>>("packages", "id", ["is_active=eq.true", "order=sort_order.desc", "limit=1"]);
  const pkg = packages[0];
  if (!pkg) throw new Error("No active package found to assign.");

  const existing = await serviceSelect<Array<{ id: string }>>(
    "organization_subscriptions",
    "id",
    [`organization_id=eq.${encodeURIComponent(organizationId)}`, "limit=1"]
  );

  if (existing[0]) {
    await servicePatch("organization_subscriptions", [`id=eq.${encodeURIComponent(existing[0].id)}`], {
      package_id: pkg.id,
      status: "active",
    });
  } else {
    await serviceInsert("organization_subscriptions", {
      organization_id: organizationId,
      package_id: pkg.id,
      status: "active",
    });
  }
}

async function getOrganizationIdForAccount(accountEmail: string) {
  const profiles = await serviceSelect<Array<{ id: string; gym_id: string | null }>>(
    "profiles",
    "id,gym_id",
    [`email=eq.${encodeURIComponent(accountEmail)}`, "limit=1"]
  );
  const profile = profiles[0];
  if (!profile?.gym_id) throw new Error(`Profile ${accountEmail} is not linked to a gym.`);

  const gyms = await serviceSelect<Array<{ organization_id: string }>>(
    "gyms",
    "organization_id",
    [`id=eq.${encodeURIComponent(profile.gym_id)}`, "limit=1"]
  );
  const gym = gyms[0];
  if (!gym?.organization_id) throw new Error(`Gym ${profile.gym_id} is not linked to an organization.`);
  return gym.organization_id;
}

async function serviceSelect<T>(table: string, select: string, filters: string[] = []) {
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for this test");
  const query = [`select=${encodeURIComponent(select)}`, ...filters].join("&");
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${table} select failed with ${response.status}: ${payload?.message}`);
  return payload as T;
}

async function servicePatch(table: string, filters: string[], data: Record<string, unknown>) {
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for this test");
  const query = filters.join("&");
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`${table} patch failed with ${response.status}: ${await response.text()}`);
  }
}

async function serviceInsert(table: string, data: Record<string, unknown>) {
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for this test");
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`${table} insert failed with ${response.status}: ${await response.text()}`);
  }
}

test.describe("Organization Owner Equipment Drawer", () => {
  test("keeps focus while typing into the add equipment drawer", async ({ page }) => {
    test.setTimeout(90_000);

    await ensureEnterprisePlan(await getOrganizationIdForAccount(email));
    await loginAs(page);
    await page.goto("/organization/equipment", { waitUntil: "domcontentloaded" });

    const currentPath = new URL(page.url()).pathname;
    expect(["/organization", "/organization/equipment"]).toContain(currentPath);

    if (currentPath !== "/organization/equipment") {
      test.skip(true, "Equipment module is not enabled for this organization in the current environment.");
    }

    const addButton = page.getByRole("button", { name: /add equipment/i });
    await expect(addButton).toBeVisible();
    await addButton.click();

    const nameInput = page.getByPlaceholder("e.g. Treadmill Pro");
    await expect(nameInput).toBeVisible();

    await nameInput.click();
    await nameInput.type("A");
    await expect(nameInput).toHaveValue("A");
    await expect.poll(() => nameInput.evaluate((el) => document.activeElement === el)).toBe(true);

    await nameInput.type("B");
    await expect(nameInput).toHaveValue("AB");
    await expect.poll(() => nameInput.evaluate((el) => document.activeElement === el)).toBe(true);
  });

  test("shows a confirmation dialog before deleting equipment", async ({ page }) => {
    test.setTimeout(90_000);

    await ensureEnterprisePlan(await getOrganizationIdForAccount(email));
    await loginAs(page);
    await page.goto("/organization/equipment", { waitUntil: "domcontentloaded" });

    const currentPath = new URL(page.url()).pathname;
    expect(["/organization", "/organization/equipment"]).toContain(currentPath);

    if (currentPath !== "/organization/equipment") {
      test.skip(true, "Equipment module is not enabled for this organization in the current environment.");
    }

    const deleteButton = page.getByRole("button", { name: /^Delete$/ }).first();
    if (!(await deleteButton.isVisible().catch(() => false))) {
      test.skip(true, "No equipment rows are available to verify delete confirmation.");
    }

    await deleteButton.click();
    await expect(page.getByRole("dialog", { name: /delete equipment/i })).toBeVisible();
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByRole("dialog", { name: /delete equipment/i })).toHaveCount(0);
  });
});
