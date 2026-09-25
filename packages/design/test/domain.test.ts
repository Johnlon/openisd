import {describe, expect, it, vi} from 'vitest';
import {type DqIssue, type DriverError, type DriverIssue, Engine, LossMode, DEFAULT_VENTED_DESIGN_LIMITS} from '@openisd/design/engine';
import {
    type AppContext,
    OpenISDDriver,
    OpenISDDriverStandalone,
    OpenISDPassiveRadiatorStandalone,
    OpenISDProject,
    VoiceCoilWiring
} from '../domain/index.js';

/** A deterministic `AppContext` for tests that would otherwise depend on a random id or the
 *  real clock — e.g. a test asserting on serialized JSON content, where a random UUID could by
 *  chance contain the very digits the test is checking for. */
function fixedAppContext(id: string, isoDate = '2026-01-01T00:00:00.000Z', platformUser: string | null = null): AppContext {
  return { newId: () => id, now: () => new Date(isoDate), platformUser: () => platformUser };
}

// This test is the package's PROXY CONSUMER: it imports from `index.js` only, exactly what the
// real app can reach, and nothing internal. Anything it cannot do here, the app cannot do
// either — so a gap in the public surface shows up as a test that cannot be written, rather
// than as a test quietly reaching past the boundary to compensate.
//
// The record shapes are private, so these helpers build plain literals and rely on structural
// compatibility. That the test cannot name those types is the design working.
//
// Structural boilerplate only: every DOMAIN-MEANINGFUL number a test depends on is passed in by
// that test, so an `it()` block reads top to bottom without opening anything else.
const scraped = <T,>(value: T) => ({ value });

/** A distinct, hand-constructible `DqIssue` for fixtures — a target-unreachable issue is the
 *  simplest closed-union member to write out by hand. */
function ignoredIssue(target: string): DqIssue {
  return { kind: 'target-unreachable', target, maxReachable_hz: 0 };
}

/** A cloned record's woofer section, read the way any consumer must: `specs` is a SUM — a
 *  driver's sections or a radiator's — so the woofer is reachable only behind the `in` check.
 *  The record type is derived from the public method, never named. */
function wooferOf(record: ReturnType<OpenISDDriver['cloneDriver']>) {
  const specs = record.specs;
  return 'woofer' in specs ? specs.woofer : undefined;
}

// A SPEC field carries `state`+`value` (T11), with `origin`/`readings` riding beside it as
// provenance. Building fixtures through this is what makes them the shape a real record has.
const spec = (read_value: number) =>
  ({ state: 'E' as const, value: read_value, origin: 'scraped', readings: { scraped: { read_value } } });

function specSection(p: {
  Fs_hz: number; Qts: number; Sd_m2: number; Cms_m_per_N: number;
  Mmd_kg: number; Rms_Ns_per_m: number; Xmax_m: number;
}) {
  // A test names the parameter with its unit, the way the public API does; the RECORD's keys are
  // the suffixed ones the schema's `DriverSpecsSection` states, which is what this literal
  // has to produce.
  return {
    Fs_hz: spec(p.Fs_hz), Qts: spec(p.Qts), Sd_m2: spec(p.Sd_m2), Cms_m_per_N: spec(p.Cms_m_per_N),
    Mms_kg: spec(p.Mmd_kg), Rms_kg_per_s: spec(p.Rms_Ns_per_m), Xmax_m: spec(p.Xmax_m),
  };
}

/** A spec section that states Fs/Sd/Cms/Mms/Xmax, `Qts` only when given, and NEVER `Rms` — the
 *  only mechanical route to Qms (and therefore Qes) `resolve()` has — so this nulls out Qms/Qes
 *  regardless of whether Qts itself is stated, unlike `specSection` which always states Rms. */
function specSectionNoRms(p: {
  Fs_hz: number; Sd_m2: number; Cms_m_per_N: number; Mmd_kg: number; Xmax_m: number; Qts?: number;
}) {
  return {
    Fs_hz: spec(p.Fs_hz), Sd_m2: spec(p.Sd_m2), Cms_m_per_N: spec(p.Cms_m_per_N),
    Mms_kg: spec(p.Mmd_kg), Xmax_m: spec(p.Xmax_m),
    ...(p.Qts !== undefined ? { Qts: spec(p.Qts) } : {}),
  };
}

/** A driver the Tune panel might have produced: Thiele/Small values only, NO `Sd`/`Cms`/`Mms`/
 *  `Rms`/`Xmax`, and no stored `Qts` — the pair `Qes`+`Qms` implies it. This is the golden
 *  scene's shape (`sealed-fsc-winisd-golden.browser.spec.ts`), and a shape the old compliance
 *  feed could not answer at all: `Cms·Sd²·ρc²` needs the fields this record deliberately lacks. */
function tuneSpec(p: {Fs_hz: number; Vas_m3: number; Qes: number; Qms: number; Re_ohm: number}) {
  return {
    Fs_hz: spec(p.Fs_hz), Vas_m3: spec(p.Vas_m3),
    Qes: spec(p.Qes), Qms: spec(p.Qms), Re_ohm: spec(p.Re_ohm),
  };
}

/** A RADIATOR's spec section. Not a narrowed driver's: a radiator has no motor and no voice coil,
 *  so `Qts` describes nothing on one — there is no `Qes` for it to combine with. The strict schema
 *  refuses a `Qts` here, which is how this builder came to exist. */
function prSpecSection(p: {
  Fs_hz: number; Sd_m2: number; Cms_m_per_N: number;
  Mmd_kg: number; Rms_Ns_per_m: number; Xmax_m: number;
}) {
  return {
    Fs_hz: spec(p.Fs_hz), Sd_m2: spec(p.Sd_m2), Cms_m_per_N: spec(p.Cms_m_per_N),
    Mms_kg: spec(p.Mmd_kg), Rms_kg_per_s: spec(p.Rms_Ns_per_m), Xmax_m: spec(p.Xmax_m),
  };
}

/** The client's own boundary step: an untrusted record becomes a driver, or the reasons it
 *  cannot. Tests that expect a VALID record use this; the one that checks refusal calls
 *  `driverFromConformingRecord` directly and inspects the problems. */
// Takes whatever `driverJson` below takes.
function driverFrom(p: Parameters<typeof driverJson>[0]) {
  const result = OpenISDDriver.fromConformingRecord(driverJson(p), new Engine());
  if (Array.isArray(result)) throw new Error(`fixture is not a valid driver: ${result.join(', ')}`);
  return result;
}

function driverJson(p: {
  brand: string; model: string; section: 'woofer' | 'passive-radiator';
  // A driver's own section (`specSection`) or a radiator's (`prSpecSection`, no `Qts`) —
  // whichever matches `section` above.
  spec: ReturnType<typeof specSection> | ReturnType<typeof prSpecSection> | ReturnType<typeof tuneSpec>
    | ReturnType<typeof specSectionNoRms>;
}) {
  const meta = {
    brand: scraped(p.brand), model: scraped(p.model), manufacturer: scraped(p.brand),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    // The scrape provenance every openisd.yml record carries (`model_openisd.py:55-73`). A
    // fixture without them is not a record, and the conformance guard says so.
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    // `sku` is a DERIVED field: no origin, but `grounds` carrying the evidence it was
    // derived from, at least one entry.
    sku: { value: 'TEST-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-SKU' }] },
    driver_type: scraped('woofer'),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
    authoritative: { value: 'manufacturer_datasheet' },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
  };
  if (p.section === 'woofer') return { ...meta, specs: { woofer: p.spec } };
  return { ...meta, specs: { 'passive-radiator': p.spec } };
}

describe('OpenISDDriver.cloneDriver() — the persistence layer\'s one seam onto the raw record', () => {
  it('returns the record the driver holds, readable by a repo without any field access', () => {
    const driver = driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });

    const record = driver.cloneDriver();
    expect(record.brand.value).toBe('Dayton');
    const fs = wooferOf(record)?.Fs_hz;
    if (fs?.state !== 'E') throw new Error('expected an entered Fs_hz entry');
    expect(fs.origin).toBeDefined();
  });

  it('a write to the driver after the call does not retroactively change the returned record', () => {
    const driver = driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });

    const before = driver.cloneDriver();
    driver.specs.Fs_hz.set(99);
    const fsBeforeStr = JSON.stringify(wooferOf(before)?.Fs_hz);
    driver.specs.Fs_hz.set(99);

    // `before` is unmodified by the subsequent set.
    expect(wooferOf(before)?.Fs_hz).toBeDefined();
    expect(JSON.stringify(wooferOf(before)?.Fs_hz)).toBe(fsBeforeStr);
  });
});

describe('OpenISDDriver.issues() — the last resolve()\'s own diagnostic (S2-10: renamed from checkConsistency())', () => {
  it('reports no issues for a driver whose stated Qes/Qms are mutually consistent', () => {
    const driver = driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: tuneSpec({ Fs_hz: 40, Vas_m3: 0.00765, Qes: 0.45, Qms: 2.94, Re_ohm: 6.6 }),
    });
    const issues: readonly DriverIssue[] = driver.issues();
    expect(issues).toEqual([]);
  });

  it('reports an inconsistent-inputs issue when a stated Qts contradicts stated Qes/Qms', () => {
    // A driver stating ONLY Qts/Qes/Qms — deliberately minimal, so no OTHER relation (Fs/Mms/Cms,
    // Rms/Fs/Mms/Qms, ...) can also fire and make this test's one contradiction hard to isolate.
    // The gap is a gross error (32%), not a rounding artifact (D13/D12): Qts=0.4/Qes=0.45/Qms=2.94's
    // ~0.010 disagreement is fully absorbed by their own typed-to-two-decimals precision and, since
    // O2, correctly reports no issue at all — this fixture states a disagreement wide enough to
    // survive that.
    const driver = OpenISDDriver.empty(new Engine());
    driver.specs.Qts.set(0.60);
    driver.specs.Qes.set(0.50);
    driver.specs.Qms.set(4.75);
    // Qts=0.60 was stated directly; Qes/Qms imply ~0.452 — a gross, genuine contradiction.

    const issues = driver.issues();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'inconsistent-inputs', target: 'Qts', actual: 0.60 });
  });

  it('a derived Qts (T11: resolve() writes it back on load) reads back calculated, and issues() ' +
    'still agrees with itself rather than reporting the solved Qts as a contradiction of Qes/Qms', () => {
    const driver = driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: tuneSpec({ Fs_hz: 40, Vas_m3: 0.00765, Qes: 0.45, Qms: 2.94, Re_ohm: 6.6 }),
    });
    // S2-10: there is no longer a separate what-if `solveConsistencyGroup()` — `driverFrom()`'s
    // own `resolve()` (S2-7c, run once on load) already wrote the derived Qts back as 'C'.
    expect(driver.specs.Qts.calculated).toBe(true);
    expect(driver.specs.Qts.value).toBeCloseTo((0.45 * 2.94) / (0.45 + 2.94), 6);
    expect(driver.issues()).toEqual([]);
  });
});

describe('the driver — a window, not a copy', () => {
  it('reads and writes through to the record it was given', () => {
    const driver = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build().driver;

    expect(driver.specs.Fs_hz.value).toBe(30);
    driver.specs.Fs_hz.set(35);
    expect(driver.specs.Fs_hz.value).toBe(35);
    expect(driver.brand.value).toBe('Dayton');
  });

  it('driverType() answers the scraper-stated classification off the record, read-only', () => {
    const driver = driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });

    expect(driver.driverType()).toBe('woofer');
  });

  it('the handle a caller holds survives every layer transition', async () => {
    // The failure this pins: components used to belong to a LAYER, and a write moves which
    // layer is effective — writing to committed opens an edit layer. A caller that bound the
    // handle once (the ordinary shape of UI code) then read stale values from its own first
    // edit onwards, so the write looked lost.
    const project = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build();
    const driver = project.driver;      // bound ONCE, before the edited state exists

    driver.specs.Fs_hz.set(35);               // creates the edited state under the caller's feet
    expect(driver.specs.Fs_hz.value).toBe(35);

    project.save();                     // the edited state is promoted; the handle must follow
    expect(driver.specs.Fs_hz.value).toBe(35);

    driver.specs.Fs_hz.set(40);               // a fresh edited state, again under the caller's feet
    expect(driver.specs.Fs_hz.value).toBe(40);

    await project.cancel(async () => true);   // and back to the saved state
    expect(driver.specs.Fs_hz.value).toBe(35);
  });

  it('what-if edits are transient and cancel preserves ordinary edits', () => {
    const project = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build();

    project.driver.specs.Fs_hz.set(35);
    project.beginWhatIf();
    expect(project.isWhatIfActive()).toBe(true);
    project.driver.specs.Fs_hz.set(40);
    expect(project.driver.specs.Fs_hz.value).toBe(40);

    project.cancelWhatIf();
    expect(project.isWhatIfActive()).toBe(false);
    expect(project.driver.specs.Fs_hz.value).toBe(35);
  });

  it('beginWhatIf() is a no-op once a what-if is already active — the running session is not restarted', () => {
    const project = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build();

    project.beginWhatIf();
    project.driver.specs.Fs_hz.set(40);
    project.beginWhatIf();

    expect(project.driver.specs.Fs_hz.value).toBe(40);
  });

  it('cancelWhatIf()/resetWhatIf() are no-ops when no what-if session is active', () => {
    const project = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build();

    expect(project.isWhatIfActive()).toBe(false);
    expect(() => project.cancelWhatIf()).not.toThrow();
    expect(() => project.resetWhatIf()).not.toThrow();
    expect(project.isWhatIfActive()).toBe(false);
    expect(project.driver.specs.Fs_hz.value).toBe(30);
  });

  it('what-if values are absent from the persisted session', () => {
    // A deterministic id — never randomly generated — removes the one way this test could fail
    // for a reason that has nothing to do with what it is testing: a random UUID happening to
    // contain the digits '40' inside it (the flake this fixture replaces, 2026-09-15).
    const appContext = fixedAppContext('11111111-1111-4111-8111-111111111111');
    const project = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine(), appContext).sealed().volume_m3(0.03).build();

    project.driver.specs.Fs_hz.set(35);
    project.beginWhatIf();
    project.driver.specs.Fs_hz.set(40);

    const session = project.cloneSession();
    // Proves the injected AppContext is actually wired in, not merely accepted and ignored —
    // the real `newUuid()` would never produce this exact string.
    expect(session.edited?.driverEmbedding.device.uuid.value).toBe('11111111-1111-4111-8111-111111111111');

    // Structural, not raw string containment (S2-7d2: the fixture's Fs/Mms/Cms are jointly
    // over-determined, so the cascade now also attaches a formula dq to Fs_hz — a real, separate
    // fact this test is not about; asserting on `state`/`value` alone keeps it that way).
    expect(session.edited && wooferOf(session.edited.driverEmbedding.device)?.Fs_hz).toMatchObject({ state: 'E', value: 35 });
    expect(wooferOf(session.saved.driverEmbedding.device)?.Fs_hz).toMatchObject({ state: 'E', value: 30 });
  });

  it('gives every field a STABLE identity across accesses', () => {
    const driver = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build().driver;

    // Identity must hold, or reference-equality memoization sees every read as a change.
    expect(driver.specs.Fs_hz).toBe(driver.specs.Fs_hz);
    expect(driver.brand).toBe(driver.brand);
  });

  it('makes a blank driver an editor can fill in, stating no specs at all', () => {
    const blank = OpenISDDriver.empty(new Engine());

    // The record's own bookkeeping (uuid, quality, the three name fields) is required by the
    // conformance guard, so a blank record carries empty names rather than absent ones.
    expect(blank.brand.value).toBe('');
    expect(blank.model.value).toBe('');
    // Every SPEC field, by contrast, is genuinely unstated — nothing to render, nothing to solve.
    expect(blank.specs.Fs_hz.value).toBe(null);
    expect(blank.specs.Fs_hz.value).toBeNull();
    expect(blank.specs.Qts.value).toBeNull();
  });

  it('a blank driver accepts edits, and the solver derives from what was stated', () => {
    const blank = OpenISDDriver.empty(new Engine());
    blank.brand.set('Dayton');
    blank.specs.Fs_hz.set(30);

    expect(blank.brand.value).toBe('Dayton');
    expect(blank.specs.Fs_hz.value).toBe(30);
  });

  it('sku accepts edits — a manufacturer\'s part number the editor writes, not scraper-only', () => {
    const blank = OpenISDDriver.empty(new Engine());
    blank.sku.set('W5-1138SMF');

    expect(blank.sku.value).toBe('W5-1138SMF');

    // No clear() — sku is mandatory, schema-guaranteed, with no "not entered" state to clear
    // to. Emptying it is set(''), same as brand/model.
    blank.sku.set('');
    expect(blank.sku.value).toBe('');
  });

  it('gives each blank driver its own record, so editing one leaves the next untouched', () => {
    const engine = new Engine();
    const one = OpenISDDriver.empty(engine);
    const two = OpenISDDriver.empty(engine);
    one.model.set('RS225');

    expect(two.model.value).toBe('');
  });

  it('stamps added from the injected AppContext, and providedBy from the platform user when known', () => {
    const appContext = fixedAppContext('id', '2026-03-04T00:00:00.000Z', 'johnl');
    const blank = OpenISDDriver.empty(new Engine(), appContext);

    expect(blank.added.value).toBe('20260304');
    expect(blank.providedBy.value).toBe('johnl');
  });

  it('pre: providedBy N | trigger: set \'jl\' | post: providedBy \'jl\' E', () => {
    const blank = OpenISDDriver.empty(new Engine(), fixedAppContext('id', '2026-03-04T00:00:00.000Z', null));
    blank.providedBy.set('jl');
    expect(blank.providedBy.value).toBe('jl');
    expect(blank.providedBy.entered).toBe(true);
  });

  it('leaves providedBy absent — never \'\' — when the platform user is not known', () => {
    const appContext = fixedAppContext('id', '2026-03-04T00:00:00.000Z', null);
    const blank = OpenISDDriver.empty(new Engine(), appContext);

    expect(blank.providedBy.value).toBeNull();
    // added is unconditional — it stamps even with no known platform user.
    expect(blank.added.value).toBe('20260304');
  });

  it('reports what is wrong with a record instead of throwing, so a picker can show it', () => {
    const noSection = driverJson({
      brand: 'Dayton', model: 'RS225', section: 'passive-radiator',
      spec: prSpecSection({ Fs_hz: 30, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });

    const result = OpenISDDriver.fromConformingRecord(noSection, new Engine());

    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain('no woofer section — this record is a passive radiator, nothing to simulate');
  });

  it('reports EVERY problem at once, not just the first', () => {
    const result = OpenISDDriver.fromConformingRecord({ brand: { value: 'Dayton', origin: 'x' } }, new Engine());

    expect(result).toEqual(expect.arrayContaining([
      expect.stringContaining("'model'"),
      expect.stringContaining("'manufacturer'"),
      expect.stringContaining("'uuid'"),
    ]));
  });

  it('says nothing about SECTIONS of a record that is not a record', () => {
    // A section fault is a statement about a device's specs. This value has no specs and is not
    // a record at all, so "no woofer section" would be a second-hand restatement of
    // "'specs' is missing" — the same fault, worded as if it were another one.
    const result = OpenISDDriver.fromConformingRecord({ brand: { value: 'Dayton', origin: 'x' } }, new Engine());

    expect(result).toEqual(expect.arrayContaining([expect.stringContaining("'specs'")]));
    expect(result).not.toEqual(expect.arrayContaining([
      expect.stringContaining('no woofer section'),
    ]));
  });

  it('names EVERY bad reading inside one spec field, not just the first', () => {
    // Two faults in ONE field's readings. A walk that returns on its first fault reports the
    // datasheet reading and stops, so the picker shows a reader one problem, they fix it, and
    // are then shown the next — which is what "every problem at once" is supposed to prevent.
    const record = {
      brand: { value: 'Dayton' },
      model: { value: 'RS225' },
      manufacturer: { value: 'Dayton' },
      uuid: { value: '00000000-0000-4000-8000-000000000000' },
      sku: { value: 'TEST-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-SKU' }] },
      driver_type: { value: 'woofer' },
      data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
      authoritative: { value: 'manufacturer_datasheet' },
      quality: {
        confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      specs: {
        woofer: {
          Fs_hz: {
            state: 'E', value: 30,
            origin: 'datasheet',
            readings: {
              datasheet: { read_value: 'thirty' },
              measured: { read_value: null },
            },
          },
        },
      },
    };

    const result = OpenISDDriver.fromConformingRecord(record, new Engine());

    expect(result).toEqual(expect.arrayContaining([
      expect.stringContaining('specs.woofer.Fs_hz.readings.datasheet.read_value'),
      expect.stringContaining('specs.woofer.Fs_hz.readings.measured.read_value'),
    ]));
  });

  it('detach() yields an instance that no longer shares storage with the original', () => {
    const original = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build().driver;

    const copy = original.detach();
    copy.specs.Fs_hz.set(99);

    expect(copy.specs.Fs_hz.value).toBe(99);
    expect(original.specs.Fs_hz.value).toBe(30);
  });
});

