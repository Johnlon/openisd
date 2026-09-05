import { describe, it, expect } from 'vitest';
import { Engine } from '@openisd/design/engine';
import {
  newProject,
  conformingRecordToDriver,
  conformingRecordToPassiveRadiator,
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
  const result = conformingRecordToDriver(driverJson(p), new Engine());
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

describe('OpenISDDriver.recordToPersist() — the persistence layer\'s one seam onto the raw record', () => {
  it('returns the record the driver holds, readable by a repo without any field access', () => {
    const driver = driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });

    const record = driver.recordToPersist();
    expect(record.brand.value).toBe('Dayton');
    expect(record.specs.woofer?.Fs?.origin).toBeDefined();
  });

  it('a write to the driver after the call does not retroactively change the returned record', () => {
    const driver = driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });

    const before = driver.recordToPersist();
    driver.spec.woofer.Fs_hz.set(99);
    const fsBeforeStr = JSON.stringify(before.specs.woofer?.Fs);
    const afterFs = driver.spec.woofer.Fs_hz.get().value;

    expect(afterFs).toBe(99);
    // The object handed back before the write must not itself have been mutated by the write.
    expect(JSON.stringify(before.specs.woofer?.Fs)).toBe(fsBeforeStr);
  });
});

describe('OpenISDDriver.displayName() — what this record is called, single-driver contexts only', () => {
  it('joins brand and model with a space', () => {
    const driver = driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });
    expect(driver.displayName()).toBe('Dayton RS225');
  });

  it('falls back to "Driver" when both brand and model are empty', () => {
    const driver = driverFrom({
      brand: '', model: '', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });
    expect(driver.displayName()).toBe('Driver');
  });

  it('uses whichever of brand/model is present, alone, when the other is empty', () => {
    const driver = driverFrom({
      brand: 'Dayton', model: '', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });
    expect(driver.displayName()).toBe('Dayton');
  });
});

describe('the driver — a window, not a copy', () => {
  it('reads and writes through to the record it was given', () => {
    const driver = newProject(driverFrom({
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
    const project = newProject(driverFrom({
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
    const driver = newProject(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build().driver;

    // Identity must hold, or reference-equality memoization sees every read as a change.
    expect(driver.spec.woofer.Fs_hz).toBe(driver.spec.woofer.Fs_hz);
    expect(driver.brand).toBe(driver.brand);
  });

  it('reports what is wrong with a record instead of throwing, so a picker can show it', () => {
    const noSection = driverJson({
      brand: 'Dayton', model: 'RS225', section: 'passive-radiator',
      spec: prSpecSection({ Fs_hz: 30, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });

    const result = conformingRecordToDriver(noSection, new Engine());

    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain('neither a woofer nor a tweeter section — nothing to simulate');
  });

  it('reports EVERY problem at once, not just the first', () => {
    const result = conformingRecordToDriver({ brand: { value: 'Dayton', origin: 'x' } }, new Engine());

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
    const result = conformingRecordToDriver({ brand: { value: 'Dayton', origin: 'x' } }, new Engine());

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

    const result = conformingRecordToDriver(record, new Engine());

    expect(result).toEqual(expect.arrayContaining([
      expect.stringContaining('specs.woofer.Fs.readings.datasheet.read_value'),
      expect.stringContaining('specs.woofer.Fs.readings.measured.read_value'),
    ]));
  });

  it('detach() yields an instance that no longer shares storage with the original', () => {
    const original = newProject(driverFrom({
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
  const project = () => newProject(driverFrom({
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
    const leaky = newProject(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), new Engine()).sealed().volume_m3(0.03).build();
    const tight = newProject(driverFrom({
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
  const project = () => newProject(driverFrom({
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
    const library = conformingRecordToPassiveRadiator(prJson(), new Engine());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);

    expect(p.box.passiveRadiator.radiator.brand.get().value).toBe('SB Acoustics');

    p.box.passiveRadiator.radiator.spec.Sd_m2.set(0.031);
    expect(p.box.passiveRadiator.radiator.spec.Sd_m2.get().value).toBe(0.031);
    expect(library.spec.Sd_m2.get().value).toBe(0.025);
  });
});

describe('ManagedProject — the layers', () => {
  const managed = () => newProject(driverFrom({
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
    const mp = newProject(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build();

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
    const original = newProject(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build().driver.detach();

    const working = original.detach();
    working.spec.woofer.Fs_hz.set(200);
    expect(original.spec.woofer.Fs_hz.get().value).toBe(30);

    original.update(working);
    expect(original.spec.woofer.Fs_hz.get().value).toBe(200);
  });

  it('discards an edit by dropping the copy — nothing to roll back', () => {
    const original = newProject(wooferDriver(), new Engine()).sealed().volume_m3(0.03).build().driver.detach();

    const working = original.detach();
    working.spec.woofer.Fs_hz.set(500);
    // no update() — the copy simply goes out of scope

    expect(original.spec.woofer.Fs_hz.get().value).toBe(30);
  });
});
