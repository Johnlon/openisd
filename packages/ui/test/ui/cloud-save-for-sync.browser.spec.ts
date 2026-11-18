/**
 * Cloud sync sends saved versions only, so with sync ON the app tells people to save and asks them to
 * (John, 18 Nov 2026, QO946.c244 "if cloud sync isn't enabled then don't tell user to save", c245 "ok do that"):
 * the Save tooltip, the Cloud sync dialog's list of unsaved projects, and a bar after 5 minutes of unsaved
 * edits, once per project per session. With sync OFF everything stays as it was. Both skins.
 */
import type {Page} from '@playwright/test';
import {dirtyFocusedDesign, expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';
import {connectedToDrive} from './fixtures/driveConnected.js';
import {enableCloudSync} from './fixtures/cloudSyncStubs.js';

const FIVE_MINUTES = 5 * 60 * 1000;
const SAVE_TOOLTIP = 'Save - to send this version to your other devices';
const USUAL_SAVE_TOOLTIP = 'Save - saves the file to browser storage. Use Export to save as file';
const BAR_TEXT = 'Your changes are not on your other devices yet.';
const DESKTOP_BAR = '[data-testid="save-for-sync-bar"]';
const PROJECT = 'sample-project';

async function connectedDesktop(page: Page): Promise<void> {
  await page.clock.install();
  await connectedToDrive(page);
  await page.goto('/');
  await openAProject(page);
  await expect(page.locator('.cloud-sync-badge .icon-cloudDone')).toBeVisible();
}

async function connectedPhone(page: Page): Promise<void> {
  await page.clock.install();
  await forceMobileSkin(page);
  await page.setViewportSize({width: PIXEL_9.width, height: PIXEL_9.height});
  await connectedToDrive(page);
  await page.goto('/');
  await openAMobileProject(page);
}

test.describe('desktop, Cloud sync on', () => {
  test('the Save button says it sends this version to the other devices', async ({page}) => {
    await connectedDesktop(page);
    await expect(page.locator('.tb-btn[aria-label="Save"]')).toHaveAttribute('title', SAVE_TOOLTIP);
    await expect(page.locator('.project-save-btn')).toHaveAttribute('title', SAVE_TOOLTIP);
  });

  test('the Cloud sync dialog lists the project with unsaved changes, and its Save sends it', async ({page}) => {
    await connectedDesktop(page);
    await dirtyFocusedDesign(page);
    await page.locator('.cloud-sync-badge').click();
    const list = page.locator('.cloud-sync-unsaved-section');
    await expect(list).toContainText('Not on your other devices yet');
    await expect(list).toContainText(PROJECT);
    await list.getByRole('button', {name: `Save ${PROJECT}`}).click();
    await expect(page.locator('.cloud-sync-unsaved-row')).toHaveCount(0);
    await expect(list).toContainText('Every open project is saved.');
    await expect(page.locator('.tb-btn[aria-label="Save"]')).not.toHaveClass(/dirty/);
  });

  test('the dialog keeps its size with no project listed and with two', async ({page}) => {
    await connectedDesktop(page);
    const dialog = page.locator('.cloud-modal');
    const height = async (): Promise<number> => (await dialog.boundingBox())?.height ?? 0;
    await page.locator('.cloud-sync-badge').click();
    await expect(page.locator('.cloud-sync-unsaved-section')).toContainText('Every open project is saved.');
    const none = await height();
    await page.locator('.cloud-modal-x').click();

    await dirtyFocusedDesign(page);
    await openAProject(page, undefined, 'second.owpr');
    await dirtyFocusedDesign(page);
    await page.locator('.cloud-sync-badge').click();
    await expect(page.locator('.cloud-sync-unsaved-row')).toHaveCount(2);
    expect(await height()).toBe(none);
  });

  test('nothing is listed when no project has unsaved changes', async ({page}) => {
    await connectedDesktop(page);
    await page.locator('.cloud-sync-badge').click();
    await expect(page.locator('.cloud-modal')).toBeVisible();
    await expect(page.locator('.cloud-sync-unsaved-section')).toContainText('Every open project is saved.');
    await expect(page.locator('.cloud-sync-unsaved-row')).toHaveCount(0);
  });

  test('5 minutes of unsaved edits bring the bar; Save saves the project and the bar goes', async ({page}) => {
    await connectedDesktop(page);
    await dirtyFocusedDesign(page);
    await page.clock.runFor(FIVE_MINUTES - 60_000);
    await expect(page.locator(DESKTOP_BAR)).toHaveCount(0);
    await page.clock.runFor(2 * 60_000);
    const bar = page.locator(DESKTOP_BAR);
    await expect(bar).toContainText(BAR_TEXT);
    await bar.getByRole('button', {name: 'Save'}).click();
    await expect(bar).toHaveCount(0);
    await expect(page.locator('.tb-btn[aria-label="Save"]')).not.toHaveClass(/dirty/);
  });

  test('Later hides the bar, and it does not come back for that project in the session', async ({page}) => {
    await connectedDesktop(page);
    await dirtyFocusedDesign(page);
    await page.clock.runFor(FIVE_MINUTES + 60_000);
    const bar = page.locator(DESKTOP_BAR);
    await expect(bar).toBeVisible();
    await bar.getByRole('button', {name: 'Later'}).click();
    await expect(bar).toHaveCount(0);
    await page.clock.runFor(30 * 60_000);
    await expect(bar).toHaveCount(0);
  });

  test('the bar waits while a dialog is open and shows when it closes', async ({page}) => {
    await connectedDesktop(page);
    await dirtyFocusedDesign(page);
    await page.locator('.cloud-sync-badge').click();
    await expect(page.locator('.cloud-modal')).toBeVisible();
    await page.clock.runFor(FIVE_MINUTES + 60_000);
    await expect(page.locator(DESKTOP_BAR)).toHaveCount(0);
    await page.locator('.cloud-modal-x').click();
    await page.clock.runFor(20_000);
    await expect(page.locator(DESKTOP_BAR)).toBeVisible();
  });
});

test.describe('desktop, Cloud sync off', () => {
  test('the Save tooltip is as it was, and no bar comes after 30 minutes of unsaved edits', async ({page}) => {
    await page.clock.install();
    await enableCloudSync(page);
    await page.goto('/');
    await openAProject(page);
    await expect(page.locator('.tb-btn[aria-label="Save"]')).toHaveAttribute('title', USUAL_SAVE_TOOLTIP);
    await dirtyFocusedDesign(page);
    await page.clock.runFor(30 * 60_000);
    await expect(page.locator(DESKTOP_BAR)).toHaveCount(0);
    await page.locator('.cloud-sync-badge').click();
    await expect(page.locator('.cloud-modal')).toBeVisible();
    await expect(page.locator('.cloud-sync-unsaved-section')).toHaveCount(0);
  });
});

test.describe('phone, Cloud sync on', () => {
  test('a lit Save button says it sends this version; a saved one still says Saved', async ({page}) => {
    await connectedPhone(page);
    await expect(page.getByTestId('mob-save')).toHaveAttribute('title', 'Saved');
    await dirtyFocusedDesign(page);
    await expect(page.getByTestId('mob-save')).toHaveAttribute('title', SAVE_TOOLTIP);
  });

  test('5 minutes of unsaved edits bring the bar above the tab bar; Save saves and it goes', async ({page}) => {
    await connectedPhone(page);
    await dirtyFocusedDesign(page);
    await page.clock.runFor(FIVE_MINUTES + 60_000);
    const bar = page.getByTestId('save-for-sync-bar');
    await expect(bar).toContainText(BAR_TEXT);
    await bar.getByRole('button', {name: 'Save'}).click();
    await expect(bar).toHaveCount(0);
    await expect(page.getByTestId('mob-save')).toHaveAttribute('title', 'Saved');
  });

  test('the Cloud sync pane lists the unsaved project with a Save', async ({page}) => {
    await connectedPhone(page);
    await dirtyFocusedDesign(page);
    await tapMobileMenuItem(page, 'Cloud sync');
    const row = page.locator('.cloud-sync-unsaved-row');
    await expect(row).toContainText(PROJECT);
    await row.getByRole('button', {name: `Save ${PROJECT}`}).click();
    await expect(page.locator('.cloud-sync-unsaved-row')).toHaveCount(0);
  });
});
