import { expect, test } from '@playwright/test';

for (const width of [320, 390, 430]) {
  test(`${width}px goal editor keeps nav, checklist and actions responsive`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.locator('[data-action="edit-goal"]').first().click();

    const viewport = page.viewportSize()!;
    const sidebar = await page.locator('.sidebar').boundingBox();
    expect(sidebar).not.toBeNull();
    expect(sidebar!.y).toBeGreaterThan(viewport.height - 110);
    expect(sidebar!.x).toBeGreaterThanOrEqual(0);
    expect(sidebar!.x + sidebar!.width).toBeLessThanOrEqual(viewport.width);

    const section = page.locator('.editor-section');
    const sectionBox = await section.boundingBox();
    expect(sectionBox).not.toBeNull();
    expect(sectionBox!.x).toBeGreaterThanOrEqual(0);
    expect(sectionBox!.x + sectionBox!.width).toBeLessThanOrEqual(viewport.width);

    const addItem = page.locator('[data-action="add-task"]');
    const addBox = await addItem.boundingBox();
    expect(addBox).not.toBeNull();
    expect(addBox!.x).toBeGreaterThanOrEqual(sectionBox!.x);
    expect(addBox!.x + addBox!.width).toBeLessThanOrEqual(sectionBox!.x + sectionBox!.width + 1);

    const checkBox = await page.locator('.mini-check').first().boundingBox();
    expect(checkBox).not.toBeNull();
    expect(Math.abs(checkBox!.width - checkBox!.height)).toBeLessThanOrEqual(1);
    expect(checkBox!.width).toBeGreaterThanOrEqual(40);

    const rowBox = await page.locator('.task-row').first().boundingBox();
    expect(rowBox).not.toBeNull();
    expect(rowBox!.x).toBeGreaterThanOrEqual(sectionBox!.x);
    expect(rowBox!.x + rowBox!.width).toBeLessThanOrEqual(sectionBox!.x + sectionBox!.width + 1);

    const titleInput = page.locator('.task-row input[data-task-title]').first();
    const titleBox = await titleInput.boundingBox();
    expect(titleBox).not.toBeNull();
    expect(titleBox!.width).toBeGreaterThan(80);

    const saveBox = await page.getByRole('button', { name: 'Save Changes' }).boundingBox();
    expect(saveBox).not.toBeNull();
    expect(saveBox!.x).toBeGreaterThanOrEqual(0);
    expect(saveBox!.x + saveBox!.width).toBeLessThanOrEqual(viewport.width);

    const sizes = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1);
  });
}
