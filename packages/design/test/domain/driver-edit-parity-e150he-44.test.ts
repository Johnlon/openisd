/**
 * Dayton E150HE-44: calculation parity after a driver edit (T429).
 * Golden data: `../fixtures/winisd-edit-captures/e150he-44/*.json`, WinISD 0.7.0.950 charts logged by debugger
 * after ONE value was typed into the running WinISD (winisd_research runs/sweep-t429-e150-*).
 */
import assert from 'node:assert/strict';
import {describe, expect, it} from 'vitest';
import {
  DRIVER_VAS_EDIT, UNSTATED_ZERO_KEYS, unstatedBlankDeviations, GROUP_DELAY_BOUND_MS, SEALED_FSC, SEALED_QTC, BOX_VOLUME, VENTED_FB, VENT_CROSS_AREA, VENT_LENGTH,
  applyEdit, assertChartMatches, assertLoadParity, assertReadout, chartRules, editorDeviations,
  loadBase, loadEditCapture, sweepAfterEdit,
} from '../fixtures/winisdEditCapture.js';
import type {
  EditCapture, Quantity,
} from '../fixtures/winisdEditCapture.js';
import type {NumericDriverSpecFieldName} from '../../domain/driver/driverSpecFieldName.js';
import type {OpenISDProject} from '../../domain/project/openISDProject.js';
import {BP4_GROUP_DELAY_NOISE, boxRun, describeRun as describeRunOf, lossRun, portRun} from '../fixtures/winisdEditRuns.js';
import type {DriverRuns, Run} from '../fixtures/winisdEditRuns.js';

describe('E150HE-44 sealed, Vas typed in the Driver editor (sweep-t429-e150-sealed-edit-vas)', () => {
  const capture = loadEditCapture('e150he-44', 'sealed-vas');
  const project = loadBase(capture);
  it('the base file loads as the file states', () => assertLoadParity(loadBase(capture), capture));
  applyEdit(project, capture, DRIVER_VAS_EDIT);
  const swept = sweepAfterEdit(project, capture);
  const rules = chartRules(GROUP_DELAY_BOUND_MS);
  const charts: readonly Quantity[] = ['tfmag', 'spl', 'groupdelay', 'tfphase', 'excursion', 'impedance', 'maxpower', 'impedancephase', 'maxspl'];

  for (const q of charts) it(`${q} matches`, () => assertChartMatches(capture, swept, q, rules));

  it('Box tab: Vb, Fsc and Qtc read as WinISD prints them', () => {
    assertReadout(capture, BOX_VOLUME, project.box.sealed.volume_m3.value, 'Vb');
    assertReadout(capture, SEALED_FSC, project.box.sealed.resonance_hz.value, 'Fsc');
    assertReadout(capture, SEALED_QTC, project.box.sealed.q_tc.value, 'Qtc');
  });

  it('Driver editor: every stated field has WinISD\'s value and E/C mark', () => {
    expect(editorDeviations(project, capture, (f) => !UNSTATED_ZERO_KEYS.includes(f.key))).toEqual([]);
  });

  it('Driver editor: fLe, KLe, Hc, Hg the file leaves out stay blank (WinISD shows entered zeros; John, QO279)', () => {
    expect(unstatedBlankDeviations(project, capture)).toEqual([]);
  });
});

// ── the other edits: each captured run is one describe; the edit is written where the editor writes it ──

/** The driver editor's Parameters-tab field each WinISD field name is typed into. */
const DRIVER_EDITS: readonly {readonly run: string; readonly field: string; readonly spec: NumericDriverSpecFieldName}[] = [
  {run: 'sealed-fs', field: 'Fs', spec: 'Fs_hz'}, {run: 'sealed-qes', field: 'Qes', spec: 'Qes'},
  {run: 'sealed-qms', field: 'Qms', spec: 'Qms'}, {run: 'sealed-qts', field: 'Qts', spec: 'Qts'},
  {run: 'sealed-re', field: 'Re', spec: 'Re_ohm'}, {run: 'sealed-le', field: 'Le', spec: 'Le_H'},
  {run: 'sealed-bl', field: 'BL', spec: 'BL_Tm'}, {run: 'sealed-sd', field: 'Sd', spec: 'Sd_m2'},
  {run: 'sealed-xmax', field: 'Xmax', spec: 'Xmax_m'}, {run: 'sealed-pe', field: 'Pe', spec: 'Pe_W'},
  {run: 'sealed-mms', field: 'Mms', spec: 'Mms_kg'}, {run: 'sealed-cms', field: 'Cms', spec: 'Cms_m_per_N'},
  {run: 'sealed-rms', field: 'Rms', spec: 'Rms_kg_per_s'}, {run: 'sealed-znom', field: 'Znom', spec: 'Znom_ohm'},
];

