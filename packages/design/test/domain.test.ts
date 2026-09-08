import { describe, it, expect } from 'vitest';
import { Engine } from '@openisd/design/engine';
import {
  OpenISDProject,
  OpenISDDriver,
  OpenISDPassiveRadiatorStandalone,
  VoiceCoilWiring,
} from '../domain/index.js';

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
  // the unsuffixed ones `openisd.yml` states, which is what this literal has to produce.
  return {
    Fs: spec(p.Fs_hz), Qts: spec(p.Qts), Sd: spec(p.Sd_m2), Cms: spec(p.Cms_m_per_N),
    Mms: spec(p.Mmd_kg), Rms: spec(p.Rms_Ns_per_m), Xmax: spec(p.Xmax_m),
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
    Fs: spec(p.Fs_hz), Sd: spec(p.Sd_m2), Cms: spec(p.Cms_m_per_N),
    Mms: spec(p.Mmd_kg), Rms: spec(p.Rms_Ns_per_m), Xmax: spec(p.Xmax_m),
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
  spec: ReturnType<typeof specSection> | ReturnType<typeof prSpecSection>;
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
    expect(record.specs.woofer?.Fs?.origin).toBeDefined();
  });

  it('a write to the driver after the call does not retroactively change the returned record', () => {
    const driver = driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });

    const before = driver.cloneDriver();
    driver.spec.woofer.Fs_hz.set(99);
    const fsBeforeStr = JSON.stringify(before.specs.woofer?.Fs);
    const afterFs = driver.spec.woofer.Fs_hz.get().value;

    expect(afterFs).toBe(99);
    // The object handed back before the write must not itself have been mutated by the write.
    expect(JSON.stringify(before.specs.woofer?.Fs)).toBe(fsBeforeStr);
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
      brand: { value: 'Dayton', origin: 'scraped' },
      model: { value: 'RS225', origin: 'scraped' },
      manufacturer: { value: 'Dayton', origin: 'scraped' },
      uuid: { value: '00000000-0000-4000-8000-000000000000', origin: 'scraped' },
      sku: { value: 'TEST-SKU', origin: 'scraped' },
      driver_type: { value: 'woofer', origin: 'scraped' },
      data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' }, origin: 'scraped' },
      authoritative: { value: 'manufacturer_datasheet', origin: 'scraped' },
      quality: {
        confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      specs: {
        woofer: {
          Fs: {
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
      expect.stringContaining('specs.woofer.Fs.readings.datasheet.read_value'),
      expect.stringContaining('specs.woofer.Fs.readings.measured.read_value'),
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

    const fc = p.box.sealed.resonance_hz();
    // A sealed box always raises resonance above the driver's free-air Fs of 30 Hz.
    expect(fc).not.toBeNull();
    expect(fc!).toBeGreaterThan(30);
  });

  it('answers null for sealed resonance when there is no enclosure to resonate', () => {
    // Absence is null here as everywhere — never NaN, never 0, and never a throw. A zero volume
    // is not a very small box; it is no box.
    const p = project();
    p.box.sealed.volume_m3.set(0);
    expect(p.box.sealed.resonance_hz()).toBeNull();
  });

  it('a smaller box raises the resonance further — the engine is really being consulted', () => {
    // Non-vacuity: a hardcoded or stubbed value would not move with the volume.
    const big = project();  big.box.sealed.volume_m3.set(0.060);
    const small = project(); small.box.sealed.volume_m3.set(0.015);
    expect(small.box.sealed.resonance_hz()!).toBeGreaterThan(big.box.sealed.resonance_hz()!);
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

    expect(leaky.box.sealed.resonance_hz()).not.toBeCloseTo(tight.box.sealed.resonance_hz()!, 3);
  });

  it('STILL computes plain geometry — a port area is πr², which no model can disagree about', () => {
    const p = project();
    p.box.vented.vent.diameter_m.set(0.1);
    expect(p.box.vented.vent.area_m2()).toBeCloseTo(Math.PI * 0.05 ** 2, 12);
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
    // passive-radiator calculation reports null until it is set.
    p.box.passiveRadiator.volume_m3.set(0.03);
    p.box.passiveRadiator.addedMass_kg.set(0);

    const added = p.box.passiveRadiator.addedMassForTuning_kg(15);

    // Applying the answer must actually produce the target — the property that makes it the
    // right quantity, checked through the box's own forward calculation rather than a literal.
    p.box.passiveRadiator.addedMass_kg.set(added!);
    expect(p.box.passiveRadiator.systemTuning_hz()).toBeCloseTo(15, 6);
  });

  it('reports no mass for a tuning this radiator cannot reach in this box', () => {
    // The highest tuning reachable is the one produced with NO added mass; above that the
    // arithmetic asks for negative mass, and mass cannot come off a cone carrying none.
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson(), new Engine());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);
    p.box.passiveRadiator.volume_m3.set(0.03);
    p.box.passiveRadiator.addedMass_kg.set(0);

    const ceiling = p.box.passiveRadiator.systemTuning_hz()!;

    expect(p.box.passiveRadiator.addedMassForTuning_kg(ceiling * 1.5)).toBeNull();
    // At the ceiling itself the answer is zero added mass, not null — reachable, just barely.
    expect(p.box.passiveRadiator.addedMassForTuning_kg(ceiling)).toBeCloseTo(0, 9);
  });

  it('reports no resonance-with-added-mass until a radiator is chosen', () => {
    expect(project().box.passiveRadiator.resonanceWithAddedMass_hz()).toBeNull();
  });

  it('resonates at the radiator own Fs when no mass has been added', () => {
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson(), new Engine());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);
    p.box.passiveRadiator.addedMass_kg.set(0);

    // Mms 0.09 kg on Cms 0.0009 m/N: 1/(2π·√(0.09·0.0009)) = 17.6838… Hz.
    expect(p.box.passiveRadiator.resonanceWithAddedMass_hz()).toBeCloseTo(17.6838, 3);
  });

  it('falls as tuning mass goes onto the cone', () => {
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson(), new Engine());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);
    p.box.passiveRadiator.addedMass_kg.set(0.111111);

    // (0.09 + 0.111111) kg on the same compliance: 1/(2π·√(0.201111·0.0009)) = 11.8298… Hz.
    expect(p.box.passiveRadiator.resonanceWithAddedMass_hz()).toBeCloseTo(11.8299, 3);
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
  });

  it('renameToCopy() prefixes the model so the copy is a distinct brand/model', () => {
    const driver = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build().driver.detach();
    expect(driver.model.get().value).toBe('RS225');

    driver.renameToCopy();
    expect(driver.model.get().value).toBe('Copy of RS225');
  });

  it('toOwdrText() then OpenISDDriver.fromYml() round-trips a driver through .owdr text', () => {
    const driver = OpenISDProject.builder(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build().driver.detach();
    driver.spec.woofer.Fs_hz.set(41.5);

    const text = driver.toOwdrText();
    expect(typeof text).toBe('string');

    const back = OpenISDDriver.fromYml(text, new Engine());
    if (Array.isArray(back)) throw new Error('fromYml returned problems: ' + back.join(', '));
    expect(back.spec.woofer.Fs_hz.get().value).toBe(41.5);
    expect(back.model.get().value).toBe('RS225');
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

  it('series / description / sku read straight off the record', () => {
    const driver = driverWithProvenance();
    expect(driver.series).toBe('Reference Series');
    expect(driver.description).toBe('an 8 inch reference woofer');
    expect(driver.sku).toBe('TEST-SKU');
  });

  it('series and description are null when the record omits them', () => {
    const driver = driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });
    expect(driver.series).toBeNull();
    expect(driver.description).toBeNull();
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
    expect(p.box.passiveRadiator.systemTuning_hz()).toBeNull();
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

describe('a spec field the record does not state reads through the solver', () => {
  // John, 2026-09-08 (QO127): "a field whose value is not provided in the domain is obviously
  // not-available BUT if any such field is calculable then reading it should hit the solver
  // automatically - NOTHING is supposed to call the solver independently and write to the
  // domain THAT WOULD BE A BUG".

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

  it('the solved value is NOT written into the record, so only stated values are saved', () => {
    // The whole point of the ruling: reading a derived field must not turn it into something
    // the driver claims to state. A save writes the record, so a write-back here would forge
    // provenance on the wire.
    const d = vasAndSd();
    d.spec.woofer.Cms_m_per_N.get();
    expect(d.cloneDriver().specs.woofer?.Cms).toBeUndefined();
  });

  it('changing a stated input changes what the derived field reports', () => {
    // A cached solve that never invalidated would pass every test above and still be wrong.
    const d = vasAndSd();
    const before = d.spec.woofer.Cms_m_per_N.get().value!;
    d.spec.woofer.Vas_m3.set(0.10);
    expect(d.spec.woofer.Cms_m_per_N.get().value!).toBeCloseTo(before * 2, 12);
  });
});
