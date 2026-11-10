import type {Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {dirtyFocusedDesign, openAMobileProject} from '../fixtures.js';
import {tapMobileMenuItem} from './mobileSkin.js';
import {openPhoneWizardStep, phoneTab} from './viewOpenNavigation.js';
import {WalkSkin} from './viewOpenTypes.js';
import type {OpenStep} from './viewOpenTypes.js';

/**
 * Open steps for the phone's information cards, help sheets, notes and strips (T778, batch 6c).
 * Each does the taps the index says; the outside system (the hosted list of builds) is answered by a stand-in.
 */

const P = WalkSkin.Phone;
const BUILD_INFO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'build-info.json');

/** The running build's stamp as scripts/version-info.mjs wrote it ("v20261016T2241Z" gives "20261016T2241Z"). */
function runningStamp(): string {
  const parsed: unknown = JSON.parse(readFileSync(BUILD_INFO, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed) || typeof parsed.version !== 'string') throw new Error('build-info.json has no string "version"');
  return parsed.version.replace(/^v/, '');
}

const placementInfo: OpenStep = {root: '.mob-np-icard', open: async page => {
  await openPhoneWizardStep(page, 'sealed', 2);
  await page.getByRole('button', {name: 'About driver placement'}).click();
  await page.locator('.mob-np-icard').waitFor({state: 'visible'});
}};

const ebpInfo: OpenStep = {root: '.mob-np-icard', open: async page => {
  await openPhoneWizardStep(page, 'sealed', 3);
  await page.getByRole('button', {name: 'About EBP'}).click();
  await page.locator('.mob-np-icard').waitFor({state: 'visible'});
}};

const isobarikNote: OpenStep = {root: '.mob-np-overlay', open: async page => {
  await openPhoneWizardStep(page, 'sealed', 2);
  await page.locator('#np-placement').selectOption('iso');
  await page.locator('.mob-np-pic-caption').waitFor({state: 'visible'});
}};

const wizardHelp: OpenStep = {root: '.mob-help-sheet', open: async page => {
  await openPhoneWizardStep(page, 'sealed', 3);
  await page.locator('.mob-np-help').click();
  await page.locator('.mob-help-sheet').waitFor({state: 'visible'});
}};

/** The ? on a section band (Box page, first band). */
const sectionHelp: OpenStep = {root: '.mob-help-sheet', open: async page => {
  await phoneTab(page, 'Box');
  await page.locator('.mob-band-help').first().click();
  await page.locator('.mob-help-sheet').waitFor({state: 'visible'});
}};

/** Revert unsaved changes asks first. */
const confirmation: OpenStep = {root: '.confirm-modal', open: async page => {
  await dirtyFocusedDesign(page);
  await tapMobileMenuItem(page, 'Revert unsaved changes');
  await page.locator('.confirm-modal').waitFor({state: 'visible'});
}};

/** About OpenISD opens with the version line and its change log link; the hosted list of builds names this build. */
const aboutVersion: OpenStep = {root: '.sp', open: async page => {
  const stamp = runningStamp();
  await page.route('**/v/index.json', route => route.fulfill({json: [
    {stamp, kind: 'release', tag: `v${stamp}`, version: '7.0.952', url: 'https://example.test/r', published: stamp, subject: 'x', latest: true},
  ]}));
  await page.goto('/');
  await tapMobileMenuItem(page, 'About OpenISD');
  await page.getByTestId('about-version-line').waitFor({state: 'visible'});
}};

/** Menu, Open a file: the browser's file chooser is asked for, and the menu is shown again to measure. */
async function openFileMenu(page: Page, item: string): Promise<void> {
  await page.locator('.mob-hamburger').click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.mob-menu-item', {hasText: item}).click();
  await chooser;
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-overlay').waitFor({state: 'visible'});
}
/** The browser has no file-picker API of its own (as Firefox and Safari have none), so the app falls back to the page's file chooser. */
const projectImport: OpenStep = {root: '.mob-menu-overlay', open: async page => {
  await page.addInitScript(() => { Reflect.deleteProperty(globalThis, 'showOpenFilePicker'); });
  await page.goto('/');
  await openAMobileProject(page);
  await openFileMenu(page, 'Open a file');
}};

/** Options, General: the ? on the vented design limits opens its explanation. */
const optionsLimitsHelp: OpenStep = {root: '[data-testid="limits-more-popup"]', open: async page => {
  await tapMobileMenuItem(page, 'Options');
  await page.locator('.opt-phone').getByText('More info').click();
  await page.locator('[data-testid="limits-more-popup"]').waitFor({state: 'visible'});
}};

/** A Pass-band tuning on the passive radiator box carries the ≠W cue; tapping it says what WinISD does. */
const differenceCue: OpenStep = {root: '.mob-dlg', open: async page => {
  await phoneTab(page, 'Box');
  await page.locator('#mob-box-type').selectOption('box-passive-radiator');
  await page.locator('.winisd-deviation-cue').first().click();
  await page.locator('.mob-dlg').waitFor({state: 'visible'});
}};

/** The Filters page: a filter card is added, folded, then tapped open to show its fields inline. */
const filterCardBody: OpenStep = {root: '.mob-fcard', open: async page => {
  await phoneTab(page, 'Filters');
  await page.getByRole('button', {name: '+ LP', exact: true}).click();
  const card = page.locator('.mob-fcard').first();
  await card.locator('.mob-fcard-fold').click();
  await card.locator('.mob-fcard-fold').click();
  await card.locator('.mob-fcard-fold[aria-expanded="true"]').waitFor({state: 'visible'});
}};

/** Save pressed: a note hangs under the button. */
const saveNote: OpenStep = {root: '.mob-save-wrap', open: async page => {
  await dirtyFocusedDesign(page);
  await page.getByTestId('mob-save').click();
  await page.locator('.mob-save-note').waitFor({state: 'visible'});
}};

/** Save pressed: the short message strip above the tab bar. */
const flashStrip: OpenStep = {root: '[data-testid="flash-strip"]', open: async page => {
  await dirtyFocusedDesign(page);
  await page.getByTestId('mob-save').click();
  await page.getByTestId('flash-strip').waitFor({state: 'visible'});
}};

/** The step table: skin and view id to its open step. */
export const PHONE_NOTE_STEPS: readonly (readonly [WalkSkin, string, OpenStep])[] = [
  [P, 'wizard-placement', placementInfo],
  [P, 'wizard-ebp', ebpInfo],
  [P, 'phone/wizard-isobarik-note', isobarikNote],
  [P, 'wizard-help', wizardHelp],
  [P, 'section-help', sectionHelp],
  [P, 'confirmation', confirmation],
  [P, 'about-version', aboutVersion],
  [P, 'project-import', projectImport],
  [P, 'options-limits-help', optionsLimitsHelp],
  [P, 'phone/difference-cue', differenceCue],
  [P, 'phone/filter-card-body', filterCardBody],
  [P, 'phone/save-note', saveNote],
  [P, 'phone/flash-strip', flashStrip],
];
