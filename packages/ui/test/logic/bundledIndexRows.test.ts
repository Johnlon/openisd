/**
 * `bundledIndexRows.ts` — the writer side of the bundled catalogue's indexes
 * (docs/design/BUNDLED_CATALOGUE_API.md "Writer side").
 *
 * `scripts/bundle-drivers.mjs` calls these over each record's domain object to write
 * `drivers-index.json` and `passive-radiators-index.json`. They compose the app's own functions —
 * `displayNameOf`, `chipsOf`, `driverHasDqIssues`, `radiatorHasDqIssues`, `dataSource`, the spec
 * fields — so what the picker lists off the index is what it would have computed from the record.
 * A staleness gate (packages/ui/test/persistence/bundled-index-artifacts.test.ts) holds the rows
 * the bundler wrote against these.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDDriver, OpenISDPassiveRadiatorStandalone} from '@openisd/design';
import {Engine} from '@openisd/design/engine';
import {bundledDriverIndexRowOf, bundledPassiveRadiatorIndexRowOf} from '../../src/logic/bundledIndexRows.js';
import {chipsOf, driverHasDqIssues, radiatorHasDqIssues} from '../../src/logic/driverDisplay.js';

const scraped = <T,>(value: T) => ({ value });
const spec = (read_value: number) => ({ origin: 'manual', readings: { manual: { read_value } } });

const UUID_D = '00000000-0000-4000-8000-00000000000d';
const UUID_P = '00000000-0000-4000-8000-00000000000a';

/** The figures a fixture states. Absent means the record does not state it. */
interface FixtureFields {
  readonly Fs_hz?: number;
  readonly Sd_m2?: number;
  readonly Xmax_m?: number;
  readonly Vd_m3?: number;
  readonly Znom_ohm?: number;
  readonly Qts?: number;
  readonly Qms?: number;
  readonly Vas_m3?: number;
  readonly Mms_kg?: number;
  readonly Cms_m_per_N?: number;
}

/** The record's `data_sources` links a fixture states. */
interface FixtureSources {
  readonly manufacturer_datasheet?: string;
  readonly manufacturer_product_page?: string;
  readonly manufacturer_listing_page?: string;
}

interface DeviceFixture {
  readonly uuid: string;
  readonly brand: string;
  readonly model: string;
  readonly driverType: string;
  readonly section: 'woofer' | 'passive-radiator';
  readonly fields: FixtureFields;
  readonly sources?: FixtureSources;
}

function statedFields(fields: FixtureFields) {
  return {
    ...(fields.Fs_hz !== undefined ? { Fs_hz: spec(fields.Fs_hz) } : {}),
    ...(fields.Sd_m2 !== undefined ? { Sd_m2: spec(fields.Sd_m2) } : {}),
    ...(fields.Xmax_m !== undefined ? { Xmax_m: spec(fields.Xmax_m) } : {}),
    ...(fields.Vd_m3 !== undefined ? { Vd_m3: spec(fields.Vd_m3) } : {}),
    ...(fields.Znom_ohm !== undefined ? { Znom_ohm: spec(fields.Znom_ohm) } : {}),
    ...(fields.Qts !== undefined ? { Qts: spec(fields.Qts) } : {}),
    ...(fields.Qms !== undefined ? { Qms: spec(fields.Qms) } : {}),
    ...(fields.Vas_m3 !== undefined ? { Vas_m3: spec(fields.Vas_m3) } : {}),
    ...(fields.Mms_kg !== undefined ? { Mms_kg: spec(fields.Mms_kg) } : {}),
    ...(fields.Cms_m_per_N !== undefined ? { Cms_m_per_N: spec(fields.Cms_m_per_N) } : {}),
  };
}

function recordOf(p: DeviceFixture) {
  const fields = statedFields(p.fields);
  return {
    uuid: { value: p.uuid },
    manufacturer: scraped(p.brand), brand: scraped(p.brand), model: scraped(p.model),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: { value: '', grounds: [{ origin: 'manufacturer_datasheet', reading: '' }] },
    driver_type: scraped(p.driverType),
    data_sources: { value: p.sources ?? {} },
    authoritative: { value: 'manual' },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: { [p.section]: fields },
  };
}

function driverOf(fields: FixtureFields, sources?: FixtureSources): OpenISDDriver {
  const d = OpenISDDriver.fromConformingRecord(
    recordOf({ uuid: UUID_D, brand: 'Tang Band', model: 'W5-1138SMF', driverType: 'woofer', section: 'woofer', fields, sources }),
    new Engine());
  if (Array.isArray(d)) throw new Error(`fixture is not a valid driver: ${d.join(', ')}`);
  return d;
}

function radiatorOf(fields: FixtureFields, sources?: FixtureSources): OpenISDPassiveRadiatorStandalone {
  const r = OpenISDPassiveRadiatorStandalone.fromConformingRecord(
    recordOf({ uuid: UUID_P, brand: 'Dayton Audio', model: 'ND140-PR', driverType: 'passive-radiator', section: 'passive-radiator', fields, sources }),
    new Engine());
  if (Array.isArray(r)) throw new Error(`fixture is not a valid radiator: ${r.join(', ')}`);
  return r;
}

