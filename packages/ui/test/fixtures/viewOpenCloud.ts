import type {Page} from '@playwright/test';
import {openAMobileProject, openAProject} from '../fixtures.js';
import {DriveEmulator} from './driveEmulator.js';
import {tapMobileMenuItem} from './mobileSkin.js';
import {deviceRecord, MY_DRIVERS_KEY} from './seedMyDrivers.js';
import {WalkSkin} from './viewOpenTypes.js';
import type {OpenStep} from './viewOpenTypes.js';
import {CURRENT_STORAGE_LAYOUT, enableCloudSync, stubGoogleApis} from '../ui/fixtures/cloudSyncStubs.js';

/**
 * Open steps for the cloud views (T772, batch 3). Google is the outside system and is answered by a stand-in
 * (the sign-in redirect and Drive); the app is built with a client id as the cloud specs build it. What the
 * user would have is written to browser storage before launch: a signed-in account, a "needs reconnecting"
 * account, the sync hint's launch count. The app is then started by going to its address.
 */

const MODEL = 'W5-1138SMF';
const SPECS = {Fs_hz: 40, Qts: 0.35, Vas_m3: 0.01, Sd_m2: 0.009, Re_ohm: 3.4};

/** The saved Google account, written before launch as the app saved it: signed in, or asked to connect again. */
async function savedAccount(page: Page, kind: 'token' | 'reconnect'): Promise<void> {
  await enableCloudSync(page);
  await stubGoogleApis(page);
  await page.addInitScript(([layout, accountKind]: readonly [string, string]) => {
    localStorage.setItem('openisd_storage_layout', layout);
    const signedIn = {kind: 'token', accessToken: 'ya29.stubbed_test_token', expiresAt_ms: Date.now() + 3_600_000, account: 'john@gmail.com'};
    localStorage.setItem('openisd_cloud_auth', JSON.stringify(accountKind === 'token' ? signedIn : {kind: 'reconnect', account: 'john@gmail.com'}));
  }, [CURRENT_STORAGE_LAYOUT, kind] as const);
}

/** Starts the app and opens a project, as the walk's first screen does, in the skin. */
async function launch(page: Page, skin: WalkSkin): Promise<void> {
  await page.goto('/');
  switch (skin) {
    case WalkSkin.Phone: await openAMobileProject(page); break;
    case WalkSkin.Desktop: await openAProject(page); break;
  }
}

/** The Cloud sync dialog, opened from the phone menu or the desktop toolbar badge. */
async function openCloudDialog(page: Page, skin: WalkSkin): Promise<void> {
  switch (skin) {
    case WalkSkin.Phone: await tapMobileMenuItem(page, 'Cloud sync'); await page.locator('.mob-dlg .cloud-sync-dialog').waitFor({state: 'visible'}); break;
    case WalkSkin.Desktop: await page.locator('.cloud-sync-badge').click(); await page.locator('.cloud-modal').waitFor({state: 'visible'}); break;
  }
}

const dialogRoot = (skin: WalkSkin) => skin === WalkSkin.Phone ? '.mob-dlg' : '.cloud-modal';

/** Signed in: the dialog shows the account and the activity. */
const cloudDialog = (skin: WalkSkin): OpenStep => ({root: dialogRoot(skin), open: async page => {
  await savedAccount(page, 'token');
  await launch(page, skin);
  await openCloudDialog(page, skin);
}});

/** Signed in, Disconnect pressed: the app asks first. */
const cloudConfirm = (skin: WalkSkin): OpenStep => ({root: '.confirm-overlay', open: async page => {
  await savedAccount(page, 'token');
  await launch(page, skin);
  await openCloudDialog(page, skin);
  await page.locator(dialogRoot(skin)).locator('button', {hasText: 'Disconnect'}).click();
  await page.locator('.confirm-overlay').waitFor({state: 'visible'});
}});

