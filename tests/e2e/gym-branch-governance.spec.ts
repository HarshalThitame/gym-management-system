import { expect, type Page, type TestInfo, test } from "@playwright/test";

type AuditLog = {
  console: Array<{ type: string; text: string; location: unknown }>;
  pageErrors: string[];
  network: Array<{ status: number; method: string; url: string }>;
};

const password = requiredEnv("E2E_AUTH_PASSWORD");
const superAdminEmail = process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame@gmail.com";

test.use({ screenshot: "on", serviceWorkers: "block", trace: "on", video: "on" });

test.describe("Gym and Branch governance", () => {
  test("Super Admin can review hierarchy, use pagination controls, and see guarded action validation", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const audit = setupAudit(page);

    await loginAsSuperAdmin(page);
    await page.goto("/super-admin/gyms", { waitUntil: "domcontentloaded" });
    await expectPath(page, "/super-admin/gyms");

    await expect(page.getByRole("heading", { name: "Gym and Branch Management" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Gym and Branch Governance" })).toBeVisible();
    await expect(page.getByText("Warnings", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Page size")).toBeVisible();

    await page.getByLabel("Page size").selectOption("10");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("pageSize")).toBe("10");
    await expect(page.getByText(/Page \d+ of \d+/)).toBeVisible();

    await page.getByRole("button", { name: "Create Branch" }).first().click();
    const branchDialog = page.getByRole("dialog");
    await expect(branchDialog.getByRole("heading", { name: "Create Branch" })).toBeVisible();
    await branchDialog.getByRole("button", { name: "Create Branch" }).click();
    await expect(branchDialog.getByText("Branch name is required.")).toBeVisible();
    await branchDialog.getByLabel("Close drawer").click();

    const lifecycleButtons = page.getByRole("button", { name: "Lifecycle" });
    if (await lifecycleButtons.count() > 0) {
      await lifecycleButtons.first().click();
      const lifecycleDialog = page.getByRole("dialog");
      await expect(lifecycleDialog.getByRole("heading", { name: /Lifecycle/ })).toBeVisible();
      await expect(lifecycleDialog.getByLabel("Critical Super Admin email")).toBeVisible();
      await expect(lifecycleDialog.getByLabel("Confirmation")).toBeVisible();
      await expect(lifecycleDialog.getByText("Archiving is blocked when operational dependencies remain.")).toBeVisible();
    }

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("gym-branch-governance.png") });
    await attachAudit(testInfo, "gym-branch-governance-audit", audit);
    await expectNoClientCrashes(audit);
  });
});

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function setupAudit(page: Page) {
  const audit: AuditLog = {
    console: [],
    pageErrors: [],
    network: []
  };

  page.on("console", (message) => {
    audit.console.push({
      type: message.type(),
      text: message.text(),
      location: message.location()
    });
  });

  page.on("pageerror", (error) => {
    audit.pageErrors.push(error.message);
  });

  page.on("response", (response) => {
    if (response.status() >= 500) {
      audit.network.push({
        status: response.status(),
        method: response.request().method(),
        url: response.url()
      });
    }
  });

  return audit;
}

async function attachAudit(testInfo: TestInfo, name: string, audit: AuditLog) {
  await testInfo.attach(name, {
    body: JSON.stringify(audit, null, 2),
    contentType: "application/json"
  });
}

function clientErrors(audit: AuditLog) {
  return audit.console
    .filter((entry) => entry.type === "error")
    .map((entry) => entry.text)
    .filter((text) => !text.includes("Failed to load resource: the server responded with a status of 403"));
}

async function expectNoClientCrashes(audit: AuditLog) {
  expect(clientErrors(audit)).toEqual([]);
  expect(audit.pageErrors).toEqual([]);
  expect(audit.network).toEqual([]);
}

async function currentPath(page: Page) {
  return new URL(page.url()).pathname;
}

async function expectPath(page: Page, path: string) {
  await expect.poll(() => currentPath(page), { timeout: 30_000 }).toBe(path);
}

async function loginAsSuperAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(superAdminEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expectPath(page, "/super-admin");
}
