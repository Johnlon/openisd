/**
 * A project open in the workspace follows a pull, on both skins: another device edits it on
 * Drive, this device syncs, and the open project shows the new values without being reopened.
 * Real sync and Drive client over an emulated Drive.
 * bugs/BUG_20261015_synced-open-project-does-not-refresh.md
 */
import {expect, openAMobileProject, openAProject, shownBoxVolume, test} from '../fixtures.js';
import type {DriveEmulator} from '../fixtures/driveEmulator.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import {connectedToDrive, iPhoneEdit, PULLED_VOLUME_M3, RENAMED} from './fixtures/driveConnected.js';

/** The pulled volume as the Box tab shows it. */
const PULLED_VOLUME_L = PULLED_VOLUME_M3 * 1000;

/** The saved project reaches Drive, the iPhone edits it there. */
async function iPhoneEditsTheSavedProject(drive: DriveEmulator): Promise<void> {
  await expect.poll(() => drive.listFiles().filter(f => f.name.startsWith('project-')).length, {timeout: 20_000}).toBe(1);
  drive.editAsDevice('project-', iPhoneEdit, 'iPhone');
}

test('desktop: an open project shows what a pull brought, without reopening it', async ({page}) => {
  const drive = await connectedToDrive(page);
  await page.goto('/');
  await openAProject(page);
  await page.locator('.tb-btn[title^="Save - "]').click();
  await iPhoneEditsTheSavedProject(drive);
  expect(await shownBoxVolume(page)).not.toBeCloseTo(PULLED_VOLUME_L, 2);

  await page.locator('.cloud-sync-badge').click();
  await page.locator('.cloud-modal button', {hasText: 'Sync now'}).click();
  await expect(page.getByText(RENAMED).first()).toBeVisible();
  await page.locator('.cloud-modal-x').click();
  await expect.poll(() => shownBoxVolume(page)).toBeCloseTo(PULLED_VOLUME_L, 2);
});

test('mobile: an open project shows what a pull brought, without reopening it', async ({page}) => {
  await forceMobileSkin(page);
  const drive = await connectedToDrive(page);
  await page.goto('/');
  await openAMobileProject(page);
  await tapMobileMenuItem(page, /^Save$/);
  await iPhoneEditsTheSavedProject(drive);
  expect(await shownBoxVolume(page)).not.toBeCloseTo(PULLED_VOLUME_L, 2);

  await tapMobileMenuItem(page, 'Cloud sync');
  await page.locator('.mob-dlg button', {hasText: 'Sync now'}).click();
  await page.locator('.mob-dlg').getByRole('button', {name: /^(Close|OK|✕)$/}).last().click();
  await expect.poll(() => shownBoxVolume(page)).toBeCloseTo(PULLED_VOLUME_L, 2);
  await expect(page.getByText(RENAMED).first()).toBeVisible();
});
