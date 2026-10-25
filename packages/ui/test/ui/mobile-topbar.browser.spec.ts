/**
 * The mobile top bar — the hamburger, then the OpenISD logo and title beside it.
 */
import {expect, openAMobileProject, renameFocusedProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test('the OpenISD logo and title sit in the top bar, right of the hamburger', async ({ page }) => {
  const brand = page.locator('.mob-topbar .mob-brand');
  await expect(brand).toHaveText(/OpenISD/);
  await expect(brand.locator('img')).toBeVisible();
  const [burger, logo] = await Promise.all([page.locator('.mob-hamburger'), brand].map(l => l.boundingBox()));
  expect(logo!.x).toBeGreaterThanOrEqual(burger!.x + burger!.width);
  expect(Math.abs((logo!.y + logo!.height / 2) - (burger!.y + burger!.height / 2))).toBeLessThan(4);
});

// John, 2026-10-01: the top bar shows the focused project's title.
test('the top bar shows the open project\'s title and follows a rename', async ({ page }) => {
  const title = page.locator('.mob-topbar .mob-project-title');
  await expect(title).not.toHaveText('');
  await renameFocusedProject(page, 'Living room sub');
  await expect(title).toHaveText('Living room sub');
});

// BUG_20261019_phone-toolbar-project-name-cut: at 374x705 a 16-character name was cut to
// "W5-1138SM…". The name wraps to two lines inside the same toolbar height instead.
test('a long project name (W5-1138SMF vented 30 L) is shown whole in the top bar at 374x705, wrapped, not cut', async ({ page }) => {
  await page.setViewportSize({ width: 374, height: 705 });
  const bar = page.locator('.mob-topbar');
  const heightBefore = (await bar.boundingBox())!.height;
  await renameFocusedProject(page, 'W5-1138SMF vented 30 L');
  const title = page.locator('.mob-topbar .mob-project-title');
  await expect(title).toHaveText('W5-1138SMF vented 30 L');
  const cut = await title.evaluate(el => ({ across: el.scrollWidth > el.clientWidth, down: el.scrollHeight > el.clientHeight }));
  expect(cut).toEqual({ across: false, down: false });
  expect((await bar.boundingBox())!.height).toBe(heightBefore);
});
