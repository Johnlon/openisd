import type {Page} from '@playwright/test';
import {dirtyFocusedDesign} from '../fixtures.js';
import {tapMobileMenuItem} from './mobileSkin.js';
import {deliverWaitingBuild} from './updateHost.js';
import {WalkSkin} from './viewOpenTypes.js';
import type {OpenStep} from './viewOpenTypes.js';

/**
 * Open steps for the views that show only when something outside the app goes wrong (T775, batch 5).
 * The outside system is stood in for, never the app's own state: the service worker (a new build waits),
 * the network (the app's main file does not arrive), the browser (storage is nearly full, refused, or
 * holds a layout written by a newer app). A page's uncaught error is raised as the browser raises it.
 */

const P = WalkSkin.Phone, D = WalkSkin.Desktop;

/** A user who has been here before: the welcome splash and the notices already seen are out of the way. */
async function returningUser(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ui: {splashSeen: true}}));
    localStorage.setItem('openisd_persist_warning_dismissed', '1');
  });
}

/** Unsaved edits and a waiting new build: the app offers the update. */
const updateStrip: OpenStep = {root: '[data-testid="update-strip"]', open: async page => {
  await dirtyFocusedDesign(page);
  await deliverWaitingBuild(page);
  await page.getByTestId('update-strip').waitFor({state: 'visible'});
}};

/** The same offer, Reload pressed: the app asks about the unsaved edits first. */
const updateReloadAsk: OpenStep = {root: '.confirm-modal', open: async page => {
  await dirtyFocusedDesign(page);
  await deliverWaitingBuild(page);
  await page.getByTestId('update-reload').click();
  await page.locator('.confirm-modal').filter({hasText: 'Discard changes?'}).waitFor({state: 'visible'});
}};

/** An uncaught error in the running page: the crash and report screen. */
const crash: OpenStep = {root: '[data-testid="crash-screen"]', open: async page => {
  await page.evaluate(() => { globalThis.dispatchEvent(new ErrorEvent('error', {error: new Error('view walk: uncaught error'), message: 'view walk: uncaught error'})); });
  await page.getByTestId('crash-screen').waitFor({state: 'visible'});
}};

/** The network does not deliver the app's main file: the loading failure screen. */
const startupFailure: OpenStep = {root: '#boot-failed', expectedConsoleError: /Failed to load resource|ERR_FAILED|net::/, open: async page => {
  await page.route(/\/assets\/main-[^/?]*\.js(\?|$)/, route => route.abort());
  await page.goto('/');
  await page.locator('#boot-failed').waitFor({state: 'visible'});
}};

/** The browser says storage is 99 % used and will not keep the data. */
async function refusingNearlyFullBrowser(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {persisted: () => Promise.resolve(false), persist: () => Promise.resolve(false), estimate: () => Promise.resolve({usage: 99, quota: 100})},
    });
  });
}

/** Start of a returning user's visit on a browser that refuses to keep the data and is nearly full. */
async function startOnFullBrowser(page: Page): Promise<void> {
  await page.addInitScript(() => { localStorage.setItem('openisd_view', JSON.stringify({ui: {splashSeen: true}})); });
  await refusingNearlyFullBrowser(page);
  await page.goto('/');
}

const storageUsage: OpenStep = {root: '[role="alertdialog"]', open: async page => {
  await startOnFullBrowser(page);
  await page.getByRole('alertdialog', {name: 'Storage is nearly full'}).waitFor({state: 'visible'});
}};

/** Options, Your data, on that browser: the warning lines above the usage. */
const storageWarning = (skin: WalkSkin): OpenStep => ({root: skin === P ? '.opt-phone' : '.opt-modal', open: async page => {
  await startOnFullBrowser(page);
  await page.getByRole('alertdialog', {name: 'Storage is nearly full'}).getByRole('button', {name: 'Close', exact: true}).click();
  switch (skin) {
    case P: await tapMobileMenuItem(page, 'Options'); break;
    case D: await page.locator('.tb-btn[title="Options"]').click(); break;
  }
  await page.locator('.opt-tab, .opt-phone-tabs button', {hasText: 'Your data'}).click();
  await page.locator('.su-warning').first().waitFor({state: 'visible'});
}});

/** The saved data was written by a newer OpenISD layout: the app does not open it. */
const storeGate: OpenStep = {root: '[data-testid="store-gate"]', open: async page => {
  await page.addInitScript(() => { localStorage.setItem('openisd_storage_layout', '99'); localStorage.setItem('openisd_projects', 'projects from the future'); });
  await page.goto('/');
  await page.getByTestId('store-gate').waitFor({state: 'visible'});
}};

/** The saved drivers text is damaged: Manage Drivers is blocked until the user exports or deletes. */
const driverStorageError: OpenStep = {root: '.my-storage-modal', open: async page => {
  await returningUser(page);
  await page.addInitScript(() => { localStorage.setItem('openisd_my_drivers', '{"schema": 2, "drivers": NOT-VALID-JSON'); });
  await page.goto('/');
  await tapMobileMenuItem(page, 'Manage Drivers');
  await page.locator('.my-storage-modal').waitFor({state: 'visible'});
}};

/** The step table: skin and view id to its open step. */
export const FAULT_STEPS: readonly (readonly [WalkSkin, string, OpenStep])[] = [
  [P, 'phone/update-strip', updateStrip],
  [D, 'desktop/cloud/update-strip', updateStrip],
  [P, 'update', updateReloadAsk],
  [P, 'crash', crash],
  [D, 'desktop/crash', crash],
  [P, 'startup-failure', startupFailure],
  [D, 'desktop/startup-failure', startupFailure],
  [P, 'storage-usage', storageUsage],
  [D, 'desktop/storage-usage-warning', storageUsage],
  [P, 'shared/storage-warning', storageWarning(P)],
  [D, 'shared/storage-warning', storageWarning(D)],
  [P, 'shared/store-gate', storeGate],
  [D, 'shared/store-gate', storeGate],
  [P, 'driver-storage-error', driverStorageError],
];
