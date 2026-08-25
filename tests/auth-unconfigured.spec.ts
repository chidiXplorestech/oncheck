import { test, expect } from '@playwright/test';

test('ONTRACK presents the account gate when no session exists', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.auth-root')).toBeVisible();
  await expect(page.locator('.auth-brand')).toHaveText('ONTRACK');
  await expect(page.getByRole('button', { name: 'LOG IN' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  await expect(page).toHaveTitle('ONTRACK');
});
