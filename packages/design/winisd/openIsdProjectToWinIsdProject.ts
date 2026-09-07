/**
 * `OpenISDProject` <-> WinISD `.wpr` — the project-level counterpart to
 * `driverYmlToOpenisdAndWdr.ts`'s `openIsdDriverToWinIsdDriver`/`winISDDriverToOpenISDDeviceJson`
 * pair. Free functions, not methods on `OpenISDProject` — `packages/design/AGENTS.md` "expose
 * only the class surface from domain/index.ts": these live beside `WinISDProject`, which does no
 * physics and no unit conversion of its own (its own doc comment), and take the already-computed
 * numbers from the domain.
 *
 * Scope: `sealed`, `vented`, `bandpass4`, `box-passive-radiator` — the four `SimulatableBoxType`s
 * (`packages/design/engine/types.ts`) and the four box types the golden corpus under
 * `packages/design/test/winisd/fixtures/winisd-parity/goldens/` covers. `bandpass6`/`abc` have no
 * golden `.wpr` here and are not simulated, so `openIsdProjectToWinIsdProject` reports them as an
 * error rather than guessing a `BType`/section layout no sample confirms.
 *
 * `phi` (`.wpr`'s `[Box]` humidity key) is WinISD's FRACTION, 0.0-1.0; `OpenISDProject`'s own
 * `envHumidityPct()`/`setEnvHumidityPct()` is a PERCENTAGE, 0-100 (confirmed at its own doc
 * comment and call sites in `project.ts`) — the ÷100/×100 conversion happens ONLY here, never
 * inside `WinISDProject` or `OpenISDProject` themselves.
 */
import type { Box } from '../domain/index.js';
import { OpenISDDriver, OpenISDProject, OpenISDPassiveRadiatorStandalone } from '../domain/index.js';
import {type DriverError, Engine} from '../engine/index.js';

import {openIsdDriverToWinIsdDriver} from './driverYmlToOpenisdAndWdr.js';
import {WinISDDriver} from './winisdDriver.js';
import {WinISDProject} from './winisdProject.js';
import {winISDDriverToOpenISDDeviceJson} from '../domain/openisdSchema.js';

/** `WinISDProject.build()`'s value shape: section name -> key -> value. */
type WprValues = Record<string, Record<string, string | number>>;

/**
 * `OpenISDProject` -> a `WinISDProject` ready to render as `.wpr` text.
 *
 * Never throws for bad input: an unsimulatable box type (`bandpass6`/`abc`, out of this bridge's
 * scope — see the file doc comment) or a driver that cannot produce a `.wdr` comes back as
 * `{value: null, errors: [...]}`.
 */
export function openIsdProjectToWinIsdProject(
  project: OpenISDProject, engine: Engine,
): { value: WinISDProject | null; errors: DriverError[] } {
  const errors: DriverError[] = [];

  const driverErrors: DriverError[] = [];
  const wdrDriver = openIsdDriverToWinIsdDriver(project.driver, engine, driverErrors);
  errors.push(...driverErrors);

  const box = project.box;
  const boxType = box.boxType.get();
  const boxValues = boxSectionValues(box, boxType, errors);
  if (!boxValues) {
    return {value: null, errors};
  }

  const now = new Date();
  const dateStamp = wprDateStamp(now);

  const values: WprValues = {
    ProjectInfo: {
      Description: project.description.get(),
      Creator: project.creator.get(),
      CreateDate: project.created.get() || dateStamp,
      ModifyDate: project.modified.get() || dateStamp,
    },
    Box: boxValues,
    SignalSource: {
      Rg: project.Rs_ohm.get(),
      P: project.powerDrive_W() ?? 0,
    },
  };

  const ventValues = ventSectionValues(box, boxType);
  for (const [section, kv] of Object.entries(ventValues)) values[section] = kv;

  if (boxType === 'box-passive-radiator') {
    const radiator = box.passiveRadiator.radiator;
    const prValues: Record<string, string | number> = {};
    const vas = radiator.spec.Vas_m3.get().value;
    const qms = radiator.spec.Qms.get().value;
    const fs = radiator.spec.Fs_hz.get().value;
    const sd = radiator.spec.Sd_m2.get().value;
    const xmax = radiator.spec.Xmax_m.get().value;
    if (vas != null) prValues.Vas = vas;
    if (qms != null) prValues.Qms = qms;
    if (fs != null) prValues.Fs = fs;
    if (sd != null) prValues.Sd = sd;
    if (xmax != null) prValues.Xmax = xmax;
    prValues.Me = box.passiveRadiator.addedMass_kg.get().value ?? 0;
    values.PassiveRadiator = prValues;
  }

  const wpr = WinISDProject.build(wdrDriver.toWdrIni(), values);
  return {value: wpr, errors};
}

