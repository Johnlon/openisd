/**
 * Multi-coil goldens from REAL catalogue records (T788, John QO913: "we need multiple coil goldens").
 *
 * Each record is a verbatim driver.json from the pinned winisd_drivers snapshot
 * (test/fixtures/driver-snapshot/<brand>/<sku>/driver.json, scripts/driver-snapshot.pin). It is
 * projected through the bridge's function (DriverRecordConverter.driverYmlToOpenisdAndWdr, the one
 * entry globalThis.driverYmlToOpenisdAndWdr calls), loaded as an OpenISDDriver and solved.
 *
 * Every expected value is a literal worked out by hand from the record's printed figures, as
 * published (no per-coil conversion), and each names its evidence (John: "how do you know what the
 * right value is"):
 *   - "printed on datasheet: X" for a value the sheet prints; the test reads the same field from the
 *     record's driver.json and checks it equals X, so the comment cannot drift from the fixture;
 *   - "calculated: <formula and numbers>" for a derived value, with an explicit assertion that it
 *     agrees with a printed figure within its printing precision (interval overlap: each input is
 *     taken anywhere in printed ± read_precision, which is what the consistency check allows).
 * Where the record's printed figures do NOT agree within precision, the test says so and asserts the
 * disagreement rather than forcing agreement.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {WinISDDriver} from '@openisd/design/winisd';
import {DriverRecordConverter} from '../../domain/driverRecordConverter.js';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {VoiceCoilWiring} from '../../domain/voiceCoilWiring.js';
import {createEngine} from '../../engine/Engine.js';
import type {WiredMotor} from '../../engine/solvers/driverQuantities.js';
import {
  assertChartMatches, assertLoadParity, chartRules, editorDeviations, GROUP_DELAY_BOUND_MS, loadBase, loadEditCapture, sweepAfterEdit,
} from '../fixtures/winisdEditCapture.js';

const engine = createEngine();
const SNAPSHOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'driver-snapshot');

const recordSchema = z.object({
  specs: z.object({
    woofer: z.record(z.string(), z.object({
      readings: z.record(z.string(), z.object({read_value: z.union([z.number(), z.string()]).optional(), read_precision: z.number().optional()}).passthrough()),
    }).passthrough()),
  }).passthrough(),
}).passthrough();

/** The record's text, verbatim. */
const textOf = (path: string): string => readFileSync(join(SNAPSHOT, path, 'driver.json'), 'utf8');

/** A printed figure: value and printing half-width, as the record holds them for one field. */
interface Printed {
  readonly value: number;
  readonly precision: number;
}

function printedOf(path: string, field: string): Printed {
  const parsed = recordSchema.parse(JSON.parse(textOf(path)));
  const readings = Object.values(parsed.specs.woofer[field].readings);
  const read = readings.find(r => typeof r.read_value === 'number' && r.read_precision !== undefined);
  if (typeof read?.read_value !== 'number' || read.read_precision === undefined) throw new Error(`${path}: ${field} prints no number`);
  return {value: read.read_value, precision: read.read_precision};
}

/** One source's reading of `field` as the record holds it: its read_value and rejection reason, if any. */
function readingOf(path: string, field: string, source: string): {read_value?: unknown; rejected?: unknown} {
  const parsed = recordSchema.parse(JSON.parse(textOf(path)));
  return parsed.specs.woofer[field].readings[source];
}

/** The range of `formula` with every input anywhere in its printed value ± precision (corner search; the formulas are monotone per input). */
function rangeOf(path: string, fields: readonly string[], formula: (v: readonly number[]) => number, perCoilRe = 1): {lo: number; hi: number; mid: number} {
  // A per-coil "N x r" Re is stored for the measured wiring: N coils in series, value and precision both N times (QO915).
  const p = fields.map(f => {
    const printed = printedOf(path, f);
    return f === 'Re_ohm' ? {value: printed.value * perCoilRe, precision: printed.precision * perCoilRe} : printed;
  });
  const values: number[] = [];
  for (let mask = 0; mask < (1 << p.length); mask++) {
    values.push(formula(p.map((x, i) => x.value + ((mask >> i) & 1 ? x.precision : -x.precision))));
  }
  return {lo: Math.min(...values), hi: Math.max(...values), mid: formula(p.map(x => x.value))};
}

/** The printed figure's own interval overlaps `range`: the sheet's numbers agree within their printing precision. */
function agrees(range: {lo: number; hi: number}, printed: Printed): boolean {
  return range.lo <= printed.value + printed.precision && range.hi >= printed.value - printed.precision;
}

interface Projection {
  readonly driver: OpenISDDriver;
  readonly openisd: string;
  readonly wdr: WinISDDriver;
}

