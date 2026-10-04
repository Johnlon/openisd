/**
 * `driverDisplay.ts` — display/search logic for one driver: what it is called, and what
 * classification chips it gets. Domain fact (a T/S parameter, a stated `driver_type`) lives on
 * the driver itself; this file's job is turning those facts into UI-facing strings, which is
 * not domain logic.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDDriver, OpenISDPassiveRadiatorStandalone} from '@openisd/design';
import {Chip, DriverType} from '@openisd/design/filter';
import {DRIVER_TYPES} from '../../src/logic/driverBrowsingState.js';
import {createEngine} from '@openisd/design/engine';
import {
    bundledPassiveRadiatorRows,
    chipsOf,
    displayNameOf,
    passiveRadiatorRows
} from '../../src/logic/driverDisplay.js';
import type {BundledPassiveRadiatorIndexRow} from '@openisd/persistence';

const scraped = <T,>(value: T) => ({ value });
const spec = (read_value: number) =>
  ({ state: 'E' as const, value: read_value, origin: 'manual', readings: { manual: { read_value } } });

function driverOf(p: {
  brand: string; model: string; driverType?: string;
  Fs_hz?: number; Sd_m2?: number;
}) {
  const record = {
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    manufacturer: scraped(p.brand), brand: scraped(p.brand), model: scraped(p.model),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: { value: '', grounds: [{ origin: 'manufacturer_datasheet', reading: '' }] },
    driver_type: scraped(p.driverType ?? ''),
    data_sources: { value: {} },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      woofer: {
        ...(p.Fs_hz != null ? { Fs_hz: spec(p.Fs_hz) } : {}),
        ...(p.Sd_m2 != null ? { Sd_m2: spec(p.Sd_m2) } : {}),
      },
    },
  };
  const driver = OpenISDDriver.fromConformingRecord(record, createEngine());
  if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
  return driver;
}

describe('displayNameOf — what a driver is called on screen', () => {
  it('joins brand and model with a space', () => {
    const driver = driverOf({ brand: 'Dayton', model: 'RS225' });
    assert.equal(displayNameOf(driver), 'Dayton RS225');
  });

  it('falls back to "Driver" when both brand and model are empty', () => {
    const driver = driverOf({ brand: '', model: '' });
    assert.equal(displayNameOf(driver), 'Driver');
  });

  it('uses whichever of brand/model is present, alone, when the other is empty', () => {
    const driver = driverOf({ brand: 'Dayton', model: '' });
    assert.equal(displayNameOf(driver), 'Dayton');
  });
});

describe('chipsOf — classification chips for one driver', () => {
  it('a canonical stated driver_type wins outright', () => {
    const driver = driverOf({ brand: 'Dayton', model: 'RS225-8', driverType: 'woofer' });
    const { canonical } = chipsOf(driver);
    assert.equal(canonical, 'Woofer');
  });

  it('falls back to the name when driver_type is not a canonical value', () => {
    const driver = driverOf({ brand: 'Dayton', model: 'DT-25 Tweeter' });
    const { canonical } = chipsOf(driver);
    assert.equal(canonical, 'Tweeter');
  });

  it('falls back to T/S parameters when neither driver_type nor the name resolves it', () => {
    const driver = driverOf({ brand: 'Acme', model: 'X1', Fs_hz: 30, Sd_m2: 0.001 });
    const { canonical } = chipsOf(driver);
    // Sd in cm² < 12 resolves to Tweeter by the T/S fallback (Sd = 0.001 m² = 10 cm²).
    assert.equal(canonical, 'Tweeter');
  });
});

describe('passiveRadiatorRows — the PR browser row view model', () => {
  const prRecord = (p: { brand: string; model: string; Sd_m2?: number; Mms_kg?: number; Cms_m_per_N?: number }) => ({
    uuid: { value: '00000000-0000-4000-8000-00000000000a' },
    manufacturer: scraped(p.brand), brand: scraped(p.brand), model: scraped(p.model),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: { value: '', grounds: [{ origin: 'manufacturer_datasheet', reading: '' }] },
    driver_type: scraped('passive-radiator'),
    data_sources: { value: {} },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      'passive-radiator': {
        ...(p.Sd_m2 != null ? { Sd_m2: spec(p.Sd_m2) } : {}),
        ...(p.Mms_kg != null ? { Mms_kg: spec(p.Mms_kg) } : {}),
        ...(p.Cms_m_per_N != null ? { Cms_m_per_N: spec(p.Cms_m_per_N) } : {}),
      },
    },
  });

  const radiatorOf = (p: { brand: string; model: string; Sd_m2?: number; Mms_kg?: number; Cms_m_per_N?: number }) => {
    const pr = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prRecord(p));
    if (Array.isArray(pr)) throw new Error(`fixture is not a valid radiator: ${pr.join(', ')}`);
    return pr;
  };

  it('names each row by its id, so a component can emit the id and never the radiator', () => {
    const rows = passiveRadiatorRows([
      { id: 'aaaa-1', radiator: radiatorOf({ brand: 'SB Acoustics', model: 'SB23PACS' }) },
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'aaaa-1');
    assert.equal(rows[0].name, 'SB Acoustics SB23PACS');
  });

  it('a bundled index row renders the same row a domain object does, keyed by the record uuid', () => {
    const radiator = radiatorOf({ brand: 'Dayton Audio', model: 'ND140-PR', Sd_m2: 0.00866, Mms_kg: 0.0164 });
    const indexRow: BundledPassiveRadiatorIndexRow = {
      uuid: '00000000-0000-4000-8000-00000000000a', path: 'dayton-audio/nd140-pr', name: 'Dayton Audio ND140-PR',
      dq: true, datasheet: null, productPage: null, listingPage: null,
      Fs_hz: null, Sd_m2: 0.00866, Xmax_m: null, Vd_m3: null, Mms_kg: 0.0164, Cms_m_per_N: null, Vas_m3: null, Qms: null,
    };
    const fromObject = passiveRadiatorRows([{ id: '00000000-0000-4000-8000-00000000000a', radiator }]);
    const fromIndex = bundledPassiveRadiatorRows([indexRow]);
    assert.deepEqual(fromIndex, fromObject);
    assert.equal(fromIndex[0].id, indexRow.uuid);
    assert.equal(fromIndex[0].dq, true);
  });

  it('formats the three summary numbers the row tooltip quotes', () => {
    const rows = passiveRadiatorRows([
      { id: 'aaaa-1', radiator: radiatorOf({ brand: 'SB', model: 'PR', Sd_m2: 0.025, Mms_kg: 0.06, Cms_m_per_N: 0.0011 }) },
    ]);

    assert.equal(rows[0].sd, '250.00cm²');
    assert.equal(rows[0].mms, '60.00g');
    assert.equal(rows[0].cms, '1.1000mm/N');
  });

  it('shows an em dash for a number the radiator does not state', () => {
    // A datasheet routinely publishes Sd/Cms and leaves Mms blank.
    const rows = passiveRadiatorRows([
      { id: 'aaaa-1', radiator: radiatorOf({ brand: 'SB', model: 'PR', Sd_m2: 0.025 }) },
    ]);

    assert.equal(rows[0].sd, '250.00cm²');
    assert.equal(rows[0].mms, '—');
  });

  it('carries no domain object on the row, so the row can cross a component boundary', () => {
    const rows = passiveRadiatorRows([
      { id: 'aaaa-1', radiator: radiatorOf({ brand: 'SB', model: 'PR' }) },
    ]);

    // Primitives only — a string or the dq boolean. An object or a function on the row would be
    // the radiator (or a window onto it) leaking across the component boundary.
    for (const value of Object.values(rows[0])) {
      assert.ok(typeof value === 'string' || typeof value === 'boolean', `row field is a ${typeof value}, not a primitive`);
    }
  });
});

/**
 * Filter parity for the `driver_type` wire contract. winisd_tools' `test_driver_type_enum_parity.py`
 * proves the two enums hold the same VALUES; that says nothing about whether the UI can filter on
 * each value. A member can exist in both enums and still fall through `chipsOf()` to the name/T-S
 * heuristics, as `passive-radiator`, `amt` and `mid-woofer` did. Every DriverType member must
 * yield chips, and every chip it yields must be one the filter bar renders.
 */
