/**
 * Every input the engine reads recalculates the charts (T403, bugs/BUG_20261018_what-if-qts-vas-do-not-move-charts.md).
 *
 * One test that goes through every driver spec field, every project setting, every compat switch,
 * every box setting of every box type and every What-if row, changes it by a meaningful amount and
 * proves the swept chart data moved; then proves a What-if cancel puts the data back exactly.
 *
 * The inputs are enumerated FROM THE DEFINITIONS, so a new one is covered the day it exists:
 * - driver spec fields: `DRIVER_SPEC_FIELD_NAMES` (domain/driver/driverSpecFieldName.ts);
 * - project settings: every key of `OpenISDProject` with a `set` (`SettingKey` below: a new
 *   setting fails to compile until it is classified in `PROJECT_SETTINGS`);
 * - compat switches: `CompatSwitch.ALL` (domain/project/compatSwitch.ts);
 * - box settings: `Box.volumeOf / frontVolumeOf / rearTuningOf / ventGroupOf / ventPortsOf /
 *   lossGroupsOf` (domain/box/openISDBox.ts) for each `BoxType`, plus the passive radiator's own fields;
 * - What-if rows: `SheetMode.WHAT_IF.lines(boxType)` (fields/sheetMode.ts, fields/sheetField.ts).
 *
 * An input that legitimately moves no chart is in an EXEMPT table with its reason. An exempt input
 * is also proven to move nothing, so an exemption cannot go stale.
 *
 * Target behaviour (John, 18 Oct 2026): the circuit is driven from Fs, Vas, Qes, Qms, Re, Sd, BL, Le
 * as WinISD does. Cms, Mms, Rms are display only; Qts only fills a missing Qes/Qms or shows a
 * conflict; the What-if driver rows are Fs, Vas, Qes, Qms (no Qts).
 */
import {describe, expect, it} from 'vitest';
import type {BoxType, Filter} from '../../engine/index.js';
import {createEngine} from '../../engine/Engine.js';
import {DRIVER_SPEC_FIELD_NAMES} from '../../domain/driver/driverSpecFieldName.js';
import type {NumericDriverSpecFieldName} from '../../domain/driver/driverSpecFieldName.js';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {CompatSwitch} from '../../domain/project/compatSwitch.js';
import type {OpenISDProject} from '../../domain/project/openISDProject.js';
import type {Writable} from '../../domain/cell.js';
import {NumberField} from '../../fields/field.js';
import {SheetField} from '../../fields/sheetField.js';
import {readSheetSlot, writeSheetSlot} from '../../domain/project/sheetSlots.js';
import {SheetMode} from '../../fields/sheetMode.js';

import {driverFromSpec} from '../fixtures/recordBuilders.js';

/** No point count, so the project's own `sweepN` decides it. */
const GRID: FrequencyGrid = {fmin: 10, fmax: 1000};
const engine = createEngine();

/** The captured W5-1138SMF figures: every value a library driver has entered, mutually consistent. */
const LIBRARY_DRIVER = {
  Fs_hz: 45, Qes: 0.57, Qms: 3.56, Qts: 0.49, Vas_m3: 0.00485, Sd_m2: 0.0094, Re_ohm: 3.4,
  BL_Tm: 7.17, Le_H: 0.00034, Cms_m_per_N: 0.00036872, Mms_kg: 0.02881, Rms_kg_per_s: 2.2881560650261163,
  Xmax_m: 0.00925, Pe_W: 40,
};

const BOX_TYPES: readonly BoxType[] = ['sealed', 'vented', 'bandpass4', 'bandpass6', 'abc', 'box-passive-radiator'];