describe('OpenISDBox — every alignment, as a window onto the project record', () => {
  const project = () => OpenISDProject.builder(driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  }), new Engine()).sealed().volume_m3(0.03).build();

  it('new projects use the copper voice-coil temperature coefficient default', () => {
    expect(project().alfaVC_per_K.value).toBe(0.0039);
  });

  it('writes the sealed volume through to the project', () => {
    const p = project();
    p.box.sealed.volume_m3.set(0.03);
    expect(p.box.sealed.volume_m3.value).toBe(0.03);
  });

  it('gets sealed resonance FROM THE INJECTED ENGINE, and it rises above the driver\'s Fs', () => {
    // The domain does none of this arithmetic — it hands the driver's stored values, the volume,
    // the losses and the project's environment to the engine and reports what comes back
    // (John 2026-08-26: "geom is in and accoustic is absolutely out").
    const p = project();
    p.box.sealed.volume_m3.set(0.03);

    const fc = p.box.sealed.resonance_hz.value;
    // A sealed box always raises resonance above the driver's free-air Fs of 30 Hz.
    expect(fc).not.toBeNull();
    expect(fc!).toBeGreaterThan(30);
  });

  it('answers null for sealed resonance when there is no enclosure to resonate', () => {
    // Absence is null here as everywhere — never NaN, never 0, and never a throw. A zero volume
    // is not a very small box; it is no box.
    const p = project();
    p.box.sealed.volume_m3.set(0);
    expect(p.box.sealed.resonance_hz.value).toBeNull();
  });

  it('still resolves a resonance when the source-loaded Q feed is missing Qms/Qes/Re_ohm', () => {
    // `sourceLoadedQts` falls back to NaN for whichever of Qms/Qes/Re_ohm is unstated (its own
    // contract). Without `Rms_kg_per_s` there is no mechanical route to Qms either, so all three
    // are genuinely unstated here — Fs/Vas/Qts alone are enough to keep resonance itself answerable.
    const p = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSectionNoRms({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build();
    const ts = p.driver.specs;
    expect(ts.Qms.value).toBeNull();
    expect(ts.Qes.value).toBeNull();
    expect(ts.Re_ohm.value).toBeNull();

    expect(p.box.sealed.resonance_hz.value).not.toBeNull();
  });

  it('answers null for sealed resonance when the driver states no Q at all — nothing to invert', () => {
    // No `Qts` and no `Qes`/`Qms` pair to derive it from either: the guard is about Q, not
    // volume, so the box volume here is the same real 0.03 m³ the passing tests use.
    const p = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSectionNoRms({ Fs_hz: 30, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build();
    expect(p.driver.specs.Qts.value).toBeNull();

    expect(p.box.sealed.resonance_hz.value).toBe(null);
    expect(p.box.sealed.resonance_hz.value).toBeNull();
  });

  it('exposes sealed resonance as a precomputed field whose cell state follows the data', () => {
    // The upgrade contract (Task 1/3): a ReadonlyField, not a method — its cell state
    // reports not-available until the volume is known, calculated once it is.
    const p = project();
    expect(p.box.sealed.resonance_hz.calculated).toBe(true);
    expect(p.box.sealed.resonance_hz.value).not.toBeNull();
    const ventedOnly = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).vented().volume_m3(0.05).tuning_goal_hz(40).build();
    expect(ventedOnly.box.sealed.resonance_hz.value).toBe(null);
    expect(ventedOnly.box.sealed.resonance_hz.value).toBeNull();
  });

  it('a smaller box raises the resonance further — the engine is really being consulted', () => {
    // Non-vacuity: a hardcoded or stubbed value would not move with the volume.
    const big = project();  big.box.sealed.volume_m3.set(0.060);
    const small = project(); small.box.sealed.volume_m3.set(0.015);
    expect(small.box.sealed.resonance_hz.value!).toBeGreaterThan(big.box.sealed.resonance_hz.value!);
  });

  it('the sealed resonance is the LOSSY one — it moves when only the leakage changes', () => {
    // The property that separates lossy from lossless, and the one real WinISD demonstrably has:
    // at a fixed volume, `Fr` shifts 5.8 Hz between Ql=10000 and Ql=5 (winisd_research
    // FINDING-007). The lossless formula `Fs·√(1 + Vas/Vb)` cannot see Ql at all, so it returns
    // the same number for both — which is exactly the defect this pins.
    const leaky = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build();
    const tight = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build();

    leaky.box.sealed.losses.Ql.set(5);
    tight.box.sealed.losses.Ql.set(10000);

    expect(leaky.box.sealed.resonance_hz.value).not.toBeCloseTo(tight.box.sealed.resonance_hz.value!, 3);
  });

  it('feeds the engine the driver\'s SOLVED Vas and the Rg-loaded Qts, not compliance-route Vas and bare Qts (golden Fsc 63.1762 Hz / Qtc 0.5995)', () => {
    // The user-verified golden scene (sealed-fsc-winisd-golden.browser.spec.ts): Fs=40 Vas=7.65 L
    // Qes=0.450 Qms=2.940 Re=6.6 Rg=0.1 Vb=6 L Ql=10 Qa=100 → Fsc 63.1762 Hz, Qtc 0.5995.
    //
    // This is WinISD SEALED, and the engine already reproduces it: the parity feed
    // (winisd-parity-functional.test.ts "Box.Fr") passes exactly the driver's stored Vas and
    // `sourceLoadedQts(Qms, Qes, Re, Rg, Qts)`. The domain must hand the engine the same two
    // facts — THE SOLVED Vas_m3 (entered, not `Cms·Sd²·ρc²`, which this record does not even
    // carry) and Qts as the amplifier's source impedance loads it — instead of the compliance
    // reconstruction and the bare stored Qts the current feed passes.
    //
    // The bare-Qts feed alone is wrong by 0.040 Hz here, and the compliance feed cannot answer
    // this record at all (Sd/Cms are null), so today the cell reads not-available:
    const p = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'E150HE', section: 'woofer',
      spec: tuneSpec({Fs_hz: 40, Vas_m3: 0.00765, Qes: 0.45, Qms: 2.94, Re_ohm: 6.6}),
    }), new Engine()).sealed().volume_m3(0.006).build();
    p.Rs_ohm.set(0.1);
    p.box.sealed.losses.Ql.set(10);
    p.box.sealed.losses.Qa.set(100);

    // The engine-level numbers, matching the golden to the two display decimals:
    expect(p.box.sealed.resonance_hz.calculated).toBe(true);
    expect(p.box.sealed.resonance_hz.value!).toBeCloseTo(63.1762, 2);
    expect(p.box.sealed.q_tc.value!).toBeCloseTo(0.5995, 2);
  });

  it('computes the sealed system Q (Qtc) — a closed box raises Q above the driver\'s Qts', () => {
    const p = project();   // driver Qts 0.4, sealed volume 0.03
    const q = p.box.sealed.q_tc.value;
    expect(q).not.toBeNull();
    expect(q!).toBeGreaterThan(0.4);
    expect(p.box.sealed.q_tc.calculated).toBe(true);
  });

  it('answers null for sealed Qtc when the enclosure is not set', () => {
    // The sealed box is dormant in a vented project — no volume, so no Q.
    const ventedOnly = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).vented().volume_m3(0.05).tuning_goal_hz(40).build();
    expect(ventedOnly.box.sealed.q_tc.value).toBeNull();
    expect(ventedOnly.box.sealed.q_tc.value).toBe(null);
  });

  it('STILL computes plain geometry — a port area is πr², which no model can disagree about', () => {
    const p = project();
    p.box.vented.vent.diameter_m.set(0.1);
    expect(p.box.vented.vent.area_m2.value).toBeCloseTo(Math.PI * 0.05 ** 2, 12);
  });

  it('solves diameter ↔ area for a round vent — entering one calculates the other', () => {
    const p = project();
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.diameter_m.set(0.1);
    expect(p.box.vented.vent.diameter_m.entered).toBe(true);
    expect(p.box.vented.vent.area_m2.calculated).toBe(true);
    expect(p.box.vented.vent.area_m2.value).toBeCloseTo(Math.PI * 0.05 ** 2, 12);

    p.box.vented.vent.area_m2.set(Math.PI * 0.06 ** 2);
    expect(p.box.vented.vent.area_m2.entered).toBe(true);
    expect(p.box.vented.vent.diameter_m.calculated).toBe(true);
    expect(p.box.vented.vent.diameter_m.value).toBeCloseTo(0.12, 12);
  });

  it('entering the diameter atomically clears a previously entered area, and vice versa', () => {
    const p = project();
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.area_m2.set(Math.PI * 0.05 ** 2);
    expect(p.box.vented.vent.area_m2.entered).toBe(true);

    p.box.vented.vent.diameter_m.set(0.2);
    expect(p.box.vented.vent.diameter_m.entered).toBe(true);
    expect(p.box.vented.vent.area_m2.entered).toBe(false);
    expect(p.box.vented.vent.area_m2.calculated).toBe(true);
    expect(p.box.vented.vent.area_m2.value).toBeCloseTo(Math.PI * 0.1 ** 2, 12);
  });

  it('solves height ↔ area for a slotted vent against the CURRENT width, itself never solved', () => {
    const p = project();
    p.box.vented.vent.shape.set('slotted');
    p.box.vented.vent.width_m.set(0.2);
    p.box.vented.vent.height_m.set(0.05);
    expect(p.box.vented.vent.area_m2.calculated).toBe(true);
    expect(p.box.vented.vent.area_m2.value).toBeCloseTo(0.01, 12);

    p.box.vented.vent.area_m2.set(0.02);
    expect(p.box.vented.vent.height_m.calculated).toBe(true);
    expect(p.box.vented.vent.height_m.value).toBeCloseTo(0.1, 12);

    // Width moves independently and the solved side tracks it live.
    p.box.vented.vent.width_m.set(0.1);
    expect(p.box.vented.vent.height_m.value).toBeCloseTo(0.2, 12);
  });

  it('a slotted vent cannot solve height from area while width is unset', () => {
    const p = project();
    p.box.vented.vent.shape.set('slotted');
    p.box.vented.vent.area_m2.set(0.02);
    expect(p.box.vented.vent.area_m2.entered).toBe(true);
    expect(p.box.vented.vent.height_m.value).toBeNull();
  });

  it('pre: slotted, width N | trigger: height 0.05 | post: area N — nothing to multiply by', () => {
    const p = project();
    p.box.vented.vent.shape.set('slotted');
    p.box.vented.vent.height_m.set(0.05);
    expect(p.box.vented.vent.area_m2.value).toBeNull();
  });

  it('the sealed volume refuses a solver write — Vb is always the entered side of the alignment', () => {
    const engine = new Engine();
    const solve = vi.spyOn(engine, 'solveSealedAlignment').mockImplementation((params) => {
      params.Vb_m3.setCalculated(0.01);
      return [];
    });
    expect(() => OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: tuneSpec({Fs_hz: 40, Vas_m3: 0.00765, Qes: 0.45, Qms: 2.94, Re_ohm: 8}),
    }), engine).sealed().volume_m3(0.03).build()).toThrow(/structurally unreachable/);
    expect(solve).toHaveBeenCalled();
  });

  it('sweepN stores a point count and clears back to absent', () => {
    const p = project();
    p.sweepN.set(200);
    expect(p.sweepN.value).toBe(200);
    p.sweepN.set(null);
    expect(p.sweepN.value).toBeNull();
  });

  it('P and V dq writes are rendered by the engine into the record trail', () => {
    const engine = new Engine();
    const text = vi.spyOn(engine, 'dqIssueText').mockReturnValue('mocked');
    const p = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: tuneSpec({Fs_hz: 40, Vas_m3: 0.00765, Qes: 0.45, Qms: 2.94, Re_ohm: 8}),
    }), engine).sealed().volume_m3(0.03).build();
    const mark = ignoredIssue('power_W');

    p.powerDrive_W.setDq([mark]);
    p.driveVoltage_V.setDq([mark]);

    expect(text.mock.calls).toEqual([[mark], [mark]]);
    const owpr = JSON.parse(p.toOwprText());
    expect((owpr.edited ?? owpr.saved).signal.power_W.dq_calculated[0].detail).toBe('mocked');
  });

  it('a vent with no stated count STORES one port as a calculated entry — the same route numVC takes', () => {
    const p = project();
    expect(p.box.vented.vent.count.value).toBe(1);
    expect(p.box.vented.vent.count.calculated).toBe(true);
    expect(JSON.parse(p.toOwprText()).saved.box.vented.vent.count).toMatchObject({ state: 'C', value: 1 });

    // A project saved before ports had a count carries no `count` key at all.
    const parsed = JSON.parse(p.toOwprText());
    delete parsed.saved.box.vented.vent.count;
    parsed.edited = null;
    const back = OpenISDProject.fromOwprText(JSON.stringify(parsed), new Engine());
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.box.vented.vent.count.value).toBe(1);
    expect(back.box.vented.vent.count.calculated).toBe(true);
  });

  it('a stated count is entered; a count that is not a whole number of at least one is REPAIRED to the calculated 1, not refused', () => {
    const p = project();
    p.box.vented.vent.count.set(2);
    expect(p.box.vented.vent.count.value).toBe(2);
    expect(p.box.vented.vent.count.entered).toBe(true);
    for (const bad of [0, -1, 1.5]) {
      const parsed = JSON.parse(p.toOwprText());
      parsed.saved.box.vented.vent.count = { state: 'E', value: bad };
      parsed.edited = null;
      const back = OpenISDProject.fromOwprText(JSON.stringify(parsed), new Engine());
      if (Array.isArray(back)) throw new Error(`count ${bad}: fromOwprText returned problems: ` + back.join(', '));
      expect(back.box.vented.vent.count.value, `count ${bad} reads as 1`).toBe(1);
      expect(back.box.vented.vent.count.calculated, `count ${bad} reads as calculated`).toBe(true);
      // The repair is WRITTEN: the record states the count it is read as, never the bad number.
      expect(JSON.parse(back.toOwprText()).saved.box.vented.vent.count, `count ${bad} is repaired in the record`)
        .toMatchObject({ state: 'C', value: 1 });
    }
  });

  it('count.clear() restores the stored calculated default, and the field carries the usual write surface', () => {
    const p = project();
    p.box.vented.vent.count.set(3);
    p.save();
    expect(p.box.vented.vent.count.entered).toBe(true);
    expect(JSON.parse(p.toOwprText()).saved.box.vented.vent.count).toMatchObject({ state: 'E', value: 3 });

    p.box.vented.vent.count.clear();
    p.save();
    expect(p.box.vented.vent.count.value).toBe(1);
    expect(p.box.vented.vent.count.calculated).toBe(true);
    expect(JSON.parse(p.toOwprText()).saved.box.vented.vent.count).toMatchObject({ state: 'C', value: 1 });

    // Entry-backed like every other field: the same writes, so the resolve can stamp the default.
    expect('setCalculated' in p.box.vented.vent.count).toBe(true);
    expect('setDq' in p.box.vented.vent.count).toBe(true);
  });

  it('reports the TOTAL opening as count × one port\'s area — still plain geometry', () => {
    const p = project();
    p.box.vented.vent.diameter_m.set(0.1);
    p.box.vented.vent.count.set(2);
    expect(p.box.vented.vent.area_m2.value).toBeCloseTo(Math.PI * 0.05 ** 2, 12);
    expect(p.box.vented.vent.totalArea_m2()).toBeCloseTo(2 * Math.PI * 0.05 ** 2, 12);
    p.box.vented.vent.diameter_m.clear();
    expect(p.box.vented.vent.totalArea_m2()).toBeNull();
  });

  it('two ports of the same size need a LONGER port than one for the same tuning', () => {
    const p = project();
    p.box.boxType.set('vented');
    p.box.vented.volume_m3.set(0.05);
    p.box.vented.vent.diameter_m.set(0.1);
    p.box.vented.tuning_goal_hz.set(40);
    const one = p.box.vented.vent.length_m.value;
    p.box.vented.vent.count.set(2);
    const two = p.box.vented.vent.length_m.value;
    if (one === null || two === null) throw new Error('port length did not solve');
    expect(two).toBeGreaterThan(one);
  });

  it('a vent defaults to TWO FREE ENDS end correction (0.613), not a value no option matches', () => {
    // BUG_20260912 #10: the old 0.6 default matched none of the UI's END_CORRECTION_OPTIONS, so
    // the end-correction select rendered blank. The default is WinISD's "two free ends", 0.613.
    const p = project();
    expect(p.box.vented.vent.endCorrection_m.value).toBe(0.613);
  });

  it('gets the port\'s ACOUSTIC length from the engine, end correction and all', () => {
    const p = project();
    p.box.vented.vent.diameter_m.set(0.1);
    p.box.vented.vent.length_m.set(0.2);

    const area = Math.PI * 0.05 ** 2;
    const engine = new Engine();
    expect(p.box.vented.vent.effectiveLength_m()).toBe(
      engine.ventEffectiveLength(0.2, area, 1, p.box.vented.vent.endCorrection_m.value),
    );
    // And it is LONGER than the port measures — that is what an end correction does.
    expect(p.box.vented.vent.effectiveLength_m()!).toBeGreaterThan(0.2);
  });

  it('reports an unset tuning as not-available rather than zero', () => {
    const p = project();
    p.box.vented.volume_m3.set(0.05);

    expect(p.box.vented.volume_m3.value).toBe(0.05);
    expect(p.box.vented.tuning_goal_hz.value).toBe(null);
    expect(p.box.vented.tuning_goal_hz.value).toBeNull();
  });

  it('computes vent area from whichever dimensions the vent SHAPE actually uses', () => {
    const p = project();
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.diameter_m.set(0.1);
    expect(p.box.vented.vent.area_m2.value).toBeCloseTo(Math.PI * 0.05 ** 2, 12);

    p.box.vented.vent.shape.set('slotted');
    // Round diameter is still stored but no longer consulted — area is unanswerable until the
    // slot's own dimensions are given, and unanswerable is null, the same as everywhere else.
    expect(p.box.vented.vent.area_m2.value).toBeNull();
    p.box.vented.vent.width_m.set(0.2);
    p.box.vented.vent.height_m.set(0.05);
    expect(p.box.vented.vent.area_m2.value).toBeCloseTo(0.01, 12);
  });

  it('gives ABC three ports, none of them owned by a chamber', () => {
    const p = project();
    p.box.abc.vents.rear.diameter_m.set(0.08);
    p.box.abc.vents.front.diameter_m.set(0.09);
    p.box.abc.vents.intra.diameter_m.set(0.05);

    expect(p.box.abc.vents.rear.diameter_m.value).toBe(0.08);
    expect(p.box.abc.vents.front.diameter_m.value).toBe(0.09);
    expect(p.box.abc.vents.intra.diameter_m.value).toBe(0.05);
    // Two chambers only — the connecting port is not a third one.
    expect(Object.keys(p.box.abc.chambers)).toEqual(['rear', 'front']);
  });

  it('tunes bandpass6 chambers independently of each other', () => {
    const p = project();
    p.box.bandpass6.chambers.rear.tuning_goal_hz.set(40);
    p.box.bandpass6.chambers.front.tuning_goal_hz.set(80);

    expect(p.box.bandpass6.chambers.rear.tuning_goal_hz.value).toBe(40);
    expect(p.box.bandpass6.chambers.front.tuning_goal_hz.value).toBe(80);
  });

  it('keeps per-chamber losses separate — BUG_20260824', () => {
    const p = project();
    p.box.bandpass4.chambers.rear.losses.Ql.set(5);
    p.box.bandpass4.chambers.front.losses.Ql.set(9);

    expect(p.box.bandpass4.chambers.rear.losses.Ql.value).toBe(5);
    expect(p.box.bandpass4.chambers.front.losses.Ql.value).toBe(9);
  });

  it('exposes bandpass4 rear resonance as a precomputed field, null until the rear volume is known', () => {
    // Task 4/5: the rear chamber is sealed, so its resonance (WinISD's "Frc") is a
    // ReadonlyField — read as precomputed state, never a method.
    const p = project(); // a sealed project — bandpass4 is dormant, so its rear volume is unset
    expect(p.box.bandpass4.chambers.rear.resonance_hz.value).toBe(null);
    expect(p.box.bandpass4.chambers.rear.resonance_hz.value).toBeNull();

    const bp4 = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).bandpass4().rearVolume_m3(0.02).frontVolume_m3(0.03).frontTuning_hz(40).build();
    expect(bp4.box.bandpass4.chambers.rear.resonance_hz.calculated).toBe(true);
    expect(bp4.box.bandpass4.chambers.rear.resonance_hz.value).not.toBeNull();
  });

  it('gives the bandpass4 front volume a Field readout like every other chamber', () => {
    // The front chamber volume carries entered/calculated status like the rear chamber,
    // not a bare SimpleField.
    const bp4 = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).bandpass4().rearVolume_m3(0.02).frontVolume_m3(0.03).frontTuning_hz(40).build();
    expect(bp4.box.bandpass4.chambers.front.volume_m3.value).toBe(0.03);
    expect(bp4.box.bandpass4.chambers.front.volume_m3.entered).toBe(true);
  });
});

