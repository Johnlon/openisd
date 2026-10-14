/**
 * Delete project (John, 2026-10-14: "there is no way to delete a project"). Both skins' Open project
 * lists give each saved project a Delete button; a confirm names it; on yes it leaves the list and,
 * when open, closes, leaving the no-project shell after the last one.
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

const CONFIRM_TEXT = 'Delete "sample-project"? It is removed from this browser and from Drive on every synced device. A backup is taken first.';

test('desktop: Delete asks, removes the saved project from the list and closes it', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.tb-btn[title^="Save - "]').click();

  await page.getByTitle('Open project', {exact: true}).click();
  const dialog = page.locator('.open-project-dialog');
  await expect(dialog.locator('.stored-project-row')).toHaveCount(1);

  await dialog.locator('.stored-project-delete').click();
  await expect(page.getByText(CONFIRM_TEXT)).toBeVisible();
  await page.locator('.confirm-dialog-cancel').click();
  await expect(dialog.locator('.stored-project-row')).toHaveCount(1);

  await dialog.locator('.stored-project-delete').click();
  await page.locator('.confirm-dialog-confirm').click();
  await expect(dialog.locator('.stored-project-row')).toHaveCount(0);
  await expect(dialog.getByText('No saved project yet')).toBeVisible();
  await expect(page.locator('.project-empty-row')).toHaveCount(1);
});

test('mobile: Delete asks, removes the saved project from the sheet and shows No project open', async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await tapMobileMenuItem(page, /^Save$/);

  await tapMobileMenuItem(page, 'Open project…');
  const sheet = page.locator('.mob-open-project-sheet');
  await expect(sheet.locator('.mob-stored-project-row')).toHaveCount(1);

  await sheet.getByRole('button', {name: 'Delete sample-project'}).click();
  await expect(page.getByText(CONFIRM_TEXT)).toBeVisible();
  await page.locator('.confirm-dialog-confirm').click();
  await expect(sheet.locator('.mob-stored-project-row')).toHaveCount(0);
  await expect(sheet.getByText('No saved project yet.')).toBeVisible();

  await sheet.locator('.mob-dlg-ok').click();
  await expect(page.getByText('No project open')).toBeVisible();
});
