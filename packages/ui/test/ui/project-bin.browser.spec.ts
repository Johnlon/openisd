/**
 * The project Bin (John, 2026-10-14: "deletes into a bin, and only empty bin really deletes"). Both
 * skins' Open project lists move a saved project to the Bin, which lists it with its date, device
 * and size, and restores it or deletes it forever.
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

const MOVE_TEXT = 'Move "sample-project" to the Bin? You can restore it from the Bin on any device.';
const DETAIL = /^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} · .+ · .+$/;

test('desktop: Move to Bin, Restore, then Delete forever', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.tb-btn[title^="Save - "]').click();
  await page.getByTitle('Open project', {exact: true}).click();
  const dialog = page.locator('.open-project-dialog');

  await dialog.locator('.stored-project-bin').click();
  await expect(page.getByText(MOVE_TEXT)).toBeVisible();
  await page.locator('.confirm-dialog-confirm').click();
  await expect(dialog.locator('.stored-project-row')).toHaveCount(0);
  await expect(page.locator('.project-empty-row')).toHaveCount(1);

  await dialog.getByRole('button', {name: 'Bin (1)'}).click();
  await expect(dialog.locator('.bin-name')).toHaveText(['sample-project']);
  await expect(dialog.locator('.bin-detail')).toHaveText(DETAIL);
  await dialog.locator('.bin-restore').click();
  await expect(dialog.locator('.bin-row')).toHaveCount(0);
  await dialog.getByRole('button', {name: 'Back to projects'}).click();
  await expect(dialog.locator('.stored-project-name')).toHaveText(['sample-project']);

  await dialog.locator('.stored-project-bin').click();
  await page.locator('.confirm-dialog-confirm').click();
  await dialog.getByRole('button', {name: 'Bin (1)'}).click();
  await dialog.locator('.bin-delete-forever').click();
  await expect(page.getByText('Delete "sample-project" forever?', {exact: false})).toBeVisible();
  await page.locator('.confirm-dialog-confirm').click();
  await expect(dialog.getByText('The Bin is empty')).toBeVisible();
  await dialog.getByRole('button', {name: 'Back to projects'}).click();
  await expect(dialog.getByText('No saved project yet')).toBeVisible();
});

test('mobile: Bin a project, see it in the Bin, then Empty Bin', async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await tapMobileMenuItem(page, /^Save$/);
  await tapMobileMenuItem(page, 'Open project…');
  const sheet = page.locator('.mob-open-project-sheet');

  await sheet.getByRole('button', {name: 'Move sample-project to the Bin'}).click();
  await expect(page.getByText(MOVE_TEXT)).toBeVisible();
  await page.locator('.confirm-dialog-confirm').click();
  await expect(sheet.locator('.mob-stored-project-row')).toHaveCount(0);

  await sheet.getByRole('button', {name: 'Bin (1)'}).click();
  await expect(sheet.locator('.mob-bin-row .mob-stored-project-name')).toHaveText(['sample-project']);
  await expect(sheet.locator('.mob-bin-row .mob-stored-project-summary')).toHaveText(DETAIL);
  await sheet.locator('.mob-bin-empty').click();
  await expect(page.getByText('Delete 1 project in the Bin', {exact: false})).toBeVisible();
  await page.locator('.confirm-dialog-confirm').click();
  await expect(sheet.getByText('The Bin is empty.')).toBeVisible();

  await sheet.locator('.mob-dlg-ok').click();
  await expect(page.getByText('No project open')).toBeVisible();
});
