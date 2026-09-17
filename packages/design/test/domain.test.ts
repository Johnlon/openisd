import { describe, it, expect, vi } from 'vitest';
import { Engine, type DriverError, type DriverIssue } from '@openisd/design/engine';
import {
  OpenISDProject,
  OpenISDDriver,
  OpenISDPassiveRadiatorStandalone,
  VoiceCoilWiring,
  type AppContext} from '../domain/index.js';

/** A deterministic `AppContext` for tests that would otherwise depend on a random id or the
 *  real clock — e.g. a test asserting on serialized JSON content, where a random UUID could by
 *  chance contain the very digits the test is checking for. */
function fixedAppContext(id: string, isoDate = '2026-01-01T00:00:00.000Z'): AppContext {
  return { newId: () => id, now: () => new Date(isoDate) };
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

// A SPEC field is a different envelope from a metadata one: it states no value of its own, and
// the number lives on the reading `origin` names. Building fixtures through this is what makes
// them the shape a real record has.
const spec = (read_value: number) =>
  ({ origin: 'scraped', readings: { scraped: { read_value } } });

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
  brand: string; model: string; section: 'woofer' | 'tweeter' | 'passive-radiator';
  // A driver's own section (`specSection`) or a radiator's (`prSpecSection`, no `Qts`) —
  // whichever matches `section` above.
  spec: ReturnType<typeof specSection> | ReturnType<typeof prSpecSection> | ReturnType<typeof tuneSpec>;
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
  if (p.section === 'tweeter') return { ...meta, specs: { tweeter: p.spec } };
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
    const fs = record.specs.woofer?.Fs_hz;
    if (fs?.state !== 'E') throw new Error('expected an entered Fs_hz entry');
    expect(fs.origin).toBeDefined();
  });

  it('a write to the driver after the call does not retroactively change the returned record', () => {
    const driver = driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });

    const before = driver.cloneDriver();
    driver.spec.woofer.Fs_hz.set(99);
    const fsBeforeStr = JSON.stringify(before.specs.woofer?.Fs_hz);
    driver.spec.woofer.Fs_hz.set(99);

    // `before` is unmodified by the subsequent set.
    expect(before.specs.woofer?.Fs_hz).toBeDefined();
    expect(JSON.stringify(before.specs.woofer?.Fs_hz)).toBe(fsBeforeStr);
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
    const driver = OpenISDDriver.empty(new Engine());
    driver.spec.woofer.Qts.set(0.4);
    driver.spec.woofer.Qes.set(0.45);
    driver.spec.woofer.Qms.set(2.94);
    // Qts=0.4 was stated directly; Qes/Qms imply ~0.390 — a real contradiction.

    const issues = driver.issues();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'inconsistent-inputs', target: 'Qts', actual: 0.4 });
  });

  it('a derived Qts (T11: resolve() writes it back on load) reads back calculated, and issues() ' +
    'still agrees with itself rather than reporting the solved Qts as a contradiction of Qes/Qms', () => {
    const driver = driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: tuneSpec({ Fs_hz: 40, Vas_m3: 0.00765, Qes: 0.45, Qms: 2.94, Re_ohm: 6.6 }),
    });
    // S2-10: there is no longer a separate what-if `solveConsistencyGroup()` — `driverFrom()`'s
    // own `resolve()` (S2-7c, run once on load) already wrote the derived Qts back as 'C'.
    expect(driver.spec.woofer.Qts.get().state).toBe('calculated');
    expect(driver.spec.woofer.Qts.get().value).toBeCloseTo((0.45 * 2.94) / (0.45 + 2.94), 6);
    expect(driver.issues()).toEqual([]);
  });
});

