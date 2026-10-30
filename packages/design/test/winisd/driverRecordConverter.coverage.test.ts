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

type Json = Record<string, unknown>;

function isJson(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function child(v: unknown, key: string): Json {
  if (!isJson(v)) throw new Error(`expected an object holding ${key}`);
  const next = v[key];
  if (!isJson(next)) throw new Error(`expected an object at ${key}`);
  return next;
}

/** The sw26dac76 record: a dual-voice-coil woofer stated as a `voice_coil` tuple. */
function record(): Json {
  const parsed: unknown = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  if (!isJson(parsed)) throw new Error('fixture is not an object');
  return parsed;
}

const read = (value: number, extra: Json = {}): Json => ({actual_reading: String(value), read_value: value, ...extra});
const entry = (value: number, role = 'manufacturer_datasheet'): Json => ({readings: {[role]: read(value)}});

function tupleOf(overrides: Json): Json {
  return {
    basis: {Re_ohm: 'per-coil', BL_Tm: 'per-coil'},
    Re_ohm: entry(2.4),
    BL_Tm: entry(9.7),
    numVC: entry(2),
    connection: 'series',
    connection_reading: entry(2),
    ...overrides,
  };
}

/** The record with its woofer section replaced by `fields` (and no tuple unless `fields` has one). */
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

const warnings = (errors: DriverError[]) => errors.filter(e => e.level === 'warn').map(e => e.message);

describe('DriverRecordConverter — voice-coil tuple edge cases', () => {
  it('a voice_coil that is not an object is left for the record schema to refuse', () => {
    const {errors} = convert(withWoofer({Fs_hz: entry(30), voice_coil: 5}));
    expect(errors.some(e => e.level === 'error')).toBe(true);
  });

  it('a tuple that does not match its schema is left for the record schema to refuse', () => {
    const {errors} = convert(withWoofer({Fs_hz: entry(30), voice_coil: {connection: 'series'}}));
    expect(errors.some(e => e.level === 'error')).toBe(true);
  });

  it('an implausible coil count is kept as N and leaves a stated-connection reading unavailable', () => {
    const dq = {kind: 'range', severity: 'warn', rule: 'r', detail: 'd', params: {}};
    const {openisd, errors} = convert(withWoofer({
      voice_coil: tupleOf({
        basis: {Re_ohm: 'for-stated-connection', BL_Tm: 'for-stated-connection'},
        numVC: entry(9),
        Re_ohm: {...entry(4.8), dq_scraper: [dq]},
      }),
    }));
    const woofer = wooferOf(openisd);
    expect(child(woofer, 'Re_ohm')).toMatchObject({state: 'N', dq_scraper: [dq]});
    expect(child(woofer, 'BL_Tm').state).toBe('N');
    expect(child(woofer, 'BL_Tm')).not.toHaveProperty('dq_scraper');
    expect(warnings(errors).filter(m => m.includes('required for per-coil scaling'))).toHaveLength(2);
  });

  it('a coil count that is not a whole number from 1 to 4 turns scaling off with a warning', () => {
    const {errors} = convert(withWoofer({
      voice_coil: tupleOf({basis: {Re_ohm: 'for-stated-connection', BL_Tm: 'per-coil'}, numVC: entry(2.5, 'manual')}),
    }));
    expect(warnings(errors)).toContain('voice-coil scaling unavailable: coil count is not an integer from 1 through 4');
  });

  it('scales Re and BL by the stated connection: series divides both, parallel multiplies Re only', () => {
    const basis = {Re_ohm: 'for-stated-connection', BL_Tm: 'for-stated-connection'};
    const series = wooferOf(convert(withWoofer({voice_coil: tupleOf({basis, numVC: entry(2), Re_ohm: entry(4.8), BL_Tm: entry(19.4)})})).openisd);
    expect(child(series, 'Re_ohm').value).toBeCloseTo(2.4);
    expect(child(series, 'BL_Tm').value).toBeCloseTo(9.7);
    const parallel = wooferOf(convert(withWoofer({
      voice_coil: tupleOf({basis, connection: 'parallel', numVC: entry(2), Re_ohm: entry(1.2), BL_Tm: entry(9.7)}),
    })).openisd);
    expect(child(parallel, 'Re_ohm').value).toBeCloseTo(2.4);
    expect(child(parallel, 'BL_Tm').value).toBeCloseTo(9.7);
    expect(child(parallel, 'VCCon').value).toBe(1);
  });

  it('a stated-connection reading with no winner stays N', () => {
    const {openisd} = convert(withWoofer({
      voice_coil: tupleOf({
        basis: {Re_ohm: 'for-stated-connection', BL_Tm: 'per-coil'},
        Re_ohm: {readings: {manufacturer_datasheet: {actual_reading: 'N/A', rejected: 'no-numeric-value'}}},
      }),
    }));
    expect(child(wooferOf(openisd), 'Re_ohm').state).toBe('N');
  });

  it('a series connection with no connection reading writes no wiring entry', () => {
    const {openisd} = convert(withWoofer({voice_coil: tupleOf({connection: 'series', connection_reading: null})}));
    expect(child(wooferOf(openisd), 'VCCon').state).not.toBe('E');
  });

  it('a connection reading nothing can win keeps its first source as the origin', () => {
    const {openisd} = convert(withWoofer({
      voice_coil: tupleOf({connection_reading: {readings: {manufacturer_datasheet: {actual_reading: 'N/A', rejected: 'no-numeric-value'}}}}),
    }));
    expect(child(wooferOf(openisd), 'VCCon')).toMatchObject({state: 'E', value: 2, origin: 'manufacturer_datasheet'});
  });

  it('judges the connection reading as the connection (VCCon), not as the coil count (numVC)', () => {
    const {errors} = convert(withWoofer({
      voice_coil: tupleOf({connection_reading: {readings: {manufacturer_datasheet: read(2), measured: read(3)}}}),
    }));
    const disagreements = errors.filter(e => e.message.startsWith('sources disagree'));
    expect(disagreements.map(e => e.field)).toEqual(['woofer.VCCon']);
  });

  it('an unclassified connection keeps its readings and warns that no wiring is inferred', () => {
    const {errors} = convert(withWoofer({voice_coil: tupleOf({connection: 'unknown'})}));
    expect(warnings(errors)).toContain('voice-coil connection is unclassified; source reading is retained and no wiring is inferred');
  });

  it('a reading basis that is unknown with a stated coil count is held back with a warning', () => {
    const {errors} = convert(withWoofer({voice_coil: tupleOf({basis: {Re_ohm: 'unknown', BL_Tm: 'per-coil'}})}));
    expect(warnings(errors)).toContain('voice-coil reading basis is unknown; raw source readings are retained without per-coil scaling');
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

  it('an entry no reading can win keeps the scraper marks beside its readings', () => {
    const dq = {kind: 'range', severity: 'warn', rule: 'r', detail: 'd', params: {}};
    const {openisd} = convert(withWoofer({
      Fs_hz: entry(30),
      Qts: {readings: {manual: {actual_reading: 'N/A', rejected: 'no-numeric-value'}}, dq_scraper: [dq]},
    }));
    expect(child(wooferOf(openisd), 'Qts')).toMatchObject({state: 'N', dq_scraper: [dq]});
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
