import type {Page} from '@playwright/test';
import {fillAndBlur} from './numField.js';
import {tapMobileMenuItem} from './mobileSkin.js';
import {deviceRecord, MY_DRIVERS_KEY} from './seedMyDrivers.js';
import {driverEditor, openPhoneWizardStep, phoneTab} from './viewOpenNavigation.js';
import {WalkSkin} from './viewOpenTypes.js';
import type {OpenStep} from './viewOpenTypes.js';

/**
 * Open steps for the phone driver screens (T777, batch 6b): the driver library, its filters and
 * summaries, and what the driver editor opens from its footer and its More menu.
 */

const P = WalkSkin.Phone;

/** The project driver's editor on its Parameters page. */
async function editorOnParameters(page: Page): Promise<void> {
  await driverEditor(page, P);
  await page.locator('.de-tabs').getByRole('button', {name: 'Parameters', exact: true}).click();
}

/** The More menu of the editor. */
async function editorMore(page: Page): Promise<void> {
  await driverEditor(page, P);
  await page.locator('.de-more').click();
  await page.locator('.de-more-menu').waitFor({state: 'visible'});
}

const summaryManage: OpenStep = {root: '.mob-dlg', open: async page => {
  await tapMobileMenuItem(page, 'Manage Drivers');
  await page.locator('.driver-library .ditem').first().click();
  await page.locator('.prev-footer').waitFor({state: 'visible'});
}};

const summaryPick: OpenStep = {root: '.mob-np-overlay', open: async page => {
  await openPhoneWizardStep(page, 'sealed', 1);
  await page.locator('.driver-library .ditem').first().click();
  await page.locator('.driver-library .preview').waitFor({state: 'visible'});
}};

const searchFilters: OpenStep = {root: '.wb-modal', open: async page => {
  await phoneTab(page, 'Driver');
  await page.getByRole('button', {name: 'Select driver', exact: true}).click();
  await page.locator('.dl-filters-toggle').click();
  await page.locator('.param-row').waitFor({state: 'visible'});
}};

const driverExport: OpenStep = {root: '.fmt-panel', open: async page => {
  await editorMore(page);
  await page.getByRole('menuitem', {name: 'Export', exact: true}).click();
  await page.getByRole('dialog', {name: 'Choose driver file format'}).waitFor({state: 'visible'});
}};

const driverSave: OpenStep = {root: '.save-lib-panel', open: async page => {
  await editorMore(page);
  await page.getByRole('menuitem', {name: 'Copy to My Drivers'}).click();
  await page.locator('.save-lib-panel').waitFor({state: 'visible'});
}};

/** The same More menu, read for its Import row: Import is a row of this menu. */
const driverImport: OpenStep = {root: '.de-more-menu', open: editorMore};

const equations: OpenStep = {root: '.eq-inspector-card', open: async page => {
  await editorOnParameters(page);
  // The switch leaves the screen once it is on (the phone hides the toolbar while inspecting), so it is pressed, not read back.
  await page.getByRole('checkbox', {name: 'Inspect Provenance'}).click();
  await page.locator('.de-fld:has-text("Qts") input').first().click();
  await page.locator('.eq-inspector-card').waitFor({state: 'visible'});
}};

/** BL typed as 3 T·m: the driver's values no longer agree, and the editor lists the disagreements. */
const driverDisagreements: OpenStep = {root: '.de-dq-bar', open: async page => {
  await editorOnParameters(page);
  await fillAndBlur(page.locator('.de-fld', {has: page.locator('label', {hasText: /^BL\b/})}).locator('input').first(), '3');
  await page.locator('.de-dq-head').click();
  await page.locator('.de-dq-list').waitFor({state: 'visible'});
}};

/** A saved driver whose brand or model is changed and saved: the app asks to rename it or keep a copy. */
const driverRename: OpenStep = {root: '.de-rename-panel', open: async page => {
  const entry = {uuid: 'u-edit', record: deviceRecord({brand: 'Orig', model: 'Name', specs: {Fs_hz: 41, Re_ohm: 5.4, Sd_m2: 0.0132, Qts: 0.35, Qes: 0.38}}, 'u-edit')};
  await page.addInitScript(([key, value]: readonly [string, string]) => { localStorage.setItem(key, value); }, [MY_DRIVERS_KEY, JSON.stringify({schema: 1, entries: [entry]})] as const);
  await page.goto('/');
  await tapMobileMenuItem(page, 'Manage Drivers');
  await page.locator('.my-ditem .my-edit').first().click();
  await page.locator('.de-modal').waitFor({state: 'visible'});
  await page.getByRole('button', {name: 'OK', exact: true}).click();
  await fillAndBlur(page.locator('input.save-model-input'), 'Renamed');
  await page.locator('.save-confirm-btn').click();
  await page.locator('.de-rename-panel').waitFor({state: 'visible'});
}};

/** The step table: skin and view id to its open step. */
export const PHONE_DRIVER_STEPS: readonly (readonly [WalkSkin, string, OpenStep])[] = [
  [P, 'driver-summary-manage', summaryManage],
  [P, 'driver-summary-pick', summaryPick],
  [P, 'driver-search-filters', searchFilters],
  [P, 'driver-export', driverExport],
  [P, 'driver-save', driverSave],
  [P, 'driver-import', driverImport],
  [P, 'equations', equations],
  [P, 'driver-dq', driverDisagreements],
  [P, 'driver-rename', driverRename],
];
