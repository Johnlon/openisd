/**
 * The desktop Project tab's Created and Modified (John, 17 Oct 2026): shown as "16 Oct 2026" through the
 * one design formatter; the stored stamp stays WinISD's YYYYMMDD. The boxes write when the typist is
 * done (Enter or leaving the box), so a half-typed date that is already a real day ("2026-10-1") never
 * redraws the box under the keys.
 */
import {expect, openAProject, test} from '../fixtures.js';

const DAY = /^\d{1,2} [A-Z][a-z]{2} \d{4}$/;

test.beforeEach(async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', {hasText: 'Project'}).click();
});

const box = (page: import('@playwright/test').Page, label: 'Created' | 'Modified') =>
  page.locator('.field', {has: page.locator('label', {hasText: label})}).locator('input');

test('Created and Modified show as "16 Oct 2026"', async ({page}) => {
  await expect(box(page, 'Created')).toHaveValue(DAY);
  await expect(box(page, 'Modified')).toHaveValue(DAY);
});

for (const typed of ['2026-10-16', '16 Oct 2026']) {
  test(`typing "${typed}" key by key keeps the typed text, then shows "16 Oct 2026"`, async ({page}) => {
    const created = box(page, 'Created');
    await created.fill('');
    await created.pressSequentially(typed);
    await expect(created).toHaveValue(typed);
    await created.press('Enter');
    await expect(created).toHaveValue('16 Oct 2026');
  });
}

test('text that is not a date leaves the stored date as it was', async ({page}) => {
  const created = box(page, 'Created');
  const before = await created.inputValue();
  await created.fill('banana');
  await created.press('Enter');
  await page.locator('.project-nav li', {hasText: 'Box'}).click();
  await page.locator('.project-nav li', {hasText: 'Project'}).click();
  await expect(box(page, 'Created')).toHaveValue(before);
});
