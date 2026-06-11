import { expect, type Page, type TestInfo, test } from "@playwright/test";

type AuditLog = {
  console: Array<{ type: string; text: string; location: unknown }>;
  pageErrors: string[];
  network: Array<{ status: number; method: string; url: string }>;
};

type AuditAccount = {
  role: string;
  email: string;
  expectedPath: string;
  expectedRoleText: RegExp;
};

const password = requiredEnv("E2E_AUTH_PASSWORD");

const accounts: AuditAccount[] = [
  {
    role: "super_admin",
    email: process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com",
    expectedPath: "/super-admin",
    expectedRoleText: /super admin/i
  },
  {
    role: "gym_admin",
    email: process.env.E2E_GYM_ADMIN_EMAIL ?? "hthitame+qa.admin@gmail.com",
    expectedPath: "/admin",
    expectedRoleText: /gym admin/i
  },
  {
    role: "reception_staff",
    email: process.env.E2E_RECEPTION_EMAIL ?? "hthitame+qa.reception@gmail.com",
    expectedPath: "/reception",
    expectedRoleText: /reception staff/i
  },
  {
    role: "trainer",
    email: process.env.E2E_TRAINER_EMAIL ?? "hthitame+qa.trainer@gmail.com",
    expectedPath: "/trainer",
    expectedRoleText: /trainer/i
  },
  {
    role: "member",
    email: process.env.E2E_MEMBER_EMAIL ?? "hthitame+qa.member@gmail.com",
    expectedPath: "/member",
    expectedRoleText: /member/i
  }
];

const protectedRoutes = ["/admin", "/admin/settings", "/reception", "/trainer", "/member"];

test.use({ screenshot: "on", trace: "on", video: "on" });

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function accountFor(role: AuditAccount["role"]) {
  const account = accounts.find((item) => item.role === role);
  if (!account) {
    throw new Error(`Missing audit account for role ${role}`);
  }
  return account;
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
    if (response.status() >= 400) {
      audit.network.push({
        status: response.status(),
        method: response.request().method(),
        url: response.url()
      });
    }
  });

  return audit;
}

async function attachAudit(testInfo: TestInfo, audit: AuditLog, extra: Record<string, unknown> = {}) {
  await testInfo.attach("auth-audit-log", {
    body: JSON.stringify({ ...extra, ...audit }, null, 2),
    contentType: "application/json"
  });
}

function clientErrors(audit: AuditLog) {
  return audit.console.filter((entry) => entry.type === "error").map((entry) => entry.text);
}

async function expectNoClientErrors(audit: AuditLog) {
  expect(clientErrors(audit)).toEqual([]);
  expect(audit.pageErrors).toEqual([]);
}

async function currentPath(page: Page) {
  return new URL(page.url()).pathname;
}

async function expectPath(page: Page, path: string) {
  await expect.poll(() => currentPath(page), { timeout: 30_000 }).toBe(path);
}

