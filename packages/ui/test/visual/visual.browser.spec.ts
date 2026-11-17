import {expect, test} from '../fixtures.js';
import {SCREENS} from './screens.js';
import {chartFontReport, watchChartFonts} from '../fixtures/chartFonts.js';

/**
 * One screenshot per screen and skin, compared with its committed baseline. A difference fails the
 * test, named by the screen; the post-land run publishes the before/after pictures.
 */
for (const screen of SCREENS) {
  test(`visual ${screen.skin.name} ${screen.name}`, async ({page, browserLog}) => {
    await watchChartFonts(page);
    await screen.open(page);
    // A fault view writes its own console error on purpose; any other one stays and fails the browser-log check.
    expect(browserLog.consoleErrors.filter(message => !screen.ownConsoleErrors.some(own => own.test(message))), `${screen.name}: console errors other than its own fault`).toEqual([]);
    browserLog.reset();
    // The build stamp differs on every build and is always masked; a screen masks only the parts the machine decides. The font record goes with the
    // report: a chart's labels left in the fallback font turn the picture red (bug what-if-close-curve-not-restored).
    await expect(page).toHaveScreenshot(`${screen.skin.name}-${screen.name}.png`, {mask: [page.getByTestId('app-version'), ...screen.mask.map(selector => page.locator(selector))]}).finally(async () => {
      await test.info().attach('chart fonts', {body: await chartFontReport(page), contentType: 'text/plain'});
    });
  });
}
