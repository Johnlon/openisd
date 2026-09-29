/**
 * The mobile New Project wizard. Step 1 (driver picker) delegates entirely to DriverLibrary,
 * which has its own Cancel/Use pair when previewing a driver — the wizard's own footer must stay
 * hidden there, or the two "Cancel" buttons duplicate and confuse (John: "consolidate the
 * buttons", after seeing both at once on a phone-height screen).
 *
 * The test suite's own vite server swaps in a tiny 6-reference-device catalogue (test-bundle.mjs
 * — "no corpus needed"), not the full ~1600-driver one a dev server serves — "Tang Band
 * W5-1138SMF" is one of the six (also used by wizard-defaults.browser.spec.ts).
 */
import {expect, test} from '../fixtures.js';

const TEST_DRIVER = 'Tang Band W5-1138SMF';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.goto('/');
  await page.getByText('New project').click();
});

test('step 1 has no wizard footer — DriverLibrary\'s own Cancel/Use is the only pair shown', async ({ page }) => {
  await expect(page.locator('.mob-np-footer')).toBeHidden();
  await page.getByText(TEST_DRIVER).click();
  await expect(page.locator('.mob-np-footer')).toBeHidden();
  await expect(page.getByText('Cancel', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Use', { exact: true })).toHaveCount(1);
});

test('picking a driver (Use) advances to step 2 and restores the wizard footer', async ({ page }) => {
  await page.getByText(TEST_DRIVER).click();
  await page.getByText('Use', { exact: true }).click();
  await expect(page.locator('.np-step')).toContainText('Step 2 of 5');
  await expect(page.locator('.mob-np-footer')).toBeVisible();
});

test('the header close (✕) still cancels the whole wizard from step 1', async ({ page }) => {
  await page.locator('.mob-np-close').click();
  await expect(page.locator('.mob-np-overlay')).toBeHidden();
});
