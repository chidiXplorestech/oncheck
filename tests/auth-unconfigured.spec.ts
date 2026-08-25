import { test, expect } from '@playwright/test';

test('ONCHECK remains usable when Supabase environment variables are not configured', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.auth-root')).toHaveCount(0);
  await expect(page.locator('.shell')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-supabase', 'unconfigured');
});
