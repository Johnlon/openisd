/** Valid saved records, as My Drivers / My Passive Radiators hold them. */
import {OpenISDDriver, OpenISDDriverStandalone, OpenISDPassiveRadiatorStandalone} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';

const engine = createEngine();

const scraped = <T,>(value: T) => ({ value });
const spec = (read_value: number) =>
  ({ state: 'E' as const, value: read_value, origin: 'scraped', readings: { scraped: { read_value } } });

export function driverRecord() {
  return {
    brand: scraped('Dayton'), model: scraped('RS225'), manufacturer: scraped('Dayton'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    sku: { value: 'TEST-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-SKU' }] },
    driver_type: scraped(['woofer']),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      woofer: {
        Fs_hz: spec(30), Qts: spec(0.4), Sd_m2: spec(0.02), Cms_m_per_N: spec(0.0005),
        Mms_kg: spec(0.05), Rms_kg_per_s: spec(2), Xmax_m: spec(0.008),
      },
    },
  };
}

export function aDriver(): OpenISDDriverStandalone {
  const d = OpenISDDriver.fromConformingRecord(driverRecord(), engine);
  if (Array.isArray(d)) throw new Error('fixture driver must conform: ' + d.join('; '));
  return d;
}


function passiveRadiatorRecord() {
  return {
    brand: scraped('Dayton'), model: scraped('DSA175-PR'), manufacturer: scraped('Dayton'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    uuid: { value: '00000000-0000-4000-8000-000000000001' },
    sku: { value: 'TEST-PR-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-PR-SKU' }] },
    driver_type: scraped(['passive-radiator']),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/pr.pdf' } },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      'passive-radiator': {
        Fs_hz: spec(20), Sd_m2: spec(0.014), Cms_m_per_N: spec(0.0011),
        Mms_kg: spec(0.06), Rms_kg_per_s: spec(1.5), Xmax_m: spec(0.012),
      },
    },
  };
}

export function aRadiator(): OpenISDPassiveRadiatorStandalone {
  const pr = OpenISDPassiveRadiatorStandalone.fromConformingRecord(passiveRadiatorRecord());
  if (Array.isArray(pr)) throw new Error('fixture radiator must conform: ' + pr.join('; '));
  return pr;
}

