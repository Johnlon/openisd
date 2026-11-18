/**
 * The input-limits sweep (T915, bugs/BUG_20261118_input-limits-sweep.md): every number box a person
 * can type into, set to the edge values of its declared band and to the values a person can type by
 * mistake, on real WinISD projects; after each set the project is swept as the app sweeps it, and
 * every NaN, Infinity, thrown exception or slow answer is recorded. No judgement: a case is broken
 * exactly when the engine's output holds a non-finite number it did not hold before the edit, or a
 * call threw, or a call took longer than `SLOW_MS`.
 *
 * The boxes come from the field definitions (`NumberField`, fields/field.ts). Each is written
 * through the same domain cell the screen binds it to (the UIField/UIFixedField `cell`/`@update`
 * in OriginalShell.vue, the Mobile*Tab.vue files, DriverEditorModal.vue, PREditorDialog.vue and the
 * filter editors), so the sweep sees what the app sees. A box that feeds no engine call is listed
 * in `NOT_SWEPT` with the reason.
 *
 * Shared by the unit test (`domain/input-limits-sweep.test.ts`) and the report script
 * (`domain/input-limits-sweep-report.ts`).
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createEngine} from '../../engine/Engine.js';
import type {Engine, Filter, FilterType, PassFamily} from '../../engine/index.js';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import type {OpenISDProjectSessionJson} from '../../domain/openisdSchema.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {DRIVER_SPEC_FIELD_NAMES} from '../../domain/driver/driverSpecFieldName.js';
import type {NumericDriverSpecFieldName} from '../../domain/driver/driverSpecFieldName.js';
import {NumberField} from '../../fields/field.js';

const here = dirname(fileURLToPath(import.meta.url));
const WPR_DIR = join(here, '..', 'winisd', 'fixtures');

/** A call slower than this is recorded as slow: the app sweeps on every keystroke (32 ms budget,
 *  appState.ts `SWEEP_MS`), so a second is already a frozen screen. */
export const SLOW_MS = 2000;

/** The real starting projects: WinISD 0.7 `.wpr` files of the W5-1138SMF, one per box type. */
export const PROJECT_FILES = {
  sealed: 'sealed-w5-dtvc20.wpr',
  vented: 'vented-w5-2.wpr',
  'passive radiator': 'pr-w5-1.wpr',
  bandpass4: 'bp4-w5-1.wpr',
  bandpass6: 'bp6-w5-1.wpr',
  abc: 'abc-w5-1.wpr',
} as const;
export type ProjectName = keyof typeof PROJECT_FILES;

/** The four projects every box-independent input is swept on. */
const BASE_PROJECTS: readonly ProjectName[] = ['sealed', 'vented', 'passive radiator', 'bandpass4'];
const ALL_PROJECTS: readonly ProjectName[] = ['sealed', 'vented', 'passive radiator', 'bandpass4', 'bandpass6', 'abc'];

const engine: Engine = createEngine();
const imported = new Map<ProjectName, OpenISDProjectSessionJson>();

/** A starting project imported as File > Open imports a `.wpr`. */
export function importProject(name: ProjectName): OpenISDProject {
  const text = readFileSync(join(WPR_DIR, PROJECT_FILES[name]), 'utf8');
  const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (value === null) throw new Error(`${PROJECT_FILES[name]} did not import: ${JSON.stringify(errors)}`);
  return value;
}

/** A fresh copy of a starting project: the import done once, then its session copied, as a
 *  stored project is reopened (an import costs 50 ms, a copy a fraction of that). */
export function loadProject(name: ProjectName): OpenISDProject {
  let session = imported.get(name);
  if (session === undefined) {
    session = importProject(name).cloneSession();
    imported.set(name, session);
  }
  return OpenISDProject.wrapSession(structuredClone(session), engine);
}

/** The grid the app sweeps when nobody has zoomed: the default chart range. */
export const DEFAULT_GRID: FrequencyGrid = {fmin: NumberField.PLOT_RANGE_DEFAULT_HZ.min, fmax: NumberField.PLOT_RANGE_DEFAULT_HZ.max};

/** What an input writes: the project, and the chart range a range box moves. */
export interface Target {
  readonly project: OpenISDProject;
  grid: FrequencyGrid;
}

