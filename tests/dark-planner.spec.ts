import { test, expect } from '@playwright/test';

const brief = `**Near-term plan**\n${Array.from({ length: 14 }, (_, i) => `${i + 1}. **Action ${i + 1}:** Check the date, budget and next step without losing the details.`).join('\n')}\n\n**Long-term plan**\n${Array.from({ length: 10 }, (_, i) => `${i + 1}. Goal ${i + 1}: Practise weekly towards 11 January 2027. Keep eligibility and deadlines in view.`).join('\n')}\n\n**Investment notes**\nMonthly contribution £50. Assumed growth 5%. Fees excluded.\n[Research](https://example.com/research)\n| Time | Contributions |\n| 12 months | £600 |\n\\[B=P\\times((1+r)^n-1)/r\\]\n\n**Weekly check-in**\nReview actions once a week and debt, savings and applications once a month.`;

test('long authored plans preview and save all actions and notes once', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const input = page.getByLabel('Describe your plan');
  await input.fill(brief);
  await expect(input).toHaveValue(brief);
  expect(brief.length).toBeGreaterThan(1200);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('oncheck-state-v1') || 'null') || (window as any).__ONTRACK_CORE_STATE__);
  await page.getByRole('button', { name: 'Plan it', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Plan preview' });
  await expect(preview).toBeVisible();
  await expect(preview.locator('[data-plan-preview-item]')).toHaveCount(4);
  await expect(preview).toContainText('14 actions');
  await expect(preview).toContainText('10 actions');
  await expect(preview).toContainText('Fees excluded');
  await expect(preview).toContainText('11 January 2027');
  await page.screenshot({ path: testInfo.outputPath('long-plan-preview.png') });
  await preview.locator('[data-v3-apply]').evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(preview).toHaveCount(0);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('oncheck-state-v1')!));
  expect(after.goals.length).toBe(before.goals.length + 4);
  expect(after.goals.find((goal: any) => goal.title === 'Near-term plan').tasks).toHaveLength(14);
  expect(after.goals.find((goal: any) => goal.title === 'Long-term plan').tasks).toHaveLength(10);
  expect(after.goals.find((goal: any) => goal.title === 'Investment notes').notes).toContain('https://example.com/research');
  expect(after.blocks).toEqual(before.blocks);
  await page.reload();
  await page.locator('.sidebar [data-nav="goals"]').click();
  await expect(page.locator('[data-plan-card]')).toHaveCount(before.goals.length + 4);
});

test('planner failure keeps draft editable and offers an explicit text import', async ({ page }) => {
  await page.goto('/');
  const draft = 'Learn Python, practise two hours each week and keep my portfolio work in mind.';
  await page.getByLabel('Describe your plan').fill(draft);
  await page.getByRole('button', { name: 'Plan it', exact: true }).click();
  await expect(page.locator('[data-v3-plan-status]')).toContainText('sign in again');
  await expect(page.locator('.ot-thinking-stage')).toHaveCount(0);
  await expect(page.getByLabel('Describe your plan')).toHaveValue(draft);
  await expect(page.getByRole('button', { name: 'Plan it', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Import my draft as written' }).click();
  await expect(page.locator('.ot-plan-dialog')).toContainText('without AI changes');
  await expect(page.locator('.ot-source-notes')).toContainText(draft);
  await page.getByRole('button', { name: 'Back to draft' }).click();
  await expect(page.getByLabel('Describe your plan')).toHaveValue(draft);
});

test('dark texture stays behind controls and GSAP reveals headings and images', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'gsap');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(23, 24, 23)');
  await expect(page.locator('.ot-film')).toHaveCSS('pointer-events', 'none');
  await expect(page.locator('.ot-home')).toHaveAttribute('data-motion-view', 'entered');
  await expect(page.locator('.ot-life-heading h1')).toHaveCSS('opacity', '1');
  await expect(page.locator('.nav-btn.active')).toHaveCSS('color', 'rgb(32, 34, 26)');
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: testInfo.outputPath('dark-desktop.png'), fullPage: true });
  await page.locator('[data-v3-all-plans]').click();
  await page.locator('[data-plan-card][data-id="training"]').click();
  await page.locator('.training-visual-banner').scrollIntoViewIfNeeded();
  await expect(page.locator('.training-visual-banner img')).toHaveAttribute('data-motion-image', 'revealed');
  await expect(page.locator('.training-visual-banner img')).toHaveCSS('opacity', '1');
});

test('reduced motion keeps text images and textured controls immediately usable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await expect(page.locator('.ot-life-heading h1')).toHaveCSS('transform', 'none');
  await expect(page.locator('.ot-dust')).toHaveCSS('transform', 'none');
  await page.getByRole('button', { name: 'Quick tour' }).click();
  await expect(page.locator('.ot-tour-dialog')).toBeVisible();
  await expect(page.locator('.ot-apply')).toHaveCSS('color', 'rgb(32, 34, 26)');
  await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.screenshot({ path: testInfo.outputPath('dark-phone.png'), fullPage: true });
});
