/**
 * Phone What-if and Tune with a keyboard that SHRINKS THE LAYOUT (BUG_20261106_phone-whatif-tune-keyboard-hides-box,
 * reopened 6 Nov 2026 from John's Pixel 9 in a Chrome custom tab: 374 x 341 above the keyboard, no number rows at all).
 * Playwright cannot raise a real keyboard; a stand-in shrinks the layout viewport to 374 x 341 after the box has focus,
 * and back to 374 x 705 when the keyboard goes. The page is not reloaded and no app state is read.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Locator, Page} from '@playwright/test';

const FULL = {width: 374, height: 705};
const WITH_KEYBOARD = {width: 374, height: 341};

test.use({hasTouch: true, viewport: FULL});

async function openSheet(page: Page, mode: 'Tune' | 'What-if'): Promise<Locator> {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await expect(page.getByTestId('flash-strip')).toHaveCount(0);
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
  await page.getByRole('button', {name: 'Open ' + mode}).click();
  const sheet = page.locator('.mob-sheet');
  await expect(sheet).toBeVisible();
  return sheet;
}

/** What covers the box at its corners and centre, or '' when nothing does. */
async function coveredBy(box: Locator): Promise<string> {
  return box.evaluate(el => {
    const r = el.getBoundingClientRect();
    const pts = [[r.left + 1, r.top + 1], [r.left + 1, r.bottom - 1], [r.left + r.width / 3, r.top + 1], [r.left + r.width / 3, r.bottom - 1], [r.left + r.width / 2, r.top + r.height / 2]];
    for (const [x, y] of pts) {
      const hit = document.elementFromPoint(x, y);
      if (hit === null || !(el === hit || el.contains(hit))) return `${hit?.tagName}.${hit?.className} at ${Math.round(x)},${Math.round(y)}`;
    }
    return '';
  });
}

/** Wholly inside the layout and inside the sheet's list of rows (a row scrolled out of the list is not seen). */
async function whollyInLayout(page: Page, box: Locator): Promise<boolean> {
  const r = await box.boundingBox();
  const size = page.viewportSize();
  const list = await page.locator('.mob-sheet-rows').boundingBox();
  return r !== null && size !== null && list !== null && r.y >= Math.max(0, list.y - 1) && r.y + r.height <= Math.min(size.height, list.y + list.height + 1) && r.x >= 0 && r.x + r.width <= size.width;
}

for (const mode of ['Tune', 'What-if'] as const) {
  test(`${mode}: layout shrunk by the keyboard still shows the focused box and its neighbours`, async ({page}) => {
    const sheet = await openSheet(page, mode);
    const inputs = sheet.locator('.ui-field').filter({hasNot: page.locator('.ui-field-label', {hasText: /^Port area$/})}).locator('input[data-numinput]');
    const every = sheet.locator('input[data-numinput]');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (const index of [0, Math.floor(count / 2), count - 1]) {
      await page.setViewportSize(FULL);
      const input = inputs.nth(index);
      await input.scrollIntoViewIfNeeded();
      await input.tap();
      await page.setViewportSize(WITH_KEYBOARD);
      await expect.poll(() => page.evaluate(() => Math.round(document.querySelector('.mobile-root')!.getBoundingClientRect().height))).toBe(WITH_KEYBOARD.height);
      await expect.poll(async () => (await whollyInLayout(page, input)) ? await coveredBy(input) : 'outside the layout', {message: `box ${index} of ${count}`}).toBe('');
      // The rows above and below, whatever they are (the Port area row included): next in the sheet's list.
      const at = await input.evaluate(el => [...document.querySelectorAll('.mob-sheet input[data-numinput]')].indexOf(el));
      const total = await every.count();
      for (const neighbour of [at - 1, at + 1].filter(n => n >= 0 && n < total)) {
        expect(await whollyInLayout(page, every.nth(neighbour)), `row ${neighbour} next to ${index} visible`).toBe(true);
        expect(await coveredBy(every.nth(neighbour)), `row ${neighbour} next to ${index} uncovered`).toBe('');
      }
      // No blank band: the sheet ends at the bottom of the layout. QO427 (b), John 8 Nov 2026: while typing, the tab bar
      // and the sheet's Auto Y / Close bar are both hidden.
      await expect(page.locator('.mob-tabbar')).toBeHidden();
      await expect(sheet.locator('.mob-sheet-foot')).toBeHidden();
      const bottom = await page.evaluate(() => Math.round(document.querySelector('.mob-sheet')!.getBoundingClientRect().bottom));
      expect(bottom).toBe(WITH_KEYBOARD.height);
      const scroll = await page.evaluate(() => ({x: document.documentElement.scrollWidth > window.innerWidth, y: document.documentElement.scrollHeight > window.innerHeight}));
      expect(scroll).toEqual({x: false, y: false});
    }
    await page.setViewportSize(FULL);
    await expect(sheet.locator('.mob-sheet-close')).toBeInViewport();
    await expect(page.locator('.mob-tabbar')).toBeInViewport();
    await expect(page.locator('.mob-chart-cell .mob-band').first()).toBeVisible();
    for (const legend of await page.locator('.mob-chart-legend').all()) await expect(legend).toBeVisible();
  });
}
