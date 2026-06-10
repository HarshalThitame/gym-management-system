import { expect, test } from "@playwright/test";

test("login page renders the premium auth shell", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("protected member route redirects anonymous visitors", async ({ page }) => {
  await page.goto("/member");
  await expect(page).toHaveURL(/\/login\?next=%2Fmember/);
});

test("protected communication routes redirect anonymous visitors", async ({ page }) => {
  await page.goto("/admin/communications");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fcommunications/);

  await page.goto("/member/notifications");
  await expect(page).toHaveURL(/\/login\?next=%2Fmember%2Fnotifications/);

  await page.goto("/trainer/communications");
  await expect(page).toHaveURL(/\/login\?next=%2Ftrainer%2Fcommunications/);
});

test("protected analytics route redirects anonymous visitors", async ({ page }) => {
  await page.goto("/admin/reports");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Freports/);
});

test("protected enterprise settings route redirects anonymous visitors", async ({ page }) => {
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fsettings/);
});

test("PWA assets and offline fallback are available", async ({ page, request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  await expect(manifest.json()).resolves.toMatchObject({
    name: "Apex Performance Club",
    short_name: "Apex",
    display: "standalone"
  });

  const serviceWorker = await request.get("/sw.js");
  expect(serviceWorker.ok()).toBeTruthy();
  await expect(serviceWorker.text()).resolves.toContain("apex-pwa-v16");

  const icon = await request.get("/icons/apex-maskable.svg");
  expect(icon.ok()).toBeTruthy();

  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: /You can keep moving/i })).toBeVisible();
});
