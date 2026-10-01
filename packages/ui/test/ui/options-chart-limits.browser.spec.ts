import {expect, openAProject, test} from '../fixtures.js';

// bugs/BUG_20261001_options-chart-y-limit-partial-edit-silently-drops: editing only ONE of a
// chart row's Start/End (the other showing its placeholder default) saved an override with a
// NaN half, which GraphPanel's view contract (`isFinite(min) && isFinite(max) && min < max`)
// silently ignores — the chart kept auto-scaling and nothing said why. The fix: at commit the
// dialog fills an untouched half from the row's own placeholder default, so a one-sided edit
// yields a complete, ordered override.
//
// bugs/BUG_20261001_options-frequency-range-unvalidated-empty-inverted: the "Frequency range"
// row had no effective validation — a cleared Start saved the empty string into the sweep
// range (breaking every chart's log frequency axis, persisting across reload) and an inverted
// pair saved as-is. The fix: OK refuses both, with the same error treatment the vented band
// gets.

const splRow = (page: import('@playwright/test').Page) =>
  page.locator('.opt-limits tr', { hasText: /^SPL/ }).locator('input.opt-num');

const okButton = (page: import('@playwright/test').Page) =>
  page.locator('.opt-modal').getByRole('button', { name: 'OK' });

test('editing only a chart row End applies it against the row placeholder Start', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.tb-btn[title="Options"]').click();
  await page.locator('.opt-tab', { hasText: 'Plot Window' }).click();

  // SPL's row placeholder Start is 40 (LIMIT_ROWS). Touch ONLY the End.
  await splRow(page).nth(1).fill('100');
  await splRow(page).nth(1).dispatchEvent('change');
  await okButton(page).click();

  await page.reload();
  await page.locator('.tb-btn[title="Options"]').click();
  await page.locator('.opt-tab', { hasText: 'Plot Window' }).click();

  // Before the fix: Start persisted as empty/NaN — the chart ignored the whole override.
  await expect(splRow(page).nth(0)).toHaveValue('40');
  await expect(splRow(page).nth(1)).toHaveValue('100');
});

test('OK refuses a cleared frequency-range field and keeps the dialog open with the error', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.tb-btn[title="Options"]').click();
  await page.locator('.opt-tab', { hasText: 'Plot Window' }).click();

  const freqRow = page.locator('.opt-limits tr', { hasText: 'Frequency range' }).locator('input.opt-num');
  await freqRow.nth(0).fill('');
  await freqRow.nth(0).dispatchEvent('change');

  await expect(okButton(page)).toBeDisabled();
  await expect(page.getByTestId('settings-error')).toBeVisible();

  // The dialog stays open — nothing is written behind the user's back.
  await expect(page.locator('.opt-modal')).toBeVisible();
});

test('OK refuses an inverted frequency range', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.tb-btn[title="Options"]').click();
  await page.locator('.opt-tab', { hasText: 'Plot Window' }).click();

  const freqRow = page.locator('.opt-limits tr', { hasText: 'Frequency range' }).locator('input.opt-num');
  await freqRow.nth(0).fill('30000');
  await freqRow.nth(0).dispatchEvent('change');
  await freqRow.nth(1).fill('20');
  await freqRow.nth(1).dispatchEvent('change');

  await expect(okButton(page)).toBeDisabled();
  await expect(page.getByTestId('settings-error')).toBeVisible();
});
