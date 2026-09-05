/**
 * `OpenISDDriver` is a SUPERSET of a `.wdr` — ARCHITECTURE.md §"The same rule binds the DRIVER".
 *
 * OpenISD is WinISD-compatible AND MORE. That is a REQUIREMENT on the model, not an observation
 * about it, so every field a `.wdr` can carry has a home in the OpenISD model. A `.wdr` key with
 * nowhere to go is a hole in the model — this test is what makes the hole visible, by round-
 * tripping every key WinISD writes through the real public seam
 * (`conformingRecordToDriver` / `openIsdDriverToWinIsdDriver`) rather than reaching into the
 * mapping table's own internals.
 *
 * There are no exemptions, and `c` (speed of sound) and `roo` (air density) are why the rule
 * needs saying. They look like environment constants, so they look exemptable — but WinISD
 * offers both for EDITING on the driver and saves what you type, which makes them driver
 * fields whatever they describe. The `.wpr` agrees: in
 * `docs/winisd_screenshots/sample_project_Epique15_-_pr.wpr` they appear at lines 53-54, INSIDE the
 * `[Driver]` section, not in any project-level one.
 *
 * `c`/`roo` are not special-cased anywhere in the model or the writer — they resolve through the
 * exact same entered-or-computed path (`driver.spec[section].c_m_per_s`/`.roo_kg_per_m3`) as
 * every other derivable field, filled once, in `@openisd/design/engine`'s
 * `solveConsistencyGroup`, the ONE place any value is computed.
 *
 * An exemption list is how coverage gets quietly narrowed — park the inconvenient key and the
 * gate goes green over a field still being destroyed. There is no list here.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { INI_ROWS } from '../../winisd/winisdDriver.js';
import { conformingRecordToDriver } from '@openisd/design';
import { Engine } from '@openisd/design/engine';
import { openIsdDriverToWinIsdDriver } from '../../winisd/driverYmlToOpenisdAndWdr.js';

const scraped = <T,>(value: T) => ({ value });
const spec = (read_value: number) => ({ origin: 'manual', readings: { manual: { read_value } } });

// `VCCon` is a `'series'`/`'parallel'` string field and `numVC` coerces to an integer 1..4 — the
// only two `INI_ROWS` keys that cannot take the same distinct-numeric-value literal every other
// key uses in the round-trip check below.
const NON_NUMERIC_KEYS = ['VCCon', 'numVC'];

function recordWithEveryKeyEntered(): { record: object; expected: Map<string, string> } {
  const woofer: Record<string, unknown> = {};
  const expected = new Map<string, string>();
  let i = 0;
  for (const key of INI_ROWS) {
    if (NON_NUMERIC_KEYS.includes(key)) continue;
    const value = 100 + i;
    woofer[key] = spec(value);
    expected.set(key, String(value));
    i += 1;
  }
  woofer.VCCon = spec(2);
  expected.set('VCCon', '2');
  woofer.numVC = spec(2);
  expected.set('numVC', '2');

  const record = {
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    manufacturer: scraped('Acme'), brand: scraped('Acme'), model: scraped('Widget'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: { value: 'ACME-WIDGET', grounds: [{ origin: 'manufacturer_datasheet', reading: 'ACME-WIDGET' }] },
    driver_type: scraped('woofer'),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
    authoritative: { value: 'manufacturer_datasheet' },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: { woofer },
  };
  return { record, expected };
}

describe('every .wdr field has a home in the OpenISD model', () => {
  it('the key list is real and non-trivial', () => {
    assert.ok(INI_ROWS.length > 40,
      `expected WinISD's full numeric key set, got ${INI_ROWS.length}`);
  });

  it('no .wdr key is unplaceable — every stated value round-trips through the record', () => {
    // Every key stated ENTERED, each with a distinct value, so a key that silently lost its home
    // comes back not-available or 0, not the value set here. No key is excluded from the
    // equality check — c and roo included — because neither is special-cased anywhere in the
    // entered-value path.
    const { record, expected } = recordWithEveryKeyEntered();
    const driver = conformingRecordToDriver(record, new Engine());
    if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);

    const wdr = openIsdDriverToWinIsdDriver(driver, new Engine(), []);
    const homeless = INI_ROWS.filter(k => wdr.cell(k).value !== expected.get(k));

    assert.deepEqual(homeless, [],
      'OpenISD is WinISD-compatible AND MORE, so a .wdr key with nowhere to go is a hole in ' +
      'the model — not a field to skip. See ' +
      'bugs/BUG_20260816_cycling_a_wdr_through_openisd_destroys_15_entered_winisd_fields.md ' +
      'and ledger QO48 for which part of the model each one belongs to.');
  });

  it('there is no exemption list — c and roo specifically are covered, not silently parked', () => {
    // c (speed of sound) and roo (air density) are the case a future edit is most likely to
    // "helpfully" exempt: they look like environment constants. They are not exemptable —
    // WinISD offers both for EDITING on the driver and saves what you type, which makes them
    // driver fields whatever they describe (docs/winisd_screenshots/sample_project_Epique15_-_pr.wpr lines
    // 53-54: both appear INSIDE the [Driver] section, not any project-level one).
    // Deliberately NOT plausible physics — this is a round-trip-fidelity probe, not a
    // physical-correctness check. An obviously-synthetic number makes it unambiguous to a
    // reader that the value itself carries no meaning; only "survives unchanged" does.
    const record = {
      uuid: { value: '00000000-0000-4000-8000-000000000000' },
      manufacturer: scraped('Acme'), brand: scraped('Acme'), model: scraped('Widget'),
      provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
      sku: { value: 'ACME-WIDGET', grounds: [{ origin: 'manufacturer_datasheet', reading: 'ACME-WIDGET' }] },
      driver_type: scraped('woofer'),
      data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
      authoritative: { value: 'manufacturer_datasheet' },
      quality: {
        confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      specs: { woofer: { c: spec(111111), roo: spec(222222) } },
    };
    const driver = conformingRecordToDriver(record, new Engine());
    if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);

    const wdr = openIsdDriverToWinIsdDriver(driver, new Engine(), []);
    assert.equal(wdr.cell('c').state, 'entered', 'a record stating c must round-trip as entered');
    assert.equal(wdr.cell('c').value, '111111', "c's stated value must survive the round trip");
    assert.equal(wdr.cell('roo').state, 'entered', 'a record stating roo must round-trip as entered');
    assert.equal(wdr.cell('roo').value, '222222', "roo's stated value must survive the round trip");
  });

  it('c and roo, left unentered, come back live-computed at the reference environment', () => {
    // A record with no c/roo lines — what a scraper-authored openisd.yml looks like.
    // `@openisd/design/engine`'s `solveConsistencyGroup` fills c/roo by computing them live from
    // the CIPM-2007 moist-air model at the reference environment when unset, marked
    // `calculated` — there is no stored constant anywhere (AGENTS.md 'Calculation logic —
    // permission gate' sign-off 2026-08-19). WinISD itself supplies neither value.
    const { c: refC, rho: refRho } = new Engine().airFor({});
    const record = {
      uuid: { value: '00000000-0000-4000-8000-000000000000' },
      manufacturer: scraped('Acme'), brand: scraped('Acme'), model: scraped('Widget'),
      provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
      sku: { value: 'ACME-WIDGET', grounds: [{ origin: 'manufacturer_datasheet', reading: 'ACME-WIDGET' }] },
      driver_type: scraped('woofer'),
      data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
      authoritative: { value: 'manufacturer_datasheet' },
      quality: {
        confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      specs: { woofer: {} },
    };
    const driver = conformingRecordToDriver(record, new Engine());
    if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);

    const wdr = openIsdDriverToWinIsdDriver(driver, new Engine(), []);
    assert.equal(wdr.cell('c').state, 'calculated', 'unentered c must read as calculated, not absent');
    assert.equal(Number(wdr.cell('c').value), refC, "unentered c must default to the live reference-environment speed of sound");
    assert.equal(wdr.cell('roo').state, 'calculated', 'unentered roo must read as calculated, not absent');
    assert.equal(Number(wdr.cell('roo').value), refRho, "unentered roo must default to the live reference-environment air density");
  });

  it('entering then clearing c/roo on the SAME driver: entered value reads back, cleared reverts to the live reference-environment value on the driver itself', () => {
    const { c: refC, rho: refRho } = new Engine().airFor({});
    const record = {
      uuid: { value: '00000000-0000-4000-8000-000000000000' },
      manufacturer: scraped(''), brand: scraped(''), model: scraped(''),
      provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
      sku: { value: '', grounds: [{ origin: 'manufacturer_datasheet', reading: '' }] },
      driver_type: scraped('woofer'),
      data_sources: { value: {} },
      authoritative: { value: 'manual' },
      quality: {
        confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      specs: { woofer: {} },
    };
    const driver = conformingRecordToDriver(record, new Engine());
    if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
    const section = driver.spec[driver.section];

    // ENTER: same object, both fields.
    section.c_m_per_s.set(400);
    section.roo_kg_per_m3.set(1.5);
    assert.deepEqual(section.c_m_per_s.get(), { value: 400, state: 'entered' },
      'c must read back exactly what was just entered, on the same object');
    assert.deepEqual(section.roo_kg_per_m3.get(), { value: 1.5, state: 'entered' },
      'roo must read back exactly what was just entered, on the same object');

    // CLEAR: same object, both fields. The driver's OWN getter reports the calculated air-model
    // default immediately — no export step is needed to see the engine constant.
    section.c_m_per_s.clear();
    section.roo_kg_per_m3.clear();
    assert.deepEqual(section.c_m_per_s.get(), { value: refC, state: 'calculated' },
      'a cleared c reverts to the calculated reference-air default on the driver itself');
    assert.deepEqual(section.roo_kg_per_m3.get(), { value: refRho, state: 'calculated' },
      'a cleared roo reverts to the calculated reference-air default on the driver itself');

    const wdr = openIsdDriverToWinIsdDriver(driver, new Engine(), []);
    assert.equal(wdr.cell('c').state, 'calculated', 'the cleared c carries through to .wdr export as calculated');
    assert.equal(Number(wdr.cell('c').value), refC, "the cleared c's value carries through to .wdr export unchanged");
    assert.equal(wdr.cell('roo').state, 'calculated', 'the cleared roo carries through to .wdr export as calculated');
    assert.equal(Number(wdr.cell('roo').value), refRho, "the cleared roo's value carries through to .wdr export unchanged");
  });
});

describe('every spec field supports get/set/get/clear/get — clear() actually clears, never throws', () => {
  // Regression guard: `clear()` on a driver's spec field used to throw unconditionally
  // ("this section always exists once constructed") even though the field's own getter already
  // treats an absent key as not-available — the throw's justification was contradicted by the
  // three lines of code right above it. Fixed in project.ts; this pins the fix for every
  // numeric spec field plus VCCon, so a future re-add of that throw fails here immediately.
  function freshSection() {
    const record = {
      uuid: { value: '00000000-0000-4000-8000-000000000000' },
      manufacturer: scraped(''), brand: scraped(''), model: scraped(''),
      provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
      sku: { value: '', grounds: [{ origin: 'manufacturer_datasheet', reading: '' }] },
      driver_type: scraped('woofer'),
      data_sources: { value: {} },
      authoritative: { value: 'manual' },
      quality: {
        confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      specs: { woofer: {} },
    };
    const driver = conformingRecordToDriver(record, new Engine());
    if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
    return driver.spec[driver.section];
  }

  // `numVC`, `VCCon`, `c_m_per_s` and `roo_kg_per_m3` are excluded here — all four have a
  // documented calculated default when unset (`numVC`/`VCCon`: `docs/spec/SPEC_ENGINE.md:424`,
  // "numVC=1, VCCon=1"; `c_m_per_s`/`roo_kg_per_m3`: the live air model at reference conditions,
  // `engine/air.ts`'s `airFor`), so "not-available when unset" does not hold for them. Each gets
  // its own test below instead.
  const NUMERIC_FIELD_NAMES = [
    'Fs_hz', 'Re_ohm', 'Le_H', 'fLe_hz', 'KLe_H_sqrtHz', 'Znom_ohm', 'Qts', 'Qes', 'Qms',
    'Vas_m3', 'Sd_m2', 'BL_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'Xmax_m', 'Xlim_m',
    'SPL_dB', 'Pe_W', 'Dd_m', 'EBP_hz', 'Dia_m', 'Vd_m3', 'no', 'SPLmax_dB',
    'SPLmaxLF_dB', 'USPL_dB', 'alfaVC_per_K', 'Rt_K_per_W', 'Ct_J_per_K', 'gamma_m_per_s2_A',
    'Rme_kg_per_s', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s', 'Gloss',
    'Vcd_m', 'Hg_m', 'Hc_m', 'Thick_m', 'Depth_m', 'MagDepth_m', 'Magnet_m', 'Basket_m',
    'Outer_m', 'DVol_m3',
  ] as const;

  for (const [i, name] of NUMERIC_FIELD_NAMES.entries()) {
    it(`${name}: get=not-available, set=allowed, get=new value, clear=allowed, get=not-available`, () => {
      const section = freshSection();
      const field = section[name];
      const testValue = 100 + i;

      assert.deepEqual(field.get(), { value: null, state: 'not-available' },
        `${name} must start not-available on a fresh section`);

      field.set(testValue);
      assert.deepEqual(field.get(), { value: testValue, state: 'entered' },
        `${name} must read back exactly what was just set`);

      field.clear();
      assert.deepEqual(field.get(), { value: null, state: 'not-available' },
        `${name} must revert to not-available after clear() — clear() must not throw`);
    });
  }

  it('numVC: get=calculated default 1, set=allowed, get=new value, clear=allowed, get=calculated default 1', () => {
    const section = freshSection();

    assert.deepEqual(section.numVC.get(), { value: 1, state: 'calculated' },
      "numVC must start at WinISD's own documented default (1) on a fresh section, not absent");

    section.numVC.set(2);
    assert.deepEqual(section.numVC.get(), { value: 2, state: 'entered' },
      'numVC must read back exactly what was just set');

    section.numVC.clear();
    assert.deepEqual(section.numVC.get(), { value: 1, state: 'calculated' },
      'numVC must revert to the calculated default 1 after clear() — clear() must not throw');
  });

  it('VCCon: get=calculated default parallel, set=allowed, get=new value, clear=allowed, get=calculated default parallel', () => {
    const section = freshSection();

    assert.deepEqual(section.VCCon.get(), { value: 'parallel', state: 'calculated' },
      "VCCon must start at WinISD's own documented default (parallel) on a fresh section, not absent");

    section.VCCon.set('series');
    assert.deepEqual(section.VCCon.get(), { value: 'series', state: 'entered' },
      'VCCon must read back exactly what was just set');

    section.VCCon.clear();
    assert.deepEqual(section.VCCon.get(), { value: 'parallel', state: 'calculated' },
      'VCCon must revert to the calculated default parallel after clear() — clear() must not throw');
  });

  it('c_m_per_s: get=calculated air-model default, set=allowed, get=new value, clear=allowed, get=calculated default again', () => {
    const section = freshSection();
    const referenceC = new Engine().airFor({}).c;

    assert.deepEqual(section.c_m_per_s.get(), { value: referenceC, state: 'calculated' },
      'c_m_per_s must start at the live reference-air speed of sound on a fresh section, not absent');

    section.c_m_per_s.set(340);
    assert.deepEqual(section.c_m_per_s.get(), { value: 340, state: 'entered' },
      'c_m_per_s must read back exactly what was just set');

    section.c_m_per_s.clear();
    assert.deepEqual(section.c_m_per_s.get(), { value: referenceC, state: 'calculated' },
      'c_m_per_s must revert to the calculated reference-air default after clear() — clear() must not throw');
  });

  it('roo_kg_per_m3: get=calculated air-model default, set=allowed, get=new value, clear=allowed, get=calculated default again', () => {
    const section = freshSection();
    const referenceRho = new Engine().airFor({}).rho;

    assert.deepEqual(section.roo_kg_per_m3.get(), { value: referenceRho, state: 'calculated' },
      'roo_kg_per_m3 must start at the live reference-air density on a fresh section, not absent');

    section.roo_kg_per_m3.set(1.25);
    assert.deepEqual(section.roo_kg_per_m3.get(), { value: 1.25, state: 'entered' },
      'roo_kg_per_m3 must read back exactly what was just set');

    section.roo_kg_per_m3.clear();
    assert.deepEqual(section.roo_kg_per_m3.get(), { value: referenceRho, state: 'calculated' },
      'roo_kg_per_m3 must revert to the calculated reference-air default after clear() — clear() must not throw');
  });
});