const CHIP_VALUES = new Set(Chip.ALL.map(c => c.value));
const chipValues = (dt: DriverType) => dt.chips.map(c => c.value);

describe('driver_type -> chip projection (enum, no driver)', () => {
  it('reflects every declared member into ALL', () => {
    // ALL is built by reflection, so a member declared after it would be missed.
    const declared = Object.values(DriverType).filter(v => v instanceof DriverType);
    assert.equal(DriverType.ALL.length, declared.length,
      'DriverType.ALL is not the full member set — is it still the LAST static field?');
    assert.equal(Chip.ALL.length, Object.values(Chip).filter(v => v instanceof Chip).length,
      'Chip.ALL is not the full member set — is it still the LAST static field?');
  });

  it('maps every DriverType member to chips the filter bar renders', () => {
    for (const dt of DriverType.ALL) {
      for (const c of dt.chips) {
        assert.ok(CHIP_VALUES.has(c.value), `DriverType.${dt.value} maps to unknown chip "${c.value}"`);
        assert.ok(Chip.ALL.includes(c), `DriverType.${dt.value} maps to a non-member Chip "${c.value}"`);
      }
    }
    assert.deepEqual(DRIVER_TYPES, Chip.ALL, 'the filter bar renders something other than the Chip enum');
  });

  it('gives every member except unclassified a non-empty chip collection', () => {
    for (const dt of DriverType.ALL) {
      if (dt === DriverType.Unclassified) continue;
      assert.ok(dt.chips.length > 0,
        `DriverType.${dt.value} projects to NO chips — it can never be filtered for`);
    }
  });

  it('never emits the derived `unclassified` chip', () => {
    // A driver is unclassified when its chip collection is EMPTY (isUnclassified in
    // useDriverLibrary). Emitting the chip as well would double-count it.
    for (const dt of DriverType.ALL) {
      assert.ok(!dt.chips.includes(Chip.Unclassified),
        `DriverType.${dt.value} emits the derived Unclassified chip`);
    }
  });

  it('gives every member a display label and every chip a label and tooltip', () => {
    for (const dt of DriverType.ALL) assert.ok(dt.display.length, `DriverType.${dt.value} has no display label`);
    for (const c of Chip.ALL) {
      assert.ok(c.label.length, `Chip.${c.value} has no label`);
      assert.ok(c.title.length, `Chip.${c.value} has no tooltip`);
    }
  });

  it('serialises members to their wire value', () => {
    assert.equal(String(DriverType.PassiveRadiator), 'passive-radiator');
    assert.equal(JSON.stringify(DriverType.MidWoofer), '"mid-woofer"');
    assert.equal(String(Chip.FullRange), 'fullrange');
  });
});

