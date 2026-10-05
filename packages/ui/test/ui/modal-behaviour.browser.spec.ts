import {duplicateFocusedProject, expect, openAProject, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';

test.describe('Modal behaviour', () => {
  test.describe('true modals', () => {
    // QO157 (human ruling 2026-09-18): the editor/library overlays are TRUE full-screen modals
    // (position:fixed inset:0), so while one is open the project rows sit UNDER it — a real user
    // cannot click another row to switch focus. That is the intended design, not a bug. The
    // focus-switch-closes rule applies only to DOCKED panels (the What-if? panel); a true modal must
    // be dismissed (Escape / its close button) before focus can change.

    /** Assert the true-modal contract for one overlay: while it is open a click aimed at a project
     *  row is SWALLOWED by the overlay (the row never receives it, focus cannot change); after the
     *  modal is dismissed the same click lands on the row and focus switches. */
    async function assertTrueModal(page: Page, modal: Locator, open: () => Promise<void>, close: () => Promise<void>): Promise<void> {
      await duplicateFocusedProject(page, 'Copy');
      const rows = page.locator('.project-row');
      await expect(rows).toHaveCount(2);

      await open();
      // Click at the row's coordinates with the MOUSE — Playwright's actionability check would
      // refuse because the overlay intercepts, which is exactly the point: the overlay swallows the
      // pointer event, the row never receives it, focus cannot change, and a true modal stays open.
      const rowBox = (await rows.nth(0).boundingBox())!;
      await page.mouse.click(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
      await expect(modal).toBeVisible();

      await close();
      await rows.nth(0).click();
      await expect(rows.nth(0)).toHaveClass(/selected/);
    }

    test('the Driver Editor is a true modal — the project rows are unclickable while it is open', async ({ page }) => {
      await page.goto('/');
      await openAProject(page);

      await assertTrueModal(
        page,
        page.locator('.de-modal'),
        async () => {
          await page.locator('li', { hasText: 'Driver' }).click();
          await page.locator('button.edit-btn', { hasText: 'Edit' }).click();
          await expect(page.locator('.de-modal')).toBeVisible();
        },
        async () => {
          await page.keyboard.press('Escape');
          await expect(page.locator('.de-modal')).toBeHidden();
        },
      );
    });

    test('the driver library is a true modal — the project rows are unclickable while it is open', async ({ page }) => {
      await page.goto('/');
      await openAProject(page);

      await assertTrueModal(
        page,
        page.locator('.wb-modal'),
        async () => {
          await page.locator('li', { hasText: 'Driver' }).click();
          await page.locator('button.edit-btn', { hasText: 'Select Driver' }).click();
          await expect(page.locator('.wb-modal')).toBeVisible();
        },
        async () => {
          await page.keyboard.press('Escape');
          await expect(page.locator('.wb-modal')).toBeHidden();
        },
      );
    });
  });

  test.describe('Escape', () => {
    // Design rule: pressing Escape dismisses any open modal.
    // The browserLog auto-fixture also asserts a clean console + network throughout.
    //
    // Both affordances live on the Driver tab of the bottom panel (the tab rail is persisted UI
    // state and defaults to Box), so every test switches to the tab it intends — the
    // ui-bugfix.md testing creed. The old "Define new" button and its `.dd-overlay` modal are
    // long gone from the shell; the governed way into the driver editor is the picker's
    // "Add new Driver" (DriverBrowser.vue), which opens the same `.de-modal`.

    test('Escape dismisses the driver editor opened from the library', async ({ page }) => {
      await page.goto('/');
      await openAProject(page);
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.getByRole('button', { name: 'Select Driver' }).click();
      await page.getByRole('button', { name: 'Add new Driver' }).click();
      await expect(page.locator('.de-modal')).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(page.locator('.de-modal')).toBeHidden();
    });
  });
});
