import { test, expect } from '@playwright/test';

test('Plans is a searchable collection before editing a plan', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
    await page.evaluate(async () => { await document.fonts.ready; });
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
    await page.evaluate(async () => { await document.fonts.ready; });
  await page.locator('.sidebar [data-nav="calendar"]').click();
  await expect(page.locator('.ot-screen-bar')).toBeVisible();
  await expect(page.locator('.calendar-page')).toBeVisible();
  await expect(page.locator('.ot-calendar-scroll')).toHaveCSS('overflow-x', 'auto');
  await page.screenshot({ path: testInfo.outputPath('week-phone.png'), fullPage: true });
  await page.locator('.sidebar [data-nav="media"]').click();
  await expect(page.locator('.media-grid')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('vault-phone.png'), fullPage: true });
  await page.locator('.oncheck-system-nav').click();
  await expect(page.locator('.system-dialog')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('settings-phone.png') });
});

test('Training remains available from the redesigned plan collection', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.locator('[data-v3-all-plans]').click();
  await page.locator('[data-plan-card][data-id="training"]').click();
  await expect(page.locator('.training-space')).toBeVisible();
  await page.locator('.training-visual-banner').scrollIntoViewIfNeeded();
  await expect(page.locator('.training-visual-banner img')).toHaveJSProperty('complete', true);
  expect(await page.locator('.training-visual-banner img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.training-visual-banner img')).toHaveCSS('opacity', '1');
  await page.locator('.training-visual-banner img').evaluate((image: HTMLImageElement) => image.decode());
  await page.locator('.training-space').screenshot({ path: testInfo.outputPath('training-phone.png') });
  for (const day of ['wednesday', 'thursday']) {
    await page.locator(`[data-workout-day="${day}"]`).click();
    const image = page.locator('.training-visual-banner img');
    await expect(page.locator('.training-visual-banner')).toHaveAttribute('data-day', day);
    await image.evaluate((image: HTMLImageElement) => image.decode());
    await page.locator('.training-visual-banner').scrollIntoViewIfNeeded();
    await expect(image).toHaveCSS('opacity', '1');
    await page.locator('.training-visual-banner').screenshot({ path: testInfo.outputPath(`training-${day}.png`) });
  }
});
