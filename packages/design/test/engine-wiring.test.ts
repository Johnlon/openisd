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
import type { SweepParams } from '@openisd/design/engine';
import {
  newProject, conformingRecordToDriver,
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
  const result = conformingRecordToDriver({
    brand: scraped('Dayton'), model: scraped('RS225'), manufacturer: scraped('Dayton'),
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
    specs: { woofer },
  }, engine);
  if (Array.isArray(result)) throw new Error(`fixture is not a valid driver: ${result.join(', ')}`);
  return result;
}

// Block A is GONE. It tested `ebp_hz`, `referenceEfficiency` and `spl_dB` on the driver — three
// methods that solved the whole group to pull out two or three numbers and hand them to the
// engine. They are deleted: the driver publishes state, the engine does the physics, and a caller
// holding `solveConsistencyGroup()` already has both. Equivalent coverage belongs on the engine's
// own tests for `ebp`, `referenceEfficiency` and `splFromEfficiency`.


describe('B — the project runs the engine sweep on its own driver and box', () => {
  /** A driver complete enough for `deriveEngineDriver()` to succeed. */
  const complete = (engine: Engine) => aDriver(engine, {
    Fs: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re: 6.4,
    Sd: 0.02, Cms: 0.0005, Vas: 0.05, BL: 8, Mms: 0.05, Xmax: 0.008, Pe: 100,
  });

  it('sweep() returns a response, and it is the ENGINE that produced it', () => {
    const engine = new Engine();
    const project = newProject(complete(engine), engine).sealed().volume_m3(0.03).build();
    const P: SweepParams = { Vb: 0.03, eg: 2.83, fmin: 10, fmax: 1000, N: 100 };

    const mine = project.sweep(P).value;
    const theirs = engine.sweep(project.driver.solveConsistencyGroup(), project.driver.Le_H()!, 'sealed', P).value!;

    expect(mine).not.toBeNull();
    expect(mine!.spl).toEqual(theirs.spl);
  });

  it('the response MOVES with the box volume — nothing is stubbed', () => {
    const engine = new Engine();
    const project = newProject(complete(engine), engine).sealed().volume_m3(0.03).build();

    const small = project.sweep({ Vb: 0.010, eg: 2.83, fmin: 10, fmax: 1000, N: 100 }).value!;
    const big = project.sweep({ Vb: 0.100, eg: 2.83, fmin: 10, fmax: 1000, N: 100 }).value!;

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

    const P: SweepParams = {
      Vb: 0.03, eg: 2.83, fmin: 10, fmax: 1000, N: 50,
      prSd: 0.025, prMmd: 0.09, prCms: 0.0009, prRms: 1.5, prNum: 1, prMadd: 0,
    };
    const mine = project.sweep(P).value;
    expect(mine).not.toBeNull();
    expect(mine!.spl).toEqual(engine.sweep(project.driver.solveConsistencyGroup(), project.driver.Le_H()!, 'box-passive-radiator', P).value!.spl);
  });

  it('maxCurves() and its finiteness check come from the engine', () => {
    const engine = new Engine();
    const project = newProject(complete(engine), engine).sealed().volume_m3(0.03).build();
    const P: SweepParams = { Vb: 0.03, eg: 2.83, fmin: 10, fmax: 1000, N: 100 };

    const mx = project.maxCurves(P).value;
    expect(mx).not.toBeNull();
    expect(project.classifyMaxFinite(mx!)).toBe(engine.classifyMaxFinite(mx!));
  });

  it('rolloffFreq() finds F3 below the passband, and F6 below F3', () => {
    const engine = new Engine();
    const project = newProject(complete(engine), engine).sealed().volume_m3(0.03).build();
    const sw = project.sweep({ Vb: 0.03, eg: 2.83, fmin: 10, fmax: 1000, N: 400 }).value!;

    const f3 = project.rolloffFreq(sw, 3);
    const f6 = project.rolloffFreq(sw, 6);

    expect(f3).toBe(engine.rolloffFreq(sw, 3));
    expect(f6!).toBeLessThan(f3!);
  });

  it('passbandRef() and the response classifiers agree with the engine', () => {
    const engine = new Engine();
    const project = newProject(complete(engine), engine).sealed().volume_m3(0.03).build();
    const sw = project.sweep({ Vb: 0.03, eg: 2.83, fmin: 10, fmax: 1000, N: 200 }).value!;

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
    const sw = project.sweep({ Vb: 0.03, eg: 2.83, fmin: 10, fmax: 1000, N: 800 }).value!;

    const peak = project.impedancePeak(sw);
    expect(peak).not.toBeNull();
    // A sealed box always raises resonance above the driver's free-air Fs of 30 Hz.
    expect(peak!.Fsc).toBeGreaterThan(30);
  });
});

// Block C is GONE. It tested `vas_m3`, `cmsForVas_m_per_N`, `fsWithAddedMass_hz`, `mmdForFs_kg`,
// `qms` and `rmsForQms_kg_per_s` on the radiator — six engine delegations with no production
// caller. The engine's `prVas`/`prCmsFromVas`/`prFsWithMass`/`prMmdFromFs`/`prQms`/`prRmsFromQms`
// are where those relations live and where they should be tested.


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

// The voice-coil block is GONE. It tested `terminalRe_ohm`/`terminalBL_Tm` as driver methods.
// They are now engine functions, and the terminal values are their OWN fields on
// `SolverQuantities` rather than a rewrite of `Re_ohm`/`BL_Tm` — so what needs covering is that
// the stated per-coil value SURVIVES, which is a different assertion from the one this block made.

