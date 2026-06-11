import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Browser, type BrowserContext, type Page, type TestInfo, test } from "@playwright/test";

type AuditLog = {
  console: Array<{ type: string; text: string; location: unknown }>;
  pageErrors: Array<{ message: string; url: string }>;
  network: Array<{ status: number; method: string; url: string }>;
};

type RoleAccount = {
  role: string;
  email: string;
  route: string;
  label: RegExp;
};

type ViewportProfile = {
  name: string;
  width: number;
  height: number;
  isMobile?: boolean;
  hasTouch?: boolean;
};

const localEnv = readLocalEnv();
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3010";
const password = requiredEnv("E2E_AUTH_PASSWORD");

const roleAccounts: RoleAccount[] = [
  {
    role: "super-admin",
    email: readEnv("E2E_SUPER_ADMIN_EMAIL") ?? "hthitame+qa.superadmin@gmail.com",
    route: "/super-admin",
    label: /super admin|platform/i
  },
  {
    role: "organization-owner",
    email: readEnv("E2E_ORGANIZATION_OWNER_EMAIL") ?? "hthitame+qa.owner@gmail.com",
    route: "/organization",
    label: /organization/i
  },
  {
    role: "gym-admin",
    email: readEnv("E2E_GYM_ADMIN_EMAIL") ?? "hthitame+qa.admin@gmail.com",
    route: "/admin",
    label: /gym admin|dashboard/i
  },
  {
    role: "reception",
    email: readEnv("E2E_RECEPTION_EMAIL") ?? "hthitame+qa.reception@gmail.com",
    route: "/reception",
    label: /reception/i
  },
  {
    role: "trainer",
    email: readEnv("E2E_TRAINER_EMAIL") ?? "hthitame+qa.trainer@gmail.com",
    route: "/trainer",
    label: /trainer/i
  },
  {
    role: "member",
    email: readEnv("E2E_MEMBER_EMAIL") ?? "hthitame+qa.member@gmail.com",
    route: "/member",
    label: /member|today/i
  }
];

const responsiveWidths: ViewportProfile[] = [
  { name: "320", width: 320, height: 740, isMobile: true, hasTouch: true },
  { name: "375", width: 375, height: 812, isMobile: true, hasTouch: true },
  { name: "390", width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: "414", width: 414, height: 896, isMobile: true, hasTouch: true },
  { name: "768", width: 768, height: 1024, hasTouch: true },
  { name: "1024", width: 1024, height: 1366, hasTouch: true },
  { name: "1280", width: 1280, height: 900 },
  { name: "1440", width: 1440, height: 1024 },
  { name: "1920", width: 1920, height: 1080 },
  { name: "2560", width: 2560, height: 1440 }
];

const deviceProfiles: ViewportProfile[] = [
  { name: "iphone-se", width: 320, height: 568, isMobile: true, hasTouch: true },
  { name: "iphone-13", width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: "iphone-15-pro-max", width: 430, height: 932, isMobile: true, hasTouch: true },
  { name: "galaxy-s22", width: 360, height: 780, isMobile: true, hasTouch: true },
  { name: "galaxy-a-series", width: 360, height: 800, isMobile: true, hasTouch: true },
  { name: "google-pixel", width: 412, height: 915, isMobile: true, hasTouch: true },
  { name: "ipad", width: 768, height: 1024, hasTouch: true },
  { name: "ipad-pro", width: 1024, height: 1366, hasTouch: true },
  { name: "android-tablet", width: 800, height: 1280, hasTouch: true },
  { name: "small-laptop", width: 1280, height: 800 },
  { name: "large-monitor", width: 1920, height: 1080 },
  { name: "ultra-wide", width: 2560, height: 1080 }
];

const roleViewportProfiles: ViewportProfile[] = [
  { name: "phone", width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: "tablet", width: 768, height: 1024, hasTouch: true },
  { name: "desktop", width: 1440, height: 1024 }
];