/** A full library-style project in each box type, every figure the engine could read entered. */
const PROJECTS: Readonly<Record<BoxType, () => OpenISDProject>> = {
  sealed: () => new ProjectBuilder(driverFromSpec(engine, LIBRARY_DRIVER), engine).sealed().volume_m3(0.006).build(),
  vented: () => new ProjectBuilder(driverFromSpec(engine, LIBRARY_DRIVER), engine).vented().volume_m3(0.01).tuning_goal_hz(40).build(),
  bandpass4: () => new ProjectBuilder(driverFromSpec(engine, LIBRARY_DRIVER), engine).bandpass4()
    .rearVolume_m3(0.008).frontVolume_m3(0.012).frontTuning_hz(60).build(),
  bandpass6: () => new ProjectBuilder(driverFromSpec(engine, LIBRARY_DRIVER), engine).bandpass6()
    .rearVolume_m3(0.01).frontVolume_m3(0.012).rearTuning_hz(40).frontTuning_hz(60).build(),
  abc: () => new ProjectBuilder(driverFromSpec(engine, LIBRARY_DRIVER), engine).abc()
    .rearVolume_m3(0.01).frontVolume_m3(0.012).rearTuning_hz(40).frontTuning_hz(60).build(),
  'box-passive-radiator': () => new ProjectBuilder(driverFromSpec(engine, LIBRARY_DRIVER), engine)
    .passiveRadiator().volume_m3(0.01).build(),
};

// ── the charts ───────────────────────────────────────────────────────────────────────────────────

/** Every swept series of the project, as a comparable string per series name. */
function chartsOf(project: OpenISDProject): ReadonlyMap<string, string> {
  const result = project.sweep(GRID);
  const values = result.values;
  if (values === undefined || values === null) throw new Error(`the project did not sweep: ${JSON.stringify(result.issues)}`);
  const charts = new Map(Object.entries(values).map(([series, data]) => [series, JSON.stringify(data)]));
  const maxCurves = project.maxCurves(GRID).values;
  if (maxCurves !== null) for (const [series, data] of Object.entries(maxCurves)) charts.set(`max.${series}`, JSON.stringify(data));
  return charts;
}

function changedSeries(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): readonly string[] {
  return [...after.keys()].filter(series => before.get(series) !== after.get(series));
}

/** Something to change, and where its change must show. */
interface Edit {
  readonly apply: (project: OpenISDProject) => void;
}

/** An input proven twice: edited in the project it moves the charts, edited in a What-if it moves
 *  them and a cancel puts the charts back exactly. */
function itRecalculates(box: BoxType, edit: Edit, prepare: (project: OpenISDProject) => void = () => undefined): void {
  it('an ordinary edit moves a chart', () => {
    const project = PROJECTS[box]();
    prepare(project);
    const before = chartsOf(project);
    edit.apply(project);
    expect(changedSeries(before, chartsOf(project))).not.toEqual([]);
  });
  it('a What-if edit moves a chart and cancel puts every chart back', () => {
    const project = PROJECTS[box]();
    prepare(project);
    const before = chartsOf(project);
    project.beginWhatIf();
    edit.apply(project);
    expect(changedSeries(before, chartsOf(project))).not.toEqual([]);
    project.cancelWhatIf();
    expect(changedSeries(before, chartsOf(project))).toEqual([]);
  });
}

function itMovesNothing(box: BoxType, edit: Edit, prepare: (project: OpenISDProject) => void = () => undefined): void {
  it('an exempt input moves no chart', () => {
    const project = PROJECTS[box]();
    prepare(project);
    const before = chartsOf(project);
    edit.apply(project);
    expect(changedSeries(before, chartsOf(project))).toEqual([]);
  });
}

// ── 1. driver spec fields ────────────────────────────────────────────────────────────────────────