/** One number box. `set` writes a value; `clear` empties the box, where the screen allows empty. */
export interface Input {
  /** A stable name for the case list: the field and, where one field has several boxes, which. */
  readonly id: string;
  readonly field: NumberField;
  /** The box's label as the person sees it. */
  readonly label: string;
  /** Where the box is: the screen and panel. */
  readonly where: string;
  readonly projects: readonly ProjectName[];
  readonly set: (t: Target, v: number) => void;
  readonly clear: ((t: Target) => void) | null;
  /** The screen takes any finite number here (`allow-out-of-range`), not only the field's band. */
  readonly anyFinite: boolean;
}

/** Boxes left out of the sweep, each with why: it feeds no engine call, or it cannot be typed. */
export const NOT_SWEPT: ReadonlyMap<NumberField, string> = new Map([
  [NumberField.PLOT_Y_DB, 'chart axis limit: scales the drawing only, feeds no engine call'],
  [NumberField.PLOT_Y_DEG, 'chart axis limit: scales the drawing only, feeds no engine call'],
  [NumberField.PLOT_Y_MM, 'chart axis limit: scales the drawing only, feeds no engine call'],
  [NumberField.PLOT_Y_OHM, 'chart axis limit: scales the drawing only, feeds no engine call'],
  [NumberField.PLOT_Y_MS, 'chart axis limit: scales the drawing only, feeds no engine call'],
  [NumberField.PLOT_Y_W, 'chart axis limit: scales the drawing only, feeds no engine call'],
  [NumberField.PLOT_Y_MPS, 'chart axis limit: scales the drawing only, feeds no engine call'],
  [NumberField.SIGNAL_DISTANCE_M, 'shown greyed and disabled (OriginalShell.vue): cannot be typed'],
  [NumberField.SIGNAL_ANGLE_RAD, 'shown greyed and disabled (OriginalShell.vue): cannot be typed'],
  [NumberField.SIGNAL_GENHZ_HZ, 'drives the browser tone generator only (OriginalShell-hooks.ts toggleGenerate), no engine call'],
  [NumberField.VENT_1STPORTRESONANCE_HZ, 'readout only (readonly in OriginalShell.vue and MobileEnclosureTab.vue)'],
  [NumberField.PR_FSMASS_HZ, 'readout only (readonly in OriginalShell.vue and MobileEnclosureTab.vue)'],
  [NumberField.BOX_RESONANCE_HZ, 'no screen binds it'],
  [NumberField.BOX_REARRESONANCE_HZ, 'readout only (readonly in OriginalShell.vue)'],
  [NumberField.PHONE_FILTER_FC_HZ, 'the phone filter cards\' frequency box: the same band and the same engine edit call as FILTER_FC_HZ, which is swept'],
]);

// ── the inputs ──────────────────────────────────────────────────────────────────────────────────

function input(spec: Omit<Input, 'label' | 'anyFinite' | 'clear'> & {label?: string; anyFinite?: boolean; clear?: ((t: Target) => void) | null}): Input {
  return {
    ...spec,
    label: spec.label ?? spec.field.label,
    anyFinite: spec.anyFinite ?? false,
    clear: spec.clear ?? null,
  };
}

/** Every driver spec field that has a number box in the driver editor. */
function driverInputs(): Input[] {
  const names = DRIVER_SPEC_FIELD_NAMES.filter((n): n is NumericDriverSpecFieldName => n !== 'VCCon');
  return names.flatMap(name => {
    const field = NumberField.named(name);
    if (field === undefined) return [];
    return [input({
      id: `driver.${name}`, field, where: 'Driver editor (desktop and phone)', projects: BASE_PROJECTS,
      set: (t, v) => t.project.driver.specField(name).set(v),
      clear: t => t.project.driver.specField(name).clear(),
    })];
  });
}

