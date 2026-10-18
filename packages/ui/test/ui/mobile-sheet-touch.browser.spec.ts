import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PHONE_SIZES, PIXEL_9} from '../fixtures/phoneSizes.js';
import {SheetSizes} from '@openisd/design/fields';

/**
 * Finger-sized controls on the phone sheets (John, 17 Oct 2026: "buttons too small to be
 * practical"): in Tune and What-if, on every phone size, every tappable control (the pull-tab, the
 * steppers, the value inputs, the unit toggles, Reset, Close) is at least 44x44 CSS px and every
 * row at least 48. The rows scroll inside the sheet and the chart keeps 120 px. The sizes come
 * from packages/design (SheetSizes).
 */
const BOXES = [
  {type: 'vented', tab: 'Vented'},
  {type: 'box-passive-radiator', tab: 'Passive Radiator'},
];
const SHEETS = ['Tune', 'What-if'];

for (const size of PHONE_SIZES) for (const box of BOXES) for (const sheetName of SHEETS) {
  test(`${box.type} ${sheetName} sheet: controls at least 44 px, rows at least 48 px at ${size.width}×${size.height}`, async ({page}) => {
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

    const small = await page.locator('.mob-sheet button, .mob-sheet input, .mob-sheet-unit').evaluateAll((els, min) =>
      els.map(el => {
        const r = el.getBoundingClientRect();
        return {what: `${el.tagName} ${el.getAttribute('title') ?? el.getAttribute('aria-label') ?? el.textContent ?? ''}`.trim(), w: r.width, h: r.height};
      }).filter(c => c.w < min || c.h < min), SheetSizes.TOUCH_MIN_PX);
    expect(small, 'controls under 44 px').toEqual([]);

    const shortRows = await page.locator('.mob-sheet-line').evaluateAll((els, min) =>
      els.map(el => el.getBoundingClientRect().height).filter(h => h < min), SheetSizes.ROW_MIN_PX);
    expect(shortRows, 'rows under 48 px').toEqual([]);

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
