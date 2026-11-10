import type {Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setFocusedBoxType} from '../fixtures.js';
import {fillAndBlur} from './numField.js';
import {tapMobileMenuItem} from './mobileSkin.js';
import {openPhoneWizardStep, phoneTab} from './viewOpenNavigation.js';
import {WalkSkin} from './viewOpenTypes.js';
import type {OpenStep} from './viewOpenTypes.js';

/**
 * Open steps for the views that show only after the user enters a value the app refuses (T773, batch 4).
 * Each step types the value into the real box and measures the message that answers. Where the app asks
 * an outside system (the catalogue file) the stand-in answers; the stored drivers are a text the user could have.
 */

const P = WalkSkin.Phone, D = WalkSkin.Desktop;
const TEST_DIST = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'build', `test-dist-${process.env.OPENISD_TEST_PORT}`);

/** A user who has been here before: the welcome splash, the storage notice and the usage notice are already out of the way. */
async function returningUser(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ui: {splashSeen: true}}));
    localStorage.setItem('openisd_persist_warning_dismissed', '1');
    sessionStorage.setItem('openisd_usage_notice_shown', '1');
  });
}

/** Options on the skin. */
async function openOptions(page: Page, skin: WalkSkin): Promise<void> {
  switch (skin) {
    case P: await tapMobileMenuItem(page, 'Options'); await page.locator('.opt-phone').waitFor({state: 'visible'}); break;
    case D: await page.locator('.tb-btn[title="Options"]').click(); await page.locator('.opt-modal').waitFor({state: 'visible'}); break;
  }
}

const optionsRoot = (skin: WalkSkin) => skin === P ? '.opt-phone' : '.opt-modal';

/** The design limits, typed into the Options boxes. */
async function typeLimits(page: Page, skin: WalkSkin, values: readonly (readonly [LimitBox, string])[]): Promise<void> {
  for (const [box, value] of values) await fillAndBlur(skin === P ? page.locator('.opt-phone .ui-field', {hasText: box.label}).locator('input').first() : page.locator(box.id), value);
}
interface LimitBox {readonly id: string; readonly label: string}
const MIN_VOLUME: LimitBox = {id: '#set-min-volume', label: 'Min box volume'};
const MAX_VOLUME: LimitBox = {id: '#set-max-volume', label: 'Max box volume'};
const MIN_TUNING: LimitBox = {id: '#set-min-tuning', label: 'Min tuning'};
const MAX_TUNING: LimitBox = {id: '#set-max-tuning', label: 'Max tuning'};

const optionsErrorOn = (skin: WalkSkin): OpenStep => ({root: optionsRoot(skin), open: async page => {
  await returningUser(page);
  await page.goto('/');
  await openOptions(page, skin);
  await typeLimits(page, skin, [[MIN_VOLUME, '900'], [MAX_VOLUME, '5']]);
  await page.locator('[data-testid="settings-error"]').first().waitFor({state: 'visible'});
}});

/** The wizard's vented alignment step. */
async function wizardAtVentedAlignment(page: Page, skin: WalkSkin): Promise<void> {
  switch (skin) {
    case P: await openPhoneWizardStep(page, 'vented', 4); break;
    case D: {
      await page.locator('.tb-btn[title*="New project"]').click();
      const modal = page.locator('.overlay.open');
      await modal.locator('.dlist .ditem').first().click();
      await modal.locator('.modal-footer button', {hasText: 'Next'}).click();
      await modal.locator('button', {hasText: 'Next'}).click();
      await modal.getByLabel('Box type').selectOption('vented');
      await modal.locator('button', {hasText: 'Next'}).click();
      break;
    }
  }
}

