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

const splRow = (page: import('@playwright/test').Page) =>
  page.locator('.opt-limits tr', { hasText: /^SPL/ }).locator('input.opt-num');

test('a chart Y range set in Options survives a reload', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.tb-btn[title="Options"]').click();
  await page.locator('.opt-tab', { hasText: 'Plot Window' }).click();
  await splRow(page).nth(0).fill('11');
  await splRow(page).nth(0).dispatchEvent('change');
  await splRow(page).nth(1).fill('111');
  await splRow(page).nth(1).dispatchEvent('change');
  await page.locator('.opt-modal').getByRole('button', { name: 'OK' }).click();

  await page.reload();
  await page.locator('.tb-btn[title="Options"]').click();
  await page.locator('.opt-tab', { hasText: 'Plot Window' }).click();

  await expect(splRow(page).nth(0)).toHaveValue('11');
  await expect(splRow(page).nth(1)).toHaveValue('111');
});

test('the trace colour chosen with the Color button survives a reload (saved in the project)', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  const colorBtn = page.locator('.chart-color-btn');
  const before = await colorBtn.evaluate(el => getComputedStyle(el).backgroundColor);
  await colorBtn.click();
  await expect.poll(() => colorBtn.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(before);
  const chosen = await colorBtn.evaluate(el => getComputedStyle(el).backgroundColor);

  await page.reload();

  await expect.poll(() => page.locator('.chart-color-btn').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(chosen);
});

// John, 2026-10-01: a drag-zoomed range (stored as e.g. 13.478123 Hz) showed in Options to every
// digit. The dialog shows it at the field's precision.
test('Options shows a drag-zoomed frequency range at one decimal', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.evaluate(async (p) => {
    type PS = typeof import('../../src/logic/presentationState.js');
    function isPS(m: unknown): m is PS {
      return typeof m === 'object' && m !== null && 'presentationState' in m;
    }
    const m: unknown = await import(/* @vite-ignore */ p);
    if (!isPS(m)) throw new Error('presentationState module shape mismatch');
    m.presentationState.sweepRange = { min: 13.478123, max: 19987.34567 };
  }, '/src/logic/presentationState.ts');
  await page.locator('.tb-btn[title="Options"]').click();
  await page.locator('.opt-tab', { hasText: 'Plot Window' }).click();
  await expect(freqRow(page).nth(0)).toHaveValue('13.5');
  await expect(freqRow(page).nth(1)).toHaveValue('19987.3');
});
