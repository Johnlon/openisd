import {expect, test} from '../fixtures.js';
import {measureFieldLayoutRules} from '../fixtures/fieldLayoutAudit.js';
import {measureWholeScreen} from '../fixtures/wholeScreenAudit.js';
import {WalkSkin, openTargets, startWalk, stepperGapFor} from '../fixtures/viewOpen.js';
import {PhoneRowColumns} from '@openisd/design/fields';

/**
 * The view walk (T763, process control "one view list the layout check walks"). Every view of the view
 * index is opened in its skin (phone 374 x 705, desktop 1440 x 900) and measured as a whole screen:
 * nothing outside the window, no sideways scroll, no text cut, no two controls overlapping, plus the
 * field layout rules. The count of views with no open step is held down by the unit test
 * test/logic/view-walk-coverage.test.ts. The older gate field-layout-rules.browser.spec.ts stays as it is.
 */

/** A view that measures fewer controls and text elements than this is empty, and fails. */
const MIN_MEASURED = 1;

/** A fault found by this walk and not yet fixed: the view, the rules it breaks, and the bug file that records it. Its test expects the fault and turns red when it is fixed; then the entry is deleted. */
interface KnownFault {readonly skin: WalkSkin; readonly view: (id: string) => boolean; readonly rules: readonly string[]; readonly bug: string}
const WIZARD_HELP_BUG = 'BUG_20261110_phone-wizard-help-button-overlaps-section-help.md';
const WIZARD_ALIGNMENT_BUG = 'BUG_20261110_phone-wizard-alignment-row-misaligned.md';
const CHART_PICK_BUG = 'BUG_20261110_phone-chart-picker-name-cut.md';
const CUT_CHART_NAMES: ReadonlySet<string> = new Set(['TFMag', 'PRTFMag', 'PRTFPhase', 'PRExcursion', 'RearPort', 'FrontPort', 'FrontPortGain', 'IntraPort', 'Zph', 'Phase', 'MaxPwr', 'VA', 'FltMag', 'FltPhase', 'FltGD'].map(chart => 'chart-' + chart));
const KNOWN: readonly KnownFault[] = [
  {skin: WalkSkin.Phone, view: id => /^wizard-[A-Za-z0-9-]+-1$/.test(id), rules: ['R7', 'W4'], bug: WIZARD_HELP_BUG},
  {skin: WalkSkin.Phone, view: id => id === 'wizard-sealed-4' || id === 'wizard-vented-4', rules: ['R3'], bug: WIZARD_ALIGNMENT_BUG},
  {skin: WalkSkin.Phone, view: id => CUT_CHART_NAMES.has(id), rules: ['W3'], bug: CHART_PICK_BUG},
];

for (const {view, skin, plan} of openTargets()) {
  test(`${skin} ${view.id}`, async ({page}) => {
    await startWalk(page, skin);
    await plan.open(page);
    const root = plan.root;
    await page.locator(root).first().waitFor({state: 'visible'});
    const stepperGap = stepperGapFor(skin, PhoneRowColumns.MIN_STEPPER_GAP_PX);
    const fieldIssues = await page.locator(root).first().evaluate(measureFieldLayoutRules, stepperGap);
    const whole = await page.locator(root).first().evaluate(measureWholeScreen);
    expect(whole.measured, `${view.id}: nothing measured`).toBeGreaterThanOrEqual(MIN_MEASURED);
    const issues = [...fieldIssues, ...whole.issues];
    const known = KNOWN.filter(fault => fault.skin === skin && fault.view(view.id));
    const isKnown = (issue: string) => known.some(fault => fault.rules.some(rule => issue.startsWith(rule + ' ')));
    expect(issues.filter(issue => !isKnown(issue))).toEqual([]);
    // A known fault must still show; when it is fixed this goes red, and the KNOWN entry and its bug file are deleted.
    const stillShows = known.every(fault => issues.some(issue => fault.rules.some(rule => issue.startsWith(rule + ' '))));
    expect(stillShows, `${known.map(fault => fault.bug).join(', ')} is fixed: delete its KNOWN entry`).toBe(true);
  });
}
