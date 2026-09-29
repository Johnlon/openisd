/**
 * The mobile top bar — the hamburger, then the OpenISD logo and title beside it.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
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
