import { expect, test } from '@playwright/test';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=',
  'base64',
);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
});

test('mobile Add Media opens the native picker and persists the upload after reload', async ({ page }) => {
  await page.locator('[data-nav="media"]').click();

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Add Media/i }).first().click();
  const chooser = await chooserPromise;

  await expect(page.locator('.oncheck-native-media-input')).toHaveCount(1);
  const reloadPromise = page.waitForEvent('load');
  await chooser.setFiles({
    name: 'mobile-photo.png',
    mimeType: 'image/png',
    buffer: onePixelPng,
  });
  await reloadPromise;

  await page.locator('[data-nav="media"]').click();
  await expect(page.locator('.db-media-item')).toHaveCount(1);
  await expect(page.locator('.db-media-meta')).toContainText('mobile-photo.png');
});

test('mobile Change cover can use an existing uploaded image', async ({ page }) => {
  await page.locator('[data-nav="media"]').click();

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Add Media/i }).first().click();
  const chooser = await chooserPromise;
  const firstReload = page.waitForEvent('load');
  await chooser.setFiles({
    name: 'goal-cover.png',
    mimeType: 'image/png',
    buffer: onePixelPng,
  });
  await firstReload;

  await page.locator('[data-nav="overview"]').click();
  await page.locator('[data-action="edit-goal"]').first().click();
  await page.locator('[data-action="goal-cover"]').click();

  await expect(page.locator('.mobile-media-sheet')).toBeVisible();
  await expect(page.locator('[data-mobile-cover-id]')).toHaveCount(1);

  const secondReload = page.waitForEvent('load');
  await page.locator('[data-mobile-cover-id]').first().click();
  await secondReload;

  await page.locator('[data-nav="overview"]').click();
  await page.locator('[data-action="edit-goal"]').first().click();
  await expect(page.locator('.preview-cover img[data-db-cover]')).toBeVisible();
});
