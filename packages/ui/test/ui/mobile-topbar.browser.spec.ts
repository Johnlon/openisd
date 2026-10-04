/**
 * The mobile top bar — the hamburger, then the OpenISD logo and title beside it.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {renameFocusedProject} from '../fixtures/focusedProjectSeam.js';

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
