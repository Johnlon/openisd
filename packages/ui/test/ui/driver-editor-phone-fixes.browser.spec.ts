import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';
import {SheetSizes} from '@openisd/design/fields';

/**
 * The Driver Editor on John's phone (374x705), three bugs from 18-19 Oct 2026:
 *  - bugs/BUG_20261018_driver-editor-buttons-tiny.md
 *  - bugs/BUG_20261019_driver-editor-unit-buttons-overflow.md
 *  - bugs/BUG_20261018_phone-equation-inspector-covers-editor-tabs.md
 */
test.beforeEach(async ({page}) => {
  await page.setViewportSize(PIXEL_9);
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Driver'}).click();
  await page.getByText('Edit', {exact: true}).click();
  await expect(page.locator('.de-modal')).toBeVisible();
});

test('every unit button in the editor is as wide as its text, on every tab', async ({page}) => {
  const tabs = (await page.locator('.de-tab').allInnerTexts()).map(s => s.trim());
  const overflowing: string[] = [];
  for (const tab of tabs) {
    await page.getByRole('button', {name: tab, exact: true}).click();
    const found = await page.locator('.de-body .unit-toggle:visible').evaluateAll(els => els.flatMap(el => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const text = range.getBoundingClientRect().width;
      const box = el.getBoundingClientRect().width;
      return text > box + 0.5 ? [`${el.textContent} text ${Math.round(text)} box ${Math.round(box)}`] : [];
    }));
    overflowing.push(...found.map(f => `${tab}: ${f}`));
  }
  expect(overflowing).toEqual([]);
});

test('the editor tabs, close button and footer buttons are at least 44 px tall', async ({page}) => {
  const small = await page.locator('.de-tab, .de-modal h2 .x, .de-footer button').evaluateAll((els, min) =>
    els.map(el => ({what: (el.textContent ?? '').trim(), h: el.getBoundingClientRect().height, w: el.getBoundingClientRect().width}))
      .filter(c => c.h < min || c.w < min), SheetSizes.TOUCH_MIN_PX);
  expect(small, 'controls under 44 px').toEqual([]);
  await expect(page.locator('.de-footer button').first()).toBeInViewport({ratio: 1});
});

test('with the Provenance card open the editor tabs, close button and footer stay uncovered and the Advanced tab can be tapped', async ({page}) => {
  await page.locator('.de-provenance-chk', {hasText: 'Inspect Provenance'}).click();
  await page.locator('.de-fld[data-field-key="Qts"] input').click();
  const card = page.locator('.eq-inspector-card');
  await expect(card).toBeVisible();
  const c = (await card.boundingBox())!;
  for (const sel of ['.de-tabs', '.de-modal h2 .x', '.de-footer']) {
    const b = (await page.locator(sel).first().boundingBox())!;
    const apart = c.y + c.height <= b.y + 0.5 || b.y + b.height <= c.y + 0.5;
    expect(apart, `${sel} is covered by the card`).toBe(true);
  }
  await page.getByRole('button', {name: 'Advanced', exact: true}).click();
  await expect(page.locator('.de-tab.on')).toHaveText('Advanced');
});
