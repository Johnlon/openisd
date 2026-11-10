import {CHART_LABELS, TABS} from '@openisd/design/chart';
import {MOBILE_BOX_VARIANTS} from './mobileSurfaceManifest.js';
import {NoOpenReason, WalkSkin} from './viewOpenTypes.js';
import type {OpenStep} from './viewOpenTypes.js';
import {driverEditor, openPhoneWizardStep, phoneTab} from './viewOpenNavigation.js';
import {SAVED_STATE_STEPS} from './viewOpenSavedState.js';
import {REJECTED_INPUT_STEPS} from './viewOpenRejected.js';
import {CLOUD_STEPS} from './viewOpenCloud.js';

/** Key of a (skin, view) pair in the two tables below. */
const key = (skin: WalkSkin, id: string) => `${skin}:${id}`;

/** The box type a chart needs on screen before it is offered (the same pairing the desktop navigation uses). */
function boxForChart(chartId: string): string {
  if (chartId.startsWith('PR')) return 'box-passive-radiator';
  if (chartId.startsWith('Intra')) return 'abc';
  if (chartId.startsWith('Front')) return 'bandpass6';
  if (chartId.startsWith('Rear')) return 'vented';
  return 'sealed';
}

const steps: (readonly [WalkSkin, string, OpenStep])[] = [];
for (const chart of TABS) {
  steps.push([WalkSkin.Phone, 'chart-' + chart.id, {root: '.mob-chart-view', open: async page => {
    await phoneTab(page, 'Box');
    await page.locator('#mob-box-type').selectOption(boxForChart(chart.id));
    await phoneTab(page, 'Graph');
    await page.locator('.mob-chart-pick').click();
    await page.locator('.mob-chart-row').getByText(CHART_LABELS[chart.id], {exact: true}).click();
  }}]);
}
for (const box of MOBILE_BOX_VARIANTS) for (let step = 1; step <= (box === 'box-passive-radiator' ? 4 : 5); step++) {
  steps.push([WalkSkin.Phone, `wizard-${box}-${step}`, {root: '.mob-np-overlay', open: page => openPhoneWizardStep(page, box, step)}]);
}
/** A static page outside the app: a user types its address; the whole body is measured. */
const staticPage = (path: string): OpenStep => ({root: 'body', open: async page => { await page.goto(path); }});
for (const skin of [WalkSkin.Phone, WalkSkin.Desktop]) {
  steps.push([skin, 'shared/about-page', staticPage('/about/')]);
  steps.push([skin, 'shared/install-page', staticPage('/install/')]);
}
steps.push([WalkSkin.Phone, 'refresh', staticPage('/about/refresh/')]);
steps.push([WalkSkin.Phone, 'menu', {root: '.mob-menu', open: page => page.locator('.mob-hamburger').click()}]);
steps.push([WalkSkin.Phone, 'chart-picker', {root: '.mob-chart-list', open: async page => { await phoneTab(page, 'Graph'); await page.locator('.mob-chart-pick').click(); }}]);
steps.push([WalkSkin.Phone, 'driver-more', {root: '.de-more-menu', open: async page => { await driverEditor(page, WalkSkin.Phone); await page.locator('.de-more').click(); }}]);

steps.push(...SAVED_STATE_STEPS);
steps.push(...CLOUD_STEPS);
steps.push(...REJECTED_INPUT_STEPS);

/** Open steps written by hand for views the two surface manifests cannot open. */
export const EXTRA_OPEN_STEPS: ReadonlyMap<string, OpenStep> = new Map(steps.map(([skin, id, step]) => [key(skin, id), step]));

const P = WalkSkin.Phone, D = WalkSkin.Desktop;
const both = (ids: readonly string[]) => ids;
const reasons: [NoOpenReason, WalkSkin, readonly string[]][] = [
  [NoOpenReason.BrowserOwned, P, ['native-files', 'native-select', 'native-colour', 'native-keyboard', 'native-title']],
  [NoOpenReason.BrowserOwned, D, ['desktop/projects/trace-colour-picker']],
  [NoOpenReason.FaultNeeded, P, ['crash', 'startup-failure', 'storage-usage', 'update', 'cross-tab', 'driver-storage-error', 'phone/update-strip', ...both(['shared/store-gate', 'shared/storage-warning', 'shared/driver-library-storage-note'])]],
  [NoOpenReason.FaultNeeded, D, ['desktop/crash', 'desktop/startup-failure', 'desktop/storage-usage-warning', 'desktop/cross-tab-notice', 'desktop/cloud/update-strip', ...both(['shared/store-gate', 'shared/storage-warning', 'shared/driver-library-storage-note'])]],
  [NoOpenReason.RejectedInputNeeded, P, ['phone/response-model-pending-notice']],
  [NoOpenReason.RejectedInputNeeded, D, ['desktop/enclosure/response-model-pending-notice']],
];
/** Views with a named reason; a (skin, view) in neither table has the default reason, StepNotWritten. */
export const VIEW_REASONS: ReadonlyMap<string, NoOpenReason> = new Map(reasons.flatMap(([reason, skin, ids]) => ids.map((id): [string, NoOpenReason] => [key(skin, id), reason])));
