import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PHONE_SIZES, PIXEL_9} from '../fixtures/phoneSizes.js';
import {PhoneRowSizes, SheetSizes} from '@openisd/design/fields';

/**
 * Finger-sized controls on the phone sheets (John, 17 Oct 2026: "buttons too small to be
 * practical"): in Tune and What-if, on every phone size, every button (the pull-tab, Reset, Close)
 * is the one 44 px phone button, and the rows are the app's standard classic rows (John, 20 Oct
 * 2026: one button size and one row size across the app): 40 px, with the row's ▲▼ and unit at
 * least 40 px wide. The rows scroll inside the sheet and the chart keeps 120 px. The sizes come
 * from packages/design (SheetSizes, PhoneRowSizes.CLASSIC).
 */
const BOXES = [
  {type: 'vented', tab: 'Vented'},
  {type: 'box-passive-radiator', tab: 'Passive Radiator'},
];
const SHEETS = ['Tune', 'What-if'];

for (const size of PHONE_SIZES) for (const box of BOXES) for (const sheetName of SHEETS) {
  test(`${box.type} ${sheetName} sheet: 44 px buttons, standard 40 px rows at ${size.width}×${size.height}`, async ({page}) => {
    await page.setViewportSize(size);
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await page.locator('#mob-box-type').selectOption(box.type);
    await page.locator('.mob-tab', {hasText: 'Graph'}).click();

    const tab = page.getByRole('button', {name: `Open ${sheetName}`});
    expect(await tab.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(SheetSizes.TOUCH_MIN_PX);
    await tab.click();
    await expect(page.locator('.mob-sheet')).toBeVisible();

    const sizes = (selector: string) => page.locator(selector).evaluateAll(els => els.map(el => {
      const r = el.getBoundingClientRect();
      return {what: `${el.tagName} ${el.getAttribute('title') ?? el.getAttribute('aria-label') ?? el.textContent ?? ''}`.trim(), w: r.width, h: r.height};
    }));
    const buttons = await sizes('.mob-sheet-btn');
    expect(buttons.length, 'Close, and Reset on What-if').toBeGreaterThan(0);
    expect(buttons.filter(c => c.w < SheetSizes.TOUCH_MIN_PX || Math.abs(c.h - SheetSizes.TOUCH_MIN_PX) > 0.5), 'buttons not the 44 px button').toEqual([]);
    const rowParts = await sizes('.mob-sheet .num-stepper-btn, .mob-sheet-unit.unit-toggle');
    expect(rowParts.filter(c => c.w < PhoneRowSizes.CLASSIC.unitColPx || c.h < PhoneRowSizes.CLASSIC.inputMinPx - 2), 'row ▲▼ and units smaller than the standard row').toEqual([]);

    const offRows = await page.locator('.mob-sheet-line').evaluateAll((els, px) =>
      els.map(el => el.getBoundingClientRect().height).filter(h => Math.abs(h - px) > 0.5), PhoneRowSizes.CLASSIC.rowMinPx);
    expect(offRows, 'rows not the standard 40 px').toEqual([]);

    const chart = await page.locator('.mob-chart-cell .gpanel').first().evaluate(el => el.getBoundingClientRect().height);
    expect(chart).toBeGreaterThanOrEqual(120);
  });
}

test('a message on the phone never covers a control', async ({page}) => {
  await page.setViewportSize(PIXEL_9);
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  const strip = page.getByTestId('flash-strip');
  await expect(strip).toBeVisible();
  await expect(page.locator('.flash')).toHaveCount(0);
  const covered = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="flash-strip"]')?.getBoundingClientRect();
    // The part of a control on screen: a control scrolled out of its scroll box is not covered.
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      let left = r.left, right = r.right, top = r.top, bottom = r.bottom;
      for (let a = el.parentElement; a !== null; a = a.parentElement) {
        if (getComputedStyle(a).overflowY === 'visible') continue;
        const c = a.getBoundingClientRect();
        left = Math.max(left, c.left); right = Math.min(right, c.right);
        top = Math.max(top, c.top); bottom = Math.min(bottom, c.bottom);
      }
      return {left, right, top, bottom, width: right - left, height: bottom - top};
    };
    return [...document.querySelectorAll('button, input, select, a')]
      .filter(el => !el.closest('[data-testid="flash-strip"]'))
      .map(el => ({el: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim(), r: shown(el)}))
      .filter(c => c.r.width > 0 && c.r.height > 0 && s !== undefined &&
        c.r.left < s.right && c.r.right > s.left && c.r.top < s.bottom && c.r.bottom > s.top)
      .map(c => c.el);
  });
  expect(covered).toEqual([]);
});
