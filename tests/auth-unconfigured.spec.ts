import { test, expect } from '@playwright/test';

test('ONTRACK CI build bypasses the auth gate only for UI regression coverage', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.auth-root')).toHaveCount(0);
  await expect(page.locator('.shell')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-auth-bypass', 'e2e');
  await expect(page).toHaveTitle('ONTRACK');
});
