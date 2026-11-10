import type {Page} from '@playwright/test';
import {dirtyFocusedDesign, setFocusedBoxType} from '../fixtures.js';
import type {BoxTypeName} from '../fixtures.js';
import {fillAndBlur} from './numField.js';
import {deviceRecord, MY_DRIVERS_KEY} from './seedMyDrivers.js';
import {WalkSkin} from './viewOpenTypes.js';
import type {OpenStep} from './viewOpenTypes.js';

/**
 * Open steps for desktop dialogs, notes and panels (T781, batch 6d). Each does what the index says
 * under "reach": clicks, in order, on the real desktop screen.
 */

const D = WalkSkin.Desktop;

/** The project driver's editor, on its Parameters page. */
async function editorOnParameters(page: Page): Promise<void> {
  await page.locator('.project-nav li').filter({hasText: /^Driver$/}).click();
  await page.locator('.driver-id-row').getByRole('button', {name: /^(✎ )?Edit$/}).click();
  await page.locator('.de-modal').waitFor({state: 'visible'});
  await page.getByRole('button', {name: 'Parameters', exact: true}).click();
}

/** The New project wizard on step 2 (driver count), with a driver picked. */
async function wizardCountStep(page: Page): Promise<void> {
  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await modal.locator('.dlist .ditem').first().click();
  await modal.locator('.modal-footer button', {hasText: 'Next'}).click();
}

const differenceCue: OpenStep = {root: '.wd-modal', open: async page => {
  await setFocusedBoxType(page, 'box-passive-radiator');
  await page.locator('.winisd-deviation-cue:visible').first().click();
  await page.locator('.wd-modal').waitFor({state: 'visible'});
}};

const closeUnsaved: OpenStep = {root: '.overlay.on .modal.narrow', open: async page => {
  await dirtyFocusedDesign(page);
  await page.locator('.project-row.selected .row-menu-btn').click();
  await page.locator('.row-menu-item:has-text("Close")').click();
  await page.locator('.close-actions').waitFor({state: 'visible'});
}};

const alignment = (box: BoxTypeName): OpenStep => ({root: '.alignment-modal', open: async page => {
  await setFocusedBoxType(page, box);
  await page.getByRole('button', {name: 'Alignment', exact: true}).click();
  await page.locator('.alignment-modal').waitFor({state: 'visible'});
}});

const tabHelp: OpenStep = {root: '.desk-help', open: async page => {
  await page.locator('.project-nav li').filter({hasText: /^Filters$/}).first().click();
  await page.locator('.tab-help-btn').click();
  await page.locator('.desk-help').waitFor({state: 'visible'});
}};

/** Already on screen under the project list: the page is measured as it stands. */
const signalGenerator: OpenStep = {root: '.quad-signalgen-wrap', open: async page => {
  await page.locator('.quad-signalgen-wrap').waitFor({state: 'visible'});
}};

const equationInspector: OpenStep = {root: '.eq-inspector-card', open: async page => {
  await editorOnParameters(page);
  await page.getByRole('checkbox', {name: 'Inspect Provenance'}).check();
  await page.locator('.de-fld:has-text("Qts") input').first().click();
  await page.locator('.eq-inspector-card').waitFor({state: 'visible'});
}};

/** Revert asks first. */
const confirmation: OpenStep = {root: '.confirm-modal', open: async page => {
  await dirtyFocusedDesign(page);
  await page.locator('.tb-btn[title^="Revert"]').click();
  await page.locator('.confirm-modal').waitFor({state: 'visible'});
}};

const driverRename: OpenStep = {root: '.de-rename-panel', open: async page => {
  const entry = {uuid: 'u-edit', record: deviceRecord({brand: 'Orig', model: 'Name', specs: {Fs_hz: 41, Re_ohm: 5.4, Sd_m2: 0.0132, Qts: 0.35, Qes: 0.38}}, 'u-edit')};
  await page.addInitScript(([key, value]: readonly [string, string]) => { localStorage.setItem(key, value); }, [MY_DRIVERS_KEY, JSON.stringify({schema: 1, entries: [entry]})] as const);
  await page.goto('/');
  await page.locator('[title*="librar" i]').first().click();
  await page.locator('.my-ditem .my-edit').first().click();
  await page.locator('.de-modal').waitFor({state: 'visible'});
  await page.locator('.de-btns button', {hasText: /^OK$/}).click();
  await fillAndBlur(page.locator('input.save-model-input'), 'Renamed');
  await page.locator('.save-confirm-btn').click();
  await page.locator('.de-rename-panel').waitFor({state: 'visible'});
}};

/** BL typed as 3 T·m: the driver's values no longer agree, and a strip lists the disagreements. */
const driverDisagreements: OpenStep = {root: '.de-inconsistent', open: async page => {
  await editorOnParameters(page);
  await fillAndBlur(page.locator('.de-fld', {has: page.locator('label', {hasText: /^BL\b/})}).locator('input').first(), '3');
  await page.locator('.de-inconsistent').waitFor({state: 'visible'});
}};

const searchFilters: OpenStep = {root: '.wb-modal', open: async page => {
  await page.locator('.tb-btn[aria-label="Manage Drivers"]').click();
  await page.locator('.wb-modal .param-row').waitFor({state: 'visible'});
}};

const optionsLimitsHelp: OpenStep = {root: '[data-testid="limits-more-popup"]', open: async page => {
  await page.locator('.tb-btn[title="Options"]').click();
  await page.locator('.opt-modal').getByText('More info').click();
  await page.locator('[data-testid="limits-more-popup"]').waitFor({state: 'visible'});
}};

const wizardPlacementInfo: OpenStep = {root: '.mob-np-icard', open: async page => {
  await wizardCountStep(page);
  await page.getByRole('button', {name: 'About driver placement'}).click();
  await page.locator('.mob-np-icard').waitFor({state: 'visible'});
}};

const wizardEbpInfo: OpenStep = {root: '.mob-np-icard', open: async page => {
  await wizardCountStep(page);
  await page.locator('.overlay.open button', {hasText: 'Next'}).click();
  await page.getByRole('button', {name: 'About EBP'}).first().click();
  await page.locator('.mob-np-icard').waitFor({state: 'visible'});
}};

/** The step table: skin and view id to its open step. */
export const DESKTOP_STEPS: readonly (readonly [WalkSkin, string, OpenStep])[] = [
  [D, 'desktop/difference-cue', differenceCue],
  [D, 'desktop/projects/close-unsaved', closeUnsaved],
  [D, 'desktop/enclosure/sealed-alignment', alignment('sealed')],
  [D, 'desktop/enclosure/vented-alignment', alignment('vented')],
  [D, 'desktop/help/tab-help-panel', tabHelp],
  [D, 'desktop/signal/generator', signalGenerator],
  [D, 'desktop/equation-inspector', equationInspector],
  [D, 'desktop/confirmation', confirmation],
  [D, 'desktop/driver-rename', driverRename],
  [D, 'desktop/driver-disagreement-list', driverDisagreements],
  [D, 'desktop/driver-search-filters', searchFilters],
  [D, 'desktop/options-limits-help', optionsLimitsHelp],
  [D, 'desktop/wizard-placement-info', wizardPlacementInfo],
  [D, 'desktop/wizard-ebp-info', wizardEbpInfo],
];