/** `path` through the bridge. */
function project(path: string, edit?: (record: Record<string, unknown>) => void): Projection {
  const result = new DriverRecordConverter(engine).driverYmlToOpenisdAndWdr(textOf(path));
  expect(result.errors.filter(e => e.level === 'error')).toEqual([]);
  if (result.openisd === null || result.wdr === null) throw new Error(`${path} did not project`);
  const record = z.record(z.string(), z.unknown()).parse(JSON.parse(result.openisd));
  if (edit !== undefined) edit(record);
  const driver = OpenISDDriver.fromConformingRecord(record, engine);
  if (Array.isArray(driver)) throw new Error(driver.join('; '));
  driver.resolve();
  return {driver, openisd: result.openisd, wdr: WinISDDriver.fromWdrIni(result.wdr)};
}

const inconsistencies = (d: OpenISDDriver): string[] => d.issues().filter(i => i.kind === 'inconsistent-inputs').map(i => i.text);
const wiringKinds = (d: OpenISDDriver): string[] =>
  d.issues().filter(i => i.kind === 'wiring-not-stated' || i.kind === 'wiring-inferred' || i.kind === 'multi-coil-without-numvc').map(i => i.kind);
const num = (v: number | null): number => {
  if (v === null) throw new Error('value not solved');
  return v;
};

/** The motor figures the sweep and a rewiring read, as stored. */
const motorOf = (d: OpenISDDriver): WiredMotor => ({
  Re_ohm: num(d.specs.Re_ohm.value), BL_Tm: num(d.specs.BL_Tm.value), Le_H: d.specs.Le_H.value, Znom_ohm: d.specs.Znom_ohm.value,
});

/** Delete Qes, Qts and Qms so Qes can only come from Fs, Mms, Re and BL. */
const withoutQ = (record: Record<string, unknown>): void => {
  const specs = record.specs;
  if (typeof specs !== 'object' || specs === null || !('woofer' in specs) || typeof specs.woofer !== 'object' || specs.woofer === null) throw new Error('no woofer');
  for (const q of ['Qes', 'Qts', 'Qms']) Reflect.deleteProperty(specs.woofer, q);
};

const MX6 = 'dayton-audio/mx6-22';
const RSS = 'dayton-audio/rss265ho-44';
const RSS315 = 'dayton-audio/rss315ho-44';
const W137 = 'bliesma/w137a-854-4';
const GF250 = 'visaton/gf-250-2-x-4-ohm';
const SB34 = 'sb-acoustics/sb34swpl76-3-dv';

/** Qes = 2π·Fs·Mms·Re/BL², from printed Fs, Mms, Re, BL. */
const qesFromMotor = (v: readonly number[]): number => 2 * Math.PI * v[0] * v[1] * v[2] / (v[3] * v[3]);
/** Rme = 2π·Fs·Mms/Qes, from printed Fs, Mms, Qes. */
const rmeFromQes = (v: readonly number[]): number => 2 * Math.PI * v[0] * v[1] / v[2];
/** BL²/Re, from printed BL, Re. */
const rmeFromMotor = (v: readonly number[]): number => v[0] * v[0] / v[1];

/** The checks every record shares: the printed figures are what the comments say, Qes agrees (or not) with the printed Qes, Rme and Mpow. */
function checkTheMaths(path: string, expected: {
  readonly printed: Readonly<Record<string, number>>;
  readonly qes: number;
  readonly qesAgreesWithPrinted: boolean;
  /** The two Rme routes (printed Qes; stored BL and Re) agree within printing precision. */
  readonly rmeRoutesAgree: boolean;
  readonly rme: number;
  readonly mpow: number;
  /** Re is printed per coil ("N x r") and stored in series: N. Absent: stored as printed. */
  readonly perCoilRe?: number;
}): void {
  const reFactor = expected.perCoilRe ?? 1;
  const {driver} = project(path);
  for (const [field, value] of Object.entries(expected.printed)) expect(printedOf(path, field).value, `${path} printed ${field}`).toBe(value);

  // Qes calculated from the motor figures vs the printed Qes.
  expect(num(driver.specs.Re_ohm.value)).toBeCloseTo(printedOf(path, 'Re_ohm').value * reFactor, 12);
  const qes = rangeOf(path, ['Fs_hz', 'Mms_kg', 'Re_ohm', 'BL_Tm'], qesFromMotor, reFactor);
  expect(qes.mid).toBeCloseTo(expected.qes, 4);
  expect(agrees(qes, printedOf(path, 'Qes')), `${path}: calculated Qes ${qes.lo.toFixed(4)}..${qes.hi.toFixed(4)} vs printed Qes ${printedOf(path, 'Qes').value}`)
    .toBe(expected.qesAgreesWithPrinted);

  // The engine's own Qes when Qes, Qts, Qms are not given.
  const derived = project(path, withoutQ).driver.specs.Qes.value;
  expect(derived).toBeCloseTo(expected.qes, 4);

  // Rme, Mpow: not printed, so calculated; Rme from the printed Qes, Mpow from BL and Re.
  expect(num(driver.specs.Rme_kg_per_s.value)).toBeCloseTo(expected.rme, 2);
  expect(num(driver.specs.Mpow_N_per_sqrtW.value)).toBeCloseTo(expected.mpow, 3);
  // Rme (route 1) and Mpow² = BL²/Re (route 2) are two calculations of the same quantity: they agree within printing precision.
  const viaQes = rangeOf(path, ['Fs_hz', 'Mms_kg', 'Qes'], rmeFromQes);
  const viaMotor = rangeOf(path, ['BL_Tm', 'Re_ohm'], rmeFromMotor, reFactor);
  expect(viaQes.lo <= viaMotor.hi && viaMotor.lo <= viaQes.hi, `${path}: Rme ${viaQes.lo}..${viaQes.hi} vs BL²/Re ${viaMotor.lo}..${viaMotor.hi}`).toBe(expected.rmeRoutesAgree);
}