describe('OpenISDProject.builder — bandpass6 and abc share TwoChamberProjectBuilder, both chambers independently tunable', () => {
  const driver = () => driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  });

  it('bandpass6() builds a project whose rear chamber carries its own volume AND tuning, unlike bandpass4\'s sealed rear', () => {
    const p = OpenISDProject.builder(driver(), new Engine())
      .bandpass6().rearVolume_m3(0.02).rearTuning_hz(50).frontVolume_m3(0.03).frontTuning_hz(40).build();
    expect(p.box.bandpass6.chambers.rear.volume_m3.value).toBe(0.02);
    expect(p.box.bandpass6.chambers.rear.tuning_goal_hz.value).toBe(50);
    expect(p.box.bandpass6.chambers.front.volume_m3.value).toBe(0.03);
    expect(p.box.bandpass6.chambers.front.tuning_goal_hz.value).toBe(40);
  });

  it('abc() builds the same two independently-tunable chambers under the abc box type', () => {
    const p = OpenISDProject.builder(driver(), new Engine())
      .abc().rearVolume_m3(0.025).rearTuning_hz(45).frontVolume_m3(0.035).frontTuning_hz(38).build();
    expect(p.box.abc.chambers.rear.volume_m3.value).toBe(0.025);
    expect(p.box.abc.chambers.rear.tuning_goal_hz.value).toBe(45);
    expect(p.box.abc.chambers.front.volume_m3.value).toBe(0.035);
    expect(p.box.abc.chambers.front.tuning_goal_hz.value).toBe(38);
  });

  it('sweep()/maxCurves()/boxParamsIssues() answer "nothing to simulate" for a topology the engine has no circuit for', () => {
    const p = OpenISDProject.builder(driver(), new Engine())
      .bandpass6().rearVolume_m3(0.02).rearTuning_hz(50).frontVolume_m3(0.03).frontTuning_hz(40).build();

    expect(p.sweep({fmin: 10, fmax: 100, N: 10})).toEqual({values: null, issues: []});
    expect(p.maxCurves({fmin: 10, fmax: 100, N: 10})).toEqual({values: null, issues: [], driverPrerequisites: []});
    expect(p.boxParamsIssues()).toEqual([]);
  });
});

describe('BoxProjectBuilder — the shared build() guards', () => {
  const driver = () => driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  });

  it('build() without a required field names the field that was never set, rather than shipping a half-stated box', () => {
    expect(() => OpenISDProject.builder(driver(), new Engine()).sealed().build())
      .toThrow(/build\(\): sealed volume_m3 is required/);
  });

  it('a passive-radiator box built with no radiator chosen refuses — the one box type that cannot exist alone', () => {
    expect(() => OpenISDProject.builder(driver(), new Engine())
      .passiveRadiator().volume_m3(0.05).tuning_goal_hz(35).build())
      .toThrow(/build\(\): a passive-radiator box requires a radiator/);
  });
});

describe('OpenISDProject.lossMode — project-scoped, not a UI singleton (S10/QO130)', () => {
  const project = () => OpenISDProject.builder(driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  }), new Engine()).sealed().volume_m3(0.03).build();

  it('defaults to WinisdLossy — the saved record states no lossMode yet', () => {
    expect(project().lossMode.value).toBe(LossMode.Default);
  });

  it('round-trips a stated mode through the project record', () => {
    const p = project();
    p.lossMode.set(LossMode.Lossless);
    expect(p.lossMode.value).toBe(LossMode.Lossless);
  });

  it('drives the sealed box\'s own resonance readout — two projects can disagree', () => {
    // The bug S10/QO130 fixes: a global `presentationState.lossMode` singleton meant two open
    // projects could not disagree about their own loss model. Each project's `box.sealed`
    // readout must follow THAT project's own stated mode.
    const lossy = project();
    const lossless = project();
    lossless.lossMode.set(LossMode.Lossless);

    expect(lossy.box.sealed.resonance_hz.value).not.toBeCloseTo(lossless.box.sealed.resonance_hz.value!, 6);
  });
});

describe('OpenISDProject graphs/cursor — project-scoped, not a UI singleton (S10/QO130)', () => {
  const project = () => OpenISDProject.builder(driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  }), new Engine()).sealed().volume_m3(0.03).build();

  it('graphs defaults to empty and round-trips a stated list through the project record', () => {
    const p = project();
    expect(p.graphs.value).toEqual([]);
    p.graphs.set(['SPL', 'Zmag']);
    expect(p.graphs.value).toEqual(['SPL', 'Zmag']);
  });

  it('two projects hold independent graphs — no shared singleton', () => {
    const a = project();
    const b = project();
    a.graphs.set(['SPL']);
    expect(b.graphs.value).toEqual([]);
  });

  it('does not count as an unsaved change — graphs writes stay out of isModified()', () => {
    const p = project();
    expect(p.isModified()).toBe(false);
    p.graphs.set(['SPL']);
    expect(p.isModified()).toBe(false);
  });

  it('graphs round-trips through the saved record (John 2026-09-20/21: it only changes per ' +
     'click, unlike the mousemove-driven cursor below)', () => {
    const p = project();
    p.graphs.set(['SPL', 'Zmag']);
    p.save();

    const saved = JSON.parse(p.toOwprText()).saved;
    expect(saved.charts.graphs).toEqual(['SPL', 'Zmag']);
  });

  it('cursorF/pinnedF/cursorLocked/dragRange default to unset and round-trip in memory ' +
     '(QO168: a documented exception, not part of OpenISDProjectJson)', () => {
    const p = project();
    expect(p.cursorF.value).toBeNull();
    expect(p.pinnedF.value).toBeNull();
    expect(p.cursorLocked.value).toBe(false);
    expect(p.dragRange.value).toBeNull();

    p.cursorF.set(120);
    p.pinnedF.set(100);
    p.cursorLocked.set(true);
    p.dragRange.set({ fLo: 80, fHi: 200 });

    expect(p.cursorF.value).toBe(120);
    expect(p.pinnedF.value).toBe(100);
    expect(p.cursorLocked.value).toBe(true);
    expect(p.dragRange.value).toEqual({ fLo: 80, fHi: 200 });
  });

  it('two projects hold independent cursors — no shared singleton', () => {
    const a = project();
    const b = project();
    a.cursorF.set(120);
    expect(b.cursorF.value).toBeNull();
  });

  it('cursor writes never reach the saved record — QO168 keeps them out of .owpr entirely', () => {
    const p = project();
    p.cursorF.set(120);
    p.pinnedF.set(100);
    p.cursorLocked.set(true);
    p.dragRange.set({ fLo: 80, fHi: 200 });
    p.save();

    const saved = JSON.parse(p.toOwprText()).saved;
    expect(saved.charts).not.toHaveProperty('cursor');
  });

  it('does not count as an unsaved change — cursor writes stay out of isModified()', () => {
    const p = project();
    expect(p.isModified()).toBe(false);
    p.cursorF.set(120);
    p.dragRange.set({ fLo: 80, fHi: 200 });
    expect(p.isModified()).toBe(false);
  });
});

