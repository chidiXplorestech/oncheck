import { test, expect } from '@playwright/test';

test('Training artwork follows the existing Monday Wednesday Thursday structure', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('[data-action="edit-goal"][data-id="training"]').click();

  const banner = page.locator('.training-visual-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute('data-day', 'monday');
  await expect(banner.locator('img')).toHaveAttribute('src', /workouts\/monday-trunk\.webp$/);
  await expect(page.locator('.exercise-row')).toHaveCount(15);

  const bannerBox = await banner.boundingBox();
  expect(bannerBox).not.toBeNull();
  expect(bannerBox!.x).toBeGreaterThanOrEqual(0);
  expect(bannerBox!.x + bannerBox!.width).toBeLessThanOrEqual(390);

  await page.locator('[data-workout-day="wednesday"]').click();
  await expect(banner).toHaveAttribute('data-day', 'wednesday');
  await expect(banner.locator('img')).toHaveAttribute('src', /workouts\/wednesday-lower-body\.webp$/);
  await expect(page.locator('.exercise-row')).toHaveCount(8);

  await page.locator('[data-workout-day="thursday"]').click();
  await expect(banner).toHaveAttribute('data-day', 'thursday');
  await expect(banner.locator('img')).toHaveAttribute('src', /workouts\/thursday-arms\.webp$/);
  await expect(page.locator('.exercise-row')).toHaveCount(5);

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
});