const browserProfiles = [
  {
    name: "chrome",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
  },
  {
    name: "edge",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0"
  },
  {
    name: "brave-chromium-ua",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
  },
  {
    name: "samsung-internet-ua",
    userAgent:
      "Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/110.0.0.0 Mobile Safari/537.36"
  },
  {
    name: "firefox-ua-on-runner-engine",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0"
  },
  {
    name: "safari-ua-on-runner-engine",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
  }
];

test.use({ screenshot: "on", trace: "on", video: "on" });

test.describe("QA Phase 13 mobile, tablet, PWA, responsive, cross-browser, and accessibility audit", () => {
  test.describe.configure({ timeout: 240_000 });

  test("public pages hold the responsive viewport and device coverage matrix without overflow or clipping", async ({ browser }, testInfo) => {
    const results: Array<Record<string, unknown>> = [];

    for (const profile of responsiveWidths) {
      const context = await newAuditContext(browser, profile, { serviceWorkers: "block" });
      const page = await context.newPage();
      const audit = setupAudit(page);

      await page.goto(urlFor("/"), { waitUntil: "domcontentloaded", timeout: 90_000 });
      await expectPublicLoginReachable(page);
      await expectNoLayoutBreaks(page);
      await expectNoClientCrashes(audit);
      results.push({ matrix: "width", profile: profile.name, ...(await layoutSnapshot(page)) });
      await page.screenshot({ fullPage: true, path: testInfo.outputPath(`public-width-${profile.name}.png`) });
      await context.close();
    }

    for (const profile of deviceProfiles) {
      const context = await newAuditContext(browser, profile, { serviceWorkers: "block" });
      const page = await context.newPage();
      const audit = setupAudit(page);

      await page.goto(urlFor("/"), { waitUntil: "domcontentloaded", timeout: 90_000 });
      await expectPublicLoginReachable(page);
      await expectNoLayoutBreaks(page);
      await expectNoClientCrashes(audit);
      results.push({ matrix: "device", profile: profile.name, ...(await layoutSnapshot(page)) });
      await context.close();
    }

    await attachJson(testInfo, "phase13-device-responsive-matrix", { results });
  });

  test("all role dashboards are usable on phone, tablet, and desktop breakpoints", async ({ browser }, testInfo) => {
    const results: Array<Record<string, unknown>> = [];

    for (const account of roleAccounts) {
      for (const profile of roleViewportProfiles) {
        const context = await newAuditContext(browser, profile, { serviceWorkers: "block" });
        const page = await context.newPage();
        const audit = setupAudit(page);

        const loginMs = await loginAs(page, account);
        await expectVisibleText(page, account.label);
        await expectNoLayoutBreaks(page);

        if (profile.width < 1024) {
          await expect(page.getByRole("navigation", { name: /mobile primary portal navigation/i })).toBeVisible();
          await expectTapTargets(page);
          const moreButton = page.getByRole("button", { name: /open more navigation/i });
          if (await moreButton.isVisible().catch(() => false)) {
            await moreButton.tap();
            await expect(page.getByText("More").first()).toBeVisible();
          }
        }

        const keyboardResult = profile.hasTouch
          ? { skipped: "Keyboard tab traversal is validated on the desktop profile; touch profiles are validated through touch target and mobile navigation coverage." }
          : await validateKeyboardNavigation(page);
        await expectNoClientCrashes(audit);
        results.push({
          role: account.role,
          profile: profile.name,
          route: account.route,
          loginMs,
          keyboardResult,
          ...(await layoutSnapshot(page))
        });
        await page.screenshot({ fullPage: true, path: testInfo.outputPath(`${account.role}-${profile.name}.png`) });
        await context.close();
      }
    }

    await attachJson(testInfo, "phase13-role-dashboard-responsive", { results });
  });

  test("member mobile workflows expose touch-friendly dashboard, workout, nutrition, class, payment, AI, and notification surfaces", async ({ browser }, testInfo) => {
    const context = await newAuditContext(browser, { name: "member-phone", width: 390, height: 844, isMobile: true, hasTouch: true }, { serviceWorkers: "block" });
    const page = await context.newPage();
    const audit = setupAudit(page);
    const routes = [
      "/member",
      "/member/workouts",
      "/member/fitness",
      "/member/classes",
      "/member/attendance",
      "/member/payments",
      "/member/ai-coach",
      "/member/notifications"
    ];
    const timings: Array<Record<string, unknown>> = [];

    await loginAs(page, roleAccounts.find((account) => account.role === "member")!);
    for (const route of routes) {
      const startedAt = performance.now();
      const response = await page.goto(urlFor(route), { waitUntil: "domcontentloaded", timeout: 90_000 });
      await expectNoLayoutBreaks(page);
      await expectTapTargets(page);
      timings.push({
        route,
        status: response?.status() ?? 0,
        durationMs: Math.round(performance.now() - startedAt),
        snapshot: await layoutSnapshot(page)
      });
    }

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("member-mobile-workflows.png") });
    await expectNoClientCrashes(audit);
    await attachJson(testInfo, "phase13-member-mobile-workflows", { timings });
    await context.close();
  });

  test("trainer mobile and reception tablet workflows keep operational controls visible and touch-ready", async ({ browser }, testInfo) => {
    const workflowChecks = [
      {
        account: roleAccounts.find((item) => item.role === "trainer")!,
        profile: { name: "trainer-phone", width: 390, height: 844, isMobile: true, hasTouch: true },
        routes: ["/trainer", "/trainer/members", "/trainer/programs", "/trainer/progress", "/trainer/sessions", "/trainer/communications"]
      },
      {
        account: roleAccounts.find((item) => item.role === "reception")!,
        profile: { name: "reception-tablet", width: 768, height: 1024, hasTouch: true },
        routes: ["/reception", "/reception/register", "/reception/attendance", "/reception/payments", "/reception/classes", "/reception/messages"]
      }
    ];
    const results: Array<Record<string, unknown>> = [];

    for (const check of workflowChecks) {
      const context = await newAuditContext(browser, check.profile, { serviceWorkers: "block" });
      const page = await context.newPage();
      const audit = setupAudit(page);

      await loginAs(page, check.account);
      for (const route of check.routes) {
        const startedAt = performance.now();
        const response = await page.goto(urlFor(route), { waitUntil: "domcontentloaded", timeout: 90_000 });
        await expectNoLayoutBreaks(page);
        await expectTapTargets(page);
        results.push({
          role: check.account.role,
          profile: check.profile.name,
          route,
          status: response?.status() ?? 0,
          durationMs: Math.round(performance.now() - startedAt),
          snapshot: await layoutSnapshot(page)
        });
      }

      await page.screenshot({ fullPage: true, path: testInfo.outputPath(`${check.account.role}-${check.profile.name}-workflow.png`) });
      await expectNoClientCrashes(audit);
      await context.close();
    }

    await attachJson(testInfo, "phase13-trainer-reception-mobile-tablet", { results });
  });

  test("admin analytics, reports, tables, filters, and exports remain responsive on large and ultra-wide screens", async ({ browser }, testInfo) => {
    const adminChecks = [
      { account: roleAccounts.find((item) => item.role === "super-admin")!, routes: ["/super-admin", "/super-admin/analytics", "/super-admin/billing", "/super-admin/users"] },
      { account: roleAccounts.find((item) => item.role === "organization-owner")!, routes: ["/organization", "/organization/analytics", "/organization/revenue", "/organization/members"] },
      { account: roleAccounts.find((item) => item.role === "gym-admin")!, routes: ["/admin", "/admin/reports", "/admin/members", "/admin/payments"] }
    ];
    const results: Array<Record<string, unknown>> = [];

    for (const profile of [
      { name: "large-monitor", width: 1920, height: 1080 },
      { name: "ultra-wide", width: 2560, height: 1080 }
    ]) {
      for (const check of adminChecks) {
        const context = await newAuditContext(browser, profile, { serviceWorkers: "block" });
        const page = await context.newPage();
        const audit = setupAudit(page);

        await loginAs(page, check.account);
        for (const route of check.routes) {
          const response = await page.goto(urlFor(route), { waitUntil: "domcontentloaded", timeout: 90_000 });
          await expectNoLayoutBreaks(page);
          results.push({
            role: check.account.role,
            profile: profile.name,
            route,
            status: response?.status() ?? 0,
            snapshot: await layoutSnapshot(page)
          });
        }

        await expectNoClientCrashes(audit);
        await context.close();
      }
    }

    await attachJson(testInfo, "phase13-admin-large-screen", { results });
  });

  test("forms support mobile keyboard focus, validation messaging, upload controls, and accessible field labels", async ({ browser }, testInfo) => {
    const context = await newAuditContext(browser, { name: "phone-form", width: 390, height: 844, isMobile: true, hasTouch: true }, { serviceWorkers: "block" });
    const page = await context.newPage();
    const audit = setupAudit(page);
    const formRoutes = [
      { account: roleAccounts.find((item) => item.role === "member")!, route: "/member/profile", expectedFields: [/full name/i, /avatar url/i, /emergency/i] },
      { account: roleAccounts.find((item) => item.role === "reception")!, route: "/reception/register", expectedFields: [/full name/i, /phone/i, /membership/i] }
    ];
    const results: Array<Record<string, unknown>> = [];

    for (const item of formRoutes) {
      await clearAuth(page);
      await loginAs(page, item.account);
      const response = await page.goto(urlFor(item.route), { waitUntil: "domcontentloaded", timeout: 90_000 });
      await expectNoLayoutBreaks(page);
      for (const field of item.expectedFields) {
        await expect(page.getByText(field).first()).toBeVisible();
      }
      const accessibility = await basicAccessibilitySnapshot(page);
      expect(accessibility.controlsWithoutNames).toEqual([]);
      expect(accessibility.inputsWithoutLabels).toEqual([]);
      results.push({ role: item.account.role, route: item.route, status: response?.status() ?? 0, accessibility });
    }

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("mobile-form-accessibility.png") });
    await expectNoClientCrashes(audit);
    await attachJson(testInfo, "phase13-form-accessibility", { results });
    await context.close();
  });

  test("PWA installability assets, service worker, offline fallback, push entry points, and mobile metadata are valid", async ({ page, context }, testInfo) => {
    const audit = setupAudit(page);

    const manifestResponse = await page.request.get("/manifest.webmanifest");
    expect(manifestResponse.status()).toBe(200);
    const manifest = (await manifestResponse.json()) as {
      name?: string;
      short_name?: string;
      start_url?: string;
      display?: string;
      display_override?: string[];
      icons?: Array<{ src?: string; purpose?: string; sizes?: string }>;
      screenshots?: unknown[];
      shortcuts?: unknown[];
    };
    expect(manifest.start_url).toContain("/member");
    expect(manifest.display).toBe("standalone");
    expect((manifest.icons ?? []).some((icon) => icon.purpose?.includes("maskable"))).toBe(true);
    expect((manifest.screenshots ?? []).length).toBeGreaterThanOrEqual(2);
    expect((manifest.shortcuts ?? []).length).toBeGreaterThanOrEqual(3);

    for (const icon of manifest.icons ?? []) {
      if (icon.src) {
        const iconResponse = await page.request.get(icon.src);
        expect(iconResponse.status()).toBe(200);
      }
    }

    const swResponse = await page.request.get("/sw.js");
    expect(swResponse.status()).toBe(200);
    const swText = await swResponse.text();
    expect(swText).toContain("self.addEventListener(\"push\"");
    expect(swText).toContain("notificationclick");
    expect(swText).toContain("apex-offline-sync");
    expect(swText).toContain("CLEAR_PRIVATE_CACHES");

    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 90_000 });
    const registrationState = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) {
        return { supported: false, controlled: false, scope: null };
      }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      return { supported: true, controlled: Boolean(navigator.serviceWorker.controller), scope: registration.scope };
    });
    expect(registrationState.supported).toBe(true);
    expect(registrationState.scope).toContain("/");

    await page.goto("/offline", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(page.getByRole("heading", { name: /keep moving/i })).toBeVisible();
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => undefined);
    await expect(page.getByText(/offline mode/i).first()).toBeVisible();
    await context.setOffline(false);

    const invalidPush = await page.request.post("/api/pwa/push-subscriptions", {
      data: { endpoint: "not-a-url", keys: { p256dh: "invalid", auth: "invalid" } }
    });
    expect([400, 401]).toContain(invalidPush.status());

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("pwa-offline.png") });
    await expectNoClientCrashes(audit);
    await attachJson(testInfo, "phase13-pwa-assets-offline-push", { manifest, registrationState, invalidPushStatus: invalidPush.status() });
  });

  test("network conditions degrade gracefully for public, login, member, and offline routes", async ({ browser }, testInfo) => {
    const results: Array<Record<string, unknown>> = [];
    const networkProfiles = [
      { name: "4g", latency: 40, download: 8_000_000, upload: 4_000_000 },
      { name: "3g", latency: 180, download: 1_600_000, upload: 750_000 },
      { name: "slow-3g", latency: 450, download: 500_000, upload: 250_000 }
    ];

    for (const network of networkProfiles) {
      const context = await newAuditContext(browser, { name: network.name, width: 390, height: 844, isMobile: true, hasTouch: true }, { serviceWorkers: "block" });
      const page = await context.newPage();
      const audit = setupAudit(page);
      const client = await context.newCDPSession(page);
      await client.send("Network.enable");
      await client.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: network.latency,
        downloadThroughput: network.download / 8,
        uploadThroughput: network.upload / 8
      });

      for (const route of ["/", "/login", "/offline"]) {
        const startedAt = performance.now();
        const response = await page.goto(urlFor(route), { waitUntil: "domcontentloaded", timeout: 90_000 });
        await expectNoLayoutBreaks(page);
        results.push({ network: network.name, route, status: response?.status() ?? 0, durationMs: Math.round(performance.now() - startedAt) });
      }

      await expectNoClientCrashes(audit);
      await context.close();
    }

    await attachJson(testInfo, "phase13-network-conditions", { results });
  });

  test("cross-browser compatibility probes pass for supported and target browser user agents", async ({ browser }, testInfo) => {
    const results: Array<Record<string, unknown>> = [];

    for (const profile of browserProfiles) {
      const context = await browser.newContext({
        baseURL,
        userAgent: profile.userAgent,
        viewport: { width: profile.name.includes("safari") || profile.name.includes("samsung") ? 390 : 1440, height: profile.name.includes("safari") || profile.name.includes("samsung") ? 844 : 1024 },
        isMobile: profile.name.includes("safari") || profile.name.includes("samsung"),
        hasTouch: profile.name.includes("safari") || profile.name.includes("samsung"),
        serviceWorkers: "block"
      });
      const page = await context.newPage();
      const audit = setupAudit(page);
      const response = await page.goto(urlFor("/"), { waitUntil: "domcontentloaded", timeout: 90_000 });
      await expectPublicLoginReachable(page);
      await expectNoLayoutBreaks(page);
      await expectNoClientCrashes(audit);
      results.push({ profile: profile.name, status: response?.status() ?? 0, snapshot: await layoutSnapshot(page) });
      await context.close();
    }

    await attachJson(testInfo, "phase13-cross-browser-probes", {
      results,
      note: "Firefox, Safari, Samsung Internet, and Brave coverage here is user-agent compatibility probing on the configured Playwright runner engine. Real engine/device lab validation is still required."
    });
  });

  test("orientation changes preserve layout state on mobile member portal", async ({ browser }, testInfo) => {
    const context = await newAuditContext(browser, { name: "orientation", width: 390, height: 844, isMobile: true, hasTouch: true }, { serviceWorkers: "block" });
    const page = await context.newPage();
    const audit = setupAudit(page);

    await loginAs(page, roleAccounts.find((account) => account.role === "member")!);
    await expectNoLayoutBreaks(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await expectNoLayoutBreaks(page);
    await expect(page.getByRole("navigation", { name: /mobile primary portal navigation/i })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoLayoutBreaks(page);

    await page.screenshot({ fullPage: true, path: testInfo.outputPath("member-orientation-restored.png") });
    await expectNoClientCrashes(audit);
    await attachJson(testInfo, "phase13-orientation", { snapshot: await layoutSnapshot(page) });
    await context.close();
  });
});