describe('S10 — sealed joins the cascade: box.sealed.q_tc is an entry the resolve writes', () => {
  const sealedProject = () => OpenISDProject.builder(driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  }), new Engine()).sealed().volume_m3(0.03).build();

  it('a sealed project gets its Qtc solved into the record as a calculated entry, not a ' +
     'live recompute — it round-trips through .owpr text as a stored "C" entry', () => {
    const p = sealedProject();
    const cell = p.box.sealed.q_tc;
    expect(cell.calculated).toBe(true);
    expect(cell.value).toBeCloseTo(p.box.sealed.q_tc.value!, 12);

    const parsed = JSON.parse(p.toOwprText());
    expect(parsed.saved.box.sealed.Qtc).toMatchObject({ state: 'C' });
    expect(parsed.saved.box.sealed.Qtc.value).toBeCloseTo(cell.value!, 6);
  });

  it('exactly one engine.solveSealedAlignment call per field set(), and zero for a bare ' +
     'project.box read', () => {
    const engine = new Engine();
    const p = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), engine).sealed().volume_m3(0.03).build();

    const readSpy = vi.spyOn(engine, 'solveSealedAlignment');
    void p.box;
    void p.box.sealed.q_tc.value;
    expect(readSpy).toHaveBeenCalledTimes(0);
    readSpy.mockRestore();

    const writeSpy = vi.spyOn(engine, 'solveSealedAlignment');
    p.box.sealed.losses.Ql.set(12);
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  it('a vented project leaves box.sealed.Qtc not-available — only the active box type ' +
     'joins the cascade', () => {
    const ventedOnly = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).vented().volume_m3(0.05).tuning_goal_hz(40).build();
    expect(ventedOnly.box.sealed.q_tc.value).toBe(null);
  });
});

describe('the passive radiator a box holds', () => {
  const prJson = () => driverJson({
    brand: 'SB Acoustics', model: 'SB23PACS', section: 'passive-radiator',
    spec: prSpecSection({ Fs_hz: 12, Sd_m2: 0.025, Cms_m_per_N: 0.0009, Mmd_kg: 0.09, Rms_Ns_per_m: 1.5, Xmax_m: 0.015 }),
  });
  const project = () => OpenISDProject.builder(driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  }), new Engine()).sealed().volume_m3(0.03).build();

  it('holds a blank radiator from the start: blank reads, and edits land', () => {
    const p = project();
    const r = p.box.passiveRadiator.radiator;

    expect(r.brand.value).toBe('');
    r.brand.set('SB');
    expect(p.box.passiveRadiator.radiator.brand.value).toBe('SB');

    expect(r.spec.Fs_hz.value).toBe(null);
    r.spec.Fs_hz.set(12);
    expect(p.box.passiveRadiator.radiator.spec.Fs_hz.value).toBe(12);

    expect(r.dataSource('manufacturer_datasheet')).toBeNull();
  });

  it('a box switched to passive radiator solves its blank radiator rather than skipping it', () => {
    const p = project();
    p.box.boxType.set('box-passive-radiator');
    p.box.passiveRadiator.volume_m3.set(0.03);
    p.box.passiveRadiator.addedMass_kg.set(0);

    expect(p.box.passiveRadiator.systemTuning_hz.value).toBe(null);
    expect(p.box.passiveRadiator.systemTuning_hz.dq.length).toBeGreaterThan(0);
  });

  it('brand/model metadata is never solver-derived — setCalculated()/setDq() are no-ops, same S2-7c/d ruling as a radiator T/S spec', () => {
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson(), new Engine());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.configurePR(library);

    expect(p.box.passiveRadiator.radiator.brand.value).toBe('SB Acoustics');
    expect(p.box.passiveRadiator.radiator.brand.entered).toBe(true);
    expect(p.box.passiveRadiator.radiator.brand.dq).toEqual([]);
    // A radiator's brand is a catalogue fact: no solver write exists on it.
    expect('setCalculated' in p.box.passiveRadiator.radiator.brand).toBe(false);
    expect('setDq' in p.box.passiveRadiator.radiator.brand).toBe(false);

    expect('clear' in p.box.passiveRadiator.radiator.brand).toBe(false);
    p.box.passiveRadiator.radiator.brand.set('');
    expect(p.box.passiveRadiator.radiator.brand.value).toBe('');
  });

  it('copies the chosen radiator IN, so later edits do not touch the library entry', () => {
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson(), new Engine());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);

    expect(p.box.passiveRadiator.radiator.brand.value).toBe('SB Acoustics');

    p.box.passiveRadiator.radiator.spec.Sd_m2.set(0.031);
    expect(p.box.passiveRadiator.radiator.spec.Sd_m2.value).toBe(0.031);
    expect(library.spec.Sd_m2.value).toBe(0.025);
  });

  it('setCalculated()/setDq() are no-ops on a radiator T/S field — entry-backed, never solver-derived', () => {
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson(), new Engine());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);

    p.box.passiveRadiator.radiator.spec.Fs_hz.setCalculated(99, [ignoredIssue('ignored')]);
    expect(p.box.passiveRadiator.radiator.spec.Fs_hz.value).toBe(12);
    expect(p.box.passiveRadiator.radiator.spec.Fs_hz.dq).toEqual([]);

    p.box.passiveRadiator.radiator.spec.Fs_hz.setDq([ignoredIssue('ignored too')]);
    expect(p.box.passiveRadiator.radiator.spec.Fs_hz.dq).toEqual([]);
  });

  it('detaches the box radiator into a standalone the library can hold, sharing no storage', () => {
    const p = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build();
    const chosen = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson(), new Engine());
    if (Array.isArray(chosen)) throw new Error(`fixture radiator is invalid: ${chosen.join(', ')}`);
    p.box.passiveRadiator.configurePR(chosen);
    p.box.passiveRadiator.radiator.spec.Sd_m2.set(0.031);

    const saved = p.box.passiveRadiator.radiator.detach();

    expect(saved.brand.value).toBe('SB Acoustics');
    expect(saved.spec.Sd_m2.value).toBe(0.031);

    // Storage is not shared in either direction.
    p.box.passiveRadiator.radiator.spec.Sd_m2.set(0.099);
    expect(saved.spec.Sd_m2.value).toBe(0.031);
    saved.spec.Sd_m2.set(0.011);
    expect(p.box.passiveRadiator.radiator.spec.Sd_m2.value).toBe(0.099);
  });

  it('detaches the blank radiator a box starts with', () => {
    const p = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build();

    expect(p.box.passiveRadiator.radiator.detach().brand.value).toBe('');
  });

  it('the blank radiator a box starts with has its own identity', () => {
    const p = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build();

    expect(p.box.passiveRadiator.radiator.uuid()).toMatch(/\S/);
  });

  it('reports a driver-shaped record as no radiator, instead of throwing, so a picker can show it', () => {
    const driverShaped = driverJson({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });

    const result = OpenISDPassiveRadiatorStandalone.fromConformingRecord(driverShaped, new Engine());

    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain('no passive-radiator section — this record is a driver, not a radiator');
  });

  it('a radiator states its record identity, the way a driver does — the bundled index and favourites key on it', () => {
    const blank = OpenISDPassiveRadiatorStandalone.empty(new Engine());
    expect(blank.uuid()).toBe(blank.clonePassiveRadiator().uuid.value);
    expect(blank.uuid()).toMatch(/^[0-9a-f-]{36}$/);

    const p = project();
    p.box.passiveRadiator.configurePR(blank);
    expect(p.box.passiveRadiator.radiator.uuid()).toBe(blank.uuid());
  });

  it('a radiator answers its catalogue links by role, the way a driver does — null when the record carries none', () => {
    const blank = OpenISDPassiveRadiatorStandalone.empty(new Engine());
    expect(blank.dataSource('manufacturer_datasheet')).toBeNull();
    expect(blank.dataSource('manufacturer_product_page')).toBeNull();
    expect(blank.dataSource('manufacturer_listing_page')).toBeNull();

    const json = blank.clonePassiveRadiator();
    json.data_sources = { value: { manufacturer_product_page: 'https://example.test/pr' } };
    const withLink = OpenISDPassiveRadiatorStandalone.wrap(json, new Engine());
    expect(withLink.dataSource('manufacturer_product_page')).toBe('https://example.test/pr');
    expect(withLink.dataSource('manufacturer_datasheet')).toBeNull();
  });

  it('stamps added/providedBy the same way a blank driver does', () => {
    const appContext = fixedAppContext('id', '2026-03-04T00:00:00.000Z', 'johnl');
    const blank = OpenISDPassiveRadiatorStandalone.empty(new Engine(), appContext);

    expect(blank.added.value).toBe('20260304');
    expect(blank.providedBy.value).toBe('johnl');
  });

  it('makes a blank radiator an editor can fill in, and a box can adopt', () => {
    const blank = OpenISDPassiveRadiatorStandalone.empty(new Engine());

    expect(blank.model.value).toBe('');
    expect(blank.spec.Fs_hz.value).toBe(null);

    const p = project();
    p.box.passiveRadiator.configurePR(blank);
    p.box.passiveRadiator.radiator.spec.Fs_hz.set(12);

    expect(p.box.passiveRadiator.radiator.spec.Fs_hz.value).toBe(12);
  });

  it('addedMassForTuning_kg answers not-available before a radiator is chosen — nothing to solve from', () => {
    const p = project();
    expect(p.box.passiveRadiator.addedMassForTuning_kg(15).value).toBe(null);
    expect(p.box.passiveRadiator.addedMassForTuning_kg(15).value).toBeNull();
  });

  it('answers the mass to ADD for a target tuning, not the total moving mass', () => {
    // BUG_20260908_addedMassForTuning_returns_total_mass_not_added_mass: the engine's
    // `prMassForFp` inverts `prTuning`, whose input is (Mmd + Madd) — so it returns the TOTAL.
    // What the user must put ON the cone is that total less the radiator's own moving mass.
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson(), new Engine());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);
    // The fixture project is sealed-built, so the PR box's own volume starts at 0 and every
    // passive-radiator calculation reports null until it is set. `systemTuning_hz` is an output
    // the project cascade only solves for the ACTIVE box type (S2-7d2).
    p.box.boxType.set('box-passive-radiator');
    p.box.passiveRadiator.volume_m3.set(0.03);
    p.box.passiveRadiator.addedMass_kg.set(0);

    const added = p.box.passiveRadiator.addedMassForTuning_kg(15);

    // Applying the answer must actually produce the target — the property that makes it the
    // right quantity, checked through the box's own forward calculation rather than a literal.
    p.box.passiveRadiator.addedMass_kg.set(added.value!);
    expect(p.box.passiveRadiator.systemTuning_hz.value).toBeCloseTo(15, 6);
  });

  it('reports impossible calculated mass for an unreachable tuning target and shows dq on the related fields', () => {
    // The highest tuning reachable is the one produced with NO added mass; above that the
    // arithmetic asks for negative mass, and mass cannot come off a cone carrying none.
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson(), new Engine());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);
    p.box.boxType.set('box-passive-radiator');
    p.box.passiveRadiator.volume_m3.set(0.03);
    p.box.passiveRadiator.addedMass_kg.set(0);

    const ceiling = p.box.passiveRadiator.systemTuning_hz.value!;

    expect(p.box.passiveRadiator.addedMassForTuning_kg(ceiling * 1.5).value).toBeLessThan(0);
    // At the ceiling itself the answer is zero added mass, not null — reachable, just barely.
    expect(p.box.passiveRadiator.addedMassForTuning_kg(ceiling).value).toBeCloseTo(0, 9);

    p.box.passiveRadiator.tuning_goal_hz.set(ceiling * 1.5);
    p.notifyPrChanged();

    expect(p.box.passiveRadiator.addedMass_kg.value).toBeNull();
    expect(p.box.passiveRadiator.addedMass_kg.dq.some(issue => issue.kind === 'target-unreachable')).toBe(true);

    p.box.passiveRadiator.tuning_goal_hz.set(ceiling);
    p.notifyPrChanged();

    expect(p.box.passiveRadiator.addedMass_kg.value).toBeCloseTo(0, 9);
    expect(p.box.passiveRadiator.addedMass_kg.dq.some(issue => issue.kind === 'target-unreachable')).toBe(false);
  });

  it('carries the dq on EVERY passive-radiator input and output when the target is unreachable', () => {
    // The unreachable-target DQ is not a property of the bad calculated mass alone — the user
    // sees the ⚠ on the target they typed AND on every derived output, so the field that is the
    // real problem (the entered tuning) and the fields that merely show its consequence all flag.
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson(), new Engine());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);
    p.box.boxType.set('box-passive-radiator');
    p.box.passiveRadiator.volume_m3.set(0.03);
    p.box.passiveRadiator.addedMass_kg.set(0);

    const ceiling = p.box.passiveRadiator.systemTuning_hz.value!;
    p.box.passiveRadiator.tuning_goal_hz.set(ceiling * 1.5);
    p.notifyPrChanged();

    const DQ = [{ kind: 'target-unreachable', target: 'addedMass_kg', maxReachable_hz: ceiling }];
    expect(p.box.passiveRadiator.tuning_goal_hz.entered).toBe(true);                 // the input
    expect(p.box.passiveRadiator.tuning_goal_hz.dq).toEqual(DQ);
    expect(p.box.passiveRadiator.addedMass_kg.dq).toEqual(DQ);
    expect(p.box.passiveRadiator.systemTuning_hz.dq).toEqual(DQ);
    expect(p.box.passiveRadiator.resonanceWithAddedMass_hz.dq).toEqual(DQ);
  });

  it('reports no resonance-with-added-mass until a radiator is chosen', () => {
    expect(project().box.passiveRadiator.resonanceWithAddedMass_hz.value).toBeNull();
  });

  it('resonates at the radiator own Fs when no mass has been added', () => {
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson(), new Engine());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);
    p.box.boxType.set('box-passive-radiator');
    p.box.passiveRadiator.addedMass_kg.set(0);

    // Mms 0.09 kg on Cms 0.0009 m/N: 1/(2π·√(0.09·0.0009)) = 17.6838… Hz.
    expect(p.box.passiveRadiator.resonanceWithAddedMass_hz.value).toBeCloseTo(17.6838, 3);
  });

  it('falls as tuning mass goes onto the cone', () => {
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson(), new Engine());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);
    p.box.boxType.set('box-passive-radiator');
    p.box.passiveRadiator.addedMass_kg.set(0.111111);

    // (0.09 + 0.111111) kg on the same compliance: 1/(2π·√(0.201111·0.0009)) = 11.8298… Hz.
    expect(p.box.passiveRadiator.resonanceWithAddedMass_hz.value).toBeCloseTo(11.8299, 3);
  });
});

