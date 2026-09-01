/**
 * `driver.yml` text → `{ openisd, wdr, errors }` — the ONE entry `winisd_tools` calls in-process
 * (embedded V8, through `bridge.ts`) to generate BOTH derived files for one corpus record.
 *
 * The design is `drivers/drivers.md` Part C. It lives in `packages/design/winisd` rather than
 * `packages/design` by John's QO103 ruling ("opt 1", 2026-08-31): the `.wdr` transformer
 * (`WinISDDriver`) is here, `packages/design` declares no dependencies, and a design-side entry
 * would have to import `@openisd/design/winisd` — closing a design → winisd → design cycle.
 *
 * `openisd.yml` is `driver.yml` minus `scraper_meta`. The KEY ORDER is `driver.yml`'s own, so
 * regenerating the corpus produces a stable diff (John, 2026-08-31: "in order that we have
 * deterministic consistent ordering please follow the same ordering seen in driver.yml").
 *
 * Every value crossing into the `.wdr` is already SI, in both directions — the record stores
 * `Vas` in m³ and `Sd` in m², and a WinISD-written `.wdr` holds the same
 * (`drivers/sample/winisd/John-all-manu-populated.wdr`: `Vas=0.141584099539285`,
 * `Sd=0.00177545544983551`). So this file converts no units, and a unit conversion appearing here
 * later would be a bug, not a missing feature.
 */
import { parse, stringify } from 'yaml';

import { driverFromConformingRecord, type OpenISDDriver } from '@openisd/design';
import { Engine, type DriverError } from '@openisd/design/engine';
import type { FieldHandle, Provenance } from '@openisd/design';

import { WinISDDriver, type WdrCell, type WdrHeader } from './winisdDriver.js';
import { CellState } from './parstate.js';
import { dqCalculated, withDqCalculated } from './dqCalculated.js';

/**
 * The spec section of a driver, named through `OpenISDDriver`'s own PUBLIC `spec` property rather
 * than by importing the class behind it — that class is deliberately unexported, and this needs a
 * name for a parameter, not access to anything design keeps private.
 */
type DriverSpec = OpenISDDriver['spec']['woofer'];

/** Both derived artefacts and every problem found producing them. `openisd`/`wdr` are null when a
 *  blocking failure stopped that artefact being produced; `errors` is always an array. */
export interface DriverYmlProjection {
  openisd: string | null;
  wdr: string | null;
  errors: DriverError[];
}

/** The scraper-only section. It is named ONCE, here, because this is the only place that drops
 *  it — `drivers.md` Part A's structural drop is a property of `OpenISDDeviceJson`, which cannot
 *  help a caller that must also emit YAML text preserving the source's key order. */
const SCRAPER_ONLY_KEY = 'scraper_meta';

/** What a field MEANS. It belongs to `driver.yml` and to nothing downstream — John, 2026-09-01:
 *  "definition is 100% dead, it has no place in our openisd work except where I strip it in the
 *  bridge". A consumer of an openisd record already knows what `Fs` is.
 *
 *  It sits at EVERY depth of a record — on each metadata envelope, on each `sku.grounds` entry and
 *  on each spec entry — so removing it is a walk, not a top-level key filter like `scraper_meta`.
 *  Stripping it HERE, before the record is checked, is what lets `OpenISDDeviceJson` refuse it
 *  outright: that type states the shape of an OPENISD record, and `definition` is not part of one. */
const DEAD_KEY = 'definition';

/** The same value with every `definition` removed, at any depth. Rebuilt rather than deleted from,
 *  for the reason `openisdRecordFrom` gives: the parsed object is the round-trip's reference and
 *  must not be mutated by the thing it is checking. */
function withoutDefinitions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutDefinitions);
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (key === DEAD_KEY) continue;
    out[key] = withoutDefinitions(v);
  }
  return out;
}

/** `.wdr` provenance marks, from the domain's own three-state provenance. WinISD's format has
 *  exactly these three, so the mapping is total and needs no fallback. */
const WDR_MARK: Record<Provenance, CellState> = {
  entered: CellState.Entered,
  calculated: CellState.Computed,
  'not-available': CellState.Absent,
};

/**
 * `driver.yml`'s keys, in the file's own order, minus the scraper section.
 *
 * Rebuilt as a fresh object rather than `delete`d from the parsed one: the parsed object is the
 * round-trip's reference (step 4 below) and must not be mutated by the thing it is checking.
 */
function openisdRecordFrom(driverYml: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(driverYml)) {
    if (key === SCRAPER_ONLY_KEY) continue;
    out[key] = withoutDefinitions(value);
  }
  return out;
}

