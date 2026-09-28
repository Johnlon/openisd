/**
 * `OpenISDProject` <-> WinISD `.wpr` — the project-level counterpart to
 * `driverYmlToOpenisdAndWdr.ts`'s `openIsdDriverToWinIsdDriver`/`winISDDriverToOpenISDDeviceJson`
 * pair. Free functions, not methods on `OpenISDProject` — `packages/design/AGENTS.md` "expose
 * only the class surface from domain/index.ts": these live beside `WinISDProject`, which does no
 * physics and no unit conversion of its own (its own doc comment), and take the already-computed
 * numbers from the domain.
 *
 * Scope: all six box types. `sealed`/`vented`/`bandpass4`/`box-passive-radiator` are verified
 * against the golden corpus under `packages/design/test/winisd/fixtures/winisd-parity/goldens/`.
 * `bandpass6` (`BType=3`) and `abc` (`BType=5`) are verified against two real WinISD-written
 * `.wpr` files each — a live debugger capture and a `docs/samples/` sample — in
 * `packages/design/test/winisd/bp6-abc-wpr.test.ts`; both chambers on both box types are vented
 * and independently tunable, so their `[Box]` keys are `Vr`/`Fr`/`Vf`/`Ff` plus a loss triple per
 * chamber, identical in layout to `bandpass4`'s pair with an added `Fr`/rear-port triple; `abc`
 * additionally carries a `[VentIntra]` section for the port connecting its two chambers.
 *
 * `phi` (`.wpr`'s `[Box]` humidity key) is WinISD's FRACTION, 0.0-1.0; `OpenISDProject`'s own
 * `envHumidityPct()`/`setEnvHumidityPct()` is a PERCENTAGE, 0-100 (confirmed at its own doc
 * comment and call sites in `project.ts`) — the ÷100/×100 conversion happens ONLY here, never
 * inside `WinISDProject` or `OpenISDProject` themselves.
 */
import type {Box} from './box/box.js';
import type {Vent} from './vent.js';
import {OpenISDDriver} from './driver/openISDDriver.js';
import {OpenISDPassiveRadiatorStandalone} from './passiveRadiator/openISDPassiveRadiatorStandalone.js';
import {OpenISDProject} from './project/openISDProject.js';
import type {EnvironmentField} from './project/environmentFields.js';
import {type DriverError, Engine, type Filter} from '../engine/index.js';

import {openIsdDriverToWinIsdDriver} from './driverYmlToOpenisdAndWdr.js';
import {WinISDDriver} from '../winisd/winisdDriver.js';
import {WinISDProject} from '../winisd/winisdProject.js';
import {type RadiatorDeviceJson, type SpecEntryJson} from './openisdSchema.js';
import {winISDDriverToOpenISDDeviceJson} from './winIsdDriverImport.js';
import {dateStamp} from './appContext.js';

/** `WinISDProject.build()`'s value shape: section name -> key -> value. */
type WprValues = Record<string, Record<string, string | number>>;

/**
 * `OpenISDProject` -> a `WinISDProject` ready to render as `.wpr` text.
 *
 * Never throws for bad input: a driver spec that will not convert (e.g. a value out of `.wdr`'s
 * range) comes back as warn/error entries in `errors`, `value` still populated where possible.
 */
