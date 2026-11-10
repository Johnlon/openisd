import type {Page} from '@playwright/test';
import {tapMobileMenuItem} from './mobileSkin.js';
import {phoneTab} from './viewOpenNavigation.js';
import {WalkSkin} from './viewOpenTypes.js';
import type {OpenStep} from './viewOpenTypes.js';

/**
 * Open steps for phone dialogs, sheets and pages reached from the menu and the tabs (T776, batch 6a).
 * Each step does what the index says under "reach": taps, in order, on the real screen.
 */

const P = WalkSkin.Phone;

/** Menu, Projects: the full-screen Projects pane. */
async function openProjectsPane(page: Page): Promise<void> {
  await tapMobileMenuItem(page, /^Projects$/);
  await page.locator('.mob-projects-pane').waitFor({state: 'visible'});
}

/** The box page with the box type chosen. */
async function boxPage(page: Page, box: string): Promise<void> {
  await phoneTab(page, 'Box');
  await page.locator('#mob-box-type').selectOption(box);
}

const projectActions: OpenStep = {root: '.mob-action-sheet', open: async page => {
  await openProjectsPane(page);
  await page.locator('.mob-project-menu-btn').first().click();
  await page.locator('.mob-action-sheet').waitFor({state: 'visible'});
}};

const bin: OpenStep = {root: '.mob-projects-pane', open: async page => {
  await openProjectsPane(page);
  await page.locator('.mob-bin-toggle').click();
  await page.getByRole('button', {name: 'Back to projects'}).waitFor({state: 'visible'});
}};

/** The only open project is closed from its action sheet: the page that says no project is open. */
const empty: OpenStep = {root: '.mob-empty', open: async page => {
  await openProjectsPane(page);
  await page.locator('.mob-project-menu-btn').first().click();
  await page.locator('.mob-action-close').click();
  await page.locator('.mob-empty').waitFor({state: 'visible'});
}};

const alignment = (box: string): OpenStep => ({root: '.mob-align-sheet', open: async page => {
  await boxPage(page, box);
  await page.getByRole('button', {name: 'Choose alignment…'}).click();
  await page.locator('.mob-align-sheet').waitFor({state: 'visible'});
}});

const prPicker: OpenStep = {root: '.overlay.on .modal', open: async page => {
  await boxPage(page, 'box-passive-radiator');
  await page.getByRole('button', {name: 'Select PR', exact: true}).click();
  await page.locator('.pr-lib-item').first().waitFor({state: 'visible'});
}};

const prSave: OpenStep = {root: '.save-lib-panel', open: async page => {
  await boxPage(page, 'box-passive-radiator');
  await page.getByRole('button', {name: 'Save to library', exact: true}).click();
  await page.locator('.save-lib-panel').waitFor({state: 'visible'});
}};

const chartData: OpenStep = {root: '.cdata-modal', open: async page => {
  await phoneTab(page, 'Graph');
  await page.locator('.mob-chart-data').first().click();
  await page.locator('.cdata-modal').waitFor({state: 'visible'});
}};

/** Graph, Tune on a vented box, the port's value pressed: the port editor opens over the sheet. */
const sheetPort: OpenStep = {root: '.mob-sheet-port', open: async page => {
  await boxPage(page, 'vented');
  await phoneTab(page, 'Graph');
  await page.getByRole('button', {name: 'Open Tune', exact: true}).click();
  const fields = page.locator('.mob-sheet-line .ui-field');
  const count = await fields.count();
  for (let at = 0; at < count; at++) {
    await fields.nth(at).locator('input').first().click();
    if (await page.locator('.mob-sheet-port').count() > 0) break;
  }
  await page.locator('.mob-sheet-port').waitFor({state: 'visible'});
}};

const exports: OpenStep = {root: '.export-menu-list', open: async page => {
  await tapMobileMenuItem(page, 'Save As / Export');
  await page.locator('.export-menu-list').waitFor({state: 'visible'});
}};

/** The step table: skin and view id to its open step. */
export const PHONE_MENU_STEPS: readonly (readonly [WalkSkin, string, OpenStep])[] = [
  [P, 'project-actions', projectActions],
  [P, 'bin', bin],
  [P, 'empty', empty],
  [P, 'sealed-alignment', alignment('sealed')],
  [P, 'vented-alignment', alignment('vented')],
  [P, 'pr-picker', prPicker],
  [P, 'pr-save', prSave],
  [P, 'chart-data', chartData],
  [P, 'sheet-port', sheetPort],
  [P, 'exports', exports],
];
