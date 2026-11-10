import type {Page} from '@playwright/test';
import {CHART_LABELS} from '@openisd/design/chart';
import {setFocusedBoxType} from '../fixtures.js';
import {owdrText} from './seedMyDrivers.js';
import {driverEditor, phoneTab} from './viewOpenNavigation.js';
import {WalkSkin} from './viewOpenTypes.js';
import type {OpenStep} from './viewOpenTypes.js';

/**
 * Open steps for the views both skins share (T782, batch 6e). Each one does what the index says under
 * "reach", on the real screen of its skin; where the two skins differ only in how a chart or the driver
 * editor is reached, one function takes the skin.
 */

const P = WalkSkin.Phone, D = WalkSkin.Desktop;
const BOTH = [P, D] as const;

/** The page that draws the chart: the phone's Graph tab or the desktop graph area. */
const chartCanvas = (skin: WalkSkin) => skin === P ? '.mob-chart-view canvas' : '.graph-wrap canvas';

/** Shows the chart the user picked by name (phone: Graph tab and its picker; desktop: the chart drop-down). */
async function showChart(page: Page, skin: WalkSkin, chartId: 'MaxSPL' | 'TFMag'): Promise<void> {
  const label = CHART_LABELS[chartId];
  if (skin === P) {
    await phoneTab(page, 'Graph');
    await page.locator('.mob-chart-pick').click();
    await page.locator('.mob-chart-row').getByText(label, {exact: true}).click();
  } else {
    await page.locator('.chart-select').click();
    await page.locator('.chart-select .menu-item', {hasText: new RegExp('^' + label + '$')}).click();
  }
  await page.locator(chartCanvas(skin)).first().waitFor({state: 'visible'});
}

/** The project's driver is swapped for one file with the given values (a user picks a driver file in the driver editor). */
async function swapDriverFile(page: Page, skin: WalkSkin, specs: Record<string, number>): Promise<void> {
  await driverEditor(page, skin);
  await page.locator('.de-modal input[type=file]').setInputFiles({
    name: 'walk.owdr', mimeType: 'application/x-openisd-driver',
    buffer: Buffer.from(owdrText({brand: 'Walk', model: 'Driver', specs}, '00000000-0000-4000-8000-0000000000c1')),
  });
}

/** The files a driver needs for every chart, with neither Pe nor Xmax stated. */
const NO_LIMIT_SPECS = {Fs_hz: 41, Re_ohm: 5.4, Sd_m2: 0.0132, Qts: 0.35, Qes: 0.38, Qms: 4.2, Vas_m3: 0.03};

const fieldCatalogue = (): OpenStep => ({root: '', open: async page => {
  await page.goto('/?field-catalogue');
  await page.locator('body *').first().waitFor({state: 'attached'});
}});

/** Opening a project says so in a short strip (desktop `.flash`, phone `flash-strip`). */
const flashMessage: OpenStep = {root: '.flash, [data-testid="flash-strip"]', open: async page => {
  await page.locator('.flash, [data-testid="flash-strip"]').first().waitFor({state: 'visible'});
}};

/** The pointer over the chart: the read-out box shows the values. */
const chartReadout = (skin: WalkSkin): OpenStep => ({root: skin === P ? '.mob-chart-view' : '.graph-wrap', open: async page => {
  const canvas = page.locator(chartCanvas(skin)).first();
  if (skin === P) await phoneTab(page, 'Graph');
  await canvas.waitFor({state: 'visible'});
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('the chart has no box');
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.locator('.gread:visible', {hasText: 'Hz'}).first().waitFor({state: 'visible'});
}});

/** A driver with no Pe and no Xmax: the maximum SPL curve is unbounded, and a pill says what would limit it. */
const graphWarningPill = (skin: WalkSkin): OpenStep => ({root: '.gwarn-pill', open: async page => {
  await swapDriverFile(page, skin, NO_LIMIT_SPECS);
  await page.locator('.de-footer button.pri', {hasText: 'OK'}).click();
  await page.locator('.de-body').waitFor({state: 'hidden'});
  await showChart(page, skin, 'MaxSPL');
  await page.locator('.gwarn-pill').first().waitFor({state: 'visible'});
}});