function boxInputs(): Input[] {
  const out: Input[] = [];
  const boxTab = 'Box tab (desktop) / Box tab (phone)';
  out.push(input({
    id: 'box.volume', field: NumberField.BOX_VB_L, where: boxTab, projects: ALL_PROJECTS,
    set: (t, v) => t.project.box.volumeOf(t.project.box.boxType.value).set(v),
    clear: t => t.project.box.volumeOf(t.project.box.boxType.value).clear(),
  }));
  out.push(input({
    id: 'box.frontVolume', field: NumberField.BOX_VF_L, label: 'Volume (front chamber)', where: boxTab,
    projects: ['bandpass4', 'bandpass6', 'abc'],
    set: (t, v) => t.project.box.frontVolumeOf(t.project.box.boxType.value)?.set(v),
    clear: t => t.project.box.frontVolumeOf(t.project.box.boxType.value)?.clear(),
  }));
  out.push(input({
    id: 'box.Fb', field: NumberField.BOX_FB_HZ, where: boxTab, projects: ['vented'],
    set: (t, v) => t.project.box.ventGroupOf('vented').tuning_goal_hz.set(v),
    clear: t => t.project.box.ventGroupOf('vented').tuning_goal_hz.clear(),
  }));
  out.push(input({
    id: 'box.Ffc', field: NumberField.BOX_FFC_HZ, where: boxTab, projects: ['bandpass4', 'bandpass6', 'abc'],
    set: (t, v) => t.project.box.ventGroupOf(t.project.box.boxType.value).tuning_goal_hz.set(v),
    clear: t => t.project.box.ventGroupOf(t.project.box.boxType.value).tuning_goal_hz.clear(),
  }));
  out.push(input({
    id: 'box.Frc', field: NumberField.BOX_FRC_HZ, where: boxTab, projects: ['bandpass6', 'abc'],
    set: (t, v) => t.project.box.rearTuningOf(t.project.box.boxType.value)?.set(v),
    clear: t => t.project.box.rearTuningOf(t.project.box.boxType.value)?.clear(),
  }));
  out.push(input({
    id: 'box.Fsc', field: NumberField.BOX_FSC_HZ, where: 'Box tab (phone), sealed', projects: ['sealed'],
    set: (t, v) => t.project.box.sealed.resonance_hz.set(v),
    clear: t => t.project.box.sealed.resonance_hz.clear(),
  }));
  out.push(input({
    id: 'box.Qtc', field: NumberField.BOX_QTC_VALUE, where: 'Box tab (desktop and phone), sealed', projects: ['sealed'],
    set: (t, v) => t.project.box.sealed.q_tc.set(v),
    clear: t => t.project.box.sealed.q_tc.clear(),
  }));
  out.push(input({
    id: 'box.Fh', field: NumberField.BOX_FH_HZ, where: 'Box tab (desktop), passive radiator', projects: ['passive radiator'],
    set: (t, v) => t.project.box.passiveRadiator.tuning_goal_hz.set(v),
    clear: t => t.project.box.passiveRadiator.tuning_goal_hz.clear(),
  }));
  return out;
}

/** The vent boxes, for every port the box draws (Vent; Front; Rear and Front; Rear, Front, Intra). */
function ventInputs(): Input[] {
  const ported: readonly ProjectName[] = ['vented', 'bandpass4', 'bandpass6', 'abc'];
  const out: Input[] = [];
  const maxPorts = 3;
  for (let i = 0; i < maxPorts; i++) {
    const projects = ported.filter(p => loadProject(p).box.ventPortsOf(loadProject(p).box.boxType.value).length > i);
    const port = (t: Target) => {
      const ports = t.project.box.ventPortsOf(t.project.box.boxType.value);
      const found = ports[i];
      if (found === undefined) throw new Error(`no port ${i}`);
      return found.vent;
    };
    const where = `Vent panel, port ${i + 1} (desktop) / Enclosure tab (phone)`;
    out.push(input({id: `vent${i}.count`, field: NumberField.VENT_COUNT, where, projects,
      set: (t, v) => port(t).count.set(v), clear: t => port(t).count.clear()}));
    out.push(input({id: `vent${i}.diameter`, field: NumberField.VENT_D_CM, where, projects,
      set: (t, v) => { port(t).shape.set('round'); port(t).diameter_m.set(v); },
      clear: t => { port(t).shape.set('round'); port(t).diameter_m.clear(); }}));
    out.push(input({id: `vent${i}.width`, field: NumberField.VENT_W_CM, where, projects,
      set: (t, v) => { port(t).shape.set('slotted'); port(t).width_m.set(v); },
      clear: t => { port(t).shape.set('slotted'); port(t).width_m.clear(); }}));
    out.push(input({id: `vent${i}.height`, field: NumberField.VENT_H_CM, where, projects,
      set: (t, v) => { port(t).shape.set('slotted'); port(t).height_m.set(v); },
      clear: t => { port(t).shape.set('slotted'); port(t).height_m.clear(); }}));
    out.push(input({id: `vent${i}.length`, field: NumberField.VENT_L_CM, where, projects,
      set: (t, v) => port(t).length_m.set(v), clear: t => port(t).length_m.clear()}));
    out.push(input({id: `vent${i}.area`, field: NumberField.VENT_CROSSAREA_M2, where, projects,
      set: (t, v) => port(t).area_m2.set(v), clear: t => port(t).area_m2.clear()}));
  }
  out.push(input({id: 'vent.velocityLimit', field: NumberField.VENT_PORTVELOCITYLIMIT_M_PER_S, where: 'Vent panel (desktop) / Enclosure tab (phone)',
    projects: ported, set: (t, v) => t.project.portVelocityLimit_m_per_s.set(v)}));
  return out;
}

