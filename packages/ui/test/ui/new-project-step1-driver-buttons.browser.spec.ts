import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

/**
 * T040: Remove Edit and Clone driver buttons from the new-project wizard's step 1.
 *
 * In step 1 of the new-project wizard (both skins), picking a driver summarises it
 * without displaying Edit or Clone driver buttons.
 * In the driver manager (Original: DriverBrowser overlay; Mobile: Manage Drivers pane),
 * both buttons remain visible and functional.
 */

test.describe('New project wizard step 1 driver buttons (T040)', () => {
  test.describe('Original skin', () => {
    test('step 1 driver preview has no Edit button and no Clone driver button', async ({ page }) => {
      await page.goto('/');
      await page.locator('.tb-btn[title*="New project"]').click();
      await expect(page.locator('.overlay.open .modal-body')).toContainText('Select driver for project');
      await expect(page.locator('.overlay.open .dlist')).toBeVisible();

      // Pick a driver so the summary shows
      await page.locator('.overlay.open .dlist .ditem').first().click();
      await expect(page.locator('.overlay.open .preview')).toBeVisible();

      // No Edit and no Clone driver buttons in step 1
      await expect(page.locator('.overlay.open .edit-btn', { hasText: 'Edit' })).toHaveCount(0);
      await expect(page.locator('.overlay.open .clone-btn', { hasText: 'Clone driver' })).toHaveCount(0);
    });

    test('driver manager (driver browser) still shows both Edit and Clone driver buttons', async ({ page }) => {
      await page.goto('/');
      await page.locator('.tb-btn[title^="Manage Drivers"]').click();
      await expect(page.locator('.wb-modal .dlist')).toBeVisible();

      // Pick a driver so the summary shows
      await page.locator('.wb-modal .dlist .ditem').first().click();
      await expect(page.locator('.wb-modal .preview')).toBeVisible();

      // Both buttons still show
      await expect(page.locator('.wb-modal .edit-btn', { hasText: 'Edit' })).toBeVisible();
      await expect(page.locator('.wb-modal .clone-btn', { hasText: 'Clone driver' })).toBeVisible();
    });
  });

  test.describe('Mobile skin', () => {
    test('step 1 driver preview has no Edit button and no Clone driver button', async ({ page }) => {
      await forceMobileSkin(page);
      await page.goto('/');
      await page.getByText('New project').click();
      await expect(page.locator('.mob-np-overlay')).toBeVisible();
      await expect(page.locator('.mob-np-body .dlist')).toBeVisible();

      // Pick a driver so the summary shows
      await page.locator('.mob-np-body .dlist .ditem').first().click();
      await expect(page.locator('.mob-np-body .preview')).toBeVisible();

      // No Edit and no Clone driver buttons in step 1
      await expect(page.locator('.mob-np-body .edit-btn', { hasText: 'Edit' })).toHaveCount(0);
      await expect(page.locator('.mob-np-body .clone-btn', { hasText: 'Clone driver' })).toHaveCount(0);
    });

    test('driver manager (Manage Drivers) still shows both Edit and Clone driver buttons', async ({ page }) => {
      await forceMobileSkin(page);
      await page.goto('/');
      await openAMobileProject(page);
      await tapMobileMenuItem(page, 'Manage Drivers');
      await expect(page.locator('.mob-drivers-library .dlist')).toBeVisible();

      // Pick a driver so the summary shows
      await page.locator('.mob-drivers-library .dlist .ditem').first().click();
      await expect(page.locator('.mob-drivers-library .preview')).toBeVisible();

      // Both buttons still show
      await expect(page.locator('.mob-drivers-library .edit-btn', { hasText: 'Edit' })).toBeVisible();
      await expect(page.locator('.mob-drivers-library .clone-btn', { hasText: 'Clone driver' })).toBeVisible();
    });
  });
});