async function loginAs(page: Page, account: AuditAccount) {
  const start = Date.now();
  await page.goto("/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expectPath(page, account.expectedPath);
  return Date.now() - start;
}

test.describe("authentication audit", () => {
  test("login page validates fields, keyboard behavior, masking, and responsive rendering", async ({ page }, testInfo) => {
    const audit = setupAudit(page);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
    await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");

    await page.getByLabel("Email").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Forgot?" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password")).toBeFocused();

    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("x");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect.poll(() => page.getByLabel("Email").evaluate((input) => (input as HTMLInputElement).validity.typeMismatch)).toBe(true);

    await page.getByLabel("Email").fill("");
    await page.getByLabel("Password").fill("");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect.poll(() => page.getByLabel("Email").evaluate((input) => (input as HTMLInputElement).validity.valueMissing)).toBe(true);
    await expect.poll(() => page.getByLabel("Password").evaluate((input) => (input as HTMLInputElement).validity.valueMissing)).toBe(true);

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("login-page-mobile.png") });
    await attachAudit(testInfo, audit);
    await expectNoClientErrors(audit);
  });

  test("enter key submits the login form", async ({ page }, testInfo) => {
    const audit = setupAudit(page);
    const account = accountFor("member");

    await page.goto("/login");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(password);
    await page.keyboard.press("Enter");
    await expectPath(page, account.expectedPath);

    await attachAudit(testInfo, audit);
    await expectNoClientErrors(audit);
  });

  for (const account of accounts) {
    test(`${account.role} can login, gets a session, redirects correctly, and persists after refresh`, async ({ page }, testInfo) => {
      const audit = setupAudit(page);

      const loginMs = await loginAs(page, account);
      await expect(page.locator("header")).toContainText(account.expectedRoleText);

      const cookies = await page.context().cookies();
      expect(cookies.some((cookie) => cookie.name.includes("auth-token"))).toBe(true);

      await page.reload();
      await expectPath(page, account.expectedPath);

      await page.goto(account.expectedPath === "/member" ? "/member/profile" : account.expectedPath);
      await expect.poll(() => new URL(page.url()).pathname.startsWith(account.expectedPath)).toBe(true);

      await attachAudit(testInfo, audit, { loginMs, targetLoginMs: 1_500, targetMet: loginMs < 1_500 });
      await expectNoClientErrors(audit);
      await page.screenshot({ fullPage: true, path: testInfo.outputPath(`${account.role}-landing.png`) });
      expect(loginMs).toBeLessThan(30_000);
    });

    test(`${account.role} logout clears session and blocks browser back access`, async ({ page }, testInfo) => {
      const audit = setupAudit(page);

      await loginAs(page, account);
      await page.getByRole("button", { name: /sign out/i }).first().click();
      await expectPath(page, "/login");

      await page.goBack();
      await expectPath(page, "/login");

      await page.goto(account.expectedPath).catch((error: Error) => {
        if (!error.message.includes("ERR_ABORTED")) {
          throw error;
        }
      });
      await expectPath(page, "/login");

      await attachAudit(testInfo, audit);
      await expectNoClientErrors(audit);
    });
  }

  test("invalid login attempts are blocked without client crashes or sensitive leakage", async ({ page }, testInfo) => {
    const audit = setupAudit(page);
    const invalidPayloads = [
      { email: "missing@example.com", password: "WrongPassword$00" },
      { email: accountFor("member").email, password: "WrongPassword$00" },
      { email: "' OR '1'='1", password: "' OR '1'='1" },
      { email: "<script>alert(1)</script>@example.com", password: "<img src=x onerror=alert(1)>" },
      { email: `${"a".repeat(240)}@example.com`, password: "A".repeat(512) },
      { email: "special+chars@example.com", password: "!@#$%^&*()_+-=[]{}" }
    ];

    for (const payload of invalidPayloads) {
      await page.goto("/login");
      await page.getByLabel("Email").fill(payload.email);
      await page.getByLabel("Password").fill(payload.password);
      await page.getByRole("button", { name: /sign in/i }).click();
      await expect.poll(() => new URL(page.url()).pathname).toBe("/login");
      const emailIsValid = await page.getByLabel("Email").evaluate((input) => (input as HTMLInputElement).validity.valid);
      if (emailIsValid) {
        await expect(page.getByText("Invalid email or password.")).toBeVisible();
      }
      await expect(page.getByText(/jwt|stack|trace|service_role|sql|syntax error/i)).toHaveCount(0);
    }

    await attachAudit(testInfo, audit);
    await expectNoClientErrors(audit);
  });

  test("anonymous users cannot directly access protected portals", async ({ page }, testInfo) => {
    const audit = setupAudit(page);

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(route)}`));
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    }

    await attachAudit(testInfo, audit);
    await expectNoClientErrors(audit);
  });

  test("role route protection blocks lower-privilege portal access", async ({ browser }, testInfo) => {
    const results: Array<{ role: string; attempted: string; landed: string }> = [];

    const scenarios = [
      { account: accountFor("member"), routes: ["/admin", "/admin/settings", "/reception", "/trainer"] },
      { account: accountFor("trainer"), routes: ["/admin", "/admin/settings", "/reception"] },
      { account: accountFor("reception_staff"), routes: ["/trainer", "/admin/settings"] }
    ];

    for (const scenario of scenarios) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const audit = setupAudit(page);
      await loginAs(page, scenario.account);

      for (const route of scenario.routes) {
        await page.goto(route);
        const landed = await currentPath(page);
        results.push({ role: scenario.account.role, attempted: route, landed });
        expect(landed).not.toBe(route);
        expect(landed).toBe(scenario.account.expectedPath);
      }

      await expectNoClientErrors(audit);
      await context.close();
    }

    await testInfo.attach("route-protection-results", {
      body: JSON.stringify(results, null, 2),
      contentType: "application/json"
    });
  });

  test("tampered or removed auth cookies cannot access protected pages", async ({ page }, testInfo) => {
    const audit = setupAudit(page);

    await page.context().addCookies([
      {
        name: "sb-bobqiyhljubfrzmhqnqq-auth-token",
        value: "tampered.invalid.token",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax"
      }
    ]);
    await page.goto("/member");
    await expect(page).toHaveURL(/\/login\?next=%2Fmember/);

    await loginAs(page, accountFor("member"));
    await page.context().clearCookies();
    await page.goto("/member");
    await expect(page).toHaveURL(/\/login\?next=%2Fmember/);

    await attachAudit(testInfo, audit);
    await expectNoClientErrors(audit);
  });

  test("authenticated session works across tabs in one browser context", async ({ context, page }, testInfo) => {
    const audit = setupAudit(page);
    const account = accountFor("member");

    await loginAs(page, account);
    const secondTab = await context.newPage();
    const secondAudit = setupAudit(secondTab);
    await secondTab.goto("/member");
    await expectPath(secondTab, "/member");

    await attachAudit(testInfo, audit, { secondTab: secondAudit });
    await expectNoClientErrors(audit);
    await expectNoClientErrors(secondAudit);
  });
});