describe('Dayton MX6-22 (2 coils; sheet: "All specifications measured with voice coils wired in series")', () => {
  // printed on datasheet: Fs 30 Hz, Mms 63.8 g, Re 4.7 ohms, BL 12.3 Tm, Qes 0.37 (±0.005).
  it('Qes, Rme and Mpow on the printed figures', () => {
    checkTheMaths(MX6, {
      printed: {Fs_hz: 30, Mms_kg: 0.0638, Re_ohm: 4.7, BL_Tm: 12.3, Qes: 0.37},
      // calculated: Qes = 2π·30·0.0638·4.7/12.3² = 56.53/151.29 = 0.3736; agrees with printed Qes 0.37 ±0.005 (|0.3736-0.37| = 0.0036).
      qes: 0.3736,
      qesAgreesWithPrinted: true,
      rmeRoutesAgree: true,
      // calculated: Rme = 2π·30·0.0638/0.37 = 32.50 (printed Fs, Mms, Qes); BL²/Re = 12.3²/4.7 = 32.19 agrees within precision.
      rme: 32.50,
      // calculated: Mpow = BL/√Re = 12.3/√4.7 = 12.3/2.1679 = 5.674 (printed BL, Re).
      mpow: 5.674,
    });
  });

  it('no inconsistent-inputs issue (the printed figures agree within precision)', () => {
    expect(inconsistencies(project(MX6).driver)).toEqual([]);
  });

  // printed on datasheet: Znom "2 + 2 ohms *" (each coil 2). Measured in series (the sheet's own statement), so the bridge
  // stores 2 + 2 = 4 Ω, marked E (BUG_20261115_multi-coil-znom-stored-per-coil); the product page prints the same 4 ohms series.
  it('Znom "2 + 2 ohms" per coil, series: stored 4, marked E', () => {
    const {driver} = project(MX6);
    expect(driver.specs.Znom_ohm.value).toBe(4);
    expect(driver.specs.Znom_ohm.entered).toBe(true);
  });

  it('wiring data quality: the VCCon reading is the sheet\'s "All specifications measured with voice coils wired in series." (an approved wording, QO901), so the measured wiring is stated: series, entered, no wiring issue', () => {
    const {driver} = project(MX6);
    expect(wiringKinds(driver)).toEqual([]);
    expect(driver.specs.VCCon.value).toBe(VoiceCoilWiring.Series);
    expect(driver.specs.VCCon.entered).toBe(true);
  });

  it('.wdr: Re 4.7 and BL 12.3 as stored, marked E; VCCon 2 (series, stated) marked E', () => {
    const {wdr} = project(MX6);
    expect(wdr.cell('Re')).toEqual({value: '4.7', state: 'entered'});
    expect(wdr.cell('BL')).toEqual({value: '12.3', state: 'entered'});
    expect(wdr.cell('VCCon')).toEqual({value: '2', state: 'entered'});
  });

  // convertWiring is the only reader of the wiring (plan "How the wiring maths works after the fix").
  it('series -> parallel: Re 4.7/2² = 1.175, BL 12.3/2 = 6.15, Qes unchanged 0.3736', () => {
    const {driver} = project(MX6);
    const result = engine.driver.convertWiring(motorOf(driver), 2, 'series', 'parallel');
    if (!result.converted) throw new Error(result.reason);
    expect(result.motor.Re_ohm).toBeCloseTo(1.175, 12);
    expect(result.motor.BL_Tm).toBeCloseTo(6.15, 12);
    // calculated: Qes = 2π·30·0.0638·1.175/6.15² = 14.13/37.82 = 0.3736, the same as before the rewiring.
    const qes = (m: WiredMotor): number => 2 * Math.PI * 30 * 0.0638 * m.Re_ohm / (m.BL_Tm * m.BL_Tm);
    expect(qes(result.motor)).toBeCloseTo(0.3736, 4);
    expect(qes(result.motor)).toBeCloseTo(qes(motorOf(driver)), 12);
  });
});

