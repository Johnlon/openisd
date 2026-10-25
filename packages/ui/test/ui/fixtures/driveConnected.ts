/** A page signed in to an emulated Google Drive, and the iPhone's edit of a stored project.
 *  Real sync and Drive client; only Google's servers are emulated. */
import type {Page} from '@playwright/test';
import {DriveEmulator} from '../../fixtures/driveEmulator.js';
import {enableCloudSync} from './cloudSyncStubs.js';

export const RENAMED = 'W5-1138SMF Fixture, edited on iPhone';
export const PULLED_VOLUME_M3 = 0.02;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The iPhone's edit of a stored project body: a new name and a 20 L vented box. */
export function iPhoneEdit(body: string): string {
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

/** Every www.googleapis.com request answered by a Drive emulator, as Google's server would. */
export async function emulateDriveServer(page: Page): Promise<DriveEmulator> {
  const drive = new DriveEmulator();
  await page.route('**/www.googleapis.com/**', async route => {
    const request = route.request();
    const reply = await drive.fetch(request.url(), {method: request.method(), headers: request.headers(), body: request.postData() ?? undefined});
    await route.fulfill({status: reply.status, contentType: reply.headers.get('content-type') ?? 'application/json', body: await reply.text()});
  });
  return drive;
}

/** Signed in to Drive, with every Drive request answered by the emulator. */
export async function connectedToDrive(page: Page): Promise<DriveEmulator> {
  const drive = await emulateDriveServer(page);
  await enableCloudSync(page);
  await page.addInitScript(() => {
    localStorage.setItem('openisd_storage_layout', '2');
    localStorage.setItem('openisd_cloud_auth', JSON.stringify({
      kind: 'token', accessToken: 'ya29.stubbed_test_token', expiresAt_ms: Date.now() + 3_600_000, account: 'john@gmail.com',
    }));
  });
  return drive;
}