/** Where the vented box's vent is edited; `Num` and `dia` are WinISD's Vents-tab fields. */
const VENT_EDITS: readonly {readonly run: string; readonly field: string; readonly write: (p: OpenISDProject, v: number) => void}[] = [
  {run: 'vented-ventdia', field: 'dia', write: (p, v) => p.batch(() => { p.box.vented.vent.diameter_m.set(v); p.recalc(); })},
  {run: 'vented-ventnum', field: 'Num', write: (p, v) => p.batch(() => { p.box.vented.vent.count.set(v); p.recalc(); })},
];

function expectEdit(capture: EditCapture, pane: string, field: string): void {
  assert.equal(capture.pane, pane, `${capture.run}: edit pane`);
  assert.equal(capture.field, field, `${capture.run}: edit field`);
}

const FULL_CHARTS: readonly Quantity[] = ['tfmag', 'spl', 'groupdelay', 'tfphase', 'excursion', 'impedance', 'maxpower', 'impedancephase', 'maxspl'];
const rules = chartRules(GROUP_DELAY_BOUND_MS);

function chartCases(capture: EditCapture, swept: ReturnType<typeof sweepAfterEdit>, charts: readonly Quantity[]): void {
  for (const q of charts) it(`${q} matches`, () => assertChartMatches(capture, swept, q, rules));
}

for (const {run, field, spec} of DRIVER_EDITS) {
  describe(`E150HE-44 sealed, ${field} typed in the Driver editor (sweep-t429-e150-${run.replace('-', '-edit-')})`, () => {
    const capture = loadEditCapture('e150he-44', run);
    const project = loadBase(capture);
    it('the base file loads as the file states', () => assertLoadParity(loadBase(capture), capture));
    expectEdit(capture, 'Driver', field);
    project.driver.specField(spec).set(capture.typed);
    const swept = sweepAfterEdit(project, capture);
    chartCases(capture, swept, FULL_CHARTS);

    it('Box tab: Vb, Fsc and Qtc read as WinISD prints them', () => {
      assertReadout(capture, BOX_VOLUME, project.box.sealed.volume_m3.value, 'Vb');
      assertReadout(capture, SEALED_FSC, project.box.sealed.resonance_hz.value, 'Fsc');
      assertReadout(capture, SEALED_QTC, project.box.sealed.q_tc.value, 'Qtc');
    });
    it('Driver editor: every stated field has WinISD\'s value and E/C mark', () => {
      expect(editorDeviations(project, capture, (f) => !UNSTATED_ZERO_KEYS.includes(f.key))).toEqual([]);
    });
  });
}

describe('E150HE-44 sealed, Vb typed in the Box tab (sweep-t429-e150-sealed-edit-vb)', () => {
  const capture = loadEditCapture('e150he-44', 'sealed-vb');
  const project = loadBase(capture);
  it('the base file loads as the file states', () => assertLoadParity(loadBase(capture), capture));
  expectEdit(capture, 'Box', 'Vb');
  project.box.sealed.volume_m3.set(capture.typed);
  const swept = sweepAfterEdit(project, capture);
  chartCases(capture, swept, ['tfmag', 'spl', 'groupdelay', 'tfphase', 'excursion', 'impedance']);
  it('Box tab: Vb, Fsc and Qtc read as WinISD prints them', () => {
    assertReadout(capture, BOX_VOLUME, project.box.sealed.volume_m3.value, 'Vb');
    assertReadout(capture, SEALED_FSC, project.box.sealed.resonance_hz.value, 'Fsc');
    assertReadout(capture, SEALED_QTC, project.box.sealed.q_tc.value, 'Qtc');
  });
});