function lossInputs(): Input[] {
  const out: Input[] = [];
  const where = 'Box losses popup (desktop) / Enclosure tab (phone)';
  for (const chamber of [0, 1]) {
    const projects = ALL_PROJECTS.filter(p => loadProject(p).box.lossGroupsOf(loadProject(p).box.boxType.value).length > chamber);
    const group = (t: Target) => {
      const g = t.project.box.lossGroupsOf(t.project.box.boxType.value)[chamber];
      if (g === undefined) throw new Error(`no loss group ${chamber}`);
      return g;
    };
    const suffix = chamber === 0 ? 'first chamber' : 'second chamber';
    out.push(input({id: `loss${chamber}.Ql`, field: NumberField.LOSS_QL, label: `Leakage Ql (${suffix})`, where, projects,
      set: (t, v) => group(t).Ql.set(v), clear: t => group(t).Ql.clear()}));
    out.push(input({id: `loss${chamber}.Qa`, field: NumberField.LOSS_QA, label: `Absorption Qa (${suffix})`, where, projects,
      set: (t, v) => group(t).Qa.set(v), clear: t => group(t).Qa.clear()}));
    const withQp = projects.filter(p => loadProject(p).box.lossGroupsOf(loadProject(p).box.boxType.value)[chamber]?.Qp !== null);
    out.push(input({id: `loss${chamber}.Qp`, field: NumberField.LOSS_QP, label: `Port Qp (${suffix})`, where, projects: withQp,
      set: (t, v) => group(t).Qp?.set(v), clear: t => group(t).Qp?.clear()}));
  }
  out.push(input({id: 'loss.Qicl', field: NumberField.LOSS_QICL, where, projects: ['bandpass4', 'bandpass6', 'abc'],
    set: (t, v) => group0(t).Qicl?.set(v), clear: t => group0(t).Qicl?.clear()}));
  return out;
}

function group0(t: Target) {
  const g = t.project.box.lossGroupsOf(t.project.box.boxType.value)[0];
  if (g === undefined) throw new Error('no loss group');
  return g;
}

function radiatorInputs(): Input[] {
  const pr: readonly ProjectName[] = ['passive radiator'];
  const prBox = (t: Target) => t.project.box.passiveRadiator;
  const where = 'Passive radiator panel and editor (desktop) / Enclosure tab (phone)';
  return [
    input({id: 'pr.Sd', field: NumberField.PR_SD_CM2, where, projects: pr,
      set: (t, v) => prBox(t).radiator.spec.Sd_m2.set(v), clear: t => prBox(t).radiator.spec.Sd_m2.clear()}),
    input({id: 'pr.Xmax', field: NumberField.PR_XMAX_MM, where, projects: pr,
      set: (t, v) => prBox(t).radiator.spec.Xmax_m.set(v), clear: t => prBox(t).radiator.spec.Xmax_m.clear()}),
    input({id: 'pr.Vas', field: NumberField.PR_VAS_L, where, projects: pr,
      set: (t, v) => prBox(t).radiator.spec.Vas_m3.set(v), clear: t => prBox(t).radiator.spec.Vas_m3.clear()}),
    input({id: 'pr.Fs', field: NumberField.PR_FS_HZ, where, projects: pr,
      set: (t, v) => prBox(t).radiator.spec.Fs_hz.set(v), clear: t => prBox(t).radiator.spec.Fs_hz.clear()}),
    input({id: 'pr.Qms', field: NumberField.PR_QMS, where, projects: pr,
      set: (t, v) => prBox(t).radiator.spec.Qms.set(v), clear: t => prBox(t).radiator.spec.Qms.clear()}),
    input({id: 'pr.count', field: NumberField.PR_NUM, where, projects: pr,
      set: (t, v) => prBox(t).count.set(v), clear: t => prBox(t).count.clear()}),
    input({id: 'pr.addedMass', field: NumberField.PR_MADD_G, where, projects: pr,
      set: (t, v) => prBox(t).addedMass_kg.set(v), clear: t => prBox(t).addedMass_kg.clear()}),
    input({id: 'pr.Fp', field: NumberField.PR_FP_HZ, where, projects: pr,
      set: (t, v) => prBox(t).tuning_goal_hz.set(v), clear: t => prBox(t).tuning_goal_hz.clear()}),
  ];
}

