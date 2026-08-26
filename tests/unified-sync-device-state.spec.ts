import { test, expect } from '@playwright/test';

test('device-only state is not part of the unified cloud registry', async ({ page }) => {
  await page.goto('/');
  const registered = await page.evaluate(() => document.documentElement.dataset.cloudStateKeys ?? '');
  expect(registered).not.toContain('ontrack-cloud-owner-v1');
  expect(registered).not.toContain('ontrack-account-hydrated-v1');
  expect(registered).not.toContain('ontrack-media-remote-index-v2');
  expect(registered).not.toContain('oncheck-media-migrated-v2');
});
