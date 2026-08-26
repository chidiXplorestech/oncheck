import { test, expect } from '@playwright/test';

const CLOUD_KEYS = [
  'oncheck-state-v1',
  'oncheck-account-v2',
  'oncheck-daily-focus-v2',
  'oncheck-weekly-review-v2',
  'oncheck-training-space-v1',
  'oncheck-cover-map-v2',
  'oncheck-calendar-v2',
  'oncheck-strategy-start-v1',
];

test('unified sync registry is loaded and covers all account-owned browser stores', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.ontrackSync)).toBe('unified');

  const registered = await page.evaluate(() => (document.documentElement.dataset.cloudStateKeys ?? '').split(',').filter(Boolean));
  expect(registered).toEqual(CLOUD_KEYS);
});