/** A driver file with no values: the chart says it cannot be plotted and lists the fields. */
const graphBlockedMessage = (skin: WalkSkin): OpenStep => ({root: '.gmsg', open: async page => {
  await swapDriverFile(page, skin, {});
  await page.locator('.de-footer button.pri', {hasText: 'OK'}).click();
  await page.locator('.de-body').waitFor({state: 'hidden'});
  if (skin === P) await phoneTab(page, 'Graph');
  await page.locator('.gmsg').first().waitFor({state: 'visible'});
}});

/** Right-click on the chart. */
const graphContextMenu = (skin: WalkSkin): OpenStep => ({root: '.ctx-menu', open: async page => {
  await showChart(page, skin, 'TFMag');
  const box = await page.locator(chartCanvas(skin)).first().boundingBox();
  if (box === null) throw new Error('the chart has no box');
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5, {button: 'right'});
  await page.locator('.ctx-menu').waitFor({state: 'visible'});
}});

/** A driver with no values: the editor's strip lists why the charts stay blank. */
const driverEditorIncomplete = (skin: WalkSkin): OpenStep => ({root: '.de-incomplete', open: async page => {
  await swapDriverFile(page, skin, {});
  await page.locator('.de-incomplete').first().waitFor({state: 'visible'});
}});

/** The Driver library's ? by the types. */
const driverTypeHelp = (skin: WalkSkin): OpenStep => ({root: '.help-drop', open: async page => {
  if (skin === P) {
    await phoneTab(page, 'Driver');
    await page.getByRole('button', {name: 'Select driver', exact: true}).click();
    await page.locator('.dl-filters-toggle').click();
  } else await page.locator('.tb-btn[aria-label="Manage Drivers"]').click();
  await page.locator('.help-btn:visible').first().click();
  await page.locator('.help-drop').waitFor({state: 'visible'});
}});

/** The differences dialog opened from a ≠W cue (as the difference-cue views do), then one more entry is read. */
const winisdDifferenceEntry = (skin: WalkSkin): OpenStep => ({root: skin === P ? '.mob-dlg' : '.wd-modal', open: async page => {
  if (skin === P) {
    await phoneTab(page, 'Box');
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');
    await page.locator('.winisd-deviation-cue').first().click();
    await page.locator('.mob-dcard-head').nth(1).click();
    await page.locator('.mob-dcard-head[aria-expanded="true"]').nth(1).waitFor({state: 'visible'});
  } else {
    await setFocusedBoxType(page, 'box-passive-radiator');
    await page.locator('.winisd-deviation-cue:visible').first().click();
    await page.locator('.wd-entry').first().waitFor({state: 'visible'});
  }
}});

const make = (id: string, build: (skin: WalkSkin) => OpenStep): (readonly [WalkSkin, string, OpenStep])[] => BOTH.map(skin => [skin, id, build(skin)] as const);

/** The step table: skin and view id to its open step. */
export const SHARED_STEPS: readonly (readonly [WalkSkin, string, OpenStep])[] = [
  ...make('shared/field-catalogue', fieldCatalogue),
  ...make('shared/flash-message', () => flashMessage),
  ...make('shared/chart-readout', chartReadout),
  ...make('shared/graph-warning-pill', graphWarningPill),
  ...make('shared/graph-blocked-message', graphBlockedMessage),
  ...make('shared/graph-context-menu', graphContextMenu),
  ...make('shared/winisd-difference-entry', winisdDifferenceEntry),
  ...make('shared/driver-editor-incomplete-warning', driverEditorIncomplete),
  ...make('shared/driver-type-help', driverTypeHelp),
];