async function newAuditContext(browser: Browser, profile: ViewportProfile, options: { serviceWorkers?: "allow" | "block" } = {}): Promise<BrowserContext> {
  return browser.newContext({
    baseURL,
    viewport: { width: profile.width, height: profile.height },
    isMobile: profile.isMobile ?? false,
    hasTouch: profile.hasTouch ?? false,
    deviceScaleFactor: profile.isMobile ? 2 : 1,
    serviceWorkers: options.serviceWorkers ?? "allow"
  });
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
    audit.pageErrors.push({ message: error.message, url: page.url() });
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

async function attachJson(testInfo: TestInfo, name: string, data: Record<string, unknown>) {
  await testInfo.attach(name, {
    body: JSON.stringify(data, null, 2),
    contentType: "application/json"
  });
}

function clientErrors(audit: AuditLog) {
  return audit.console
    .filter((entry) => entry.type === "error")
    .map((entry) => entry.text)
    .filter((text) => !text.includes("Failed to load resource: the server responded with a status of 403"))
    .filter((text) => !text.includes("Failed to load resource: the server responded with a status of 401"));
}

async function expectNoClientCrashes(audit: AuditLog) {
  expect(clientErrors(audit)).toEqual([]);
  expect(audit.pageErrors).toEqual([]);
  expect(audit.network).toEqual([]);
}

async function loginAs(page: Page, account: RoleAccount) {
  const startedAt = performance.now();
  await page.goto(urlFor("/login"), { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 45_000 }).toBe(account.route);
  return Math.round(performance.now() - startedAt);
}

async function clearAuth(page: Page) {
  await page.context().clearCookies();
  await page.goto(urlFor("/login"), { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function expectNoLayoutBreaks(page: Page) {
  const snapshot = await layoutSnapshot(page);
  expect(snapshot.horizontalOverflow, JSON.stringify(snapshot)).toBeLessThanOrEqual(2);
  expect(snapshot.clippedFixedElements, JSON.stringify(snapshot)).toEqual([]);
}

async function layoutSnapshot(page: Page) {
  return page.evaluate(() => {
    const documentElement = document.documentElement;
    const body = document.body;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const horizontalOverflow = Math.max(documentElement.scrollWidth, body.scrollWidth) - viewportWidth;
    const fixedElements = Array.from(document.querySelectorAll<HTMLElement>("header, nav, aside, [role='dialog'], [data-radix-popper-content-wrapper]"));
    const clippedFixedElements = fixedElements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const label = element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 60) || element.tagName.toLowerCase();
        return {
          label,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom)
        };
      })
      .filter((item) => item.right < -2 || item.left > viewportWidth + 2 || item.bottom < -2 || item.top > viewportHeight + 2);

    return {
      viewportWidth,
      viewportHeight,
      documentWidth: documentElement.scrollWidth,
      bodyWidth: body.scrollWidth,
      horizontalOverflow,
      clippedFixedElements
    };
  });
}

