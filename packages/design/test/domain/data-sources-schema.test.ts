/**
 * `data_sources` names where a record's values came from. When the maker publishes no datasheet,
 * the scraper falls back to a distributor's copies (Parts Express for Dayton), and the record says
 * so with the distributor roles `sourceRank` already ranks. A record naming them must load
 * (QO282, John 2026-10-19: "of course we use ... any alternative source ... as backup").
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {openISDDeviceJsonSchema} from '../../domain/openisdSchema.js';
import {DriverRecordConverter} from '../../domain/driverRecordConverter.js';
import {createEngine} from '../../engine/Engine.js';

// A REAL corpus record, copied from `winisd_drivers/db/datasheets/dayton-audio/cfc100-4/driver.json`
// (20 Oct 2026): its data_sources name the Parts Express spec sheet and product page.
const CFC100 = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'corpus', 'dayton-cfc100-4.distributor.driver.json');

function record(dataSources: Record<string, string>): unknown {
  return {
    uuid: {value: '00000000-0000-4000-8000-000000000009'},
    quality: {confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []},
    manufacturer: {value: 'Dayton'}, brand: {value: 'Dayton'}, model: {value: 'CFC100-4'},
    sku: {value: 'CFC100-4', grounds: [{origin: 'distributor_datasheet', reading: 'CFC100-4'}]},
    driver_type: {value: ['woofer']},
    data_sources: {value: dataSources},
    specs: {woofer: {Fs_hz: {state: 'E', value: 30, origin: 'distributor_datasheet', readings: {distributor_datasheet: {read_value: 30}}}}},
  };
}

const problemsOf = (dataSources: Record<string, string>): string[] => {
  const r = openISDDeviceJsonSchema.safeParse(record(dataSources));
  return r.success ? [] : r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
};

describe('openISDDeviceJsonSchema.data_sources — maker and distributor documents', () => {
  it('accepts the distributor datasheet, product page and listing page', () => {
    assert.deepEqual(problemsOf({
      distributor_datasheet: 'https://example.invalid/ds.pdf',
      distributor_product_page: 'https://example.invalid/p',
      distributor_listing_page: 'https://example.invalid/l',
    }), []);
  });

  it('still refuses a role nobody defined', () => {
    assert.ok(problemsOf({made_up_page: 'https://example.invalid/x'}).length > 0);
  });
});

describe('a real distributor-sourced driver file converts (the projection the driver db runs)', () => {
  it('Dayton CFC100-4 (Parts Express sources) converts with no error, and its Fs of 94 Hz reaches the .wdr', () => {
    const result = new DriverRecordConverter(createEngine()).driverYmlToOpenisdAndWdr(readFileSync(CFC100, 'utf8'));
    assert.deepEqual(result.errors.filter(e => e.level === 'error'), []);
    assert.ok(result.openisd?.includes('https://www.parts-express.com/pedocs/specs/295-601--dayton-audio-cfc100-4-specification-sheet.pdf'));
    assert.match(result.wdr ?? '', /^Fs=94$/m);
  });
});
