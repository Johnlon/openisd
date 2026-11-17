import {expect, test} from '../fixtures.js';
import {fillAndCommit} from '../fixtures/numField.js';
import {
  type BoxReadings, desktopScreens, differences, expectedAfterEntry, field, freshProjectReadings, openSweepProject, phoneScreens, readAllBoxes, sweepValues, acceptedAfterEntry, backAtStart,
  type SweepBoxType, type SweepInput, type SweepScreen, type SweepViewport,
} from '../fixtures/dependentValues.js';

/**
 * Dependent-value sweep, slice 1 (docs/plans/PLAN_20261117_DEPENDENT_VALUE_SWEEP.md; John, 17 Nov 2026: "add more
 * aggressive testing for this style of bug across the app"). The bug it guards against: the vented box's Vent length
 * stopped following Fb once Fb had been lowered far enough to push the calculated length past its limit.
 *
 * One journey per input, per box type, per viewport: the input is typed to a normal value, a tiny one and the top one the field accepts (these push calculated boxes past their own limits, as John's Fb did), an absurdly high one (10x
 * the field's own limit), an absurdly low one (0, or negative where the field's floor allows none), then back to what it
 * was. After each step every box on the screens is read; each must show what a clean project shows when that same entry
 * is typed into it. After the last step no calculated box may still be in the refused-entry state and every box must
 * show its starting value again.
 */

const desktopId = (id: string) => (page: import('@playwright/test').Page) => page.locator(`#${id}`);
const phoneField = (key: string, nth: number) => (page: import('@playwright/test').Page) => page.locator(`[data-field="${key}"] input[data-numinput]`).nth(nth);

function input(label: string, key: string, screen: string, locate: SweepInput['locate']): SweepInput {
  return {label, field: field(key), screen, locate};
}

const VB = 'box_Vb_l', VF = 'box_Vf_l', FFC = 'box_Ffc_hz', FRC = 'box_Frc_hz', VD = 'vent_D_cm', VL = 'vent_L_cm', VEL = 'vent_portVelocityLimit_m_per_s';

const DESKTOP_INPUTS: ReadonlyMap<SweepBoxType, readonly SweepInput[]> = new Map([
  ['sealed', [
    input('Volume', VB, 'Box', desktopId('og-box-volume')),
    input('Fsc', 'box_Fsc_hz', 'Box', desktopId('og-box-resonance')),
    input('Qtc', 'box_Qtc_value', 'Box', desktopId('og-box-qtc')),
  ]],
  ['vented', [
    input('Volume', VB, 'Box', desktopId('og-box-volume')),
    input('Fb on the Box tab', 'box_Fb_hz', 'Box', desktopId('og-fb-target')),
    input('Fb on the Vented tab', 'box_Fb_hz', 'Vented', desktopId('og-vent-fb-target')),
    input('Vent diameter', VD, 'Vented', desktopId('og-vent-diameter-vent')),
    input('Vent length', VL, 'Vented', desktopId('og-vent-length')),
    input('Port velocity limit', VEL, 'Vented', desktopId('og-vent-velocity-limit')),
  ]],
  ['bandpass4', [
    input('Rear volume', VB, 'Box', desktopId('og-box-volume')),
    input('Front volume', VF, 'Box', desktopId('og-front-volume')),
    input('Ffc on the Box tab', FFC, 'Box', desktopId('og-ffc-target')),
    input('Ffc on the bandpass tab', FFC, '4th Order Bandpass', desktopId('og-vent-fb-target')),
    input('Vent diameter', VD, '4th Order Bandpass', desktopId('og-vent-diameter-front')),
    input('Vent length', VL, '4th Order Bandpass', desktopId('og-vent-length')),
    input('Port velocity limit', VEL, '4th Order Bandpass', desktopId('og-vent-velocity-limit')),
  ]],
  ['bandpass6', [
    input('Rear volume', VB, 'Box', desktopId('og-box-volume')),
    input('Front volume', VF, 'Box', desktopId('og-front-volume')),
    input('Frc on the Box tab', FRC, 'Box', (page) => page.locator(`[data-field="${FRC}"] input[data-numinput]`).first()),
    input('Ffc on the Box tab', FFC, 'Box', desktopId('og-ffc-target')),
    input('Rear tuning', FRC, '6th Order Bandpass', desktopId('og-vent-tuning-rear')),
    input('Front tuning', FFC, '6th Order Bandpass', desktopId('og-vent-tuning-front')),
    input('Rear vent diameter', VD, '6th Order Bandpass', desktopId('og-vent-diameter-rear')),
    input('Front vent diameter', VD, '6th Order Bandpass', desktopId('og-vent-diameter-front')),
    input('Rear vent length', VL, '6th Order Bandpass', desktopId('og-vent-length-rear')),
    input('Front vent length', VL, '6th Order Bandpass', desktopId('og-vent-length-front')),
  ]],
  ['abc', [
    input('Rear volume', VB, 'Box', desktopId('og-box-volume')),
    input('Front volume', VF, 'Box', desktopId('og-front-volume')),
    input('Frc on the Box tab', FRC, 'Box', (page) => page.locator(`[data-field="${FRC}"] input[data-numinput]`).first()),
    input('Ffc on the Box tab', FFC, 'Box', desktopId('og-ffc-target')),
    input('Rear tuning', FRC, 'ABC', desktopId('og-vent-tuning-rear')),
    input('Front tuning', FFC, 'ABC', desktopId('og-vent-tuning-front')),
    input('Rear vent diameter', VD, 'ABC', desktopId('og-vent-diameter-rear')),
    input('Front vent diameter', VD, 'ABC', desktopId('og-vent-diameter-front')),
    input('Intra vent diameter', VD, 'ABC', desktopId('og-vent-diameter-intra')),
    input('Rear vent length', VL, 'ABC', desktopId('og-vent-length-rear')),
    input('Front vent length', VL, 'ABC', desktopId('og-vent-length-front')),
    input('Intra vent length', VL, 'ABC', desktopId('og-vent-length-intra')),
  ]],
  ['box-passive-radiator', [
    input('Volume', VB, 'Box', desktopId('og-box-volume')),
    input('Fh', 'box_Fh_hz', 'Box', desktopId('og-box-resonance')),
    input('Fp', 'pr_Fp_hz', 'Passive Radiator', desktopId('og-pr-fp')),
    input('Added mass', 'pr_Madd_g', 'Passive Radiator', desktopId('og-pr-madd')),
  ]],
]);

