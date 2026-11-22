/**
 * Shared conforming-record fixtures — the structural plumbing of a driver or passive-radiator
 * record, so a scenario can hand the fields that matter to it in one line.
 *
 * `spec` is keyed by SCHEMA name (`Fs_hz`, `Vas_m3`, …) — the field table `driver.yml` itself
 * uses — and the keys pass through UNTOUCHED into the record's spec section: no canonicalisation
 * exists here, because none is wanted (a short key would be a misspelling the strict schema
 * refuses).
 */
import {type Engine} from '@openisd/design/engine';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {OpenISDPassiveRadiatorStandalone} from '../../domain/passiveRadiator/openISDPassiveRadiatorStandalone.js';
import {VoiceCoilWiring} from '../../domain/voiceCoilWiring.js';
import {CURRENT_SCHEMA_VERSION} from '../../domain/schemaVersion.js';
const scraped = <T,>(value: T) => ({ value });

/** A conforming driver record. Structural plumbing only — every meaningful value is passed in
 *  by the scenario that depends on it.
 *
 *  The spec takes `number | VoiceCoilWiring` because a driver record is not all numbers: `VCCon`
 *  carries a wiring NAME. Typing this bag as `Record<string, number>` is what let the fixtures
 *  write the numbers 1 and 2 for the wiring and still compile, which kept eight tests green while
 *  the series path was unreachable.
 *
 *  `VCCon` is stored as the wiring's name, as the record and the scraper's reading hold it
 *  (QO914, #514). */
export function driverFromSpec(engine: Engine, spec: Record<string, number | VoiceCoilWiring>): OpenISDDriver {
  const woofer: Record<string, { state: 'E'; value: number | VoiceCoilWiring; origin: string; readings: Record<string, { read_value: number | VoiceCoilWiring }> }> = {};
  for (const [k, v] of Object.entries(spec)) {
    woofer[k] = { state: 'E', value: v, origin: 'scraped', readings: { scraped: { read_value: v } } };
  }
  const result = OpenISDDriver.fromConformingRecord({
    // The spec is stated as published: a current-version record (QO900 R1).
    schemaVersion: CURRENT_SCHEMA_VERSION,
    brand: scraped('Dayton'), model: scraped('RS225'), manufacturer: scraped('Dayton'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    // The scrape provenance every openisd.yml record carries (`model_openisd.py:55-73`). A
    // fixture without them is not a record, and the conformance guard says so.
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    // `sku` is a DERIVED field: no origin, but `grounds` carrying the evidence it was
    // derived from, at least one entry.
    sku: { value: 'TEST-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-SKU' }] },
    driver_type: scraped(['woofer']),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: { woofer },
  }, engine);
  if (Array.isArray(result)) throw new Error(`fixture is not a valid driver: ${result.join(', ')}`);
  return result;
}

/** A conforming passive-radiator record, same structural plumbing as `driverFromSpec()` but under
 *  the `passive-radiator` section `conformingRecordToPassiveRadiator()` requires. */
export function radiatorFromSpec(engine: Engine, spec: Record<string, number>): OpenISDPassiveRadiatorStandalone {
  const pr: Record<string, { state: 'E'; value: number; origin: string; readings: Record<string, { read_value: number }> }> = {};
  for (const [k, v] of Object.entries(spec)) {
    pr[k] = { state: 'E', value: v, origin: 'scraped', readings: { scraped: { read_value: v } } };
  }
  const result = OpenISDPassiveRadiatorStandalone.fromConformingRecord({
    brand: scraped('SB Acoustics'), model: scraped('SB23PACS'), manufacturer: scraped('SB Acoustics'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    uuid: { value: '00000000-0000-4000-8000-000000000001' },
    sku: { value: 'TEST-PR-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-PR-SKU' }] },
    driver_type: scraped(['passive-radiator']),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/pr.pdf' } },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: { 'passive-radiator': pr },
  });
  if (Array.isArray(result)) throw new Error(`fixture is not a valid radiator: ${result.join(', ')}`);
  return result;
}