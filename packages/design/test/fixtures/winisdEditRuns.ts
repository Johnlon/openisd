/**
 * The runs both driver edit-parity files share (T429): one Run is one WinISD capture (a driver, one typed edit), checked against
 * OpenISD's charts, the Box and Vents readouts and the driver editor's marks. A driver's test file lists its runs and its known deviations.
 */
import {describe, expect, it} from 'vitest';
import {
  BOX_VOLUME, FRONT_BOX_VOLUME, FRONT_TUNING, FRONT_VENT_CROSS_AREA, FRONT_VENT_LENGTH, GROUP_DELAY_BOUND_MS, INTRA_VENT_CROSS_AREA,
  INTRA_VENT_LENGTH, PR_TUNING, SEALED_FSC, SEALED_QTC, UNSTATED_ZERO_KEYS, VENTED_FB, VENT_CROSS_AREA, VENT_LENGTH, applyEdit, unstatedBlankDeviations,
  applyLossEdit, applyPortEdit, applySignalEdit, applySpecEdit, applyVentEdit, assertChartMatches, assertLoadParity, assertReadout,
  chartRules, editorDeviations, loadBase, loadEditCapture, sweepAfterEdit,
} from './winisdEditCapture.js';
import type {
  Capture, EditCapture, EditTarget, LossEditTarget, PortEditTarget, Quantity, ReadoutSpot, SignalEditTarget, SpecEditTarget, VentEditTarget,
} from './winisdEditCapture.js';
import type {BoxType} from '../../engine/index.js';
import type {LossChamber} from '../../domain/box/box.js';
import type {OpenISDProject} from '../../domain/project/openISDProject.js';

/** The bp6 group delay bound (≈ WinISD's own noise on the two-port box). */
const BP6_GROUP_DELAY_BOUND_MS = 0.15;

/** WinISD's bp4 group delay is rounding noise from about 200 Hz up, on the W5-1138SMF and the E150HE-44 box alike: over the 20 runs
 *  the last clean point is 204 Hz and the first deviating one 220 Hz. */
export const BUG_BP4_GD = 'bugs/BUG_20261019_winisd-bp4-group-delay-is-rounding-noise-from-200-hz.md';
const GD_NOISE_FROM_HZ = 200;

/** The capture with its group delay cut to the points below (or from) `GD_NOISE_FROM_HZ`. */
function groupDelaySplit(capture: Capture, part: 'below' | 'above'): Capture {
  const points = capture.charts.get('groupdelay') ?? [];
  const kept = points.filter((p) => (part === 'below') === (p.f < GD_NOISE_FROM_HZ));
  return {...capture, charts: new Map([['groupdelay', kept]])};
}

/** The known-deviation entries of every bp4 run: the group delay from 200 Hz up is WinISD's rounding noise. */
export const BP4_GROUP_DELAY_NOISE: readonly (readonly [string, string])[] =
  ['qlr', 'qar', 'qiclfr', 'qlf', 'qaf', 'qpf', 'vr', 'vf', 'ff', 'ventfrontdia']
    .map((f): [string, string] => [`bp4-edit-${f}|groupdelay above ${GD_NOISE_FROM_HZ} Hz`, BUG_BP4_GD]);

export type Edit = EditTarget | SpecEditTarget | VentEditTarget | LossEditTarget | PortEditTarget | SignalEditTarget;

function apply(project: OpenISDProject, capture: EditCapture, edit: Edit): void {
  if ('slot' in edit) applyEdit(project, capture, edit);
  else if ('chamber' in edit) applyLossEdit(project, capture, edit);
  else if ('signal' in edit) applySignalEdit(project, capture, edit);
  else if ('port' in edit) applyPortEdit(project, capture, edit);
  else if ('spec' in edit) applySpecEdit(project, capture, edit);
  else applyVentEdit(project, capture, edit);
}

interface Readout { readonly label: string; readonly check: () => void }

