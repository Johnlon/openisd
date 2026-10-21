import {expect, openAMobileProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PHONE_SIZES, PIXEL_9} from '../fixtures/phoneSizes.js';
import {PhoneRowColumns, PhoneRowSizes} from '@openisd/design/fields';

/**
 * The classic phone rows (PHONE_CLASSIC_BUILD_SPEC §3): on Box (each box type), Driver and Signal,
 * at every phone size, every field row is the CLASSIC depth, value boxes share one left edge with
 * the text gutter inside, chips sit inside their box, nothing is cut or scrolls sideways, the key
 * strip sits under the header, and section bands are 28 px with a ? at the right.
 * Driver editor tabs and wizard step 4 join when B6 and B12 land.
 */
const ROW_PX = PhoneRowSizes.CLASSIC.rowMinPx;
const GUTTER_PX = PhoneRowColumns.STANDARD.textGutterPx;
const BAND_PX = 28;
const TOL = 0.5;

/** With CLASSIC_SHOTS_DIR set, the Pixel 9 run saves the page's pictures there (for the before and after sets). */
async function photograph(page: Page, width: number, name: string): Promise<void> {
  const dir = process.env.CLASSIC_SHOTS_DIR;
  if (dir === undefined || width !== PIXEL_9.width) return;
  const file = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  await page.screenshot({path: `${dir}/${file}-top.png`});
  await page.locator('.mob-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.screenshot({path: `${dir}/${file}-bottom.png`});
  await page.locator('.mob-content').evaluate(el => { el.scrollTop = 0; });
  const enclosure = page.locator('.mob-tab', {hasText: /Vented|Passive Radiator|Bandpass|ABC/}).first();
  if (await enclosure.count() > 0) { await enclosure.click(); await page.screenshot({path: `${dir}/${file}-enclosure.png`}); }
}

const PAGES: readonly {readonly name: string; readonly open: (page: Page) => Promise<void>}[] = [
  ...['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc'].map(type => ({
    name: `Box ${type}`,
    open: async (page: Page) => {
      await page.locator('.mob-tab', {hasText: 'Box'}).first().click();
      await page.locator('#mob-box-type').selectOption(type);
    },
  })),
  {name: 'Driver', open: async page => { await page.locator('.mob-tab', {hasText: 'Driver'}).first().click(); }},
  {name: 'Signal', open: async page => { await page.locator('.mob-tab', {hasText: 'Signal'}).first().click(); }},
  {name: 'Filters', open: async page => {
    await page.locator('.mob-tab', {hasText: 'Filters'}).first().click();
    for (const chip of ['+ LP', '+ AP', '+ LT', '+ PEQ', '+ DLP']) await page.getByText(chip, {exact: true}).click();
  }},
];

for (const size of PHONE_SIZES) {
  for (const pageSpec of PAGES) {
    test(`classic rows: ${pageSpec.name} at ${size.width}×${size.height}`, async ({page}) => {
      await page.setViewportSize(size);
      await forceMobileSkin(page);
      await page.goto('/');
      await openAMobileProject(page);
      await pageSpec.open(page);
      await photograph(page, size.width, pageSpec.name);

      const rows = page.locator('.mob-content .mob-ui-field, .mob-content .mob-crow');
      expect(await rows.count(), 'the page has field rows').toBeGreaterThan(0);

      const heights = await rows.evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
      for (const h of heights) expect(Math.abs(h - ROW_PX), `row height ${h}`).toBeLessThanOrEqual(TOL);

      const boxes = await rows.evaluateAll(els => els.flatMap(row => {
        const input = row.querySelector<HTMLElement>('.ui-field-value input, .ui-field-value .mob-readonly, select.mob-cselect');
        if (!input) return [];
        const box = input.getBoundingClientRect();
        const chip = row.querySelector<HTMLElement>('.ui-field-unit')?.getBoundingClientRect();
        return [{
          left: box.left, right: box.right,
          gutter: parseFloat(getComputedStyle(input).paddingLeft),
          chipInside: chip === undefined || chip.width === 0 || (chip.left >= box.left && chip.right <= box.right + 0.5),
        }];
      }));
      expect(boxes.length).toBeGreaterThan(0);
      for (const b of boxes) {
        expect(Math.abs(b.left - boxes[0].left), 'value boxes share one left edge').toBeLessThanOrEqual(TOL);
        expect(b.gutter, 'text gutter').toBe(GUTTER_PX);
        expect(b.chipInside, 'unit chip inside its box').toBe(true);
      }

      const overflow = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        cut: [...document.querySelectorAll<HTMLElement>('.mob-content label, .mob-content input, .mob-content button')]
          .filter(e => e.closest('[data-carousel]') === null)
          .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => `${e.tagName}.${e.className}:${e.textContent?.trim() || e.getAttribute('aria-label') || e.id}`),
        outside: [...document.querySelectorAll<HTMLElement>('.mob-content input, .mob-content button')]
          .filter(e => e.closest('[data-carousel]') === null)
          .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < 0 || r.right > window.innerWidth + 0.5); }).length,
      }));
      expect(overflow.page, 'no horizontal page scroll').toBe(false);
      expect(overflow.cut, 'no label, value or button is cut').toEqual([]);
      expect(overflow.outside, 'no control outside the viewport sideways').toBe(0);

      const strip = page.locator('.mob-key-strip');
      await expect(strip, 'key strip under the header').toBeVisible();
      for (const word of ['Entered', 'Calculated', 'Not Available']) await expect(strip).toContainText(word);
      const order = await page.evaluate(() => {
        const header = document.querySelector('.mob-topbar')?.getBoundingClientRect();
        const s = document.querySelector('.mob-key-strip')?.getBoundingClientRect();
        return header && s ? s.top - header.bottom : NaN;
      });
      expect(Math.abs(order), 'strip touches the header bottom').toBeLessThanOrEqual(1);

      const bands = await page.locator('.mob-content .mob-band').evaluateAll(els => els.map(e => ({
        h: e.getBoundingClientRect().height, help: e.querySelector('.mob-band-help') !== null,
      })));
      expect(bands.length, 'the page has section bands').toBeGreaterThan(0);
      for (const b of bands) {
        expect(Math.abs(b.h - BAND_PX), 'band height').toBeLessThanOrEqual(TOL);
        expect(b.help, 'band has a ?').toBe(true);
      }
    });
  }
}