describe('ManagedProject — the layers', () => {
  const managed = () => OpenISDProject.builder(driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  }), new Engine()).sealed().volume_m3(0.03).build();

  it('starts unmodified', () => {
    expect(managed().isModified()).toBe(false);
  });

  it('impedancePeak() answers null when the driver has no usable Re_ohm yet', () => {
    const mp = managed();
    expect(mp.driver.specs.Re_ohm.value).toBeNull();
    expect(mp.impedancePeak(null)).toBeNull();
  });

  it('impedancePeak() reads Re off the driver once it is known, and null-sweeps to null', () => {
    const mp = managed();
    mp.driver.specs.Re_ohm.set(6);
    expect(mp.impedancePeak(null)).toBeNull();
  });

  it('the first write creates the edited state; Cancel throws it away', () => {
    const mp = managed();

    mp.driver.specs.Fs_hz.set(99);
    expect(mp.isModified()).toBe(true);
    expect(mp.driver.specs.Fs_hz.value).toBe(99);

    void mp.cancel(async () => true);
  });

  it('Cancel restores the last saved values', async () => {
    const mp = managed();
    mp.driver.specs.Fs_hz.set(99);

    expect(await mp.cancel(async () => true)).toBe(true);
    expect(mp.driver.specs.Fs_hz.value).toBe(30);
    expect(mp.isModified()).toBe(false);
  });

  it('Cancel does nothing when the challenge refuses', async () => {
    const mp = managed();
    mp.driver.specs.Fs_hz.set(99);

    expect(await mp.cancel(async () => false)).toBe(false);
    expect(mp.driver.specs.Fs_hz.value).toBe(99);
    expect(mp.isModified()).toBe(true);
  });

  it('Cancel on an untouched project reports that nothing was discarded', async () => {
    expect(await managed().cancel(async () => true)).toBe(false);
  });

  it('Save promotes the edited state and clears the modified flag', () => {
    const mp = managed();
    mp.driver.specs.Fs_hz.set(50);
    expect(mp.isModified()).toBe(true);

    mp.save();
    expect(mp.driver.specs.Fs_hz.value).toBe(50);
    expect(mp.isModified()).toBe(false);
  });

  it('Save on an untouched project is a no-op', () => {
    const mp = managed();
    expect(() => mp.save()).not.toThrow();
    expect(mp.isModified()).toBe(false);
  });

  it('Cancel after a Save goes back to what was SAVED, not to what was loaded', async () => {
    const mp = managed();
    mp.driver.specs.Fs_hz.set(50);
    mp.save();

    mp.driver.specs.Fs_hz.set(77);
    await mp.cancel(async () => true);

    // 50 — the saved state — not the 30 the project was loaded with.
    expect(mp.driver.specs.Fs_hz.value).toBe(50);
  });

  it('notifies on entering the edited state, not only on later writes', () => {
    const mp = managed();
    let notifications = 0;
    mp.subscribe(() => { notifications += 1; });

    mp.driver.specs.Fs_hz.set(42);
    expect(notifications).toBeGreaterThan(0);

    const afterFirst = notifications;
    mp.driver.specs.Fs_hz.set(43);
    expect(notifications).toBeGreaterThan(afterFirst);
  });

  it('notifies when setDriver replaces the whole driver record', () => {
    const mp = managed();
    let notifications = 0;
    mp.subscribe(() => { notifications += 1; });

    mp.setDriver(OpenISDDriver.empty(new Engine()));
    expect(notifications).toBeGreaterThan(0);
  });

  it('notifies when loadDriver adopts a driver from outside the project', () => {
    const mp = managed();
    let notifications = 0;
    mp.subscribe(() => { notifications += 1; });

    mp.loadDriver(OpenISDDriver.empty(new Engine()));
    expect(notifications).toBeGreaterThan(0);
  });

  it('the function subscribe() returns stops further notifications once called', () => {
    const mp = managed();
    let notifications = 0;
    const unsubscribe = mp.subscribe(() => { notifications += 1; });

    mp.driver.specs.Fs_hz.set(42);
    expect(notifications).toBe(1);

    unsubscribe();
    mp.driver.specs.Fs_hz.set(43);
    expect(notifications).toBe(1);
  });

  it('batch() collapses every write inside it into a single notification', () => {
    const mp = managed();
    let notifications = 0;
    mp.subscribe(() => { notifications += 1; });

    mp.batch(() => {
      mp.driver.specs.Fs_hz.set(42);
      mp.driver.specs.Qts.set(0.5);
      mp.driver.specs.Re_ohm.set(6);
    });

    expect(notifications).toBe(1);
  });

  it('batch() with no write inside it notifies nobody — nothing was pending when it closed', () => {
    const mp = managed();
    let notifications = 0;
    mp.subscribe(() => { notifications += 1; });

    mp.batch(() => {});

    expect(notifications).toBe(0);
  });

  it('recalc()/notifyVentChanged() notify subscribers with no state change of their own', () => {
    const mp = managed();
    let notifications = 0;
    mp.subscribe(() => { notifications += 1; });

    mp.recalc();
    expect(notifications).toBe(1);

    mp.notifyVentChanged();
    expect(notifications).toBe(2);
  });
});

describe('editing a driver — copy, then update or drop', () => {
  const wooferDriver = () => driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  });

  it('leaves the project untouched until the copy is written back', () => {
    const mp = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();

    // What an editor does: take a copy, edit THAT, and only then decide.
    const working = mp.driver.detach();
    working.specs.Fs_hz.set(123);
    expect(mp.driver.specs.Fs_hz.value).toBe(30);   // cancel = just drop `working`

    const second = mp.driver.detach();
    second.specs.Fs_hz.set(61);
    mp.driver.update(second);                        // ok
    expect(mp.driver.specs.Fs_hz.value).toBe(61);
  });

  it('works identically on a standalone driver — the same two calls, whatever the origin', () => {
    const original = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build().driver.detach();

    const working = original.detach();
    working.specs.Fs_hz.set(200);
    expect(original.specs.Fs_hz.value).toBe(30);

    original.update(working);
    expect(original.specs.Fs_hz.value).toBe(200);
  });

  it('update() takes a deep copy — a later edit on the source does not reach the target', () => {
    const target = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build().driver.detach();
    const source = target.detach();
    source.specs.Fs_hz.set(111111);

    target.update(source);
    expect(target.specs.Fs_hz.value).toBe(111111);

    // The source's nested spec object must not still be shared with the target.
    source.specs.Fs_hz.set(222222);
    expect(target.specs.Fs_hz.value).toBe(111111);
  });

  it('setDriver() takes a deep copy — a later edit on the source does not reach the project', () => {
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();
    const source = project.driver.detach();
    source.specs.Fs_hz.set(333333);

    project.setDriver(source);
    expect(project.driver.specs.Fs_hz.value).toBe(333333);

    source.specs.Fs_hz.set(444444);
    expect(project.driver.specs.Fs_hz.value).toBe(333333);
  });

  it('adopting a standalone driver gives the embedded project record a fresh UUID', () => {
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();
    const source = wooferDriver();

    project.loadDriver(source);

    expect(project.driver.uuid()).not.toBe(source.uuid());
  });

  it('discards an edit by dropping the copy — nothing to roll back', () => {
    const original = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build().driver.detach();

    const working = original.detach();
    working.specs.Fs_hz.set(500);
    // no update() — the copy simply goes out of scope

    expect(original.specs.Fs_hz.value).toBe(30);
  });

  it('loadDriver() takes a deep copy — a later edit on the source does not reach the project', () => {
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();
    const source = project.driver.detach();
    source.specs.Fs_hz.set(555555);

    project.loadDriver(source);
    expect(project.driver.specs.Fs_hz.value).toBe(555555);

    source.specs.Fs_hz.set(666666);
    expect(project.driver.specs.Fs_hz.value).toBe(555555);

    expect(() => project.loadDriver(project.driver)).toThrow(/standalone/i);
  });

  it('embedding a driver that states its own c/roo strips them — the project is the sole source', () => {
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();
    project.envTempK.set(250);   // far from the reference default, so a leaked driver value is obvious
    project.envHumidityPct.set(80);
    project.envPressurePa.set(90000);

    const source = wooferDriver();
    source.specs.c_m_per_s.set(999);
    source.specs.roo_kg_per_m3.set(5);

    project.setDriver(source);

    expect(project.driver.specs.c_m_per_s.calculated).toBe(true);
    expect(project.driver.specs.roo_kg_per_m3.calculated).toBe(true);
    const projectAir = new Engine().solveEnvironment({ tempK: 250, humidityPct: 80, pressurePa: 90000 }).values;
    expect(project.driver.specs.c_m_per_s.value).toBeCloseTo(projectAir.c, 6);
    expect(project.driver.specs.roo_kg_per_m3.value).toBeCloseTo(projectAir.rho, 6);
    // Never 999/5 — the driver's own stated pair must not survive embedding.
    expect(project.driver.specs.c_m_per_s.value).not.toBeCloseTo(999, 0);
  });

  it("a stale c/roo already sitting in an embedded driver's record (pre-existing data, or any " +
    'write that bypasses setDriver/loadDriver) is still ignored by both the solver and .wdr export ' +
    "— the project's environment wins regardless of how the stale value got there", () => {
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();
    project.envTempK.set(250);
    project.envHumidityPct.set(80);
    project.envPressurePa.set(90000);

    // Simulate data saved by a version of openisd before the strip existed (`fromOwprText` loads
    // a record directly, bypassing `setDriver`/`loadDriver` entirely, so nothing retroactively
    // clears a value written under the old rules) by writing straight onto the embedded driver's
    // own field — the one other way a stale value could end up here.
    //
    // S2-10: `OpenISDDriverEmbedded.resolve()` now clears `c_m_per_s`/`roo_kg_per_m3` on EVERY
    // resolve (not just on `update()`), so the write below is undone by the SAME synchronous
    // cascade it triggers — there is no longer an intermediate tick where this record
    // observably holds an 'entered' stale pair to assert on; the guarantee is stronger than
    // before, not merely preserved, so that checkpoint is gone rather than weakened.
    project.driver.specs.c_m_per_s.set(999);
    project.driver.specs.roo_kg_per_m3.set(5);

    const projectAir = new Engine().solveEnvironment({ tempK: 250, humidityPct: 80, pressurePa: 90000 }).values;
    const ts = project.driver.specs;
    expect(ts.c_m_per_s.value).toBeCloseTo(projectAir.c, 6);
    expect(ts.roo_kg_per_m3.value).toBeCloseTo(projectAir.rho, 6);

    const { value: wdrText, errors } = project.driver.toWdrIniText(new Engine());
    expect(errors).toEqual([]);
    expect(wdrText).not.toBeNull();
    expect(wdrText).toContain(`c=${projectAir.c}`);
    expect(wdrText).toContain(`roo=${projectAir.rho}`);
    expect(wdrText).not.toContain('c=999');
    expect(wdrText).not.toContain('roo=5\n');
  });

  it('loading a project file gives its embedded driver a fresh project-owned UUID', () => {
    const original = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();
    const originalDriverUuid = original.driver.uuid();

    const loaded = OpenISDProject.fromOwprText(original.toOwprText(), new Engine());
    if (Array.isArray(loaded)) throw new Error(loaded.join(', '));

    expect(loaded.driver.uuid()).not.toBe(originalDriverUuid);
  });

  it('renameToCopy() prefixes the model so the copy is a distinct brand/model', () => {
    const driver = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build().driver.detach();
    expect(driver.model.value).toBe('RS225');

    driver.renameToCopy();
    expect(driver.model.value).toBe('Copy of RS225');
  });

  it('toOwdrText() then OpenISDDriver.fromOwdrText() round-trips a driver through .owdr text', () => {
    const driver = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build().driver.detach();
    driver.specs.Fs_hz.set(41.5);

    const text = driver.toOwdrText();
    expect(typeof text).toBe('string');

    const back = OpenISDDriver.fromOwdrText(text, new Engine());
    if (Array.isArray(back)) throw new Error('fromOwdrText returned problems: ' + back.join(', '));
    expect(back.specs.Fs_hz.value).toBe(41.5);
    expect(back.model.value).toBe('RS225');
  });

  it('.owdr text is JSON, not YAML — the openisd record is JSON text (openisd.json)', () => {
    const driver = wooferDriver();
    const text = driver.toOwdrText();

    expect(() => JSON.parse(text)).not.toThrow();
    expect(text.trimStart().startsWith('{')).toBe(true);
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed.quality).toBeDefined();
    expect(parsed.brand).toBeDefined();
    expect(parsed.specs).toBeDefined();
    expect('uuid' in parsed).toBe(false);
  });

  it('drops the record UUID on .owdr export and mints a new one on import', () => {
    const driver = wooferDriver();
    const originalUuid = driver.cloneDriver().uuid.value;

    const text = driver.toOwdrText();

    expect(text).not.toContain('uuid:');
    const imported = OpenISDDriver.fromOwdrText(text, new Engine());
    if (Array.isArray(imported)) throw new Error(imported.join(', '));
    expect(imported.cloneDriver().uuid.value).not.toBe(originalUuid);
  });

  it('mints a new record UUID when making a named copy', () => {
    const driver = wooferDriver();
    const originalUuid = driver.cloneDriver().uuid.value;

    driver.renameToCopy();

    expect(driver.cloneDriver().uuid.value).not.toBe(originalUuid);
    expect(driver.model.value).toBe('Copy of RS225');
  });

  it('toWdrIniText() then OpenISDDriver.fromWdrIniText() round-trips a driver through WinISD .wdr text', () => {
    const driver = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build().driver.detach();
    driver.specs.Fs_hz.set(41.5);

    const { value: text, errors } = driver.toWdrIniText(new Engine());
    expect(errors.filter((e: DriverError) => e.level === 'error')).toEqual([]);
    if (text === null) throw new Error('toWdrIniText produced no text');

    const back = OpenISDDriver.fromWdrIniText(text, new Engine());
    if (back.value === null) throw new Error('fromWdrIniText returned problems: ' + JSON.stringify(back.errors));
    expect(back.value.specs.Fs_hz.value).toBeCloseTo(41.5, 3);
    expect(back.value.model.value).toBe('RS225');
  });

  it('toWprText() then OpenISDProject.fromWprText() round-trips a project through WinISD .wpr text', () => {
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();

    const { value: text, errors } = project.toWprText(new Engine());
    expect(errors.filter((e: DriverError) => e.level === 'error')).toEqual([]);
    if (text === null) throw new Error('toWprText produced no text');

    const back = OpenISDProject.fromWprText(text, new Engine());
    if (back.value === null) throw new Error('fromWprText returned problems: ' + JSON.stringify(back.errors));
    expect(back.value.box.boxType.value).toBe('sealed');
    expect(back.value.driver.model.value).toBe('RS225');
  });

  it('toWprText() answers value:null with errors for a box type .wpr cannot express (bandpass6)', () => {
    const project = OpenISDProject.builder(wooferDriver(), new Engine())
      .bandpass6().rearVolume_m3(0.02).rearTuning_hz(50).frontVolume_m3(0.03).frontTuning_hz(40).build();

    const { value: text, errors } = project.toWprText(new Engine());
    expect(text).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('clonePassiveRadiator() gives the record back, deep-cloned so an edit after the call cannot reach it', () => {
    const pr = OpenISDPassiveRadiatorStandalone.fromConformingRecord(driverJson({
      brand: 'SB Acoustics', model: 'SB23PACS', section: 'passive-radiator',
      spec: prSpecSection({ Fs_hz: 12, Sd_m2: 0.025, Cms_m_per_N: 0.0009, Mmd_kg: 0.09, Rms_Ns_per_m: 1.5, Xmax_m: 0.015 }),
    }), new Engine());
    if (Array.isArray(pr)) throw new Error('fixture radiator must conform: ' + pr.join('; '));

    const stored = pr.clonePassiveRadiator();
    pr.model.set('changed after the clone');

    const back = OpenISDPassiveRadiatorStandalone.fromConformingRecord(stored, new Engine());
    if (Array.isArray(back)) throw new Error('the cloned record must conform: ' + back.join('; '));
    expect(back.model.value).toBe('SB23PACS');
  });

  it('toOwprText() then OpenISDProject.fromOwprText() round-trips a project through .owpr text', () => {
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();
    project.name.set('Kitchen sub');
    project.description.set('111111');

    const text = project.toOwprText();
    expect(typeof text).toBe('string');

    const back = OpenISDProject.fromOwprText(text, new Engine());
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.name.value).toBe('Kitchen sub');
    expect(back.description.value).toBe('111111');
    expect(back.box.boxType.value).toBe('sealed');
  });

  it('OpenISDProject.fromOwprText() answers with problems rather than throwing on text that is not a project', () => {
    const back = OpenISDProject.fromOwprText('{"nope":1}', new Engine());
    if (!Array.isArray(back)) throw new Error('expected problems, got a project');
    expect(back.length).toBeGreaterThan(0);
  });

  it('a saved project with a driver in the radiator slot, or a radiator in the driver slot, is refused', () => {
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();
    const parsed = JSON.parse(project.toOwprText());
    const driverRecord = parsed.saved.driverEmbedding.device;
    const radiatorRecord = parsed.saved.box.passiveRadiator.component;

    parsed.saved.box.passiveRadiator.component = driverRecord;
    const driverInRadiatorSlot = OpenISDProject.fromOwprText(JSON.stringify(parsed), new Engine());
    expect(driverInRadiatorSlot).toEqual(expect.arrayContaining([expect.stringMatching(/radiator slot holds a driver record/)]));

    parsed.saved.box.passiveRadiator.component = radiatorRecord;
    parsed.saved.driverEmbedding.device = radiatorRecord;
    const radiatorInDriverSlot = OpenISDProject.fromOwprText(JSON.stringify(parsed), new Engine());
    expect(radiatorInDriverSlot).toEqual(expect.arrayContaining([expect.stringMatching(/driver slot holds a passive-radiator record/)]));
  });

  it('OpenISDProject.fromOwprText() answers with problems rather than throwing on text that is not JSON', () => {
    const back = OpenISDProject.fromOwprText('not json at all', new Engine());
    if (!Array.isArray(back)) throw new Error('expected problems, got a project');
    expect(back.length).toBeGreaterThan(0);
  });

  it('a signal record stating nothing loads with P N', () => {
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();
    const parsed = JSON.parse(project.toOwprText());
    parsed.saved.signal = {};

    const back = OpenISDProject.fromOwprText(JSON.stringify(parsed), new Engine());
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.powerDrive_W.value).toBe(null);
    expect(back.powerDrive_W.value).toBeNull();
  });

  it('OpenISDDriver.fromOwdrText() answers with problems rather than throwing on JSON that is not an object', () => {
    const back = OpenISDDriver.fromOwdrText('42', new Engine());
    if (!Array.isArray(back)) throw new Error('expected problems, got a driver');
    expect(back.length).toBeGreaterThan(0);
  });

  it('OpenISDDriver.fromOwdrText() answers with problems naming the parse failure on text that is not JSON', () => {
    const back = OpenISDDriver.fromOwdrText('{not json', new Engine());
    if (!Array.isArray(back)) throw new Error('expected problems, got a driver');
    expect(back.some(p => p.includes('not valid JSON'))).toBe(true);
  });

  it('OpenISDDriver.fromOwdrText() refuses text that parses fine but is a radiator record, not a driver\'s', () => {
    const {uuid: _uuid, ...radiatorJsonWithoutUuid} = driverJson({
      brand: 'SB Acoustics', model: 'SB23PACS', section: 'passive-radiator',
      spec: prSpecSection({ Fs_hz: 12, Sd_m2: 0.025, Cms_m_per_N: 0.0009, Mmd_kg: 0.09, Rms_Ns_per_m: 1.5, Xmax_m: 0.015 }),
    });

    const back = OpenISDDriver.fromOwdrText(JSON.stringify(radiatorJsonWithoutUuid), new Engine());
    if (!Array.isArray(back)) throw new Error('expected problems, got a driver');
    expect(back.some(p => p.includes('no woofer section'))).toBe(true);
  });

  it('a driver.yml-only key (definition) present on imported .owdr text is stripped, not refused', () => {
    const driver = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build().driver.detach();
    const parsed = JSON.parse(driver.toOwdrText());
    parsed.definition = 'driver.yml only describes what a field means — never reaches an openisd record';

    const back = OpenISDDriver.fromOwdrText(JSON.stringify(parsed), new Engine());
    if (Array.isArray(back)) throw new Error('fromOwdrText returned problems: ' + back.join(', '));
    expect(back.model.value).toBe('RS225');
  });

  it('toWprText() takes a SNAPSHOT — the project it was called on is not held by the converter', () => {
    // The whole point of the method form: the domain passes ITSELF to the WinISD converter, so a
    // live project never crosses out of the domain into a format package. Writing the file must
    // therefore leave the project exactly as it was.
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();
    project.description.set('before');

    project.toWprText(new Engine());

    expect(project.description.value).toBe('before');
    expect(project.box.boxType.value).toBe('sealed');
  });

});

