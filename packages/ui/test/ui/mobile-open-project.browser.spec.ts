/**
 * The mobile menu's "Open project…" — previously-SAVED projects (browser storage), distinct
 * from "Open a file" (a disk import). John, 2026-10-02: "the file menu offer no way to save and
 * reopen projects" — mobile had New project / Open a file, but no equivalent of desktop's own
 * Open dialog (empty-state-open-file.browser.spec.ts's `.open-project-dialog`).
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.goto('/');
  await openAMobileProject(page);
});

async function openMenu(page: import('playwright').Page): Promise<void> {
  await page.locator('.mob-hamburger').click();
}

test('"Open project…" lists nothing yet before anything has been saved', async ({ page }) => {
  await openMenu(page);
  await page.locator('.mob-menu-item', { hasText: 'Open project…' }).click();
  await expect(page.locator('.mob-align-sheet')).toBeVisible();
  await expect(page.locator('.mob-align-sheet')).toContainText('No saved project yet');
});

test('Save, then "Open project…" lists it and reopens it', async ({ page }) => {
  const before = await page.locator('.mob-field-row.mob-field-entered .mob-field-value input').first().inputValue();

  await openMenu(page);
  await page.locator('.mob-menu-item', { hasText: /^Save$/ }).click();

  await openMenu(page);
  await page.locator('.mob-menu-item', { hasText: 'Open project…' }).click();
  const sheet = page.locator('.mob-align-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.mob-stored-project-row')).toHaveCount(1);

  await sheet.locator('.mob-stored-project-row').first().click();
  await expect(sheet).toHaveCount(0);
  // Reopening the same project lands back on the Box tab with the same value — a real re-load,
  // not a no-op that merely closed the sheet.
  await expect(page.locator('.mob-field-row.mob-field-entered .mob-field-value input').first()).toHaveValue(before);
});
