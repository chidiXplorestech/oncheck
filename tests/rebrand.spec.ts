import { test, expect } from '@playwright/test';

test('Plans is a searchable collection before editing a plan', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.sidebar [data-nav="goals"]').click();
  await expect(page.locator('.ot-plans-page')).toBeVisible();
  await expect(page.locator('#goalForm')).toHaveCount(0);
  await expect(page.locator('[data-plan-card]')).toHaveCount(9);
  await page.getByLabel('Search plans').fill('Coding');
  await expect(page.locator('[data-plan-card]:visible')).toHaveCount(1);
  await page.getByLabel('Search plans').fill('');
  await page.locator('[data-plan-filter="completed"]').click();
  await expect(page.locator('[data-plan-card]:visible')).toHaveCount(0);
  await expect(page.locator('.ot-no-matches')).toBeVisible();
  await page.locator('[data-plan-filter="all"]').click();
  await page.screenshot({ path: testInfo.outputPath('plans-phone.png'), fullPage: true });
  await page.locator('[data-plan-card]').first().click();
  await expect(page.locator('#goalForm')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('editor-phone.png'), fullPage: true });
});

test('Week Vault and Settings keep the same identity on phone', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.sidebar [data-nav="calendar"]').click();
  await expect(page.locator('.ot-screen-bar')).toBeVisible();
  await expect(page.locator('.calendar-page')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('week-phone.png'), fullPage: true });
  await page.locator('.sidebar [data-nav="media"]').click();
  await expect(page.locator('.media-grid')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('vault-phone.png'), fullPage: true });
  await page.locator('.oncheck-system-nav').click();
  await expect(page.locator('.system-dialog')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('settings-phone.png') });
});
