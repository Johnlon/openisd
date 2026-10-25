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

test('the provenance overlay hides editor actions, leaves tabs available, and restores actions when dismissed', async ({page}) => {
  await page.locator('.de-provenance-chk', {hasText: 'Inspect Provenance'}).locator('input').evaluate(el => {
    if (!(el instanceof HTMLInputElement)) throw new Error('Inspect Provenance control is not an input');
    el.click();
  });
  const card = page.locator('.eq-inspector-card');
  await expect(card).toBeVisible();
  const c = (await card.boundingBox())!;
  expect(c.y + c.height).toBeCloseTo(PIXEL_9.height, 0);
  await expect(page.locator('.de-toolbar')).toHaveCount(0);
  await expect(page.locator('.de-footer button')).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'OK', exact: true})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Cancel', exact: true})).toHaveCount(0);
  await expect(page.getByRole('button', {name: /More/})).toHaveCount(0);
  await expect(page.locator('.de-modal h2 .x')).toBeVisible();
  await page.getByRole('button', {name: 'Advanced', exact: true}).click();
  await expect(page.locator('.de-tab.on')).toHaveText('Advanced');
  await expect(card).toBeVisible();
  await card.locator('.eq-x').click();
  await expect(card).toHaveCount(0);
  await expect(page.locator('.de-toolbar')).toBeVisible();
  await expect(page.getByRole('button', {name: 'OK', exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Cancel', exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: /More/})).toBeVisible();
});

/** bugs/BUG_20261020_phone-provenance-card-see-through-over-fields.md */
test('the Provenance card is opaque and the tapped field row is not under it', async ({page}) => {
  await page.getByRole('button', {name: 'Parameters', exact: true}).click();
  await page.locator('.de-provenance-chk', {hasText: 'Inspect Provenance'}).click();
  const row = page.locator('.de-fld[data-field-key="Cms_m_per_N"]');
  await row.locator('input').click();
  const card = page.locator('.eq-inspector-card');
  await expect(card).toBeVisible();
  await expect.poll(() => card.evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  const paint = await card.evaluate(el => {
    const s = getComputedStyle(el);
    return {bg: s.backgroundColor, opacity: s.opacity};
  });
  expect(paint.bg, 'card background is a solid colour').toMatch(/^rgb\(/);
  await expect.poll(async () => {
    const c = (await card.boundingBox())!;
    const r = (await row.boundingBox())!;
    return r.y + r.height <= c.y + 0.5;
  }, {message: 'the tapped Cms row is above the card'}).toBe(true);
});