export function openIsdProjectToWinIsdProject(
  project: OpenISDProject, engine: Engine,
): { value: WinISDProject | null; errors: DriverError[] } {
  const errors: DriverError[] = [];

  const driverErrors: DriverError[] = [];
  const wdrDriver = openIsdDriverToWinIsdDriver(project.driver, driverErrors);
  errors.push(...driverErrors);

  const box = project.box;
  const boxType = box.boxType.value;
  const boxValues = boxSectionValues(box, boxType);

  // No usable Re, no power: P is left out rather than invented.
  const power_W = project.powerDrive_W.value;
  if (power_W === null) {
    errors.push({level: 'warn', field: 'SignalSource P', message: 'P not written: the driver has no usable Re, so P = V²/Re cannot be stated'});
  }

  const nowStamp = dateStamp(new Date());

  const values: WprValues = {
    ProjectInfo: {
      Description: project.description.value,
      Creator: project.creator.value,
      CreateDate: project.created.value || nowStamp,
      ModifyDate: project.modified.value || nowStamp,
    },
    Box: {
      ...boxValues,
      T: project.envTempK.value,
      p: project.envPressurePa.value,
      phi: project.envHumidityPct.value / 100,
      // The coil's temperature coefficient and its modelled rise. Left out, the template writes
      // WinISD's own defaults over whatever the design states (BUG_20260817 F3).
      alfaVC: project.alfaVC_per_K.value,
      dTVC: project.vcTempRise_K.value,
    },
    SignalSource: {
      Rg: project.Rs_ohm.value,
      ...(power_W === null ? {} : {P: power_W}),
    },
  };

  const ventValues = ventSectionValues(box, boxType);
  for (const [section, kv] of Object.entries(ventValues)) values[section] = kv;

  if (boxType === 'box-passive-radiator') {
    const radiator = box.passiveRadiator.radiator;
    const prValues: Record<string, string | number> = {};
    const vas = radiator.spec.Vas_m3.value;
    const qms = radiator.spec.Qms.value;
    const fs = radiator.spec.Fs_hz.value;
    const sd = radiator.spec.Sd_m2.value;
    const xmax = radiator.spec.Xmax_m.value;
    if (vas != null) prValues.Vas = vas;
    if (qms != null) prValues.Qms = qms;
    if (fs != null) prValues.Fs = fs;
    if (sd != null) prValues.Sd = sd;
    if (xmax != null) prValues.Xmax = xmax;
    prValues.Me = box.passiveRadiator.addedMass_kg.value ?? 0;
    values.PassiveRadiator = prValues;
  }

  values.Filters = filtersSectionValues(project.filters.value, engine, errors);

  const wpr = WinISDProject.build(wdrDriver.toWdrIni(), values);
  return {value: wpr, errors};
}

/** `[Filters]` values: `Count`, plus `filter<i>type`/`filter<i>params` renumbered sequentially
 *  over the exportable filters — a low/high shelf has no WinISD type, so it is left out (with a
 *  warn) rather than gapping the numbering `WinISDProject`'s own load would then misread. */
function filtersSectionValues(
  filters: readonly Filter[], engine: Engine, errors: DriverError[],
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  let n = 0;
  for (const filter of filters) {
    const w = engine.filters.wpr(filter);
    if (w == null) {
      const label = filter.type === 'lowshelf' ? 'low shelf' : 'high shelf';
      errors.push({level: 'warn', field: 'Filters', message: `${label} not written: WinISD has no shelf filter`});
      continue;
    }
    out[`filter${n}type`] = w.type;
    out[`filter${n}params`] = w.params;
    n++;
  }
  out.Count = n;
  return out;
}

/**
 * `[Filters]` entries `0..Count-1` -> `Filter[]`. An entry whose `filter<i>type`/
 * `filter<i>params` keys are BOTH missing loads as WinISD's own default filter — measured
 * (`winisd_research/runs/filter-trunc-1`): WinISD's own save stops writing entries after an
 * Allpass, and on reload each missing entry becomes Lowpass/Butterworth/n=2/fc=50/Q=0.707,
 * enabled. A present-but-malformed params line, an unknown type number, or (low/highpass only)
 * a subtype above 3 is `Engine.filterFromWpr`'s own call (`filters.ts` "`.wpr` `[Filters]`
 * import/export dispatch").
 */
function importFilters(wpr: WinISDProject, engine: Engine, errors: DriverError[]): Filter[] {
  const count = wpr.number('Filters', 'Count') ?? 0;
  const filters: Filter[] = [];
  for (let i = 0; i < count; i++) {
    const typeRaw = wpr.value('Filters', `filter${i}type`);
    const paramsRaw = wpr.value('Filters', `filter${i}params`);
    if (typeRaw == null || paramsRaw == null) {
      errors.push({level: 'warn', field: 'Filters', message: `filter ${i} missing — WinISD loads it as its default lowpass`});
      filters.push(engine.filters.default('lowpass'));
      continue;
    }
    const {filter, warning} = engine.filters.fromWpr(Number(typeRaw), paramsRaw.split(';'));
    if (warning != null) errors.push({level: 'warn', field: 'Filters', message: `filter ${i}: ${warning}`});
    if (filter != null) filters.push(filter);
  }
  return filters;
}

