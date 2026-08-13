import { expect, test } from '@playwright/test';

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
  test(`${viewport.name} uses a responsive 1:1 goal cover capped at 512px`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await expectSquareCover(page, '.goal-row > .cover');

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
}

test('mobile goal editor preview uses the same responsive square contract', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('[data-action="edit-goal"]').first().click();
  await expectSquareCover(page, '.preview-cover');
});

test('desktop goal cover dimensions remain owned by the desktop design', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const box = await page.locator('.goal-row > .cover').first().boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box!.width - box!.height)).toBeGreaterThan(1.5);
});