describe('OpenISDDriver — provenance the driver picker reads', () => {
  const driverWithProvenance = () => {
    const base = driverJson({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });
    const record = {
      ...base,
      series: scraped('Reference Series'),
      description: scraped('an 8 inch reference woofer'),
      data_sources: { value: {
        manufacturer_datasheet: 'https://example.invalid/ds.pdf',
        manufacturer_product_page: 'https://example.invalid/product',
      } },
    };
    const result = OpenISDDriver.fromConformingRecord(record, new Engine());
    if (Array.isArray(result)) throw new Error(`fixture invalid: ${result.join(', ')}`);
    return result;
  };

  it('dataSource(role) returns the recorded URL for that role, or null when absent', () => {
    const driver = driverWithProvenance();
    expect(driver.dataSource('manufacturer_datasheet')).toBe('https://example.invalid/ds.pdf');
    expect(driver.dataSource('manufacturer_product_page')).toBe('https://example.invalid/product');
    expect(driver.dataSource('manufacturer_listing_page')).toBeNull();
  });

  it('series / description read straight off the record as read-only cells', () => {
    const driver = driverWithProvenance();
    // Catalogue facts carry no provenance: a bare `Readable`, so `value` is the whole read.
    expect(driver.series.value).toBe('Reference Series');
    expect(driver.description.value).toBe('an 8 inch reference woofer');
  });

  it('sku reads straight off the record, and the editor can write it', () => {
    const driver = driverWithProvenance();
    // sku is schema-guaranteed (derivedFieldOf(z.string())) — never not-available, so its
    // `value` is plain `string`, not `string | null`, with no null-check needed to prove it.
    const sku: string = driver.sku.value;
    expect(sku).toBe('TEST-SKU');
  });

  it('series and description are not-available when the record omits them', () => {
    const driver = driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });
    expect(driver.series.value).toBeNull();
    expect(driver.series.value).toBe(null);
    expect(driver.description.value).toBeNull();
    expect(driver.description.value).toBe(null);
  });
});

describe('a new project, every section present and nothing stated', () => {
  // QO125 (John, 2026-09-08): "The data structure in emptyProject(eng) calls emptyDriver(eng)
  // and empty pr(eng) and then UI proceeds to fill it out in the wizard screens including
  // picking a real driver to repopulate the embedded driver section from and if it's a pr box
  // then the pr gets repopulated from a picked pr."
  //
  // So a new project invents no physics. Every section EXISTS — the wizard writes into a live
  // project rather than assembling a spec and building at the end — and every stated value is
  // one the user supplied.

  it('builds without a driver, since the wizard picks one afterwards', () => {
    const p = OpenISDProject.empty(new Engine());
    expect(p.driver.brand.value).toBe('');
    expect(p.driver.specs.Fs_hz.value).toBe(null);
  });

  it('starts sealed, the box type the wizard opens on', () => {
    expect(OpenISDProject.empty(new Engine()).box.boxType.value).toBe('sealed');
  });

  it('holds a radiator already, so a switch to a PR box is legal with no further setup', () => {
    const p = OpenISDProject.empty(new Engine());
    // Writing a radiator spec field is what throws when the slot is null, so it is the test
    // that a radiator is genuinely present rather than merely reported as one.
    p.box.passiveRadiator.radiator.spec.Fs_hz.set(12);
    expect(p.box.passiveRadiator.radiator.spec.Fs_hz.value).toBe(12);
  });

  it('states no radiator parameters of its own', () => {
    const p = OpenISDProject.empty(new Engine());
    expect(p.box.passiveRadiator.radiator.spec.Fs_hz.value).toBe(null);
    expect(p.box.passiveRadiator.systemTuning_hz.value).toBeNull();
  });

  it('gives each new project its own records, so editing one leaves the next untouched', () => {
    const engine = new Engine();
    const one = OpenISDProject.empty(engine);
    const two = OpenISDProject.empty(engine);
    one.driver.model.set('RS225');
    expect(two.driver.model.value).toBe('');
  });

  it('stamps created/modified from the injected AppContext, and creator from the platform user, including the embedded driver', () => {
    const appContext = fixedAppContext('id', '2026-03-04T00:00:00.000Z', 'johnl');
    const p = OpenISDProject.empty(new Engine(), appContext);

    expect(p.created.value).toBe('20260304');
    expect(p.modified.value).toBe('20260304');
    expect(p.creator.value).toBe('johnl');
    expect(p.driver.added.value).toBe('20260304');
    expect(p.driver.providedBy.value).toBe('johnl');
  });

  it('leaves creator blank when the platform user is not known', () => {
    const p = OpenISDProject.empty(new Engine(), fixedAppContext('id', '2026-03-04T00:00:00.000Z', null));
    expect(p.creator.value).toBe('');
  });

  it('accepts a real driver afterwards, which is how the wizard fills it in', () => {
    const p = OpenISDProject.empty(new Engine());
    const picked = OpenISDDriver.empty(new Engine());
    picked.brand.set('Dayton');
    picked.model.set('RS225');
    p.setDriver(picked);
    expect(p.driver.brand.value).toBe('Dayton');
  });

  it('accepts a real radiator afterwards, which is how the wizard fills a PR box in', () => {
    const p = OpenISDProject.empty(new Engine());
    const picked = OpenISDPassiveRadiatorStandalone.empty(new Engine());
    picked.model.set('SB23PACS');
    p.box.passiveRadiator.configurePR(picked);
    expect(p.box.passiveRadiator.radiator.model.value).toBe('SB23PACS');
  });
});

describe("a blank device reports WinISD's own defaults without stating them", () => {
  // John, 2026-09-08: "use the existing WinIsd default values - but some of these are functions
  // like calcVcCon() ... which isn't really a calc but plays that role if the VCCon isn't yet
  // stated". The default reads as CALCULATED, never entered — and since John's 2026-09-24
  // ruling ("simply no reason for these exceptions to the rule") the record carries it as a
  // real `'C'` entry, the same as every other derived quantity, instead of being conjured at
  // read time. See `bugs/BUG_20260924_defaulted-fields-are-neither-marked-nor-recorded.md`.

  it('reads the default wiring as calculated, not as something the user entered', () => {
    const blank = OpenISDDriver.empty(new Engine());
    const wiring = blank.specs.VCCon;
    expect(wiring.value).toBe(VoiceCoilWiring.Parallel);
    expect(wiring.calculated).toBe(true);
  });

  it('reads the default coil count the same way', () => {
    const numVC = OpenISDDriver.empty(new Engine()).specs.numVC;
    expect(numVC.value).toBe(1);
    expect(numVC.calculated).toBe(true);
  });

  it('a field with no WinISD default stays genuinely unstated', () => {
    // The defaults are specific facts, not a blanket "fill everything in" — SPEC_ENGINE.md:424
    // says "Defaults are 0, except numVC=1, VCCon=1", and Fs is not among the exceptions.
    expect(OpenISDDriver.empty(new Engine()).specs.Fs_hz.value).toBe(null);
  });

  it('VCCon is entry-backed: the calcVCCon() default is STORED as a calculated entry, not read-time', () => {
    const blank = OpenISDDriver.empty(new Engine());
    expect(wooferOf(blank.cloneDriver())?.VCCon).toMatchObject({ state: 'C', value: 1 });
    expect(blank.specs.VCCon.value).toBe(VoiceCoilWiring.Parallel);
    expect(blank.specs.VCCon.calculated).toBe(true);
    expect(blank.specs.VCCon.entered).toBe(false);
  });

  it('numVC is entry-backed: the calcNumVC() default is STORED as a calculated entry, not read-time', () => {
    const blank = OpenISDDriver.empty(new Engine());
    expect(wooferOf(blank.cloneDriver())?.numVC).toMatchObject({ state: 'C', value: 1 });
    expect(blank.specs.numVC.value).toBe(1);
    expect(blank.specs.numVC.calculated).toBe(true);
    expect(blank.specs.numVC.entered).toBe(false);
  });

  it('an entered numVC is stored as an E entry, and clearing it restores the stored C default', () => {
    const d = OpenISDDriver.empty(new Engine());
    d.specs.numVC.set(4);
    expect(wooferOf(d.cloneDriver())?.numVC).toMatchObject({ state: 'E', value: 4 });
    expect(d.specs.numVC.entered).toBe(true);

    d.specs.numVC.clear();
    expect(wooferOf(d.cloneDriver())?.numVC).toMatchObject({ state: 'C', value: 1 });
    expect(d.specs.numVC.value).toBe(1);
    expect(d.specs.numVC.calculated).toBe(true);
  });

  it('solverParams adapts VCCon to the plain series/parallel wiring Engine.sweep()/maxCurves() take, both ways', () => {
    const blank = OpenISDDriver.empty(new Engine());
    expect(blank.solverParams.wiring.value).toBe('parallel');

    blank.specs.VCCon.set(VoiceCoilWiring.Series);
    expect(blank.solverParams.wiring.value).toBe('series');
  });

  it('solverParams\' adapted Re_terminal_ohm/BL_terminal_Tm/wiring slots silently discard any write — ' +
    'S2-10: nothing persists a value neither a resolve nor the domain has a slot for', () => {
    const blank = OpenISDDriver.empty(new Engine());
    const params = blank.solverParams;

    // `wiring` is a `SolverInput`: read only, no write for a solve to reach.
    expect('setCalculated' in params.wiring).toBe(false);
    expect(params.wiring.value).toBe('parallel');

    expect(() => params.Re_terminal_ohm.setCalculated(8, [ignoredIssue('ignored')])).not.toThrow();
    expect(() => params.BL_terminal_Tm.setNotAvailable()).not.toThrow();
  });
});

describe('a spec field the record does not state resolves on write (T11/S2-7c)', () => {
  // T11 (2026-09-16) supersedes the earlier QO127 "stated-only" ruling: a driver's own writes
  // now trigger a resolve that writes every derivable field back into the record as `'C'` —
  // the record itself is a cache the solver keeps current, not a value computed fresh at read
  // time and never stored.

  /** A driver stating Vas and Sd and nothing else derivable — the solver's geometry route to
   *  Cms (`solver.ts` block 4) needs exactly those two plus the air constants, which a driver
   *  always has. */
  function vasAndSd(): OpenISDDriver {
    const d = OpenISDDriver.empty(new Engine());
    d.specs.Vas_m3.set(0.05);
    d.specs.Sd_m2.set(0.02);
    return d;
  }

  it('Cms comes back calculated from the stated Vas and Sd', () => {
    const cms = vasAndSd().specs.Cms_m_per_N;
    expect(cms.calculated).toBe(true);
    // Cms = Vas / (ρ·c²·Sd²) — the same relation, evaluated here from the driver's own air
    // constants rather than from a constant copied into this test.
    const air = vasAndSd().specs;
    const rho = air.roo_kg_per_m3.value!;
    const c = air.c_m_per_s.value!;
    expect(cms.value).toBeCloseTo(0.05 / (rho * c * c * 0.02 * 0.02), 12);
  });

  it('a stated value still reads entered — the solver never overrides what the record says', () => {
    const d = vasAndSd();
    d.specs.Cms_m_per_N.set(0.000123);
    const cms = d.specs.Cms_m_per_N;
    expect(cms.entered).toBe(true);
    expect(cms.value).toBe(0.000123);
  });

  it('a field the solver cannot reach stays not-available', () => {
    // Nothing in the record implies Xmax, so the distinction between "absent" and "derived"
    // survives — a solver that answered everything would be no better than a blank.
    expect(vasAndSd().specs.Xmax_m.value).toBe(null);
  });

  it('the solved value IS written into the record, as a calculated entry (T11)', () => {
    // The whole point of T11: a resolve runs on every write, and a derivable field's cell is
    // backed by a real `'C'` entry in the record — not recomputed fresh at every read with
    // nothing persisted.
    const d = vasAndSd();
    const entry = wooferOf(d.cloneDriver())?.Cms_m_per_N;
    expect(entry).toMatchObject({ state: 'C' });
    expect(entry?.value).toBeCloseTo(d.specs.Cms_m_per_N.value!, 12);
  });

  it('changing a stated input changes what the derived field reports', () => {
    // A cached solve that never invalidated would pass every test above and still be wrong.
    const d = vasAndSd();
    const before = d.specs.Cms_m_per_N.value!;
    d.specs.Vas_m3.set(0.10);
    expect(d.specs.Cms_m_per_N.value!).toBeCloseTo(before * 2, 12);
  });
});