/** Driver spec fields that legitimately move no chart, each with its reason. */
const EXEMPT_DRIVER_FIELDS: ReadonlyMap<NumericDriverSpecFieldName, string> = new Map([
  ['Qts', 'Qts only fills a missing Qes or Qms or shows a conflict; it feeds no other calculation (John, 18 Oct 2026)'],
  ['BL_Tm', 'with "Two-BL driver" unticked (the default) there is one BL, the one Re, Fs, Qes and Vas imply; a typed BL is not read (John, 18 Oct 2026). Ticked, it moves the charts: see the compat switch cases'],
  ['Cms_m_per_N', 'display only: the circuit is driven from Fs, Vas, Qes, Qms (John, 18 Oct 2026)'],
  ['Mms_kg', 'display only: the circuit is driven from Fs, Vas, Qes, Qms (John, 18 Oct 2026)'],
  ['Rms_kg_per_s', 'display only: the circuit is driven from Fs, Vas, Qes, Qms (John, 18 Oct 2026)'],
  ['Znom_ohm', 'nominal impedance is a catalogue label; the circuit uses Re'],
  ['fLe_hz', 'a Le measurement frequency; Le itself is the input'],
  ['KLe_H_sqrtHz', 'lossy-inductance model constant the sweep does not read'],
  ['Xlim_m', 'mechanical limit, a datasheet figure; the charts use Xmax'],
  ['SPL_dB', 'datasheet sensitivity; the charts compute SPL from the circuit'],
  ['Dd_m', 'effective diameter; read only to size starting vent geometry'],
  ['EBP_hz', 'derived datasheet figure Fs/Qes'],
  ['Dia_m', 'frame diameter, a physical dimension'],
  ['Vd_m3', 'displacement volume, derived from Sd and Xmax'],
  ['no', 'reference efficiency, derived datasheet figure'],
  ['SPLmax_dB', 'datasheet maximum SPL'],
  ['SPLmaxLF_dB', 'datasheet maximum SPL'],
  ['USPL_dB', 'datasheet SPL'],
  ['alfaVC_per_K', 'driver datasheet coefficient; the project has its own alfaVC_per_K'],
  ['Rt_K_per_W', 'thermal model constant the sweep does not read'],
  ['Ct_J_per_K', 'thermal model constant the sweep does not read'],
  ['gamma_m_per_s2_A', 'catalogue figure'],
  ['Rme_kg_per_s', 'catalogue figure'],
  ['Mpow_N_per_sqrtW', 'catalogue figure'],
  ['Mcost_kg_per_s', 'catalogue figure'],
  ['Gloss', 'catalogue figure'],
  ['c_m_per_s', 'speed of sound the datasheet was measured in; the project has its own air'],
  ['roo_kg_per_m3', 'air density the datasheet was measured in; the project has its own air'],
  ['Vcd_m', 'voice coil dimension'],
  ['Hg_m', 'voice coil dimension'],
  ['Hc_m', 'voice coil dimension'],
  ['freq_low_hz', 'catalogue frequency range'],
  ['freq_high_hz', 'catalogue frequency range'],
  ['power_peak_W', 'catalogue figure'],
  ['weight_kg', 'physical weight'],
  ['Thick_m', 'physical dimension'],
  ['Depth_m', 'physical dimension'],
  ['MagDepth_m', 'physical dimension'],
  ['Magnet_m', 'physical dimension'],
  ['Basket_m', 'physical dimension'],
  ['Outer_m', 'physical dimension'],
  ['OuterX_m', 'physical dimension'],
  ['OuterY_m', 'physical dimension'],
  ['DVol_m3', 'physical dimension'],
]);

/** A meaningful change: half as much again, or a plain figure where nothing was entered. */
function changedValue(project: OpenISDProject, field: NumericDriverSpecFieldName): number {
  const now = project.driver.specField(field).value;
  return now === null ? (UNSET_FIELD_VALUES.get(field) ?? 0.01) : now * (CHANGE_FACTORS.get(field) ?? 1.5);
}

/** Fields where half as much again would not show on this fixture: the W5 sits power-limited
 *  (Pe 40 W) at Xmax 9.25 mm, so only a SMALLER Xmax moves the maximum-SPL curve. */
const CHANGE_FACTORS: ReadonlyMap<NumericDriverSpecFieldName, number> = new Map([['Xmax_m', 0.4]]);

/** What a driver field needs set first for the engine to read it at all. */
const DRIVER_FIELD_PREPARE: ReadonlyMap<NumericDriverSpecFieldName, (project: OpenISDProject) => void> = new Map([
  // WinISD's default circuit leaves the voice-coil inductance out ("Simulate voice coil inductance" off).
  ['Le_H', project => project.circuitModel.set('gyrator')],
]);

/** What a field with no entered value is set to when a plain 0.01 would be nonsense. */
const UNSET_FIELD_VALUES: ReadonlyMap<NumericDriverSpecFieldName, number> = new Map([['numVC', 2]]);

const driverEdit = (field: NumericDriverSpecFieldName): Edit => ({
  apply: project => project.driver.specField(field).set(changedValue(project, field)),
});

for (const box of BOX_TYPES) {
  describe.each(DRIVER_SPEC_FIELD_NAMES.filter((n): n is NumericDriverSpecFieldName => n !== 'VCCon'))
    (`${box}: driver field %s`, field => {
      const reason = EXEMPT_DRIVER_FIELDS.get(field);
      const prepare = DRIVER_FIELD_PREPARE.get(field);
      if (reason === undefined) itRecalculates(box, driverEdit(field), prepare);
      else itMovesNothing(box, driverEdit(field), prepare);
    });
}

