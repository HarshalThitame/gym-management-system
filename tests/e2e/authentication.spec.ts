import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/(admin|member)/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('text=Invalid email or password')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Logout
    await page.click('button:has-text("Logout")');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });

  test('should protect admin routes', async ({ page }) => {
    await page.goto('/admin');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Two-Factor Authentication', () => {
  test('should require 2FA code after login', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', '2fa-user@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Should redirect to 2FA verification
    await expect(page).toHaveURL('/verify-2fa');
  });

  test('should verify valid 2FA code', async ({ page }) => {
    await page.goto('/verify-2fa');
    
    await page.fill('input[name="code"]', '123456');
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/(admin|member)/);
  });

  test('should reject invalid 2FA code', async ({ page }) => {
    await page.goto('/verify-2fa');
    
    await page.fill('input[name="code"]', '000000');
    await page.click('button[type="submit"]');
    
    // Should show error
    await expect(page.locator('text=Invalid code')).toBeVisible();
  });
});
