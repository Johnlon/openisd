/**
 * Two hamburger-menu bugs John reported live on his phone (2026-09-29):
 * - "manage drivers appears as an overlay pop-up... should be a regular pane"
 * - "options appears as an overlay popup and should be a regular pane" (Options stays a
 *   `position:fixed` overlay under the hood — OptionsModal.vue is one monolithic file with
 *   desktop specs pinned to its own layout — but is made to fill the phone screen edge-to-edge
 *   and scroll as a single column from MobileShell.vue only, so it no longer READS as a popup).
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.goto('/');
  await openAMobileProject(page);
});

test('Manage Drivers opens as a full pane, not the DriverBrowser overlay', async ({ page }) => {
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-item', { hasText: 'Manage Drivers' }).click();

  await expect(page.locator('.mob-panel-head', { hasText: 'Manage drivers' })).toBeVisible();
  await expect(page.locator('.driver-library')).toBeVisible();
  // The global DriverBrowser overlay (.wb-modal) must NOT be what opened.
  await expect(page.locator('.wb-modal')).toHaveCount(0);
});

test('picking a driver from Manage Drivers embeds it and returns to the Driver tab', async ({ page }) => {
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-item', { hasText: 'Manage Drivers' }).click();

  await page.locator('.ditem', { hasText: 'Tang Band W5-1138SMF' }).click();
  await page.locator('.prev-footer .use-btn').click();

  await expect(page.locator('.mob-tab.active')).toHaveText('Driver');
  await expect(page.getByText('Tang Band', { exact: false })).toBeVisible();
});

test('Options fills the phone screen edge-to-edge instead of floating as a small popup', async ({ page }) => {
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-item', { hasText: 'Options' }).click();

  const rootBox = await page.locator('.mobile-root').boundingBox();
  const modalBox = await page.locator('.opt-modal').boundingBox();
  expect(rootBox).not.toBeNull();
  expect(modalBox).not.toBeNull();
  expect(modalBox!.width).toBeGreaterThanOrEqual(rootBox!.width - 1);
  expect(modalBox!.height).toBeGreaterThanOrEqual(rootBox!.height - 1);
});
