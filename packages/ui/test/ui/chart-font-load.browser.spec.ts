/**
 * The chart's labels end up in the page font whatever order the fonts load in
 * (bugs/BUG_20261017_what-if-close-curve-not-restored.md). On the CI runner the empty screen's
 * semibold Inter finished before the chart's first draw, and that draw started the regular Inter
 * download; the chart drew its labels in the fallback font and nothing redrew them when the font came.
 */
import {chartPicture, expect, expectChartDrawn, settledChartPicture, test} from '../fixtures.js';
import {VisualSkin} from '../visual/screens.js';

test('the chart redraws its labels when a font it uses arrives after its first draw', async ({page}) => {
  let release = (): void => undefined;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(/inter-latin-400-normal.*\.woff2/, async route => { await held; await route.continue(); });

  await VisualSkin.DESKTOP.start(page);
  // CI's order: the semibold Inter is in, and no font is loading, when the chart makes its first
  // draw. Locally the import message's semibold download ends just as the chart mounts; asking the
  // browser for that face first stands in for the slower runner (the app's state is not touched).
  await page.evaluate(() => document.fonts.load('600 13px Inter').then(() => undefined));
  await VisualSkin.DESKTOP.openProject(page);
  // No picture yet: a screenshot waits for every font, and the regular one is held.
  await expectChartDrawn(page);

  const regular = page.waitForResponse(/inter-latin-400-normal.*\.woff2/);
  release();
  await (await regular).finished();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const afterFont = await settledChartPicture(page);

  // Widening the window and putting it back redraws the chart in the fonts the page now has: the
  // picture it must already show. Each step waits for its own redraw to be on screen.
  await page.setViewportSize({width: VisualSkin.DESKTOP.viewport.width + 1, height: VisualSkin.DESKTOP.viewport.height});
  await expect.poll(() => chartPicture(page)).not.toBe(afterFont);
  const wider = await settledChartPicture(page);
  await page.setViewportSize(VisualSkin.DESKTOP.viewport);
  await expect.poll(() => chartPicture(page)).not.toBe(wider);
  expect(await settledChartPicture(page)).toBe(afterFont);
});