describe('Dayton RSS265HO-44 (2 coils; product page: "measured with the voice coils wired in parallel for a 2 ohm load"; "4 Ohms Per Coil", printed Znom 2 ohms)', () => {
  // printed on datasheet: Fs 27.6 Hz, Mms 161 g, Re 1.6 ohms, BL 9.39 Tm, Qes 0.50 (±0.005).
  it('Qes, Rme and Mpow on the printed figures', () => {
    checkTheMaths(RSS, {
      printed: {Fs_hz: 27.6, Mms_kg: 0.161, Re_ohm: 1.6, BL_Tm: 9.39, Qes: 0.5},
      // calculated: Qes = 2π·27.6·0.161·1.6/9.39² = 44.67/88.17 = 0.5066 (centre); the printed Re 1.6 ±0.05 spans 0.491..0.523, so it
      // agrees with printed Qes 0.50 ±0.005 only through Re's own rounding (the centre alone differs by 0.0066).
      qes: 0.5066,
      qesAgreesWithPrinted: true,
      rmeRoutesAgree: true,
      // calculated: Rme = 2π·27.6·0.161/0.50 = 55.84; BL²/Re = 9.39²/1.6 = 55.11 agrees within precision.
      rme: 55.84,
      // calculated: Mpow = 9.39/√1.6 = 9.39/1.2649 = 7.423.
      mpow: 7.423,
    });
  });

  // The sheet's own Vas, Cms and Sd disagree: printed Sd 352.3 cm², Cms 0.21 mm/N, Vas 34.8 liters.
  // calculated: Vas = ρ·c²·Sd²·Cms = 1.20095·343.684²·0.03523²·0.00021 = 36.97 L (range 36.08..37.86 L with Sd and Cms at the edges of
  // their printing), against printed Vas 34.8 ±0.05 L: no overlap, a source inconsistency (6% by the engine's own measure).
  it('printed Vas 34.8 disagrees with Sd and Cms beyond printing precision, and the only inconsistent-inputs issue says so', () => {
    const rho = 1.2009521771468228, c = 343.68412096215235;
    const vas = rangeOf(RSS, ['Sd_m2', 'Cms_m_per_N'], v => rho * c * c * v[0] * v[0] * v[1]);
    expect(printedOf(RSS, 'Vas_m3').value).toBe(0.0348);
    expect(vas.mid * 1000).toBeCloseTo(36.97, 2);
    expect(agrees(vas, printedOf(RSS, 'Vas_m3'))).toBe(false);
    const texts = inconsistencies(project(RSS).driver);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain('Vas = ρ·c²·Sd²·Cms');
  });

  // Evidence: the product page (https://daytonaudio.com/product/1108/rss265ho-44-10-reference-ho-dvc-subwoofer-4-ohms-per-coil) prints
  // "Specifications below were measured with the voice coils wired in parallel for a 2 ohm load." John's ruling QO926: a maker's
  // product-page statement counts like the datasheet. The record's VCCon reading (manufacturer_product_page) is "parallel".
  // Re 1.6 beside "4 Ohms Per Coil" is 0.4x of 4, which is what parallel looks like: the stated wiring agrees with the title.
  it('wiring data quality: the product page states parallel (QO926), so VCCon is parallel, entered, and there is no wiring issue (no inference note)', () => {
    const {driver} = project(RSS);
    expect(readingOf(RSS, 'VCCon', 'manufacturer_product_page').read_value).toBe('parallel');
    expect(wiringKinds(driver)).toEqual([]);
    expect(driver.specs.VCCon.value).toBe(VoiceCoilWiring.Parallel);
    expect(driver.specs.VCCon.entered).toBe(true);
    expect(driver.specs.VCCon.calculated).toBe(false);
  });

  it('.wdr: Re 1.6 and BL 9.39 as stored, marked E; VCCon 1 (parallel, stated) marked E', () => {
    const {wdr} = project(RSS);
    expect(wdr.cell('Re')).toEqual({value: '1.6', state: 'entered'});
    expect(wdr.cell('BL')).toEqual({value: '9.39', state: 'entered'});
    expect(wdr.cell('VCCon')).toEqual({value: '1', state: 'entered'});
  });
});