const VENTED_CHARTS: readonly Quantity[] = ['tfmag', 'spl', 'groupdelay', 'tfphase', 'excursion', 'impedance', 'rearportvelocity'];

function ventedReadouts(capture: EditCapture, project: OpenISDProject): void {
  it('Box tab: Vb and Fb read as WinISD prints them', () => {
    assertReadout(capture, BOX_VOLUME, project.box.vented.volume_m3.value, 'Vb');
    assertReadout(capture, VENTED_FB, project.box.vented.tuning_goal_hz.value, 'Fb');
  });
  it('Vents tab: cross area reads as WinISD prints it', () => assertReadout(capture, VENT_CROSS_AREA, project.box.vented.vent.totalArea_m2(), 'cross area as the Vents tab shows it'));
  it('Vents tab: vent length reads as WinISD prints it', () => assertReadout(capture, VENT_LENGTH, project.box.vented.vent.length_m.value, 'vent length'));
}

describe('E150HE-44 vented, Fb typed in the Box tab (sweep-t429-e150-vented-edit-fb)', () => {
  const capture = loadEditCapture('e150he-44', 'vented-fb');
  const project = loadBase(capture);
  it('the base file loads as the file states', () => assertLoadParity(loadBase(capture), capture));
  expectEdit(capture, 'Box', 'Fb');
  project.box.vented.tuning_goal_hz.set(capture.typed);
  const swept = sweepAfterEdit(project, capture);
  chartCases(capture, swept, VENTED_CHARTS);
  ventedReadouts(capture, project);
});

describe('E150HE-44 vented, Vb typed in the Box tab (sweep-t429-e150-vented-edit-vb)', () => {
  const capture = loadEditCapture('e150he-44', 'vented-vb');
  const project = loadBase(capture);
  it('the base file loads as the file states', () => assertLoadParity(loadBase(capture), capture));
  expectEdit(capture, 'Box', 'Vb');
  project.box.vented.volume_m3.set(capture.typed);
  const swept = sweepAfterEdit(project, capture);
  chartCases(capture, swept, VENTED_CHARTS);
  ventedReadouts(capture, project);
});

for (const {run, field, write} of VENT_EDITS) {
  describe(`E150HE-44 vented, vent ${field} typed in the Vents tab (sweep-t429-e150-${run.replace('-', '-edit-')})`, () => {
    const capture = loadEditCapture('e150he-44', run);
    const project = loadBase(capture);
    it('the base file loads as the file states', () => assertLoadParity(loadBase(capture), capture));
    expectEdit(capture, 'Vent', field);
    write(project, capture.typed);
    const swept = sweepAfterEdit(project, capture);
    chartCases(capture, swept, VENTED_CHARTS);
    ventedReadouts(capture, project);
  });
}

describe('E150HE-44 passive radiator, Vb typed in the Box tab (sweep-t429-e150-pr-edit-vb)', () => {
  const capture = loadEditCapture('e150he-44', 'pr-vb');
  const project = loadBase(capture);
  it('the base file loads as the file states', () => assertLoadParity(loadBase(capture), capture));
  expectEdit(capture, 'Box', 'Vb');
  project.box.passiveRadiator.volume_m3.set(capture.typed);
  const swept = sweepAfterEdit(project, capture);
  chartCases(capture, swept, ['tfmag', 'spl', 'tfphase', 'excursion', 'impedance']);
  it('Box tab: Vb and Fb read as WinISD prints them', () => {
    assertReadout(capture, BOX_VOLUME, project.box.passiveRadiator.volume_m3.value, 'Vb');
    assertReadout(capture, VENTED_FB, project.box.passiveRadiator.tuning_goal_hz.value, 'Fb');
  });
});

// numVC is not a simulation input in WinISD: typed or loaded, every chart and USPL stay at the one-coil figures (Re and BL are
// terminal values). OpenISD stores Re and BL per coil, so the coil count moves the terminal values and the charts.
const NUMVC_BUG = 'bugs/BUG_20261019_winisd-numvc-is-not-a-simulation-input.md';