/**
 * Each `.wdr` key paired with the `DriverSpec` field that answers it — `Fs` → `Fs_hz`,
 * `Cms` → `Cms_m_per_N`.
 *
 * WRITTEN OUT, not derived by matching member names at runtime. The name-matching version of this
 * needed `spec` cast to a string-indexed record, which erases the type: a `DriverSpec` member
 * renamed or removed then becomes a field SILENTLY missing from every generated `.wdr`, found only
 * by someone diffing the corpus. Naming both halves makes the compiler check the pairing, so the
 * same rename is a build error here instead.
 *
 * `VCCon` is not here because it is not numeric — it is `Field<VoiceCoilWiring>`, a wiring NAME.
 * `wdrVCCon()` below projects it, and it is MANDATORY in the file (John, 2026-08-31).
 */
function wdrFields(spec: DriverSpec): ReadonlyArray<readonly [string, FieldHandle<number>]> {
  return [
    ['Qts', spec.Qts], ['Znom', spec.Znom_ohm], ['Fs', spec.Fs_hz], ['Pe', spec.Pe_W],
    ['SPL', spec.SPL_dB], ['Re', spec.Re_ohm], ['Le', spec.Le_H], ['fLe', spec.fLe_hz],
    ['KLe', spec.KLe_H_sqrtHz], ['BL', spec.BL_Tm], ['Xmax', spec.Xmax_m],
    ['Cms', spec.Cms_m_per_N], ['Qms', spec.Qms], ['Qes', spec.Qes], ['Rms', spec.Rms_kg_per_s],
    ['Mms', spec.Mms_kg], ['Sd', spec.Sd_m2], ['Vas', spec.Vas_m3], ['Dia', spec.Dia_m],
    ['Vd', spec.Vd_m3], ['no', spec.no], ['Dd', spec.Dd_m], ['EBP', spec.EBP_hz],
    ['numVC', spec.numVC], ['Hc', spec.Hc_m], ['Hg', spec.Hg_m], ['SPLmax', spec.SPLmax_dB],
    ['SPLmaxLF', spec.SPLmaxLF_dB], ['USPL', spec.USPL_dB], ['alfaVC', spec.alfaVC_per_K],
    ['Rt', spec.Rt_K_per_W], ['Ct', spec.Ct_J_per_K], ['gamma', spec.gamma_m_per_s2_A],
    ['Rme', spec.Rme_kg_per_s], ['Mpow', spec.Mpow_N_per_sqrtW], ['Mcost', spec.Mcost_kg_per_s],
    ['Gloss', spec.Gloss], ['c', spec.c_m_per_s],
    ['roo', spec.roo_kg_per_m3], ['Thick', spec.Thick_m], ['Depth', spec.Depth_m],
    ['MagDepth', spec.MagDepth_m], ['Magnet', spec.Magnet_m], ['Basket', spec.Basket_m],
    ['Outer', spec.Outer_m], ['Vcd', spec.Vcd_m], ['DVol', spec.DVol_m3],
  ];
}

/**
 * `VCCon` — the voice-coil connection row, which is MANDATORY in a `.wdr` (John, 2026-08-31) and
 * numeric where the domain holds a name.
 *
 * `1` = parallel, `2` = series: `docs/design/WINISD_SCHEMA.md` §3.2, ParState slot 47, verified
 * against WinISD 2026-06-26, and the same encoding `wiringFromRecord()` already reads in
 * `packages/design/domain/project.ts` — this is its inverse, not a second opinion.
 *
 * A driver that states no wiring still gets a row, because the field is mandatory. It is written
 * `1`/parallel — WinISD's own default for a single-coil driver — marked `N`, so the file says
 * "not in play" rather than claiming the record asserted parallel.
 *
 * ⚠ OPENISD WRITES THE TRUE WIRING; IT DOES NOT REPRODUCE WINISD'S SAVE BUG (John, 2026-08-31:
 * "openisd MUST not have same bug — openisd writes correct value to all files inc wdr"). WinISD
 * itself always writes `VCCon=1` on save whatever the UI shows (`WINISD_SCHEMA.md` §3.2), so a
 * series-wired driver saved by WinISD is indistinguishable in the file from a parallel one. A
 * series record projected HERE writes `2`.
 *
 * That difference is deliberate, and it is why the oracle set cannot be used to "correct" this
 * function: `s-connection-parallel*.wdr` read `1` and `s-connection-serial.wdr` /
 * `s-connection-serial-3vc.wdr` read `2`, but `s-connection-serial-2vc.wdr` reads `1` despite its
 * name — the save bug, captured in a fixture. Matching that file would mean copying the bug.
 */
function wdrVCCon(spec: DriverSpec): WdrCell {
  const cell = spec.VCCon.get();
  if (cell.value == null) return { value: '1', state: CellState.Absent };
  return {
    value: cell.value === 'series' ? '2' : '1',
    state: WDR_MARK[cell.state],
  };
}

