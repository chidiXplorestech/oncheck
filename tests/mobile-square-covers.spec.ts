import { expect, test } from '@playwright/test';

async function openFirstGoal(page: import('@playwright/test').Page) {
  await page.locator('[data-v3-all-plans]').click();
  await page.locator('.ot-plans-page [data-action="edit-goal"]').first().click();
}

async function expectSquareCover(page: import('@playwright/test').Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box!.width - box!.height)).toBeLessThanOrEqual(1.5);
  expect(box!.width).toBeLessThanOrEqual(512.5);
}

for (const viewport of [
  { name: '320px phone', width: 320, height: 700 },
  { name: '390px iPhone', width: 390, height: 844 },
  { name: '768px tablet', width: 768, height: 1024 },
]) {
  test(`${viewport.name} keeps the redesigned home within the viewport`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    const home = await page.locator('.ot-home').boundingBox();
    expect(home).not.toBeNull();
    expect(home!.x).toBeGreaterThanOrEqual(0);
    expect(home!.x + home!.width).toBeLessThanOrEqual(viewport.width + 1);

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
}

test('mobile goal editor preview keeps the existing square cover contract', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await openFirstGoal(page);
  await expectSquareCover(page, '.preview-cover');
});

test('desktop goal editor remains accessible from the focused plans navigator', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await openFirstGoal(page);
  await expect(page.locator('#goalForm')).toBeVisible();
  await expect(page.locator('.preview-cover')).toBeVisible();
});
