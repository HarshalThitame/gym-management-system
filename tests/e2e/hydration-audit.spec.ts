import { expect, type Page, type TestInfo, test } from "@playwright/test";

type HydrationAudit = {
  hydrationErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
};

const HYDRATION_PATTERNS = [
  /Hydration failed/i,
  /server rendered HTML didn't match/i,
  /hydrated but some attributes/i,
  /Text content does not match/i,
  /Expected server HTML/i,
  /A tree hydrated but some/i,
  /There was an error while hydrating/i,
];

const testRoutes = [
  "/organization",
  "/super-admin",
  "/super-admin/packages",
  "/super-admin/subscriptions",
  "/super-admin/organizations",
] as const;

const authEmail = process.env.E2E_ORGANIZATION_OWNER_EMAIL ?? "hthitame+qa.owner@gmail.com";
const authPassword = process.env.E2E_AUTH_PASSWORD ?? "";
const superAdminEmail = process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com";

function setupHydrationAudit(page: Page) {
  const audit: HydrationAudit = {
    hydrationErrors: [],
    consoleWarnings: [],
    pageErrors: [],
  };

  page.on("console", (message) => {
    const text = message.text();
    const isHydrationError = HYDRATION_PATTERNS.some((p) => p.test(text));
    if (isHydrationError) {
      audit.hydrationErrors.push(text);
    }
    if (message.type() === "warning" && text.includes("hydration")) {
      audit.consoleWarnings.push(text);
    }
  });

  page.on("pageerror", (error) => {
    audit.pageErrors.push(error.message);
  });

  return audit;
}

async function expectNoHydrationIssues(audit: HydrationAudit) {
  const messages: string[] = [];
  if (audit.hydrationErrors.length > 0) {
    messages.push(`Hydration errors: ${audit.hydrationErrors.join(", ")}`);
  }
  if (audit.pageErrors.length > 0) {
    messages.push(`Page errors: ${audit.pageErrors.join(", ")}`);
  }
  if (messages.length > 0) {
    throw new Error(messages.join("\n"));
  }
}

async function loginAsEmail(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

test.describe("Hydration error audit", () => {
  test("Organization Owner routes have zero hydration mismatch errors", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    test.skip(!authPassword, "E2E_AUTH_PASSWORD not set");

    const audit = setupHydrationAudit(page);

    await loginAsEmail(page, authEmail, authPassword);

    for (const route of testRoutes) {
      if (!route.startsWith("/organization")) continue;

      await page.goto(route, { waitUntil: "networkidle", timeout: 90_000 });
      await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

      await testInfo.attach(`hydration-check-${route.replace(/\//g, "-")}`, {
        body: JSON.stringify({ route, hydrationErrors: audit.hydrationErrors, pageErrors: audit.pageErrors }, null, 2),
        contentType: "application/json",
      });

      await expectNoHydrationIssues(audit);
    }
  });

  test("Super Admin routes have zero hydration mismatch errors", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    test.skip(!authPassword, "E2E_AUTH_PASSWORD not set");

    const audit = setupHydrationAudit(page);

    await loginAsEmail(page, superAdminEmail ?? authEmail, authPassword);

    for (const route of testRoutes) {
      if (!route.startsWith("/super-admin")) continue;

      await page.goto(route, { waitUntil: "networkidle", timeout: 90_000 });
      await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

      await testInfo.attach(`hydration-check-${route.replace(/\//g, "-")}`, {
        body: JSON.stringify({ route, hydrationErrors: audit.hydrationErrors, pageErrors: audit.pageErrors }, null, 2),
        contentType: "application/json",
      });

      await expectNoHydrationIssues(audit);
    }
  });

  test("organization home page hydration is clean after hard refresh", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    test.skip(!authPassword, "E2E_AUTH_PASSWORD not set");

    const audit = setupHydrationAudit(page);

    await loginAsEmail(page, authEmail, authPassword);

    // Hard refresh 5 times and check each time
    for (let i = 0; i < 5; i++) {
      await page.goto("/organization", { waitUntil: "networkidle", timeout: 90_000 });
      await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

      await page.reload({ waitUntil: "networkidle", timeout: 90_000 });
      await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

      await testInfo.attach(`hydration-check-refresh-${i}`, {
        body: JSON.stringify({ refreshCount: i, hydrationErrors: audit.hydrationErrors, pageErrors: audit.pageErrors }, null, 2),
        contentType: "application/json",
      });

      await expectNoHydrationIssues(audit);
    }
  });
});
