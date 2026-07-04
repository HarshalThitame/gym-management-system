import { expect, type Page, test } from "@playwright/test";

const password = process.env.E2E_AUTH_PASSWORD ?? "Extreme$00";
const email = process.env.E2E_ORGANIZATION_OWNER_EMAIL ?? "hthitame+qa.owner@gmail.com";

test.use({ screenshot: "on", serviceWorkers: "block", trace: "on" });

async function loginAs(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe("/organization");
}

test.describe("Organization Owner Equipment Drawer", () => {
  test("keeps focus while typing into the add equipment drawer", async ({ page }) => {
    test.setTimeout(90_000);

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
});
