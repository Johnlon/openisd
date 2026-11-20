import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {DriverRecordConverter} from '../../domain/driverRecordConverter.js';
import {createEngine} from '../../engine/Engine.js';

// John's ruling QO962 (20 Nov 2026): "B: keep the printed 2.83 V figure; the engine works out the 1 W one (changes how
// drivers are stored)". A sensitivity the source prints at 2.83 V / 1 m (the reading's note `2.83V/1m`) is the USPL the
// app stores as entered, never the 1 W / 1 m SPL; the engine derives SPL from it and Re. A sensitivity printed at 1 W / 1 m
// stays the SPL, and one printed with no condition stays as it was. Every record here is a real scraper record, copied
// byte-for-byte (provenance beside each fixture).

const CORPUS = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'corpus');
type Json = Record<string, unknown>;

function isJson(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function at(o: Json, key: string): Json {
  const v = o[key];
  if (!isJson(v)) throw new Error(`expected an object at ${key}`);
  return v;
}

function parse(text: string): Json {
  const parsed: unknown = JSON.parse(text);
  if (!isJson(parsed)) throw new Error('expected a JSON object');
  return parsed;
}

function fixture(name: string): Json {
  return parse(readFileSync(join(CORPUS, name), 'utf8'));
}

interface Converted { readonly woofer: Json; readonly wdr: string }

function convert(rec: Json): Converted {
  const out = new DriverRecordConverter(createEngine()).driverYmlToOpenisdAndWdr(JSON.stringify(rec));
  expect(out.errors.filter(e => e.level === 'error')).toEqual([]);
  if (out.openisd === null) throw new Error('no openisd: ' + JSON.stringify(out.errors));
  return {woofer: at(at(parse(out.openisd), 'specs'), 'woofer'), wdr: out.wdr ?? ''};
}

/** 1 W / 1 m from 2.83 V / 1 m: the drive is 2.83 V into Re, so the power is 2.83²/Re. */
const oneWatt = (uspl: number, re: number) => uspl - 10 * Math.log10(2.83 * 2.83 / re);

describe('DriverRecordConverter — a sensitivity is stored by the condition it was printed at (QO962)', () => {
  it('SB Acoustics SB23NRXS45-4, 92 dB at 2.83 V/1 m, Re 3.3: USPL 92 entered, SPL 88.15 calculated', () => {
    const {woofer} = convert(fixture('sb-acoustics-sb23nrxs45-4.driver.json'));
    expect(at(woofer, 'USPL_dB')).toMatchObject({state: 'E', value: 92, precision: 0.5});
    expect(at(woofer, 'SPL_dB').state).toBe('C');
    expect(at(woofer, 'SPL_dB').value).toBeCloseTo(oneWatt(92, 3.3), 9);
    expect(at(woofer, 'SPL_dB').value).toBeCloseTo(88.15, 2);
    // SPLmax follows the 1 W figure: SPL + 10·log10(Pe) − 3, Pe 60 W.
    expect(at(woofer, 'SPLmax_dB').value).toBeCloseTo(oneWatt(92, 3.3) + 10 * Math.log10(60) - 3, 9);
  });

  it('Dayton Audio RSS265HO-44 (2 ohm), 90.5 dB at 2.83 V/1 m, Re 1.6: USPL 90.5 entered, SPL 83.51 calculated', () => {
    const {woofer} = convert(fixture('dayton-audio-rss265ho-44.driver.json'));
    expect(at(woofer, 'USPL_dB')).toMatchObject({state: 'E', value: 90.5});
    expect(at(woofer, 'SPL_dB').state).toBe('C');
    expect(at(woofer, 'SPL_dB').value).toBeCloseTo(oneWatt(90.5, 1.6), 9);
  });

  it('B&C 12NDL88-8 (8 ohm), 98 dB at 2.83 V/1 m, Re 5.0: USPL 98 entered, SPL 95.95 calculated', () => {
    const {woofer} = convert(fixture('b-c-speakers-12ndl88-8.driver.json'));
    expect(at(woofer, 'USPL_dB')).toMatchObject({state: 'E', value: 98});
    expect(at(woofer, 'SPL_dB').state).toBe('C');
    expect(at(woofer, 'SPL_dB').value).toBeCloseTo(oneWatt(98, 5.0), 9);
  });

  it('the .wdr carries USPL entered and SPL calculated', () => {
    const {wdr} = convert(fixture('sb-acoustics-sb23nrxs45-4.driver.json'));
    expect(wdr.split(/\r?\n/).find(l => l.startsWith('USPL='))).toBe('USPL=92');
  });

  it('Faital Pro 12PR300-8, 99 dB at 1 W/1 m: stays the SPL, entered; USPL is calculated', () => {
    const {woofer} = convert(fixture('faitalpro-12pr300-8.driver.json'));
    expect(at(woofer, 'SPL_dB')).toMatchObject({state: 'E', value: 99});
    expect(at(woofer, 'USPL_dB').state).toBe('C');
  });

  it('a sensitivity printed with no condition stays the SPL, entered, as before (a separate open question)', () => {
    const rec = fixture('sb-acoustics-sb23nrxs45-4.driver.json');
    const spl = at(at(at(rec, 'specs'), 'woofer'), 'SPL_dB');
    const readings = at(spl, 'readings');
    for (const role of Object.keys(readings)) {
      const {note: _dropped, ...rest} = at(readings, role);
      readings[role] = rest;
    }
    const {woofer} = convert(rec);
    expect(at(woofer, 'SPL_dB')).toMatchObject({state: 'E', value: 92});
    expect(at(woofer, 'USPL_dB').state).toBe('C');
  });
});