describe('Dayton RSS315HO-44 (2 coils; wiring NOT stated anywhere; "4 Ohms Per Coil", Re 6.5, printed Znom "4+4 ohms"): the inference rule, QO903 R4', () => {
  // Why this record: it is the one catalogue record with a per-coil nominal in its title and no stated wiring (neither the
  // datasheet nor the product page says how the coils were wired; contrast RSS265HO-44, whose product page does, QO926).
  // printed on datasheet: Fs 21.5 Hz, Re 6.5 ohms, BL 26.5 Tm, Cms 0.17 mm/N, Qes 0.41 (+-0.005), Qts 0.37, Qms 3.70.
  // Mms is printed "327.7" with no unit, so the scraper rejected it (unit-not-recognised): the record holds no Mms number and the
  // engine calculates Mms from Cms and Fs (the projection marks it C). 327.7 read as grams is the sheet's own figure.
  const w = 2 * Math.PI * 21.5;

  it('Mms is calculated from Cms and Fs, because the printed "327.7" has no unit and was rejected', () => {
    const {driver} = project(RSS315);
    expect(readingOf(RSS315, 'Mms_kg', 'manufacturer_datasheet').rejected).toBe('unit-not-recognised');
    // calculated: Mms = 1/((2π·21.5)²·Cms) = 1/(135.088² · 0.00017) = 1/(18248.9 · 0.00017) = 1/3.1023 = 0.32234 kg (323.4 g).
    expect(num(driver.specs.Mms_kg.value)).toBeCloseTo(0.32234, 5);
    expect(driver.specs.Mms_kg.calculated).toBe(true);
    // The sheet's own 327.7 g is 0.0054 kg above the calculated value, inside the calculated value's own precision (+-0.011 kg).
    expect(Math.abs(0.3277 - num(driver.specs.Mms_kg.value))).toBeLessThan(0.011);
  });

  it('Qes, Rme and Mpow on the printed figures', () => {
    const {driver} = project(RSS315);
    for (const [field, value] of Object.entries({Fs_hz: 21.5, Re_ohm: 6.5, BL_Tm: 26.5, Cms_m_per_N: 0.00017, Qes: 0.41})) {
      expect(printedOf(RSS315, field).value, `printed ${field}`).toBe(value);
    }
    // Re is stored as printed (Znom is per coil but the wiring is only inferred, QO915 needs a STATED wiring): 6.5, not 13.
    expect(num(driver.specs.Re_ohm.value)).toBe(6.5);
    // calculated: Qes = 2π·Fs·Mms·Re/BL² = 135.088·0.32234·6.5/26.5² = 283.04/702.25 = 0.4030. The printed Qes 0.41 +-0.005 is 0.007 away
    // from the centre, so they do NOT agree at the centres; they agree only through the printing precision of Fs, Re, BL, Cms
    // (range 0.386..0.421 with each at its printed edge; the printed 0.405..0.415 overlaps it).
    const qesMid = w * 0.32234016 * 6.5 / (26.5 * 26.5);
    expect(qesMid).toBeCloseTo(0.4030, 4);
    const qes = (f: number, re: number, bl: number, cms: number): number => 2 * Math.PI * f * (1 / ((2 * Math.PI * f) ** 2 * cms)) * re / (bl * bl);
    expect(qes(21.55, 6.45, 26.55, 0.000175)).toBeCloseTo(0.386, 3);
    expect(qes(21.45, 6.55, 26.45, 0.000165)).toBeCloseTo(0.421, 3);
    expect(agrees({lo: 0.386, hi: 0.421}, printedOf(RSS315, 'Qes'))).toBe(true);
    // With Qes, Qts, Qms removed the engine derives the same Qes from Fs, Mms, Re, BL.
    expect(num(project(RSS315, withoutQ).driver.specs.Qes.value)).toBeCloseTo(0.4030, 4);
    // calculated: Rme = 2π·Fs·Mms/Qes = 135.088·0.32234/0.41 = 106.21 (printed Qes 0.41); BL²/Re = 26.5²/6.5 = 108.04. Route 1 spans
    // 101..111 (Mms +-0.011, Qes +-0.005, Fs +-0.05) and route 2 spans 106.8..109.3: they overlap, so the two agree within precision.
    expect(num(driver.specs.Rme_kg_per_s.value)).toBeCloseTo(106.21, 2);
    expect(26.5 * 26.5 / 6.5).toBeCloseTo(108.04, 2);
    expect(26.45 ** 2 / 6.55).toBeLessThan(109.4);
    expect(26.55 ** 2 / 6.45).toBeGreaterThan(101);
    // calculated: Mpow = BL/sqrt(Re) = 26.5/sqrt(6.5) = 26.5/2.5495 = 10.394.
    expect(num(driver.specs.Mpow_N_per_sqrtW.value)).toBeCloseTo(10.394, 3);
  });

  it('no inconsistent-inputs issue (the printed figures agree within precision)', () => {
    expect(inconsistencies(project(RSS315).driver)).toEqual([]);
  });

  // Znom is printed per coil, "4+4 ohms" (stored read_value 4, precision 0.5). The per-coil rule (QO915) needs a STATED wiring to
  // say which wiring the per-coil figure converts to; here the wiring is only inferred, so the rule does not apply and the app
  // stores the printed 4 as it is. Consequence: Re 6.5 (series-scale) sits beside Znom 4 (one coil), not the 8 a series pair gives.
  it('Znom "4+4 ohms": stored as printed, 4, entered; no per-coil conversion because the wiring is not stated (QO915)', () => {
    const {driver} = project(RSS315);
    expect(driver.specs.Znom_ohm.value).toBe(4);
    expect(driver.specs.Znom_ohm.entered).toBe(true);
  });

  it('wiring data quality: no stated wiring; "4 Ohms Per Coil" with Re 6.5 (6.5/4 = 1.625x >= 1.5x) infers series, a note, marked calculated', () => {
    const {driver} = project(RSS315);
    expect(wiringKinds(driver)).toEqual(['wiring-inferred']);
    expect(driver.issues().find(i => i.kind === 'wiring-inferred')?.text).toContain('series');
    expect(driver.specs.VCCon.value).toBe(VoiceCoilWiring.Series);
    expect(driver.specs.VCCon.calculated).toBe(true);
    expect(driver.specs.VCCon.entered).toBe(false);
  });

  it('.wdr: Re 6.5 and BL 26.5 as stored, marked E; VCCon 2 (series, inferred) marked C', () => {
    const {wdr} = project(RSS315);
    expect(wdr.cell('Re')).toEqual({value: '6.5', state: 'entered'});
    expect(wdr.cell('BL')).toEqual({value: '26.5', state: 'entered'});
    expect(wdr.cell('VCCon')).toEqual({value: '2', state: 'calculated'});
  });

  it('series -> parallel: Re 6.5/2² = 1.625, BL 26.5/2 = 13.25, Qes unchanged 0.4030', () => {
    const {driver} = project(RSS315);
    const result = engine.driver.convertWiring(motorOf(driver), 2, 'series', 'parallel');
    if (!result.converted) throw new Error(result.reason);
    expect(result.motor.Re_ohm).toBeCloseTo(1.625, 12);
    expect(result.motor.BL_Tm).toBeCloseTo(13.25, 12);
    // calculated: Qes = 135.088·0.32234·1.625/13.25² = 70.76/175.56 = 0.4030, the same as before the rewiring.
    const mms = num(driver.specs.Mms_kg.value);
    const qesOf = (m: WiredMotor): number => w * mms * m.Re_ohm / (m.BL_Tm * m.BL_Tm);
    expect(qesOf(result.motor)).toBeCloseTo(0.4030, 4);
    expect(qesOf(result.motor)).toBeCloseTo(qesOf(motorOf(driver)), 12);
  });
});