/** Narrow the design band to 1 to 2 litres and 1 to 2 Hz in Options, then design a vented box: its volume and tuning fall outside. */
const ventedBandWarning = (skin: WalkSkin, testid: string): OpenStep => ({root: skin === P ? '.mob-np-overlay' : '.overlay.open .modal', open: async page => {
  await returningUser(page);
  await page.goto('/');
  await openOptions(page, skin);
  await typeLimits(page, skin, [[MIN_VOLUME, '1'], [MAX_VOLUME, '2'], [MIN_TUNING, '1'], [MAX_TUNING, '2']]);
  await page.locator('[data-testid="settings-apply"]').click();
  await page.locator(optionsRoot(skin)).waitFor({state: 'detached'});
  await wizardAtVentedAlignment(page, skin);
  await page.locator(`[data-testid="${testid}"]`).waitFor({state: 'visible'});
}});

/** The built catalogue with one passive radiator's record taken out and its row kept: the catalogue file is the outside system. */
function catalogueWithout(name: string): string {
  const built: unknown = JSON.parse(readFileSync(join(TEST_DIST, 'catalogue.json'), 'utf8'));
  if (typeof built !== 'object' || built === null || !('passiveRadiatorRows' in built) || !('passiveRadiators' in built)) throw new Error('catalogue.json has no passive radiator section');
  const {passiveRadiatorRows, passiveRadiators} = built;
  if (!Array.isArray(passiveRadiatorRows) || typeof passiveRadiators !== 'object' || passiveRadiators === null) throw new Error('catalogue.json passive radiator section has the wrong shape');
  const row: unknown = passiveRadiatorRows.find((candidate: unknown) => typeof candidate === 'object' && candidate !== null && 'name' in candidate && typeof candidate.name === 'string' && candidate.name.includes(name));
  if (typeof row !== 'object' || row === null || !('uuid' in row)) throw new Error(`${name} is not in the built catalogue`);
  const kept = Object.fromEntries(Object.entries(passiveRadiators).filter(([uuid]) => uuid !== row.uuid));
  return JSON.stringify({...built, passiveRadiators: kept});
}

/** Passive radiator step, a radiator whose record the catalogue does not hold is picked: the step says so. */
const passiveRadiatorPickError = (skin: WalkSkin): OpenStep => ({root: skin === P ? '.mob-np-overlay' : '.overlay.open .modal', expectedConsoleError: /E150HE-PR|passive radiator|no record/i, open: async page => {
  await returningUser(page);
  await page.route(/\/catalogue\.json$/, route => route.fulfill({status: 200, contentType: 'application/json', body: catalogueWithout('E150HE-PR')}));
  await page.goto('/');
  switch (skin) {
    case P: await openPhoneWizardStep(page, 'box-passive-radiator', 4).catch(() => undefined); break;
    case D: {
      await page.locator('.tb-btn[title*="New project"]').click();
      const modal = page.locator('.overlay.open');
      await modal.locator('.dlist .ditem').first().click();
      await modal.locator('.modal-footer button', {hasText: 'Next'}).click();
      await modal.locator('button', {hasText: 'Next'}).click();
      await modal.getByLabel('Box type').selectOption('box-passive-radiator');
      await modal.locator('button', {hasText: 'Next'}).click();
      break;
    }
  }
  await page.locator('#np-pr-select').click();
  await page.locator('.pr-lib-item .pr-lib-name', {hasText: 'E150HE-PR'}).first().click();
  await page.locator('.np-pr-error').waitFor({state: 'visible'});
}});

/** A vented box tuned higher than its port can reach: the Box tab says so under the field. */
const tuningUnreachable = (skin: WalkSkin): OpenStep => ({root: skin === P ? '.mob-content' : '.tab-section.active', open: async page => {
  await setFocusedBoxType(page, 'vented');
  switch (skin) {
    case P: await fillAndBlur(page.locator('.mob-content .ui-field', {hasText: /Fb/}).locator('input').first(), '200'); await page.locator('.mob-chint-warn').first().waitFor({state: 'visible'}); break;
    case D: await fillAndBlur(page.locator('#og-fb-target'), '200'); await page.locator('#og-fb-unreachable').waitFor({state: 'visible'}); break;
  }
}});

