import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PHONE_SIZES} from '../fixtures/phoneSizes.js';
import {PhoneHeaderSizes} from '@openisd/design/fields';

/**
 * The classic phone header, key strip and tab bar (PHONE_CLASSIC_BUILD_SPEC rows 1, 27, 28; mock
 * QO267/box-combined-live.html): 44 px menu and save buttons, the project name right-aligned on at
 * most two lines inside the bar, the key strip directly under the bar, five tabs along the bottom.
 */
const LONG_NAME = 'W5-1138SMF vented living room corner cabinet, second prototype with long port.owpr';
const CONTROL = PhoneHeaderSizes.CLASSIC.controlPx;

for (const size of PHONE_SIZES) {
  test.describe(`${size.name} ${size.width}x${size.height}`, () => {
    test.beforeEach(async ({appPage: page}) => {
      await page.setViewportSize({width: size.width, height: size.height});
      await forceMobileSkin(page, 'window');
      await page.goto('/');
    });

    test('menu and save buttons are 44 px; the bar is 57 px', async ({appPage: page}) => {
      await openAMobileProject(page);
      const bar = (await page.locator('.mob-topbar').boundingBox())!;
      expect(bar.height).toBeCloseTo(PhoneHeaderSizes.CLASSIC.barHeightPx(), 0);
      for (const sel of ['.mob-hamburger', '.mob-save']) {
        const b = (await page.locator(sel).boundingBox())!;
        expect(b.width, sel).toBeCloseTo(CONTROL, 0);
        expect(b.height, sel).toBeCloseTo(CONTROL, 0);
      }
    });

    test('a long project name is 14 px on at most two lines, right-aligned, inside the bar', async ({appPage: page}) => {
      await openAMobileProject(page, undefined, LONG_NAME);
      const title = page.locator('.mob-project-title');
      const m = await title.evaluate(el => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const bar = document.querySelector('.mob-topbar')!.getBoundingClientRect();
        const save = document.querySelector('.mob-save')!.getBoundingClientRect();
        return {font: cs.fontSize, line: cs.lineHeight, align: cs.textAlign, h: r.height, top: r.top, bottom: r.bottom, right: r.right,
          barTop: bar.top, barBottom: bar.bottom, saveLeft: save.left, lines: Math.round(r.height / parseFloat(cs.lineHeight))};
      });
      expect(m.font).toBe('14px');
      expect(m.line).toBe('17px');
      expect(m.align).toBe('right');
      expect(m.lines).toBeLessThanOrEqual(2);
      expect(m.h).toBeLessThanOrEqual(CONTROL + 0.5);
      expect(m.top).toBeGreaterThanOrEqual(m.barTop);
      expect(m.bottom).toBeLessThanOrEqual(m.barBottom);
      expect(m.right).toBeLessThanOrEqual(m.saveLeft);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test('the key strip is 24 px directly under the bar; five tabs sit along the bottom', async ({appPage: page}) => {
      await openAMobileProject(page);
      const bar = (await page.locator('.mob-topbar').boundingBox())!;
      const strip = (await page.locator('.mob-key-strip').boundingBox())!;
      expect(strip.y).toBeCloseTo(bar.y + bar.height, 0);
      expect(strip.height).toBeCloseTo(24, 0);
      await expect(page.locator('.mob-tabbar .mob-tab')).toHaveText(['Box', 'Driver', 'Signal', 'Filters', 'Graph']);
      const tabs = await page.locator('.mob-tabbar').boundingBox();
      expect(tabs!.y + tabs!.height).toBeCloseTo(size.height, 0);
      expect(tabs!.height).toBeCloseTo(56, 0);
    });
  });
}