/** The saved account has to be connected again: a strip tells the user. */
const reconnectStrip = (skin: WalkSkin): OpenStep => ({root: skin === WalkSkin.Phone ? '.mob-reconnect-banner' : '.cloud-reconnect-strip', open: async page => {
  await savedAccount(page, 'reconnect');
  await launch(page, skin);
  await page.locator(skin === WalkSkin.Phone ? '.mob-reconnect-banner' : '.cloud-reconnect-strip').waitFor({state: 'visible'});
}});

/** A driver edited on two devices: Drive (stand-in) holds the other device's copy, this browser holds its own. */
const conflictNotice = (skin: WalkSkin): OpenStep => ({root: skin === WalkSkin.Phone ? '.mob-conflict-banner' : '.cloud-conflict-notice:not(.update-strip)', open: async page => {
  const drive = new DriveEmulator();
  drive.seed('driver-d-1.json', {
    app: 'openisd', kind: 'driver', uuid: 'd-1', layout: CURRENT_STORAGE_LAYOUT, seq: '1',
    writer: 'dev-phone', device: 'iPhone', hash: 'hash-of-the-phone-edit',
  }, JSON.stringify(deviceRecord({brand: 'Dayton', model: MODEL, specs: {...SPECS, Fs_hz: 42}}, 'd-1')));
  await page.route('**/www.googleapis.com/**', async route => {
    const request = route.request();
    const reply = await drive.fetch(request.url(), {method: request.method(), headers: request.headers(), body: request.postData() ?? undefined});
    await route.fulfill({status: reply.status, contentType: reply.headers.get('content-type') ?? 'application/json', body: await reply.text()});
  });
  await enableCloudSync(page);
  const bucket = JSON.stringify({schema: 1, entries: [{uuid: 'd-1', record: deviceRecord({brand: 'Dayton', model: MODEL, specs: SPECS}, 'd-1')}]});
  await page.addInitScript(([storedBucket, key, layout]: readonly [string, string, string]) => {
    localStorage.setItem('openisd_storage_layout', layout);
    localStorage.setItem(key, storedBucket);
    localStorage.setItem('openisd_cloud_auth', JSON.stringify({kind: 'token', accessToken: 'ya29.stubbed_test_token', expiresAt_ms: Date.now() + 3_600_000, account: 'john@gmail.com'}));
  }, [bucket, MY_DRIVERS_KEY, CURRENT_STORAGE_LAYOUT] as const);
  await launch(page, skin);
  await page.locator(skin === WalkSkin.Phone ? '.mob-conflict-banner' : '.cloud-conflict-notice:not(.update-strip)').waitFor({state: 'visible'});
}});

/** The second launch of a build with cloud sync and no account: the hint offers to turn it on. */
const hint = (skin: WalkSkin): OpenStep => ({root: skin === WalkSkin.Phone ? '.mob-hint-banner' : '.cloud-hint', open: async page => {
  await enableCloudSync(page);
  await stubGoogleApis(page);
  await page.addInitScript(() => { localStorage.setItem('openisd_cloud_ui', JSON.stringify({launches: 1, hintDismissed: false, conflictsSeen: 0})); });
  await launch(page, skin);
  await page.locator(skin === WalkSkin.Phone ? '.mob-hint-banner' : '.cloud-hint').waitFor({state: 'visible'});
}});

const P = WalkSkin.Phone, D = WalkSkin.Desktop;

/** The step table: skin and view id to its open step. */
export const CLOUD_STEPS: readonly (readonly [WalkSkin, string, OpenStep])[] = [
  [P, 'cloud', cloudDialog(P)],
  [D, 'desktop/settings/cloud/account-and-activity', cloudDialog(D)],
  [P, 'cloud-confirm', cloudConfirm(P)],
  [D, 'desktop/cloud-confirm', cloudConfirm(D)],
  [P, 'phone/cloud-reconnect-strip', reconnectStrip(P)],
  [D, 'desktop/cloud/reconnect-strip', reconnectStrip(D)],
  [P, 'phone/cloud-conflict-notice', conflictNotice(P)],
  [D, 'desktop/cloud/conflict-notice', conflictNotice(D)],
  [P, 'phone/cloud-hint', hint(P)],
  [D, 'desktop/cloud/hint', hint(D)],
];
