/**
 * A driver changed on two devices, on both skins: sync keeps both. Drive's version keeps the
 * driver's place; this browser's version stays in My Drivers as "<model> (conflict, <day>,
 * <device>)", and the notice names the driver and the other device. Real sync, real Drive client,
 * an emulated Drive behind the network.
 */
import type {Page} from '@playwright/test';
import {formatDay} from '@openisd/design/fields';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {DriveEmulator} from '../fixtures/driveEmulator.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {deviceRecord, MY_DRIVERS_KEY} from '../fixtures/seedMyDrivers.js';
import {enableCloudSync} from './fixtures/cloudSyncStubs.js';

const MODEL = 'W5-1138SMF';
const SPECS = {Fs_hz: 40, Qts: 0.35, Vas_m3: 0.01, Sd_m2: 0.009, Re_ohm: 3.4};
const NOTICE = `Driver "${MODEL}" kept both: yours and the copy from iPhone.`;
const MY_ROWS = '.dlist .my-ditem';
/** The storage layout the seeded store and Drive file are in, as the other cloud specs seed it. */
const LAYOUT = '2';

/** The same driver on Drive (edited on the iPhone) and in this browser (edited here). */
async function driverChangedOnTwoDevices(page: Page): Promise<void> {
  const drive = new DriveEmulator();
  const phoneBody = JSON.stringify(deviceRecord({brand: 'Dayton', model: MODEL, specs: {...SPECS, Fs_hz: 42}}, 'd-1'));
  drive.seed('driver-d-1.json', {
    app: 'openisd', kind: 'driver', uuid: 'd-1', layout: LAYOUT, seq: '1',
    // Not this body's hash: sync hashes what it downloads, and only needs to see it differs.
    writer: 'dev-phone', device: 'iPhone', hash: 'hash-of-the-phone-edit',
  }, phoneBody);
  await page.route('**/www.googleapis.com/**', async route => {
    const request = route.request();
    const reply = await drive.fetch(request.url(), {method: request.method(), headers: request.headers(), body: request.postData() ?? undefined});
    await route.fulfill({status: reply.status, contentType: reply.headers.get('content-type') ?? 'application/json', body: await reply.text()});
  });

  const deskBucket = JSON.stringify({schema: 1, entries: [{uuid: 'd-1', record: deviceRecord({brand: 'Dayton', model: MODEL, specs: SPECS}, 'd-1')}]});
  await enableCloudSync(page);
  await page.addInitScript(([bucket, key, layout]: readonly [string, string, string]) => {
    localStorage.setItem('openisd_storage_layout', layout);
    localStorage.setItem(key, bucket);
    localStorage.setItem('openisd_cloud_auth', JSON.stringify({
      kind: 'token', accessToken: 'ya29.stubbed_test_token', expiresAt_ms: Date.now() + 3_600_000, account: 'john@gmail.com',
    }));
  }, [deskBucket, MY_DRIVERS_KEY, LAYOUT] as const);
}

/** My Drivers holds the driver twice: Drive's under its own name, this browser's marked. */
async function expectBothInMyDrivers(page: Page): Promise<void> {
  const rows = page.locator(MY_ROWS, {hasText: MODEL});
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({hasText: `${MODEL} (conflict, ${formatDay(new Date())}, `})).toHaveCount(1);
}

test('desktop: a driver changed on two devices stays twice in My Drivers, the copy marked', async ({page}) => {
  await driverChangedOnTwoDevices(page);
  await page.goto('/');
  await openAProject(page);
  await expect(page.locator('.cloud-conflict-notice')).toContainText(NOTICE);
  await page.locator('[title*="librar" i]').first().click();
  await expect(page.locator('.dlist')).toBeVisible();
  await expectBothInMyDrivers(page);
});

test('mobile: a driver changed on two devices stays twice in My Drivers, the copy marked', async ({page}) => {
  await forceMobileSkin(page);
  await driverChangedOnTwoDevices(page);
  await page.goto('/');
  await openAMobileProject(page);
  await expect(page.locator('.mob-conflict-banner')).toContainText(NOTICE);
  await page.locator('.mob-tab', {hasText: 'Driver'}).click();
  await page.getByText('Select driver').click();
  await expectBothInMyDrivers(page);
});