describe('E150HE-44 sealed, numVC typed in the Driver editor (sweep-t429-e150-sealed-edit-numvc)', () => {
  const capture = loadEditCapture('e150he-44', 'sealed-numvc');
  const project = loadBase(capture);
  it('the base file loads as the file states', () => assertLoadParity(loadBase(capture), capture));
  expectEdit(capture, 'Driver', 'numVC');
  project.driver.specField('numVC').set(capture.typed);
  const swept = sweepAfterEdit(project, capture);
  chartCases(capture, swept, ['tfmag', 'groupdelay', 'tfphase']);
  for (const q of ['spl', 'excursion', 'impedance', 'impedancephase', 'maxpower', 'maxspl'] as const) {
    // BUG_20261019_winisd-numvc-is-not-a-simulation-input (NUMVC_BUG)
    it.fails(`${q} after numVC edit — ${NUMVC_BUG}`, () => assertChartMatches(capture, swept, q, rules));
  }
  it('Box tab: Vb, Fsc and Qtc read as WinISD prints them', () => {
    assertReadout(capture, BOX_VOLUME, project.box.sealed.volume_m3.value, 'Vb');
    assertReadout(capture, SEALED_FSC, project.box.sealed.resonance_hz.value, 'Fsc');
    assertReadout(capture, SEALED_QTC, project.box.sealed.q_tc.value, 'Qtc');
  });
  it('Driver editor: every stated field except USPL has WinISD\'s value and E/C mark', () => {
    expect(editorDeviations(project, capture, (f) => !UNSTATED_ZERO_KEYS.includes(f.key) && f.key !== 'USPL')).toEqual([]);
  });
  // BUG_20261019_winisd-numvc-is-not-a-simulation-input (NUMVC_BUG)
  it.fails(`Driver editor: USPL after numVC edit — ${NUMVC_BUG}`, () => {
    expect(editorDeviations(project, capture, (f) => f.key === 'USPL')).toEqual([]);
  });
});

// ── batch 4: Loss popup, bandpass and ABC box values, ports, Signal ──────────────────────────────

const E150: DriverRuns = {dir: 'e150he-44', label: 'E150HE-44', runPrefix: 'sweep-t429-e150-', known: new Map<string, string>(BP4_GROUP_DELAY_NOISE)};
const describeRun = (run: Run): void => describeRunOf(E150, run);

for (const f of ['qlr', 'qar']) describeRun(lossRun('sealed', f));
for (const f of ['qlr', 'qar', 'qpr']) describeRun(lossRun('vented', f));
for (const f of ['qlr', 'qar']) describeRun(lossRun('pr', f));
for (const f of ['qlr', 'qar', 'qiclfr', 'qlf', 'qaf', 'qpf']) describeRun(lossRun('bp4', f));
for (const name of ['bp6', 'abc']) for (const f of ['qlr', 'qar', 'qpr', 'qiclfr', 'qlf', 'qaf', 'qpf']) describeRun(lossRun(name, f));
for (const f of ['vr', 'vf', 'ff'] as const) describeRun(boxRun('bp4', f));
for (const name of ['bp6', 'abc']) for (const f of ['vr', 'vf', 'ff', 'fr'] as const) describeRun(boxRun(name, f));
describeRun(portRun('bp4', 'front', 'dia'));
for (const name of ['bp6', 'abc']) for (const p of ['front', 'rear'] as const) describeRun(portRun(name, p, 'dia'));
describeRun(portRun('abc', 'intra', 'dia'));
describeRun(portRun('abc', 'intra', 'len'));
describeRun({fixture: 'sealed-edit-pin', title: 'sealed, input power Pin typed in the Signal pane', box: 'sealed', edit: {pane: 'Signal', field: 'Pin', signal: 'Pin'}});
describeRun({fixture: 'sealed-edit-rg', title: 'sealed, source resistance Rg typed in the Signal pane', box: 'sealed', edit: {pane: 'Signal', field: 'Rg', signal: 'Rg'}});
