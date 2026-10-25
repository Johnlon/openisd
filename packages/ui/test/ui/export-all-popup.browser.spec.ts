/**
 * John, 17 Oct 2026: "button must have visual impact so export all projects can't just do the
 * export silently need conf popup". Export all ends with a popup that says what was exported.
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

const EXPORTED_TEXT = /^Exported 1 project to openisd-projects-\d{4}-\d{2}-\d{2}\.json\.$/;

test('Original skin: Export all shows a popup saying what was exported, and OK closes it', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Export all'}).click();
  await download;
  const popup = page.getByRole('alertdialog');
  await expect(popup).toBeVisible();
  await expect(popup.locator('p')).toHaveText(EXPORTED_TEXT);
  await expect(popup.getByRole('button')).toHaveText(['OK']);
  await popup.getByRole('button', {name: 'OK'}).click();
  await expect(popup).toBeHidden();
});

test('Mobile skin: Export all projects shows a popup saying what was exported, and OK closes it', async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await tapMobileMenuItem(page, 'Projects');
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Export all projects'}).click();
  await download;
  const popup = page.getByRole('alertdialog');
  await expect(popup).toBeVisible();
  await expect(popup.locator('p')).toHaveText(EXPORTED_TEXT);
  await expect(popup.getByRole('button')).toHaveText(['OK']);
  await popup.getByRole('button', {name: 'OK'}).click();
  await expect(popup).toBeHidden();
});
