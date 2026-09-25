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
import {describe, expect, it} from 'vitest';
import {Engine} from '@openisd/design/engine';
import {Engine as RootEngine, type FrequencyGrid, OpenISDProject,} from '../domain/index.js';
import {driverFromSpec, radiatorFromSpec} from './fixtures/recordBuilders.js';

// Block A is GONE. It tested `ebp_hz`, `referenceEfficiency` and `spl_dB` on the driver — three
// methods that solved the whole group to pull out two or three numbers and hand them to the
// engine. They are deleted: the driver publishes state, the engine does the physics, and a caller
// holding `solveConsistencyGroup()` already has both. Equivalent coverage belongs on the engine's
// own tests for `ebp`, `referenceEfficiency` and `splFromEfficiency`.


describe('B — the project runs the engine sweep on its own driver and box', () => {
  /** A driver complete enough for `deriveEngineDriver()` to succeed. */
  const complete = (engine: Engine) => driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
    Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100,
  });

  /** A sealed project driven at 1 W — every scenario below states the box volume and drive power
   *  itself, so the assembled `Vb`/`eg` are never stubbed. */
  const drivenSealed = (engine: Engine, volume_m3: number) => {
    const project = OpenISDProject.builder(complete(engine), engine).sealed().volume_m3(volume_m3).build();
    project.powerDrive_W.set(1);
    return project;
  };

  it('sweep() returns a response, and it is the ENGINE that produced it', () => {
    const engine = new Engine();
    const project = drivenSealed(engine, 0.03);
    const P: FrequencyGrid = { fmin: 10, fmax: 1000, N: 100 };

    const mine = project.sweep(P).values;
    expect(mine).not.toBeNull();
    const theirs = engine.sweep(
      project.driver.solverParams, project.driver.Le_H()!, 'sealed',
      {
        Vb: 0.03, eg: project.driveVoltage_V.value!, fmin: 10, fmax: 1000, N: 100,
        Ql: project.box.sealed.losses.Ql.value, Qa: project.box.sealed.losses.Qa.value,
        Rs: project.Rs_ohm.value,
        useWinisdAirModel: project.envUseWinisdAirModel.value,
      },
    ).values!;
    expect(mine!.spl).toEqual(theirs.spl);
  });

  it('the response MOVES with the box volume — nothing is stubbed', () => {
    const engine = new Engine();
    const small = drivenSealed(engine, 0.010);
    const big = drivenSealed(engine, 0.100);
    const P: FrequencyGrid = { fmin: 10, fmax: 1000, N: 100 };

    expect(small.sweep(P).values!.spl).not.toEqual(big.sweep(P).values!.spl);
  });

  it('sweep() is null when the driver is too incomplete to simulate', () => {
    const engine = new Engine();
    const project = OpenISDProject.builder(driverFromSpec(engine, { Fs_hz: 30 }), engine).sealed().volume_m3(0.03).build();

    expect(project.sweep({}).values).toBeNull();
  });

  it('sweep() is null for a topology the engine has no model for, and NOT for one it has', () => {
    const engine = new Engine();
    const project = drivenSealed(engine, 0.03);
    const P: FrequencyGrid = { fmin: 10, fmax: 1000, N: 50 };

    expect(project.sweep(P).values).not.toBeNull();

    // bandpass6 is a topology the domain names and the engine does not simulate.
    project.box.boxType.set('bandpass6');
    expect(project.sweep(P).values).toBeNull();
  });

  it('a passive-radiator box simulates, under the ONE box vocabulary', () => {
    // There is no domain-to-engine translation left to test: BoxType is declared once, in
    // engine/types.ts, and `box-passive-radiator` carries its prefix because `passive-radiator`
    // already names a DRIVER type (John's ruling D7, 2026-08-28). What this still pins is that
    // the enclosure reaches the engine and simulates, reading the PR chamber's own stored fields.
    const engine = new Engine();
    const project = drivenSealed(engine, 0.03);
    project.box.boxType.set('box-passive-radiator');
    project.box.passiveRadiator.configurePR(radiatorFromSpec(engine, {
      Fs_hz: 12, Sd_m2: 0.025, Cms_m_per_N: 0.0009, Mms_kg: 0.09, Rms_kg_per_s: 1.5, Xmax_m: 0.015,
    }));
    project.box.passiveRadiator.count.set(1);
    project.box.passiveRadiator.losses.Ql.set(7);
    project.box.passiveRadiator.losses.Qa.set(30);

    const P: FrequencyGrid = { fmin: 10, fmax: 1000, N: 50 };
    const mine = project.sweep(P).values;
    expect(mine).not.toBeNull();
  });

  it('maxCurves() and its finiteness check come from the engine', () => {
    const engine = new Engine();
    const project = drivenSealed(engine, 0.03);
    const P: FrequencyGrid = { fmin: 10, fmax: 1000, N: 100 };

    const mx = project.maxCurves(P).values;
    expect(mx).not.toBeNull();
    expect(project.classifyMaxFinite(mx!)).toBe(engine.classifyMaxFinite(mx!));
  });

  it('rolloffFreq() finds F3 below the passband, and F6 below F3', () => {
    const engine = new Engine();
    const project = drivenSealed(engine, 0.03);
    const sw = project.sweep({ fmin: 10, fmax: 1000, N: 400 }).values!;

    const f3 = project.rolloffFreq(sw, 3);
    const f6 = project.rolloffFreq(sw, 6);

    expect(f3).toBe(engine.rolloffFreq(sw, 3));
    expect(f6!).toBeLessThan(f3!);
  });

  it('passbandRef() and the response classifiers agree with the engine', () => {
    const engine = new Engine();
    const project = drivenSealed(engine, 0.03);
    const sw = project.sweep({ fmin: 10, fmax: 1000, N: 200 }).values!;

    expect(project.passbandRef(sw.spl)).toBe(engine.passbandRef(sw.spl));
    expect(project.classifyFinite(sw)).toBe(engine.classifyFinite(sw));
    expect(project.classifyFlatClamp(sw)).toBe(engine.classifyFlatClamp(sw));
  });

  it('boxParamsIssues() reports a bad parameter set BEFORE a sweep is attempted', () => {
    const engine = new Engine();
    const project = drivenSealed(engine, 0.03);

    expect(project.boxParamsIssues()).toEqual([]);
    // A zero-volume box is not a very small box; it is no box.
    const zeroVolume = drivenSealed(engine, 0);
    expect(zeroVolume.boxParamsIssues().length).toBeGreaterThan(0);
  });

  it('impedancePeak() reads the resonance off the CURVE, near the sealed prediction', () => {
    const engine = new Engine();
    const project = drivenSealed(engine, 0.03);
    const sw = project.sweep({ fmin: 10, fmax: 1000, N: 800 }).values!;

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
  const project = (engine: Engine) => OpenISDProject.builder(
    driverFromSpec(engine, { Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005 }), engine)
    .vented().volume_m3(0.03).tuning_goal_hz(30).build();

  it('effectiveLength_m() is longer than the port measures, by the engine\'s end correction', () => {
    const engine = new Engine();
    const p = project(engine);
    p.box.vented.vent.diameter_m.set(0.1);
    p.box.vented.vent.length_m.set(0.2);

    const area = Math.PI * 0.05 ** 2;
    expect(p.box.vented.vent.effectiveLength_m()).toBe(
      engine.ventEffectiveLength(0.2, area, 1, p.box.vented.vent.endCorrection_m.value),
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

  it('lengthForTuning_m answers null once any of volume_m3/fb_hz/the vent\'s own area is missing', () => {
    const engine = new Engine();
    const p = project(engine);
    p.box.vented.vent.diameter_m.set(0.1);

    expect(p.box.vented.vent.lengthForTuning_m(null, 30)).toBeNull();
    expect(p.box.vented.vent.lengthForTuning_m(0.03, 0)).toBeNull();
    p.box.vented.vent.diameter_m.clear();
    expect(p.box.vented.vent.lengthForTuning_m(0.03, 30)).toBeNull();
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
  const complete = (engine: Engine) => driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
    Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05,
  });

  // Drive power P and drive voltage V (John 2026-09-24, docs/plans/PLAN_RADIATOR_ALWAYS_PRESENT_AND_SIGNAL_PAIR.md
  // Part 2). V is never absent: a sweep always has a voltage. While Re is known, P = V²/Re and
  // whichever of P/V was entered last is the entered one.
  const withRe = (engine: Engine) => driverFromSpec(engine, { Fs_hz: 30, Re_ohm: 8 });
  const noRe = (engine: Engine) => driverFromSpec(engine, { Fs_hz: 30 });
  const projectOf = (engine: Engine, driver: ReturnType<typeof withRe>) =>
    OpenISDProject.builder(driver, engine).sealed().volume_m3(0.03).build();

  it('new project — pre: Re 8, nothing stated | trigger: build | post: P 1 E, V 2.83 C', () => {
    const engine = new Engine();
    const p = projectOf(engine, withRe(engine));
    expect(p.powerDrive_W.value).toBe(1);
    expect(p.powerDrive_W.entered).toBe(true);
    expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(8), 12);
    expect(p.driveVoltage_V.calculated).toBe(true);
  });

  it('scenario 1 — pre: Re none, nothing stated | trigger: build | post: P N, V 1 C', () => {
    const engine = new Engine();
    const p = projectOf(engine, noRe(engine));
    expect(p.powerDrive_W.value).toBe(null);
    expect(p.driveVoltage_V.value).toBe(1);
    expect(p.driveVoltage_V.calculated).toBe(true);
  });

  it('scenario 2 — pre: Re none, P N, V 1 C | trigger: type V 4 | post: P N, V 4 E', () => {
    const engine = new Engine();
    const p = projectOf(engine, noRe(engine));
    p.driveVoltage_V.set(4);
    expect(p.driveVoltage_V.value).toBe(4);
    expect(p.driveVoltage_V.entered).toBe(true);
    expect(p.powerDrive_W.value).toBe(null);
  });

  it('scenario 3 — pre: Re none, P N, V 3 E | trigger: type P 2 | post: refused; P N with dq naming Re, V 3 E', () => {
    const engine = new Engine();
    const p = projectOf(engine, noRe(engine));
    p.driveVoltage_V.set(3);
    expect(() => p.powerDrive_W.set(2)).toThrow(/Re_ohm/);
    expect(p.driveVoltage_V.value).toBe(3);
    expect(p.driveVoltage_V.entered).toBe(true);
    expect(p.powerDrive_W.value).toBe(null);
    const dq = p.powerDrive_W.dq[0];
    expect(dq).toMatchObject({ kind: 'missing-dependencies', target: 'power_W' });
    if (dq?.kind === 'missing-dependencies') expect(dq.routes[0].missing).toContain('Re_ohm');
  });

  it('scenario 4 — pre: Re 8, P 2 E, V 4 C | trigger: clear V | post: P 1 E, V 2.83 C', () => {
    const engine = new Engine();
    const p = projectOf(engine, withRe(engine));
    p.powerDrive_W.set(2);
    expect(p.driveVoltage_V.value).toBeCloseTo(4, 12);
    p.driveVoltage_V.clear();
    expect(p.powerDrive_W.value).toBe(1);
    expect(p.powerDrive_W.entered).toBe(true);
    expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(8), 12);
    expect(p.driveVoltage_V.calculated).toBe(true);
  });

  it('scenario 5 — pre: Re 8, P 2 E, V 4 C | trigger: clear P | post: P 2 C, V 4 E', () => {
    const engine = new Engine();
    const p = projectOf(engine, withRe(engine));
    p.powerDrive_W.set(2);
    p.powerDrive_W.clear();
    expect(p.driveVoltage_V.value).toBeCloseTo(4, 12);
    expect(p.driveVoltage_V.entered).toBe(true);
    expect(p.powerDrive_W.value).toBeCloseTo(2, 12);
    expect(p.powerDrive_W.calculated).toBe(true);
  });

  it('scenario 6 — pre: Re 8, P 5 E, V 6.32 C | trigger: remove Re | post: P N, V 6.32 E; then trigger: Re 8 | post: P 5 C, V 6.32 E', () => {
    const engine = new Engine();
    const p = projectOf(engine, withRe(engine));
    p.powerDrive_W.set(5);
    p.driver.specs.Re_ohm.clear();
    expect(p.powerDrive_W.value).toBe(null);
    expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(40), 12);
    expect(p.driveVoltage_V.entered).toBe(true);

    p.driver.specs.Re_ohm.set(8);
    expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(40), 12);
    expect(p.driveVoltage_V.entered).toBe(true);
    expect(p.powerDrive_W.value).toBeCloseTo(5, 12);
    expect(p.powerDrive_W.calculated).toBe(true);
  });

  it('scenario 7 — pre: Re 8, P 2 C, V 4 E | trigger: remove Re | post: P N, V 4 E', () => {
    const engine = new Engine();
    const p = projectOf(engine, withRe(engine));
    p.driveVoltage_V.set(4);
    expect(p.powerDrive_W.value).toBeCloseTo(2, 12);
    expect(p.powerDrive_W.calculated).toBe(true);
    p.driver.specs.Re_ohm.clear();
    expect(p.driveVoltage_V.value).toBe(4);
    expect(p.driveVoltage_V.entered).toBe(true);
    expect(p.powerDrive_W.value).toBe(null);
  });

  it('pre: Re 8, P 2 C, V 4 E | trigger: type P 8 | post: P 8 E, V 8 C', () => {
    const engine = new Engine();
    const p = projectOf(engine, withRe(engine));
    p.driveVoltage_V.set(4);
    p.powerDrive_W.set(8);
    expect(p.powerDrive_W.entered).toBe(true);
    expect(p.driveVoltage_V.calculated).toBe(true);
    expect(p.driveVoltage_V.value).toBeCloseTo(8, 12);
  });

  it('pre: Re none, P N, V 4 E | trigger: clear V | post: P N, V 1 C', () => {
    const engine = new Engine();
    const p = projectOf(engine, noRe(engine));
    p.driveVoltage_V.set(4);
    p.driveVoltage_V.clear();
    expect(p.driveVoltage_V.value).toBe(1);
    expect(p.driveVoltage_V.calculated).toBe(true);
  });

  it('pre: Re none, P N, V 1 C | trigger: Re 8 | post: P 1 E, V 2.83 C', () => {
    const engine = new Engine();
    const p = projectOf(engine, noRe(engine));
    p.driver.specs.Re_ohm.set(8);
    expect(p.powerDrive_W.value).toBe(1);
    expect(p.powerDrive_W.entered).toBe(true);
    expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(8), 12);
  });

  it('pre: Re 8, P 1 E, V 2.83 C | trigger: type V 0.005 or a P driving below 10 mV | post: refused, unchanged', () => {
    const engine = new Engine();
    const p = projectOf(engine, withRe(engine));
    expect(() => p.driveVoltage_V.set(0.005)).toThrow(/10 mV/);
    expect(() => p.driveVoltage_V.set(0)).toThrow(/10 mV/);
    expect(() => p.powerDrive_W.set(0)).toThrow(/10 mV/);
    expect(() => p.powerDrive_W.set(0.00001)).toThrow(/10 mV/);
    expect(p.powerDrive_W.value).toBe(1);
    expect(p.driveVoltage_V.value).toBeCloseTo(Math.sqrt(8), 12);
    p.driveVoltage_V.set(0.01);
    expect(p.driveVoltage_V.value).toBe(0.01);
  });

  it('pre: Re 6.4, P 1 E, V 2.53 C | trigger: clear P | post: P 1 C, V 2.53 E, sweep draws', () => {
    const engine = new Engine();
    const project = OpenISDProject.builder(complete(engine), engine).sealed().volume_m3(0.03).build();
    const grid: FrequencyGrid = { fmin: 10, fmax: 1000, N: 50 };
    project.powerDrive_W.clear();
    expect(project.powerDrive_W.value).toBeCloseTo(1, 12);
    expect(project.powerDrive_W.calculated).toBe(true);
    expect(project.driveVoltage_V.value).toBeCloseTo(Math.sqrt(6.4), 12);
    expect(project.driveVoltage_V.entered).toBe(true);
    expect(project.sweep(grid).values).not.toBeNull();
  });

  it('pre: Re 6.4, P 1 E, V 2.53 C | trigger: swap to a driver with Re 8 | post: P 1 E, V 2.83 C', () => {
    const engine = new Engine();
    const project = OpenISDProject.builder(complete(engine), engine).sealed().volume_m3(0.03).build();
    const replacement = complete(engine);
    replacement.specs.Re_ohm.set(8);

    project.setDriver(replacement);

    expect(project.powerDrive_W.value).toBe(1);
    expect(project.driveVoltage_V.value).toBeCloseTo(Math.sqrt(8), 12);
    expect(project.powerDrive_W.dq).toEqual([]);
    expect(project.driveVoltage_V.dq).toEqual([]);
  });

  it('sourceLoadedQts() RAISES Qts as the source impedance grows, and matches the engine', () => {
    const engine = new Engine();
    const project = OpenISDProject.builder(complete(engine), engine).sealed().volume_m3(0.03).build();
    const Qts = 1 / (1 / 4 + 1 / 0.4);

    // A perfect voltage source (Rs = 0) leaves Qts alone.
    expect(project.sourceLoadedQts(0)!).toBeCloseTo(Qts, 10);
    expect(project.sourceLoadedQts(2)!).toBe(engine.sourceLoadedQts(4, 0.4, 6.4, 2, Qts));
    expect(project.sourceLoadedQts(2)!).toBeGreaterThan(project.sourceLoadedQts(0)!);
  });

  it('sourceLoadedQts() is null when the driver\'s Q group cannot be resolved', () => {
    const engine = new Engine();
    const project = OpenISDProject.builder(driverFromSpec(engine, { Fs_hz: 30 }), engine).sealed().volume_m3(0.03).build();

    expect(project.sourceLoadedQts(2)).toBeNull();
  });
});

describe('K — the root surface names the engine door', () => {
  it('@openisd/design (the root barrel) re-exports Engine — the same class the engine door exports', () => {
    // `.` in the design package exports map resolves to `domain/index.ts`, so a consumer that
    // wants to build a project that runs the engine gets ONE import specifier — no need to reach
    // into `@openisd/design/engine` for the class the domain already takes as a collaborator.
    expect(RootEngine).toBe(Engine);
    expect(typeof RootEngine).toBe('function');
    expect(new RootEngine().sweep).toBe(Engine.prototype.sweep);
  });
});

// The voice-coil block is GONE. It tested `terminalRe_ohm`/`terminalBL_Tm` as driver methods.
// They are now engine functions, and the terminal values are their OWN fields on
// `DriverSolverQuantities` rather than a rewrite of `Re_ohm`/`BL_Tm` — so what needs covering is that
// the stated per-coil value SURVIVES, which is a different assertion from the one this block made.
