import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

test.describe('In-app confirm dialog', () => {
  test.describe('Original skin', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.original-root')).toBeVisible();
    });

    test('Revert prompt shows in-app dialog with Discard/Keep buttons', async ({ page }) => {
      // Open a project and modify it
      await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);

      await page.locator('.project-nav li', { hasText: 'Project' }).click();
      const nameInput = page.locator('.tab-section.active .field', { hasText: 'Name' }).locator('input');
      await nameInput.fill('Modified Project Name');
      await nameInput.blur();

      // Click Revert button
      const revertBtn = page.locator('.tb-btn[title^="Revert"]');
      await expect(revertBtn).not.toHaveClass(/disabled/);

      // Listen for native dialog - should NOT fire
      let nativeDialogFired = false;
      page.on('dialog', async (dialog) => {
        nativeDialogFired = true;
        await dialog.dismiss();
      });

      await revertBtn.click();

      // In-app dialog should appear
      await expect(page.locator('.confirm-overlay')).toBeVisible();
      await expect(page.locator('.confirm-modal h2')).toHaveText('Discard changes?');
      await expect(page.locator('.confirm-modal p')).toHaveText('Discard all unsaved changes and return to the last saved version?');
      await expect(page.locator('.confirm-dialog-confirm')).toHaveText('Discard');
      await expect(page.locator('.confirm-dialog-cancel')).toHaveText('Keep');

      // Click Keep - should cancel
      await page.locator('.confirm-dialog-cancel').click();
      await expect(page.locator('.confirm-overlay')).toHaveCount(0);

      // Project should still be modified
      await expect(nameInput).toHaveValue('Modified Project Name');
      await expect(revertBtn).not.toHaveClass(/disabled/);

      // Click Revert again
      await revertBtn.click();
      await expect(page.locator('.confirm-overlay')).toBeVisible();

      // Click Discard - should revert
      await page.locator('.confirm-dialog-confirm').click();
      await expect(page.locator('.confirm-overlay')).toHaveCount(0);

      // Name should be reverted
      await expect(nameInput).not.toHaveValue('Modified Project Name');
      await expect(revertBtn).toHaveClass(/disabled/);

      // No native dialog should have fired
      expect(nativeDialogFired).toBe(false);
    });
  });

  test.describe('Mobile skin', () => {
    test.beforeEach(async ({ page }) => {
      await forceMobileSkin(page);
      await page.goto('/');
      await expect(page.locator('.mobile-root')).toBeVisible();
    });

    test('Revert prompt shows in-app dialog with Discard/Keep buttons', async ({ page }) => {
      // Open a project and modify it
      await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);

      await tapMobileMenuItem(page, 'Project details');
      const nameInput = page.locator('#mob-proj-name');
      await nameInput.fill('Modified Project Name');
      await nameInput.blur();
      await page.locator('.mob-dlg-close').click();

      // Listen for native dialog - should NOT fire
      let nativeDialogFired = false;
      page.on('dialog', async (dialog) => {
        nativeDialogFired = true;
        await dialog.dismiss();
      });

      // Open menu and click Revert
      await tapMobileMenuItem(page, 'Revert unsaved changes');

      // In-app dialog should appear
      await expect(page.locator('.confirm-overlay')).toBeVisible();
      await expect(page.locator('.confirm-modal h2')).toHaveText('Discard changes?');
      await expect(page.locator('.confirm-modal p')).toHaveText('Discard all unsaved changes and return to the last saved version?');
      await expect(page.locator('.confirm-dialog-confirm')).toHaveText('Discard');
      await expect(page.locator('.confirm-dialog-cancel')).toHaveText('Keep');

      // Click Keep - should cancel
      await page.locator('.confirm-dialog-cancel').click();
      await expect(page.locator('.confirm-overlay')).toHaveCount(0);

      // Project should still be modified
      await tapMobileMenuItem(page, 'Project details');
      await expect(nameInput).toHaveValue('Modified Project Name');
      await page.locator('.mob-dlg-close').click();

      // Click Revert again
      await tapMobileMenuItem(page, 'Revert unsaved changes');
      await expect(page.locator('.confirm-overlay')).toBeVisible();

      // Click Discard - should revert
      await page.locator('.confirm-dialog-confirm').click();
      await expect(page.locator('.confirm-overlay')).toHaveCount(0);

      // Name should be reverted
      await tapMobileMenuItem(page, 'Project details');
      await expect(nameInput).not.toHaveValue('Modified Project Name');
      await page.locator('.mob-dlg-close').click();

      // No native dialog should have fired
      expect(nativeDialogFired).toBe(false);
    });
  });
});