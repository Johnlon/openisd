/**
 * Cloud sync sends the whole project, unsaved edits included, a few seconds after editing stops (John,
 * 18 Nov 2026, QO946.c247: "why are we sending on saved state and not entire project? why force user to
 * do anything"; c248: option A). Two devices on one account: two browser contexts, each with its own
 * storage, answered by one emulated Drive. Real sync and Drive client.
 */
import type {Browser, Page} from '@playwright/test';
import {dirtyFocusedDesign, expect, focusedIsModified, openAProject, setFocusedBoxVolume, shownBoxVolume, test} from '../fixtures.js';
import type {DriveEmulator} from '../fixtures/driveEmulator.js';
import {standInForSnapshotsSite} from '../fixtures/snapshotsSite.js';
import {connectedTo, connectedToDrive} from './fixtures/driveConnected.js';

/** The Box volume `dirtyFocusedDesign` enters, in litres. */
const EDITED_VOLUME_L = 55.5;
const PROJECT = 'sample-project';

/** Whether Drive's copy of the project holds unsaved edits. */
function unsavedOnDrive(drive: DriveEmulator): boolean {
  const parsed: unknown = JSON.parse(drive.bodyOf('project-'));
  return typeof parsed === 'object' && parsed !== null && 'edited' in parsed && parsed.edited !== null;
}

/** Another device signed in to the same account: its own browser storage, answered by the same Drive. */
async function otherDevice(browser: Browser, baseURL: string, drive: DriveEmulator): Promise<{page: Page; close: () => Promise<void>}> {
  const context = await browser.newContext({baseURL, viewport: {width: 1280, height: 720}});
  await standInForSnapshotsSite(context);
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ui: {splashSeen: true}}));
    localStorage.setItem('openisd_persist_warning_dismissed', '1');
    localStorage.setItem('openisd_feedback_ask_v1', JSON.stringify({shownAtMs: null, quietUntilMs: 4102444800000, launches: 0}));
    sessionStorage.setItem('openisd_usage_notice_shown', '1');
  });
  await connectedTo(page, drive);
  await page.goto('/');
  return {page, close: () => context.close()};
}

/** Desktop: Sync now from the Cloud sync dialog, then the dialog closed. */
async function syncNow(page: Page): Promise<void> {
  await page.locator('.cloud-sync-badge').click();
  await page.locator('.cloud-modal button', {hasText: 'Sync now'}).click();
  await expect(page.locator('.cloud-sync-badge .icon-cloudDone')).toBeVisible();
  await page.locator('.cloud-modal-x').click();
}

/**
 * Desktop: Sync now when both devices changed the project, then the dialog closed. The run keeps both versions, so what
 * the badge shows when it ends is the conflict mark (the alert cloud with the count 1), never the plain done cloud:
 * waiting for the done cloud passed only on the cloud left over from before the click, and failed whenever the
 * edit-triggered run was still going.
 */
async function syncNowKeepingBoth(page: Page): Promise<void> {
  await page.locator('.cloud-sync-badge').click();
  await page.locator('.cloud-modal button', {hasText: 'Sync now'}).click();
  await expect(page.locator('.cloud-sync-badge .icon-cloudAlert')).toBeVisible();
  await expect(page.locator('.cloud-sync-badge .cloud-sync-badge-num')).toHaveText('1');
  await page.locator('.cloud-modal-x').click();
}

/** Device A has the sample project saved and on Drive; device B has pulled it and opened it from its Projects list. */
async function twoDevicesOnOneProject(page: Page, browser: Browser, baseURL: string) {
  const drive = await connectedToDrive(page);
  await page.goto('/');
  await openAProject(page);
  await page.locator('.tb-btn[title^="Save - "]').click();
  await expect.poll(() => drive.listFiles().filter(f => f.name.startsWith('project-')).length, {timeout: 20_000}).toBe(1);
  const savedVolume = await shownBoxVolume(page);
  const other = await otherDevice(browser, baseURL, drive);
  const row = other.page.locator('.projects-list .project-row', {hasText: PROJECT});
  await expect(row).toBeVisible({timeout: 20_000});
  await row.click();
  await expect.poll(() => shownBoxVolume(other.page)).toBeCloseTo(savedVolume, 3);
  return {drive, other, savedVolume};
}