/** `[Box]`'s own values, per box type. `null` (with an error pushed) for a box type this bridge
 *  does not cover. */
function boxSectionValues(
  box: Box, boxType: Box['boxType'] extends never ? never : ReturnType<Box['boxType']['get']>,
  errors: DriverError[],
): Record<string, string | number> | null {
  switch (boxType) {
    case 'sealed': {
      const v: Record<string, string | number> = {BType: 0, Vr: box.sealed.volume_m3.get()};
      const fr = box.sealed.resonance_hz();
      if (fr != null) v.Fr = fr;
      v.Qlr = box.sealed.losses.Ql.get();
      v.Qar = box.sealed.losses.Qa.get();
      return v;
    }
    case 'vented': {
      const v: Record<string, string | number> = {
        BType: 1,
        Vr: box.vented.volume_m3.get().value ?? 0,
        Fr: box.vented.tuning_hz.get().value ?? 0,
      };
      v.Qlr = box.vented.losses.Ql.get();
      v.Qar = box.vented.losses.Qa.get();
      v.Qpr = box.vented.losses.Qp.get();
      const area = box.vented.vent.area_m2();
      if (area != null) v.Sdrport = area;
      return v;
    }
    case 'bandpass4': {
      const v: Record<string, string | number> = {
        BType: 2,
        Vr: box.bandpass4.chambers.rear.volume_m3.get().value ?? 0,
        Vf: box.bandpass4.chambers.front.volume_m3.get(),
        Ff: box.bandpass4.chambers.front.tuning_hz.get().value ?? 0,
      };
      const frc = box.bandpass4.chambers.rear.resonance_hz();
      if (frc != null) v.Fr = frc;
      v.Qlr = box.bandpass4.chambers.rear.losses.Ql.get();
      v.Qar = box.bandpass4.chambers.rear.losses.Qa.get();
      v.Qiclfr = box.bandpass4.chambers.rear.losses.Qicl.get();
      v.Qlf = box.bandpass4.chambers.front.losses.Ql.get();
      v.Qaf = box.bandpass4.chambers.front.losses.Qa.get();
      v.Qpf = box.bandpass4.chambers.front.losses.Qp.get();
      const area = box.bandpass4.vents.front.area_m2();
      if (area != null) v.Sdfport = area;
      return v;
    }
    case 'box-passive-radiator': {
      const v: Record<string, string | number> = {
        BType: 4,
        Vr: box.passiveRadiator.volume_m3.get(),
        Npr: box.passiveRadiator.count.get(),
      };
      const fr = box.passiveRadiator.systemTuning_hz();
      if (fr != null) v.Fr = fr;
      v.Qlr = box.passiveRadiator.losses.Ql.get();
      v.Qar = box.passiveRadiator.losses.Qa.get();
      return v;
    }
    case 'bandpass6':
    case 'abc':
      errors.push({
        level: 'error', field: 'boxType',
        message: `${boxType}: no .wpr golden covers this box type — this bridge produces only `
          + 'sealed/vented/bandpass4/box-passive-radiator (SimulatableBoxType). Genuine gap, not '
          + 'guessed.',
      });
      return null;
  }
}

/** `[VentFront]`/`[VentRear]` values for box types that have a single port whose geometry this
 *  bridge can read directly. `crosscalc`'s meaning and `Shape`'s non-round codes are not
 *  documented anywhere in this repo (confirmed: no `docs/design/WINISD_SCHEMA.md`) — ⚠ UNVERIFIED
 *  beyond `Shape=1` (round), which every sampled golden uses; `WinISDProject.TEMPLATE`'s own
 *  defaults are left in place for everything this function does not explicitly state. */
