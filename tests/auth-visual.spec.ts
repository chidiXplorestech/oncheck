import { test, expect } from '@playwright/test';

test.skip(!process.env.ONTRACK_AUTH_VISUAL, 'Runs after a production build without the E2E auth bypass.');

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }, { width: 844, height: 390 }]) {
  test(`account entry retains its auth gate at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.auth-root')).toBeVisible();
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-auth-bypass');
    await page.screenshot({ path: testInfo.outputPath(`account-${viewport.width}.png`), fullPage: true });
    await page.locator('[data-auth-mode="signup"]').click();
    await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
    await page.locator('.auth-primary').scrollIntoViewIfNeeded();
    const action = await page.locator('.auth-primary').boundingBox();
    expect(action!.y).toBeGreaterThanOrEqual(0);
    expect(action!.y + action!.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({ path: testInfo.outputPath(`signup-${viewport.width}.png`) });
  });
}
