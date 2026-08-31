/**
 * THE DOMAIN CALLING THE ENGINE — every group, driven through the published surface only.
 *
 * No UI, no component mounting, no browser. A scenario here builds a driver or a project from a
 * plain record, asks it for a figure, and checks the figure came from the engine rather than from
 * arithmetic written into the domain.
 *
 * Two things every scenario is built to catch:
 *   - a hardcoded or stubbed answer, by moving an input and requiring the answer to move;
 *   - a figure computed in the domain, by comparing against the engine called directly with the
 *     same inputs, which must agree EXACTLY.
 *
 * Every number a scenario depends on is written inside that scenario, so a failure is diagnosable
 * from the one `it()` block without opening anything else.
 */
import { describe, it, expect } from 'vitest';
import { Engine } from '@openisd/design/engine';
import {
  newProject, driverFromConformingRecord, passiveRadiatorFromConformingRecord,
  VoiceCoilWiring,
  type OpenISDDriver,
} from '../domain/index.js';

const scraped = <T,>(value: T) => ({ value, origin: 'scraped' as string });

/** A conforming driver record. Structural plumbing only — every meaningful value is passed in
 *  by the scenario that depends on it.
 *
 *  The spec takes `number | VoiceCoilWiring` because a driver record is not all numbers: `VCCon`
 *  carries a wiring NAME. Typing this bag as `Record<string, number>` is what let the fixtures
 *  write the numbers 1 and 2 for the wiring and still compile, which kept eight tests green while
 *  the series path was unreachable. */