const PHONE_INPUTS: ReadonlyMap<SweepBoxType, readonly SweepInput[]> = new Map([
  ['sealed', [
    input('Volume', VB, 'Box', phoneField(VB, 0)),
    input('Fsc', 'box_Fsc_hz', 'Box', phoneField('box_Fsc_hz', 0)),
    input('Qtc', 'box_Qtc_value', 'Box', phoneField('box_Qtc_value', 0)),
  ]],
  ['vented', [
    input('Volume', VB, 'Box', phoneField(VB, 0)),
    input('Fb', 'box_Fb_hz', 'Box', phoneField('box_Fb_hz', 0)),
    input('Vent diameter', VD, 'Box', phoneField(VD, 0)),
    input('Vent length', VL, 'Box', phoneField(VL, 0)),
    input('Port velocity limit', VEL, 'Box', phoneField(VEL, 0)),
  ]],
  ['bandpass4', [
    input('Rear volume', VB, 'Box', phoneField(VB, 0)),
    input('Front volume', VF, 'Box', phoneField(VF, 0)),
    input('Ffc', FFC, 'Box', phoneField(FFC, 0)),
    input('Vent diameter', VD, 'Box', phoneField(VD, 0)),
    input('Vent length', VL, 'Box', phoneField(VL, 0)),
    input('Port velocity limit', VEL, 'Box', phoneField(VEL, 0)),
  ]],
  ['bandpass6', [
    input('Rear volume', VB, 'Box', phoneField(VB, 0)),
    input('Front volume', VF, 'Box', phoneField(VF, 0)),
    input('Frc', FRC, 'Box', phoneField(FRC, 0)),
    input('Rear vent diameter', VD, 'Box', phoneField(VD, 0)),
    input('Rear vent length', VL, 'Box', phoneField(VL, 0)),
    input('Ffc', FFC, 'Box', phoneField(FFC, 0)),
    input('Front vent diameter', VD, 'Box', phoneField(VD, 1)),
    input('Front vent length', VL, 'Box', phoneField(VL, 1)),
    input('Port velocity limit', VEL, 'Box', phoneField(VEL, 0)),
  ]],
  ['abc', [
    input('Rear volume', VB, 'Box', phoneField(VB, 0)),
    input('Front volume', VF, 'Box', phoneField(VF, 0)),
    input('Frc', FRC, 'Box', phoneField(FRC, 0)),
    input('Rear vent diameter', VD, 'Box', phoneField(VD, 0)),
    input('Rear vent length', VL, 'Box', phoneField(VL, 0)),
    input('Ffc', FFC, 'Box', phoneField(FFC, 0)),
    input('Front vent diameter', VD, 'Box', phoneField(VD, 1)),
    input('Front vent length', VL, 'Box', phoneField(VL, 1)),
    input('Intra vent diameter', VD, 'Box', phoneField(VD, 2)),
    input('Intra vent length', VL, 'Box', phoneField(VL, 2)),
    input('Port velocity limit', VEL, 'Box', phoneField(VEL, 0)),
  ]],
  ['box-passive-radiator', [
    input('Volume', VB, 'Box', phoneField(VB, 0)),
    input('Fp', 'pr_Fp_hz', 'Box', phoneField('pr_Fp_hz', 0)),
    input('Added mass', 'pr_Madd_g', 'Box', phoneField('pr_Madd_g', 0)),
  ]],
]);

