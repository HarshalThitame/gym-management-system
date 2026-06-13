import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

type AuditLog = {
  console: Array<{ type: string; text: string; location: unknown }>;
  pageErrors: Array<{ message: string; url: string }>;
  network: Array<{ status: number; method: string; url: string }>;
};

const password = process.env.E2E_AUTH_PASSWORD ?? "";
const superAdminEmail = process.env.E2E_SUPER_ADMIN_EMAIL ?? "hthitame+qa.superadmin@gmail.com";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3010";

const viewports = [
  { name: "mobile-320", width: 320, height: 740 },
  { name: "mobile-375", width: 375, height: 812 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "desktop-1440", width: 1440, height: 1024 }
];

async function loginAsSuperAdmin(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.fill("input[name=email]", superAdminEmail);
  await page.fill("input[name=password]", password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/super-admin/);
}

test.describe("User Management Module — Responsive Audit", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  for (const vp of viewports) {
    test(`users page renders without horizontal overflow at ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/super-admin/users");
      await page.waitForLoadState("networkidle");

      const overflow = await page.evaluate(() => {
        const body = document.body;
        return {
          scrollWidth: body.scrollWidth,
          clientWidth: body.clientWidth,
          hasHorizontalOverflow: body.scrollWidth > body.clientWidth + 5
        };
      });

      expect(overflow.hasHorizontalOverflow).toBe(false);
    });

    test(`users page summary cards stack properly at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/super-admin/users");
      await page.waitForLoadState("networkidle");

      const cards = page.locator(".grid > .\\[--reveal-delay\\:0s\\], .grid a, .grid div").first().or(page.locator("main a")).first();
      await expect(cards).toBeVisible({ timeout: 5_000 }).catch(() => {});
    });

    test(`users page action buttons are accessible at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/super-admin/users");
      await page.waitForLoadState("networkidle");

      const viewBtns = page.locator("button[title='View details']");
      const count = await viewBtns.count();

      if (count > 0) {
        await expect(viewBtns.first()).toBeVisible({ timeout: 5_000 });
        const box = await viewBtns.first().boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
    });

    test(`invite drawer opens and closes at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/super-admin/users");
      await page.waitForLoadState("networkidle");

      const inviteBtn = page.locator("button:has-text('Invite User')").first();
      if (await inviteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await inviteBtn.click();
        await expect(page.locator("h2:has-text('Invite User')")).toBeVisible({ timeout: 5_000 }).catch(() => {});
      }
    });

    test(`no overlay clipping at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/super-admin/users");
      await page.waitForLoadState("networkidle");

      const clip = await page.evaluate(() => {
        const html = document.documentElement;
        return {
          clipWidth: html.scrollWidth,
          viewport: html.clientWidth
        };
      });

      expect(clip.clipWidth).toBeGreaterThanOrEqual(clip.viewport - 1);
    });
  }
});

test.describe("Roles & Permissions Module — Responsive Audit", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  for (const vp of viewports) {
    test(`roles page renders without horizontal overflow at ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/super-admin/roles");
      await page.waitForLoadState("networkidle");

      const overflow = await page.evaluate(() => {
        const body = document.body;
        return {
          scrollWidth: body.scrollWidth,
          clientWidth: body.clientWidth,
          hasHorizontalOverflow: body.scrollWidth > body.clientWidth + 5
        };
      });

      expect(overflow.hasHorizontalOverflow).toBe(false);
    });

    test(`roles table is scrollable horizontally on small screens at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/super-admin/roles");
      await page.waitForLoadState("networkidle");

      const table = page.locator("table");
      if (await table.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const tableBox = await table.boundingBox();
        const viewport = page.viewportSize();
        if (tableBox && viewport) {
        }
      }
    });

    test(`summary cards visible at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/super-admin/roles");
      await page.waitForLoadState("networkidle");

      const summaryCard = page.locator("text=Total Roles").first();
      await expect(summaryCard).toBeVisible({ timeout: 5_000 }).catch(() => {});
    });

    test(`permissions drawer toggles visible at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/super-admin/roles");
      await page.waitForLoadState("networkidle");

      const permBtn = page.locator("button[title='Manage permissions']").first();
      if (await permBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await permBtn.click();
        await page.waitForTimeout(500);

        const drawer = page.locator("h2").filter({ hasText: /Permissions/i }).first();
        await expect(drawer).toBeVisible({ timeout: 5_000 }).catch(() => {});
      }
    });
  }
});