/** `[Box]`'s own values, per box type — every `BoxType` is covered. */
function boxSectionValues(
  box: Box, boxType: Box['boxType']['value'],
): Record<string, string | number> {
  switch (boxType) {
    case 'sealed': {
      const v: Record<string, string | number> = {BType: 0, Vr: box.sealed.volume_m3.value};
      const fr = box.sealed.resonance_hz.value;
      if (fr != null) v.Fr = fr;
      v.Qlr = box.sealed.losses.Ql.value;
      v.Qar = box.sealed.losses.Qa.value;
      return v;
    }
    case 'vented': {
      const v: Record<string, string | number> = {
        BType: 1,
        Vr: box.vented.volume_m3.value,
        Fr: box.vented.tuning_goal_hz.value ?? 0,
      };
      v.Qlr = box.vented.losses.Ql.value;
      v.Qar = box.vented.losses.Qa.value;
      v.Qpr = box.vented.losses.Qp.value;
      const area = box.vented.vent.area_m2.value;
      if (area != null) v.Sdrport = area;
      return v;
    }
    case 'bandpass4': {
      const v: Record<string, string | number> = {
        BType: 2,
        Vr: box.bandpass4.chambers.rear.volume_m3.value,
        Vf: box.bandpass4.chambers.front.volume_m3.value,
        Ff: box.bandpass4.chambers.front.tuning_goal_hz.value ?? 0,
      };
      const frc = box.bandpass4.chambers.rear.resonance_hz.value;
      if (frc != null) v.Fr = frc;
      v.Qlr = box.bandpass4.chambers.rear.losses.Ql.value;
      v.Qar = box.bandpass4.chambers.rear.losses.Qa.value;
      v.Qiclfr = box.bandpass4.chambers.rear.losses.Qicl.value;
      v.Qlf = box.bandpass4.chambers.front.losses.Ql.value;
      v.Qaf = box.bandpass4.chambers.front.losses.Qa.value;
      v.Qpf = box.bandpass4.chambers.front.losses.Qp.value;
      const area = box.bandpass4.vents.front.area_m2.value;
      if (area != null) v.Sdfport = area;
      return v;
    }
    case 'box-passive-radiator': {
      const v: Record<string, string | number> = {
        BType: 4,
        Vr: box.passiveRadiator.volume_m3.value,
        Npr: box.passiveRadiator.count.value,
      };
      const fr = box.passiveRadiator.systemTuning_hz.value;
      if (fr != null) v.Fr = fr;
      v.Qlr = box.passiveRadiator.losses.Ql.value;
      v.Qar = box.passiveRadiator.losses.Qa.value;
      return v;
    }
    case 'bandpass6': {
      const v: Record<string, string | number> = {
        BType: 3,
        Vr: box.bandpass6.chambers.rear.volume_m3.value,
        Fr: box.bandpass6.chambers.rear.tuning_goal_hz.value ?? 0,
        Vf: box.bandpass6.chambers.front.volume_m3.value,
        Ff: box.bandpass6.chambers.front.tuning_goal_hz.value ?? 0,
      };
      v.Qlr = box.bandpass6.chambers.rear.losses.Ql.value;
      v.Qar = box.bandpass6.chambers.rear.losses.Qa.value;
      v.Qpr = box.bandpass6.chambers.rear.losses.Qp.value;
      v.Qiclfr = box.bandpass6.chambers.rear.losses.Qicl.value;
      v.Qlf = box.bandpass6.chambers.front.losses.Ql.value;
      v.Qaf = box.bandpass6.chambers.front.losses.Qa.value;
      v.Qpf = box.bandpass6.chambers.front.losses.Qp.value;
      const rearArea = box.bandpass6.vents.rear.area_m2.value;
      if (rearArea != null) v.Sdrport = rearArea;
      const frontArea = box.bandpass6.vents.front.area_m2.value;
      if (frontArea != null) v.Sdfport = frontArea;
      return v;
    }
    case 'abc': {
      const v: Record<string, string | number> = {
        BType: 5,
        Vr: box.abc.chambers.rear.volume_m3.value,
        Fr: box.abc.chambers.rear.tuning_goal_hz.value ?? 0,
        Vf: box.abc.chambers.front.volume_m3.value,
        Ff: box.abc.chambers.front.tuning_goal_hz.value ?? 0,
      };
      v.Qlr = box.abc.chambers.rear.losses.Ql.value;
      v.Qar = box.abc.chambers.rear.losses.Qa.value;
      v.Qpr = box.abc.chambers.rear.losses.Qp.value;
      v.Qiclfr = box.abc.chambers.rear.losses.Qicl.value;
      v.Qlf = box.abc.chambers.front.losses.Ql.value;
      v.Qaf = box.abc.chambers.front.losses.Qa.value;
      v.Qpf = box.abc.chambers.front.losses.Qp.value;
      const rearArea = box.abc.vents.rear.area_m2.value;
      if (rearArea != null) v.Sdrport = rearArea;
      const frontArea = box.abc.vents.front.area_m2.value;
      if (frontArea != null) v.Sdfport = frontArea;
      return v;
    }
  }
}