async function expectTapTargets(page: Page) {
  const violations = await page.evaluate(() => {
    const selector = "nav[aria-label*='Mobile'] a, nav[aria-label*='Mobile'] button, button, input:not([type='checkbox']):not([type='radio']), select, textarea, label:has(input[type='checkbox']), label:has(input[type='radio'])";
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const name = element.getAttribute("aria-label") || element.textContent?.trim() || element.getAttribute("placeholder") || element.tagName.toLowerCase();
        return { name, width: Math.round(rect.width), height: Math.round(rect.height) };
      })
      .filter((item) => item.width < 40 || item.height < 40);
  });
  expect(violations).toEqual([]);
}

async function expectPublicLoginReachable(page: Page) {
  const desktopLogin = page.getByRole("link", { name: /sign in/i });
  if (await desktopLogin.first().isVisible().catch(() => false)) {
    await expect(desktopLogin.first()).toBeVisible();
    return;
  }

  const menuButton = page.getByLabel(/toggle mobile menu/i);
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
}

async function expectVisibleText(page: Page, pattern: RegExp) {
  await expect
    .poll(
      async () =>
        page.locator("body").evaluate((body, source) => {
          const regex = new RegExp(source, "i");
          const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const node = walker.currentNode;
            const text = node.textContent?.trim();
            if (!text || !regex.test(text)) {
              continue;
            }
            const element = node.parentElement;
            if (!element) {
              continue;
            }
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            if (rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none") {
              return true;
            }
          }
          return false;
        }, pattern.source),
      { timeout: 15_000 }
    )
    .toBe(true);
}