describe('Bliesma W137A-854-4 (3 independent coils, configuration as published, no wiring stated)', () => {
  // printed on datasheet: Fs 31.5 Hz, Mms 27.1 g, Re 3.4 ohm, BL 6.7 T*m, Qes 0.41 (±0.005), Rms 0.75 kg/s, Qms 7.35.
  it('Qes, Rme and Mpow on the printed figures', () => {
    checkTheMaths(W137, {
      printed: {Fs_hz: 31.5, Mms_kg: 0.0271, Re_ohm: 3.4, BL_Tm: 6.7, Qes: 0.41},
      // calculated: Qes = 2π·31.5·0.0271·3.4/6.7² = 18.236/44.89 = 0.4062; agrees with printed Qes 0.41 ±0.005 (|0.4062-0.41| = 0.0038).
      qes: 0.4062,
      qesAgreesWithPrinted: true,
      rmeRoutesAgree: true,
      // calculated: Rme = 2π·31.5·0.0271/0.41 = 13.08; BL²/Re = 6.7²/3.4 = 13.20 agrees within precision.
      rme: 13.08,
      // calculated: Mpow = 6.7/√3.4 = 6.7/1.8439 = 3.634.
      mpow: 3.634,
    });
  });

  // The sheet's own Rms does not agree with its Qms: calculated Rms = 2π·Fs·Mms/Qms = 2π·31.5·0.0271/7.35 = 0.7297, printed
  // "0.75 kg/s" ±0.005. Even with every input at the edge of its printing precision the range stays below 0.745.
  it('printed Rms 0.75 and printed Qms 7.35 disagree beyond printing precision (a source inconsistency)', () => {
    const rms = rangeOf(W137, ['Fs_hz', 'Mms_kg', 'Qms'], v => 2 * Math.PI * v[0] * v[1] / v[2]);
    expect(printedOf(W137, 'Rms_kg_per_s').value).toBe(0.75);
    expect(rms.mid).toBeCloseTo(0.7297, 4);
    expect(agrees(rms, printedOf(W137, 'Rms_kg_per_s'))).toBe(false);
  });

  it('inconsistent-inputs: only the Rms/Qms disagreement above, nothing about Qes or the motor', () => {
    const texts = inconsistencies(project(W137).driver);
    expect(texts.filter(t => !/Rms|Qms/.test(t))).toEqual([]);
    expect(texts.length).toBeGreaterThan(0);
  });

  it('wiring data quality: 3 coils, VCCon "wiring diagram" (no number), no per-coil nominal to infer from: "not stated" warning, nothing inferred', () => {
    const {driver} = project(W137);
    expect(wiringKinds(driver)).toEqual(['wiring-not-stated']);
    expect(driver.specs.VCCon.value).toBeNull();
  });

  it('.wdr: Re 3.4 and BL 6.7 as stored, marked E; VCCon 1 marked C (unknown, R1)', () => {
    const {wdr} = project(W137);
    expect(wdr.cell('Re')).toEqual({value: '3.4', state: 'entered'});
    expect(wdr.cell('BL')).toEqual({value: '6.7', state: 'entered'});
    expect(wdr.cell('VCCon')).toEqual({value: '1', state: 'calculated'});
  });

  it('3 coils cannot be rewired here', () => {
    const {driver} = project(W137);
    expect(engine.driver.convertWiring(motorOf(driver), 3, 'series', 'parallel').converted).toBe(false);
  });
});

