import { expect, test } from '@playwright/test';

test('calendar enhancement module boots without browser errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.oncheckCalendarImport ?? 'missing')).toBe('ready');

  const diagnostics = await page.evaluate(() => ({
    layers: document.documentElement.dataset.oncheckLayers ?? 'missing',
    calendar: document.documentElement.dataset.oncheckCalendarImport ?? 'missing',
    calendarError: document.documentElement.dataset.oncheckCalendarError ?? '',
  }));

  expect(diagnostics).toEqual({ layers: 'ready', calendar: 'ready', calendarError: '' });
  expect(pageErrors).toEqual([]);

  await page.locator('[data-nav="calendar"]').click();
  await expect(page.locator('.calendar-strategy-meta')).toBeVisible();
});
