/**
 * The Cloud sync dialog lists what sync moved, newest first, one line per item, on both skins, and
 * keeps the list across a reload. Real sync and Drive client over an emulated Drive.
 */
import type {Locator, Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import type {DriveEmulator} from '../fixtures/driveEmulator.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import {connectedToDrive, iPhoneEdit, RENAMED} from './fixtures/driveConnected.js';

const SENT = /^\d{2}:\d{2} {2}↑ Project ".+" sent$/;
const RECEIVED = `↓ Project "${RENAMED}" received`;

/** The project sent, then the iPhone's edit received, listed newest first and kept across a
 *  reload. Returns the list after the reload. */
async function sentThenReceived(page: Page, drive: DriveEmulator, dialog: () => Promise<Locator>): Promise<Locator> {
  await expect.poll(() => drive.listFiles().filter(f => f.name.startsWith('project-')).length, {timeout: 20_000}).toBe(1);
  let lines = (await dialog()).locator('.cloud-sync-activity-line');
  await expect(lines.filter({hasText: SENT})).toHaveCount(1);

  drive.editAsDevice('project-', iPhoneEdit, 'iPhone');
  await (await dialog()).locator('button', {hasText: 'Sync now'}).click();
  await expect(lines.first()).toHaveText(new RegExp(`^\\d{2}:\\d{2} {2}${RECEIVED.replace(/[()]/g, '\\$&')}$`));
  await expect(lines.nth(1)).toHaveText(SENT);

  await page.reload();
  lines = (await dialog()).locator('.cloud-sync-activity-line');
  await expect(lines.first()).toContainText(RECEIVED);
  return lines;
}

test('desktop: the Cloud sync dialog lists each project sent and received, newest first', async ({page}) => {
  const drive = await connectedToDrive(page);
  await page.goto('/');
  await openAProject(page);
  await page.locator('.tb-btn[title^="Save - "]').click();
  const lines = await sentThenReceived(page, drive, async () => {
    const modal = page.locator('.cloud-modal');
    if (!(await modal.isVisible())) await page.locator('.cloud-sync-badge').click();
    return modal;
  });
  await expect(lines.nth(1)).toHaveText(SENT);
});

test('mobile: the Cloud sync dialog lists each project sent and received, newest first', async ({page}) => {
  await forceMobileSkin(page);
  const drive = await connectedToDrive(page);
  await page.goto('/');
  await openAMobileProject(page);
  await tapMobileMenuItem(page, /^Save$/);
  const lines = await sentThenReceived(page, drive, async () => {
    const dialog = page.locator('.mob-dlg').filter({has: page.locator('.cloud-sync-dialog')});
    if (!(await dialog.isVisible())) await tapMobileMenuItem(page, 'Cloud sync');
    return dialog;
  });
  await expect(lines.nth(1)).toHaveText(SENT);
});
