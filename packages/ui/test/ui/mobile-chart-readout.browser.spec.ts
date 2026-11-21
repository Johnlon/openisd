import {COMPLETE_DRIVER_PROJECT_OWPR, expect, test} from '../fixtures.js';
import {phoneTab} from '../fixtures/viewOpenNavigation.js';
import {VisualSkin} from '../visual/screens.js';

test('the mobile chart shows its readout on the first hover, before the resize frame', async ({page}) => {
  await VisualSkin.MOBILE.start(page);
  await VisualSkin.MOBILE.openProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  const panel = page.locator('.mob-chart-view .gpanel').first();
  const axis = panel.locator('.x-axis-overlay');

  // Draw once so that the chart fonts are loaded before testing a fresh mount.
  await phoneTab(page, 'Graph');
  await expect(axis).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await phoneTab(page, 'Box');

  // Hold the page's animation frames while the Graph tab mounts a fresh canvas.
  // Send one real mouse move, then let the scheduled draw run.
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 60_000);
  await phoneTab(page, 'Graph');
  await panel.locator('canvas').hover();
  await page.clock.resume();

  await expect(axis).toBeVisible();
  await expect(panel.locator('.gread').filter({hasText: 'Hz'})).toBeVisible();
});
