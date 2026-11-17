import type {Page} from '@playwright/test';
import {ANNOUNCEMENTS_URL} from '../../src/logic/announcementCenter.js';
import {deviceRecord} from './seedMyDrivers.js';
import {tapMobileMenuItem} from './mobileSkin.js';
import {WalkSkin} from './viewOpenTypes.js';
import type {OpenStep} from './viewOpenTypes.js';

/**
 * Open steps for the views that need data saved in the browser before the app starts (T771, batch 2).
 * The saved data is what a user would have: a text in browser storage written before launch, a feed from
 * the announcement address (the outside system, answered by a stand-in), or a backup made with the Options button.
 * The app is then started by going to its address, as a user returning to it would.
 */

const SPLASH_SEEN = JSON.stringify({ui: {splashSeen: true}});

/** Phone and desktop reach the same dialog by their own menus; the splash is left as a returning user left it. */
async function launchWith(page: Page, savedViewText: string): Promise<void> {
  await page.addInitScript((text: string) => { localStorage.setItem('openisd_view', text); }, savedViewText);
  await page.goto('/');
}

/** Announcement feed stand-in: the address answers with one announcement the user has not seen. */
const announcementCurrent: OpenStep = {root: '.ann-modal', open: async page => {
  const item = {id: 'walk-announcement-1', version: '7.0.999', published: '2026-11-10', title: 'Mobile controls and driver library fixes', summary: 'The fields are more consistent.', body: ['Alignment units are part of the control.'], href: 'https://openisd.app/'};
  await page.route(ANNOUNCEMENTS_URL, route => route.fulfill({status: 200, contentType: 'application/json', headers: {'Cache-Control': 'no-store'}, body: JSON.stringify({version: 1, announcements: [item]})}));
  await launchWith(page, SPLASH_SEEN);
  await page.locator('.ann-modal').waitFor({state: 'visible'});
}};

/** A saved view this build refuses (no ui object): the app logs a stored-data fault and opens Diagnostics, which offers a repair; Apply shows its outcome. */
const diagnosticRepairs = (skin: WalkSkin): OpenStep => ({root: skin === WalkSkin.Phone ? '.mob-dlg' : '.dg', expectedConsoleError: /StoredDataFault: saved view state carries no ui object/, open: async page => {
  await launchWith(page, '{}');
  // The app opens Diagnostics itself when it meets the fault; Apply is what a user presses next.
  await page.locator(skin === WalkSkin.Phone ? '.mob-dlg' : '.dg').waitFor({state: 'visible'});
  // On the phone the welcome splash (no saved view to say it was seen) is drawn over the dialog; the user closes it first.
  if (skin === WalkSkin.Phone) await page.getByRole('button', {name: 'Start designing'}).click();
  const download = page.waitForEvent('download');
  await page.locator('.dg-fix').getByRole('button', {name: 'Apply', exact: true}).first().click();
  await download;
  await page.locator('.dg-outcome').waitFor({state: 'visible'});
}});

/** One saved driver entry this build cannot read: Manage Drivers lists it as a flagged row. */
const brokenDriverEntry = (skin: WalkSkin): OpenStep => ({root: skin === WalkSkin.Phone ? '.mob-dlg' : '.wb-modal', open: async page => {
  const good = {uuid: 'u-ok', record: deviceRecord({brand: 'Good', model: 'One', specs: {Fs_hz: 41, Re_ohm: 5.4, Sd_m2: 0.0132, Qts: 0.35, Qes: 0.38}}, 'u-ok')};
  const broken = {brand: {value: 'Ghost'}, model: {value: 'Blob'}, halfARecord: true};
  await page.addInitScript((value: string) => { localStorage.setItem('openisd_my_drivers', value); }, JSON.stringify({schema: 1, entries: [broken, good]}));
  await page.goto('/');
  switch (skin) {
    case WalkSkin.Phone: await tapMobileMenuItem(page, 'Manage Drivers'); break;
    case WalkSkin.Desktop: await page.locator('[title*="librar" i]').first().click(); break;
  }
  await page.locator('.my-broken-row').waitFor({state: 'visible'});
}});

/** The project is saved, a backup is made from Options > Your data, and Restore on its row opens the project list. */
const storageRestorePicker = (skin: WalkSkin): OpenStep => ({root: skin === WalkSkin.Phone ? '.opt-phone' : '.opt-modal', open: async page => {
  switch (skin) {
    case WalkSkin.Phone: await tapMobileMenuItem(page, /^Save$/); await tapMobileMenuItem(page, 'Options'); break;
    case WalkSkin.Desktop: await page.locator('.tb-btn[title^="Save - "]').click(); await page.locator('.tb-btn[title="Options"]').click(); break;
  }
  await page.locator('.opt-tab, .opt-phone-tabs button', {hasText: 'Your data'}).click();
  await page.locator('.sh-backup-now').click();
  const row = page.locator('.sh-row').filter({has: page.locator('.sh-reason', {hasText: 'Back up now'})});
  await row.locator('.sh-restore-one').click();
  await row.locator('.sh-picker').waitFor({state: 'visible'});
}});

/** The step table: view id and skin to its open step. */
export const SAVED_STATE_STEPS: readonly (readonly [WalkSkin, string, OpenStep])[] = [
  [WalkSkin.Phone, 'announcements-current', announcementCurrent],
  [WalkSkin.Desktop, 'desktop/announcements-current', announcementCurrent],
  [WalkSkin.Phone, 'diagnostic-repairs', diagnosticRepairs(WalkSkin.Phone)],
  [WalkSkin.Desktop, 'desktop/diagnostic-repairs', diagnosticRepairs(WalkSkin.Desktop)],
  [WalkSkin.Phone, 'shared/driver-library-broken-entry', brokenDriverEntry(WalkSkin.Phone)],
  [WalkSkin.Desktop, 'shared/driver-library-broken-entry', brokenDriverEntry(WalkSkin.Desktop)],
  [WalkSkin.Phone, 'shared/storage-restore-picker', storageRestorePicker(WalkSkin.Phone)],
  [WalkSkin.Desktop, 'shared/storage-restore-picker', storageRestorePicker(WalkSkin.Desktop)],
];
