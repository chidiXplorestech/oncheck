import { expect, test } from '@playwright/test';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZrX8AAAAASUVORK5CYII=',
  'base64',
);

test('desktop keeps the original ONCHECK composition', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const sidebar = page.locator('.sidebar');
  const sidebarBox = await sidebar.boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect(sidebarBox!.x).toBe(0);
  expect(sidebarBox!.width).toBeGreaterThanOrEqual(210);
  expect(sidebarBox!.width).toBeLessThanOrEqual(230);
  await expect(sidebar).not.toHaveCSS('position', 'fixed');

  const heroBox = await page.locator('.hero').boundingBox();
  expect(heroBox).not.toBeNull();
  expect(heroBox!.height).toBeGreaterThanOrEqual(245);
  expect(heroBox!.height).toBeLessThanOrEqual(255);

  await expect(page.locator('.sidebar .nav-btn:visible')).toHaveCount(4);
  await expect(page.locator('.oncheck-system-nav')).toBeHidden();
});

test('Save Changes persists a goal through navigation and reload', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-action="edit-goal"][data-id="academics"]').click();
  await page.locator('#goalForm input[name="title"]').fill('Academics — saved test');
  await page.locator('#goalForm textarea[name="notes"]').fill('This note must persist after a reload.');
  await page.locator('#goalForm button[type="submit"]').click();

  await expect(page.locator('.preview-card h2')).toHaveText('Academics — saved test');
  await page.locator('[data-nav="overview"]').first().click();
  await expect(page.locator('.goal-row').filter({ hasText: 'Academics — saved test' })).toHaveCount(1);

  await page.reload();
  await expect(page.locator('.goal-row').filter({ hasText: 'Academics — saved test' })).toHaveCount(1);
});

test('unsaved goal fields survive checklist actions', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-action="edit-goal"][data-id="academics"]').click();
  await page.locator('#goalForm input[name="title"]').fill('Academics — keep this edit');
  await page.locator('[data-action="add-task"][data-id="academics"]').click();

  await expect(page.locator('#goalForm input[name="title"]')).toHaveValue('Academics — keep this edit');
  await expect(page.locator('.task-row')).toHaveCount(4);
});

test('Account Settings saves and updates the existing profile and greeting', async ({ page }) => {
  await page.goto('/');
  await page.locator('.profile').click();
  await expect(page.locator('.system-dialog')).toBeVisible();

  await page.getByLabel('Display name').fill('Chidi');
  await page.getByLabel('Role / label').fill('ONCHECK');
  await page.getByRole('button', { name: 'Save Account' }).click();
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page.locator('.profile strong')).toHaveText('Chidi');
  await expect(page.locator('.profile span')).toHaveText('ONCHECK');
  await expect(page.locator('.hero-copy h1')).toContainText('Chidi');

  await page.reload();
  await expect(page.locator('.profile strong')).toHaveText('Chidi');
});

test('Today Focus is functional without adding a new dashboard card', async ({ page }) => {
  await page.goto('/');
  await page.locator('.focus-card').click();
  await expect(page.locator('.focus-dialog')).toBeVisible();
  await page.locator('[data-focus-new]').fill('Finish the next concrete task');
  await page.locator('[data-focus-add]').click();
  await expect(page.locator('.focus-row')).toHaveCount(1);
  await page.locator('.focus-check').click();
  await expect(page.locator('.focus-row')).toHaveClass(/done/);
});

test('320px portrait has no page-level horizontal overflow and Settings remains reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

  await expect(page.locator('.sidebar .nav-btn:visible')).toHaveCount(5);
  const goalBox = await page.locator('.goal-row').first().boundingBox();
  expect(goalBox).not.toBeNull();
  expect(goalBox!.x).toBeGreaterThanOrEqual(0);
  expect(goalBox!.x + goalBox!.width).toBeLessThanOrEqual(320);

  await page.locator('.oncheck-system-nav').click();
  const dialogBox = await page.locator('.system-dialog').boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.width).toBeLessThanOrEqual(320);
});

test('phone landscape uses the compact side dock and does not overflow the page', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');

  const sidebarBox = await page.locator('.sidebar').boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect(sidebarBox!.x).toBeLessThanOrEqual(10);
  expect(sidebarBox!.width).toBeLessThanOrEqual(66);
  expect(sidebarBox!.height).toBeGreaterThan(350);

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
});

test('Media accepts multiple uploads in one action and renders them from IndexedDB', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-nav="media"]').click();

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Add Media/i }).first().click();
  const chooser = await chooserPromise;
  await chooser.setFiles([
    { name: 'one.png', mimeType: 'image/png', buffer: onePixelPng },
    { name: 'two.png', mimeType: 'image/png', buffer: onePixelPng },
    { name: 'three.png', mimeType: 'image/png', buffer: onePixelPng },
  ]);

  await expect(page.locator('.db-media-item')).toHaveCount(3);
});

test('Training remains interactive and contained at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await page.locator('[data-action="edit-goal"][data-id="training"]').click();
  await expect(page.locator('.training-space')).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

  const firstExercise = page.locator('.exercise-row').first();
  await firstExercise.locator('.workout-check').click();
  await expect(firstExercise).toHaveClass(/done/);
});