/**
 * Every spec value the RECORD ITSELF states, paired with the record's own key for it — what the
 * range half of `dq_calculated` is asked about.
 *
 * ENTERED ONLY. A calculated cell holds a number the engine derived from other cells, so a range
 * mark on it would report the derivation rather than the record, and the field it belongs to may
 * not even have a spec entry for the mark to land on. The disagreement that produced the odd
 * derived value is what `checkConsistency()` reports, on the fields that actually caused it.
 *
 * Reuses `wdrFields`'s pairing rather than declaring a second one: those record keys are the same
 * keys `openisd.yml` states, so a field renamed there is a build error in one place.
 */
function statedValues(spec: DriverSpec): Array<readonly [string, number]> {
  const stated: Array<readonly [string, number]> = [];
  for (const [key, field] of wdrFields(spec)) {
    const cell = field.get();
    if (cell.state === 'entered' && cell.value != null && isFinite(cell.value)) {
      stated.push([key, cell.value]);
    }
  }
  return stated;
}

/** Every `.wdr` cell the driver can answer for, each carrying its own E/C/N mark. */
function cellsFrom(driver: OpenISDDriver, errors: DriverError[]): Map<string, WdrCell> {
  const cells = new Map<string, WdrCell>();
  cells.set('VCCon', wdrVCCon(driver.spec[driver.section]));

  for (const [key, field] of wdrFields(driver.spec[driver.section])) {
    const cell = field.get();
    if (cell.value == null) continue;

    if (!isFinite(cell.value)) {
      errors.push({ level: 'warn', field: key,
        message: `${key}: value is not finite — field dropped, WinISD's own default applies` });
      continue;
    }
    // An ENTERED zero is written through as an entered zero, and flagged. A scraper that failed to
    // read a number frequently yields 0, and 0 is a legitimate value for several of these fields,
    // so nothing downstream can tell the two apart from the file alone. Corpus generation is the
    // last point that still knows the value was *stated* rather than defaulted.
    if (cell.state === 'entered' && cell.value === 0) {
      errors.push({ level: 'warn', field: key,
        message: `${key}: entered value is 0 — written as an entered 0; verify this is real and ` +
          `not a failed extraction` });
    }
    cells.set(key, { value: String(cell.value), state: WDR_MARK[cell.state] });
  }
  return cells;
}

/**
 * `driver.yml` text in; `openisd.yml` text, `.wdr` text and every problem out.
 *
 * Never throws for bad INPUT: a record the caller could not have known was malformed comes back as
 * an `errors` entry, because the Python caller's whole job is "call this, check `errors`" and an
 * exception crossing the V8 boundary is not something it can read. A defect in THIS code is a
 * different matter and is left to throw.
 */
export function driverYmlToOpenisdAndWdr(driverYmlText: string): DriverYmlProjection {
  const errors: DriverError[] = [];

  let parsed: unknown;
  try {
    parsed = parse(driverYmlText);
  } catch (err) {
    return { openisd: null, wdr: null, errors: [{ level: 'error', field: 'driver.yml',
      message: 'could not parse as YAML: ' + (err instanceof Error ? err.message : String(err)) }] };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { openisd: null, wdr: null, errors: [{ level: 'error', field: 'driver.yml',
      message: 'parsed to ' + (parsed === null ? 'null' : typeof parsed) + ', not a record' }] };
  }

  const record = openisdRecordFrom(parsed);

  // The record seam is the ONE place an untrusted record becomes a driver, and it reports every
  // problem rather than the first. A record that cannot be read still yields its `openisd.yml`:
  // the scraper section is dropped by key, which needs no domain object. That file carries NO
  // `dq_calculated` at all — the calculation never ran on it, and an empty list would say it ran
  // and found nothing.
  const driver = driverFromConformingRecord(record, new Engine());
  if (Array.isArray(driver)) {
    for (const problem of driver) {
      errors.push({ level: 'error', field: 'record', message: problem });
    }
    return { openisd: stringify(record), wdr: null, errors };
  }

  const openisd = stringify(withDqCalculated(record, driver.section,
    dqCalculated(statedValues(driver.spec[driver.section]), driver.checkConsistency())));

  const header: WdrHeader = {
    brand: driver.brand.get().value ?? '',
    model: driver.model.get().value ?? '',
    manufacturer: driver.manufacturer.get().value ?? '',
    providedBy: driver.providedBy.get().value ?? '',
    comment: driver.comment.get().value ?? '',
    dateAdded: driver.added.get().value ?? '',
  };

  const wdrDriver = WinISDDriver.build(header, cellsFrom(driver, errors));
  for (const key of wdrDriver.missingKeys()) {
    errors.push({ level: 'warn', field: key,
      message: `${key}: no value produced for this .wdr key — written as a filler` });
  }

  return { openisd, wdr: wdrDriver.toWdr(), errors };
}
