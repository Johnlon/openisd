import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

/**
 * Phone field rows are shallow (John, 2026-10-15: "make the tuning input on the mobile view
 * shallower rows so they all fit without scrolling"). Every row of a tuning tab fits above the
 * bottom bar with no scroll, at two phone sizes, and no row is shorter than 40 px to tap. The 21-row
 * ABC tab cannot fit at 40 px a row and is not asserted.
 */
const SIZES = [{width: 390, height: 844}, {width: 412, height: 915}];
const TUNING_TABS = [
  {type: 'vented', tab: 'Vented'},
  {type: 'bandpass4', tab: '4th Order Bandpass'},
  {type: 'bandpass6', tab: '6th Order Bandpass'},
  {type: 'box-passive-radiator', tab: 'Passive Radiator'},
];
const MIN_TAP_PX = 40;

for (const size of SIZES) {
  for (const {type, tab} of TUNING_TABS) {
    test(`${tab}: every row fits without scrolling at ${size.width}×${size.height}`, async ({page}) => {
      await page.setViewportSize(size);
      await forceMobileSkin(page);
      await page.goto('/');
      await openAMobileProject(page);
      await page.locator('.mob-tab', {hasText: 'Box'}).click();
      await page.locator('#mob-box-type').selectOption(type);
      await page.locator('.mob-tab', {hasText: tab}).first().click();

      const content = page.locator('.mob-content');
      const {scroll, client} = await content.evaluate(el => ({scroll: el.scrollHeight, client: el.clientHeight}));
      expect(scroll, `${tab} needs ${scroll - client} px more than the screen has`).toBeLessThanOrEqual(client);

      const rowHeights = await page.locator('.mob-content .mob-row, .mob-content .mob-field-row, .mob-content .mob-ui-field')
        .evaluateAll(rows => rows.map(r => r.getBoundingClientRect().height));
      expect(Math.min(...rowHeights)).toBeGreaterThanOrEqual(MIN_TAP_PX);
    });
  }
}
