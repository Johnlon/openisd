import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';

const scraped = <T,>(value: T) => ({value});
const spec = (read_value: number) => ({state: 'E' as const, value: read_value, origin: 'scraped', readings: {scraped: {read_value}}});

function driver(extra: Record<string, unknown>): OpenISDDriver {
  const record = {
    uuid: {value: '00000000-0000-4000-8000-000000000000'},
    manufacturer: scraped('Tang Band'), brand: scraped('Tang Band'), model: scraped('W5-1138SMF'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: {value: 'X', grounds: [{origin: 'manufacturer_datasheet', reading: 'X'}]},
    driver_type: scraped(['woofer']),
    data_sources: {value: {manufacturer_datasheet: 'https://example.invalid/ds.pdf'}},
    quality: {confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []},
    specs: {woofer: {Fs_hz: spec(30), Qts: spec(0.4), Sd_m2: spec(0.02), Cms_m_per_N: spec(0.0005), Mms_kg: spec(0.05), Rms_kg_per_s: spec(2), Xmax_m: spec(0.008), ...extra}},
  };
  const d = OpenISDDriver.fromConformingRecord(record, createEngine());
  if (Array.isArray(d)) throw new Error(d.join(', '));
  return d;
}

describe('OpenISDDriver.reportedSpecReadings', () => {
  it('is empty for a field with no entry or a usable value', () => {
    const d = driver({});
    expect(d.reportedSpecReadings('Le_H')).toEqual([]);
    expect(d.reportedSpecReadings('Fs_hz')).toEqual([]);
  });

  it('gives the source text of each reading, from actual_reading or read_value, skipping empty ones', () => {
    const d = driver({
      Le_H: {state: 'N', readings: {
        a: {actual_reading: 'N/A', rejected: 'unparsable'},
        b: {read_value: 12},
        c: {actual_reading: '', rejected: 'unparsable'},
        d: {rejected: 'unparsable'},
      }},
    });
    expect(d.reportedSpecReadings('Le_H')).toEqual([{source: 'a', text: 'N/A'}, {source: 'b', text: '12'}]);
  });
});