describe('OpenISDDriver — resolves on every write (S2-7c)', () => {
  /** Qes+Qms entered, nothing else — Qts = Qes·Qms/(Qes+Qms) is the one relation this can
   *  derive; every OTHER relation needs at least one field this driver never states. */
  function qesQms(): OpenISDDriver {
    const d = OpenISDDriver.empty(new Engine());
    d.specs.Qes.set(0.4);
    d.specs.Qms.set(3.0);
    return d;
  }

  it('a derivable field is written into the record as a calculated entry right after construction', () => {
    const d = qesQms();
    const entry = wooferOf(d.cloneDriver())?.Qts;
    expect(entry).toMatchObject({ state: 'C' });
    expect(entry?.value).toBeCloseTo((0.4 * 3.0) / (0.4 + 3.0), 12);
  });

  it('setting a field the record already resolved from changes the dependent calculated entry', () => {
    const d = qesQms();
    d.specs.Qms.set(6.0);
    const entry = wooferOf(d.cloneDriver())?.Qts;
    expect(entry?.value).toBeCloseTo((0.4 * 6.0) / (0.4 + 6.0), 12);
  });

  it('an entered Qts survives a resolve untouched, even though it disagrees with Qes/Qms', () => {
    const d = qesQms();
    d.specs.Qts.set(111111);
    const entry = wooferOf(d.cloneDriver())?.Qts;
    // Not `toEqual`: S2-7d2 also projects the group's formula dq onto every disagreeing field —
    // a real, separate fact from what this test is pinning (the VALUE is never overwritten).
    expect(entry).toMatchObject({ state: 'E', value: 111111 });
  });

  it('clearing a field the resolve depended on removes the now-underivable calculated entry', () => {
    const d = qesQms();
    expect(wooferOf(d.cloneDriver())?.Qts).toMatchObject({ state: 'C' });
    d.specs.Qes.clear();
    expect(wooferOf(d.cloneDriver())?.Qts).toBeUndefined();
    expect(d.specs.Qts.value).toBe(null);
  });

  it('exactly one engine.solveDriver call happens per field set()', () => {
    const engine = new Engine();
    const d = OpenISDDriver.empty(engine);
    d.specs.Qes.set(0.4);
    const spy = vi.spyOn(engine, 'solveDriver');
    d.specs.Qms.set(3.0);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('a not-entered c_m_per_s lands in the record as a calculated entry equal to the driver\'s own air', () => {
    const engine = new Engine();
    const d = OpenISDDriver.empty(engine);
    const air = engine.solveEnvironment({}).values;
    const entry = wooferOf(d.cloneDriver())?.c_m_per_s;
    expect(entry).toMatchObject({ state: 'C', value: air.c });
  });

  // VCCon follows the same route as c_m_per_s above: the default is a STORED 'C' entry, so a
  // saved driver states its wiring instead of leaving the reader to guess the app's default.
  // John, 2026-09-24: "simply no reason for these exceptions to the rule".

  it('an entered VCCon is stored as an entered entry and survives a later resolve', () => {
    const d = OpenISDDriver.empty(new Engine());
    d.specs.VCCon.set(VoiceCoilWiring.Series);
    d.specs.Qes.set(0.4);
    expect(wooferOf(d.cloneDriver())?.VCCon).toMatchObject({ state: 'E', value: 2 });
    expect(d.specs.VCCon.entered).toBe(true);
    expect(d.specs.VCCon.value).toBe(VoiceCoilWiring.Series);
  });

  it('clearing VCCon restamps the calculated default rather than leaving the record silent', () => {
    const d = OpenISDDriver.empty(new Engine());
    d.specs.VCCon.set(VoiceCoilWiring.Series);
    d.specs.VCCon.clear();
    expect(wooferOf(d.cloneDriver())?.VCCon).toMatchObject({ state: 'C', value: 1 });
    expect(d.specs.VCCon.calculated).toBe(true);
  });

  it('a record stating VCCon=2 reads back as an entered series wiring, not as the default', () => {
    const d = OpenISDDriver.empty(new Engine());
    d.specs.VCCon.set(VoiceCoilWiring.Series);
    const reopened = d.detach();
    expect(reopened.specs.VCCon.value).toBe(VoiceCoilWiring.Series);
    expect(reopened.specs.VCCon.entered).toBe(true);
    expect(wooferOf(reopened.cloneDriver())?.VCCon).toMatchObject({ state: 'E', value: 2 });
  });
});

describe('OpenISDDriverStandalone.setAutoCalculate — freezes the resolve cascade (driver editor only)', () => {
  function standaloneEmpty(engine: Engine): OpenISDDriverStandalone {
    const d = OpenISDDriver.empty(engine);
    if (!(d instanceof OpenISDDriverStandalone)) throw new Error('OpenISDDriver.empty() always returns a standalone driver');
    return d;
  }

  it('defaults to on', () => {
    const d = standaloneEmpty(new Engine());
    expect(d.autoCalculate).toBe(true);
  });

  it('off freezes a calculated field at its last value when the input it depended on is cleared', () => {
    const d = standaloneEmpty(new Engine());
    d.specs.Fs_hz.set(40);
    d.specs.Cms_m_per_N.set(0.001);
    const derivedMms = d.specs.Mms_kg.value;
    expect(derivedMms).not.toBeNull();

    d.setAutoCalculate(false);
    d.specs.Cms_m_per_N.clear();

    expect(d.specs.Cms_m_per_N.value).toBe(null);
    expect(d.specs.Mms_kg.value).toBe(derivedMms);
  });

  it('turning back on immediately re-derives, dropping a value that can no longer be reached', () => {
    const d = standaloneEmpty(new Engine());
    d.specs.Fs_hz.set(40);
    d.specs.Cms_m_per_N.set(0.001);
    d.setAutoCalculate(false);
    d.specs.Cms_m_per_N.clear();

    d.setAutoCalculate(true);

    expect(d.specs.Mms_kg.value).toBe(null);
  });

  it('entering a new value while off is still accepted — off blocks the solver, not the owner', () => {
    const d = standaloneEmpty(new Engine());
    d.setAutoCalculate(false);
    d.specs.Fs_hz.set(55);
    expect(d.specs.Fs_hz.value).toBe(55);
    expect(d.specs.Fs_hz.entered).toBe(true);
  });
});

describe('OpenISDProject — the driver cascade resolves on every write (S2-7d1)', () => {
  /** A saved project whose embedded driver states ONLY Qes+Qms — Qts is the one relation it can
   *  derive. Built via the ordinary `.builder().build()` path (which itself calls `save()`), then
   *  re-wrapped through `OpenISDProject.wrap()` — the entry point this task adds a resolve to —
   *  so these tests exercise `wrap()` itself, not merely the builder's own already-passing path. */
  function qesQmsProject(engine: Engine): OpenISDProject {
    const driver = OpenISDDriver.empty(engine);
    driver.specs.Qes.set(0.4);
    driver.specs.Qms.set(3.0);
    const built = OpenISDProject.builder(driver, engine).sealed().volume_m3(0.03).build();
    return OpenISDProject.wrap(built.cloneSession().saved, engine);
  }

  it('wrap() resolves the driver once, and the project is not modified by it', () => {
    const engine = new Engine();
    const project = qesQmsProject(engine);
    const qts = project.driver.specs.Qts;
    expect(qts.calculated).toBe(true);
    expect(qts.value).toBeCloseTo((0.4 * 3.0) / (0.4 + 3.0), 12);
    expect(project.isModified()).toBe(false);
  });

  it('setting a driver field the project resolved from changes the dependent calculated entry, and modifies the project', () => {
    const engine = new Engine();
    const project = qesQmsProject(engine);
    project.driver.specs.Qms.set(6.0);
    const qts = project.driver.specs.Qts;
    expect(qts.value).toBeCloseTo((0.4 * 6.0) / (0.4 + 6.0), 12);
    expect(project.isModified()).toBe(true);
  });

  it('exactly one engine.solveDriver call per field set(), and zero for a bare project.driver read', () => {
    const engine = new Engine();
    const project = qesQmsProject(engine);
    const readSpy = vi.spyOn(engine, 'solveDriver');
    void project.driver;
    void project.driver.specs.Fs_hz;
    expect(readSpy).toHaveBeenCalledTimes(0);
    readSpy.mockRestore();

    const writeSpy = vi.spyOn(engine, 'solveDriver');
    project.driver.specs.Qms.set(6.0);
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  it('a what-if edit lands its own calculated values in the what-if layer; resetWhatIf returns to the committed ones', () => {
    const engine = new Engine();
    const project = qesQmsProject(engine);
    const committedQts = project.driver.specs.Qts.value;

    project.beginWhatIf();
    project.driver.specs.Qms.set(6.0);
    const whatIfQts = project.driver.specs.Qts.value;
    expect(whatIfQts).toBeCloseTo((0.4 * 6.0) / (0.4 + 6.0), 12);
    expect(whatIfQts).not.toBeCloseTo(committedQts!, 6);

    project.resetWhatIf();
    expect(project.driver.specs.Qts.value).toBeCloseTo(committedQts!, 12);
  });

  it('a what-if edit on a top-level slot field (not a driver field) lands in the what-if layer, not the committed one', () => {
    const engine = new Engine();
    const project = qesQmsProject(engine);
    project.name.set('Committed name');
    project.save();

    project.beginWhatIf();
    project.name.set('What-if name');
    expect(project.name.value).toBe('What-if name');

    project.cancelWhatIf();
    expect(project.name.value).toBe('Committed name');
  });

  it('save() does not disturb the already-resolved derived values', () => {
    const engine = new Engine();
    const project = qesQmsProject(engine);
    project.driver.specs.Qms.set(6.0);
    const beforeSave = project.driver.specs.Qts.value;

    project.save();

    expect(project.driver.specs.Qts.value).toBeCloseTo(beforeSave!, 12);
    expect(project.isModified()).toBe(false);
  });
});

describe('T1 — the vent/PR sweep-level guards (PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS)', () => {
  // A CIRCUIT-COMPLETE driver (the store's `store-issue-channel.test.ts` clean-fixture field
  // set): Qts derived from stated Qes/Qms so nothing can contradict, Mms/Rms/Bl/Cms derived by
  // the solver, and Re stated — sweeping is possible at all, so the vent/PR guards below are
  // the ONLY expected blockers.
  const project = (box: 'vented' | 'bp4' | 'pr') => {
    let p: OpenISDProject;
    if (box === 'pr') {
      p = OpenISDProject.builder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: tuneSpec({ Fs_hz: 37, Vas_m3: 0.0300, Qes: 0.40, Qms: 7.0, Re_ohm: 5.6 }),
      }), new Engine())
        .passiveRadiator().volume_m3(0.05).tuning_goal_hz(45)
        .radiator(radiator())
        .build();
    } else {
      p = OpenISDProject.builder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: tuneSpec({ Fs_hz: 37, Vas_m3: 0.0300, Qes: 0.40, Qms: 7.0, Re_ohm: 5.6 }),
      }), new Engine()).vented().volume_m3(0.05).tuning_goal_hz(40).build();
    }
    const w = p.driver.specs;
    w.Sd_m2.set(0.0133);
    w.Le_H.set(0.70e-3);
    w.Xmax_m.set(0.0050);
    w.Pe_W.set(60);
    return p;
  };
  const radiatorJson = () => driverJson({
    brand: 'SB Acoustics', model: 'SB23PACS', section: 'passive-radiator',
    spec: prSpecSection({ Fs_hz: 12, Sd_m2: 0.025, Cms_m_per_N: 0.0009, Mmd_kg: 0.09, Rms_Ns_per_m: 1.5, Xmax_m: 0.015 }),
  });
  const radiator = () => {
    const r = OpenISDPassiveRadiatorStandalone.fromConformingRecord(radiatorJson(), new Engine());
    if (Array.isArray(r)) throw new Error(`fixture radiator is invalid: ${r.join(', ')}`);
    return r;
  };

  it('a vented project with no tuning_goal_hz and no length_m reports a blocking VentIssue, not NaN curves', () => {
    // The silent-gap finding this closes: an unsized vent port produced `sweep().issues === []`
    // while zmag/zph/exc went NaN, and only the UI's generic classifyFinite postcondition ever
    // complained. The sweep must name the unstated vent target itself.
    const p = project('vented');
    p.box.vented.tuning_goal_hz.clear();
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.diameter_m.set(0.1);

    const result = p.sweep({ fmin: 10, fmax: 100, N: 10 });
    expect(result.values).toBeNull();
    const issue = result.issues[0];
    expect(issue).toBeDefined();
    expect(issue).toMatchObject({ kind: 'missing-dependencies' });
    if (issue.kind === 'missing-dependencies') {
      expect(issue.target).toBe('length_m');
      expect([...issue.routes[0].required].sort()).toEqual(['Vb_m3', 'area_m2', 'tuning_goal_hz']);
      expect(issue.routes[0].missing).toContain('tuning_goal_hz');
    }
  });

  it('a vented project with an inconsistent (negative) tuning_goal_hz reports the cached solveVent issue on both sweep() and maxCurves()', () => {
    const p = project('vented');
    p.box.vented.tuning_goal_hz.set(-5);

    const sw = p.sweep({ fmin: 10, fmax: 100, N: 10 });
    expect(sw.values).toBeNull();
    expect(sw.issues.length).toBeGreaterThan(0);

    const mx = p.maxCurves({ fmin: 10, fmax: 100, N: 10 });
    expect(mx.values).toBeNull();
    expect(mx.issues.length).toBeGreaterThan(0);
  });

  it('ventAchievedFb/ventMaxReachableFb answer not-available when the box is not vented', () => {
    const p = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: tuneSpec({ Fs_hz: 37, Vas_m3: 0.0300, Qes: 0.40, Qms: 7.0, Re_ohm: 5.6 }),
    }), new Engine()).sealed().volume_m3(0.02).build();

    expect(p.ventAchievedFb.value).toBeNull();
    expect(p.ventAchievedFb.value).toBe(null);
    expect(p.ventMaxReachableFb.value).toBeNull();
    expect(p.ventMaxReachableFb.value).toBe(null);
    expect(p.box.vented.vent.length_m.dq.some(issue => issue.kind === 'target-unreachable')).toBe(false);
  });

  it('ventAchievedFb/ventMaxReachableFb answer not-available while the vent geometry is unstated', () => {
    const p = project('vented');

    expect(p.ventAchievedFb.value).toBeNull();
    expect(p.ventMaxReachableFb.value).toBeNull();
  });

  it('ventAchievedFb/ventMaxReachableFb report calculated readouts once the vent geometry is complete', () => {
    const p = project('vented');
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.diameter_m.set(0.1);

    expect(p.ventAchievedFb.calculated).toBe(true);
    expect(p.ventAchievedFb.value).not.toBeNull();
    expect(p.ventMaxReachableFb.calculated).toBe(true);
    // The L=0 ceiling is always at or above whatever length>0 the vent currently achieves.
    expect(p.ventMaxReachableFb.value!).toBeGreaterThan(p.ventAchievedFb.value!);
  });

  it('an unreachable entered tuning writes null and a target-unreachable dq mark onto length_m, cleared once reachable again', () => {
    const p = project('vented');
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.diameter_m.set(0.1);

    expect(p.box.vented.vent.length_m.dq.some(issue => issue.kind === 'target-unreachable')).toBe(false);

    // Same physics as boxDesign.ts#ventLength's doc comment: past some tuning, for this volume
    // and port area, the only solution for length is negative — the target is unreachable.
    p.box.vented.tuning_goal_hz.set(200);

    expect(p.box.vented.vent.length_m.value).toBeNull();
    expect(p.box.vented.vent.length_m.dq.some(issue => issue.kind === 'target-unreachable')).toBe(true);

    p.box.vented.tuning_goal_hz.set(40);
    expect(p.box.vented.vent.length_m.value).toBeGreaterThan(0);
    expect(p.box.vented.vent.length_m.dq.some(issue => issue.kind === 'target-unreachable')).toBe(false);
  });

  it('a passive-radiator project missing PR mass reports a blocking PrIssue, not NaN curves', () => {
    // The radiator is configured and the resonance TARGET (tuning_goal_hz) is stated, but the
    // radiator's own mass (`Mms` → `prMmd_kg`) is missing — the geometry the addedMass route
    // needs. `checkPrConsistency` fires because a target WAS stated; this is the "missing PR
    // mass" case of the plan. (A radiator with no target at all still sweeps un-tuned — pinned
    // by engine-wiring.test.ts — so that case must stay silent.)
    const p = project('pr');
    p.box.passiveRadiator.radiator.spec.Mms_kg.clear();

    const result = p.sweep({ fmin: 10, fmax: 100, N: 10 });
    expect(result.values).toBeNull();
    const issue = result.issues[0];
    expect(issue).toBeDefined();
    expect(issue).toMatchObject({ kind: 'missing-dependencies' });
    if (issue.kind === 'missing-dependencies') {
      expect(issue.target).toBe('addedMass_kg');
      expect([...issue.routes[0].required].sort().join(',')).toBe('Vb_m3,prCms_m_per_N,prMmd_kg,prSd_m2,tuning_goal_hz');
      expect(issue.routes[0].missing).toEqual(['prMmd_kg']);
    }
  });

  it('stating the tuning clears the vent guard — the sweep runs', () => {
    const p = project('vented');
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.diameter_m.set(0.1);

    const result = p.sweep({ fmin: 10, fmax: 100, N: 10 });
    expect(result.values).not.toBeNull();
    expect(result.issues).toEqual([]);
  });

  it('two ports of the same size at the same tuning move the same air through twice the opening — port velocity halves', () => {
    const p = project('vented');
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.diameter_m.set(0.1);
    const one = p.sweep({ fmin: 10, fmax: 100, N: 10 });
    p.box.vented.vent.count.set(2);
    const two = p.sweep({ fmin: 10, fmax: 100, N: 10 });
    if (one.values === null || two.values === null) throw new Error('sweep did not run');
    const i = 5;
    expect(one.values.pv[i]).toBeGreaterThan(0);
    expect(two.values.pv[i]).toBeCloseTo(one.values.pv[i] / 2, 9);
  });
});

