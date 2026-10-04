/**
 * The splash (SplashModal.vue, shared with desktop) on the mobile skin. Bug (John, live on his
 * phone, 2026-09-29): "openisd button should just open the splash as full width scrolling it as a
 * popup". It stays a popup, but its backdrop padding and centred width cap are removed on mobile
 * only (App.vue's .app-root-mobile :deep() override), so it spans the phone pane edge-to-edge
 * instead of floating with grey margins on both sides.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test('About OpenISD (the splash) fills the phone pane edge-to-edge, not a small centred popup', async ({ page }) => {
  await tapMobileMenuItem(page, 'About OpenISD');

  const rootBox = await page.locator('.mobile-root').boundingBox();
  const splashBox = await page.locator('.sp').boundingBox();
  expect(rootBox).not.toBeNull();
  expect(splashBox).not.toBeNull();
  expect(splashBox!.width).toBeGreaterThanOrEqual(rootBox!.width - 1);
});