/** A saved driver with its brand emptied: pressing OK says Brand and Model are required. */
const driverIdentity = (skin: WalkSkin): OpenStep => ({root: '.de-id-panel', open: async page => {
  if (skin === P) { await phoneTab(page, 'Driver'); await page.getByRole('button', {name: 'Edit', exact: true}).click(); }
  else { await page.locator('.project-nav li').filter({hasText: /^Driver$/}).click(); await page.locator('.driver-id-row').getByRole('button', {name: /^(✎ )?Edit$/}).click(); }
  await page.getByRole('button', {name: 'General', exact: true}).click();
  await fillAndBlur(page.locator('.de-fld', {has: page.locator('label', {hasText: 'Brand'})}).locator('input'), '');
  await page.locator('.de-modal button, .mob-dlg button', {hasText: /^OK$/}).first().click();
  await page.locator('.de-id-panel').waitFor({state: 'visible'});
}});

/** The saved driver text is damaged: Manage Drivers says it cannot be read, and Delete is pressed once without exporting. */
const driverDeleteChallenge = (skin: WalkSkin): OpenStep => ({root: '.my-storage-modal', open: async page => {
  await returningUser(page);
  await page.addInitScript(() => { localStorage.setItem('openisd_my_drivers', '{"schema": 2, "drivers": NOT-VALID-JSON'); });
  await page.goto('/');
  switch (skin) {
    case P: await tapMobileMenuItem(page, 'Manage Drivers'); break;
    case D: await page.locator('[title*="librar" i]').first().click(); break;
  }
  await page.locator('.my-delete-all').click();
  await page.locator('.my-storage-warn').waitFor({state: 'visible'});
}});

/** A refused value typed into a vented tuning box: tapping its warning mark opens the explanation. */
const fieldWarning: OpenStep = {root: '.mob-content', open: async page => {
  await setFocusedBoxType(page, 'vented');
  const field = page.locator('.mob-content .ui-field', {hasText: /Fb/}).first();
  await fillAndBlur(field.locator('input').first(), '2000');
  const note = field.locator('.ui-field-note');
  if (!await note.isVisible()) await field.locator('.ui-field-dq-btn').click();
  await note.waitFor({state: 'visible'});
}};

/** The step table: skin and view id to its open step. */
export const REJECTED_INPUT_STEPS: readonly (readonly [WalkSkin, string, OpenStep])[] = [
  [P, 'shared/options-error', optionsErrorOn(P)],
  [D, 'shared/options-error', optionsErrorOn(D)],
  [P, 'phone/wizard-vented-volume-warning', ventedBandWarning(P, 'np-vented-volume-warning')],
  [P, 'phone/wizard-vented-tuning-warning', ventedBandWarning(P, 'np-vented-tuning-warning')],
  [D, 'desktop/projects/new/vented-volume-warning', ventedBandWarning(D, 'np-vented-volume-warning')],
  [D, 'desktop/projects/new/vented-tuning-warning', ventedBandWarning(D, 'np-vented-tuning-warning')],
  [P, 'phone/wizard-passive-radiator-pick-error', passiveRadiatorPickError(P)],
  [D, 'desktop/projects/new/passive-radiator-pick-error', passiveRadiatorPickError(D)],
  [P, 'phone/tuning-unreachable-warning', tuningUnreachable(P)],
  [D, 'desktop/enclosure/tuning-unreachable-warning', tuningUnreachable(D)],
  [P, 'driver-identity', driverIdentity(P)],
  [D, 'desktop/driver-identity-message', driverIdentity(D)],
  [P, 'shared/driver-delete-challenge-warning', driverDeleteChallenge(P)],
  [D, 'shared/driver-delete-challenge-warning', driverDeleteChallenge(D)],
  [P, 'field-dq', fieldWarning],
];
