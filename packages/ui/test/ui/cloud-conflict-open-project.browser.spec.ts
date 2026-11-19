/**
 * A project is open with unsaved edits and another device edits the same saved project: sync keeps both.
 * The pulled version keeps the name; the user's edits stay open as "<name> (conflict, <day>, <device>)".
 * A visible notice names both projects, on both skins (John, 18 Nov 2026, QO946.c245: the conflict copy
 * of an open project was made without telling the user which project was which).
 * Real sync and Drive client over an emulated Drive.
 */
import type {Page} from '@playwright/test';
import {formatDay} from '@openisd/design/fields';
import {dirtyFocusedDesign, expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import type {DriveEmulator} from '../fixtures/driveEmulator.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';
import {connectedToDrive, iPhoneEdit, RENAMED} from './fixtures/driveConnected.js';

const NOTICE = 'Project "sample-project" kept both: yours and the copy from iPhone.';
const COPY_NAME = `sample-project (conflict, ${formatDay(new Date())}, `;

/** The project is saved and reaches Drive. */
async function savedToDrive(page: Page, drive: DriveEmulator, save: () => Promise<void>): Promise<void> {
  await save();
  await expect.poll(() => drive.listFiles().filter(f => f.name.startsWith('project-')).length, {timeout: 20_000}).toBe(1);
}

test('desktop: the conflict copy of an open project comes with a notice naming both projects', async ({page}) => {
  const drive = await connectedToDrive(page);
  await page.goto('/');
  await openAProject(page);
  await savedToDrive(page, drive, () => page.locator('.tb-btn[title^="Save - "]').click());
  await dirtyFocusedDesign(page);
  drive.editAsDevice('project-', iPhoneEdit, 'iPhone');

  await page.locator('.cloud-sync-badge').click();
  await page.locator('.cloud-modal button', {hasText: 'Sync now'}).click();
  await page.locator('.cloud-modal-x').click();
  const notice = page.locator('.cloud-conflict-notice');
  await expect(notice).toContainText(NOTICE);
  await expect(notice).toContainText(`Yours is now "${COPY_NAME}`);
  // The Projects list shows both projects without a reload.
  await expect(page.locator('.quad-topleft')).toContainText(RENAMED);
  await expect(page.locator('.quad-topleft')).toContainText('conflict, ');
  await expect(page.locator('.quad-topleft')).toContainText('2 projects');
});

test('mobile: the conflict copy of an open project comes with a notice naming both projects', async ({page}) => {
  await forceMobileSkin(page);
  const drive = await connectedToDrive(page);
  await page.goto('/');
  await openAMobileProject(page);
  await savedToDrive(page, drive, () => tapMobileMenuItem(page, /^Save$/));
  await dirtyFocusedDesign(page);
  drive.editAsDevice('project-', iPhoneEdit, 'iPhone');

  await tapMobileMenuItem(page, 'Cloud sync');
  await page.locator('.mob-dlg button', {hasText: 'Sync now'}).click();
  await page.locator('.mob-dlg').getByRole('button', {name: /^(Close|OK|✕)$/}).last().click();
  const notice = page.locator('.mob-conflict-banner');
  await expect(notice).toContainText(NOTICE);
  await expect(notice).toContainText(`Yours is now "${COPY_NAME}`);
});

test('mobile: the long conflict-copy name in the header is cut with room for its ellipsis, and the whole name is one tap away', async ({page}) => {
  await forceMobileSkin(page);
  await page.setViewportSize({width: PIXEL_9.width, height: PIXEL_9.height});
  const drive = await connectedToDrive(page);
  await page.goto('/');
  await openAMobileProject(page);
  await savedToDrive(page, drive, () => tapMobileMenuItem(page, /^Save$/));
  await dirtyFocusedDesign(page);
  drive.editAsDevice('project-', iPhoneEdit, 'iPhone');
  await tapMobileMenuItem(page, 'Cloud sync');
  await page.locator('.mob-dlg button', {hasText: 'Sync now'}).click();
  await page.locator('.mob-dlg').getByRole('button', {name: /^(Close|OK|✕)$/}).last().click();

  const title = page.locator('.mob-project-title');
  await expect(title).toHaveAttribute('title', new RegExp(`^${COPY_NAME.replace(/[()]/g, '\\$&')}`));
  const text = page.locator('.mob-project-title-text');
  const m = await text.evaluate(el => ({
    clamp: getComputedStyle(el).getPropertyValue('-webkit-line-clamp'),
    roomForEllipsis: parseFloat(getComputedStyle(el).paddingRight) > 0,
    lines: Math.round(el.clientHeight / parseFloat(getComputedStyle(el).lineHeight)),
    right: el.getBoundingClientRect().right,
    saveLeft: document.querySelector('.mob-save')!.getBoundingClientRect().left,
  }));
  // Past three lines the name ends in an ellipsis; right-aligned, the ellipsis needs room or it is drawn off the edge and lost.
  expect(m.clamp).toBe('3');
  expect(m.roomForEllipsis).toBe(true);
  expect(m.lines).toBeLessThanOrEqual(3);
  expect(m.right).toBeLessThanOrEqual(m.saveLeft);

  await title.click();
  const pane = page.locator('.mob-projects-pane');
  await expect(pane).toContainText('sample-project');
  await expect(pane).toContainText(`conflict, ${formatDay(new Date())}, `);
});

test('desktop: the notice goes once the user has viewed the conflict and opened the copy', async ({page}) => {
  const drive = await connectedToDrive(page);
  await page.goto('/');
  await openAProject(page);
  await savedToDrive(page, drive, () => page.locator('.tb-btn[title^="Save - "]').click());
  await dirtyFocusedDesign(page);
  drive.editAsDevice('project-', iPhoneEdit, 'iPhone');
  await page.locator('.cloud-sync-badge').click();
  await page.locator('.cloud-modal button', {hasText: 'Sync now'}).click();
  await page.locator('.cloud-modal-x').click();
  await expect(page.locator('.cloud-conflict-notice')).toContainText(NOTICE);

  // View, then open the copy: the conflict leaves the list.
  await page.locator('.cloud-conflict-notice button', {hasText: 'View'}).click();
  await page.locator('.cloud-modal .cloud-sync-conflict-open-btn').click();
  await expect(page.locator('.cloud-conflict-notice')).toHaveCount(0);
});
