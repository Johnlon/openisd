/**
 * A project open in the workspace follows a pull, on both skins: another device edits it on
 * Drive, this device syncs, and the open project shows the new values without being reopened.
 * Real sync and Drive client over an emulated Drive.
 * bugs/BUG_20261015_synced-open-project-does-not-refresh.md
 */
import type {Page} from '@playwright/test';
import {expect, focusedBoxVolume, openAMobileProject, openAProject, test} from '../fixtures.js';
import {DriveEmulator} from '../fixtures/driveEmulator.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import {enableCloudSync} from './fixtures/cloudSyncStubs.js';

const RENAMED = 'W5-1138SMF Fixture, edited on iPhone';
const PULLED_VOLUME_M3 = 0.02;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The iPhone's edit of a stored project body: a new name and a 20 L vented box. */
function iPhoneEdit(body: string): string {
  const parsed: unknown = JSON.parse(body);
  if (!isRecord(parsed)) throw new Error('stored project is not a record');
  for (const side of ['saved', 'edited']) {
    const state = parsed[side];
    if (!isRecord(state)) continue;
    const {meta, box} = state;
    if (isRecord(meta)) meta['name'] = RENAMED;
    const chamber = isRecord(box) && isRecord(box['vented']) ? box['vented']['chamber'] : null;
    if (isRecord(chamber)) chamber['volume_m3'] = PULLED_VOLUME_M3;
  }
  parsed['label'] = RENAMED;
  return JSON.stringify(parsed);
}

async function connectedToDrive(page: Page): Promise<DriveEmulator> {
  const drive = new DriveEmulator();
  await page.route('**/www.googleapis.com/**', async route => {
    const request = route.request();
    const reply = await drive.fetch(request.url(), {method: request.method(), headers: request.headers(), body: request.postData() ?? undefined});
    await route.fulfill({status: reply.status, contentType: reply.headers.get('content-type') ?? 'application/json', body: await reply.text()});
  });
  await enableCloudSync(page);
  await page.addInitScript(() => {
    localStorage.setItem('openisd_storage_layout', '2');
    localStorage.setItem('openisd_cloud_auth', JSON.stringify({
      kind: 'token', accessToken: 'ya29.stubbed_test_token', expiresAt_ms: Date.now() + 3_600_000, account: 'john@gmail.com',
    }));
  });
  return drive;
}

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
  expect(await focusedBoxVolume(page)).not.toBeCloseTo(PULLED_VOLUME_M3, 6);

  await page.locator('.cloud-sync-badge').click();
  await page.locator('.cloud-modal button', {hasText: 'Sync now'}).click();
  await expect.poll(() => focusedBoxVolume(page)).toBeCloseTo(PULLED_VOLUME_M3, 6);
  await expect(page.getByText(RENAMED).first()).toBeVisible();
});

test('mobile: an open project shows what a pull brought, without reopening it', async ({page}) => {
  await forceMobileSkin(page);
  const drive = await connectedToDrive(page);
  await page.goto('/');
  await openAMobileProject(page);
  await tapMobileMenuItem(page, /^Save$/);
  await iPhoneEditsTheSavedProject(drive);
  expect(await focusedBoxVolume(page)).not.toBeCloseTo(PULLED_VOLUME_M3, 6);

  await tapMobileMenuItem(page, 'Cloud sync');
  await page.locator('.mob-dlg button', {hasText: 'Sync now'}).click();
  await expect.poll(() => focusedBoxVolume(page)).toBeCloseTo(PULLED_VOLUME_M3, 6);
  await page.locator('.mob-dlg').getByRole('button', {name: /^(Close|OK|✕)$/}).last().click();
  await expect(page.getByText(RENAMED).first()).toBeVisible();
});