const BOX_TYPES: readonly SweepBoxType[] = ['sealed', 'vented', 'bandpass4', 'bandpass6', 'abc', 'box-passive-radiator'];

/** Journeys that fail because of an app bug: the bug file, red until fixed (`test.fail`). Key: "<viewport> <box type> <input label>". */
const SEALED_QTC = 'bugs/BUG_20261117_sealed-qtc-keeps-old-value-when-fsc-is-tiny.md';
const KNOWN: ReadonlyMap<string, string> = new Map([
  ['desktop sealed Fsc', SEALED_QTC],
  ['phone sealed Fsc', SEALED_QTC],
]);

function baseUrl(): string {
  const port = process.env.OPENISD_TEST_PORT;
  return port ? `http://localhost:${port}` : 'http://localhost:4100';
}

for (const viewport of ['desktop', 'phone'] as const satisfies readonly SweepViewport[]) {
  for (const type of BOX_TYPES) {
    const inputs = (viewport === 'desktop' ? DESKTOP_INPUTS : PHONE_INPUTS).get(type) ?? [];
    const screens: readonly SweepScreen[] = viewport === 'desktop' ? desktopScreens(type) : phoneScreens();

    test.describe(`${viewport} ${type}: every box follows its inputs`, () => {
      for (const item of inputs) {
        const name = `${viewport} ${type} ${item.label}`;

        test(`${item.label}: normal, absurdly high, absurdly low, back`, async ({appPage: page, browser}) => {
          test.fail(KNOWN.has(name), KNOWN.get(name) ?? '');
          await openSweepProject(page, viewport, type);

          const home = screens.find(s => s.name === item.screen) ?? screens[0]!;
          const start = await readAllBoxes(page, viewport, screens);
          await page.locator('.project-nav li, .mob-tab', {hasText: home.tab}).first().click();
          const box = item.locate(page);
          const original = await box.inputValue();
          const startedCalculated = start.some(r => r.key.startsWith(`${home.name}|${item.field.value}`) && r.value === original && r.calculated);
          const values = sweepValues(item, original);

          // A refused entry leaves the last accepted value in force; the clean project it is compared with has only that
          // value typed (never the whole history, which would repeat a latch instead of catching it).
          let accepted: BoxReadings = start;
          for (const [step, text] of [['normal', values.normal], ['tiny', values.tiny], ['top', values.top], ['high', values.high], ['low', values.low]] as const) {
            await page.locator('.project-nav li, .mob-tab', {hasText: home.tab}).first().click();
            await fillAndCommit(item.locate(page), text);
            const typed = await freshProjectReadings(browser, baseUrl(), viewport, type, screens, item, text);
            const expected = expectedAfterEntry(typed, accepted);
            accepted = acceptedAfterEntry(typed, accepted);
            await expect.poll(async () => differences(expected, await readAllBoxes(page, viewport, screens), 'exact', true),
              {message: `${item.label} typed ${step} (${text}): every box must show what a clean project shows`, timeout: 20_000}).toEqual([]);
          }

          await page.locator('.project-nav li, .mob-tab', {hasText: home.tab}).first().click();
          await fillAndCommit(item.locate(page), original);
          // Typing back the shown text is a rounding of the stored value (a calculated Fp shows 43.82, not 43.8247), so the start
          // is held to the shown precision, and exactly to a clean project with that same text typed.
          const fresh = await freshProjectReadings(browser, baseUrl(), viewport, type, screens, item, original);
          await expect.poll(async () => {
            const now = await readAllBoxes(page, viewport, screens);
            return backAtStart(start, fresh, now, startedCalculated);
          }, {message: `${item.label} typed back to ${original}: no calculated box refused, every box back to its start`, timeout: 20_000}).toEqual([]);
        });
      }
    });
  }
}