/** Where WinISD's Box and Vents tabs print, per box: each reads what OpenISD holds for the same control. */
export function readouts(box: BoxType, capture: Capture, p: OpenISDProject): readonly Readout[] {
  const b = p.box;
  const r = (label: string, spot: ReadoutSpot, got: number | null): Readout => ({label, check: () => assertReadout(capture, spot, got, label)});
  switch (box) {
    case 'sealed':
      return [
        r('Box tab: Vb', BOX_VOLUME, b.sealed.volume_m3.value), r('Box tab: Fsc', SEALED_FSC, b.sealed.resonance_hz.value),
        r('Box tab: Qtc', SEALED_QTC, b.sealed.q_tc.value),
      ];
    case 'vented':
      return [
        r('Box tab: Vb', BOX_VOLUME, b.vented.volume_m3.value), r('Box tab: Fb', VENTED_FB, b.vented.tuning_goal_hz.value),
        r('Vents tab: vent length', VENT_LENGTH, b.vented.vent.length_m.value),
        r('Vents tab: cross area', VENT_CROSS_AREA, b.vented.vent.totalArea_m2()),
      ];
    case 'bandpass4': {
      const {chambers, vents} = b.bandpass4;
      return [
        r('Box tab: rear Vb', BOX_VOLUME, chambers.rear.volume_m3.value),
        r('Box tab: front Vb', FRONT_BOX_VOLUME, chambers.front.volume_m3.value), r('Box tab: front Fb', FRONT_TUNING, chambers.front.tuning_goal_hz.value),
        r('Vents tab: front vent length', FRONT_VENT_LENGTH, vents.front.length_m.value),
        r('Vents tab: front cross area', FRONT_VENT_CROSS_AREA, vents.front.totalArea_m2()),
      ];
    }
    case 'abc': {
      const {chambers, vents} = b.abc;
      return [
        r('Box tab: rear Vb', BOX_VOLUME, chambers.rear.volume_m3.value), r('Box tab: rear Fb', VENTED_FB, chambers.rear.tuning_goal_hz.value),
        r('Box tab: front Vb', FRONT_BOX_VOLUME, chambers.front.volume_m3.value), r('Box tab: front Fb', FRONT_TUNING, chambers.front.tuning_goal_hz.value),
        r('Vents tab: rear vent length', VENT_LENGTH, vents.rear.length_m.value),
        r('Vents tab: rear cross area', VENT_CROSS_AREA, vents.rear.totalArea_m2()),
        r('Vents tab: front vent length', FRONT_VENT_LENGTH, vents.front.length_m.value),
        r('Vents tab: front cross area', FRONT_VENT_CROSS_AREA, vents.front.totalArea_m2()),
        r('Vents tab: intra vent length', INTRA_VENT_LENGTH, vents.intra.length_m.value),
        r('Vents tab: intra cross area', INTRA_VENT_CROSS_AREA, vents.intra.totalArea_m2()),
      ];
    }
    case 'bandpass6': {
      const {chambers, vents} = b.bandpass6;
      return [
        r('Box tab: rear Vb', BOX_VOLUME, chambers.rear.volume_m3.value), r('Box tab: rear Fb', VENTED_FB, chambers.rear.tuning_goal_hz.value),
        r('Box tab: front Vb', FRONT_BOX_VOLUME, chambers.front.volume_m3.value), r('Box tab: front Fb', FRONT_TUNING, chambers.front.tuning_goal_hz.value),
        r('Vents tab: rear vent length', VENT_LENGTH, vents.rear.length_m.value),
        r('Vents tab: rear cross area', VENT_CROSS_AREA, vents.rear.totalArea_m2()),
        r('Vents tab: front vent length', FRONT_VENT_LENGTH, vents.front.length_m.value),
        r('Vents tab: front cross area', FRONT_VENT_CROSS_AREA, vents.front.totalArea_m2()),
      ];
    }
    case 'box-passive-radiator':
      return [r('Box tab: Vb', BOX_VOLUME, b.passiveRadiator.volume_m3.value), r('Box tab: Fp', PR_TUNING, b.passiveRadiator.systemTuning_hz.value)];
  }
}

/** One driver's captures: where they live, how its tests are named, and its checks that deviate (`it.fails` names the bug file).
 *  A known key is `<fixture>|<check label>`. */
export interface DriverRuns {
  readonly dir: string;
  readonly label: string;
  readonly runPrefix: string;
  readonly known: ReadonlyMap<string, string>;
}

export interface Run {
  readonly fixture: string;
  readonly title: string;
  readonly box: BoxType;
  readonly edit: Edit;
}

