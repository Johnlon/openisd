import {expect, test} from '../fixtures.js';
import {SCREENS} from './screens.js';
import {chartFontReport, watchChartFonts} from '../fixtures/chartFonts.js';

/**
 * One screenshot per screen and skin, compared with its committed baseline. A difference fails the
 * test, named by the screen; the post-land run publishes the before/after pictures.
 */
for (const screen of SCREENS) {
  test(`visual ${screen.skin.name} ${screen.name}`, async ({page}) => {
    await watchChartFonts(page);
    await screen.open(page);
    // The build stamp differs on every build: it is masked, nothing else is. The font record goes with the
    // report: a chart's labels left in the fallback font turn the picture red (bug what-if-close-curve-not-restored).
    await expect(page).toHaveScreenshot(`${screen.skin.name}-${screen.name}.png`, {mask: [page.getByTestId('app-version')]}).finally(async () => {
      await test.info().attach('chart fonts', {body: await chartFontReport(page), contentType: 'text/plain'});
    });
  });
}