function signalAndEnvironmentInputs(): Input[] {
  const signal = 'Signal tab (desktop and phone)';
  const advanced = 'Advanced tab, air (desktop and phone)';
  const drv = 'Driver panel (desktop) / Driver tab (phone)';
  return [
    input({id: 'signal.power', field: NumberField.SIGNAL_PIN_W, where: signal, projects: BASE_PROJECTS,
      set: (t, v) => t.project.powerDrive_W.set(v), clear: t => t.project.powerDrive_W.clear()}),
    input({id: 'signal.voltage', field: NumberField.SIGNAL_DRIVEV_V, where: signal, projects: BASE_PROJECTS,
      set: (t, v) => t.project.driveVoltage_V.set(v), clear: t => t.project.driveVoltage_V.clear()}),
    input({id: 'signal.Rs', field: NumberField.SIGNAL_RS_OHM, where: signal, projects: BASE_PROJECTS,
      set: (t, v) => t.project.Rs_ohm.set(v), clear: t => t.project.Rs_ohm.clear()}),
    input({id: 'env.temp', field: NumberField.ADV_TEMP_K, where: advanced, projects: BASE_PROJECTS, anyFinite: true,
      set: (t, v) => t.project.envTempK.set(v), clear: t => t.project.envTempK.clear()}),
    input({id: 'env.humidity', field: NumberField.ADV_HUMIDITY_PCT, where: advanced, projects: BASE_PROJECTS, anyFinite: true,
      set: (t, v) => t.project.envHumidityPct.set(v), clear: t => t.project.envHumidityPct.clear()}),
    input({id: 'env.pressure', field: NumberField.ADV_PRESSURE_KPA, where: advanced, projects: BASE_PROJECTS, anyFinite: true,
      set: (t, v) => t.project.envPressurePa.set(v), clear: t => t.project.envPressurePa.clear()}),
    input({id: 'env.c', field: NumberField.ADV_SOUNDVELOCITY_M_PER_S, where: advanced, projects: BASE_PROJECTS, anyFinite: true,
      set: (t, v) => t.project.envC_m_per_s.set(v), clear: t => t.project.envC_m_per_s.clear()}),
    input({id: 'env.rho', field: NumberField.ADV_AIRDENSITY_KG_PER_M3, where: advanced, projects: BASE_PROJECTS, anyFinite: true,
      set: (t, v) => t.project.envRoo_kg_per_m3.set(v), clear: t => t.project.envRoo_kg_per_m3.clear()}),
    input({id: 'project.nDrivers', field: NumberField.DRIVER_NDRIVERS, where: drv, projects: BASE_PROJECTS,
      set: (t, v) => t.project.nDrivers.set(v), clear: t => t.project.nDrivers.clear()}),
    input({id: 'project.vcTempRise', field: NumberField.DRIVER_VCTEMPRISE_K, where: 'Advanced tab (desktop)', projects: BASE_PROJECTS,
      set: (t, v) => t.project.vcTempRise_K.set(v)}),
    input({id: 'project.addedMass', field: NumberField.DRIVER_ADDEDMASS_G, where: drv, projects: BASE_PROJECTS,
      set: (t, v) => t.project.driverAddedMass_kg.set(v)}),
    input({id: 'chart.fmin', field: NumberField.PLOT_FMIN_HZ, where: 'Chart range (desktop and phone)', projects: BASE_PROJECTS,
      set: (t, v) => { t.grid = {...t.grid, fmin: v}; }}),
    input({id: 'chart.fmax', field: NumberField.PLOT_FMAX_HZ, where: 'Chart range (desktop and phone)', projects: BASE_PROJECTS,
      set: (t, v) => { t.grid = {...t.grid, fmax: v}; }}),
  ];
}

/** One filter on the chain, its one parameter written through the engine's own editor call, as
 *  the Filters tab writes it (OriginalFilters-hooks.ts `editPass`/...). */
function filterInput(id: string, field: NumberField, label: string, type: FilterType, edit: (f: Filter, v: number) => Filter, prepare: (f: Filter) => Filter): Input {
  return input({
    id: `filter.${id}`, field, label, where: 'Filters tab, filter editor (desktop) / Signal tab filter card (phone)',
    projects: ['sealed', 'vented'],
    set: (t, v) => {
      const start = prepare({...engine.filters.default(type), id: 'sweep', enabled: true});
      t.project.filters.set([edit(start, v)]);
    },
  });
}