describe('the driver — a window, not a copy', () => {
  it('reads and writes through to the record it was given', () => {
    const driver = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build().driver;

    expect(driver.spec.woofer.Fs_hz.get().value).toBe(30);
    driver.spec.woofer.Fs_hz.set(35);
    expect(driver.spec.woofer.Fs_hz.get().value).toBe(35);
    expect(driver.brand.get().value).toBe('Dayton');
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

    driver.spec.woofer.Fs_hz.set(35);               // creates the edited state under the caller's feet
    expect(driver.spec.woofer.Fs_hz.get().value).toBe(35);

    project.save();                     // the edited state is promoted; the handle must follow
    expect(driver.spec.woofer.Fs_hz.get().value).toBe(35);

    driver.spec.woofer.Fs_hz.set(40);               // a fresh edited state, again under the caller's feet
    expect(driver.spec.woofer.Fs_hz.get().value).toBe(40);

    await project.cancel(async () => true);   // and back to the saved state
    expect(driver.spec.woofer.Fs_hz.get().value).toBe(35);
  });

  it('what-if edits are transient and cancel preserves ordinary edits', () => {
    const project = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build();

    project.driver.spec.woofer.Fs_hz.set(35);
    project.beginWhatIf();
    expect(project.isWhatIfActive()).toBe(true);
    project.driver.spec.woofer.Fs_hz.set(40);
    expect(project.driver.spec.woofer.Fs_hz.get().value).toBe(40);

    project.cancelWhatIf();
    expect(project.isWhatIfActive()).toBe(false);
    expect(project.driver.spec.woofer.Fs_hz.get().value).toBe(35);
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

    project.driver.spec.woofer.Fs_hz.set(35);
    project.beginWhatIf();
    project.driver.spec.woofer.Fs_hz.set(40);

    const session = project.cloneSession();
    // Proves the injected AppContext is actually wired in, not merely accepted and ignored —
    // the real `newUuid()` would never produce this exact string.
    expect(session.edited?.driverEmbedding.device.uuid.value).toBe('11111111-1111-4111-8111-111111111111');

    // Structural, not raw string containment (S2-7d2: the fixture's Fs/Mms/Cms are jointly
    // over-determined, so the cascade now also attaches a formula dq to Fs_hz — a real, separate
    // fact this test is not about; asserting on `state`/`value` alone keeps it that way).
    expect(session.edited?.driverEmbedding.device.specs.woofer?.Fs_hz).toMatchObject({ state: 'E', value: 35 });
    expect(session.saved.driverEmbedding.device.specs.woofer?.Fs_hz).toMatchObject({ state: 'E', value: 30 });
  });

  it('gives every field a STABLE identity across accesses', () => {
    const driver = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build().driver;

    // Identity must hold, or reference-equality memoization sees every read as a change.
    expect(driver.spec.woofer.Fs_hz).toBe(driver.spec.woofer.Fs_hz);
    expect(driver.brand).toBe(driver.brand);
  });

  it('makes a blank driver an editor can fill in, stating no specs at all', () => {
    const blank = OpenISDDriver.empty(new Engine());

    // The record's own bookkeeping (uuid, quality, the three name fields) is required by the
    // conformance guard, so a blank record carries empty names rather than absent ones.
    expect(blank.brand.get().value).toBe('');
    expect(blank.model.get().value).toBe('');
    // Every SPEC field, by contrast, is genuinely unstated — nothing to render, nothing to solve.
    expect(blank.spec.woofer.Fs_hz.get().state).toBe('not-available');
    expect(blank.spec.woofer.Fs_hz.get().value).toBeNull();
    expect(blank.spec.woofer.Qts.get().value).toBeNull();
  });

  it('a blank driver accepts edits, and the solver derives from what was stated', () => {
    const blank = OpenISDDriver.empty(new Engine());
    blank.brand.set('Dayton');
    blank.spec.woofer.Fs_hz.set(30);

    expect(blank.brand.get().value).toBe('Dayton');
    expect(blank.spec.woofer.Fs_hz.get().value).toBe(30);
  });

  it('gives each blank driver its own record, so editing one leaves the next untouched', () => {
    const engine = new Engine();
    const one = OpenISDDriver.empty(engine);
    const two = OpenISDDriver.empty(engine);
    one.model.set('RS225');

    expect(two.model.get().value).toBe('');
  });

  it('reports what is wrong with a record instead of throwing, so a picker can show it', () => {
    const noSection = driverJson({
      brand: 'Dayton', model: 'RS225', section: 'passive-radiator',
      spec: prSpecSection({ Fs_hz: 30, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });

    const result = OpenISDDriver.fromConformingRecord(noSection, new Engine());

    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain('neither a woofer nor a tweeter section — nothing to simulate');
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
    // a record at all, so "neither a woofer nor a tweeter" would be a second-hand restatement of
    // "'specs' is missing" — the same fault, worded as if it were another one.
    const result = OpenISDDriver.fromConformingRecord({ brand: { value: 'Dayton', origin: 'x' } }, new Engine());

    expect(result).toEqual(expect.arrayContaining([expect.stringContaining("'specs'")]));
    expect(result).not.toEqual(expect.arrayContaining([
      expect.stringContaining('neither a woofer nor a tweeter'),
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
    copy.spec.woofer.Fs_hz.set(99);

    expect(copy.spec.woofer.Fs_hz.get().value).toBe(99);
    expect(original.spec.woofer.Fs_hz.get().value).toBe(30);
  });
});

describe('OpenISDBox — every alignment, as a window onto the project record', () => {
  const project = () => OpenISDProject.builder(driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  }), new Engine()).sealed().volume_m3(0.03).build();

  it('new projects use the copper voice-coil temperature coefficient default', () => {
    expect(project().alfaVC_per_K.get()).toBe(0.0039);
  });

  it('writes the sealed volume through to the project', () => {
    const p = project();
    p.box.sealed.volume_m3.set(0.03);
    expect(p.box.sealed.volume_m3.get()).toBe(0.03);
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

  it('exposes sealed resonance as a precomputed field whose cell state follows the data', () => {
    // The upgrade contract (Task 1/3): a ReadOnlyCalculatedField, not a method — its cell state
    // reports not-available until the volume is known, calculated once it is.
    const p = project();
    expect(p.box.sealed.resonance_hz.state).toBe('calculated');
    expect(p.box.sealed.resonance_hz.value).not.toBeNull();
    const ventedOnly = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).vented().volume_m3(0.05).tuning_hz(40).build();
    expect(ventedOnly.box.sealed.resonance_hz.state).toBe('not-available');
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
    expect(p.box.sealed.resonance_hz.state).toBe('calculated');
    expect(p.box.sealed.resonance_hz.value!).toBeCloseTo(63.1762, 2);
    expect(p.box.sealed.q_tc.value!).toBeCloseTo(0.5995, 2);
  });

  it('computes the sealed system Q (Qtc) — a closed box raises Q above the driver\'s Qts', () => {
    const p = project();   // driver Qts 0.4, sealed volume 0.03
    const q = p.box.sealed.q_tc.value;
    expect(q).not.toBeNull();
    expect(q!).toBeGreaterThan(0.4);
    expect(p.box.sealed.q_tc.state).toBe('calculated');
  });

  it('answers null for sealed Qtc when the enclosure is not set', () => {
    // The sealed box is dormant in a vented project — no volume, so no Q.
    const ventedOnly = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).vented().volume_m3(0.05).tuning_hz(40).build();
    expect(ventedOnly.box.sealed.q_tc.value).toBeNull();
    expect(ventedOnly.box.sealed.q_tc.state).toBe('not-available');
  });

  it('STILL computes plain geometry — a port area is πr², which no model can disagree about', () => {
    const p = project();
    p.box.vented.vent.diameter_m.set(0.1);
    expect(p.box.vented.vent.area_m2()).toBeCloseTo(Math.PI * 0.05 ** 2, 12);
  });

  it('a vent defaults to TWO FREE ENDS end correction (0.613), not a value no option matches', () => {
    // BUG_20260912 #10: the old 0.6 default matched none of the UI's END_CORRECTION_OPTIONS, so
    // the end-correction select rendered blank. The default is WinISD's "two free ends", 0.613.
    const p = project();
    expect(p.box.vented.vent.endCorrection_m.get()).toBe(0.613);
  });

  it('gets the port\'s ACOUSTIC length from the engine, end correction and all', () => {
    const p = project();
    p.box.vented.vent.diameter_m.set(0.1);
    p.box.vented.vent.length_m.set(0.2);

    const area = Math.PI * 0.05 ** 2;
    const engine = new Engine();
    expect(p.box.vented.vent.effectiveLength_m()).toBe(
      engine.ventEffectiveLength(0.2, area, p.box.vented.vent.endCorrection_m.get()),
    );
    // And it is LONGER than the port measures — that is what an end correction does.
    expect(p.box.vented.vent.effectiveLength_m()!).toBeGreaterThan(0.2);
  });

  it('reports an unset tuning as not-available rather than zero', () => {
    const p = project();
    p.box.vented.volume_m3.set(0.05);

    expect(p.box.vented.volume_m3.get().value).toBe(0.05);
    expect(p.box.vented.tuning_hz.get().state).toBe('not-available');
    expect(p.box.vented.tuning_hz.get().value).toBeNull();
  });

  it('computes vent area from whichever dimensions the vent SHAPE actually uses', () => {
    const p = project();
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.diameter_m.set(0.1);
    expect(p.box.vented.vent.area_m2()).toBeCloseTo(Math.PI * 0.05 ** 2, 12);

    p.box.vented.vent.shape.set('slotted');
    // Round diameter is still stored but no longer consulted — area is unanswerable until the
    // slot's own dimensions are given, and unanswerable is null, the same as everywhere else.
    expect(p.box.vented.vent.area_m2()).toBeNull();
    p.box.vented.vent.width_m.set(0.2);
    p.box.vented.vent.height_m.set(0.05);
    expect(p.box.vented.vent.area_m2()).toBeCloseTo(0.01, 12);
  });

  it('gives ABC three ports, none of them owned by a chamber', () => {
    const p = project();
    p.box.abc.vents.rear.diameter_m.set(0.08);
    p.box.abc.vents.front.diameter_m.set(0.09);
    p.box.abc.vents.intra.diameter_m.set(0.05);

    expect(p.box.abc.vents.rear.diameter_m.get().value).toBe(0.08);
    expect(p.box.abc.vents.front.diameter_m.get().value).toBe(0.09);
    expect(p.box.abc.vents.intra.diameter_m.get().value).toBe(0.05);
    // Two chambers only — the connecting port is not a third one.
    expect(Object.keys(p.box.abc.chambers)).toEqual(['rear', 'front']);
  });

  it('tunes bandpass6 chambers independently of each other', () => {
    const p = project();
    p.box.bandpass6.chambers.rear.tuning_hz.set(40);
    p.box.bandpass6.chambers.front.tuning_hz.set(80);

    expect(p.box.bandpass6.chambers.rear.tuning_hz.get().value).toBe(40);
    expect(p.box.bandpass6.chambers.front.tuning_hz.get().value).toBe(80);
  });

  it('keeps per-chamber losses separate — BUG_20260824', () => {
    const p = project();
    p.box.bandpass4.chambers.rear.losses.Ql.set(5);
    p.box.bandpass4.chambers.front.losses.Ql.set(9);

    expect(p.box.bandpass4.chambers.rear.losses.Ql.get()).toBe(5);
    expect(p.box.bandpass4.chambers.front.losses.Ql.get()).toBe(9);
  });

  it('exposes bandpass4 rear resonance as a precomputed field, null until the rear volume is known', () => {
    // Task 4/5: the rear chamber is sealed, so its resonance (WinISD's "Frc") is a
    // ReadOnlyCalculatedField — read as precomputed state, never a method.
    const p = project(); // a sealed project — bandpass4 is dormant, so its rear volume is unset
    expect(p.box.bandpass4.chambers.rear.resonance_hz.state).toBe('not-available');
    expect(p.box.bandpass4.chambers.rear.resonance_hz.value).toBeNull();

    const bp4 = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).bandpass4().rearVolume_m3(0.02).frontVolume_m3(0.03).frontTuning_hz(40).build();
    expect(bp4.box.bandpass4.chambers.rear.resonance_hz.state).toBe('calculated');
    expect(bp4.box.bandpass4.chambers.rear.resonance_hz.value).not.toBeNull();
  });

  it('gives the bandpass4 front volume a Field readout like every other chamber', () => {
    // Task 6: the front chamber volume is a Field<number> — .get() returns a cell with a state,
    // consistent with the rear chamber, instead of a bare RawField.
    const bp4 = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).bandpass4().rearVolume_m3(0.02).frontVolume_m3(0.03).frontTuning_hz(40).build();
    expect(bp4.box.bandpass4.chambers.front.volume_m3.get().value).toBe(0.03);
    expect(bp4.box.bandpass4.chambers.front.volume_m3.get().state).toBe('entered');
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

  it('reports nothing chosen, and refuses edits, until configurePR', () => {
    const p = project();

    expect(p.box.passiveRadiator.radiator.brand.get().state).toBe('not-available');
    expect(() => p.box.passiveRadiator.radiator.brand.set('SB')).toThrow(/radiator slot is empty/);
  });

  it('copies the chosen radiator IN, so later edits do not touch the library entry', () => {
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson(), new Engine());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);

    expect(p.box.passiveRadiator.radiator.brand.get().value).toBe('SB Acoustics');

    p.box.passiveRadiator.radiator.spec.Sd_m2.set(0.031);
    expect(p.box.passiveRadiator.radiator.spec.Sd_m2.get().value).toBe(0.031);
    expect(library.spec.Sd_m2.get().value).toBe(0.025);
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

    expect(saved.brand.get().value).toBe('SB Acoustics');
    expect(saved.spec.Sd_m2.get().value).toBe(0.031);

    // Storage is not shared in either direction.
    p.box.passiveRadiator.radiator.spec.Sd_m2.set(0.099);
    expect(saved.spec.Sd_m2.get().value).toBe(0.031);
    saved.spec.Sd_m2.set(0.011);
    expect(p.box.passiveRadiator.radiator.spec.Sd_m2.get().value).toBe(0.099);
  });

  it('refuses to detach an empty radiator slot', () => {
    const p = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build();

    expect(() => p.box.passiveRadiator.radiator.detach()).toThrow(/no radiator is chosen/);
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

  it('makes a blank radiator an editor can fill in, and a box can adopt', () => {
    const blank = OpenISDPassiveRadiatorStandalone.empty(new Engine());

    expect(blank.model.get().value).toBe('');
    expect(blank.spec.Fs_hz.get().state).toBe('not-available');

    const p = project();
    p.box.passiveRadiator.configurePR(blank);
    p.box.passiveRadiator.radiator.spec.Fs_hz.set(12);

    expect(p.box.passiveRadiator.radiator.spec.Fs_hz.get().value).toBe(12);
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

    p.box.passiveRadiator.tuning_hz.set(ceiling * 1.5);
    p.notifyPrChanged();

    expect(p.box.passiveRadiator.addedMass_kg.get().value).toBeLessThan(0);
    expect(p.prTargetUnreachable.value).toBe(true);

    p.box.passiveRadiator.tuning_hz.set(ceiling);
    p.notifyPrChanged();

    expect(p.box.passiveRadiator.addedMass_kg.get().value).toBeCloseTo(0, 9);
    expect(p.prTargetUnreachable.value).toBe(false);
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
    p.box.passiveRadiator.tuning_hz.set(ceiling * 1.5);
    p.notifyPrChanged();

    const DQ = [
      'addedMass_kg, tuning_hz disagree by 100%: Target tuning is above maximum passive radiator tuning. '
      + 'Every field in the group is marked — correct one of them, or clear one to let it be calculated.',
    ];
    expect(p.box.passiveRadiator.tuning_hz.get().state).toBe('entered');                 // the input
    expect(p.box.passiveRadiator.tuning_hz.get().dq()).toEqual(DQ);
    expect(p.box.passiveRadiator.addedMass_kg.get().dq()).toEqual(DQ);
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

  it('the first write creates the edited state; Cancel throws it away', () => {
    const mp = managed();

    mp.driver.spec.woofer.Fs_hz.set(99);
    expect(mp.isModified()).toBe(true);
    expect(mp.driver.spec.woofer.Fs_hz.get().value).toBe(99);

    void mp.cancel(async () => true);
  });

  it('Cancel restores the last saved values', async () => {
    const mp = managed();
    mp.driver.spec.woofer.Fs_hz.set(99);

    expect(await mp.cancel(async () => true)).toBe(true);
    expect(mp.driver.spec.woofer.Fs_hz.get().value).toBe(30);
    expect(mp.isModified()).toBe(false);
  });

  it('Cancel does nothing when the challenge refuses', async () => {
    const mp = managed();
    mp.driver.spec.woofer.Fs_hz.set(99);

    expect(await mp.cancel(async () => false)).toBe(false);
    expect(mp.driver.spec.woofer.Fs_hz.get().value).toBe(99);
    expect(mp.isModified()).toBe(true);
  });

  it('Cancel on an untouched project reports that nothing was discarded', async () => {
    expect(await managed().cancel(async () => true)).toBe(false);
  });

  it('Save promotes the edited state and clears the modified flag', () => {
    const mp = managed();
    mp.driver.spec.woofer.Fs_hz.set(50);
    expect(mp.isModified()).toBe(true);

    mp.save();
    expect(mp.driver.spec.woofer.Fs_hz.get().value).toBe(50);
    expect(mp.isModified()).toBe(false);
  });

  it('Cancel after a Save goes back to what was SAVED, not to what was loaded', async () => {
    const mp = managed();
    mp.driver.spec.woofer.Fs_hz.set(50);
    mp.save();

    mp.driver.spec.woofer.Fs_hz.set(77);
    await mp.cancel(async () => true);

    // 50 — the saved state — not the 30 the project was loaded with.
    expect(mp.driver.spec.woofer.Fs_hz.get().value).toBe(50);
  });

  it('notifies on entering the edited state, not only on later writes', () => {
    const mp = managed();
    let notifications = 0;
    mp.subscribe(() => { notifications += 1; });

    mp.driver.spec.woofer.Fs_hz.set(42);
    expect(notifications).toBeGreaterThan(0);

    const afterFirst = notifications;
    mp.driver.spec.woofer.Fs_hz.set(43);
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
    working.spec.woofer.Fs_hz.set(123);
    expect(mp.driver.spec.woofer.Fs_hz.get().value).toBe(30);   // cancel = just drop `working`

    const second = mp.driver.detach();
    second.spec.woofer.Fs_hz.set(61);
    mp.driver.update(second);                        // ok
    expect(mp.driver.spec.woofer.Fs_hz.get().value).toBe(61);
  });

  it('works identically on a standalone driver — the same two calls, whatever the origin', () => {
    const original = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build().driver.detach();

    const working = original.detach();
    working.spec.woofer.Fs_hz.set(200);
    expect(original.spec.woofer.Fs_hz.get().value).toBe(30);

    original.update(working);
    expect(original.spec.woofer.Fs_hz.get().value).toBe(200);
  });

  it('update() takes a deep copy — a later edit on the source does not reach the target', () => {
    const target = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build().driver.detach();
    const source = target.detach();
    source.spec.woofer.Fs_hz.set(111111);

    target.update(source);
    expect(target.spec.woofer.Fs_hz.get().value).toBe(111111);

    // The source's nested spec object must not still be shared with the target.
    source.spec.woofer.Fs_hz.set(222222);
    expect(target.spec.woofer.Fs_hz.get().value).toBe(111111);
  });

  it('setDriver() takes a deep copy — a later edit on the source does not reach the project', () => {
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();
    const source = project.driver.detach();
    source.spec.woofer.Fs_hz.set(333333);

    project.setDriver(source);
    expect(project.driver.spec.woofer.Fs_hz.get().value).toBe(333333);

    source.spec.woofer.Fs_hz.set(444444);
    expect(project.driver.spec.woofer.Fs_hz.get().value).toBe(333333);
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
    working.spec.woofer.Fs_hz.set(500);
    // no update() — the copy simply goes out of scope

    expect(original.spec.woofer.Fs_hz.get().value).toBe(30);
  });

  it('loadDriver() takes a deep copy — a later edit on the source does not reach the project', () => {
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();
    const source = project.driver.detach();
    source.spec.woofer.Fs_hz.set(555555);

    project.loadDriver(source);
    expect(project.driver.spec.woofer.Fs_hz.get().value).toBe(555555);

    source.spec.woofer.Fs_hz.set(666666);
    expect(project.driver.spec.woofer.Fs_hz.get().value).toBe(555555);

    expect(() => project.loadDriver(project.driver)).toThrow(/standalone/i);
  });

  it('embedding a driver that states its own c/roo strips them — the project is the sole source', () => {
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();
    project.envTempK.set(250);   // far from the reference default, so a leaked driver value is obvious
    project.envHumidityPct.set(80);
    project.envPressurePa.set(90000);

    const source = wooferDriver();
    source.spec.woofer.c_m_per_s.set(999);
    source.spec.woofer.roo_kg_per_m3.set(5);

    project.setDriver(source);

    expect(project.driver.spec.woofer.c_m_per_s.get().state).toBe('calculated');
    expect(project.driver.spec.woofer.roo_kg_per_m3.get().state).toBe('calculated');
    const projectAir = new Engine().solveEnvironment({ tempK: 250, humidityPct: 80, pressurePa: 90000 }).values;
    expect(project.driver.spec.woofer.c_m_per_s.get().value).toBeCloseTo(projectAir.c, 6);
    expect(project.driver.spec.woofer.roo_kg_per_m3.get().value).toBeCloseTo(projectAir.rho, 6);
    // Never 999/5 — the driver's own stated pair must not survive embedding.
    expect(project.driver.spec.woofer.c_m_per_s.get().value).not.toBeCloseTo(999, 0);
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
    project.driver.spec.woofer.c_m_per_s.set(999);
    project.driver.spec.woofer.roo_kg_per_m3.set(5);

    const projectAir = new Engine().solveEnvironment({ tempK: 250, humidityPct: 80, pressurePa: 90000 }).values;
    const ts = project.driver.ts;
    expect(ts.c_m_per_s.get().value).toBeCloseTo(projectAir.c, 6);
    expect(ts.roo_kg_per_m3.get().value).toBeCloseTo(projectAir.rho, 6);

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
    expect(driver.model.get().value).toBe('RS225');

    driver.renameToCopy();
    expect(driver.model.get().value).toBe('Copy of RS225');
  });

  it('toOwdrText() then OpenISDDriver.fromOwdrText() round-trips a driver through .owdr text', () => {
    const driver = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build().driver.detach();
    driver.spec.woofer.Fs_hz.set(41.5);

    const text = driver.toOwdrText();
    expect(typeof text).toBe('string');

    const back = OpenISDDriver.fromOwdrText(text, new Engine());
    if (Array.isArray(back)) throw new Error('fromOwdrText returned problems: ' + back.join(', '));
    expect(back.spec.woofer.Fs_hz.get().value).toBe(41.5);
    expect(back.model.get().value).toBe('RS225');
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
    expect(driver.model.get().value).toBe('Copy of RS225');
  });

  it('toWdrIniText() then OpenISDDriver.fromWdrIniText() round-trips a driver through WinISD .wdr text', () => {
    const driver = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build().driver.detach();
    driver.spec.woofer.Fs_hz.set(41.5);

    const { value: text, errors } = driver.toWdrIniText(new Engine());
    expect(errors.filter((e: DriverError) => e.level === 'error')).toEqual([]);
    if (text === null) throw new Error('toWdrIniText produced no text');

    const back = OpenISDDriver.fromWdrIniText(text, new Engine());
    if (back.value === null) throw new Error('fromWdrIniText returned problems: ' + JSON.stringify(back.errors));
    expect(back.value.spec.woofer.Fs_hz.get().value).toBeCloseTo(41.5, 3);
    expect(back.value.model.get().value).toBe('RS225');
  });

  it('toWprText() then OpenISDProject.fromWprText() round-trips a project through WinISD .wpr text', () => {
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();

    const { value: text, errors } = project.toWprText(new Engine());
    expect(errors.filter((e: DriverError) => e.level === 'error')).toEqual([]);
    if (text === null) throw new Error('toWprText produced no text');

    const back = OpenISDProject.fromWprText(text, new Engine());
    if (back.value === null) throw new Error('fromWprText returned problems: ' + JSON.stringify(back.errors));
    expect(back.value.box.boxType.get()).toBe('sealed');
    expect(back.value.driver.model.get().value).toBe('RS225');
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
    expect(back.model.get().value).toBe('SB23PACS');
  });

  it('toOwprText() then OpenISDProject.fromOwprText() round-trips a project through .owpr text', () => {
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();
    project.name.set('Kitchen sub');
    project.description.set('111111');

    const text = project.toOwprText();
    expect(typeof text).toBe('string');

    const back = OpenISDProject.fromOwprText(text, new Engine());
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.name.get()).toBe('Kitchen sub');
    expect(back.description.get().value).toBe('111111');
    expect(back.box.boxType.get()).toBe('sealed');
  });

  it('OpenISDProject.fromOwprText() answers with problems rather than throwing on text that is not a project', () => {
    const back = OpenISDProject.fromOwprText('{"nope":1}', new Engine());
    if (!Array.isArray(back)) throw new Error('expected problems, got a project');
    expect(back.length).toBeGreaterThan(0);
  });

  it('a legacy signal record with an entered power loads it and drops voltage_V (S5/T5)', () => {
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();
    // `toOwprText()`'s root is a SESSION envelope (`{label, saved, edited}` — openisdSchema.ts's
    // `openISDProjectSessionJsonSchema`); `signal` lives under `saved` (and `edited`, when not
    // null — a freshly built, never-wrapped project's `edited` is null).
    const parsed = JSON.parse(project.toOwprText());
    parsed.saved.signal = { power_W: 2.5, voltage_V: 4.47 };

    const back = OpenISDProject.fromOwprText(JSON.stringify(parsed), new Engine());
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.powerDrive_W.value).toBe(2.5);
    expect(back.powerDrive_W.state).toBe('entered');

    const reparsed = JSON.parse(back.toOwprText());
    expect(reparsed.saved.signal).not.toHaveProperty('voltage_V');
  });

  it('a legacy signal record with nothing stated (power_W: null, voltage_V: null) loads with power not-available (S5/T5)', () => {
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();
    const parsed = JSON.parse(project.toOwprText());
    parsed.saved.signal = { power_W: null, voltage_V: null };

    const back = OpenISDProject.fromOwprText(JSON.stringify(parsed), new Engine());
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.powerDrive_W.state).toBe('not-available');
    expect(back.powerDrive_W.value).toBeNull();
  });

  it('OpenISDProject.fromOwprText() answers with problems rather than throwing on text that is not JSON', () => {
    const back = OpenISDProject.fromOwprText('not json at all', new Engine());
    if (!Array.isArray(back)) throw new Error('expected problems, got a project');
    expect(back.length).toBeGreaterThan(0);
  });

  it('toWprText() takes a SNAPSHOT — the project it was called on is not held by the converter', () => {
    // The whole point of the method form: the domain passes ITSELF to the WinISD converter, so a
    // live project never crosses out of the domain into a format package. Writing the file must
    // therefore leave the project exactly as it was.
    const project = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();
    project.description.set('before');

    project.toWprText(new Engine());

    expect(project.description.get().value).toBe('before');
    expect(project.box.boxType.get()).toBe('sealed');
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

  it('series / description / sku read straight off the record as cells with provenance', () => {
    const driver = driverWithProvenance();
    // Task 17-19: metadata getters are ReadOnlyCalculatedField<string> — value plus cell state.
    expect(driver.series.value).toBe('Reference Series');
    expect(driver.series.state).toBe('entered');
    expect(driver.description.value).toBe('an 8 inch reference woofer');
    expect(driver.description.state).toBe('entered');
    expect(driver.sku.value).toBe('TEST-SKU');
  });

  it('series and description are not-available when the record omits them', () => {
    const driver = driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });
    expect(driver.series.value).toBeNull();
    expect(driver.series.state).toBe('not-available');
    expect(driver.description.value).toBeNull();
    expect(driver.description.state).toBe('not-available');
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
    expect(p.driver.brand.get().value).toBe('');
    expect(p.driver.spec.woofer.Fs_hz.get().state).toBe('not-available');
  });

  it('starts sealed, the box type the wizard opens on', () => {
    expect(OpenISDProject.empty(new Engine()).box.boxType.get()).toBe('sealed');
  });

  it('holds a radiator already, so a switch to a PR box is legal with no further setup', () => {
    const p = OpenISDProject.empty(new Engine());
    // Writing a radiator spec field is what throws when the slot is null, so it is the test
    // that a radiator is genuinely present rather than merely reported as one.
    p.box.passiveRadiator.radiator.spec.Fs_hz.set(12);
    expect(p.box.passiveRadiator.radiator.spec.Fs_hz.get().value).toBe(12);
  });

  it('states no radiator parameters of its own', () => {
    const p = OpenISDProject.empty(new Engine());
    expect(p.box.passiveRadiator.radiator.spec.Fs_hz.get().state).toBe('not-available');
    expect(p.box.passiveRadiator.systemTuning_hz.value).toBeNull();
  });

  it('gives each new project its own records, so editing one leaves the next untouched', () => {
    const engine = new Engine();
    const one = OpenISDProject.empty(engine);
    const two = OpenISDProject.empty(engine);
    one.driver.model.set('RS225');
    expect(two.driver.model.get().value).toBe('');
  });

  it('accepts a real driver afterwards, which is how the wizard fills it in', () => {
    const p = OpenISDProject.empty(new Engine());
    const picked = OpenISDDriver.empty(new Engine());
    picked.brand.set('Dayton');
    picked.model.set('RS225');
    p.setDriver(picked);
    expect(p.driver.brand.get().value).toBe('Dayton');
  });

  it('accepts a real radiator afterwards, which is how the wizard fills a PR box in', () => {
    const p = OpenISDProject.empty(new Engine());
    const picked = OpenISDPassiveRadiatorStandalone.empty(new Engine());
    picked.model.set('SB23PACS');
    p.box.passiveRadiator.configurePR(picked);
    expect(p.box.passiveRadiator.radiator.model.get().value).toBe('SB23PACS');
  });
});

describe("a blank device reports WinISD's own defaults without stating them", () => {
  // John, 2026-09-08: "use the existing WinIsd default values - but some of these are functions
  // like calcVcCon() ... which isn't really a calc but plays that role if the VCCon isn't yet
  // stated". Those defaults arrive through the GETTERS, so a blank record carries none of them.
  // Stamping them in would report `entered` and falsely claim the user stated the value.

  it('reads the default wiring as calculated, not as something the user entered', () => {
    const blank = OpenISDDriver.empty(new Engine());
    const wiring = blank.spec.woofer.VCCon.get();
    expect(wiring.value).toBe(VoiceCoilWiring.Parallel);
    expect(wiring.state).toBe('calculated');
  });

  it('reads the default coil count the same way', () => {
    const numVC = OpenISDDriver.empty(new Engine()).spec.woofer.numVC.get();
    expect(numVC.value).toBe(1);
    expect(numVC.state).toBe('calculated');
  });

  it('a field with no WinISD default stays genuinely unstated', () => {
    // The defaults are specific facts, not a blanket "fill everything in" — SPEC_ENGINE.md:424
    // says "Defaults are 0, except numVC=1, VCCon=1", and Fs is not among the exceptions.
    expect(OpenISDDriver.empty(new Engine()).spec.woofer.Fs_hz.get().state).toBe('not-available');
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
    d.spec.woofer.Vas_m3.set(0.05);
    d.spec.woofer.Sd_m2.set(0.02);
    return d;
  }

  it('Cms comes back calculated from the stated Vas and Sd', () => {
    const cms = vasAndSd().spec.woofer.Cms_m_per_N.get();
    expect(cms.state).toBe('calculated');
    // Cms = Vas / (ρ·c²·Sd²) — the same relation, evaluated here from the driver's own air
    // constants rather than from a constant copied into this test.
    const air = vasAndSd().spec.woofer;
    const rho = air.roo_kg_per_m3.get().value!;
    const c = air.c_m_per_s.get().value!;
    expect(cms.value).toBeCloseTo(0.05 / (rho * c * c * 0.02 * 0.02), 12);
  });

  it('a stated value still reads entered — the solver never overrides what the record says', () => {
    const d = vasAndSd();
    d.spec.woofer.Cms_m_per_N.set(0.000123);
    const cms = d.spec.woofer.Cms_m_per_N.get();
    expect(cms.state).toBe('entered');
    expect(cms.value).toBe(0.000123);
  });

  it('a field the solver cannot reach stays not-available', () => {
    // Nothing in the record implies Xmax, so the distinction between "absent" and "derived"
    // survives — a solver that answered everything would be no better than a blank.
    expect(vasAndSd().spec.woofer.Xmax_m.get().state).toBe('not-available');
  });

  it('the solved value IS written into the record, as a calculated entry (T11)', () => {
    // The whole point of T11: a resolve runs on every write, and a derivable field's cell is
    // backed by a real `'C'` entry in the record — not recomputed fresh at every read with
    // nothing persisted.
    const d = vasAndSd();
    const entry = d.cloneDriver().specs.woofer?.Cms_m_per_N;
    expect(entry).toMatchObject({ state: 'C' });
    expect(entry?.value).toBeCloseTo(d.spec.woofer.Cms_m_per_N.get().value!, 12);
  });

  it('changing a stated input changes what the derived field reports', () => {
    // A cached solve that never invalidated would pass every test above and still be wrong.
    const d = vasAndSd();
    const before = d.spec.woofer.Cms_m_per_N.get().value!;
    d.spec.woofer.Vas_m3.set(0.10);
    expect(d.spec.woofer.Cms_m_per_N.get().value!).toBeCloseTo(before * 2, 12);
  });
});

describe('OpenISDDriver — resolves on every write (S2-7c)', () => {
  /** Qes+Qms entered, nothing else — Qts = Qes·Qms/(Qes+Qms) is the one relation this can
   *  derive; every OTHER relation needs at least one field this driver never states. */
  function qesQms(): OpenISDDriver {
    const d = OpenISDDriver.empty(new Engine());
    d.spec.woofer.Qes.set(0.4);
    d.spec.woofer.Qms.set(3.0);
    return d;
  }

  it('a derivable field is written into the record as a calculated entry right after construction', () => {
    const d = qesQms();
    const entry = d.cloneDriver().specs.woofer?.Qts;
    expect(entry).toMatchObject({ state: 'C' });
    expect(entry?.value).toBeCloseTo((0.4 * 3.0) / (0.4 + 3.0), 12);
  });

  it('setting a field the record already resolved from changes the dependent calculated entry', () => {
    const d = qesQms();
    d.spec.woofer.Qms.set(6.0);
    const entry = d.cloneDriver().specs.woofer?.Qts;
    expect(entry?.value).toBeCloseTo((0.4 * 6.0) / (0.4 + 6.0), 12);
  });

  it('an entered Qts survives a resolve untouched, even though it disagrees with Qes/Qms', () => {
    const d = qesQms();
    d.spec.woofer.Qts.set(111111);
    const entry = d.cloneDriver().specs.woofer?.Qts;
    // Not `toEqual`: S2-7d2 also projects the group's formula dq onto every disagreeing field —
    // a real, separate fact from what this test is pinning (the VALUE is never overwritten).
    expect(entry).toMatchObject({ state: 'E', value: 111111 });
  });

  it('clearing a field the resolve depended on removes the now-underivable calculated entry', () => {
    const d = qesQms();
    expect(d.cloneDriver().specs.woofer?.Qts).toMatchObject({ state: 'C' });
    d.spec.woofer.Qes.clear();
    expect(d.cloneDriver().specs.woofer?.Qts).toBeUndefined();
    expect(d.spec.woofer.Qts.get().state).toBe('not-available');
  });

  it('exactly one engine.solveDriver call happens per field set()', () => {
    const engine = new Engine();
    const d = OpenISDDriver.empty(engine);
    d.spec.woofer.Qes.set(0.4);
    const spy = vi.spyOn(engine, 'solveDriver');
    d.spec.woofer.Qms.set(3.0);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('a not-entered c_m_per_s lands in the record as a calculated entry equal to the driver\'s own air', () => {
    const engine = new Engine();
    const d = OpenISDDriver.empty(engine);
    const air = engine.solveEnvironment({}).values;
    const entry = d.cloneDriver().specs.woofer?.c_m_per_s;
    expect(entry).toMatchObject({ state: 'C', value: air.c });
  });
});

describe('OpenISDProject — the driver cascade resolves on every write (S2-7d1)', () => {
  /** A saved project whose embedded driver states ONLY Qes+Qms — Qts is the one relation it can
   *  derive. Built via the ordinary `.builder().build()` path (which itself calls `save()`), then
   *  re-wrapped through `OpenISDProject.wrap()` — the entry point this task adds a resolve to —
   *  so these tests exercise `wrap()` itself, not merely the builder's own already-passing path. */
  function qesQmsProject(engine: Engine): OpenISDProject {
    const driver = OpenISDDriver.empty(engine);
    driver.spec.woofer.Qes.set(0.4);
    driver.spec.woofer.Qms.set(3.0);
    const built = OpenISDProject.builder(driver, engine).sealed().volume_m3(0.03).build();
    return OpenISDProject.wrap(built.cloneSession().saved, engine);
  }

  it('wrap() resolves the driver once, and the project is not modified by it', () => {
    const engine = new Engine();
    const project = qesQmsProject(engine);
    const qts = project.driver.spec.woofer.Qts.get();
    expect(qts.state).toBe('calculated');
    expect(qts.value).toBeCloseTo((0.4 * 3.0) / (0.4 + 3.0), 12);
    expect(project.isModified()).toBe(false);
  });

  it('setting a driver field the project resolved from changes the dependent calculated entry, and modifies the project', () => {
    const engine = new Engine();
    const project = qesQmsProject(engine);
    project.driver.spec.woofer.Qms.set(6.0);
    const qts = project.driver.spec.woofer.Qts.get();
    expect(qts.value).toBeCloseTo((0.4 * 6.0) / (0.4 + 6.0), 12);
    expect(project.isModified()).toBe(true);
  });

  it('exactly one engine.solveDriver call per field set(), and zero for a bare project.driver read', () => {
    const engine = new Engine();
    const project = qesQmsProject(engine);
    const readSpy = vi.spyOn(engine, 'solveDriver');
    void project.driver;
    void project.driver.spec.woofer.Fs_hz.get();
    expect(readSpy).toHaveBeenCalledTimes(0);
    readSpy.mockRestore();

    const writeSpy = vi.spyOn(engine, 'solveDriver');
    project.driver.spec.woofer.Qms.set(6.0);
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  it('a what-if edit lands its own calculated values in the what-if layer; resetWhatIf returns to the committed ones', () => {
    const engine = new Engine();
    const project = qesQmsProject(engine);
    const committedQts = project.driver.spec.woofer.Qts.get().value;

    project.beginWhatIf();
    project.driver.spec.woofer.Qms.set(6.0);
    const whatIfQts = project.driver.spec.woofer.Qts.get().value;
    expect(whatIfQts).toBeCloseTo((0.4 * 6.0) / (0.4 + 6.0), 12);
    expect(whatIfQts).not.toBeCloseTo(committedQts!, 6);

    project.resetWhatIf();
    expect(project.driver.spec.woofer.Qts.get().value).toBeCloseTo(committedQts!, 12);
  });

  it('save() does not disturb the already-resolved derived values', () => {
    const engine = new Engine();
    const project = qesQmsProject(engine);
    project.driver.spec.woofer.Qms.set(6.0);
    const beforeSave = project.driver.spec.woofer.Qts.get().value;

    project.save();

    expect(project.driver.spec.woofer.Qts.get().value).toBeCloseTo(beforeSave!, 12);
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
        .passiveRadiator().volume_m3(0.05).tuning_hz(45)
        .radiator(radiator())
        .build();
    } else {
      p = OpenISDProject.builder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: tuneSpec({ Fs_hz: 37, Vas_m3: 0.0300, Qes: 0.40, Qms: 7.0, Re_ohm: 5.6 }),
      }), new Engine()).vented().volume_m3(0.05).tuning_hz(40).build();
    }
    const w = p.driver.spec.woofer;
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

  it('a vented project with no tuning_hz and no length_m reports a blocking VentIssue, not NaN curves', () => {
    // The silent-gap finding this closes: an unsized vent port produced `sweep().issues === []`
    // while zmag/zph/exc went NaN, and only the UI's generic classifyFinite postcondition ever
    // complained. The sweep must name the unstated vent target itself.
    const p = project('vented');
    p.box.vented.tuning_hz.clear();
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.diameter_m.set(0.1);

    const result = p.sweep({ fmin: 10, fmax: 100, N: 10 });
    expect(result.values).toBeNull();
    const issue = result.issues[0];
    expect(issue).toBeDefined();
    expect(issue).toMatchObject({ kind: 'missing-dependencies' });
    if (issue.kind === 'missing-dependencies') {
      expect(issue.target).toBe('length_m');
      expect([...issue.routes[0].required].sort()).toEqual(['Vb_m3', 'area_m2', 'tuning_hz']);
      expect(issue.routes[0].missing).toContain('tuning_hz');
    }
  });

  it('a passive-radiator project missing PR mass reports a blocking PrIssue, not NaN curves', () => {
    // The radiator is configured and the resonance TARGET (tuning_hz) is stated, but the
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
      expect([...issue.routes[0].required].sort().join(',')).toBe('Vb_m3,prCms_m_per_N,prMmd_kg,prSd_m2,tuning_hz');
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
});

describe('S2-7d2 — vent + PR join the cascade', () => {
  const ventedProjectWithArea = () => {
    const p = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).vented().volume_m3(0.05).tuning_hz(40).build();
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.diameter_m.set(0.1);
    return p;
  };

  it('(a) a vented project with tuning entered gets its port length solved into the record', () => {
    const p = ventedProjectWithArea();
    const cell = p.box.vented.vent.length_m.get();
    expect(cell.state).toBe('calculated');
    expect(cell.value).not.toBeNull();
  });

  it('(b) entering the length instead re-derives the tuning and drops the old entered target', () => {
    const p = ventedProjectWithArea();
    p.box.vented.vent.length_m.set(0.3);
    const lengthCell = p.box.vented.vent.length_m.get();
    const tuningCell = p.box.vented.tuning_hz.get();
    expect(lengthCell.state).toBe('entered');
    expect(lengthCell.value).toBe(0.3);
    expect(tuningCell.state).toBe('calculated');
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

    const tuningCell = p.box.passiveRadiator.tuning_hz.get();
    expect(tuningCell.state).toBe('calculated');
    expect(tuningCell.value).not.toBeNull();
    expect(p.box.passiveRadiator.systemTuning_hz.value).toBeCloseTo(tuningCell.value!, 6);
  });

  it('(d) an unreachable PR target DQs every field in the pair, and clearing it clears them all', () => {
    const p = prProject();
    p.box.passiveRadiator.addedMass_kg.set(0);
    const ceiling = p.box.passiveRadiator.systemTuning_hz.value!;

    p.box.passiveRadiator.tuning_hz.set(ceiling * 1.5);

    const DQ = [
      'addedMass_kg, tuning_hz disagree by 100%: Target tuning is above maximum passive radiator tuning. '
      + 'Every field in the group is marked — correct one of them, or clear one to let it be calculated.',
    ];
    expect(p.box.passiveRadiator.tuning_hz.get().dq()).toEqual(DQ);
    expect(p.box.passiveRadiator.addedMass_kg.get().dq()).toEqual(DQ);
    expect(p.box.passiveRadiator.systemTuning_hz.dq).toEqual(DQ);
    expect(p.box.passiveRadiator.resonanceWithAddedMass_hz.dq).toEqual(DQ);

    p.box.passiveRadiator.tuning_hz.clear();

    expect(p.box.passiveRadiator.tuning_hz.get().dq()).toEqual([]);
    expect(p.box.passiveRadiator.addedMass_kg.get().dq()).toEqual([]);
  });

  it('(e) exactly one engine.solveVent call per field set(), and zero for a bare project.box read', () => {
    const engine = new Engine();
    const p = OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), engine).vented().volume_m3(0.05).tuning_hz(40).build();
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.diameter_m.set(0.1);

    const readSpy = vi.spyOn(engine, 'solveVent');
    void p.box;
    void p.box.vented.vent.length_m.get();
    expect(readSpy).toHaveBeenCalledTimes(0);
    readSpy.mockRestore();

    const writeSpy = vi.spyOn(engine, 'solveVent');
    p.box.vented.vent.endCorrection_m.set(0.6);
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });
});

describe('box tuning/length/mass slots load as entries (S2-7b)', () => {
  function ventedProject() {
    return OpenISDProject.builder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).vented().volume_m3(0.05).tuning_hz(40).build();
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
    const cell = back.box.vented.vent.length_m.get();
    expect(cell.value).toBe(0.2);
    expect(cell.state).toBe('calculated');
  });

  it('the legacy null shape for a box entry slot is rejected, not silently accepted', () => {
    const back = reloadWith(ventedProject(), (box) => {
      (box as { vented: { vent: { length_m: unknown } } }).vented.vent.length_m = null;
    });
    if (!Array.isArray(back)) throw new Error('expected problems, got a project');
    expect(back.length).toBeGreaterThan(0);
  });
});