// ── 2. project settings ──────────────────────────────────────────────────────────────────────────

/** Every key of the project that can be written. A new one fails to compile in `PROJECT_SETTINGS`
 *  until it is classified. */
type SettingKey = {
  [K in keyof OpenISDProject]: OpenISDProject[K] extends Writable<never> ? K
    : OpenISDProject[K] extends {set(v: never): void} ? K : never
}[keyof OpenISDProject];

type SettingCase =
  | {readonly kind: 'moves'; readonly box: BoxType; readonly apply: (p: OpenISDProject) => void; readonly prepare?: (p: OpenISDProject) => void}
  | {readonly kind: 'compat'}
  | {readonly kind: 'exempt'; readonly reason: string};

const moves = (apply: (p: OpenISDProject) => void, box: BoxType = 'vented', prepare?: (p: OpenISDProject) => void): SettingCase =>
  ({kind: 'moves', box, apply, prepare});
const exempt = (reason: string): SettingCase => ({kind: 'exempt', reason});
const compat: SettingCase = {kind: 'compat'};

const highpass: Filter = {id: 'hp', type: 'highpass', family: 'sos', order: 2, enabled: true, fc: 80, Q: 0.7071};

const PROJECT_SETTINGS: Readonly<Record<SettingKey, SettingCase>> = {
  nDrivers: moves(p => p.nDrivers.set(2)),
  wiring: moves(p => { p.nDrivers.set(2); p.wiring.set('series'); }, 'vented', p => { p.nDrivers.set(2); }),
  vcTempRise_K: moves(p => p.vcTempRise_K.set(60)),
  Rs_ohm: moves(p => p.Rs_ohm.set(1)),
  driverAddedMass_kg: moves(p => p.driverAddedMass_kg.set(0.02)),
  alfaVC_per_K: moves(p => p.alfaVC_per_K.set(0.008), 'vented', p => p.vcTempRise_K.set(60)),
  loading: moves(p => p.loading.set('isobaric')),
  portVelocityLimit_m_per_s: exempt('a limit line the chart draws; the sweep series do not read it'),
  name: exempt('project metadata'),
  creator: exempt('project metadata'),
  created: exempt('project metadata'),
  modified: exempt('project metadata'),
  description: exempt('project metadata'),
  filters: moves(p => p.filters.set([highpass])),
  forceFlatResponse: moves(p => p.forceFlatResponse.set(true)),
  useTransmissionLinePortModel: moves(p => p.useTransmissionLinePortModel.set(true)),
  rgAtDriverSide: moves(p => p.rgAtDriverSide.set(true), 'vented', p => { p.Rs_ohm.set(1); p.nDrivers.set(2); }),
  circuitModel: moves(p => p.circuitModel.set('gyrator')),
  splGraphIsXmaxLimited: exempt('chooses between two series the sweep already holds (spl, splXlimCurve); computes neither'),
  winisdDriverModel: compat,
  winisdVaModel: compat,
  winisdWrapPhase: compat,
  winisdDriverCountModel: compat,
  winisdSealedPicker: compat,
  winisdAbcIntraPortVelocity: compat,
  winisdPrNprResonance: compat,
  winisdBesselHighpass: compat,
  winisdAbcGroupDelay: compat,
  winisdTlPortNoEndCorrection: compat,
  winisdFlatModel: compat,
  graphs: exempt('which charts are open: view state'),
  cursorF: exempt('chart cursor: view state'),
  pinnedF: exempt('chart cursor: view state'),
  cursorLocked: exempt('chart cursor: view state'),
  dragRange: exempt('chart zoom: view state'),
  traceColor: exempt('chart colour: view state'),
  sweepN: moves(p => p.sweepN.set(25)),
  powerDrive_W: moves(p => p.powerDrive_W.set(25)),
  driveVoltage_V: moves(p => p.driveVoltage_V.set(5)),
  envTempK: moves(p => p.envTempK.set(310)),
  envHumidityPct: moves(p => p.envHumidityPct.set(90), 'vented', p => p.envHumidityPct.set(20)),
  envPressurePa: moves(p => p.envPressurePa.set(90000)),
  envC_m_per_s: moves(p => p.envC_m_per_s.set(360)),
  envRoo_kg_per_m3: moves(p => p.envRoo_kg_per_m3.set(1.0)),
};