function filterInputs(): Input[] {
  const fe = engine.filters;
  const out: Input[] = [];
  const families: readonly PassFamily[] = ['sos', 'butterworth', 'bessel', 'linkwitzRiley'];
  for (const type of ['highpass', 'lowpass'] as const) {
    for (const family of families) {
      const fam = (f: Filter): Filter => f.type === 'highpass' || f.type === 'lowpass' ? fe.editPass(f, {family}) : f;
      const name = `${family} ${type}`;
      out.push(filterInput(`${type}.${family}.fc`, NumberField.FILTER_FC_HZ, `Cutoff (${name})`, type,
        (f, v) => f.type === type ? fe.editPass(f, {fc: v}) : f, fam));
      out.push(filterInput(`${type}.${family}.Q`, NumberField.FILTER_Q, `Q (${name})`, type,
        (f, v) => f.type === type ? fe.editPass(f, {Q: v}) : f, fam));
      out.push(filterInput(`${type}.${family}.order`, NumberField.FILTER_ORDER, `Order (${name})`, type,
        (f, v) => f.type === type ? fe.editPass(f, {order: v}) : f, fam));
    }
  }
  const same = (f: Filter): Filter => f;
  out.push(filterInput('allpass.t', NumberField.FILTER_T_S, 't (Allpass)', 'allpass', (f, v) => f.type === 'allpass' ? fe.editAllpass(f, {t: v}) : f, same));
  out.push(filterInput('allpass.Q', NumberField.FILTER_Q, 'Q (Allpass)', 'allpass', (f, v) => f.type === 'allpass' ? fe.editAllpass(f, {Q: v}) : f, same));
  out.push(filterInput('allpass.order', NumberField.FILTER_ORDER, 'Order (Allpass)', 'allpass', (f, v) => f.type === 'allpass' ? fe.editAllpass(f, {order: v}) : f, same));
  out.push(filterInput('linkwitz.f0', NumberField.FILTER_FC_HZ, 'f0 (Linkwitz transform)', 'linkwitz', (f, v) => f.type === 'linkwitz' ? fe.editLinkwitz(f, {f0: v}) : f, same));
  out.push(filterInput('linkwitz.Q0', NumberField.FILTER_Q, 'Q0 (Linkwitz transform)', 'linkwitz', (f, v) => f.type === 'linkwitz' ? fe.editLinkwitz(f, {Q0: v}) : f, same));
  out.push(filterInput('linkwitz.fp', NumberField.FILTER_FC_HZ, 'fp (Linkwitz transform)', 'linkwitz', (f, v) => f.type === 'linkwitz' ? fe.editLinkwitz(f, {fp: v}) : f, same));
  out.push(filterInput('linkwitz.Qp', NumberField.FILTER_Q, 'Qp (Linkwitz transform)', 'linkwitz', (f, v) => f.type === 'linkwitz' ? fe.editLinkwitz(f, {Qp: v}) : f, same));
  out.push(filterInput('peaking.fc', NumberField.FILTER_FC_HZ, 'fc (Parametric EQ)', 'peaking', (f, v) => f.type === 'peaking' ? fe.editParametricEq(f, {fc: v}) : f, same));
  out.push(filterInput('peaking.Q', NumberField.FILTER_Q, 'Q (Parametric EQ)', 'peaking', (f, v) => f.type === 'peaking' ? fe.editParametricEq(f, {Q: v}) : f, same));
  out.push(filterInput('peaking.gain', NumberField.FILTER_GAIN_DB, 'Gain (Parametric EQ)', 'peaking', (f, v) => f.type === 'peaking' ? fe.editParametricEq(f, {gain: v}) : f, same));
  out.push(filterInput('peakHighpass.fpk', NumberField.FILTER_FC_HZ, 'fpk (Peaking 2nd order highpass)', 'peakHighpass', (f, v) => f.type === 'peakHighpass' ? fe.editPeakHighpass(f, {fpk: v}) : f, same));
  out.push(filterInput('peakHighpass.gainPk', NumberField.FILTER_GAIN_DB, 'Gpk (Peaking 2nd order highpass)', 'peakHighpass', (f, v) => f.type === 'peakHighpass' ? fe.editPeakHighpass(f, {gainPk: v}) : f, same));
  out.push(filterInput('staticGain.gain', NumberField.FILTER_GAIN_DB, 'Gain (Static gain)', 'staticGain', (f, v) => f.type === 'staticGain' ? fe.editStaticGain(f, {gain: v}) : f, same));
  out.push(filterInput('raisedCosine.fc', NumberField.FILTER_FC_HZ, 'fc (Raised cosine)', 'raisedCosine', (f, v) => f.type === 'raisedCosine' ? fe.editRaisedCosine(f, {fc: v}) : f, same));
  out.push(filterInput('raisedCosine.bw', NumberField.FILTER_BW_OCT, 'BW (Raised cosine)', 'raisedCosine', (f, v) => f.type === 'raisedCosine' ? fe.editRaisedCosine(f, {bwOct: v}) : f, same));
  out.push(filterInput('raisedCosine.gain', NumberField.FILTER_GAIN_DB, 'Gain (Raised cosine)', 'raisedCosine', (f, v) => f.type === 'raisedCosine' ? fe.editRaisedCosine(f, {gain: v}) : f, same));
  for (const type of ['lowshelf', 'highshelf'] as const) {
    out.push(filterInput(`${type}.fc`, NumberField.FILTER_FC_HZ, `fc (${type})`, type, (f, v) => f.type === type ? fe.editShelf(f, {fc: v}) : f, same));
    out.push(filterInput(`${type}.Q`, NumberField.FILTER_Q, `Q (${type})`, type, (f, v) => f.type === type ? fe.editShelf(f, {Q: v}) : f, same));
    out.push(filterInput(`${type}.gain`, NumberField.FILTER_GAIN_DB, `Gain (${type})`, type, (f, v) => f.type === type ? fe.editShelf(f, {gain: v}) : f, same));
  }
  return out;
}

