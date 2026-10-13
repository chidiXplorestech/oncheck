import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`daily actions come first at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const today = await page.locator('.ot-today').boundingBox();
    const planner = await page.locator('.ot-intro').boundingBox();
    expect(today).not.toBeNull();
    expect(planner).not.toBeNull();
    expect(today!.y).toBeLessThan(360);
    expect(today!.y + today!.height).toBeLessThan(planner!.y);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('A little progress.');
    await expect(page.locator('.ot-shortcuts')).not.toHaveAttribute('open');
    const navigation = await page.locator('.sidebar .nav-btn').first().boundingBox();
    expect(navigation!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: testInfo.outputPath(`home-${viewport.width}.png`), fullPage: true });
  });
}

test('quick tour can be completed or skipped without changing plans', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const before = await page.locator('.ot-priority-row').allTextContents();
  await page.getByRole('button', { name: 'Quick tour' }).click();
  await expect(page.getByRole('dialog', { name: 'How ONTRACK works' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('tour-phone.png'), fullPage: true });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Start my day' }).click();
  await expect(page.locator('.ot-tour-dialog')).toHaveCount(0);
  expect(await page.locator('.ot-priority-row').allTextContents()).toEqual(before);
  await page.getByRole('button', { name: 'Quick tour' }).click();
  await page.getByRole('button', { name: 'Skip tour' }).click();
  await expect(page.locator('.ot-tour-dialog')).toHaveCount(0);
});