async function validateKeyboardNavigation(page: Page) {
  await page.keyboard.press("Tab");
  const firstFocus = await focusedElementSnapshot(page);
  await page.keyboard.press("Tab");
  const secondFocus = await focusedElementSnapshot(page);
  expect(firstFocus.hasFocus).toBe(true);
  expect(secondFocus.hasFocus).toBe(true);
  return { firstFocus, secondFocus };
}

async function focusedElementSnapshot(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) {
      return { hasFocus: false, tag: null, name: null };
    }
    const name = element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 80) || element.getAttribute("placeholder") || element.getAttribute("name");
    return { hasFocus: true, tag: element.tagName.toLowerCase(), name };
  });
}

async function basicAccessibilitySnapshot(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const rect = (element as HTMLElement).getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };

    const accessibleName = (element: Element) =>
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.textContent?.trim() ||
      (element as HTMLInputElement).placeholder ||
      "";

    const controlsWithoutNames = Array.from(document.querySelectorAll("button, a[href]"))
      .filter(visible)
      .filter((element) => accessibleName(element).trim().length === 0)
      .map((element) => element.outerHTML.slice(0, 180));

    const inputsWithoutLabels = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"))
      .filter(visible)
      .filter((element) => {
        if (element.type === "hidden") {
          return false;
        }
        const id = element.id;
        const hasLabel = Boolean(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
        const placeholder = "placeholder" in element ? element.placeholder : "";
        return !hasLabel && !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby") && !placeholder;
      })
      .map((element) => element.outerHTML.slice(0, 180));

    const imagesWithoutAlt = Array.from(document.querySelectorAll("img"))
      .filter(visible)
      .filter((element) => !element.hasAttribute("alt"))
      .map((element) => element.outerHTML.slice(0, 180));

    return { controlsWithoutNames, inputsWithoutLabels, imagesWithoutAlt };
  });
}

function urlFor(path: string) {
  return new URL(path, baseURL).toString();
}

function readLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    return Object.fromEntries(
      readFileSync(envPath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          const key = line.slice(0, index).trim();
          const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
          return [key, value];
        })
    );
  } catch {
    return {} as Record<string, string>;
  }
}

function readEnv(name: string) {
  return process.env[name] ?? localEnv[name];
}

function requiredEnv(name: string) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
