/**
 * Tang Band W5-1138SMF: calculation parity after ONE typed edit (T429).
 * Golden data: `../fixtures/winisd-edit-captures/w5/*.json`, WinISD 0.7.0.950 charts logged by debugger
 * after ONE value was typed into the running WinISD (winisd_research runs/sweep-t429-w5-*).
 * One block per run: load parity, every captured chart, the Box and Vents readouts, the driver editor's marks.
 */
import {describe, expect, it} from 'vitest';
import {
  BOX_FB_EDIT, GROUP_DELAY_BOUND_MS, assertChartMatches, assertLoadParity, chartRules, loadBase,
  loadLoadCapture, sweepAfterEdit,
} from '../fixtures/winisdEditCapture.js';
import type {SpecEditTarget, VentEditTarget} from '../fixtures/winisdEditCapture.js';
import {BP4_GROUP_DELAY_NOISE, boxRun, describeRun as describeDriverRun, lossRun, portRun, readouts} from '../fixtures/winisdEditRuns.js';
import type {DriverRuns, Run} from '../fixtures/winisdEditRuns.js';
import type {BoxType} from '../../engine/index.js';
import type {NumericDriverSpecFieldName} from '../../domain/driver/driverSpecFieldName.js';


const spec = (field: string, name: NumericDriverSpecFieldName): SpecEditTarget => ({pane: 'Driver', field, spec: name});
const vent = (field: string, kind: VentEditTarget['kind']): VentEditTarget => ({pane: 'Vent', field, boxType: 'vented', kind});

const BUG_NUMVC = 'bugs/BUG_20261019_winisd-numvc-is-not-a-simulation-input.md';

/** The checks that deviate, pinned: `it.fails` names the bug file. Key: `<fixture>|<check label>`. */
const W5: DriverRuns = {
  dir: 'w5', label: 'W5-1138SMF', runPrefix: 'sweep-t429-w5-',
  known: new Map<string, string>([
    ...BP4_GROUP_DELAY_NOISE,
    ...['tfmag', 'spl', 'groupdelay', 'tfphase', 'excursion', 'impedance', 'maxpower', 'impedancephase', 'maxspl', 'Box tab: Fsc', 'Box tab: Qtc', 'Driver editor: stated fields']
      .map((label): [string, string] => [`sealed-edit-numvc|${label}`, BUG_NUMVC]),
  ]),
};
const describeRun = (run: Run): void => describeDriverRun(W5, run);


const DRIVER_FIELDS: readonly {readonly key: string; readonly spec: NumericDriverSpecFieldName}[] = [
  {key: 'Fs', spec: 'Fs_hz'}, {key: 'Vas', spec: 'Vas_m3'}, {key: 'Qes', spec: 'Qes'}, {key: 'Qms', spec: 'Qms'},
  {key: 'Qts', spec: 'Qts'}, {key: 'Re', spec: 'Re_ohm'}, {key: 'Le', spec: 'Le_H'}, {key: 'BL', spec: 'BL_Tm'},
  {key: 'Sd', spec: 'Sd_m2'}, {key: 'Xmax', spec: 'Xmax_m'}, {key: 'Pe', spec: 'Pe_W'}, {key: 'Mms', spec: 'Mms_kg'},
  {key: 'Cms', spec: 'Cms_m_per_N'}, {key: 'Rms', spec: 'Rms_kg_per_s'}, {key: 'Znom', spec: 'Znom_ohm'}, {key: 'numVC', spec: 'numVC'},
];

const driverRun = (box: BoxType, boxName: string, field: string): Run => {
  const f = DRIVER_FIELDS.find((d) => d.key.toLowerCase() === field);
  if (f === undefined) throw new Error(`no driver field ${field}`);
  return {fixture: `${boxName}-edit-${field}`, title: `${boxName}, ${f.key} typed in the Driver editor`, box, edit: spec(f.key, f.spec)};
};

// The dry run: Fb 45, richer charts.
describeRun({fixture: 'vented-fb', title: 'vented, Fb typed in the Box tab', box: 'vented', edit: BOX_FB_EDIT});

for (const field of ['fs', 'vas', 'qes', 'qms', 'qts', 're', 'le', 'bl', 'sd', 'xmax', 'pe', 'mms', 'cms', 'rms', 'znom', 'numvc']) {
  describeRun(driverRun('sealed', 'sealed', field));
}
for (const field of ['fs', 'vas', 'qes', 'qms', 'bl', 're']) {
  describeRun(driverRun('vented', 'vented', field));
  describeRun(driverRun('bandpass6', 'bp6', field));
}

describeRun({fixture: 'sealed-edit-vb', title: 'sealed, Vb typed in the Box tab', box: 'sealed',
  edit: {pane: 'Box', field: 'Vb', boxType: 'sealed', slot: 'volume'}});
describeRun({fixture: 'vented-edit-vb', title: 'vented, Vb typed in the Box tab', box: 'vented',
  edit: {pane: 'Box', field: 'Vb', boxType: 'vented', slot: 'volume'}});
describeRun({fixture: 'vented-edit-fb', title: 'vented, Fb typed in the Box tab', box: 'vented', edit: BOX_FB_EDIT});
describeRun({fixture: 'vented-edit-ventdia', title: 'vented, vent diameter typed in the Vents tab', box: 'vented', edit: vent('dia', 'diameter')});
describeRun({fixture: 'vented-edit-ventnum', title: 'vented, number of vents typed in the Vents tab', box: 'vented', edit: vent('Num', 'count')});
describeRun({fixture: 'pr-edit-vb', title: 'passive radiator, Vb typed in the Box tab', box: 'box-passive-radiator',
  edit: {pane: 'Box', field: 'Vb', boxType: 'box-passive-radiator', slot: 'volume'}});


// ── batch 4: Loss popup, bandpass and ABC box values, ports, Signal ──────────────────────────────

for (const name of ['sealed']) for (const f of ['qlr', 'qar']) describeRun(lossRun(name, f));
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

// ── batch 5: three loaded end corrections, nothing typed ─────────────────────────────────────────

/** The rear vent length WinISD saved for the 5 cm vent, Fb 38 Hz, 10 L, per loaded end correction. */
for (const [fixture, endCorrection, savedLength_m] of [
  ['vented-load-endcorr06', 0.6, 0.376838], ['vented-load-endcorr0732', 0.732, 0.370238], ['vented-load-endcorr085', 0.85, 0.364338],
] as const) {
  describe(`W5-1138SMF vented, end correction ${endCorrection} loaded (sweep-t429-w5-${fixture})`, () => {
    const capture = loadLoadCapture('w5', fixture);
    const project = loadBase(capture);
    it('the base file loads as the file states', () => assertLoadParity(project, capture));
    it('the vent length is the one WinISD saved', () => {
      expect(project.box.vented.vent.endCorrection_m.value).toBe(endCorrection);
      expect(project.box.vented.vent.length_m.value).toBeCloseTo(savedLength_m, 6);
    });
    const swept = sweepAfterEdit(project, capture);
    const rules = chartRules(GROUP_DELAY_BOUND_MS);
    for (const q of capture.charts.keys()) it(`${q} matches`, () => assertChartMatches(capture, swept, q, rules));
    const checks = readouts('vented', capture, project);
    for (const c of checks) it(`${c.label} matches`, c.check);
  });
}