describe('S2-7d2 — vent + PR join the cascade', () => {
  const ventedProjectWithArea = () => {
    const p = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).vented().volume_m3(0.05).tuning_goal_hz(40).build();
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.diameter_m.set(0.1);
    return p;
  };

  it('(a) a vented project with tuning entered gets its port length solved into the record', () => {
    const p = ventedProjectWithArea();
    const cell = p.box.vented.vent.length_m;
    expect(cell.calculated).toBe(true);
    expect(cell.value).not.toBeNull();
  });

  it('(b) entering the length instead re-derives the tuning and drops the old entered target', () => {
    const p = ventedProjectWithArea();
    p.box.vented.vent.length_m.set(0.3);
    const lengthCell = p.box.vented.vent.length_m;
    const tuningCell = p.box.vented.tuning_goal_hz;
    expect(lengthCell.entered).toBe(true);
    expect(lengthCell.value).toBe(0.3);
    expect(tuningCell.calculated).toBe(true);
    expect(tuningCell.value).not.toBeCloseTo(40, 0);
  });

  const prProject = () => {
    const p = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(driverJson({
      brand: 'SB Acoustics', model: 'SB23PACS', section: 'passive-radiator',
      spec: prSpecSection({ Fs_hz: 12, Sd_m2: 0.025, Cms_m_per_N: 0.0009, Mmd_kg: 0.09, Rms_Ns_per_m: 1.5, Xmax_m: 0.015 }),
    }), new Engine());
    if (Array.isArray(library)) throw new Error('fixture radiator invalid');
    p.box.passiveRadiator.radiator.update(library);
    p.box.passiveRadiator.volume_m3.set(0.03);
    p.box.boxType.set('box-passive-radiator');
    return p;
  };

  it('(c) PR: entering the added mass solves tuning into the record, and systemTuning_hz reads it', () => {
    const p = prProject();
    p.box.passiveRadiator.addedMass_kg.set(0.05);

    const tuningCell = p.box.passiveRadiator.tuning_goal_hz;
    expect(tuningCell.calculated).toBe(true);
    expect(tuningCell.value).not.toBeNull();
    expect(p.box.passiveRadiator.systemTuning_hz.value).toBeCloseTo(tuningCell.value!, 6);
  });

  it('(d) an unreachable PR target DQs every field in the pair, and clearing it clears them all', () => {
    const p = prProject();
    p.box.passiveRadiator.addedMass_kg.set(0);
    const ceiling = p.box.passiveRadiator.systemTuning_hz.value!;

    p.box.passiveRadiator.tuning_goal_hz.set(ceiling * 1.5);

    const DQ = [{ kind: 'target-unreachable', target: 'addedMass_kg', maxReachable_hz: ceiling }];
    expect(p.box.passiveRadiator.tuning_goal_hz.dq).toEqual(DQ);
    expect(p.box.passiveRadiator.addedMass_kg.dq).toEqual(DQ);
    expect(p.box.passiveRadiator.systemTuning_hz.dq).toEqual(DQ);
    expect(p.box.passiveRadiator.resonanceWithAddedMass_hz.dq).toEqual(DQ);

    p.box.passiveRadiator.tuning_goal_hz.clear();

    expect(p.box.passiveRadiator.tuning_goal_hz.dq).toEqual([]);
    expect(p.box.passiveRadiator.addedMass_kg.dq).toEqual([]);
  });

  it('(e) exactly one engine.solveVent call per field set(), and zero for a bare project.box read', () => {
    const engine = new Engine();
    const p = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), engine).vented().volume_m3(0.05).tuning_goal_hz(40).build();
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.diameter_m.set(0.1);

    const readSpy = vi.spyOn(engine, 'solveVent');
    void p.box;
    void p.box.vented.vent.length_m;
    expect(readSpy).toHaveBeenCalledTimes(0);
    readSpy.mockRestore();

    const writeSpy = vi.spyOn(engine, 'solveVent');
    p.box.vented.vent.endCorrection_m.set(0.6);
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });
});

describe('sweep()/maxCurves() reach every box topology\'s own params (bandpass4, box-passive-radiator)', () => {
  const circuitCompleteDriver = () => {
    const driver = driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: tuneSpec({ Fs_hz: 37, Vas_m3: 0.0300, Qes: 0.40, Qms: 7.0, Re_ohm: 5.6 }),
    });
    driver.specs.Sd_m2.set(0.0133);
    driver.specs.Le_H.set(0.70e-3);
    driver.specs.Xmax_m.set(0.0050);
    driver.specs.Pe_W.set(60);
    return driver;
  };

  it('a bandpass4 project with a sized front vent sweeps clean — covers the bandpass4 loss/volume/vent params', () => {
    const p = OpenISDProject.builder(circuitCompleteDriver(), new Engine())
      .bandpass4().rearVolume_m3(0.02).frontVolume_m3(0.03).frontTuning_hz(45)
      .build();
    p.box.bandpass4.vents.front.shape.set('round');
    p.box.bandpass4.vents.front.diameter_m.set(0.1);

    const result = p.sweep({ fmin: 10, fmax: 100, N: 10 });
    expect(result.values).not.toBeNull();
    expect(result.issues).toEqual([]);
  });

  it('a box-passive-radiator project with every PR quantity stated sweeps clean — covers the PR params\' full set', () => {
    const p = OpenISDProject.builder(circuitCompleteDriver(), new Engine())
      .passiveRadiator().volume_m3(0.03).tuning_goal_hz(45)
      .radiator(radiatorFor(OpenISDPassiveRadiatorStandalone.fromConformingRecord(driverJson({
        brand: 'SB Acoustics', model: 'SB23PACS', section: 'passive-radiator',
        spec: prSpecSection({ Fs_hz: 12, Sd_m2: 0.025, Cms_m_per_N: 0.0009, Mmd_kg: 0.09, Rms_Ns_per_m: 1.5, Xmax_m: 0.015 }),
      }), new Engine())))
      .build();
    p.box.passiveRadiator.addedMass_kg.set(0.05);

    const result = p.sweep({ fmin: 10, fmax: 100, N: 10 });
    expect(result.values).not.toBeNull();
    expect(result.issues).toEqual([]);

    const mx = p.maxCurves({ fmin: 10, fmax: 100, N: 10 });
    expect(mx.values).not.toBeNull();
  });

  function radiatorFor(r: OpenISDPassiveRadiatorStandalone | string[]): OpenISDPassiveRadiatorStandalone {
    if (Array.isArray(r)) throw new Error(`fixture radiator is invalid: ${r.join(', ')}`);
    return r;
  }

  it('a vented box with no port geometry entered yet reports its params with Sp/Leff unset, not thrown', () => {
    const p = OpenISDProject.builder(circuitCompleteDriver(), new Engine())
      .vented().volume_m3(0.02).tuning_goal_hz(40)
      .build();

    expect(() => p.boxParamsIssues()).not.toThrow();
  });

  it('a bandpass4 box with no front-port geometry entered yet reports its params with Sp/Leff unset, not thrown', () => {
    const p = OpenISDProject.builder(circuitCompleteDriver(), new Engine())
      .bandpass4().rearVolume_m3(0.02).frontVolume_m3(0.03).frontTuning_hz(45)
      .build();

    expect(() => p.boxParamsIssues()).not.toThrow();
  });

  it('a box-passive-radiator with an EMPTY radiator (no spec entered) reports its params with prSd/prCms/prRms unset, not thrown', () => {
    const p = OpenISDProject.builder(circuitCompleteDriver(), new Engine())
      .passiveRadiator().volume_m3(0.03).tuning_goal_hz(45)
      .radiator(OpenISDPassiveRadiatorStandalone.empty(new Engine()))
      .build();

    expect(() => p.boxParamsIssues()).not.toThrow();
  });
});

describe('box tuning/length/mass slots load as entries (S2-7b)', () => {
  function ventedProject() {
    return OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).vented().volume_m3(0.05).tuning_goal_hz(40).build();
  }

  /** Round-trips `project` through `.owpr` text with `mutate` applied to the parsed JSON's
   *  `saved` (and `edited`, when present) sections first — the seam every box-slot-entry test
   *  below drives a stored JSON shape through. */
  function reloadWith(project: OpenISDProject, mutate: (box: unknown) => void): OpenISDProject | string[] {
    const parsed = JSON.parse(project.toOwprText());
    mutate(parsed.saved.box);
    if (parsed.edited) mutate(parsed.edited.box);
    return OpenISDProject.fromOwprText(JSON.stringify(parsed), new Engine());
  }

  it('a vent length_m entry with state "C" loads as a calculated cell', () => {
    // boxType stays 'sealed' in this fixture's mutation (S2-7d2: the project cascade only
    // re-solves the ACTIVE box type's vent pair) — this test is about JSON round-trip fidelity
    // for the entry SHAPE, not about whether a resolve leaves an inactive pair alone.
    const back = reloadWith(ventedProject(), (box) => {
      (box as { boxType: unknown }).boxType = 'sealed';
      (box as { vented: { vent: { length_m: unknown } } }).vented.vent.length_m = { state: 'C', value: 0.2 };
    });
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    const cell = back.box.vented.vent.length_m;
    expect(cell.value).toBe(0.2);
    expect(cell.calculated).toBe(true);
  });

  it('the legacy null shape for a box entry slot is rejected, not silently accepted', () => {
    const back = reloadWith(ventedProject(), (box) => {
      (box as { vented: { vent: { length_m: unknown } } }).vented.vent.length_m = null;
    });
    if (!Array.isArray(back)) throw new Error('expected problems, got a project');
    expect(back.length).toBeGreaterThan(0);
  });

});

describe('project-level array/display settings, chart Y-range, and identity', () => {
  function sealedProject() {
    return OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build();
  }

  it('sweep() reads Options → Environment for an unstated environment — the same SPL as entering those values', () => {
    // bugs/BUG_20260924_sweep-ignores-options-environment-setting.md
    const grid = {fmin: 20, fmax: 200, N: 8};
    const options = {tempK: 263.15, humidityPct: 90, pressurePa: 85000};
    const sealedOn = (engine: Engine) => {
      const driver = driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      });
      driver.specs.Re_ohm.set(6);
      driver.specs.BL_Tm.set(7);
      return OpenISDProject.builder(driver, engine).sealed().volume_m3(0.03).build();
    };
    const onOptions = sealedOn(new Engine({
      ventedLimits: () => DEFAULT_VENTED_DESIGN_LIMITS, envDefaults: () => options,
    }));
    const entered = sealedOn(new Engine());
    entered.envTempK.set(options.tempK);
    entered.envHumidityPct.set(options.humidityPct);
    entered.envPressurePa.set(options.pressurePa);

    const spl = onOptions.sweep(grid).values?.spl;
    expect(spl).toBeDefined();
    expect(spl).toEqual(entered.sweep(grid).values?.spl);
    expect(spl).not.toEqual(sealedOn(new Engine()).sweep(grid).values?.spl);
  });

  it('loading defaults to standard, and can be set to isobaric', () => {
    const p = sealedProject();
    expect(p.loading.value).toBe('standard');

    p.loading.set('isobaric');
    expect(p.loading.value).toBe('isobaric');
  });

  it('splGraphIsXmaxLimited defaults false, and can be toggled', () => {
    const p = sealedProject();
    expect(p.splGraphIsXmaxLimited.value).toBe(false);

    p.splGraphIsXmaxLimited.set(true);
    expect(p.splGraphIsXmaxLimited.value).toBe(true);
  });

  it('uuid() answers the identity a fixed AppContext minted at wrap time', () => {
    const p = OpenISDProject.wrap(JSON.parse(sealedProject().toOwprText()).saved, new Engine(), fixedAppContext('proj-fixed-id'));
    expect(p.uuid()).toBe('proj-fixed-id');
  });

  it('cloneSavedProject answers the last-saved record, never the live edited one', () => {
    const p = sealedProject();
    p.name.set('edited but not saved');

    const saved = p.cloneSavedProject();
    expect(saved.meta.name).not.toBe('edited but not saved');
  });

  it('cloneSavedProject hands out an independent clone — mutating the answer never reaches the project', () => {
    const p = sealedProject();
    const saved = p.cloneSavedProject();
    saved.meta.name = 'mutated the clone';

    expect(p.cloneSavedProject().meta.name).not.toBe('mutated the clone');
  });

  it('pre: Re none, P N, V 1 C | set Re 6, type P 4 | post: P 4 E, V √24 C', () => {
    const p = sealedProject();
    expect(p.driveVoltage_V.value).toBe(1);
    expect(p.driveVoltage_V.calculated).toBe(true);
    expect(p.powerDrive_W.value).toBe(null);

    p.driver.specs.Re_ohm.set(6);
    p.powerDrive_W.set(4);
    expect(p.powerDrive_W.entered).toBe(true);
    expect(p.driveVoltage_V.calculated).toBe(true);
    expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(4 * 6), 6);
  });

  it('driveVoltage_V and powerDrive_W each carry both the owner\'s and the solver\'s writes', () => {
    const p = sealedProject();
    for (const f of [p.driveVoltage_V, p.powerDrive_W]) {
      expect('set' in f).toBe(true);
      expect('clear' in f).toBe(true);
      expect('setCalculated' in f).toBe(true);
      expect('entered' in f).toBe(true);
    }
    // V is never absent, so the solver has no "could not derive" write on it.
    expect('setNotAvailable' in p.driveVoltage_V).toBe(false);
    expect('setNotAvailable' in p.powerDrive_W).toBe(true);
  });

  it('pre: Re 6, P 1 E, V √6 C | save | post: the record stores P as E and V as C', () => {
    const p = sealedProject();
    p.driver.specs.Re_ohm.set(6);
    expect(p.powerDrive_W.value).toBe(1);
    p.save();
    expect(p.cloneSavedProject().signal.power_W).toMatchObject({ state: 'E', value: 1 });
    expect(p.cloneSavedProject().signal.voltage_V).toMatchObject({ state: 'C' });
  });

  it('pre: Re none, P N, V 1 C | read P | post: P N, dq names Re_ohm', () => {
    const p = sealedProject();
    const dq = p.powerDrive_W.dq[0];
    expect(dq).toMatchObject({ kind: 'missing-dependencies', target: 'power_W' });
    if (dq?.kind === 'missing-dependencies') expect(dq.routes[0].missing).toContain('Re_ohm');
  });

  it('pre: Re none, P N, V 1 C | type V 10 | post: P N, V 10 E', () => {
    const p = sealedProject();
    p.driveVoltage_V.set(10);
    expect(p.driveVoltage_V.value).toBe(10);
    expect(p.driveVoltage_V.entered).toBe(true);
    expect(p.powerDrive_W.value).toBe(null);
  });

  it('description is a project note, never solver-derived — no solver write exists on it (T5)', () => {
    const p = sealedProject();
    p.description.set('my note');

    expect('setCalculated' in p.description).toBe(false);
    expect('setDq' in p.description).toBe(false);
    expect(p.description.value).toBe('my note');
    expect(p.description.entered).toBe(true);

    expect('clear' in p.description).toBe(false);
    p.description.set('');
    expect(p.description.value).toBe('');
    expect(p.description.entered).toBe(true);
  });

});