export function describeRun(driver: DriverRuns, run: Run): void {
  describe(`${driver.label} ${run.title} (${driver.runPrefix}${run.fixture})`, () => {
    const capture = loadEditCapture(driver.dir, run.fixture);
    const project = loadBase(capture);
    it('the base file loads as the file states', () => assertLoadParity(loadBase(capture), capture));
    apply(project, capture, run.edit);
    const swept = sweepAfterEdit(project, capture);
    const rules = chartRules(run.box === 'bandpass6' ? BP6_GROUP_DELAY_BOUND_MS : GROUP_DELAY_BOUND_MS);
    const checks: Readout[] = [
      ...[...capture.charts.keys()].flatMap((q: Quantity): Readout[] => run.box === 'bandpass4' && q === 'groupdelay'
        ? [{label: `groupdelay below ${GD_NOISE_FROM_HZ} Hz`, check: () => assertChartMatches(groupDelaySplit(capture, 'below'), swept, q, rules)},
           {label: `groupdelay above ${GD_NOISE_FROM_HZ} Hz`, check: () => assertChartMatches(groupDelaySplit(capture, 'above'), swept, q, rules)}]
        : [{label: q, check: () => assertChartMatches(capture, swept, q, rules)}]),
      ...readouts(run.box, capture, project),
      ...(capture.editor === null ? [] : [{label: 'Driver editor: stated fields', check: () => {
        expect(editorDeviations(project, capture, (f) => !UNSTATED_ZERO_KEYS.includes(f.key))).toEqual([]);
      }}]),
    ];
    for (const c of checks) {
      const bug = driver.known.get(`${run.fixture}|${c.label}`);
      if (bug === undefined) it(`${c.label} matches`, c.check);
      else it.fails(`${c.label} after ${run.edit.field} — ${bug}`, c.check);
    }
    if (capture.editor !== null) {
      it('Driver editor: fLe, KLe, Hc, Hg the file leaves out stay blank (WinISD shows entered zeros; John, QO279)', () => {
        expect(unstatedBlankDeviations(project, capture)).toEqual([]);
      });
    }
  });
}

const BOXES: readonly {readonly name: string; readonly box: BoxType; readonly title: string}[] = [
  {name: 'sealed', box: 'sealed', title: 'sealed'}, {name: 'vented', box: 'vented', title: 'vented'},
  {name: 'pr', box: 'box-passive-radiator', title: 'passive radiator'}, {name: 'bp4', box: 'bandpass4', title: '4th order bandpass'},
  {name: 'bp6', box: 'bandpass6', title: '6th order bandpass'}, {name: 'abc', box: 'abc', title: 'ABC'},
];
const boxOf = (name: string): BoxType => {
  const b = BOXES.find((x) => x.name === name);
  if (b === undefined) throw new Error(`no box ${name}`);
  return b.box;
};
const titleOf = (name: string): string => BOXES.find((x) => x.name === name)?.title ?? name;

const LOSSES: readonly {readonly field: string; readonly side: 'rear' | 'front'; readonly kind: LossEditTarget['kind']}[] = [
  {field: 'Qlr', side: 'rear', kind: 'Ql'}, {field: 'Qar', side: 'rear', kind: 'Qa'}, {field: 'Qpr', side: 'rear', kind: 'Qp'},
  {field: 'Qiclfr', side: 'rear', kind: 'Qicl'}, {field: 'Qlf', side: 'front', kind: 'Ql'}, {field: 'Qaf', side: 'front', kind: 'Qa'},
  {field: 'Qpf', side: 'front', kind: 'Qp'},
];
export const lossRun = (name: string, field: string): Run => {
  const l = LOSSES.find((x) => x.field.toLowerCase() === field);
  if (l === undefined) throw new Error(`no loss ${field}`);
  const box = boxOf(name);
  const chamber: LossChamber = box === 'bandpass4' || box === 'bandpass6' || box === 'abc' ? l.side : 'whole';
  return {fixture: `${name}-edit-${field}`, title: `${titleOf(name)}, ${l.field} typed in the Loss popup`, box,
    edit: {pane: 'Loss', field: l.field, boxType: box, chamber, kind: l.kind}};
};
export const boxRun = (name: string, field: 'vr' | 'vf' | 'ff' | 'fr'): Run => {
  const box = boxOf(name);
  const f = {vr: ['Vr', 'volume'], vf: ['Vf', 'frontVolume'], ff: ['Ff', 'ventTuning'], fr: ['Fr', 'rearTuning']} as const;
  return {fixture: `${name}-edit-${field}`, title: `${titleOf(name)}, ${f[field][0]} typed in the Box tab`, box,
    edit: {pane: 'Box', field: f[field][0], boxType: box, slot: f[field][1]}};
};
export const portRun = (name: string, port: 'front' | 'rear' | 'intra', what: 'dia' | 'len'): Run => {
  const box = boxOf(name);
  const pane = {front: 'VentFront', rear: 'VentRear', intra: 'VentIntra'} as const;
  const portName = {front: 'Front', rear: 'Rear', intra: 'Intra'} as const;
  return {fixture: `${name}-edit-vent${port}${what === 'dia' ? 'dia' : 'len'}`,
    title: `${titleOf(name)}, ${port} vent ${what === 'dia' ? 'diameter' : 'length'} typed in the Vents tab`, box,
    edit: {pane: pane[port], field: what, boxType: box, port: portName[port], kind: what === 'dia' ? 'diameter' : 'length'}};
};