describe('project settings', () => {
  const classified = Object.entries(PROJECT_SETTINGS);
  describe.each(classified.filter(([, c]) => c.kind !== 'compat'))('setting %s', (_name, setting) => {
    switch (setting.kind) {
      case 'moves': itRecalculates(setting.box, {apply: setting.apply}, setting.prepare); return;
      case 'exempt': itMovesNothing('vented', {apply: () => undefined}); return;
      case 'compat': return;
    }
  });
});

// ── 3. compat switches ───────────────────────────────────────────────────────────────────────────

interface CompatScenario {
  readonly box: BoxType;
  readonly prepare: (p: OpenISDProject) => void;
}

const COMPAT_SCENARIOS: ReadonlyMap<CompatSwitch, CompatScenario | string> = new Map<CompatSwitch, CompatScenario | string>([
  [CompatSwitch.DRIVER_MODEL, {box: 'sealed', prepare: p => p.driver.specField('Cms_m_per_N').set(0.0005)}],
  [CompatSwitch.VA_MODEL, {box: 'sealed', prepare: p => { p.Rs_ohm.set(1); p.powerDrive_W.set(25); }}],
  [CompatSwitch.PR_NPR_RESONANCE, {box: 'box-passive-radiator', prepare: p => p.box.passiveRadiator.count.set(2)}],
  [CompatSwitch.BESSEL_HIGHPASS, {box: 'sealed', prepare: p => p.filters.set([{...highpass, family: 'bessel'}])}],
  [CompatSwitch.ABC_GROUP_DELAY, {box: 'abc', prepare: () => undefined}],
  [CompatSwitch.DRIVER_COUNT, {box: 'sealed', prepare: p => p.nDrivers.set(2)}],
  [CompatSwitch.SEALED_PICKER, 'the sealed volume picker on the Box tab; no chart reads it'],
  [CompatSwitch.TL_PORT_END_CORRECTION, {box: 'vented', prepare: p => p.useTransmissionLinePortModel.set(true)}],
  [CompatSwitch.WRAP_PHASE, {box: 'sealed', prepare: () => undefined}],
  [CompatSwitch.FLAT_MODEL, {box: 'sealed', prepare: p => p.forceFlatResponse.set(true)}],
  [CompatSwitch.ABC_INTRA_PORT_VELOCITY, {box: 'abc', prepare: () => undefined}],
]);

describe('compat switches', () => {
  it('every switch has a scenario or an exemption', () => {
    expect(CompatSwitch.ALL.filter(s => !COMPAT_SCENARIOS.has(s)).map(s => s.field.label)).toEqual([]);
  });
  describe.each(CompatSwitch.ALL.map(s => [s.field.label, s] as const))('switch %s', (_title, sw) => {
    const scenario = COMPAT_SCENARIOS.get(sw);
    if (scenario === undefined) return;
    const flip: Edit = {apply: p => sw.of(p).set(!sw.of(p).value)};
    if (typeof scenario === 'string') itMovesNothing('sealed', flip);
    else itRecalculates(scenario.box, flip, scenario.prepare);
  });
});

// ── 4. box settings, per box type ────────────────────────────────────────────────────────────────

/** One box setting of the open box, found through the box's own typed accessors. */
interface BoxSetting {
  readonly name: string;
  readonly apply: (p: OpenISDProject) => void;
}

function scaled(field: {readonly value: number | null; set(v: number): void}, factor = 1.5, unset = 0.01): void {
  const now = field.value;
  field.set(now === null ? unset : now * factor);
}

