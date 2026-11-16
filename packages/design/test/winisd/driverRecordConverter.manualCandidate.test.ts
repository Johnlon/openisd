import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {DriverRecordConverter} from '../../domain/driverRecordConverter.js';
import {createEngine} from '../../engine/Engine.js';
import {WinISDDriver} from '@openisd/design/winisd';
import {withNamedWiringReadings} from '../fixtures/scraperWiringShape.js';

// QO942.c83-c87, issue 523 (John, 2026-11-16: "override must work for any field in the driver file"):
// the scraper files a person's override beside the scraped value and decides nothing; the bridge chooses.
// A metadata field carries it in `readings.manual`; a field with no readings map of its own (a bare
// bool, a derived or bookkeeping envelope) in the record's `manual_candidates`.

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'corpus', 'sb-acoustics-sw26dac76-3-dv.driver.json');
type Json = Record<string, unknown>;

function isJson(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The object at `key`, or a failing test. */
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

function record(): Json {
  return parse(withNamedWiringReadings(readFileSync(FIXTURE, 'utf8')));
}

function convert(rec: Json) {
  const out = new DriverRecordConverter(createEngine()).driverYmlToOpenisdAndWdr(JSON.stringify(rec));
  if (out.openisd === null) throw new Error('no openisd: ' + JSON.stringify(out.errors));
  return {openisd: parse(out.openisd), openisdText: out.openisd, wdr: out.wdr ?? ''};
}

const field = at;
const header = (wdr: string, key: 'model' | 'comment') => WinISDDriver.fromWdrIni(wdr).headerField(key);

describe('the bridge chooses the manual candidate for every field of driver.json', () => {
  it('a spec field: the manual reading wins (unchanged)', () => {
    const rec = record();
    const woofer = at(at(rec, 'specs'), 'woofer');
    at(woofer, 'Fs_hz').readings = {...at(at(woofer, 'Fs_hz'), 'readings'), manual: {actual_reading: '77 Hz', read_value: 77}};
    const w = at(at(at(convert(rec).openisd, 'specs'), 'woofer'), 'Fs_hz');
    expect(w.value).toBe(77);
  });

  it('model: readings.manual is the value, in openisd.json and the .wdr header; readings stay out', () => {
    const rec = record();
    at(rec, 'model').readings = {manual: 'Hand Model 1'};
    const {openisd, wdr, openisdText} = convert(rec);
    expect(field(openisd, 'model')).toEqual({value: 'Hand Model 1'});
    expect(header(wdr, 'model')).toBe('Hand Model 1');
    expect(openisdText).not.toContain('readings": {"manual');
  });

  it('comment absent in the scrape: the {value, origin: manual} field is chosen', () => {
    const rec = record();
    delete rec.comment;
    rec.comment = {value: 'one chosen wiring', origin: 'manual'};
    const {openisd, wdr} = convert(rec);
    expect(field(openisd, 'comment')).toEqual({value: 'one chosen wiring'});
    expect(header(wdr, 'comment')).toContain('one chosen wiring');
  });

  it('comment present in the scrape: the manual reading replaces it', () => {
    const rec = record();
    rec.comment = {value: 'scraped', origin: 'manufacturer_product_page', readings: {manual: 'by hand'}};
    const {openisd, wdr} = convert(rec);
    expect(field(openisd, 'comment')).toEqual({value: 'by hand'});
    expect(header(wdr, 'comment')).toContain('by hand');
    expect(header(wdr, 'comment')).not.toContain('scraped');
  });

  it('a bool (discontinued): the candidate is read, never reaches openisd.json, and nothing else changes', () => {
    const base = convert(record());
    const rec = record();
    rec.discontinued = false;
    rec.manual_candidates = {discontinued: true};
    const withCand = convert(rec);
    expect(withCand.openisd).toEqual(base.openisd);
    expect(withCand.openisdText).not.toContain('manual_candidates');
  });

  it('a derived envelope (sku): the candidate is the value', () => {
    const rec = record();
    rec.manual_candidates = {sku: 'hand-sku'};
    const {openisd, openisdText} = convert(rec);
    expect(field(openisd, 'sku')).toEqual({value: 'hand-sku'});
    expect(openisdText).not.toContain('manual_candidates');
  });

  it('a list field (driver_type): readings.manual is the list', () => {
    const rec = record();
    at(rec, 'driver_type').readings = {manual: ['woofer', 'midrange']};
    expect(field(convert(rec).openisd, 'driver_type')).toEqual({value: ['woofer', 'midrange']});
  });

  it('a list field in a bare envelope (data_sources): the candidate is the value', () => {
    const rec = record();
    rec.manual_candidates = {data_sources: {manufacturer_datasheet: 'https://example.test/ds.pdf'}};
    expect(field(convert(rec).openisd, 'data_sources')).toEqual({value: {manufacturer_datasheet: 'https://example.test/ds.pdf'}});
  });

  it('without a candidate nothing changes', () => {
    const a = convert(record());
    const rec = record();
    rec.manual_candidates = {};
    const b = convert(rec);
    expect(b.openisdText).toBe(a.openisdText);
    expect(b.wdr).toBe(a.wdr);
  });
});
