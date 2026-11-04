import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it, vi} from 'vitest';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {DriverRecordConverter, openIsdDriverToWinIsdDriver} from '../../domain/driverRecordConverter.js';
import {createEngine} from '../../engine/Engine.js';
import type {DriverError} from '../../engine/index.js';
import {WinISDDriver} from '@openisd/design/winisd';

const engine = createEngine();
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'corpus', 'sb-acoustics-sw26dac76-3-dv.driver.json');
const CX120_FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'corpus', 'dayton-audio', 'cx120-8.driver.json');

type Json = Record<string, unknown>;

function isJson(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseJson(text: string): Json {
  const parsed: unknown = JSON.parse(text);
  if (!isJson(parsed)) throw new Error('expected a JSON object');
  return parsed;
}

function child(v: unknown, key: string): Json {
  if (!isJson(v)) throw new Error(`expected an object holding ${key}`);
  const next = v[key];
  if (!isJson(next)) throw new Error(`expected an object at ${key}`);
  return next;
}

function record(): Json {
  const parsed: unknown = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  if (!isJson(parsed)) throw new Error('fixture is not an object');
  return parsed;
}

function cx120Record(): Json {
  const parsed: unknown = JSON.parse(readFileSync(CX120_FIXTURE, 'utf8'));
  if (!isJson(parsed)) throw new Error('CX120-8 fixture is not an object');
  return parsed;
}

const read = (value: number, extra: Json = {}): Json => ({actual_reading: String(value), read_value: value, ...extra});
const entry = (value: number, role = 'manufacturer_datasheet', extraReading: Json = {}): Json => ({
  readings: {[role]: {...read(value), ...extraReading}},
});

/** The record with its woofer section replaced by `fields`. */
function withWoofer(fields: Json): Json {
  const rec = record();
  const specs = child(rec, 'specs');
  specs.woofer = fields;
  return rec;
}

function convert(rec: Json) {
  return new DriverRecordConverter(engine).driverYmlToOpenisdAndWdr(JSON.stringify(rec));
}

function wooferOf(openisd: string | null): Json {
  if (openisd === null) throw new Error('no openisd text');
  return child(child(JSON.parse(openisd), 'specs'), 'woofer');
}

function wdrValue(wdr: string | null, key: string): string {
  if (wdr === null) throw new Error('no WDR text');
  const match = new RegExp(`^${key}=(.*?)\\r?$`, 'm').exec(wdr);
  if (match === null) throw new Error(`no ${key} row`);
  return match[1]!;
}

const warnings = (errors: DriverError[]) => errors.filter(e => e.level === 'warn').map(e => e.message);

describe('DriverRecordConverter — voice-coil derivation and edge cases', () => {
  it('keeps the CX120-8 published tweeter Qes=7.91 entered and preserves its source reading', () => {
    const {openisd, wdr} = convert(cx120Record());
    if (openisd === null) throw new Error('CX120-8 source did not project');
    const projected = parseJson(openisd);
    const specs = child(projected, 'specs');
    const tweeter = child(specs, 'tweeter');

    expect(child(tweeter, 'Qes')).toMatchObject({
      state: 'E', value: 7.91,
      readings: {manufacturer_datasheet: {actual_reading: '7.91', read_value: 7.91}},
    });
    expect(child(tweeter, 'Qms')).toMatchObject({state: 'E', value: 2.2});
    expect(child(tweeter, 'Qts')).toMatchObject({state: 'E', value: 1.72});
    expect(projected.data_sources).toMatchObject({value: {
      manufacturer_datasheet: 'https://daytonaudio.com/images/resources/295-384--dayton-audio-cx120-8-coaxial-driver-with-1-inch-tweeter-specifications.pdf',
      manufacturer_product_page: 'https://daytonaudio.com/product/1524/cx120-8-4-coaxial-driver-with-3-4-silk-dome-tweeter-8-ohm',
    }});
    expect(wdr).not.toContain('Qes: manufacturer_datasheet 7.91 — impossible for Qes');
  });

  it.each([5.001, 7.91, 1000])('accepts a finite Qes value above the former 5.0 cap (%s)', value => {
    const source = cx120Record();
    const specs = child(source, 'specs');
    const tweeter = child(specs, 'tweeter');
    tweeter.Qes = {readings: {manufacturer_datasheet: read(value)}};
    const {openisd} = convert(source);
    if (openisd === null) throw new Error('CX120-8 source did not project');
    expect(child(child(child(parseJson(openisd), 'specs'), 'tweeter'), 'Qes'))
      .toMatchObject({state: 'E', value});
  });

  it('projects SB sw26dac76-3-dv flat driver.json form with per-coil derivation and no basis keys', () => {
    const {openisd, wdr, errors} = convert(record());
    expect(errors.filter(error => error.level === 'error')).toEqual([]);
    const woofer = wooferOf(openisd);
    expect(child(woofer, 'Re_ohm')).toMatchObject({state: 'E', value: 2.4});
    expect(child(woofer, 'BL_Tm')).toMatchObject({state: 'E', value: 9.7});
    expect(woofer).not.toHaveProperty('Re_basis');
    expect(woofer).not.toHaveProperty('BL_basis');
    expect(child(woofer, 'numVC')).toMatchObject({state: 'E', value: 2});
    expect(child(woofer, 'VCCon')).toMatchObject({state: 'E', value: 2});
    expect(wdrValue(wdr, 'Re')).toBe('4.8');
    expect(wdrValue(wdr, 'BL')).toBe('19.4');
    expect(wdrValue(wdr, 'numVC')).toBe('2');
    expect(wdrValue(wdr, 'VCCon')).toBe('2');
  });

  it('derives per-coil values for series connection (VCCon 2)', () => {
    const withoutNx = convert(withWoofer({
      Fs_hz: entry(30),
      numVC: entry(2),
      VCCon: entry(2),
      Re_ohm: entry(4.8, 'manufacturer_datasheet', {actual_reading: '4.8 Ω'}),
      BL_Tm: entry(19.4, 'manufacturer_datasheet', {actual_reading: '19.4 Tm'}),
    }));
    const woofer1 = wooferOf(withoutNx.openisd);
    expect(child(woofer1, 'Re_ohm').value).toBe(2.4);
    expect(child(woofer1, 'BL_Tm').value).toBe(9.7);
    expect(woofer1).not.toHaveProperty('Re_basis');
    expect(woofer1).not.toHaveProperty('BL_basis');

    const withNx = convert(withWoofer({
      Fs_hz: entry(30),
      numVC: entry(2),
      VCCon: entry(2),
      Re_ohm: entry(2.4, 'manufacturer_datasheet', {actual_reading: '2 x 2.4 Ω'}),
      BL_Tm: entry(19.4, 'manufacturer_datasheet', {actual_reading: '19.4 Tm'}),
    }));
    const woofer2 = wooferOf(withNx.openisd);
    expect(child(woofer2, 'Re_ohm').value).toBe(2.4);
    expect(child(woofer2, 'BL_Tm').value).toBe(9.7);
  });

  it('derives per-coil values for parallel connection (VCCon 1)', () => {
    const withoutNx = convert(withWoofer({
      Fs_hz: entry(30),
      numVC: entry(2),
      VCCon: entry(1),
      Re_ohm: entry(1.2, 'manufacturer_datasheet', {actual_reading: '1.2 Ω'}),
      BL_Tm: entry(9.7, 'manufacturer_datasheet', {actual_reading: '9.7 Tm'}),
    }));
    const woofer1 = wooferOf(withoutNx.openisd);
    expect(child(woofer1, 'Re_ohm').value).toBe(2.4);
    expect(child(woofer1, 'BL_Tm').value).toBe(9.7);
    expect(woofer1).not.toHaveProperty('Re_basis');
    expect(woofer1).not.toHaveProperty('BL_basis');

    const withNx = convert(withWoofer({
      Fs_hz: entry(30),
      numVC: entry(2),
      VCCon: entry(1),
      Re_ohm: entry(2.4, 'manufacturer_datasheet', {actual_reading: '2 × 2.4 Ω'}),
      BL_Tm: entry(9.7, 'manufacturer_datasheet', {actual_reading: '9.7 Tm'}),
    }));
    const woofer2 = wooferOf(withNx.openisd);
    expect(child(woofer2, 'Re_ohm').value).toBe(2.4);
    expect(child(woofer2, 'BL_Tm').value).toBe(9.7);
  });

  it('leaves single-coil or unstated connection values unscaled without warnings', () => {
    const {openisd, errors} = convert(withWoofer({
      Fs_hz: entry(30),
      Re_ohm: entry(5.5),
      BL_Tm: entry(7.17),
    }));
    const woofer = wooferOf(openisd);
    expect(child(woofer, 'Re_ohm').value).toBe(5.5);
    expect(child(woofer, 'BL_Tm').value).toBe(7.17);
    expect(woofer).not.toHaveProperty('Re_basis');
    expect(woofer).not.toHaveProperty('BL_basis');
    expect(warnings(errors)).toEqual([]);
  });

  it('rejects a section containing voice_coil naming the key', () => {
    const {errors} = convert(withWoofer({
      Fs_hz: entry(30),
      voice_coil: {connection: 'series'},
    }));
    // The converter passes an unknown key on for the record schema to refuse (see 'an entry shaped
    // too strangely' below): the projection is written, the error names the key.
    expect(errors.some(e => e.level === 'error' && e.message.includes('voice_coil'))).toBe(true);
  });
});

describe('DriverRecordConverter — scraper entries', () => {
  it('an entry shaped too strangely for the scraper schema is passed on for the record schema to refuse', () => {
    const {openisd, errors} = convert(withWoofer({Fs_hz: {surprise: 1}}));
    expect(openisd).not.toBeNull();
    expect(errors.some(e => e.level === 'error')).toBe(true);
  });

  it('names a rejected reading and a reading with no printed text in a disagreement warning', () => {
    const {errors} = convert(withWoofer({
      Fs_hz: {readings: {
        manufacturer_datasheet: {read_value: 20},
        distributor_datasheet: {read_value: 30},
        manufacturer_product_page: {rejected: 'no-numeric-value'},
      }},
    }));
    expect(warnings(errors)).toContain(
      'sources disagree: distributor_datasheet=30, manufacturer_datasheet=20, manufacturer_product_page=no-numeric-value');
  });

  it('a typed entry keeps no calculated marks from the file', () => {
    const {openisd, errors} = convert(withWoofer({
      Fs_hz: {state: 'E', value: 30, dq_calculated: [{kind: 'bogus', severity: 'warn', rule: 'r', detail: 'stale', params: {}}]},
    }));
    expect(errors.filter(e => e.level === 'error')).toEqual([]);
    expect(JSON.stringify(wooferOf(openisd).Fs_hz)).not.toContain('stale');
  });

  it('an entry no reading can win keeps its readings and carries no scraper marks across (QO414)', () => {
    const dq = {kind: 'range', severity: 'warn', rule: 'r', detail: 'd', params: {}};
    const {openisd} = convert(withWoofer({
      Fs_hz: entry(30),
      Qts: {readings: {manual: {actual_reading: 'N/A', rejected: 'no-numeric-value'}}, dq_scraper: [dq]},
    }));
    expect(child(wooferOf(openisd), 'Qts')).toMatchObject({state: 'N'});
    expect(child(wooferOf(openisd), 'Qts')).not.toHaveProperty('dq_scraper');
  });

  it('a non-object entry is passed through unchanged', () => {
    const {errors} = convert(withWoofer({Fs_hz: 7}));
    expect(errors.some(e => e.level === 'error')).toBe(true);
  });
});

describe('DriverRecordConverter — what a .wdr says about readings no value came from', () => {
  it('lists each reading that won nothing, best source first and unranked sources by name', () => {
    const {wdr} = convert(withWoofer({
      Fs_hz: entry(30),
      Qts: {readings: {
        zeta: {actual_reading: '99999', read_value: 99999},
        alpha: {actual_reading: 'N/A', rejected: 'no-numeric-value'},
        manual: {rejected: 'no-numeric-value'},
        manufacturer_datasheet: {read_value: 88888},
      }},
    }));
    expect(wdr).not.toBeNull();
    const lines = (wdr ?? '').split('\n').filter(l => l.includes('Qts:'));
    expect(lines.join('\n')).toContain('Qts: manufacturer_datasheet 88888 — impossible for Qts');
    const order = ['manufacturer_datasheet', 'manual', 'alpha', 'zeta'].map(role => (wdr ?? '').indexOf(`Qts: ${role}`));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(wdr).toContain('Qts: manual — no-numeric-value');
  });

  it('is the whole comment when the driver has no comment and no source to name', () => {
    const rec = withWoofer({Fs_hz: entry(30), Qts: {readings: {manual: {actual_reading: 'N/A', rejected: 'no-numeric-value'}}}});
    rec.data_sources = {value: {}};
    const {wdr} = convert(rec);
    expect(WinISDDriver.fromWdrIni(wdr ?? '').headerField('comment')).toBe('Qts: manual N/A — no-numeric-value');
  });

  it('appends the lines to a comment the driver already has', () => {
    const rec = withWoofer({Fs_hz: entry(30), Qts: {readings: {manual: {actual_reading: 'N/A', rejected: 'no-numeric-value'}}}});
    rec.comment = {value: 'my note'};
    const {wdr} = convert(rec);
    expect(wdr).toContain('my note');
    expect(wdr).toContain('Qts: manual N/A — no-numeric-value');
  });
});

describe('DriverRecordConverter — rows of the .wdr', () => {
  it('marks a derived value of a non-calculable field as entered', () => {
    const {wdr} = convert(withWoofer({Fs_hz: entry(30), Hc_m: entry(0.03), Hg_m: entry(0.006)}));
    expect(WinISDDriver.fromWdrIni(wdr ?? '').cell('Xmax').state).toBe('entered');
    expect(WinISDDriver.fromWdrIni(wdr ?? '').cell('Xmax').value).toBe('0.012');
  });

  it('marks air the driver reports as entered, as entered', () => {
    // A resolve rewrites c/roo as calculated, so only a record not resolved since it was
    // loaded (an embedded driver's stale raw entry) still reads entered: stand that in by reading.
    const driver = OpenISDDriver.empty(engine);
    vi.spyOn(driver.specs.c_m_per_s, 'entered', 'get').mockReturnValue(true);
    vi.spyOn(driver.specs.roo_kg_per_m3, 'entered', 'get').mockReturnValue(true);
    const written = openIsdDriverToWinIsdDriver(driver, []);
    expect(written.cell('c').state).toBe('entered');
    expect(written.cell('roo').state).toBe('entered');
  });
});

describe('DriverRecordConverter.driverYmlToDqWarnings', () => {
  it('splits the pass into warnings and errors', () => {
    const rec = withWoofer({Fs_hz: {readings: {a: read(20), b: read(30)}}});
    const result = new DriverRecordConverter(engine).driverYmlToDqWarnings(JSON.stringify(rec));
    expect(result.warnings.map(w => w.message)).toContain('sources disagree: a=20, b=30');
    expect(result.errors).toEqual([]);
  });

  it('reports a file that does not parse as the one error', () => {
    const result = new DriverRecordConverter(engine).driverYmlToDqWarnings('a: [');
    expect(result.warnings).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('driver.yml');
  });
});