test.describe('desktop, Cloud sync on, two devices', () => {
  test('an unsaved edit reaches the other device a few seconds after editing stops, marked unsaved there', async ({page, browser}, testInfo) => {
    const {drive, other, savedVolume} = await twoDevicesOnOneProject(page, browser, String(testInfo.project.use.baseURL));
    try {
      await dirtyFocusedDesign(page);
      // No Save: the edit is sent by itself once editing has stopped.
      await expect.poll(() => unsavedOnDrive(drive), {timeout: 20_000}).toBe(true);
      expect(await focusedIsModified(page)).toBe(true);

      await syncNow(other.page);
      await expect.poll(() => shownBoxVolume(other.page)).toBeCloseTo(EDITED_VOLUME_L, 3);
      await expect(other.page.locator('.unsaved-label')).toContainText('Unsaved changes');
      await expect(other.page.locator('.revert-btn')).toBeEnabled();
      // The pulled version is shown in place: one project, no conflict.
      await expect(other.page.locator('.projects-list .project-row')).toHaveCount(1);
      await expect(other.page.locator('.cloud-conflict-notice')).toHaveCount(0);
      expect(savedVolume).not.toBeCloseTo(EDITED_VOLUME_L, 3);
    } finally {
      await other.close();
    }
  });

  test('Revert on the other device goes back to the shared saved version, and that reaches the first device', async ({page, browser}, testInfo) => {
    const {drive, other, savedVolume} = await twoDevicesOnOneProject(page, browser, String(testInfo.project.use.baseURL));
    try {
      await dirtyFocusedDesign(page);
      await expect.poll(() => unsavedOnDrive(drive), {timeout: 20_000}).toBe(true);
      await syncNow(other.page);
      await expect(other.page.locator('.unsaved-label')).toBeVisible();

      await other.page.locator('.revert-btn').click();
      await other.page.locator('.confirm-dialog-confirm').click();
      await expect.poll(() => shownBoxVolume(other.page)).toBeCloseTo(savedVolume, 3);
      await expect(other.page.locator('.unsaved-label')).toHaveCount(0);
      await expect.poll(() => unsavedOnDrive(drive), {timeout: 20_000}).toBe(false);

      await syncNow(page);
      await expect.poll(() => shownBoxVolume(page)).toBeCloseTo(savedVolume, 3);
      await expect(page.locator('.unsaved-label')).toHaveCount(0);
    } finally {
      await other.close();
    }
  });

  test('both devices edit before either syncs: both versions kept, and the notice names both projects', async ({page, browser}, testInfo) => {
    const {drive, other} = await twoDevicesOnOneProject(page, browser, String(testInfo.project.use.baseURL));
    try {
      // The first device's edit is on Drive before the other device, which has not synced since, edits too.
      await dirtyFocusedDesign(page);
      await expect.poll(() => unsavedOnDrive(drive), {timeout: 20_000}).toBe(true);
      // A different edit (the same one on both would be one version, not two).
      await setFocusedBoxVolume(other.page, 0.0444);
      await syncNowKeepingBoth(other.page);

      const notice = other.page.locator('.cloud-conflict-notice');
      await expect(notice).toContainText(`Project "${PROJECT}" kept both: yours and the copy from `);
      await expect(notice).toContainText(`Yours is now "${PROJECT} (conflict, `);
      await expect(other.page.locator('.projects-list .project-row')).toHaveCount(2);
      // This device's version stays open, as the copy, still unsaved.
      await expect(other.page.locator('.unsaved-label')).toBeVisible();
      await expect.poll(() => shownBoxVolume(other.page)).toBeCloseTo(44.4, 3);
    } finally {
      await other.close();
    }
  });
});

test.describe('desktop, Cloud sync on', () => {
  test('the Cloud sync dialog has no list of unsaved projects, and the Save tooltip is the usual one', async ({page}) => {
    await connectedToDrive(page);
    await page.goto('/');
    await openAProject(page);
    await dirtyFocusedDesign(page);
    await expect(page.locator('.tb-btn[aria-label="Save"]')).toHaveAttribute('title', 'Save - saves the file to browser storage. Use Export to save as file');
    await expect(page.locator('.project-save-btn')).toHaveAttribute('title', 'Save the project to browser storage');
    await page.locator('.cloud-sync-badge').click();
    await expect(page.locator('.cloud-modal')).toBeVisible();
    await expect(page.locator('.cloud-modal')).not.toContainText('Not on your other devices yet');
    await expect(page.locator('.cloud-modal')).not.toContainText('Every open project is saved.');
  });
});
