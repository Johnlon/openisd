import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

/**
 * Phone field rows stay shallow and tappable (John, 2026-10-15), and the bottom tab bar stays
 * pinned while a tuning tab scrolls (John, 2026-10-16: "scrolling is fine on those views"). Every
 * row of a tuning tab is at least 40 px to tap, at three phone sizes; the tab bar sits on screen
 * before and after the content is scrolled to its end, and the last row can be scrolled into view.
 */
const SIZES = [{width: 360, height: 740}, {width: 390, height: 844}, {width: 412, height: 915}];
const TUNING_TABS = [
  {type: 'vented', tab: 'Vented'},
  {type: 'bandpass4', tab: '4th Order Bandpass'},
  {type: 'bandpass6', tab: '6th Order Bandpass'},
  {type: 'box-passive-radiator', tab: 'Passive Radiator'},
];
const MIN_TAP_PX = 40;

for (const size of SIZES) {
  for (const {type, tab} of TUNING_TABS) {
    test(`${tab}: rows are tappable and the tab bar stays pinned at ${size.width}×${size.height}`, async ({page}) => {
      await page.setViewportSize(size);
      await forceMobileSkin(page);
      await page.goto('/');
      await openAMobileProject(page);
      await page.locator('.mob-tab', {hasText: 'Box'}).click();
      await page.locator('#mob-box-type').selectOption(type);
      await page.locator('.mob-tab', {hasText: tab}).first().click();

      const content = page.locator('.mob-content');
      const bar = page.locator('.mob-tabbar');
      const barBox = () => bar.evaluate(el => { const r = el.getBoundingClientRect(); return {y: r.y, height: r.height}; });
      const before = await barBox();
      expect(before.y + before.height, 'the tab bar is on screen').toBeLessThanOrEqual(size.height);

      await content.evaluate(el => { el.scrollTop = el.scrollHeight; });
      const after = await barBox();
      expect(after.y, `${tab}: the tab bar stays where it was while the content scrolls`).toBe(before.y);
      expect(after.y + after.height).toBeLessThanOrEqual(size.height);

      const lastRowBottom = await page.locator('.mob-content .mob-row, .mob-content .mob-field-row, .mob-content .mob-ui-field')
        .evaluateAll(rows => Math.max(...rows.map(r => r.getBoundingClientRect().bottom)));
      const contentBottom = await content.evaluate(el => el.getBoundingClientRect().bottom);
      expect(lastRowBottom, `${tab}: the last row can be scrolled into view`).toBeLessThanOrEqual(contentBottom + 1);

      const rowHeights = await page.locator('.mob-content .mob-row, .mob-content .mob-field-row, .mob-content .mob-ui-field')
        .evaluateAll(rows => rows.map(r => r.getBoundingClientRect().height));
      expect(Math.min(...rowHeights)).toBeGreaterThanOrEqual(MIN_TAP_PX);
    });
  }
}