function aDriver(engine: Engine, spec: Record<string, number | VoiceCoilWiring>): OpenISDDriver {
  // A spec entry states no value of its own: the number lives on the reading `origin` names.
  // `VCCon` is the record's WIRING ENCODING — 1 parallel, 2 series — which is what the corpus
  // stores and what the domain maps to the enum at the field boundary. Writing the enum's NAME
  // here would build a record no scraper produces, and the fixture would stop being evidence.
  const woofer: Record<string, { origin: string; readings: Record<string, { read_value: number }> }> = {};
  for (const [k, v] of Object.entries(spec)) {
    const read_value = typeof v === 'number' ? v : (v === VoiceCoilWiring.Series ? 2 : 1);
    woofer[k] = { origin: 'scraped', readings: { scraped: { read_value } } };
  }
  const result = driverFromConformingRecord({
    brand: scraped('Dayton'), model: scraped('RS225'), manufacturer: scraped('Dayton'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    specs: { woofer },
  }, engine);
  if (Array.isArray(result)) throw new Error(`fixture is not a valid driver: ${result.join(', ')}`);
  return result;
}

describe('A — the driver reports figures FROM the injected engine', () => {
  it('ebp_hz() is Fs/Qes, and it is the engine that says so', () => {
    const engine = new Engine();
    const driver = aDriver(engine, { Fs: 30, Qes: 0.4, Qms: 4, Re: 6.4, Sd: 0.02, Cms: 0.0005 });

    // The engine, called directly with the same two numbers, is the authority this must match.
    expect(driver.ebp_hz()).toBe(engine.ebp({ Fs: 30, Qes: 0.4 }));
    expect(driver.ebp_hz()).toBeCloseTo(75, 10);
  });

  it('ebp_hz() MOVES with Qes — a stubbed value would not', () => {
    const engine = new Engine();
    const driver = aDriver(engine, { Fs: 30, Qes: 0.4, Qms: 4, Re: 6.4, Sd: 0.02, Cms: 0.0005 });

    const before = driver.ebp_hz()!;
    driver.spec.woofer.Qes.set(0.8);

    expect(driver.ebp_hz()!).toBeCloseTo(before / 2, 8);
  });

  it('a figure whose inputs are not stated is null, never NaN and never zero', () => {
    const engine = new Engine();
    // No Qes anywhere, and none derivable — Qms alone does not give it.
    const driver = aDriver(engine, { Fs: 30, Sd: 0.02, Cms: 0.0005 });

    expect(driver.ebp_hz()).toBeNull();
  });

  it('referenceEfficiency() and spl_dB() agree with the engine called directly', () => {
    const engine = new Engine();
    const driver = aDriver(engine, {
      Fs: 30, Qes: 0.4, Qms: 4, Re: 6.4, Sd: 0.02, Cms: 0.0005, Vas: 0.05,
    });
    const air = engine.airFor({ tempK: 293.15 });

    const no = driver.referenceEfficiency(air)!;
    expect(no).toBe(engine.referenceEfficiency(30, 0.05, 0.4, air));
    expect(driver.spl_dB(air)).toBe(engine.splFromEfficiency(no, air));
  });

  it('spl_dB() prefers a STATED efficiency over a derived one', () => {
    const engine = new Engine();
    // `no` stated outright, and deliberately far from what Fs/Vas/Qes would give.
    const driver = aDriver(engine, {
      Fs: 30, Qes: 0.4, Qms: 4, Re: 6.4, Sd: 0.02, Cms: 0.0005, Vas: 0.05, no: 0.01,
    });
    const air = engine.airFor({ tempK: 293.15 });

    expect(driver.spl_dB(air)).toBe(engine.splFromEfficiency(0.01, air));
  });

  it('the air CHANGES the answer — efficiency is evaluated in the air it is given', () => {
    const engine = new Engine();
    const driver = aDriver(engine, {
      Fs: 30, Qes: 0.4, Qms: 4, Re: 6.4, Sd: 0.02, Cms: 0.0005, Vas: 0.05,
    });

    const cold = driver.referenceEfficiency(engine.airFor({ tempK: 273.15 }))!;
    const hot = driver.referenceEfficiency(engine.airFor({ tempK: 313.15 }))!;

    expect(cold).not.toBeCloseTo(hot, 6);
  });

  it('solveConsistencyGroup() fills in what the stated values imply, and does NOT write back', () => {
    const engine = new Engine();
    // Qms and Qes stated; Qts follows from them and is not stated.
    const driver = aDriver(engine, { Fs: 30, Qes: 0.4, Qms: 4, Re: 6.4, Sd: 0.02, Cms: 0.0005 });

    expect(driver.fields().Qts).toBeUndefined();
    expect(driver.solveConsistencyGroup().Qts).toBeCloseTo(1 / (1 / 4 + 1 / 0.4), 8);
    // A derivation is not a fact: the record still holds only what was stated.
    expect(driver.fields().Qts).toBeUndefined();
    expect(driver.spec.woofer.Qts.get().value).toBeNull();
  });

  it('checkConsistency() reports a driver whose stated numbers cannot all be true', () => {
    const engine = new Engine();
    // Qts is stated, and disagrees with the Qms/Qes it should follow from.
    const driver = aDriver(engine, {
      Fs: 30, Qes: 0.4, Qms: 4, Qts: 0.9, Re: 6.4, Sd: 0.02, Cms: 0.0005,
    });

    expect(driver.checkConsistency().length).toBeGreaterThan(0);
    expect(driver.checkConsistency()).toEqual(engine.checkConsistency(driver.fields()));
  });

  it('checkConsistency() is EMPTY for a driver whose numbers agree — not vacuously noisy', () => {
    const engine = new Engine();
    const driver = aDriver(engine, { Fs: 30, Qes: 0.4, Qms: 4, Re: 6.4, Sd: 0.02, Cms: 0.0005 });

    expect(driver.checkConsistency()).toEqual([]);
  });

  it('toEngineDriver() yields a driver a sweep can run on, or says what is missing', () => {
    const engine = new Engine();
    const complete = aDriver(engine, {
      Fs: 30, Qes: 0.4, Qms: 4, Re: 6.4, Sd: 0.02, Cms: 0.0005, Vas: 0.05, BL: 8, Mms: 0.05,
    });

    expect(complete.toEngineDriver().value?.Fs).toBe(30);

    // A record with almost nothing in it cannot become one, and says so rather than throwing.
    const bare = aDriver(engine, { Fs: 30 });
    const result = bare.toEngineDriver();
    expect(result.value === undefined || result.errors.length > 0).toBe(true);
  });

  it('qGroupIsIncomplete() answers about THIS driver, not about the world', () => {
    const engine = new Engine();

    const twoOfThree = aDriver(engine, { Fs: 30, Qes: 0.4, Qms: 4, Sd: 0.02, Cms: 0.0005 });
    expect(twoOfThree.qGroupIsIncomplete()).toBe(false);

    const oneOfThree = aDriver(engine, { Fs: 30, Qes: 0.4, Sd: 0.02, Cms: 0.0005 });
    expect(oneOfThree.qGroupIsIncomplete()).toBe(true);
  });

  it('isQGroupField() names the interdependent Q values', () => {
    const engine = new Engine();
    const driver = aDriver(engine, { Fs: 30, Qes: 0.4, Qms: 4, Sd: 0.02, Cms: 0.0005 });

    expect(driver.isQGroupField('Qts')).toBe(true);
    expect(driver.isQGroupField('Xmax')).toBe(false);
  });

  it('fields() carries what the driver STATES, and omits what it does not', () => {
    const engine = new Engine();
    const driver = aDriver(engine, { Fs: 30, Qes: 0.4, Sd: 0.02 });

    expect(driver.fields()).toEqual({ Fs: 30, Qes: 0.4, Sd: 0.02 });
    // Absent, not present-holding-zero — the distinction the whole record design rests on.
    expect('Xmax' in driver.fields()).toBe(false);
  });

  it('a DETACHED copy keeps the engine, so it still reports figures', () => {
    const engine = new Engine();
    const driver = aDriver(engine, { Fs: 30, Qes: 0.4, Qms: 4, Sd: 0.02, Cms: 0.0005 });

    const copy = driver.detach();
    copy.spec.woofer.Fs_hz.set(60);

    expect(copy.ebp_hz()).toBeCloseTo(150, 8);
    expect(driver.ebp_hz()).toBeCloseTo(75, 8);
  });

  it("a PROJECT's driver reports figures too — the engine reaches the embedded driver", () => {
    const engine = new Engine();
    const project = newProject(
      aDriver(engine, { Fs: 30, Qes: 0.4, Qms: 4, Sd: 0.02, Cms: 0.0005 }),
      engine,
    ).sealed().volume_m3(0.03).build();

    expect(project.driver.ebp_hz()).toBeCloseTo(75, 8);
  });
});

describe('B — the project runs the engine sweep on its own driver and box', () => {
  /** A driver complete enough for `deriveEngineDriver()` to succeed. */
  const complete = (engine: Engine) => aDriver(engine, {
    Fs: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re: 6.4,
    Sd: 0.02, Cms: 0.0005, Vas: 0.05, BL: 8, Mms: 0.05, Xmax: 0.008, Pe: 100,
  });

  it('sweep() returns a response, and it is the ENGINE that produced it', () => {
    const engine = new Engine();
    const project = newProject(complete(engine), engine).sealed().volume_m3(0.03).build();
    const P = { Vb: 0.03, eg: 2.83, fmin: 10, fmax: 1000, N: 100 };

    const mine = project.sweep(P);
    const theirs = engine.sweep(project.driver.toEngineDriver().value!, 'sealed', P).value!;

    expect(mine).not.toBeNull();
    expect(mine!.spl).toEqual(theirs.spl);
  });

  it('the response MOVES with the box volume — nothing is stubbed', () => {
    const engine = new Engine();
    const project = newProject(complete(engine), engine).sealed().volume_m3(0.03).build();

    const small = project.sweep({ Vb: 0.010, eg: 2.83, fmin: 10, fmax: 1000, N: 100 })!;
    const big = project.sweep({ Vb: 0.100, eg: 2.83, fmin: 10, fmax: 1000, N: 100 })!;

    expect(small.spl).not.toEqual(big.spl);
  });

  it('sweep() is null when the driver is too incomplete to simulate', () => {
    const engine = new Engine();
    const project = newProject(aDriver(engine, { Fs: 30 }), engine).sealed().volume_m3(0.03).build();

    expect(project.sweep({ Vb: 0.03, eg: 2.83 })).toBeNull();
  });

  it('sweep() is null for a topology the engine has no model for, and NOT for one it has', () => {
    const engine = new Engine();
    const project = newProject(complete(engine), engine).sealed().volume_m3(0.03).build();

    expect(project.sweep({ Vb: 0.03, eg: 2.83, fmin: 10, fmax: 1000, N: 50 })).not.toBeNull();

    // bandpass6 is a topology the domain names and the engine does not simulate.
    project.box.boxType.set('bandpass6');
    expect(project.sweep({ Vb: 0.03, eg: 2.83, fmin: 10, fmax: 1000, N: 50 })).toBeNull();
  });

  it('a passive-radiator box simulates, under the ONE box vocabulary', () => {
    // There is no domain-to-engine translation left to test: BoxType is declared once, in
    // engine/types.ts, and `box-passive-radiator` carries its prefix because `passive-radiator`
    // already names a DRIVER type (John's ruling D7, 2026-08-28). What this still pins is that
    // the enclosure reaches the engine and simulates.
    const engine = new Engine();
    const project = newProject(complete(engine), engine).sealed().volume_m3(0.03).build();
    project.box.boxType.set('box-passive-radiator');

    const P = {
      Vb: 0.03, eg: 2.83, fmin: 10, fmax: 1000, N: 50,
      prSd: 0.025, prMmd: 0.09, prCms: 0.0009, prRms: 1.5, prNum: 1, prMadd: 0,
    };
    const mine = project.sweep(P);
    expect(mine).not.toBeNull();
    expect(mine!.spl).toEqual(engine.sweep(project.driver.toEngineDriver().value!, 'box-passive-radiator', P).value!.spl);
  });

  it('maxCurves() and its finiteness check come from the engine', () => {
    const engine = new Engine();
    const project = newProject(complete(engine), engine).sealed().volume_m3(0.03).build();
    const P = { Vb: 0.03, eg: 2.83, fmin: 10, fmax: 1000, N: 100 };

    const mx = project.maxCurves(P);
    expect(mx).not.toBeNull();
    expect(project.classifyMaxFinite(mx!)).toBe(engine.classifyMaxFinite(mx!));
  });

  it('rolloffFreq() finds F3 below the passband, and F6 below F3', () => {
    const engine = new Engine();
    const project = newProject(complete(engine), engine).sealed().volume_m3(0.03).build();
    const sw = project.sweep({ Vb: 0.03, eg: 2.83, fmin: 10, fmax: 1000, N: 400 })!;

    const f3 = project.rolloffFreq(sw, 3);
    const f6 = project.rolloffFreq(sw, 6);

    expect(f3).toBe(engine.rolloffFreq(sw, 3));
    expect(f6!).toBeLessThan(f3!);
  });

  it('passbandRef() and the response classifiers agree with the engine', () => {
    const engine = new Engine();
    const project = newProject(complete(engine), engine).sealed().volume_m3(0.03).build();
    const sw = project.sweep({ Vb: 0.03, eg: 2.83, fmin: 10, fmax: 1000, N: 200 })!;

    expect(project.passbandRef(sw.spl)).toBe(engine.passbandRef(sw.spl));
    expect(project.classifyFinite(sw)).toBe(engine.classifyFinite(sw));
    expect(project.classifyFlatClamp(sw)).toBe(engine.classifyFlatClamp(sw));
  });

  it('validateParams() reports a bad parameter set BEFORE a sweep is attempted', () => {
    const engine = new Engine();
    const project = newProject(complete(engine), engine).sealed().volume_m3(0.03).build();

    expect(project.validateParams({ Vb: 0.03, eg: 2.83, fmin: 10, fmax: 1000 })).toEqual([]);
    // A zero-volume box is not a very small box; it is no box.
    expect(project.validateParams({ Vb: 0, eg: 2.83, fmin: 10, fmax: 1000 }).length)
      .toBeGreaterThan(0);
  });

  it('impedancePeak() reads the resonance off the CURVE, near the sealed prediction', () => {
    const engine = new Engine();
    const project = newProject(complete(engine), engine).sealed().volume_m3(0.03).build();
    const sw = project.sweep({ Vb: 0.03, eg: 2.83, fmin: 10, fmax: 1000, N: 800 })!;

    const peak = project.impedancePeak(sw);
    expect(peak).not.toBeNull();
    // A sealed box always raises resonance above the driver's free-air Fs of 30 Hz.
    expect(peak!.Fsc).toBeGreaterThan(30);
  });
});

describe('C — the passive radiator and its box', () => {
  /** A conforming passive-radiator record. */
  function aRadiator(engine: Engine, spec: Record<string, number>) {
    const section: Record<string, { origin: string; readings: Record<string, { read_value: number }> }> = {};
    for (const [k, v] of Object.entries(spec)) {
      section[k] = { origin: 'scraped', readings: { scraped: { read_value: v } } };
    }
    const result = passiveRadiatorFromConformingRecord({
      brand: scraped('SB Acoustics'), model: scraped('SB23PACS'),
      manufacturer: scraped('SB Acoustics'), provided_by: scraped('test'),
      comment: scraped(''), added: scraped('2026-01-01'),
      specs: { 'passive-radiator': section },
    }, engine);
    if (Array.isArray(result)) throw new Error(`fixture is not a radiator: ${result.join(', ')}`);
    return result;
  }

  it('vas_m3() is the engine\'s, and its inverse round-trips back to the compliance', () => {
    const engine = new Engine();
    const pr = aRadiator(engine, { Sd: 0.025, Cms: 0.0009, Mms: 0.09, Rms: 1.5 });

    const vas = pr.vas_m3()!;
    expect(vas).toBe(engine.prVas(0.0009, 0.025));
    expect(pr.cmsForVas_m_per_N(vas)!).toBeCloseTo(0.0009, 12);
  });

  it('mass and resonance are inverses of each other, through the engine both ways', () => {
    const engine = new Engine();
    const pr = aRadiator(engine, { Sd: 0.025, Cms: 0.0009, Mms: 0.09, Rms: 1.5 });

    // Unloaded resonance, then the mass that would produce it.
    const fs = pr.fsWithAddedMass_hz(0)!;
    expect(pr.mmdForFs_kg(fs)!).toBeCloseTo(0.09, 10);
  });

  it('added mass LOWERS the radiator\'s resonance — the tuning knob really turns', () => {
    const engine = new Engine();
    const pr = aRadiator(engine, { Sd: 0.025, Cms: 0.0009, Mms: 0.09, Rms: 1.5 });

    expect(pr.fsWithAddedMass_hz(0.05)!).toBeLessThan(pr.fsWithAddedMass_hz(0)!);
  });

  it('qms() and its inverse round-trip', () => {
    const engine = new Engine();
    const pr = aRadiator(engine, { Sd: 0.025, Cms: 0.0009, Mms: 0.09, Rms: 1.5 });

    const q = pr.qms()!;
    expect(q).toBe(engine.prQms(0.09, 0.0009, 1.5));
    expect(pr.rmsForQms_kg_per_s(q)!).toBeCloseTo(1.5, 10);
  });

  it('a radiator that states nothing reports null, never zero', () => {
    const engine = new Engine();
    const pr = aRadiator(engine, { Sd: 0.025 });

    expect(pr.vas_m3()).toBeNull();
    expect(pr.qms()).toBeNull();
  });

  it('the BOX tunes with the radiator it holds — systemTuning_hz() and its inverse agree', () => {
    const engine = new Engine();
    const driver = aDriver(engine, { Fs: 30, Qes: 0.4, Qms: 4, Sd: 0.02, Cms: 0.0005 });
    const project = newProject(driver, engine)
      .passiveRadiator().volume_m3(0.03).tuning_hz(25)
      .radiator(aRadiator(engine, { Sd: 0.025, Cms: 0.0009, Mms: 0.09, Rms: 1.5 }))
      .build();

    const fp = project.box.passiveRadiator.systemTuning_hz()!;
    expect(fp).toBeGreaterThan(0);
    // The mass needed for the tuning it already has is the mass it already has (zero added).
    expect(project.box.passiveRadiator.addedMassForTuning_kg(fp)!).toBeCloseTo(0.09, 8);
  });

  it('a heavier radiator tunes the same box LOWER', () => {
    const engine = new Engine();
    const light = newProject(
      aDriver(engine, { Fs: 30, Qes: 0.4, Qms: 4, Sd: 0.02, Cms: 0.0005 }), engine)
      .passiveRadiator().volume_m3(0.03).tuning_hz(25)
      .radiator(aRadiator(engine, { Sd: 0.025, Cms: 0.0009, Mms: 0.09, Rms: 1.5 })).build();
    const heavy = newProject(
      aDriver(engine, { Fs: 30, Qes: 0.4, Qms: 4, Sd: 0.02, Cms: 0.0005 }), engine)
      .passiveRadiator().volume_m3(0.03).tuning_hz(25)
      .radiator(aRadiator(engine, { Sd: 0.025, Cms: 0.0009, Mms: 0.25, Rms: 1.5 })).build();

    expect(heavy.box.passiveRadiator.systemTuning_hz()!)
      .toBeLessThan(light.box.passiveRadiator.systemTuning_hz()!);
  });

  it('a box with no radiator chosen reports null rather than guessing', () => {
    const engine = new Engine();
    const project = newProject(
      aDriver(engine, { Fs: 30, Qes: 0.4, Qms: 4, Sd: 0.02, Cms: 0.0005 }), engine)
      .sealed().volume_m3(0.03).build();

    expect(project.box.passiveRadiator.systemTuning_hz()).toBeNull();
  });
});

describe('D — the vent', () => {
  const project = (engine: Engine) => newProject(
    aDriver(engine, { Fs: 30, Qes: 0.4, Qms: 4, Sd: 0.02, Cms: 0.0005 }), engine)
    .vented().volume_m3(0.03).tuning_hz(30).build();

  it('effectiveLength_m() is longer than the port measures, by the engine\'s end correction', () => {
    const engine = new Engine();
    const p = project(engine);
    p.box.vented.vent.diameter_m.set(0.1);
    p.box.vented.vent.length_m.set(0.2);

    const area = Math.PI * 0.05 ** 2;
    expect(p.box.vented.vent.effectiveLength_m()).toBe(
      engine.ventEffectiveLength(0.2, area, p.box.vented.vent.endCorrection_m.get()),
    );
    expect(p.box.vented.vent.effectiveLength_m()!).toBeGreaterThan(0.2);
  });

  it('a SLOTTED port of the same area gets the same acoustic length as a round one', () => {
    const engine = new Engine();
    const p = project(engine);
    p.box.vented.vent.diameter_m.set(0.1);
    p.box.vented.vent.length_m.set(0.2);
    const round = p.box.vented.vent.effectiveLength_m()!;

    // A slot with exactly the round port's area: the equivalent diameter must come out the same.
    const area = Math.PI * 0.05 ** 2;
    p.box.vented.vent.shape.set('slotted');
    p.box.vented.vent.width_m.set(0.05);
    p.box.vented.vent.height_m.set(area / 0.05);

    expect(p.box.vented.vent.effectiveLength_m()!).toBeCloseTo(round, 12);
  });

  it('tuning and length are inverses of each other, both through the engine', () => {
    const engine = new Engine();
    const p = project(engine);
    p.box.vented.vent.diameter_m.set(0.1);

    const length = p.box.vented.vent.lengthForTuning_m(0.03, 30)!;
    p.box.vented.vent.length_m.set(length);

    expect(p.box.vented.vent.tuningIn_hz(0.03)!).toBeCloseTo(30, 8);
  });

  it('a LONGER port tunes the same box LOWER', () => {
    const engine = new Engine();
    const p = project(engine);
    p.box.vented.vent.diameter_m.set(0.1);

    p.box.vented.vent.length_m.set(0.10);
    const shortPort = p.box.vented.vent.tuningIn_hz(0.03)!;
    p.box.vented.vent.length_m.set(0.30);

    expect(p.box.vented.vent.tuningIn_hz(0.03)!).toBeLessThan(shortPort);
  });

  it('a port with no dimensions reports null, and so does a zero-volume box', () => {
    const engine = new Engine();
    const p = project(engine);

    expect(p.box.vented.vent.effectiveLength_m()).toBeNull();
    p.box.vented.vent.diameter_m.set(0.1);
    p.box.vented.vent.length_m.set(0.2);
    expect(p.box.vented.vent.tuningIn_hz(0)).toBeNull();
  });
});

describe('E — the signal', () => {
  const complete = (engine: Engine) => aDriver(engine, {
    Fs: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re: 6.4,
    Sd: 0.02, Cms: 0.0005, Vas: 0.05, BL: 8, Mms: 0.05,
  });

  it('driveVoltage_V() is null until a drive power is stated — no invented default', () => {
    const engine = new Engine();
    const project = newProject(complete(engine), engine).sealed().volume_m3(0.03).build();

    expect(project.driveVoltage_V()).toBeNull();
  });

  it('sourceLoadedQts() RAISES Qts as the source impedance grows, and matches the engine', () => {
    const engine = new Engine();
    const project = newProject(complete(engine), engine).sealed().volume_m3(0.03).build();
    const Qts = 1 / (1 / 4 + 1 / 0.4);

    // A perfect voltage source (Rs = 0) leaves Qts alone.
    expect(project.sourceLoadedQts(0)!).toBeCloseTo(Qts, 10);
    expect(project.sourceLoadedQts(2)!).toBe(engine.sourceLoadedQts(4, 0.4, 6.4, 2, Qts));
    expect(project.sourceLoadedQts(2)!).toBeGreaterThan(project.sourceLoadedQts(0)!);
  });

  it('sourceLoadedQts() is null when the driver\'s Q group cannot be resolved', () => {
    const engine = new Engine();
    const project = newProject(aDriver(engine, { Fs: 30 }), engine).sealed().volume_m3(0.03).build();

    expect(project.sourceLoadedQts(2)).toBeNull();
  });
});

describe('voice coils — the driver states PER COIL, the system simulates TERMINAL', () => {
  // THE ENUM, never a bare literal (John, 2026-08-28: "NOPE USE THE ENUM"). WinISD's 1/2 encoding
  // is a file-format detail confined to the .wdr/.wpr adapter, and a loose 'series' string here
  // would be the same magic-value problem one layer down: a typo would compile and the test would
  // silently exercise the parallel path.
  const PARALLEL = VoiceCoilWiring.Parallel, SERIES = VoiceCoilWiring.Series;

  it('a single-coil driver is untouched — the common case costs nothing', () => {
    const engine = new Engine();
    const driver = aDriver(engine, {
      Fs: 30, Qes: 0.4, Qms: 4, Re: 6.4, BL: 8, Sd: 0.02, Cms: 0.0005, numVC: 1, VCCon: PARALLEL,
    });

    expect(driver.terminalRe_ohm()).toBe(6.4);
    expect(driver.terminalBL_Tm()).toBe(8);
  });

  it('TWO coils in PARALLEL: Re halves, BL is unchanged', () => {
    // N coils of resistance r are r/N in parallel; the current splits between them so each coil
    // makes force from its own share and the total force factor is unchanged.
    const engine = new Engine();
    const driver = aDriver(engine, {
      Fs: 30, Qes: 0.4, Qms: 4, Re: 6.4, BL: 8, Sd: 0.02, Cms: 0.0005, numVC: 2, VCCon: PARALLEL,
    });

    expect(driver.terminalRe_ohm()).toBeCloseTo(3.2, 12);
    expect(driver.terminalBL_Tm()).toBeCloseTo(8, 12);
  });

  it('TWO coils in SERIES: Re doubles, BL doubles', () => {
    // In series the same current flows through every coil, so the forces add.
    const engine = new Engine();
    const driver = aDriver(engine, {
      Fs: 30, Qes: 0.4, Qms: 4, Re: 6.4, BL: 8, Sd: 0.02, Cms: 0.0005, numVC: 2, VCCon: SERIES,
    });

    expect(driver.terminalRe_ohm()).toBeCloseTo(12.8, 12);
    expect(driver.terminalBL_Tm()).toBeCloseTo(16, 12);
  });

  it('series is 4x parallel in resistance — WinISD\'s own numVC^2, arrived at from both sides', () => {
    // WinISD stores ONE Re and multiplies it by numVC^2 to convert parallel -> series
    // (decompiled, 0x461242). That factor is the RATIO between the two terminal states here, so
    // the two models agree on every number while disagreeing on what is stored.
    const engine = new Engine();
    const base = { Fs: 30, Qes: 0.4, Qms: 4, Re: 6.4, BL: 8, Sd: 0.02, Cms: 0.0005, numVC: 2 };
    const par = aDriver(engine, { ...base, VCCon: PARALLEL });
    const ser = aDriver(engine, { ...base, VCCon: SERIES });

    expect(ser.terminalRe_ohm()! / par.terminalRe_ohm()!).toBeCloseTo(4, 12);   // numVC²
    expect(ser.terminalBL_Tm()! / par.terminalBL_Tm()!).toBeCloseTo(2, 12);     // numVC
  });

  it('FOUR coils scale by 4 and 16 — the law is not hardcoded for a pair', () => {
    const engine = new Engine();
    const base = { Fs: 30, Qes: 0.4, Qms: 4, Re: 6.4, BL: 8, Sd: 0.02, Cms: 0.0005, numVC: 4 };
    const par = aDriver(engine, { ...base, VCCon: PARALLEL });
    const ser = aDriver(engine, { ...base, VCCon: SERIES });

    expect(par.terminalRe_ohm()).toBeCloseTo(1.6, 12);
    expect(ser.terminalRe_ohm()).toBeCloseTo(25.6, 12);
    expect(ser.terminalRe_ohm()! / par.terminalRe_ohm()!).toBeCloseTo(16, 12);  // numVC²
  });

  it('THE STATED VALUE IS NEVER REWRITTEN — the whole reason for two fields', () => {
    // WinISD overwrites its single stored Re on a wiring change and leaves it marked as entered
    // by the user (John, 2026-08-28: "evil"). Here the record keeps exactly what was stated.
    const engine = new Engine();
    const driver = aDriver(engine, {
      Fs: 30, Qes: 0.4, Qms: 4, Re: 6.4, BL: 8, Sd: 0.02, Cms: 0.0005, numVC: 2, VCCon: SERIES,
    });

    expect(driver.terminalRe_ohm()).toBeCloseTo(12.8, 12);
    expect(driver.spec.woofer.Re_ohm.get().value).toBe(6.4);   // untouched
    expect(driver.spec.woofer.BL_Tm.get().value).toBe(8);      // untouched
    expect(driver.fields().Re).toBe(6.4);                      // and untouched in the record
  });

  it('the SWEEP runs on the terminal values, not the stated ones', () => {
    // Non-vacuity for the whole feature: if the derivation never reached the engine, a wiring
    // change would leave every curve identical — which is exactly the bug being fixed.
    const engine = new Engine();
    const base = {
      Fs: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re: 6.4, BL: 8, Mms: 0.05,
      Sd: 0.02, Cms: 0.0005, Vas: 0.05, Xmax: 0.008, Pe: 100, numVC: 2,
    };
    const P = { Vb: 0.03, eg: 2.83, fmin: 10, fmax: 1000, N: 200 };
    const par = newProject(aDriver(engine, { ...base, VCCon: PARALLEL }), engine)
      .sealed().volume_m3(0.03).build().sweep(P);
    const ser = newProject(aDriver(engine, { ...base, VCCon: SERIES }), engine)
      .sealed().volume_m3(0.03).build().sweep(P);

    expect(par).not.toBeNull();
    expect(ser).not.toBeNull();
    expect(par!.spl).not.toEqual(ser!.spl);
  });

  it('a record stating no numVC, or a nonsense 0, is treated as one coil rather than scaled to nothing', () => {
    const engine = new Engine();
    const absent = aDriver(engine, { Fs: 30, Qes: 0.4, Qms: 4, Re: 6.4, BL: 8, Sd: 0.02, Cms: 0.0005 });
    const zero = aDriver(engine, {
      Fs: 30, Qes: 0.4, Qms: 4, Re: 6.4, BL: 8, Sd: 0.02, Cms: 0.0005, numVC: 0, VCCon: SERIES,
    });

    expect(absent.terminalRe_ohm()).toBe(6.4);
    expect(zero.terminalRe_ohm()).toBe(6.4);
  });
});
