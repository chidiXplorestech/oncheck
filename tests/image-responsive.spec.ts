import { test, expect, type Page, type Locator } from '@playwright/test';

function artwork(width: number, height: number, label: string) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#30372c"/><rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none" stroke="#f2d44b" stroke-width="8"/><text x="20" y="50" font-size="28" fill="#eeeade">${label}</text><circle cx="${width - 24}" cy="${height - 24}" r="12" fill="#f2d44b"/></svg>`);
}
const fixtures = [
  { name: 'portrait-reference-with-a-long-filename-for-metadata-layout.svg', mimeType: 'image/svg+xml', buffer: artwork(300, 1200, 'PORTRAIT') },
  { name: 'landscape-reference.svg', mimeType: 'image/svg+xml', buffer: artwork(1200, 900, 'LANDSCAPE') },
  { name: 'panoramic-reference.svg', mimeType: 'image/svg+xml', buffer: artwork(1800, 300, 'PANORAMA') },
];

async function noPageOverflow(page: Page) {
  const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
}

async function imageInsideFrame(image: Locator, frame: Locator, viewportWidth: number) {
  await image.scrollIntoViewIfNeeded();
  await image.evaluate((node: HTMLImageElement) => node.decode());
  const [picture, container] = await Promise.all([image.boundingBox(), frame.boundingBox()]);
  expect(picture).not.toBeNull();
  expect(container).not.toBeNull();
  expect(container!.x).toBeGreaterThanOrEqual(-1);
  expect(container!.x + container!.width).toBeLessThanOrEqual(viewportWidth + 1);
  expect(picture!.x).toBeGreaterThanOrEqual(container!.x - 1);
  expect(picture!.x + picture!.width).toBeLessThanOrEqual(container!.x + container!.width + 1);
  expect(picture!.y).toBeGreaterThanOrEqual(container!.y - 1);
  expect(picture!.y + picture!.height).toBeLessThanOrEqual(container!.y + container!.height + 1);
}

for (const viewport of [
  { width: 320, height: 700 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 901, height: 700 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 2560, height: 1440 },
]) {
  test(`images and pickers fit at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.locator('.sidebar [data-nav="media"]').click();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /Add Media/i }).first().click();
    const chooser = await chooserPromise;
    const reload = viewport.width <= 900 ? page.waitForEvent('load') : Promise.resolve();
    await chooser.setFiles(fixtures);
    await reload;
    await page.locator('.sidebar [data-nav="media"]').click();
    await expect(page.locator('.db-media-item')).toHaveCount(3);
    for (const card of await page.locator('.db-media-item').all()) {
      const image = card.locator('img');
      await imageInsideFrame(image, card, viewport.width);
      await expect(image).toHaveCSS('object-fit', 'contain');
      const picture = await image.boundingBox();
      const metadata = await card.locator('.db-media-meta').boundingBox();
      expect(metadata!.y).toBeGreaterThanOrEqual(picture!.y + picture!.height - 1);
      const deleteButton = await card.locator('.db-media-delete').boundingBox();
      expect(deleteButton!.height).toBeGreaterThanOrEqual(44);
      const cardBox = await card.boundingBox();
      expect(deleteButton!.x + deleteButton!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1);
    }
    await noPageOverflow(page);
    await expect(page.locator('.mobile-media-toast,.media-toast')).toHaveCount(0);
    await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
    await page.screenshot({ path: testInfo.outputPath(`vault-${viewport.width}.png`), fullPage: true });

    await page.locator('.sidebar [data-nav="goals"]').click();
    await page.locator('[data-plan-card][data-id="academics"]').click();
    await page.locator('[data-action="goal-cover"]').click();
    const picker = page.locator('.mobile-media-panel,.media-picker-modal');
    await expect(picker).toBeVisible();
    const pickerBox = await picker.boundingBox();
    expect(pickerBox!.width).toBeLessThanOrEqual(viewport.width);
    expect(pickerBox!.height).toBeLessThanOrEqual(viewport.height);
    const options = page.locator('.mobile-media-option,.media-picker-option');
    await expect(options).toHaveCount(3);
    await imageInsideFrame(options.first().locator('img'), options.first(), viewport.width);
    const pickerImage = await options.first().locator('img').boundingBox();
    expect(pickerImage!.height).toBeLessThanOrEqual(Math.min(180, viewport.height * .35) + 1);
    const name = await options.first().locator('span').boundingBox();
    expect(name!.y).toBeGreaterThanOrEqual(0);
    expect(name!.y + name!.height).toBeLessThanOrEqual(viewport.height);
    if (viewport.width === 844) {
      const close = await page.locator('.mobile-media-close').boundingBox();
      expect(close!.y).toBeGreaterThanOrEqual(pickerBox!.y);
      expect(close!.y + close!.height).toBeLessThanOrEqual(viewport.height);
    }
    await page.screenshot({ path: testInfo.outputPath(`picker-${viewport.width}.png`) });
    const coverReload = viewport.width <= 900 ? page.waitForEvent('load') : Promise.resolve();
    await options.first().click();
    await coverReload;
    if (viewport.width <= 900) {
      await page.locator('.sidebar [data-nav="goals"]').click();
      await page.locator('[data-plan-card][data-id="academics"]').click();
    }
    const cover = page.locator('.preview-cover');
    const image = cover.locator('img[data-db-cover]');
    await imageInsideFrame(image, cover, viewport.width);
    const stableImage = await image.elementHandle();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(await stableImage!.evaluate(node => node.isConnected)).toBe(true);
    const coverBox = await cover.boundingBox();
    const ratio = viewport.width <= 900 ? 1 : 4 / 3;
    expect(Math.abs(coverBox!.width / coverBox!.height - ratio)).toBeLessThan(.02);
    await noPageOverflow(page);
    await expect(page.locator('.mobile-media-toast,.media-toast')).toHaveCount(0);

    await page.locator('.sidebar [data-nav="goals"]').click();
    await page.locator('[data-plan-card][data-id="training"]').click();
    const banner = page.locator('.training-visual-banner');
    await imageInsideFrame(banner.locator('img'), banner, viewport.width);
    await expect(banner.locator('img')).toHaveCSS('object-fit', 'contain');
    const bannerBox = await banner.boundingBox();
    const caption = await page.locator('.training-visual-copy').boundingBox();
    expect(bannerBox!.height).toBeLessThanOrEqual(viewport.height * .6 + 1);
    expect(caption!.y).toBeGreaterThanOrEqual(bannerBox!.y);
    expect(caption!.y + caption!.height).toBeLessThanOrEqual(bannerBox!.y + bannerBox!.height);
    expect(caption!.x + caption!.width).toBeLessThanOrEqual(bannerBox!.x + bannerBox!.width);
    await noPageOverflow(page);
    await banner.evaluate(node => node.scrollIntoView({ block: 'start' }));
    const visibleBanner = await banner.boundingBox();
    if (viewport.width <= 900) {
      const dock = await page.locator('.sidebar').boundingBox();
      expect(visibleBanner!.y + visibleBanner!.height).toBeLessThanOrEqual(dock!.y);
    }
    await banner.screenshot({ path: testInfo.outputPath(`workout-${viewport.width}.png`) });
  });
}