/** Every swept box. */
export function sweptInputs(): readonly Input[] {
  return [...driverInputs(), ...boxInputs(), ...ventInputs(), ...lossInputs(), ...radiatorInputs(), ...signalAndEnvironmentInputs(), ...filterInputs()];
}

// ── the values ──────────────────────────────────────────────────────────────────────────────────

/** A value tried in a box: a number, or `null` for an emptied box. */
export interface Trial {
  readonly name: string;
  readonly value: number | null;
}

/** The trials for one box: its declared min and max, 0, -1, -100, 1e-9, 1e9, and empty where the
 *  box can be emptied. Duplicate values keep their first name. */
export function trialsFor(inp: Input): readonly Trial[] {
  const all: Trial[] = [
    {name: 'min', value: inp.field.limits.min},
    {name: 'max', value: inp.field.limits.max},
    {name: '0', value: 0},
    {name: '-1', value: -1},
    {name: '-100', value: -100},
    {name: '1e-9', value: 1e-9},
    {name: '1e9', value: 1e9},
  ];
  if (inp.clear !== null) all.push({name: 'empty', value: null});
  const seen = new Set<number | null>();
  return all.filter(t => {
    if (seen.has(t.value)) return false;
    seen.add(t.value);
    return true;
  });
}

/** Whether the screen would store the trial: inside the field's band and floor, as
 *  `entryRefusal` (packages/ui/src/logic/entryRefusal.ts) decides, or any finite number for a box
 *  bound `allow-out-of-range`. An empty box is stored where the screen offers a clear. */
export function screenAccepts(inp: Input, trial: Trial): boolean {
  const v = trial.value;
  if (v === null) return inp.clear !== null;
  if (inp.anyFinite) return Number.isFinite(v);
  const {min, max} = inp.field.limits;
  const floor = inp.field.floor;
  const tooLow = floor === 'positive' && min <= 0 ? v <= 0 : v < (floor === 'non-negative' ? Math.max(0, min) : min);
  return !tooLow && v <= max;
}

// ── running a case ──────────────────────────────────────────────────────────────────────────────

export type Symptom = 'NaN' | 'Infinity' | 'throw' | 'slow';

/** What one engine call gave. */
export interface Finding {
  readonly symptom: Symptom;
  /** The project call that produced it: `set`, `sweep`, `maxCurves`, `peaks`, `impedancePeak`. */
  readonly call: string;
  /** The output series holding the bad value, or the thrown message. */
  readonly where: string;
}

export interface CaseResult {
  readonly findings: readonly Finding[];
  /** The sweep refused with a message (a handled state, not a breakage). */
  readonly refused: boolean;
  /** The app's own finiteness check (`classifyFiniteIssues`/`classifyMaxFinite`) said so on screen. */
  readonly appSaysSo: boolean;
}

/** Every path in `value` holding a non-finite number, as `series` names. */
function nonFinitePaths(value: unknown, path: string, out: Map<string, Symptom>): void {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) out.set(path, 'NaN');
    else if (!Number.isFinite(value) && !out.has(path)) out.set(path, 'Infinity');
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) nonFinitePaths(item, path, out);
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) nonFinitePaths(v, path === '' ? k : `${path}.${k}`, out);
  }
}

