/**
 * B11 (T516): the phone app dialogs (Options and the other menu pages) use the classic rows and bands:
 * 40 px rows, one value-box left edge, 28 px grey bands each with a ?, no sideways scroll.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PHONE_SIZES} from '../fixtures/phoneSizes.js';
import {PhoneRowSizes} from '@openisd/design/fields';

const ROW_PX = PhoneRowSizes.CLASSIC.rowMinPx;
const BAND_PX = 28;
const TOL = 0.5;

test.describe('B11 dialogs: classic rows and bands', () => {
  for (const size of PHONE_SIZES) {
    test(`Options General at ${size.width}×${size.height}: 40 px rows, one value-box edge, 28 px bands with a ?`, async ({page}) => {
      await page.setViewportSize(size);
      await forceMobileSkin(page);
      await page.goto('/');
      await openAMobileProject(page);
      await page.locator('.mob-hamburger').click();
      await page.locator('.mob-menu-item', {hasText: 'Options'}).click();
      const dialog = page.locator('.mob-dlg[aria-label="Options"]');
      const rows = dialog.locator('.mob-ui-field');
      expect(await rows.count(), 'the page has field rows').toBeGreaterThan(0);
      for (const h of await rows.evaluateAll(els => els.map(e => e.getBoundingClientRect().height))) {
        expect(Math.abs(h - ROW_PX), `row height ${h}`).toBeLessThanOrEqual(TOL);
      }
      const lefts = await rows.evaluateAll(els => els.flatMap(e => {
        const input = e.querySelector<HTMLElement>('.ui-field-value input, .ui-field-value .mob-readonly');
        return input ? [input.getBoundingClientRect().left] : [];
      }));
      for (const l of lefts) expect(Math.abs(l - lefts[0]), 'value boxes share one left edge').toBeLessThanOrEqual(TOL);
      const bands = await dialog.locator('.mob-band').evaluateAll(els => els.map(e => ({h: e.getBoundingClientRect().height, help: e.querySelector('.mob-band-help') !== null})));
      expect(bands.length).toBeGreaterThan(0);
      for (const b of bands) {
        expect(Math.abs(b.h - BAND_PX), 'band height').toBeLessThanOrEqual(TOL);
        expect(b.help, 'band has a ?').toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    });
  }
});