describe('Visaton GF 250 2 X 4 OHM (2 coils; VCCon 2 = series per LD-DVC-1, per-wiring rows)', () => {
  // printed on datasheet: Fs 24 Hz, Mms 54 g, Re 6.2 Ohm, BL 13 T m, Qes 0.29 (±0.005), VCCon "2".
  it('Qes, Rme and Mpow on the printed figures', () => {
    checkTheMaths(GF250, {
      printed: {Fs_hz: 24, Mms_kg: 0.054, Re_ohm: 6.2, BL_Tm: 13, Qes: 0.29},
      // calculated: Qes = 2π·24·0.054·6.2/13² = 50.49/169 = 0.2987 (centre). BL is printed to ±0.5 (3.8%), so the range is 0.27..0.33
      // and agrees with printed Qes 0.29 ±0.005 only through BL's own rounding (centre differs by 0.0087).
      qes: 0.2987,
      qesAgreesWithPrinted: true,
      rmeRoutesAgree: true,
      // calculated: Rme = 2π·24·0.054/0.29 = 28.08; BL²/Re = 13²/6.2 = 27.26 agrees within precision.
      rme: 28.08,
      // calculated: Mpow = 13/√6.2 = 13/2.4900 = 5.221.
      mpow: 5.221,
    });
  });

  it('no inconsistent-inputs issue', () => {
    expect(inconsistencies(project(GF250).driver)).toEqual([]);
  });

  it('wiring data quality: stated series (VCCon 2, entered), no wiring issue', () => {
    const {driver} = project(GF250);
    expect(wiringKinds(driver)).toEqual([]);
    expect(driver.specs.VCCon.value).toBe(VoiceCoilWiring.Series);
    expect(driver.specs.VCCon.entered).toBe(true);
  });

  it('.wdr: Re 6.2 and BL 13 as stored, marked E; VCCon 2 marked E', () => {
    const {wdr} = project(GF250);
    expect(wdr.cell('Re')).toEqual({value: '6.2', state: 'entered'});
    expect(wdr.cell('BL')).toEqual({value: '13', state: 'entered'});
    expect(wdr.cell('VCCon')).toEqual({value: '2', state: 'entered'});
  });

  it('series -> parallel: Re 6.2/2² = 1.55 (÷4), BL 13/2 = 6.5 (÷2)', () => {
    const result = engine.driver.convertWiring(motorOf(project(GF250).driver), 2, 'series', 'parallel');
    if (!result.converted) throw new Error(result.reason);
    expect(result.motor.Re_ohm).toBeCloseTo(1.55, 12);
    expect(result.motor.BL_Tm).toBeCloseTo(6.5, 12);
  });
});