/** `[VentFront]`/`[VentRear]` values for box types that have a single port whose geometry this
 *  bridge can read directly. `crosscalc`'s meaning and `Shape`'s non-round codes are not
 *  documented anywhere in this repo (confirmed: no `docs/design/WINISD_SCHEMA.md`) — ⚠ UNVERIFIED
 *  beyond `Shape=1` (round), which every sampled golden uses; `WinISDProject.TEMPLATE`'s own
 *  defaults are left in place for everything this function does not explicitly state. */
function ventSectionValues(
  box: Box, boxType: Box['boxType']['value'],
): Record<string, Record<string, string | number>> {
  const out: Record<string, Record<string, string | number>> = {};
  const oneVent = (vent: Box['vented']['vent'], fb_hz: number | null): Record<string, string | number> => {
    const v: Record<string, string | number> = {};
    // A resolved project always states a port count — its resolve stores the default as a 'C'
    // entry — so null reaches here only from an unresolved one, and writes the same default.
    v.Num = vent.count.value;
    if (vent.shape.value === 'round') {
      v.Shape = 1; // ⚠ unverified: slotted's own code is not confirmed
      const diameter = vent.diameter_m.value;
      if (diameter != null) v.dia1 = diameter;
    }
    if (fb_hz != null) v.Fb = fb_hz;
    const area = vent.area_m2.value;
    if (area != null) v.carea = area;
    const length = vent.length_m.value;
    if (length != null) v.len = length;
    v.endcorrection = vent.endCorrection_m.value;
    return v;
  };

  if (boxType === 'vented') {
    out.VentRear = oneVent(box.vented.vent, box.vented.tuning_goal_hz.value);
  } else if (boxType === 'bandpass4') {
    out.VentFront = oneVent(box.bandpass4.vents.front, box.bandpass4.chambers.front.tuning_goal_hz.value);
  } else if (boxType === 'bandpass6') {
    out.VentRear = oneVent(box.bandpass6.vents.rear, box.bandpass6.chambers.rear.tuning_goal_hz.value);
    out.VentFront = oneVent(box.bandpass6.vents.front, box.bandpass6.chambers.front.tuning_goal_hz.value);
  } else if (boxType === 'abc') {
    out.VentRear = oneVent(box.abc.vents.rear, box.abc.chambers.rear.tuning_goal_hz.value);
    out.VentFront = oneVent(box.abc.vents.front, box.abc.chambers.front.tuning_goal_hz.value);
    // The connecting port between the two chambers, not tuned to either — no `fb_hz`.
    out.VentIntra = oneVent(box.abc.vents.intra, null);
  }
  return out;
}

/** One `[VentRear]`/`[VentFront]` block's `dia1`/`endcorrection` -> a `VentWindow`'s
 *  `diameter_m`/`endCorrection_m`. `endcorrection` is a coefficient (×D) in the file and in
 *  `endCorrection_m` alike, so it carries over unchanged whatever the shape. `dia1` only applies
 *  to a round vent (`Shape=1`) — WinISD's own non-round codes are not confirmed anywhere in this
 *  repo (`ventSectionValues`'s own doc comment), so any other stated `Shape` skips the diameter
 *  with a warn rather than guessing what its geometry keys mean. A missing or non-numeric key
 *  leaves the vent's own default in place (older files omit keys) — never an error. Called
 *  BEFORE `vent.count.set(Num)`: `diameter_m`'s write is what the vent's own length ends up
 *  computed from, so it must land first. */
/** The one message for a `BType` this importer does not read — absent, or a code WinISD writes
 *  that has no OpenISD topology yet. */
function unsupportedBType(bType: number | null | undefined): string {
  return `Unsupported or missing box type (BType=${String(bType)}): WinISD import supports sealed (0), vented (1), 4th-order bandpass (2), passive radiator (4), 6th-order bandpass (3) and ABC (5) boxes.`;
}

function importVentGeometry(
  wpr: WinISDProject, section: string, vent: Vent, errors: DriverError[],
): void {
  const shapeRaw = wpr.number(section, 'Shape');
  if (shapeRaw != null && shapeRaw !== 1) {
    errors.push({
      level: 'warn', field: `${section} Shape`,
      message: `vent shape ${shapeRaw} not imported: only round vents are read`,
    });
  } else {
    const dia1 = wpr.number(section, 'dia1');
    if (dia1 != null) vent.diameter_m.set(dia1);
  }
  const endcorrection = wpr.number(section, 'endcorrection');
  if (endcorrection != null) vent.endCorrection_m.set(endcorrection);
}