describe('bundledDriverIndexRowOf', () => {
  it('carries identity, name, links and the searchable figures, computed by the app\'s own functions', () => {
    const d = driverOf(
      { Fs_hz: 45, Sd_m2: 0.0075, Xmax_m: 0.0093, Znom_ohm: 4, Qts: 0.5, Vas_m3: 0.006 },
      { manufacturer_datasheet: 'https://example.test/w5.pdf', manufacturer_product_page: 'https://example.test/w5' });
    const row = bundledDriverIndexRowOf(d, 'tang-band/w5-1138smf/openisd.yml');

    assert.equal(row.uuid, UUID_D);
    assert.equal(row.path, 'tang-band/w5-1138smf/openisd.yml');
    assert.equal(row.name, 'Tang Band W5-1138SMF');
    assert.equal(row.datasheet, 'https://example.test/w5.pdf');
    assert.equal(row.productPage, 'https://example.test/w5');
    assert.equal(row.listingPage, null);
    assert.deepEqual(row.chips, chipsOf(d).types);
    assert.equal(row.canonical, chipsOf(d).canonical);
    assert.equal(row.Fs_hz, 45);
    assert.equal(row.Sd_m2, 0.0075);
    assert.equal(row.Xmax_m, 0.0093);
    assert.equal(row.Znom_ohm, 4);
    assert.equal(row.dq, driverHasDqIssues(d));
    assert.equal(row.dq, false);
  });

  it('a figure the record does not state and the solver cannot derive is null, not 0 or undefined', () => {
    const row = bundledDriverIndexRowOf(driverOf({}), 'a/b/openisd.yml');
    assert.equal(row.Fs_hz, null);
    assert.equal(row.Sd_m2, null);
    assert.equal(row.Xmax_m, null);
    assert.equal(row.Vd_m3, null);
    assert.equal(row.Znom_ohm, null);
    assert.equal(row.dq, true);
  });

  it('is exactly the declared row — no extra keys leak from the domain object', () => {
    const row = bundledDriverIndexRowOf(driverOf({ Fs_hz: 45 }), 'a/b/openisd.yml');
    assert.deepEqual(Object.keys(row).sort(), [
      'Fs_hz', 'Sd_m2', 'Vd_m3', 'Xmax_m', 'Znom_ohm', 'canonical', 'chips', 'datasheet', 'dq',
      'listingPage', 'name', 'path', 'productPage', 'uuid',
    ]);
  });
});

describe('bundledPassiveRadiatorIndexRowOf', () => {
  it('carries identity, name, links and the figures a radiator is picked by', () => {
    const r = radiatorOf(
      { Fs_hz: 44.2, Sd_m2: 0.00866, Mms_kg: 0.0164, Vas_m3: 0.0084, Qms: 4.02, Xmax_m: 0.0064 },
      { manufacturer_product_page: 'https://example.test/nd140-pr' });
    const row = bundledPassiveRadiatorIndexRowOf(r, 'dayton-audio/nd140-pr/openisd.yml');

    assert.equal(row.uuid, UUID_P);
    assert.equal(row.path, 'dayton-audio/nd140-pr/openisd.yml');
    assert.equal(row.name, 'Dayton Audio ND140-PR');
    assert.equal(row.productPage, 'https://example.test/nd140-pr');
    assert.equal(row.datasheet, null);
    assert.equal(row.Fs_hz, 44.2);
    assert.equal(row.Sd_m2, 0.00866);
    assert.equal(row.Mms_kg, 0.0164);
    assert.equal(row.Vas_m3, 0.0084);
    assert.equal(row.Qms, 4.02);
    assert.equal(row.Xmax_m, 0.0064);
    assert.equal(row.dq, radiatorHasDqIssues(r));
    assert.equal(row.dq, false);
  });

  it('is exactly the declared row', () => {
    const row = bundledPassiveRadiatorIndexRowOf(radiatorOf({}), 'a/b/openisd.yml');
    assert.deepEqual(Object.keys(row).sort(), [
      'Cms_m_per_N', 'Fs_hz', 'Mms_kg', 'Qms', 'Sd_m2', 'Vas_m3', 'Vd_m3', 'Xmax_m', 'datasheet', 'dq',
      'listingPage', 'name', 'path', 'productPage', 'uuid',
    ]);
    assert.equal(row.dq, true);
  });
});

describe('radiatorHasDqIssues — the ⚠ flag on a bundled radiator', () => {
  it('is clear when Fs, Sd and a mass or compliance are stated and positive', () => {
    assert.equal(radiatorHasDqIssues(radiatorOf({ Fs_hz: 44, Sd_m2: 0.0087, Mms_kg: 0.016 })), false);
    assert.equal(radiatorHasDqIssues(radiatorOf({ Fs_hz: 44, Sd_m2: 0.0087, Cms_m_per_N: 0.0008 })), false);
  });

  it('is set when Fs or Sd is missing or non-positive', () => {
    assert.equal(radiatorHasDqIssues(radiatorOf({ Sd_m2: 0.0087, Mms_kg: 0.016 })), true);
    assert.equal(radiatorHasDqIssues(radiatorOf({ Fs_hz: 0, Sd_m2: 0.0087, Mms_kg: 0.016 })), true);
    assert.equal(radiatorHasDqIssues(radiatorOf({ Fs_hz: 44, Mms_kg: 0.016 })), true);
  });

  it('is set when neither Mms nor Cms is usable', () => {
    assert.equal(radiatorHasDqIssues(radiatorOf({ Fs_hz: 44, Sd_m2: 0.0087 })), true);
    assert.equal(radiatorHasDqIssues(radiatorOf({ Fs_hz: 44, Sd_m2: 0.0087, Mms_kg: 0 })), true);
  });
});
