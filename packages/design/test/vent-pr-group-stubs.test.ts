import { describe, it, expect } from 'vitest';
import { Engine } from '@openisd/design/engine';
import { OpenISDProject, OpenISDDriver } from '../domain/index.js';

// This test is the package's PROXY CONSUMER: it imports from `index.js` only.
const scraped = <T,>(value: T) => ({ value });
const spec = (read_value: number) =>
  ({ origin: 'scraped', readings: { scraped: { read_value } } });

function ventedProject() {
  const record = {
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    manufacturer: scraped('Dayton'), brand: scraped('Dayton'), model: scraped('RS225'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: { value: 'TEST-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-SKU' }] },
    driver_type: scraped('woofer'),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
    authoritative: { value: 'manufacturer_datasheet' },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      woofer: {
        Fs: spec(30), Qts: spec(0.4), Sd: spec(0.02), Cms: spec(0.0005),
        Mms: spec(0.05), Rms: spec(2), Xmax: spec(0.008),
      },
    },
  };
  const driver = OpenISDDriver.fromConformingRecord(record, new Engine());
  if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
  return OpenISDProject.builder(driver, new Engine()).vented().volume_m3(0.03).tuning_hz(35).build();
}

describe('vent-group solve/reachability — stubbed, not yet implemented', () => {
  it('solveVentGroup() is not yet implemented', () => {
    expect(() => ventedProject().solveVentGroup()).toThrow(/not implemented/);
  });

  it('ventAchievedFb() is not yet implemented', () => {
    expect(() => ventedProject().ventAchievedFb()).toThrow(/not implemented/);
  });

  it('ventMaxReachableFb() is not yet implemented', () => {
    expect(() => ventedProject().ventMaxReachableFb()).toThrow(/not implemented/);
  });

  it('ventTargetUnreachable() is not yet implemented', () => {
    expect(() => ventedProject().ventTargetUnreachable()).toThrow(/not implemented/);
  });
});

describe('PR-group solve/reachability — stubbed, not yet implemented', () => {
  it('solvePrGroup() is not yet implemented', () => {
    expect(() => ventedProject().solvePrGroup()).toThrow(/not implemented/);
  });

  it('prTargetUnreachable() is not yet implemented', () => {
    expect(() => ventedProject().prTargetUnreachable()).toThrow(/not implemented/);
  });
});
