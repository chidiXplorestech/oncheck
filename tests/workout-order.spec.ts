import { test, expect } from '@playwright/test';

async function openTraining(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.locator('[data-action="edit-goal"][data-id="training"]').click();
  await expect(page.locator('.training-space')).toBeVisible();
}

async function groupLabels(page: import('@playwright/test').Page) {
  return page.locator('.exercise-group-label span').allTextContents();
}

async function exerciseNames(page: import('@playwright/test').Page) {
  return page.locator('.exercise-row .exercise-copy strong').allTextContents();
}

test('Monday flows neck chest back shoulders traps then core', async ({ page }) => {
  await openTraining(page);
  await expect.poll(() => groupLabels(page)).toEqual(['NECK', 'CHEST', 'BACK', 'SHOULDERS + TRAPS', 'CORE']);
  await expect.poll(() => exerciseNames(page)).toEqual([
    'Weighted neck flexion',
    'Lateral neck flexion — left',
    'Lateral neck flexion — right',
    'Barbell bench press',
    'Dips',
    'Dumbbell squeeze press',
    'Push-ups',
    'Pull-up variations',
    'Barbell rows',
    'Seated rows',
    'Lateral raises',
    'Front raises',
    'Heavy shrugs',
    'Weighted plate core flow',
    'Full-range core raise',
  ]);
});

test('Wednesday flows hamstrings squats and lunges thigh isolation then calves', async ({ page }) => {
  await openTraining(page);
  await page.locator('[data-workout-day="wednesday"]').click();
  await expect.poll(() => groupLabels(page)).toEqual(['HAMSTRINGS', 'LEGS', 'THIGHS', 'CALVES']);
  await expect.poll(() => exerciseNames(page)).toEqual([
    'Hamstring curls',
    'Heavy dumbbell squat',
    'Wide-stance dumbbell squat',
    'Walking forward lunges',
    'Reverse walking lunges',
    'Leg extensions — standard',
    'Leg extensions — reverse variation',
    'Calf raises',
  ]);
});

test('Thursday keeps biceps triceps and forearms together', async ({ page }) => {
  await openTraining(page);
  await page.locator('[data-workout-day="thursday"]').click();
  await expect.poll(() => groupLabels(page)).toEqual(['BICEPS', 'TRICEPS', 'FOREARMS']);
  await expect.poll(() => exerciseNames(page)).toEqual([
    'Barbell curl',
    'Preacher curl',
    'Triceps pushdown',
    'Skull crushers',
    'Kettlebell + band wrist roller',
  ]);
});