/**
 * WinISD `.wpr` text -> `OpenISDProject`.
 *
 * Never throws for bad input. Builds the driver from the embedded `[Driver]` block via the same
 * chain `wdr-to-openisd-record.test.ts` exercises (`WinISDDriver.fromWdrIni` ->
 * `winISDDriverToOpenISDDeviceJson` -> `conformingRecordToDriver`), then the box from `[Box]`
 * (and, for a passive-radiator box, `[PassiveRadiator]`).
 */
export function winIsdProjectToOpenIsdProject(
  text: string, engine: Engine,
): { value: OpenISDProject | null; errors: DriverError[] } {
  const errors: DriverError[] = [];
  const wpr = WinISDProject.fromWprIni(text);

  const wdrDriver = WinISDDriver.fromWdrIni(wpr.driverWdrText());
  const {record, warnings} = winISDDriverToOpenISDDeviceJson(wdrDriver);
  errors.push(...warnings);

  const driverOrErrors = OpenISDDriver.fromConformingRecord(record, engine);
  if (Array.isArray(driverOrErrors)) {
    for (const problem of driverOrErrors) errors.push({level: 'error', field: 'driver', message: problem});
    return {value: null, errors};
  }
  const driver: OpenISDDriver = driverOrErrors;

  const bTypeRaw = wpr.number('Box', 'BType');
  const builder = OpenISDProject.builder(driver, engine);
  let project: OpenISDProject;
  // `BType` arrives from a file, so it is `number | null` before this point and the switch below
  // cannot be exhaustive over it. Absence is rejected here; the switch then decides over a plain
  // number, where its `default` is the boundary's answer to a code WinISD writes and we do not
  // read yet.
  if (bTypeRaw == null) {
    errors.push({level: 'error', field: 'BType', message: unsupportedBType(bTypeRaw)});
    return {value: null, errors};
  }
  switch (bTypeRaw) {
    case 0: {
      const Vr = wpr.number('Box', 'Vr');
      if (Vr == null) {
        errors.push({level: 'error', field: 'Vr', message: 'sealed box: [Box] Vr is missing or not numeric'});
        return {value: null, errors};
      }
      project = builder.sealed().volume_m3(Vr).build();
      const Qlr = wpr.number('Box', 'Qlr');
      if (Qlr != null) project.box.sealed.losses.Ql.set(Qlr);
      const Qar = wpr.number('Box', 'Qar');
      if (Qar != null) project.box.sealed.losses.Qa.set(Qar);
      break;
    }
    case 1: {
      const Vr = wpr.number('Box', 'Vr');
      const Fr = wpr.number('Box', 'Fr');
      if (Vr == null || Fr == null) {
        errors.push({
          level: 'error', field: 'Vr/Fr',
          message: 'vented box: [Box] Vr and/or Fr is missing or not numeric',
        });
        return {value: null, errors};
      }
      project = builder.vented().volume_m3(Vr).tuning_goal_hz(Fr).build();
      const Qlr = wpr.number('Box', 'Qlr');
      if (Qlr != null) project.box.vented.losses.Ql.set(Qlr);
      const Qar = wpr.number('Box', 'Qar');
      if (Qar != null) project.box.vented.losses.Qa.set(Qar);
      const Qpr = wpr.number('Box', 'Qpr');
      if (Qpr != null) project.box.vented.losses.Qp.set(Qpr);
      // Diameter must land before the port count: the count write is what triggers the vent's
      // own length to be read next, and that has to see the real area, not the default one.
      importVentGeometry(wpr, 'VentRear', project.box.vented.vent, errors);
      const Num = wpr.number('VentRear', 'Num');
      if (Num != null) project.box.vented.vent.count.set(Num);
      break;
    }
    case 2: {
      const Vr = wpr.number('Box', 'Vr');
      const Vf = wpr.number('Box', 'Vf');
      const Ff = wpr.number('Box', 'Ff');
      if (Vr == null || Vf == null || Ff == null) {
        errors.push({
          level: 'error', field: 'Vr/Vf/Ff',
          message: 'bandpass4 box: [Box] Vr, Vf and/or Ff is missing or not numeric',
        });
        return {value: null, errors};
      }
      project = builder.bandpass4().rearVolume_m3(Vr).frontVolume_m3(Vf).frontTuning_hz(Ff).build();
      const rearLosses = project.box.bandpass4.chambers.rear.losses;
      const Qlr = wpr.number('Box', 'Qlr');
      if (Qlr != null) rearLosses.Ql.set(Qlr);
      const Qar = wpr.number('Box', 'Qar');
      if (Qar != null) rearLosses.Qa.set(Qar);
      const Qiclfr = wpr.number('Box', 'Qiclfr');
      if (Qiclfr != null) rearLosses.Qicl.set(Qiclfr);
      const frontLosses = project.box.bandpass4.chambers.front.losses;
      const Qlf = wpr.number('Box', 'Qlf');
      if (Qlf != null) frontLosses.Ql.set(Qlf);
      const Qaf = wpr.number('Box', 'Qaf');
      if (Qaf != null) frontLosses.Qa.set(Qaf);
      const Qpf = wpr.number('Box', 'Qpf');
      if (Qpf != null) frontLosses.Qp.set(Qpf);
      // Diameter must land before the port count — see the vented case's own comment.
      importVentGeometry(wpr, 'VentFront', project.box.bandpass4.vents.front, errors);
      const Num = wpr.number('VentFront', 'Num');
      if (Num != null) project.box.bandpass4.vents.front.count.set(Num);
      break;
    }
    case 4: {
      const Vr = wpr.number('Box', 'Vr');
      const Fr = wpr.number('Box', 'Fr');
      const Npr = wpr.number('Box', 'Npr') ?? 1;
      const vas = wpr.number('PassiveRadiator', 'Vas');
      const qms = wpr.number('PassiveRadiator', 'Qms');
      const fs = wpr.number('PassiveRadiator', 'Fs');
      const sd = wpr.number('PassiveRadiator', 'Sd');
      const xmax = wpr.number('PassiveRadiator', 'Xmax');
      if (Vr == null || Fr == null) {
        errors.push({
          level: 'error', field: 'Vr/Fr',
          message: 'passive-radiator box: [Box] Vr and/or Fr is missing or not numeric',
        });
        return {value: null, errors};
      }
      const manual = (v: number): SpecEntryJson => ({state: 'E', value: v, origin: 'manual', readings: {manual: {actual_reading: String(v), read_value: v}}});
      // The .wpr's [PassiveRadiator] section states only Vas/Qms/Fs/Sd/Xmax — never Cms/Mms/Rms
      // directly. `PassiveRadiatorSpecsSection`'s fields are entry-backed, never solver-derived
      // (openisdDomain.ts's own `prSpec()` doc comment), so unlike a driver's T/S set there is no
      // later consistency pass to fill them in: the circuit's `prMmd`/`prCms`/`prRms`
      // (engine/circuit.ts, box-passive-radiator) come from HERE or not at all. Same closed forms
      // `engine/formulas.ts` publishes for the PR editor: Cms = Vas/(ρc²Sd²), Mmd = 1/((2πFs)²Cms),
      // Rms = √(Mmd/Cms)/Qms.
      const cms = vas != null && sd != null ? engine.pr.cmsFromVas(vas, sd) : null;
      const mmd = cms != null && fs != null ? engine.pr.mmdFromFs(fs, cms) : null;
      const rms = mmd != null && cms != null && qms != null ? engine.pr.rmsFromQms(qms, mmd, cms) : null;
      const radiatorRecord: RadiatorDeviceJson = {
        brand: {value: 'WinISD import'}, model: {value: 'passive-radiator'},
        manufacturer: {value: 'WinISD import'}, driver_type: {value: 'passive-radiator'},
        uuid: {value: '00000000-0000-4000-8000-000000000002'},
        sku: {value: 'WPR-IMPORT', grounds: [{origin: 'manual', reading: 'WPR-IMPORT'}]},
        data_sources: {value: {}}, authoritative: {value: 'openisd'},
        quality: {
          confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
          parse_errors: [], cross_source_only: [],
        },
        specs: {
          'passive-radiator': {
            ...(vas != null ? {Vas_m3: manual(vas)} : {}),
            ...(qms != null ? {Qms: manual(qms)} : {}),
            ...(fs != null ? {Fs_hz: manual(fs)} : {}),
            ...(sd != null ? {Sd_m2: manual(sd)} : {}),
            ...(xmax != null ? {Xmax_m: manual(xmax)} : {}),
            ...(cms != null ? {Cms_m_per_N: manual(cms)} : {}),
            ...(mmd != null ? {Mms_kg: manual(mmd)} : {}),
            ...(rms != null ? {Rms_kg_per_s: manual(rms)} : {}),
          },
        },
      };
      const radiator = OpenISDPassiveRadiatorStandalone.wrap(radiatorRecord, engine);
      // The builder needs a starting tuning_goal_hz, but the .wpr's real stated input is the
      // radiator's OWN added mass ([PassiveRadiator] Me) — Box.Fr is its readout, computed by
      // WinISD from Me + the radiator's bare-cone Fs/Vas/Vb, and re-deriving Me from Fr through
      // the solved pair's `addedMass_kg` route risks a spurious `target-unreachable` at the exact
      // ceiling (float rounding can put the reconstructed mass a shade below zero even when the
      // true answer is exactly Me = 0). Entering `Me` directly — never negative, no boundary
      // check involved — lets `systemTuning_hz` recompute Fr as the OUTPUT it already is, self-
      // consistently, instead of fighting the pair the other way.
      project = builder.passiveRadiator().volume_m3(Vr).tuning_goal_hz(Fr).count(Npr).radiator(radiator).build();
      const me = wpr.number('PassiveRadiator', 'Me');
      if (me != null) project.box.passiveRadiator.addedMass_kg.set(me);
      const Qlr = wpr.number('Box', 'Qlr');
      if (Qlr != null) project.box.passiveRadiator.losses.Ql.set(Qlr);
      const Qar = wpr.number('Box', 'Qar');
      if (Qar != null) project.box.passiveRadiator.losses.Qa.set(Qar);
      break;
    }
    case 3: {
      const Vr = wpr.number('Box', 'Vr');
      const Fr = wpr.number('Box', 'Fr');
      const Vf = wpr.number('Box', 'Vf');
      const Ff = wpr.number('Box', 'Ff');
      if (Vr == null || Fr == null || Vf == null || Ff == null) {
        errors.push({
          level: 'error', field: 'Vr/Fr/Vf/Ff',
          message: 'bandpass6 box: [Box] Vr, Fr, Vf and/or Ff is missing or not numeric',
        });
        return {value: null, errors};
      }
      project = builder.bandpass6()
        .rearVolume_m3(Vr).rearTuning_hz(Fr).frontVolume_m3(Vf).frontTuning_hz(Ff).build();
      const rearLosses = project.box.bandpass6.chambers.rear.losses;
      const Qlr = wpr.number('Box', 'Qlr'); if (Qlr != null) rearLosses.Ql.set(Qlr);
      const Qar = wpr.number('Box', 'Qar'); if (Qar != null) rearLosses.Qa.set(Qar);
      const Qpr = wpr.number('Box', 'Qpr'); if (Qpr != null) rearLosses.Qp.set(Qpr);
      const Qiclfr = wpr.number('Box', 'Qiclfr'); if (Qiclfr != null) rearLosses.Qicl.set(Qiclfr);
      const frontLosses = project.box.bandpass6.chambers.front.losses;
      const Qlf = wpr.number('Box', 'Qlf'); if (Qlf != null) frontLosses.Ql.set(Qlf);
      const Qaf = wpr.number('Box', 'Qaf'); if (Qaf != null) frontLosses.Qa.set(Qaf);
      const Qpf = wpr.number('Box', 'Qpf'); if (Qpf != null) frontLosses.Qp.set(Qpf);
      // Diameter must land before the port count — see the vented case's own comment.
      importVentGeometry(wpr, 'VentRear', project.box.bandpass6.vents.rear, errors);
      const NumR = wpr.number('VentRear', 'Num'); if (NumR != null) project.box.bandpass6.vents.rear.count.set(NumR);
      importVentGeometry(wpr, 'VentFront', project.box.bandpass6.vents.front, errors);
      const NumF = wpr.number('VentFront', 'Num'); if (NumF != null) project.box.bandpass6.vents.front.count.set(NumF);
      break;
    }
    case 5: {
      const Vr = wpr.number('Box', 'Vr');
      const Fr = wpr.number('Box', 'Fr');
      const Vf = wpr.number('Box', 'Vf');
      const Ff = wpr.number('Box', 'Ff');
      if (Vr == null || Fr == null || Vf == null || Ff == null) {
        errors.push({
          level: 'error', field: 'Vr/Fr/Vf/Ff',
          message: 'ABC box: [Box] Vr, Fr, Vf and/or Ff is missing or not numeric',
        });
        return {value: null, errors};
      }
      project = builder.abc()
        .rearVolume_m3(Vr).rearTuning_hz(Fr).frontVolume_m3(Vf).frontTuning_hz(Ff).build();
      const rearLosses = project.box.abc.chambers.rear.losses;
      const Qlr = wpr.number('Box', 'Qlr'); if (Qlr != null) rearLosses.Ql.set(Qlr);
      const Qar = wpr.number('Box', 'Qar'); if (Qar != null) rearLosses.Qa.set(Qar);
      const Qpr = wpr.number('Box', 'Qpr'); if (Qpr != null) rearLosses.Qp.set(Qpr);
      const Qiclfr = wpr.number('Box', 'Qiclfr'); if (Qiclfr != null) rearLosses.Qicl.set(Qiclfr);
      const frontLosses = project.box.abc.chambers.front.losses;
      const Qlf = wpr.number('Box', 'Qlf'); if (Qlf != null) frontLosses.Ql.set(Qlf);
      const Qaf = wpr.number('Box', 'Qaf'); if (Qaf != null) frontLosses.Qa.set(Qaf);
      const Qpf = wpr.number('Box', 'Qpf'); if (Qpf != null) frontLosses.Qp.set(Qpf);
      // Diameter must land before the port count — see the vented case's own comment.
      importVentGeometry(wpr, 'VentRear', project.box.abc.vents.rear, errors);
      const NumR = wpr.number('VentRear', 'Num'); if (NumR != null) project.box.abc.vents.rear.count.set(NumR);
      importVentGeometry(wpr, 'VentFront', project.box.abc.vents.front, errors);
      const NumF = wpr.number('VentFront', 'Num'); if (NumF != null) project.box.abc.vents.front.count.set(NumF);
      importVentGeometry(wpr, 'VentIntra', project.box.abc.vents.intra, errors);
      const NumI = wpr.number('VentIntra', 'Num'); if (NumI != null) project.box.abc.vents.intra.count.set(NumI);
      // The intra port has no tuning target to derive a length from (`AbcBox.ts`'s own doc: "Mai
      // ... never from a tuning target, unlike the front/rear") — `len` is read directly here,
      // unlike `VentRear`/`VentFront`'s own length, which `#resolve()`'s active `solveVent` still
      // derives from tuning + volume + area for `vented`/`bandpass4` only (bandpass6/abc's rear/
      // front ports do not run that solve yet — their own circuit never reads `Leff`, so this is
      // display-only until that follow-up wiring lands, same as `RearPort`'s own chart-menu gap).
      const lenIntra = wpr.number('VentIntra', 'len');
      if (lenIntra != null) project.box.abc.vents.intra.length_m.set(lenIntra);
      break;
    }
    default: {
      errors.push({level: 'error', field: 'BType', message: unsupportedBType(bTypeRaw)});
      return {value: null, errors};
    }
  }

  const T = wpr.number('Box', 'T');
  const p = wpr.number('Box', 'p');
  const phi = wpr.number('Box', 'phi');
  // A file value equal to the project's current default (the app's Options → Environment C) was
  // most likely never typed; leave it unset so it stays C rather than becoming an E.
  const enterUnlessDefault = (field: EnvironmentField, value: number): void => {
    if (!(field.calculated && Math.abs(field.value - value) < 1e-9)) field.set(value);
  };
  if (T != null) enterUnlessDefault(project.envTempK, T);
  if (p != null) enterUnlessDefault(project.envPressurePa, p);
  if (phi != null) enterUnlessDefault(project.envHumidityPct, phi * 100); // phi is a FRACTION in the file

  const Rg = wpr.number('SignalSource', 'Rg');
  if (Rg != null) project.Rs_ohm.set(Rg);

  const P = wpr.number('SignalSource', 'P');
  // P can be stated only against a usable Re; without one the voltage stands alone.
  const Re_ohm = project.driver.specs.Re_ohm.value;
  if (P != null && Re_ohm !== null && Re_ohm > 0) {
    project.powerDrive_W.set(P);
  }
  const description = wpr.value('ProjectInfo', 'Description');
  const creator = wpr.value('ProjectInfo', 'Creator');
  const created = wpr.value('ProjectInfo', 'CreateDate');
  const modified = wpr.value('ProjectInfo', 'ModifyDate');
  if (description != null) project.description.set(description);
  if (creator != null) project.creator.set(creator);
  if (created != null) project.created.set(created);
  if (modified != null) project.modified.set(modified);

  project.filters.set(importFilters(wpr, engine, errors));

  return {value: project, errors};
}