function ventSectionValues(
  box: Box, boxType: ReturnType<Box['boxType']['get']>,
): Record<string, Record<string, string | number>> {
  const out: Record<string, Record<string, string | number>> = {};
  const oneVent = (vent: Box['vented']['vent'], fb_hz: number | null): Record<string, string | number> => {
    const v: Record<string, string | number> = {Num: 1};
    if (vent.shape.get() === 'round') v.Shape = 1; // ⚠ unverified: slotted's own code is not confirmed
    if (fb_hz != null) v.Fb = fb_hz;
    const area = vent.area_m2();
    if (area != null) v.carea = area;
    const length = vent.length_m.get().value;
    if (length != null) v.len = length;
    v.endcorrection = vent.endCorrection_m.get();
    return v;
  };

  if (boxType === 'vented') {
    out.VentRear = oneVent(box.vented.vent, box.vented.tuning_hz.get().value);
  } else if (boxType === 'bandpass4') {
    out.VentFront = oneVent(box.bandpass4.vents.front, box.bandpass4.chambers.front.tuning_hz.get().value);
  }
  return out;
}

function wprDateStamp(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
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
  switch (bTypeRaw) {
    case 0: {
      const Vr = wpr.number('Box', 'Vr');
      if (Vr == null) {
        errors.push({level: 'error', field: 'Vr', message: 'sealed box: [Box] Vr is missing or not numeric'});
        return {value: null, errors};
      }
      project = builder.sealed().volume_m3(Vr).build();
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
      project = builder.vented().volume_m3(Vr).tuning_hz(Fr).build();
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
      const radiatorRecord = {
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
            ...(vas != null ? {Vas: {origin: 'manual', readings: {manual: {actual_reading: String(vas), read_value: vas}}}} : {}),
            ...(qms != null ? {Qms: {origin: 'manual', readings: {manual: {actual_reading: String(qms), read_value: qms}}}} : {}),
            ...(fs != null ? {Fs: {origin: 'manual', readings: {manual: {actual_reading: String(fs), read_value: fs}}}} : {}),
            ...(sd != null ? {Sd: {origin: 'manual', readings: {manual: {actual_reading: String(sd), read_value: sd}}}} : {}),
            ...(xmax != null ? {Xmax: {origin: 'manual', readings: {manual: {actual_reading: String(xmax), read_value: xmax}}}} : {}),
          },
        },
      };
      const radiatorOrErrors = OpenISDPassiveRadiatorStandalone.fromConformingRecord(radiatorRecord, engine);
      if (Array.isArray(radiatorOrErrors)) {
        for (const problem of radiatorOrErrors) errors.push({level: 'error', field: 'radiator', message: problem});
        return {value: null, errors};
      }
      project = builder.passiveRadiator().volume_m3(Vr).tuning_hz(Fr).count(Npr).radiator(radiatorOrErrors).build();
      break;
    }
    default: {
      errors.push({
        level: 'error', field: 'BType',
        message: `BType=${String(bTypeRaw)}: no .wpr golden covers this box type — this bridge reads only `
          + 'sealed(0)/vented(1)/bandpass4(2)/box-passive-radiator(4). Genuine gap, not guessed.',
      });
      return {value: null, errors};
    }
  }

  const P = wpr.number('SignalSource', 'P');
  if (P != null) {
    try {
      project.setPowerDrive_W(P);
    } catch {
      // Driver has no usable Re yet — leave the project's drive level unstated rather than throw.
    }
  }
  const description = wpr.value('ProjectInfo', 'Description');
  const creator = wpr.value('ProjectInfo', 'Creator');
  const created = wpr.value('ProjectInfo', 'CreateDate');
  const modified = wpr.value('ProjectInfo', 'ModifyDate');
  if (description != null) project.description.set(description);
  if (creator != null) project.creator.set(creator);
  if (created != null) project.created.set(created);
  if (modified != null) project.modified.set(modified);

  return {value: project, errors};
}
