import {expect, openAProject, test} from '../fixtures.js';

// bugs/BUG_20260926_sweep-range-and-y-ranges-not-persisted.md: the sweep range is app-level
// state, so it survives a reload.

const freqRow = (page: import('@playwright/test').Page) =>
  page.locator('.opt-limits tr', { hasText: 'Frequency range' }).locator('input.opt-num');

test('the frequency range set in Options survives a reload', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.tb-btn[title="Options"]').click();
  await page.locator('.opt-tab', { hasText: 'Plot Window' }).click();
  await freqRow(page).nth(0).fill('3');
  await freqRow(page).nth(1).fill('4444');
  await page.locator('.opt-modal').getByRole('button', { name: 'OK' }).click();

  await page.reload();
  await page.locator('.tb-btn[title="Options"]').click();
  await page.locator('.opt-tab', { hasText: 'Plot Window' }).click();

  await expect(freqRow(page).nth(0)).toHaveValue('3');
  await expect(freqRow(page).nth(1)).toHaveValue('4444');
});