describe('SB Acoustics SB34SWPL76-3-DV (2 coils; "(par./ser.)" rows, series set per LD-DVC-1)', () => {
  // printed on datasheet: Fs 27.5 Hz, Mms 231 g, BL "(par./ser.) 9.7/19.5 Tm" (series 19.5), Qes 0.52 (±0.005),
  // Re "2 x 2.5 Ω" (one coil's 2.5), VCCon from the same "(par./ser.)" row = series.
  // The bridge states the per-coil Re for the measured wiring (QO915, QO919): series, so 2 · 2.5 = 5 Ω, marked E.
  // Qes = 2π·27.5·0.231·5/19.5² = 199.55/380.25 = 0.5248, which agrees with the printed 0.52 within its ±0.005 (|0.5248-0.52| = 0.0048).
  it('Qes, Rme and Mpow on the stored figures; Re 5 (series of 2 x 2.5), so calculated Qes 0.5248 agrees with the printed 0.52', () => {
    checkTheMaths(SB34, {
      printed: {Fs_hz: 27.5, Mms_kg: 0.231, Re_ohm: 2.5, BL_Tm: 19.5, Qes: 0.52},
      perCoilRe: 2,
      qes: 0.5248,
      qesAgreesWithPrinted: true,
      rmeRoutesAgree: true,
      // calculated: Rme = 2π·27.5·0.231/0.52 = 76.76 (printed Fs, Mms, Qes); BL²/Re = 19.5²/5 = 76.05 agrees within precision.
      rme: 76.76,
      // calculated: Mpow = 19.5/√5 = 19.5/2.23607 = 8.721 (stored Re 5, BL 19.5).
      mpow: 8.721,
    });
  });

  it('the record is consistent: no inconsistent-inputs issue', () => {
    expect(inconsistencies(project(SB34).driver)).toEqual([]);
  });

  it('wiring data quality: stated series, no wiring issue', () => {
    const {driver} = project(SB34);
    expect(wiringKinds(driver)).toEqual([]);
    expect(driver.specs.VCCon.value).toBe(VoiceCoilWiring.Series);
    expect(driver.specs.VCCon.entered).toBe(true);
  });

  // printed on the product page: Znom "2 x 3 Ω" (one coil's 3). Like Re, the bridge states it for the measured wiring (series):
  // 2 · 3 = 6 Ω, marked E (BUG_20261115_multi-coil-znom-stored-per-coil). Stored per coil, Znom 3 sat below the series Re 5.
  it('Znom "2 x 3 Ω" per coil, series: stored 6, marked E, precision 2 · 0.5', () => {
    const {driver} = project(SB34);
    expect(driver.specs.Znom_ohm.value).toBe(6);
    expect(driver.specs.Znom_ohm.entered).toBe(true);
    expect(driver.specs.Znom_ohm.precision).toBe(1);
  });

  it('.wdr: Re 5 and BL 19.5 as stored, marked E; VCCon 2 marked E', () => {
    const {wdr} = project(SB34);
    expect(wdr.cell('Re')).toEqual({value: '5', state: 'entered'});
    expect(wdr.cell('BL')).toEqual({value: '19.5', state: 'entered'});
    expect(wdr.cell('VCCon')).toEqual({value: '2', state: 'entered'});
  });
});

/**
 * WinISD's own numbers for a multi-coil driver. winisd_research runs/sweep-t393a-sealed-e150he44-numvc2.json and the vendored
 * capture of runs/sweep-t429-e150-sealed-edit-numvc (test/fixtures/winisd-edit-captures/e150he-44/sealed-numvc.json): Dayton E150HE-44 as
 * filed (numVC 2, VCCon 1, Re 6.6, BL 9.8) in a 4 L sealed box. WinISD uses the file's Re and BL as published, the basis this fix
 * adopts, so OpenISD's charts and editor values must equal WinISD's recorded ones. (No datasheet-snapshot record of this driver is
 * a multi-coil snapshot fixture; it is the one multi-coil driver with a WinISD run on disk.)
 */
describe('E150HE-44 numVC 2: OpenISD against WinISD\'s recorded run (sweep-t429-e150-sealed-edit-numvc)', () => {
  const capture = loadEditCapture('e150he-44', 'sealed-numvc');
  const project = loadBase(capture);
  it('the file loads as WinISD loads it', () => assertLoadParity(loadBase(capture), capture));
  project.driver.specField('numVC').set(capture.typed);
  const swept = sweepAfterEdit(project, capture);
  const rules = chartRules(GROUP_DELAY_BOUND_MS);
  it.each(['impedance', 'spl', 'excursion', 'maxpower'] as const)('%s chart equals WinISD\'s recorded chart', (q) => assertChartMatches(capture, swept, q, rules));
  it('every editor value and its E/C mark equals WinISD\'s (Re 6.600 E, BL 9.80000 E, Qes 0.450 E)', () => {
    expect(editorDeviations(project, capture, () => true).filter(d => !/fLe|KLe|Hc|Hg/.test(d))).toEqual([]);
  });
});