function boxSettingsOf(type: BoxType): readonly BoxSetting[] {
  const settings: BoxSetting[] = [];
  settings.push({name: 'volume', apply: p => scaled(p.box.volumeOf(type))});
  if (PROJECTS[type]().box.frontVolumeOf(type) !== null) {
    settings.push({name: 'front volume', apply: p => { const f = p.box.frontVolumeOf(type); if (f !== null) scaled(f); }});
  }
  if (PROJECTS[type]().box.rearTuningOf(type) !== null) {
    settings.push({name: 'rear tuning', apply: p => { const t = p.box.rearTuningOf(type); if (t !== null) scaled(t); }});
  }
  const ports = PROJECTS[type]().box.ventPortsOf(type);
  ports.forEach((port, index) => {
    const of = (p: OpenISDProject) => p.box.ventPortsOf(type)[index];
    settings.push({name: `${port.name} port count`, apply: p => of(p).vent.count.set(2)});
    settings.push({name: `${port.name} port area`, apply: p => of(p).vent.area_m2.set((of(p).vent.area_m2.value ?? 0.002) * 1.5)});
    settings.push({name: `${port.name} port length`, apply: p => scaled(of(p).vent.length_m)});
    if (port.tuning_goal_hz !== null) settings.push({name: `${port.name} tuning`, apply: p => { const t = of(p).tuning_goal_hz; if (t !== null) scaled(t); }});
  });
  PROJECTS[type]().box.lossGroupsOf(type).forEach((group, index) => {
    const of = (p: OpenISDProject) => p.box.lossGroupsOf(type)[index];
    settings.push({name: `${group.chamber} Ql`, apply: p => scaled(of(p).Ql, 0.5)});
    settings.push({name: `${group.chamber} Qa`, apply: p => scaled(of(p).Qa, 0.5)});
    if (group.Qp !== null) settings.push({name: `${group.chamber} Qp`, apply: p => { const q = of(p).Qp; if (q !== null) scaled(q, 0.5); }});
    if (group.Qicl !== null) settings.push({name: `${group.chamber} Qicl`, apply: p => { const q = of(p).Qicl; if (q !== null) scaled(q, 0.5); }});
  });
  if (type === 'box-passive-radiator') {
    settings.push({name: 'PR count', apply: p => p.box.passiveRadiator.count.set(2)});
    settings.push({name: 'PR added mass', apply: p => p.box.passiveRadiator.addedMass_kg.set(0.02)});
    for (const name of RADIATOR_FIELDS_THAT_MOVE_CHARTS) {
      settings.push({name: `PR radiator ${name}`, apply: p => scaled(p.box.passiveRadiator.radiator.spec[name], 1.5, 5)});
    }
  }
  return settings;
}

/** The radiator's spec fields the passive-radiator chart reads. */
const RADIATOR_FIELDS_THAT_MOVE_CHARTS = ['Fs_hz', 'Qms', 'Sd_m2'] as const;

for (const type of BOX_TYPES) {
  describe.each(boxSettingsOf(type).map(s => [s.name, s] as const))(`${type}: box setting %s`, (_name, setting) => {
    itRecalculates(type, setting);
  });
}

// ── 5. What-if rows ──────────────────────────────────────────────────────────────────────────────

/** What-if rows that legitimately move no chart. */
const EXEMPT_WHATIF_ROWS: ReadonlyMap<SheetField, string> = new Map();

for (const type of BOX_TYPES) {
  const rows = SheetMode.WHAT_IF.lines(type).flat();
  describe.each(rows.map(row => [row.label, row] as const))(`${type}: What-if row %s`, (_label, row) => {
    const edit: Edit = {
      apply: p => {
        const now = readSheetSlot(p, type, row.slot);
        if (now === null) throw new Error(`What-if row ${row.label} has no value on this project`);
        writeSheetSlot(p, type, row.slot, row.slot === 'driverCount' ? 2 : now === 0 ? 0.01 : now * 1.5);
      },
    };
    const reason = EXEMPT_WHATIF_ROWS.get(row);
    if (reason === undefined) itRecalculates(type, edit);
    else itMovesNothing(type, edit);
  });
}

describe('the What-if driver rows', () => {
  it('are Fs, Vas, Qes and Qms in that order: no Qts row', () => {
    expect(SheetField.DRIVER_SPEC.map(row => row.field)).toEqual([
      NumberField.FS_HZ, NumberField.VAS_M3, NumberField.QES, NumberField.QMS,
    ]);
  });

  /** The four driver rows John ruled, written as the sheet will write them: through the driver's own field. */
  const TARGET_DRIVER_ROWS: readonly (readonly [string, NumericDriverSpecFieldName])[] = [
    ['Fs', 'Fs_hz'], ['Vas', 'Vas_m3'], ['Qes', 'Qes'], ['Qms', 'Qms'],
  ];
  for (const type of BOX_TYPES) {
    describe.each(TARGET_DRIVER_ROWS)(`${type}: What-if driver row %s`, (_label, spec) => {
      itRecalculates(type, driverEdit(spec));
    });
  }
});