/** A driver stating only brand/model/driver_type — no T/S values — matching what these tests
 *  need: chipsOf() falling through driver_type -> name -> T/S, in that order. */
function driverOfType(name: string, driverType: string): OpenISDDriver {
  const record = {
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    manufacturer: scraped(''), brand: scraped(''), model: scraped(name),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: { value: '', grounds: [{ origin: 'manufacturer_datasheet', reading: '' }] },
    driver_type: scraped(driverType),
    data_sources: { value: {} },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: { woofer: {} },
  };
  const driver = OpenISDDriver.fromConformingRecord(record, createEngine());
  if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
  return driver;
}

describe('chipsOf honours every canonical driver_type (wire value -> chips)', () => {
  it('classifies each member from its wire value alone, with no name or T/S help', () => {
    for (const dt of DriverType.ALL) {
      if (dt === DriverType.Unclassified) continue;
      const got = chipsOf(driverOfType('', dt.value));
      assert.deepEqual([...got.types].sort(), [...chipValues(dt)].sort(),
        `driver_type "${dt.value}" did not classify from its wire value — the projection has drifted from the enum`);
      assert.equal(got.canonical, dt.display);
    }
  });

  it('round-trips every member through parse', () => {
    for (const dt of DriverType.ALL) assert.equal(DriverType.parse(dt.value), dt);
  });

  it('takes the leading token of a compound value and ignores qualifiers', () => {
    const got = chipsOf(driverOfType('', `${DriverType.Subwoofer.value}, automotive`));
    assert.deepEqual([...got.types].sort(), [...chipValues(DriverType.Subwoofer)].sort());
  });

  it('falls back to the name when driver_type is absent or not canonical', () => {
    // 'fullrange' is NOT a DriverType value ('full-range' is) — an off-contract
    // record must not classify off it; the name is what carries it.
    assert.equal(DriverType.parse('fullrange'), null);
    assert.equal(chipsOf(driverOfType('', 'fullrange')).types.length, 0);
    assert.ok(chipsOf(driverOfType('Tang Band W5-1880 5in fullrange', 'fullrange'))
      .types.includes(Chip.FullRange.value));
  });

  it('reports unclassified as an empty chip collection', () => {
    assert.deepEqual(chipsOf(driverOfType('', DriverType.Unclassified.value)).types, []);
    assert.deepEqual(chipsOf(driverOfType('', '')).types, []);
  });
});

