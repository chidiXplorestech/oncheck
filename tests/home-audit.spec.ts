import { test, expect } from '@playwright/test';

test('focus edits refresh Today without losing a planning draft', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Describe your plan').fill('Keep this draft');
  await page.locator('[data-system-focus]').click();
  await page.locator('[data-focus-new]').fill('Audit regression priority');
  await page.locator('[data-focus-add]').click();
  await page.locator('[data-focus-done]').click();
  const priority = page.locator('[data-v3-focus-toggle]').filter({ hasText: 'Audit regression priority' });
  await expect(priority).toBeVisible();
  await expect(page.getByLabel('Describe your plan')).toHaveValue('Keep this draft');
  await priority.click();
  await expect(priority).toHaveAttribute('aria-pressed', 'true');
  await expect(priority).toBeFocused();
  await expect(page.getByLabel('Describe your plan')).toHaveValue('Keep this draft');
});

test('All plans lets an empty account create its first plan', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oncheck-state-v1', JSON.stringify({ goals: [], blocks: [], media: [] })));
  await page.goto('/');
  await page.locator('[data-v3-all-plans]').click();
  await page.getByRole('button', { name: 'Create your first plan' }).click();
  await expect(page.locator('dialog.modal')).toBeVisible();
  await page.getByLabel('Goal title').fill('First plan');
  await page.getByRole('button', { name: 'Save Goal', exact: true }).click();
  await expect(page.locator('dialog.modal')).toHaveCount(0);
  await page.locator('.sidebar [data-nav="overview"]').click();
  await expect(page.locator('.ot-priority-row')).toContainText('First plan');
});