function timed<T>(call: string, findings: Finding[], fn: () => T): T | undefined {
  const start = performance.now();
  try {
    return fn();
  } catch (e) {
    findings.push({symptom: 'throw', call, where: e instanceof Error ? e.message : String(e)});
    return undefined;
  } finally {
    const ms = performance.now() - start;
    if (ms > SLOW_MS) findings.push({symptom: 'slow', call, where: `${Math.round(ms)} ms`});
  }
}

/** The non-finite output paths of a project as it stands: sweep, max curves, peaks, impedance peak. */
function outputs(t: Target, findings: Finding[]): {bad: Map<string, Symptom>; refused: boolean; appSaysSo: boolean} {
  const bad = new Map<string, Symptom>();
  const p = t.project;
  const sw = timed('sweep', findings, () => p.sweep(t.grid));
  const mx = timed('maxCurves', findings, () => p.maxCurves(t.grid));
  let refused = false;
  let appSaysSo = false;
  if (sw !== undefined) {
    if (sw.values === null) refused = true;
    else {
      nonFinitePaths(sw.values, 'sweep', bad);
      const values = sw.values;
      const peaks = timed('peaks', findings, () => p.peaks(values));
      nonFinitePaths(peaks, 'peaks', bad);
      const imp = timed('impedancePeak', findings, () => p.impedancePeak(values));
      nonFinitePaths(imp, 'impedancePeak', bad);
      const said = timed('classifyFiniteIssues', findings, () => p.classifyFiniteIssues(values));
      if (said !== undefined && said.length > 0) appSaysSo = true;
    }
  }
  if (mx !== undefined && mx.values !== null) {
    nonFinitePaths(mx.values, 'maxCurves', bad);
    const values = mx.values;
    const said = timed('classifyMaxFinite', findings, () => p.classifyMaxFinite(values));
    if (said !== undefined && said !== null) appSaysSo = true;
  }
  return {bad, refused, appSaysSo};
}

const baselines = new Map<ProjectName, ReadonlyMap<string, Symptom>>();

/** The non-finite paths a project already has before any edit: not caused by the edit. */
export function baselineOf(name: ProjectName): ReadonlyMap<string, Symptom> {
  let b = baselines.get(name);
  if (b === undefined) {
    const findings: Finding[] = [];
    b = outputs({project: loadProject(name), grid: DEFAULT_GRID}, findings).bad;
    if (findings.length > 0) throw new Error(`${name} breaks before any edit: ${JSON.stringify(findings)}`);
    baselines.set(name, b);
  }
  return b;
}

/** Sets one box to one trial on a fresh copy of one project and records what broke. */
export function runCase(inp: Input, trial: Trial, project: ProjectName): CaseResult {
  const baseline = baselineOf(project);
  const t: Target = {project: loadProject(project), grid: DEFAULT_GRID};
  const findings: Finding[] = [];
  const v = trial.value;
  timed('set', findings, () => { if (v === null) inp.clear?.(t); else inp.set(t, v); });
  const {bad, refused, appSaysSo} = outputs(t, findings);
  for (const [path, symptom] of bad) {
    if (!baseline.has(path)) findings.push({symptom, call: path.split('.')[0] ?? path, where: path});
  }
  return {findings, refused, appSaysSo};
}

/** What breaks in a project as it stands, with no baseline taken off: every non-finite output,
 *  throw or slow call of sweep, max curves, peaks and impedance peak. For the crash replays. */
export function projectFindings(project: OpenISDProject, grid: FrequencyGrid): CaseResult {
  const findings: Finding[] = [];
  const {bad, refused, appSaysSo} = outputs({project, grid}, findings);
  for (const [path, symptom] of bad) findings.push({symptom, call: path.split('.')[0] ?? path, where: path});
  return {findings, refused, appSaysSo};
}

/** One row of the case list. */
export interface SweepCase {
  readonly key: string;
  readonly input: Input;
  readonly trial: Trial;
  readonly project: ProjectName;
}

/** Every (box, value, project) the sweep tries, keyed `input id | trial | project`. */
export function allCases(): readonly SweepCase[] {
  return sweptInputs().flatMap(inp => trialsFor(inp).flatMap(trial =>
    inp.projects.map(project => ({key: `${inp.id} | ${trial.name} | ${project}`, input: inp, trial, project}))));
}
